import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Upload, Loader2, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { runPoseAnalysisOnPhotos } from '@/services/runPoseAnalysis';

interface Props { onNavigate: (view: string) => void; }

const VIEWS = [
  { key: 'frente', label: 'Frente', view: 'anterior', side: 'NA' },
  { key: 'costas', label: 'Costas', view: 'posterior', side: 'NA' },
  { key: 'lado_d', label: 'Lado D', view: 'lateral_d', side: 'D' },
  { key: 'lado_e', label: 'Lado E', view: 'lateral_e', side: 'E' },
];

const ExpressAnalysis = ({ onNavigate }: Props) => {
  const { setAssessment, setAnalysisRunId } = useActiveAssessment();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');

  const handleFile = (key: string, file: File | null) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [key]: file }));
    setPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  const allReady = VIEWS.every(v => files[v.key]);

  const runExpress = async () => {
    if (!allReady) {
      toast.error('Envie as 4 fotos primeiro');
      return;
    }
    setRunning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // 1. Cria assessment auto
      setProgress('Criando avaliação...');
      const { data: assessData, error: assessErr } = await supabase
        .from('ppa_assessments' as any)
        .insert({
          student_id: user.id,
          teacher_id: user.id,
          context: { modo: 'express', objetivo: 'Análise rápida' },
          pain: { intensidade: 0, regiao: 'nenhuma' },
          status: 'em_coleta',
        }).select('id').single();
      if (assessErr) throw assessErr;
      const assessmentId = (assessData as any).id;

      // 2. Upload fotos
      setProgress('Enviando fotos...');
      const uploadedPhotos: { imageUrl: string; view: string }[] = [];
      for (const v of VIEWS) {
        const file = files[v.key]!;
        const ext = file.name.split('.').pop();
        const path = `${assessmentId}/${v.key}.${ext}`;
        const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        // Bucket "photos" é privado: gera signed URL (7 dias) em vez de URL pública
        const { data: signedData, error: signedErr } = await supabase.storage
          .from('photos')
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signedErr) throw signedErr;
        const imageUrl = signedData.signedUrl;
        await supabase.from('ppa_media_assets' as any).insert({
          assessment_id: assessmentId,
          image_url: imageUrl,
          view: v.view,
          side: v.side,
          type: 'foto',
          qa_status: 'pass',
          capture_confidence: 0.9,
        });
        uploadedPhotos.push({ imageUrl, view: v.view });
      }

      // 3. PONTE CENTRAL: roda MediaPipe real nas 4 fotos (mesmo motor do fluxo normal)
      setProgress('Detectando pontos anatômicos (MediaPipe)...');
      await supabase.from('ppa_assessments' as any).update({ status: 'analisando' }).eq('id', assessmentId);
      const poseResult = await runPoseAnalysisOnPhotos(uploadedPhotos);

      if (poseResult.posesDetected === 0) {
        throw new Error('Não foi possível detectar o corpo em nenhuma foto. Verifique o enquadramento e tente novamente.');
      }

      // 4. Cria o analysis_run e grava achados/métricas reais
      const { data: runData, error: runErr } = await supabase.from('ppa_analysis_runs' as any)
        .insert({ assessment_id: assessmentId, model_version: 'mediapipe-pose-heavy', status: 'rascunho' })
        .select('id').single();
      if (runErr) throw runErr;
      const runId = (runData as any).id;

      if (poseResult.findings.length > 0) {
        await supabase.from('ppa_findings' as any).insert(
          poseResult.findings.map(f => ({
            analysis_run_id: runId, finding_key: f.key, direction: f.direction, severity: f.severity, confidence: f.confidence,
          }))
        );
      }
      if (poseResult.metrics.length > 0) {
        await supabase.from('ppa_metrics' as any).insert(
          poseResult.metrics.map(m => ({
            analysis_run_id: runId, key: m.key, value: m.value, unit: m.unit, severity: m.severity,
          }))
        );
      }

      // 5. Dispara análise IA com o payload CORRETO (findings/metrics/clientData/context/pain)
      setProgress('Gerando relatório com IA...');
      const { data: reportData, error: fnErr } = await supabase.functions.invoke('analyze-report', {
        body: {
          findings: poseResult.findings,
          metrics: poseResult.metrics,
          clusters: [],
          clientData: { name: user.email || 'Eu', age: 35, height: 175, weight: 72, sport: '', activity_level: '' },
          context: { footwear: 'não_informado', surface: 'plano', objective: 'Análise rápida', environment: 'indoor' },
          pain: { region: 'não_informada', intensity: 0, triggers: 'nenhum' },
        },
      });

      // 6. Salva de fato o relatório da IA (antes ele era descartado — nunca ficava
      // visível no ResultsHUD, que teria que rodar tudo de novo com um segundo clique).
      // Aqui já gravamos analysis_run como "concluido" + ppa_engine_decisions com o
      // relatório completo, igual ao fluxo normal (ResultsHUD.handleSaveReport).
      if (fnErr) {
        console.warn('analyze-report error:', fnErr);
        toast.warning('Achados salvos, mas o relatório de IA falhou. Você pode gerar de novo em Resultados.');
      } else if (reportData?.status === 'error') {
        console.warn('analyze-report returned error:', reportData.error);
        toast.warning('Achados salvos, mas o relatório de IA falhou: ' + reportData.error);
      } else if (reportData?.report) {
        const report = reportData.report;
        await supabase.from('ppa_analysis_runs' as any).update({
          status: 'concluido',
          confidence_final: report.confidence_score,
          dominant_vector: { archetype: report.postural_archetype, mode: report.operational_mode },
        }).eq('id', runId);

        await supabase.from('ppa_engine_decisions' as any).insert({
          analysis_run_id: runId,
          macro_state: report.operational_mode,
          risk_level: report.risk_assessment.overall_score > 70 ? 'alto' : report.risk_assessment.overall_score > 40 ? 'moderado' : 'baixo',
          decided_by: 'gemini-auto-express',
          micro_states: report.guardrails.filter((g: any) => g.triggered).map((g: any) => g.code),
          final_decision: {
            mode: report.operational_mode,
            justification: report.operational_justification,
            protocol: report.recovery_protocol,
            diagnosis: report.macro_diagnosis,
            archetype: report.postural_archetype,
            clinical_summary: report.clinical_summary,
            biomech_gps: report.biomech_gps || {},
          },
        });

        await supabase.from('ppa_assessments' as any).update({ status: 'pronto' }).eq('id', assessmentId);
      }

      setAssessment(assessmentId, user.id, user.email || 'Eu');
      setAnalysisRunId(runId);

      toast.success(`Análise concluída! ${poseResult.findings.length} pontos identificados.`);
      onNavigate('results-hud');
    } catch (err: any) {
      toast.error(err.message || 'Erro na análise express');
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise Express</h1>
          <p className="text-muted-foreground text-sm">4 fotos → Diagnóstico + Plano em ~30s</p>
        </div>
      </div>

      <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <p className="text-sm text-orange-900">Modo express pula o questionário. Use para triagem rápida ou análises do dia-a-dia.</p>
        </CardContent>
      </Card>

      {/* Grid de upload */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {VIEWS.map(v => (
          <Card key={v.key} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                {v.label}
                {files[v.key] && <CheckCircle className="h-4 w-4 text-green-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {previews[v.key] ? (
                <img src={previews[v.key]} alt={v.label} className="w-full h-32 object-cover rounded border" />
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Enviar</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(v.key, e.target.files?.[0] || null)} />
                </label>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={allReady ? 'default' : 'outline'}>
              {Object.keys(files).filter(k => files[k]).length}/4 fotos
            </Badge>
            {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
          </div>
          <Button onClick={runExpress} disabled={!allReady || running} size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Analisar Agora <ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpressAnalysis;
