import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Copy, KeyRound, Trash2, Loader2, BookOpen, Code2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fitpro-api`;

const ENDPOINTS = `POST /analysis/photo
POST /analysis/video
GET  /teacher/analyses?limit=20
GET  /teacher/analysis/{analysis_run_id}
GET  /student/analysis?student_id=<uuid>
GET  /student/analyses?student_id=<uuid>&limit=20

# Compatibilidade
GET  /teacher/dashboard
GET  /teacher/students
GET  /teacher/assessments?limit=20
GET  /student/dashboard?student_id=<uuid>
GET  /student/report?student_id=<uuid>
GET  /student/prescriptions?student_id=<uuid>
POST /train/prescriptions/sync  { "student_id": "<uuid>" }`;
const PHOTO_EXAMPLE = `POST /analysis/photo
{
  "student_id": "<uuid do aluno vinculado>",
  "view": "anterior",
  "image_base64": "data:image/jpeg;base64,<base64 JPEG real>",
  "context": { "name": "Aluno", "age": 35, "altura_cm": 170,
    "peso_kg": 72, "complaints": "Dor cervical", "traumaHistory": "Nenhum" },
  "angles": [
    { "key": "cervical_vector_angle", "value_deg": 20 },
    { "key": "shoulder_asymmetry_deg", "value_deg": 4 }
  ],
  "persist": true, "publish": false
}

# Alternativa multivista (sem view/image_base64):
"images": { "front": "data:image/jpeg;base64,...",
  "back": "data:image/jpeg;base64,...",
  "rightProfile": "data:image/jpeg;base64,...",
  "leftProfile": "data:image/jpeg;base64,..." }
# posterior → back, sagittal_right → rightProfile, sagittal_left → leftProfile`;
const VIDEO_EXAMPLE = `POST /analysis/video
{
  "student_id": "<uuid do aluno vinculado>",
  "assessment_id": "<uuid opcional da avaliação do mesmo professor/aluno>",
  "exercise_type": "agachamento",
  "evaluation_intent": "Valgo dinâmico e amplitude",
  "duration_sec": 5,
  "frames_base64": ["data:image/jpeg;base64,<frame 0>",
    "data:image/jpeg;base64,<frame 1>"],
  "angle_trajectory": [
    { "frame_index": 0, "angles": { "kneeAngleL": 170, "kneeAngleR": 171,
      "hipAngleL": 160, "hipAngleR": 161, "trunkAngle": 12, "kneeValgusL": -1 } },
    { "frame_index": 1, "angles": { "kneeAngleL": 95, "kneeAngleR": 96,
      "hipAngleL": 90, "hipAngleR": 91, "trunkAngle": 30, "kneeValgusL": -5 } }
  ],
  "flags": [], "context": { "altura_cm": 170 },
  "persist": true, "publish": true
}
# Campos angulares também podem ser planos: {frame_index:0, kneeAngleL:170,...}
# Resposta desse exemplo: DYN01, diagnóstico determinístico de valgo,
# metrics.rom.kneeL={min:95,max:170}, operational_mode=MIXED.
# protocol/recovery_protocol dependem da biblioteca; nunca da prescrição da IA.`;
const RESPONSE_EXAMPLE = `// Envelope foto ilustrativo com as duas medidas do request acima:
{
  "ok": true, "request_id": "<uuid>", "kind": "photo",
  "student_id": "<uuid>", "assessment_id": "<uuid>", "analysis_run_id": "<uuid>",
  "confidence": 0.85, "confidence_source": "gateway_policy",
  "angles_source": "client_mediapipe",
  "angles": [
    { "key": "cervical_vector_angle", "label": "Projeção cervical", "value_deg": 20,
      "reference_range": [-15,15], "status": "alterado", "source": "client_mediapipe" },
    { "key": "shoulder_asymmetry_deg", "label": "Assimetria de ombros", "value_deg": 4,
      "reference_range": [-3,3], "status": "alterado", "source": "client_mediapipe" }
  ],
  "metrics": { "deviation_scores": { "cervical": 35 } },
  "flags": [
    { "code": "PEP14", "name": "Projeção Anterior Cabeça", "group": "postural",
      "severity": 3, "implies_lines": ["LSP","LF","LBA"], "red_flag": false },
    { "code": "PEP13", "name": "Elevação de Ombro", "group": "postural",
      "severity": 1, "implies_lines": ["LBA","LE"], "red_flag": false }
  ],
  "diagnosis": null, "archetype": null,
  "segments": { "cervical": {"finding":"Projeção anterior", "deviation_score":35},
    "shoulders": {"finding":"Assimetria"}, "pelvis": {"finding":"Sem medida disponível"} },
  "myofascial_lines": [], "operational_mode": "MIXED",
  "recommendations": [], "recovery_protocol": null, "protocol": null,
  "warnings": ["Nenhuma regra de diagnóstico correspondente encontrada"]
}
// Sem regra correspondente: diagnosis=null; não há diagnóstico inventado.
// Vídeo inclui detected_faults, ai_summary e angle_trajectory no mesmo envelope.`;
const SDK_SOURCE = `export interface AngleReading {
  key: string; label: string; value_deg: number;
  reference_range?: [number, number];
  status: 'ok' | 'atencao' | 'alterado';
  source: 'client_mediapipe' | 'ai_estimate';
}
export interface FlagReading {
  code: string; name: string; group: string; severity: number;
  implies_lines: string[]; red_flag: boolean;
}
export interface Protocol {
  id: string; protocol_key: string; category: string;
  steps: unknown; contraindications: unknown; version: number;
}
export interface AnalysisEnvelope {
  ok: true; request_id: string; kind: 'photo' | 'video';
  student_id: string; assessment_id: string | null; analysis_run_id: string | null;
  confidence: number; confidence_source: 'reported' | 'gateway_policy';
  angles_source: 'client_mediapipe' | 'ai_estimate' | 'unavailable';
  angles: AngleReading[];
  metrics: { deviation_scores?: Record<string, number>;
    rom?: Record<string, {min:number; max:number} | null>;
    iep?: number; ea?: number; pts?: number; tns?: number };
  flags: FlagReading[];
  diagnosis: { pattern_match: string; severity: number; affected_lines: string[];
    mechanisms: string[]; prognosis: string; protocol_key: string } | null;
  archetype: { key: string; name: string; criteria: string; cause: string } | null;
  segments?: Record<string, unknown>; myofascial_lines?: unknown[];
  detected_faults?: {fault:string; severity:number; phase:string; correction:string}[];
  ai_summary?: string; angle_trajectory?: AnglePoint[];
  operational_mode: 'LOAD' | 'SHIELD' | 'MIXED';
  recommendations: {category:string; text:string; protocol_key?:string; is_alert:boolean}[];
  recovery_protocol: unknown | null; protocol: Protocol | null;
  warnings: string[]; published_plan_id?: string; created_at?: string;
}
export interface ClientContext {
  name?: string; age?: number; altura_cm?: number; peso_kg?: number;
  complaints?: string; traumaHistory?: string; objetivo?: string;
}
export interface CommonRequest {
  student_id: string; assessment_id?: string; context?: ClientContext;
  persist?: boolean; publish?: boolean;
}
export interface PhotoAnalysisRequest extends CommonRequest {
  view?: 'anterior' | 'posterior' | 'sagittal_left' | 'sagittal_right';
  image_base64?: string;
  images?: {front?:string; back?:string; rightProfile?:string; leftProfile?:string};
  angles?: {key:string; label?:string; value_deg:number}[];
  keypoints?: {x:number; y:number; z?:number; visibility?:number}[];
  image_size?: {width:number; height:number};
}
export interface AnglePoint {
  frame_index: number; t?: number;
  angles?: Record<string, number | null>;
  kneeAngleL?: number | null; kneeAngleR?: number | null;
  hipAngleL?: number | null; hipAngleR?: number | null;
  trunkAngle?: number | null; kneeValgusL?: number | null;
  kneeValgusR?: number | null; pelvicTiltDiff?: number | null;
}
export interface VideoAnalysisRequest extends CommonRequest {
  exercise_type: string; evaluation_intent?: string; duration_sec: number;
  frames_base64: string[]; angle_trajectory?: AnglePoint[];
  flags?: string[]; studentContext?: ClientContext;
}
export class PosturaProApiError extends Error {
  constructor(public status:number, public stage:string,
    public request_id:string | undefined, message:string) { super(message); }
}
export class PosturaProClient {
  constructor(private cfg: {baseUrl:string; token:string}) {}
  private async req<T>(path:string, init:RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + this.cfg.token);
    headers.set('Content-Type', 'application/json');
    const res = await fetch(this.cfg.baseUrl.replace(/\\/$/, '') + path, {...init, headers});
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false)
      throw new PosturaProApiError(res.status, data?.stage || 'http',
        data?.request_id, data?.error || 'Resposta inválida da API');
    if (!data) throw new PosturaProApiError(502, 'decode', undefined, 'JSON inválido');
    return data as T;
  }
  analyzePhoto(body:PhotoAnalysisRequest) {
    return this.req<AnalysisEnvelope>('/analysis/photo', {method:'POST', body:JSON.stringify(body)});
  }
  analyzeVideo(body:VideoAnalysisRequest) {
    if (body.duration_sec <= 0 || body.duration_sec > 5) throw new Error('duration_sec: 0 < duração <= 5');
    if (body.frames_base64.length < 1 || body.frames_base64.length > 8) throw new Error('frames_base64: 1–8 frames');
    return this.req<AnalysisEnvelope>('/analysis/video', {method:'POST', body:JSON.stringify(body)});
  }
  teacherAnalyses(limit = 20) {
    return this.req<{ok:true; analyses:AnalysisEnvelope[]}>('/teacher/analyses?limit=' + limit);
  }
  teacherAnalysis(id:string) {
    return this.req<AnalysisEnvelope>('/teacher/analysis/' + encodeURIComponent(id));
  }
  studentAnalysis(id:string) {
    return this.req<AnalysisEnvelope>('/student/analysis?student_id=' + encodeURIComponent(id));
  }
  studentAnalyses(id:string, limit = 20) {
    return this.req<{ok:true; student_id:string; analyses:AnalysisEnvelope[]}>(
      '/student/analyses?student_id=' + encodeURIComponent(id) + '&limit=' + limit);
  }
  teacherDashboard() { return this.req('/teacher/dashboard'); }
  listStudents() { return this.req('/teacher/students'); }
  listAssessments(limit = 20) { return this.req('/teacher/assessments?limit=' + limit); }
  studentDashboard(id:string) { return this.req('/student/dashboard?student_id=' + encodeURIComponent(id)); }
  studentReport(id:string) { return this.req('/student/report?student_id=' + encodeURIComponent(id)); }
  studentPrescriptions(id:string) { return this.req('/student/prescriptions?student_id=' + encodeURIComponent(id)); }
  syncPrescriptionsToTrain(student_id:string) {
    return this.req<{student_id:string; protocols:Protocol[]; prescriptions:unknown[]; target_module:string}>(
      '/train/prescriptions/sync', {method:'POST', body:JSON.stringify({student_id})});
  }
}
// No servidor FitPro, ler o token de secrets (não do bundle do navegador):
// const pp = new PosturaProClient({baseUrl:'${FUNCTIONS_BASE}', token:fitproSecret});
// const result = await pp.analyzePhoto({student_id, view:'anterior', image_base64, persist:true});
// if (!result.analysis_run_id || result.warnings.some(w => w.startsWith('persistence_failed:')))
//   throw new Error('Análise concluída, mas entrega não totalmente persistida');
// const entregue = await pp.teacherAnalysis(result.analysis_run_id);
// const treino = await pp.syncPrescriptionsToTrain(student_id);
`;

const FitProApiSettings = () => {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('fitpro_integration_tokens')
        .select('id, name, token_prefix, last_used_at, revoked_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTokens((data as TokenRow[]) || []);
    } catch (err: any) {
      // Tabela pode ainda não existir até a migração rodar
      console.warn('Não foi possível carregar tokens:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return 'fpk_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const sha256 = async (text: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createToken = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const token = generateToken();
      const hash = await sha256(token);
      const prefix = token.slice(0, 12);
      const { error } = await (supabase as any).from('fitpro_integration_tokens').insert({
        teacher_id: user.id,
        name: newName || 'FitPro Integration',
        token_hash: hash,
        token_prefix: prefix,
      });
      if (error) throw error;
      setJustCreated(token);
      setNewName('');
      toast.success('Token criado. Copie agora — não será exibido novamente.');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('fitpro_integration_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Token revogado');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" /> API FitPro · Postura Pro
        </h1>
        <p className="text-muted-foreground text-sm">
          SDK e endpoints para integrar o FitPro ao Postura Pro Analyser.
        </p>
      </div>

      <Tabs defaultValue="tokens" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tokens"><KeyRound className="h-4 w-4 mr-1" /> Tokens</TabsTrigger>
          <TabsTrigger value="docs"><BookOpen className="h-4 w-4 mr-1" /> Documentação</TabsTrigger>
          <TabsTrigger value="sdk"><Code2 className="h-4 w-4 mr-1" /> SDK TypeScript</TabsTrigger>
        </TabsList>

        {/* TOKENS */}
        <TabsContent value="tokens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Criar novo token</CardTitle>
              <CardDescription>Cada token autoriza o FitPro a chamar a API em nome deste professor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Nome do token (ex: FitPro Produção)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button onClick={createToken} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Gerar
                </Button>
              </div>
              {justCreated && (
                <Alert>
                  <AlertDescription className="font-mono text-xs break-all flex items-center justify-between gap-2">
                    <span>{justCreated}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(justCreated)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tokens ativos</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum token criado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {tokens.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded border bg-muted/20">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{t.token_prefix}…</p>
                        <p className="text-[10px] text-muted-foreground">
                          Criado {new Date(t.created_at).toLocaleString('pt-BR')}
                          {t.last_used_at && ` · Último uso ${new Date(t.last_used_at).toLocaleString('pt-BR')}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.revoked_at ? <Badge variant="destructive">Revogado</Badge> : <Badge>Ativo</Badge>}
                        {!t.revoked_at && (
                          <Button size="sm" variant="ghost" onClick={() => revokeToken(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCS */}
        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contrato FitPro → Postura Pro</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <code className="block p-3 rounded bg-muted text-xs font-mono break-all">{FUNCTIONS_BASE}</code>
              <p className="text-sm text-muted-foreground">Authorization: Bearer SEU_TOKEN_FITPRO · Content-Type: application/json. Nunca enviar service_role ao FitPro.</p>
              <pre className="p-3 rounded bg-muted text-xs overflow-auto">{ENDPOINTS}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Foto: requisição e envelope</CardTitle><CardDescription>Exemplo ilustrativo; UUIDs e imagens devem ser substituídos por dados reais.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <pre className="p-3 rounded bg-muted text-xs overflow-auto">{PHOTO_EXAMPLE}</pre>
              <pre className="p-3 rounded bg-muted text-xs overflow-auto">{RESPONSE_EXAMPLE}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Vídeo: frames e trajetória MediaPipe</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <pre className="p-3 rounded bg-muted text-xs overflow-auto">{VIDEO_EXAMPLE}</pre>
              <p className="text-sm text-muted-foreground">De 1 a 8 frames JPEG/PNG/WebP, até 4 MB decodificados por imagem; duração maior que zero e até 5 segundos. frame_index é único e corresponde à posição do frame. Ângulos em graus; kneeValgusL/R e pelvicTiltDiff em % (não graus). Na esquerda, valgo medial é negativo; na direita, positivo. Sem trajetória numérica: angles_source=unavailable, no_angle_trajectory e confidence ≤ 0.35. Não são inventados ângulos nem flags pela IA.</p>
              <p className="text-sm text-muted-foreground">As flags explícitas de vídeo devem ser códigos evaluationFlags válidos. A avaliação deve pertencer ao professor do token e ao aluno informado. evaluation_intent é encaminhado em studentContext.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Medições e regras determinísticas</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>angles do FitPro prevalecem sobre estimativas da IA: cervical_vector_angle, pelvis_tilt, shoulder_asymmetry_deg, thoracic_kyphosis, lumbar_lordosis, elbow_valgus. Outras chaves são preservadas sem gerar diagnóstico. reference_range só aparece onde há referência definida; atencao significa medida sem faixa de referência.</p>
              <p>keypoints são os 33 pontos MediaPipe normalizados (x, y, z?, visibility?). Para medir ângulos a partir deles, enviar image_size (width, height) do mesmo frame. Apenas o desnível frontal de ombros é derivado desses pontos; inclinação sagital pélvica exige angles explícitos. Sem dimensões, retorna keypoints_require_image_size e mantém estimativas disponíveis.</p>
              <p>Limiares foto: projeção cervical &gt; 15° ou score ≥ 30 sem ângulo; pelve &gt; 15° anteversão, &lt; −5° retroversão; ombros &gt; 3° em módulo (ou drop_level mid/high sem ângulo); cifose &gt; 45°, lordose &gt; 60° ou &lt; 20°, cotovelo &gt; 15°. O tilt pélvico da IA usa convenção assinada assumida, sinalizada por pelvic_tilt_ai_signed_convention.</p>
              <p>Flags e diagnóstico vêm do motor de regras; arquétipo da macroclassificação existente. Modo: SHIELD com red_flag ou diagnóstico de severidade ≥ 4; MIXED com flags ou confiança &lt; 0.7; LOAD apenas sem flags e com confiança suficiente. Confiança sem valor explícito é política conservadora do gateway, não validação clínica: até 0.85 com ângulos do cliente e 0.6 com IA.</p>
              <p>Protocolos e recomendações clínicas vêm de ppa_protocols_library. segments, myofascial_lines, detected_faults e ai_summary são descritivos da IA, não autoridade diagnóstica. recovery_protocol contém steps do protocolo determinístico ou null.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Persistência, publicação e histórico</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>persist=true por padrão: reutiliza assessment_id autorizado ou cria avaliação; grava execução, flags, métricas e decisão contendo o envelope. publish=true exige persist=true e publica relatório/recomendações em um plano ativo do aluno, desativando entregas anteriores deste professor. Sem publish, a análise pode ser consultada pela API, mas não cria plano.</p>
              <p>persist=false não cria registros de análise. IDs ausentes permanecem null. Cada falha de gravação aparece como persistence_failed:etapa; ok=true indica análise concluída, não persistência integral. Sempre verifique warnings e analysis_run_id antes de considerar a entrega salva. protocol_unavailable sinaliza protocolo ausente ou falha de consulta.</p>
              <p>Listas retornam {'{ ok: true, analyses: AnalysisEnvelope[] }'}; consultas individuais retornam o envelope. Histórico limitado a análises FitPro salvas com decisão, isoladas por professor/aluno. limit: 1–100, padrão 20. Última análise inexistente retorna 422.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Códigos de erro</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2 pr-4">HTTP</th><th>Significado</th></tr></thead><tbody>
                {[[400, 'Campo inválido, JSON inválido, limites de imagens/frames/duração ou publish sem persist.'], [401, 'Token fpk ausente, inválido ou revogado.'], [403, 'Aluno não vinculado ou avaliação de outro professor/aluno.'], [422, 'Análise ou envelope de entrega ainda não disponível.'], [502, 'Falha interna, erro de banco, HTTP interno não-ok, JSON inválido ou fallback de IA.']].map(([code, detail]) => <tr key={code} className="border-b"><td className="py-2 pr-4 font-mono">{code}</td><td>{detail}</td></tr>)}
              </tbody></table>
              <pre className="p-3 mt-3 rounded bg-muted text-xs overflow-auto">{'{ "ok": false, "request_id": "<uuid>", "error": "view: valor inválido", "stage": "validation" }'}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">curl · análise sem gravar</CardTitle></CardHeader>
            <CardContent><pre className="p-3 rounded bg-muted text-xs overflow-auto">{`# request.json deve conter uma requisição de foto válida com persist:false
curl -X POST '${FUNCTIONS_BASE}/analysis/photo' \
  -H "Authorization: Bearer $FITPRO_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @request.json`}</pre></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sdk" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">SDK TypeScript</CardTitle><CardDescription>Copiar para posturaPro.ts no FitPro. Token privado somente no servidor do FitPro; não embutir no navegador.</CardDescription></CardHeader>
            <CardContent><pre className="p-3 rounded bg-muted text-xs overflow-auto max-h-[700px]">{SDK_SOURCE}</pre></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FitProApiSettings;
