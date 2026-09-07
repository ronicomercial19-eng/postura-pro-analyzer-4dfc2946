import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity, AlertTriangle, Brain, CheckCircle, Eye, RefreshCw, Zap, Flame, Ruler,
  BarChart3, Loader2, Shield, FileText, Save, ArrowRight, MapPin, ShieldAlert, Bone,
} from 'lucide-react';
import RiskGauges from '@/components/dashboard/RiskGauges';
import HeatmapOverlay from '@/components/dashboard/HeatmapOverlay';
import AnalyticCanvas from '@/components/dashboard/AnalyticCanvas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { useAuth } from '@/hooks/useAuth';
import { generateDiagnosticReport, DiagnosticInput, FailSafeResult, NeuroMetabolicAlert } from '@/services/diagnosticEngine';
import { extractTraumaContext, TraumaContextResult } from '@/services/traumaContextEngine';
import { getPrescriptionMatrixForFlags, PrescriptionMatrixRow } from '@/data/prescriptionMatrix';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from 'lucide-react';
import PublishToStudent from '@/components/teacher/PublishToStudent';

interface ResultsHUDProps {
  onNavigate?: (view: string) => void;
}

interface StudentOption { student_id: string; full_name: string | null; email: string | null; }
interface AssessmentOption { id: string; created_at: string; status: string; }

type ResultStatus = 'idle' | 'processando' | 'analisado' | 'pronto' | 'baixa_confianca' | 'conflitante' | 'precisa_midia';

interface AIReport {
  macro_diagnosis: string;
  postural_archetype: string;
  confidence_score: number;
  risk_assessment: { lumbar_risk: number; cervical_risk: number; base_risk: number; overall_score: number };
  hud_metrics: { iep: number; ea: number; pts: number; tns: number };
  operational_mode: 'LOAD' | 'SHIELD' | 'MIXED';
  operational_justification: string;
  tension_zones: Array<{ name: string; x: number; y: number; intensity: number; myofascial_line: string }>;
  findings_analysis: Array<{ key: string; direction: string; severity: number; confidence: number; clinical_note: string }>;
  guardrails: Array<{ code: string; triggered: boolean; message: string }>;
  recovery_protocol: { phase_1_release: string[]; phase_2_activation: string[]; phase_3_integration: string[] };
  clinical_summary: string;
  biomech_gps?: Record<string, any>;
  intervention_blocks?: { block_a: string[]; block_b: string[]; block_c: string[] };
  red_flags?: Array<{ type: string; message: string }>;
}

interface SupabaseFindings { finding_key: string; direction: string | null; severity: number; confidence: number | null; }
interface SupabaseMetric { key: string; value: number; unit: string | null; severity: number; }
interface SupabaseCluster { cluster_types: any; score: number; }

const ResultsHUD = ({ onNavigate }: ResultsHUDProps) => {
  const { active, setAssessment, setAnalysisRunId, setStatus: setFlowStatus } = useActiveAssessment();
  const { user, userRole } = useAuth();
  const [status, setStatus] = useState<ResultStatus>('idle');
  const [activeTab, setActiveTab] = useState('overview');
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>('/placeholder.svg');
  const [realFindings, setRealFindings] = useState<SupabaseFindings[]>([]);
  const [realMetrics, setRealMetrics] = useState<SupabaseMetric[]>([]);
  const [realClusters, setRealClusters] = useState<SupabaseCluster[]>([]);
  const [localDiagnostics, setLocalDiagnostics] = useState<any>(null);
  const [gpsMapping, setGpsMapping] = useState<Record<string, any> | null>(null);
  const [failSafes, setFailSafes] = useState<FailSafeResult | null>(null);
  const [nmAlerts, setNmAlerts] = useState<NeuroMetabolicAlert[]>([]);
  const [traumaContext, setTraumaContext] = useState<TraumaContextResult | null>(null);
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionMatrixRow[]>([]);

  // Student/assessment selectors
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const isTeacher = userRole === 'teacher';

  // Load students for teacher
  useEffect(() => {
    if (!user || !isTeacher) return;
    setLoadingStudents(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_teacher_students', { teacher_id: user.id });
        if (error) throw error;
        setStudents((data as any[]) || []);
      } catch (e) {
        console.error('load students', e);
      } finally { setLoadingStudents(false); }
    })();
  }, [user, isTeacher]);

  // Load assessments when a student is picked
  useEffect(() => {
    if (!active.studentId) { setAssessments([]); return; }
    setLoadingAssessments(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('ppa_assessments' as any)
          .select('id, created_at, status')
          .eq('student_id', active.studentId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        const list = (data as any[]) || [];
        setAssessments(list);
        // Auto-pick latest if none selected
        if (!active.assessmentId && list.length > 0) {
          await pickAssessment(list[0].id);
        }
      } catch (e) {
        console.error('load assessments', e);
      } finally { setLoadingAssessments(false); }
    })();
  }, [active.studentId]);

  const pickStudent = (studentId: string) => {
    const s = students.find(x => x.student_id === studentId);
    if (!s) return;
    setAssessment('', studentId, s.full_name || s.email || 'Aluno');
    setAiReport(null);
    setRealFindings([]);
    setRealMetrics([]);
    setRealClusters([]);
    setStatus('idle');
  };

  const pickAssessment = async (assessmentId: string) => {
    if (!active.studentId) return;
    setAssessment(assessmentId, active.studentId, active.studentName || 'Aluno');
    // Find latest analysis run for this assessment
    try {
      const { data: runs } = await supabase
        .from('ppa_analysis_runs' as any)
        .select('id, status')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: false })
        .limit(1);
      const runId = (runs as any[])?.[0]?.id;
      if (runId) setAnalysisRunId(runId);
    } catch (e) { console.error('pick assessment', e); }
  };

  useEffect(() => {
    if (!active.assessmentId) return;
    loadAssessmentData();
  }, [active.assessmentId, active.analysisRunId]);

  // ETAPA 1 do protocolo 9FIT: TRIAGEM DE TRAUMA.
  // Roda ANTES da interpretação visual, lendo o histórico de lesões coletado no questionário.
  useEffect(() => {
    const historyText = active.context?.historico_lesoes || '';
    if (historyText) {
      setTraumaContext(extractTraumaContext(historyText));
    } else {
      setTraumaContext(null);
    }
  }, [active.context]);

  const loadAssessmentData = async () => {
    try {
      // Busca TODAS as fotos da avaliacao (nao so a primeira) e prioriza a vista anterior para o canvas
      const { data: photos } = await supabase
        .from('ppa_media_assets' as any).select('image_url, view')
        .eq('assessment_id', active.assessmentId);
      if (photos && (photos as any[]).length > 0) {
        const list = photos as any[];
        const anterior = list.find(p => p.view === 'anterior');
        setPhotoUrl((anterior || list[0]).image_url);
      }

      if (active.analysisRunId) {
        const [findingsRes, metricsRes, clustersRes] = await Promise.all([
          supabase.from('ppa_findings' as any).select('*').eq('analysis_run_id', active.analysisRunId),
          supabase.from('ppa_metrics' as any).select('*').eq('analysis_run_id', active.analysisRunId),
          supabase.from('ppa_clusters' as any).select('*').eq('analysis_run_id', active.analysisRunId),
        ]);
        if (findingsRes.data) setRealFindings(findingsRes.data as any[]);
        if (metricsRes.data) setRealMetrics(metricsRes.data as any[]);
        if (clustersRes.data) setRealClusters(clustersRes.data as any[]);
      }
    } catch (err) { console.error('Error loading assessment data:', err); }
  };

  const runLocalDiagnostics = (findings: AIReport['findings_analysis']) => {
    const flagMap: Record<string, string> = {
      'anteriorização_cervical': 'PEP14', 'anteriorização cabeça': 'PEP14', 'cabeça protusa': 'PEP14',
      'hipercifose': 'PEP11', 'hipercifose_torácica': 'PEP11', 'cifose': 'PEP11',
      'protração_ombros': 'PEP12', 'ombro anteriorizado': 'PEP12', 'protração ombros': 'PEP12',
      'hiperlordose': 'PEP09', 'hiperlordose_lombar': 'PEP09', 'lordose aumentada': 'PEP09',
      'anteversão_pélvica': 'PEP07', 'anteversão pélvica': 'PEP07',
      'retroversão_pélvica': 'PEP08', 'retroversão pélvica': 'PEP08',
      'retificação lombar': 'PEP10', 'retificação_lombar': 'PEP10',
      'rotação_pélvica': 'PEP07', 'rotacao_pelvica': 'PEP07',
      'valgo_joelho': 'PEP04', 'valgo joelho': 'PEP04', 'genu valgo': 'PEP04',
      'valgo_dinamico': 'DYN01', 'valgo dinâmico': 'DYN01',
      'pé_pronado': 'PEP01', 'pé pronado': 'PEP01', 'pronação': 'PEP01',
      'escoliose': 'PEP15', 'escoliose_lombar': 'PEP15',
      'elevação_ombro': 'PEP13', 'ombro elevado': 'PEP13',
      // NM/CTX/LES mappings from Gemini
      'edema': 'NM01', 'formigamento': 'NM02', 'inflamação': 'NM03', 'sensibilidade nervosa': 'NM04',
      'calçado instável': 'CTX01', 'calçado_instavel': 'CTX01',
      'retrolistese': 'CTX03', 'osteopenia': 'CTX04',
      'ruptura lca': 'LES01', 'lca': 'LES01',
      'joanete': 'LES02', 'hallux valgus': 'LES02',
      'bursite': 'LES03',
    };

    const flags: string[] = [];
    findings.forEach(f => {
      const key = f.key.toLowerCase().replace(/_/g, ' ');
      for (const [pattern, flag] of Object.entries(flagMap)) {
        if (key.includes(pattern.replace(/_/g, ' '))) {
          if (!flags.includes(flag)) flags.push(flag);
        }
      }
    });

    // Pain flags from context
    if (active.pain.intensidade >= 2 && active.pain.regiao === 'lombar') flags.push('DOR02');
    if (active.pain.intensidade >= 3 && active.pain.regiao === 'lombar') flags.push('DOR03');
    if (active.pain.intensidade >= 2 && active.pain.regiao === 'joelho') flags.push('DOR04');
    if (active.pain.intensidade >= 2 && active.pain.regiao === 'cervical') flags.push('DOR06');
    if (active.pain.intensidade >= 2 && active.pain.regiao === 'ombro') flags.push('DOR07');

    // Context flags from assessment
    if (active.context.calcado === 'amortecido' || active.context.calcado === 'instável') flags.push('CTX01');
    const age = Number(active.context.idade);
    if (age && age > 70) flags.push('CTX02');

    // Trauma como bloqueio primário: fraturas/próteses/retirada óssea forçam contexto de fragilidade óssea
    if (traumaContext?.findings.some(f => ['TRM01', 'TRM04', 'TRM06'].includes(f.code))) {
      flags.push('CTX04');
    }

    if (flags.length > 0) {
      const input: DiagnosticInput = { flags };
      const report = generateDiagnosticReport(input);
      setLocalDiagnostics(report);
      setFailSafes(report.failSafes);
      setNmAlerts(report.neuroMetabolicAlerts);
    }

    // Matriz de Prescrição e Intervenção Tecnológica (doc oficial 9FIT Ecosystem)
    setPrescriptionRows(getPrescriptionMatrixForFlags(flags));
  };

  const buildGPSMapping = (report: AIReport) => {
    const gps: Record<string, any> = report.biomech_gps || {};
    if (Object.keys(gps).length === 0) {
      report.findings_analysis.forEach(f => {
        const k = f.key.toLowerCase();
        if (k.includes('valgo')) gps['valgo_dinamico'] = { detected: true, severity: f.severity };
        if (k.includes('pronado') || k.includes('pronação')) gps['retrope_valgo'] = { detected: true, severity: f.severity };
        if (k.includes('pélvica') || k.includes('pelvic')) gps['pelvic_drift'] = { detected: true, severity: f.severity, direction: f.direction };
        if (k.includes('lordose')) gps['hiperlordose'] = { detected: true, severity: f.severity };
        if (k.includes('cifose')) gps['hipercifose'] = { detected: true, severity: f.severity };
      });
    }
    setGpsMapping(gps);
  };

  const realKeypoints = realMetrics
    .filter(m => m.key.startsWith('keypoint_'))
    .map(m => ({ name: m.key.replace('keypoint_', ''), x: m.value, y: Number(m.unit) || 0, confidence: 0.9 }));

  const demoKeypoints = [
    { name: 'nose', x: 250, y: 60, confidence: 0.95 },
    { name: 'left_shoulder', x: 200, y: 130, confidence: 0.92 },
    { name: 'right_shoulder', x: 300, y: 125, confidence: 0.93 },
    { name: 'left_hip', x: 220, y: 300, confidence: 0.91 },
    { name: 'right_hip', x: 280, y: 295, confidence: 0.92 },
    { name: 'left_knee', x: 215, y: 420, confidence: 0.89 },
    { name: 'right_knee', x: 285, y: 415, confidence: 0.9 },
    { name: 'left_ankle', x: 210, y: 530, confidence: 0.85 },
    { name: 'right_ankle', x: 290, y: 525, confidence: 0.86 },
  ];

  const keypoints = realKeypoints.length > 0 ? realKeypoints : demoKeypoints;

  const hasRealData = !!aiReport || realFindings.length > 0;

  const findingsForDisplay = aiReport
    ? aiReport.findings_analysis.map(f => ({ key: f.key, direction: f.direction, severity: f.severity, confidence: f.confidence, clinical_note: f.clinical_note }))
    : realFindings.length > 0
    ? realFindings.map(f => ({ key: f.finding_key, direction: f.direction || 'anterior', severity: f.severity, confidence: f.confidence || 0, clinical_note: '' }))
    : [];

  const risks = aiReport ? aiReport.risk_assessment : { lumbar_risk: 0, cervical_risk: 0, base_risk: 0, overall_score: 0 };
  const hudCards = [
    { key: 'IEP', label: 'Estabilidade Podal', value: aiReport?.hud_metrics.iep ?? 0, icon: Activity, color: 'text-blue-600' },
    { key: 'EA', label: 'Espaço Articular', value: aiReport?.hud_metrics.ea ?? 0, icon: Zap, color: 'text-purple-600' },
    { key: 'PTS', label: 'Transferência Potência', value: aiReport?.hud_metrics.pts ?? 0, icon: Brain, color: 'text-green-600' },
    { key: 'TNS', label: 'Tremor Neuromuscular', value: aiReport?.hud_metrics.tns ?? 0, icon: Activity, color: 'text-orange-600' },
  ];
  const tensionZones = aiReport
    ? aiReport.tension_zones.map((z, i) => ({ id: `z${i}`, name: z.name, x: z.x, y: z.y, intensity: z.intensity, myofascialLine: z.myofascial_line }))
    : [];
  const triggeredGuardrails = aiReport?.guardrails.filter(g => g.triggered) || [];

  const getSeverityColor = (s: number) => s >= 3 ? 'bg-red-100 text-red-800 border-red-300' : s === 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-green-100 text-green-800 border-green-300';
  const getModeColor = (mode: string) => mode === 'LOAD' ? 'bg-green-100 text-green-800' : mode === 'SHIELD' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';

  const handleAnalyze = async () => {
    if (!active.assessmentId) {
      toast.error('Selecione uma avaliação antes de analisar.');
      return;
    }
    if (realFindings.length === 0) {
      toast.error('Esta avaliação ainda não tem achados coletados. Faça a coleta primeiro.');
      return;
    }
    setIsAnalyzing(true);
    setStatus('processando');
    const findingsPayload = realFindings.map(f => ({ key: f.finding_key, direction: f.direction, severity: f.severity, confidence: f.confidence }));
    const metricsPayload = realMetrics.map(m => ({ key: m.key, value: m.value, unit: m.unit, severity: m.severity }));
    const clustersPayload = realClusters.map(c => ({ cluster_types: c.cluster_types, score: c.score }));

    try {
      const { data, error } = await supabase.functions.invoke('analyze-report', {
        body: {
          findings: findingsPayload, metrics: metricsPayload, clusters: clustersPayload,
          clientData: { name: active.studentName || 'Cliente', age: Number(active.context.idade) || 35, height: Number(active.context.altura) || 175, weight: Number(active.context.peso) || 72, sport: active.context.esporte || '', activity_level: active.context.nivel_atividade || '' },
          context: { footwear: active.context.calcado || 'não_informado', surface: active.context.superficie || 'plano', objective: active.context.objetivo || 'correção_postural', environment: active.context.ambiente || 'indoor' },
          pain: { region: active.pain.regiao || 'não_informada', intensity: active.pain.intensidade || 0, triggers: active.pain.gatilhos || 'nenhum' },
          trauma_context: traumaContext?.primaryBlockage ? {
            primary_blockage: traumaContext.primaryBlockage.label,
            zone: traumaContext.primaryBlockage.zone,
            side: traumaContext.primaryBlockage.side,
            clinical_note: traumaContext.primaryBlockage.clinical_note,
            narrative: traumaContext.narrative,
          } : null,
        },
      });

      if (error) { toast.error('Erro ao analisar relatório.'); setStatus('idle'); return; }
      if (data?.status === 'error') { toast.error(data.error); setStatus('idle'); return; }
      if (data?.report) {
        setAiReport(data.report);
        runLocalDiagnostics(data.report.findings_analysis);
        buildGPSMapping(data.report);
        // Nao marca "pronto" ainda: "pronto" (que libera Publicar para o Aluno)
        // so acontece depois que o relatorio for de fato salvo em handleSaveReport,
        // para o Publicar nunca referenciar uma analysis_run que nao tem o registro completo salvo.
        setStatus(data.report.confidence_score < 0.6 ? 'baixa_confianca' : 'analisado');
        toast.success(data.report.confidence_score < 0.6 ? 'Confiança baixa. Revise manualmente.' : 'Análise concluída! Clique em "Salvar Relatório" para poder publicar para o aluno.');
      }
    } catch (err: any) {
      toast.error('Erro inesperado na análise.');
      setStatus('idle');
    } finally { setIsAnalyzing(false); }
  };

  const handleSaveReport = async () => {
    if (!aiReport || !active.assessmentId) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: runData, error: runError } = await supabase.from('ppa_analysis_runs' as any).insert({
        assessment_id: active.assessmentId, status: 'concluido', model_version: 'gemini-3-flash',
        confidence_final: aiReport.confidence_score, dominant_vector: { archetype: aiReport.postural_archetype, mode: aiReport.operational_mode },
      }).select('id').single();
      if (runError) throw runError;
      const runId = (runData as any).id;
      setAnalysisRunId(runId);

      if (aiReport.findings_analysis.length > 0) {
        await supabase.from('ppa_findings' as any).insert(aiReport.findings_analysis.map(f => ({
          analysis_run_id: runId, finding_key: f.key, direction: f.direction, severity: f.severity, confidence: f.confidence, chain: { clinical_note: f.clinical_note },
        })));
      }

      await supabase.from('ppa_metrics' as any).insert([
        { analysis_run_id: runId, key: 'iep', value: aiReport.hud_metrics.iep, unit: '%', severity: aiReport.hud_metrics.iep < 50 ? 2 : 1 },
        { analysis_run_id: runId, key: 'ea', value: aiReport.hud_metrics.ea, unit: '%', severity: aiReport.hud_metrics.ea < 50 ? 2 : 1 },
        { analysis_run_id: runId, key: 'pts', value: aiReport.hud_metrics.pts, unit: '%', severity: aiReport.hud_metrics.pts < 50 ? 2 : 1 },
        { analysis_run_id: runId, key: 'tns', value: aiReport.hud_metrics.tns, unit: '%', severity: aiReport.hud_metrics.tns > 50 ? 2 : 1 },
      ]);

      await supabase.from('ppa_engine_decisions' as any).insert({
        analysis_run_id: runId,
        macro_state: failSafes?.forced_mode || aiReport.operational_mode,
        risk_level: aiReport.risk_assessment.overall_score > 70 ? 'alto' : aiReport.risk_assessment.overall_score > 40 ? 'moderado' : 'baixo',
        decided_by: 'gemini-auto',
        micro_states: [
          ...aiReport.guardrails.filter(g => g.triggered).map(g => g.code),
          ...(failSafes?.alerts.map(a => a.type) || []),
        ],
        final_decision: {
          mode: failSafes?.forced_mode || aiReport.operational_mode,
          justification: aiReport.operational_justification,
          protocol: aiReport.recovery_protocol, diagnosis: aiReport.macro_diagnosis,
          archetype: aiReport.postural_archetype, clinical_summary: aiReport.clinical_summary,
          biomech_gps: gpsMapping,
          local_diagnoses: localDiagnostics?.diagnoses?.map((d: any) => d.diagnosis) || [],
          fail_safes: failSafes,
          neuro_metabolic_alerts: nmAlerts,
          trauma_context: traumaContext,
        },
      });

      await supabase.from('ppa_assessments' as any).update({ status: 'pronto' }).eq('id', active.assessmentId);
      setFlowStatus('pronto');
      // So agora libera o botao "Publicar para o Aluno": o analysisRunId ja aponta
      // para a run com engine_decisions/findings/metrics completos e salvos.
      setStatus('pronto');
      toast.success('Relatório salvo! Agora você já pode publicar para o aluno.');
    } catch (err: any) { toast.error('Erro ao salvar: ' + err.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resultados</h1>
          <p className="text-muted-foreground text-sm">
            Scanner Matricial + HUD
            {active.studentName && <> — <strong>{active.studentName}</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {failSafes?.forced_mode && <Badge className="bg-red-100 text-red-800"><ShieldAlert className="h-3 w-3 mr-1" />SHIELD FORÇADO</Badge>}
          {aiReport && !failSafes?.forced_mode && <Badge className={getModeColor(aiReport.operational_mode)}><Shield className="h-3 w-3 mr-1" />{aiReport.operational_mode}</Badge>}
          <Badge variant={status === 'pronto' ? 'default' : 'outline'}>
            {status === 'processando' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {status === 'idle' ? 'aguardando' : status}
          </Badge>
        </div>
      </div>

      {/* BLOQUEIO PRIMÁRIO — Camada de Trauma (Etapa 1 do protocolo 9FIT) */}
      {traumaContext?.primaryBlockage && (
        <Alert className="border-amber-400 bg-amber-50">
          <Bone className="h-4 w-4 text-amber-700" />
          <AlertDescription>
            <strong className="text-amber-900">🦴 Bloqueio Primário: {traumaContext.primaryBlockage.label}</strong>
            {traumaContext.primaryBlockage.zone && (
              <span className="text-amber-800"> — {traumaContext.primaryBlockage.zone}{traumaContext.primaryBlockage.side ? ` (${traumaContext.primaryBlockage.side === 'D' ? 'lado direito' : 'lado esquerdo'})` : ''}</span>
            )}
            <p className="text-xs text-amber-800 mt-1">{traumaContext.primaryBlockage.clinical_note}</p>
            <p className="text-xs text-amber-700 mt-1 italic">Todo desvio postural detectado abaixo deve ser lido como compensação a partir deste ponto.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Student / Assessment selector for teachers */}
      {isTeacher && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Selecione um aluno e avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Aluno</label>
              <Select value={active.studentId || ''} onValueChange={pickStudent} disabled={loadingStudents}>
                <SelectTrigger><SelectValue placeholder={loadingStudents ? 'Carregando...' : 'Escolha um aluno'} /></SelectTrigger>
                <SelectContent>
                  {students.length === 0 && <SelectItem value="__empty__" disabled>Nenhum aluno vinculado</SelectItem>}
                  {students.map(s => (
                    <SelectItem key={s.student_id} value={s.student_id}>{s.full_name || s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Avaliação</label>
              <Select value={active.assessmentId || ''} onValueChange={pickAssessment} disabled={!active.studentId || loadingAssessments}>
                <SelectTrigger><SelectValue placeholder={!active.studentId ? 'Escolha um aluno primeiro' : loadingAssessments ? 'Carregando...' : 'Escolha uma avaliação'} /></SelectTrigger>
                <SelectContent>
                  {assessments.length === 0 && <SelectItem value="__empty__" disabled>Nenhuma avaliação encontrada</SelectItem>}
                  {assessments.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {new Date(a.created_at).toLocaleDateString('pt-BR')} — {a.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {!active.assessmentId && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isTeacher
              ? 'Selecione um aluno e uma avaliação acima para visualizar os resultados.'
              : 'Nenhuma avaliação disponível ainda. Aguarde seu professor publicar uma análise.'}
          </AlertDescription>
        </Alert>
      )}

      {aiReport && (
        <Alert><Brain className="h-4 w-4" /><AlertDescription>
          <strong>Diagnóstico Gemini:</strong> {aiReport.macro_diagnosis}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{aiReport.postural_archetype}</Badge>
            <span className="text-xs text-muted-foreground">Confiança: {Math.round(aiReport.confidence_score * 100)}%</span>
          </div>
        </AlertDescription></Alert>
      )}

      {/* Red flags from AI */}
      {aiReport?.red_flags?.map((rf, i) => (
        <Alert key={i} variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>🔴 {rf.type}: {rf.message}</AlertDescription></Alert>
      ))}

      {/* Fail-safe alerts */}
      {failSafes && failSafes.alerts.filter(a => a.severity === 'critical').map((a, i) => (
        <Alert key={`fs-${i}`} variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertDescription>
          <strong>{a.type}:</strong> {a.message}
          <p className="text-xs mt-1">{a.action}</p>
        </AlertDescription></Alert>
      ))}

      {/* Neuro-metabolic alerts */}
      {nmAlerts.filter(a => a.severity === 'critical').map((a, i) => (
        <Alert key={`nm-${i}`} variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>
          <strong>🧠 {a.type}:</strong> {a.message}
          <p className="text-xs mt-1">{a.recommendation}</p>
        </AlertDescription></Alert>
      ))}

      {triggeredGuardrails.map((g, i) => (
        <Alert key={i} variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription><strong>{g.code}:</strong> {g.message}</AlertDescription></Alert>
      ))}

      {/* HUD Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {hudCards.map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.key}><CardContent className="p-4 text-center">
              <Icon className={`h-6 w-6 mx-auto mb-2 ${card.color}`} />
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <Progress value={card.value} className="mt-2 h-1.5" />
            </CardContent></Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="overview" className="text-xs">Riscos</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs">Análise</TabsTrigger>
          <TabsTrigger value="heatmap" className="text-xs">Calor</TabsTrigger>
          <TabsTrigger value="findings" className="text-xs">Achados</TabsTrigger>
          <TabsTrigger value="safety" className="text-xs">Segurança</TabsTrigger>
          <TabsTrigger value="gps" className="text-xs">GPS</TabsTrigger>
          <TabsTrigger value="protocol" className="text-xs" disabled={!aiReport}>Protocolo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <RiskGauges lumbarRisk={risks.lumbar_risk} cervicalRisk={risks.cervical_risk} baseRisk={risks.base_risk} overallScore={risks.overall_score} />
        </TabsContent>

        <TabsContent value="analysis">
          <AnalyticCanvas imageUrl={photoUrl} keypoints={keypoints} />
          {realKeypoints.length > 0 && <Badge className="mt-2 bg-green-100 text-green-800">Keypoints reais do MediaPipe</Badge>}
        </TabsContent>

        <TabsContent value="heatmap">
          <HeatmapOverlay imageUrl={photoUrl} tensionZones={tensionZones} />
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Achados ({findingsForDisplay.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {findingsForDisplay.map(f => (
                  <div key={f.key} className="p-3 rounded-lg border space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getSeverityColor(f.severity)}>S{f.severity}</Badge>
                        <span className="text-sm font-medium">{f.key.replace(/_/g, ' ')}</span>
                        <Badge variant="outline" className="text-xs">{f.direction}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{Math.round(f.confidence * 100)}%</span>
                    </div>
                    {f.clinical_note && <p className="text-xs text-muted-foreground pl-12">{f.clinical_note}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {localDiagnostics && localDiagnostics.diagnoses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Motor Diagnóstico Local ({localDiagnostics.diagnoses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {localDiagnostics.diagnoses.map((d: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.diagnosis}</span>
                      <Badge variant="outline">{d.confidence}% conf.</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Linhas: {d.affectedLines.join(', ')}</p>
                    <p className="text-xs text-muted-foreground">Protocolo: {d.protocolRef}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SAFETY TAB — Fail-Safes + Neuro-Metabolic */}
        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Fail-Safes Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {failSafes && failSafes.alerts.length > 0 ? (
                <div className="space-y-3">
                  {failSafes.alerts.map((a, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={a.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{a.type}</Badge>
                      </div>
                      <p className="text-sm">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">→ {a.action}</p>
                    </div>
                  ))}
                  {failSafes.forced_mode && (
                    <div className="p-3 rounded-lg border border-red-400 bg-red-100">
                      <p className="text-sm font-bold text-red-800">⚠️ MODO FORÇADO: {failSafes.forced_mode}</p>
                    </div>
                  )}
                  {failSafes.blocked_exercises.length > 0 && (
                    <div className="p-3 rounded-lg border bg-muted/50">
                      <p className="text-sm font-medium mb-2">Exercícios Bloqueados:</p>
                      {failSafes.blocked_exercises.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">🚫 {e}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Execute a análise para verificar fail-safes (L1-S1, ADM Joelho, Stop Signs).</p>
              )}
            </CardContent>
          </Card>

          {nmAlerts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Alertas Neuro-Metabólicos ({nmAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nmAlerts.map((a, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'}`}>
                    <p className="text-sm font-medium">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">💊 {a.recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {traumaContext && traumaContext.findings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bone className="h-4 w-4" /> Histórico de Trauma ({traumaContext.findings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {traumaContext.findings.map((f, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${f.priority === 'critico' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={f.priority === 'critico' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{f.code}</Badge>
                      <span className="text-sm font-medium">{f.label}</span>
                      {f.zone && <Badge variant="outline" className="text-xs">{f.zone}{f.side ? ` (${f.side})` : ''}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{f.clinical_note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GPS Postural Tab */}
        <TabsContent value="gps" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> GPS Postural</CardTitle>
            </CardHeader>
            <CardContent>
              {gpsMapping && Object.keys(gpsMapping).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(gpsMapping).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Badge className={val.detected ? getSeverityColor(val.severity || 1) : 'bg-green-100 text-green-800'}>
                          {val.detected ? '⚠️' : '✅'}
                        </Badge>
                        <span className="text-sm font-medium">{key.replace(/_/g, ' ')}</span>
                      </div>
                      {val.direction && <Badge variant="outline" className="text-xs">{val.direction}</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Execute a análise com Gemini para gerar o mapeamento GPS postural.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protocol" className="space-y-4">
          {aiReport && (
            <>
              <Card><CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Modo Operacional</h3>
                    <p className="text-sm text-muted-foreground mt-1">{aiReport.operational_justification}</p>
                    {failSafes?.forced_mode && (
                      <p className="text-xs text-destructive mt-1 font-medium">⚠️ Override por Fail-Safe: modo forçado para {failSafes.forced_mode}</p>
                    )}
                  </div>
                  <Badge className={`text-lg px-4 py-2 ${getModeColor(failSafes?.forced_mode || aiReport.operational_mode)}`}>
                    {failSafes?.forced_mode || aiReport.operational_mode}
                  </Badge>
                </div>
              </CardContent></Card>

              {aiReport.intervention_blocks && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Blocos de Intervenção (Dossiê v3.2)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <h4 className="font-medium text-blue-800 text-sm mb-1">Bloco A — Interface Solo</h4>
                      <ul className="space-y-1">{aiReport.intervention_blocks.block_a.map((item, i) => <li key={i} className="text-xs text-blue-700">• {item}</li>)}</ul>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                      <h4 className="font-medium text-purple-800 text-sm mb-1">Bloco B — Quadril</h4>
                      <ul className="space-y-1">{aiReport.intervention_blocks.block_b.map((item, i) => <li key={i} className="text-xs text-purple-700">• {item}</li>)}</ul>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <h4 className="font-medium text-green-800 text-sm mb-1">Bloco C — Progressão de Carga</h4>
                      <ul className="space-y-1">{aiReport.intervention_blocks.block_c.map((item, i) => <li key={i} className="text-xs text-green-700">• {item}</li>)}</ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Protocolo de Recuperação - 3 Fases</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <h4 className="font-medium text-red-800 mb-2">Fase 1: Liberação</h4>
                    <ul className="space-y-1">{aiReport.recovery_protocol.phase_1_release.map((item, i) => <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-red-600 shrink-0" />{item}</li>)}</ul>
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 mb-2">Fase 2: Ativação</h4>
                    <ul className="space-y-1">{aiReport.recovery_protocol.phase_2_activation.map((item, i) => <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-yellow-600 shrink-0" />{item}</li>)}</ul>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2">Fase 3: Integração</h4>
                    <ul className="space-y-1">{aiReport.recovery_protocol.phase_3_integration.map((item, i) => <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" />{item}</li>)}</ul>
                  </div>
                </CardContent>
              </Card>

              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Resumo Clínico</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{aiReport.clinical_summary}</p></CardContent>
              </Card>

              {prescriptionRows.length > 0 && (
                <Card className="border-indigo-200">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">📐 Prescrição Cirúrgica de Movimento (Matriz 9FIT)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {prescriptionRows.map(row => (
                      <div key={row.id} className="p-3 rounded-lg border border-indigo-200 bg-indigo-50">
                        <p className="text-sm font-semibold text-indigo-900">{row.disfuncao}</p>
                        <p className="text-xs text-indigo-700 mt-1"><strong>Risco:</strong> {row.risco_biomecanico}</p>
                        <p className="text-xs text-indigo-700 mt-1"><strong>Vetor de Correção:</strong> {row.vetor_correcao}</p>
                        <ul className="mt-2 space-y-1">
                          {row.prescricao_cirurgica.map((ex, i) => (
                            <li key={i} className="text-xs text-indigo-800 flex gap-1"><span>•</span>{ex}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
          {isAnalyzing ? 'Analisando...' : aiReport ? 'Reanalisar' : 'Analisar com Gemini'}
        </Button>
        {aiReport && status !== 'pronto' && (
          <Button variant="outline" onClick={handleSaveReport} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? 'Salvando...' : 'Salvar Relatório'}
          </Button>
        )}
        {aiReport && status === 'pronto' && active.studentId && (
          <PublishToStudent
            studentId={active.studentId}
            studentName={active.studentName || 'Aluno'}
            analysisRunId={active.analysisRunId || undefined}
            aiReport={aiReport}
            failSafes={failSafes}
            nmAlerts={nmAlerts}
          />
        )}
        {(aiReport && status === 'pronto') && (
          <Button onClick={() => onNavigate?.('plan-builder')}>
            <ArrowRight className="h-4 w-4 mr-2" /> Ir para Plano
          </Button>
        )}
      </div>

      {status === 'baixa_confianca' && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>LOW_CONFIDENCE: Confiança abaixo do limite.</AlertDescription></Alert>
      )}
    </div>
  );
};

export default ResultsHUD;
