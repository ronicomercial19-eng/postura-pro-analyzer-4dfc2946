import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle, XCircle, AlertTriangle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { runPoseAnalysisOnPhotos } from '@/services/runPoseAnalysis';

interface MediaCollectorProps {
  onNavigate?: (view: string) => void;
}

const MEDIA_STEPS = [
  { key: 'frente', label: 'Frente', side: 'NA', view: 'anterior' },
  { key: 'lado_d', label: 'Perfil Direito', side: 'D', view: 'lateral_d' },
  { key: 'costas', label: 'Costas', side: 'NA', view: 'posterior' },
  { key: 'lado_e', label: 'Perfil Esquerdo', side: 'E', view: 'lateral_e' },
];

type QAStatus = 'pending' | 'pass' | 'partial' | 'fail';

interface MediaItem {
  file?: File;
  preview?: string;
  qaStatus: QAStatus;
  qaChecks: { feetVisible: boolean; fullSpine: boolean; flatPlane: boolean };
  uploaded: boolean;
  uploadUrl?: string;
}

const MediaCollector = ({ onNavigate }: MediaCollectorProps) => {
  const { active, setStatus: setFlowStatus, setAnalysisRunId } = useActiveAssessment();
  const [currentStep, setCurrentStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<string>('');
  const [media, setMedia] = useState<Record<string, MediaItem>>(
    Object.fromEntries(MEDIA_STEPS.map(s => [s.key, {
      qaStatus: 'pending',
      qaChecks: { feetVisible: false, fullSpine: false, flatPlane: false },
      uploaded: false,
    }]))
  );

  const current = MEDIA_STEPS[currentStep];
  const currentMedia = media[current.key];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 10MB por foto.', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Formato inválido', description: 'Apenas imagens são aceitas.', variant: 'destructive' });
      return;
    }

    const preview = URL.createObjectURL(file);
    setMedia(prev => ({
      ...prev,
      [current.key]: { ...prev[current.key], file, preview, uploaded: false },
    }));
  };

  const updateQACheck = (check: keyof MediaItem['qaChecks'], value: boolean) => {
    setMedia(prev => {
      const item = { ...prev[current.key] };
      item.qaChecks = { ...item.qaChecks, [check]: value };
      const checks = Object.values(item.qaChecks);
      const passed = checks.filter(Boolean).length;
      item.qaStatus = passed === 3 ? 'pass' : passed >= 2 ? 'partial' : item.file ? 'fail' : 'pending';
      return { ...prev, [current.key]: item };
    });
  };

  const uploadSinglePhoto = async (stepKey: string) => {
    const item = media[stepKey];
    if (!item.file || !active.assessmentId) return null;

    const stepDef = MEDIA_STEPS.find(s => s.key === stepKey)!;
    const ext = item.file.name.split('.').pop();
    const path = `${active.assessmentId}/${stepKey}.${ext}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage.from('photos').upload(path, item.file, {
      upsert: true,
      contentType: item.file.type,
    });
    if (uploadError) throw uploadError;

    // Bucket "photos" é privado: gera signed URL (7 dias) em vez de URL pública
    const { data: signedData, error: signedError } = await supabase.storage
      .from('photos')
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedError) throw signedError;
    const imageUrl = signedData.signedUrl;

    // Insert media asset record
    const { error: insertError } = await supabase.from('ppa_media_assets' as any).insert({
      assessment_id: active.assessmentId,
      image_url: imageUrl,
      view: stepDef.view,
      side: stepDef.side,
      type: 'foto',
      qa_status: item.qaStatus,
      qa_reasons: Object.entries(item.qaChecks)
        .filter(([, v]) => !v)
        .map(([k]) => k),
      capture_confidence: item.qaStatus === 'pass' ? 0.95 : item.qaStatus === 'partial' ? 0.7 : 0.4,
    });
    if (insertError) throw insertError;

    return { imageUrl, view: stepDef.view };
  };

  const handleUploadAll = async () => {
    if (!active.assessmentId) {
      toast({ title: 'Erro', description: 'Nenhuma avaliação ativa. Crie uma avaliação primeiro.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const uploadedPhotos: { imageUrl: string; view: string }[] = [];
    try {
      setAnalysisPhase('Enviando fotos...');
      for (const step of MEDIA_STEPS) {
        const item = media[step.key];
        if (item.file && !item.uploaded) {
          const uploaded = await uploadSinglePhoto(step.key);
          if (uploaded) {
            uploadedPhotos.push(uploaded);
            setMedia(prev => ({
              ...prev,
              [step.key]: { ...prev[step.key], uploaded: true, uploadUrl: uploaded.imageUrl },
            }));
          }
        }
      }

      // === PONTE CENTRAL: roda MediaPipe real nas 4 fotos e gera achados/métricas ===
      setAnalysisPhase('Detectando pontos anatômicos (MediaPipe)...');
      const poseResult = await runPoseAnalysisOnPhotos(uploadedPhotos);

      if (poseResult.posesDetected === 0) {
        toast({
          title: 'Nenhuma pose detectada',
          description: 'As fotos foram salvas, mas não foi possível detectar o corpo em nenhuma delas. Verifique o enquadramento e refaça a coleta.',
          variant: 'destructive',
        });
      } else {
        setAnalysisPhase('Salvando achados biomecânicos...');
        // Cria o analysis_run que vai receber os achados
        const { data: runData, error: runError } = await supabase.from('ppa_analysis_runs' as any).insert({
          assessment_id: active.assessmentId,
          status: 'rascunho',
          model_version: 'mediapipe-pose-heavy',
        }).select('id').single();
        if (runError) throw runError;
        const runId = (runData as any).id;

        if (poseResult.findings.length > 0) {
          await supabase.from('ppa_findings' as any).insert(
            poseResult.findings.map(f => ({
              analysis_run_id: runId,
              finding_key: f.key,
              direction: f.direction,
              severity: f.severity,
              confidence: f.confidence,
            }))
          );
        }
        if (poseResult.metrics.length > 0) {
          await supabase.from('ppa_metrics' as any).insert(
            poseResult.metrics.map(m => ({
              analysis_run_id: runId,
              key: m.key,
              value: m.value,
              unit: m.unit,
              severity: m.severity,
            }))
          );
        }

        setAnalysisRunId(runId);
        toast({
          title: 'Achados detectados',
          description: `${poseResult.findings.length} pontos de atenção identificados em ${poseResult.posesDetected}/${poseResult.photosAnalyzed} fotos.`,
        });
      }

      // Update assessment status
      await supabase.from('ppa_assessments' as any)
        .update({ status: 'analisando' })
        .eq('id', active.assessmentId);

      setFlowStatus('analisando');
      onNavigate?.('results-hud');
    } catch (err: any) {
      toast({ title: 'Erro no upload/análise', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setAnalysisPhase('');
    }
  };

  const getStatusBadge = (status: QAStatus, uploaded: boolean) => {
    if (uploaded) return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" /> Enviado</Badge>;
    switch (status) {
      case 'pass': return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" /> Pass</Badge>;
      case 'partial': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'fail': return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" /> Fail</Badge>;
      default: return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const allMinimumPassed = MEDIA_STEPS.every(s => {
    const m = media[s.key];
    return m.file && (m.qaStatus === 'pass' || m.qaStatus === 'partial');
  });
  const allUploaded = MEDIA_STEPS.every(s => media[s.key].uploaded);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Coleta de Mídia</h1>
        <p className="text-muted-foreground text-sm">
          Upload guiado das fotos obrigatórias com validação QA.
          {active.studentName && <> — <strong>{active.studentName}</strong></>}
        </p>
      </div>

      {!active.assessmentId && (
        <div className="p-4 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Nenhuma avaliação ativa. Volte para "Avaliações" e crie uma nova.
        </div>
      )}

      {/* Progress bar */}
      <div className="flex gap-2">
        {MEDIA_STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setCurrentStep(i)}
            className={`flex-1 h-2 rounded-full transition-colors ${
              i === currentStep ? 'bg-primary' :
              media[s.key].uploaded ? 'bg-green-500' :
              media[s.key].qaStatus === 'pass' ? 'bg-green-400' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Status overview */}
      <div className="flex gap-2 flex-wrap">
        {MEDIA_STEPS.map((s, i) => (
          <button key={s.key} onClick={() => setCurrentStep(i)} className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{s.label}:</span>
            {getStatusBadge(media[s.key].qaStatus, media[s.key].uploaded)}
          </button>
        ))}
      </div>

      {/* Current upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{current.label}</span>
            {getStatusBadge(currentMedia.qaStatus, currentMedia.uploaded)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentMedia.preview ? (
            <div className="relative">
              <img src={currentMedia.preview} alt={current.label} className="w-full max-h-80 object-contain rounded-lg border" />
              {!currentMedia.uploaded && (
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setMedia(prev => ({
                    ...prev,
                    [current.key]: { ...prev[current.key], file: undefined, preview: undefined, qaStatus: 'pending', uploaded: false },
                  }))}
                >
                  Trocar foto
                </Button>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Clique para enviar foto ({current.label})</span>
              <span className="text-xs text-muted-foreground mt-1">Máx 10MB • JPG/PNG</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          )}

          {currentMedia.file && !currentMedia.uploaded && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium">Validação QA:</p>
              {[
                { key: 'feetVisible' as const, label: 'Pés visíveis na foto' },
                { key: 'fullSpine' as const, label: 'Coluna inteira visível' },
                { key: 'flatPlane' as const, label: 'Plano reto / sem inclinação de câmera' },
              ].map(check => (
                <div key={check.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={currentMedia.qaChecks[check.key]}
                    onCheckedChange={(v) => updateQACheck(check.key, !!v)}
                  />
                  <Label className="text-sm">{check.label}</Label>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(prev => prev - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            {currentStep < MEDIA_STEPS.length - 1 ? (
              <Button onClick={() => setCurrentStep(prev => prev + 1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleUploadAll} disabled={!allMinimumPassed || uploading || allUploaded || !active.assessmentId}>
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {analysisPhase || 'Enviando...'}</>
                ) : allUploaded ? (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Enviado ✓</>
                ) : (
                  '📤 Enviar e Analisar'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaCollector;
