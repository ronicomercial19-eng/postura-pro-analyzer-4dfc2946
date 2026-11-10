// Gateway FitPro: autenticação fpk, motor determinístico e entrega isolada por professor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { evaluationFlags, getFlagDef, diagnoseFromFlags, classifyArchetype, fetchProtocol } from '../_shared/myofascial-engine.ts';

// Convenções explícitas: ângulos em graus; scores/valgo/desnível em %.
// Tilt sagital assinado: positivo = anteversão; negativo = retroversão.
export const LIMITS = { frames: 8, imageBytes: 4 * 1024 * 1024, duration: 5, list: 100 };
export const THRESHOLDS = {
  cervicalAngle: 15, cervicalScore: 30, shoulderAngle: 3,
  pelvisAnterior: 15, pelvisPosterior: -5, elbowValgus: 15,
  thoracicKyphosis: 45, lumbarHyperlordosis: 60, lumbarFlat: 20,
  dynamicValgus: 3, femoralRotation: 6, trunk: 45, pelvicDrop: 4, kneeRomAsymmetry: 15,
};
type Obj = Record<string, any>;
type AngleReading = { key: string; label: string; value_deg: number; reference_range?: [number, number]; status: 'ok' | 'atencao' | 'alterado'; source: 'client_mediapipe' | 'ai_estimate' };
type Envelope = Obj & { ok: true; warnings: string[]; angles: AngleReading[]; metrics: Obj; flags: Obj[] };
class ApiError extends Error {
  constructor(public status: number, message: string, public stage: string) { super(message); }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' },
});
const object = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const unique = (a: string[]) => [...new Set(a)];
const db = (result: any, stage: string) => {
  if (result.error) throw new ApiError(502, `Falha de acesso ao banco (${stage})`, stage);
  return result.data;
};
const uuid = z.string().uuid();
const finite = z.number().finite();
const contextSchema = z.object({
  name: z.string().max(255).optional(), age: finite.min(0).max(120).optional(),
  altura_cm: finite.min(30).max(260).optional(), peso_kg: finite.positive().max(500).optional(),
  height: finite.min(30).max(260).optional(), weight: finite.positive().max(500).optional(),
  complaints: z.string().max(4000).optional(), traumaHistory: z.string().max(4000).optional(),
  objetivo: z.string().max(2000).optional(),
}).catchall(z.union([z.string().max(4000), finite, z.boolean(), z.null()]));
const imageSchema = z.string().min(4).max(Math.ceil(LIMITS.imageBytes / 3) * 4 + 64)
  .superRefine((v, ctx) => {
    const match = v.match(/^(?:data:image\/(?:jpeg|png|webp);base64,)?([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[1].length % 4 !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use base64 válido ou data URL JPEG/PNG/WebP (não URL remota)' });
      return;
    }
    const b64 = match[1];
    const bytes = b64.length * 3 / 4 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
    if (bytes > LIMITS.imageBytes) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Imagem excede 4 MB' });
  });
const viewSchema = z.enum(['anterior', 'posterior', 'sagittal_right', 'sagittal_left']);
export const VIEW_MAP = { anterior: 'front', posterior: 'back', sagittal_right: 'rightProfile', sagittal_left: 'leftProfile' } as const;
const angleSchema = z.object({ key: z.string().min(1).max(80), label: z.string().max(120).optional(), value_deg: finite.min(-360).max(360) });
const pointSchema = z.object({ x: finite.min(-2).max(2), y: finite.min(-2).max(2), z: finite.optional(), visibility: finite.min(0).max(1).optional() });
const trajectorySchema = z.object({ frame_index: z.number().int().min(0).max(7), t: finite.min(0).max(5).optional(),
  angles: z.record(finite.nullable()).optional(),
}).catchall(z.union([finite, z.null()]));
const commonShape = {
  student_id: uuid, assessment_id: uuid.optional(), persist: z.boolean().default(true), publish: z.boolean().default(false),
  context: contextSchema.default({}), studentContext: contextSchema.optional(),
};
export const PhotoSchema = z.object({ ...commonShape,
  view: viewSchema.optional(), image_base64: imageSchema.optional(),
  images: z.object({ front: imageSchema.optional(), back: imageSchema.optional(), rightProfile: imageSchema.optional(), leftProfile: imageSchema.optional() }).strict().optional(),
  angles: z.array(angleSchema).max(64).default([]), keypoints: z.array(pointSchema).length(33).optional(),
  image_size: z.object({ width: finite.positive().max(20000), height: finite.positive().max(20000) }).optional(),
}).superRefine((b, ctx) => {
  if (b.image_base64 && !b.view) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['view'], message: 'view obrigatório com image_base64' });
  if (!b.image_base64 && !Object.values(b.images || {}).some(Boolean)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['images'], message: 'Envie images com ao menos uma vista ou view + image_base64' });
  if (b.publish && !b.persist) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['publish'], message: 'publish exige persist=true' });
});
export const VideoSchema = z.object({ ...commonShape,
  exercise_type: z.string().trim().min(1).max(255), evaluation_intent: z.string().max(2000).optional(),
  duration_sec: finite.positive().max(LIMITS.duration), frames_base64: z.array(imageSchema).min(1).max(LIMITS.frames),
  angle_trajectory: z.array(trajectorySchema).max(8).default([]),
  flags: z.array(z.string().refine(v => !!getFlagDef(v), 'Código evaluationFlags desconhecido')).max(64).default([]),
}).superRefine((b, ctx) => {
  if (b.publish && !b.persist) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['publish'], message: 'publish exige persist=true' });
  const indexes = b.angle_trajectory.map(f => f.frame_index);
  if (indexes.some(i => i >= b.frames_base64.length) || unique(indexes.map(String)).length !== indexes.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['angle_trajectory'], message: 'frame_index deve ser único e corresponder a frames_base64' });
});
function parse<T>(schema: z.ZodType<T, any, any>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 'validation');
  return parsed.data;
}
const imageUrl = (v: string) => v.startsWith('data:') ? v : `data:image/jpeg;base64,${v}`;
export function photoPayload(body: Obj) {
  const c = body.context;
  return { images: { ...body.images, ...(body.image_base64 && body.view ? { [VIEW_MAP[body.view as keyof typeof VIEW_MAP]]: imageUrl(body.image_base64) } : {}) },
    clientData: { name: c.name, age: c.age, height: c.altura_cm ?? c.height, weight: c.peso_kg ?? c.weight, complaints: c.complaints, traumaHistory: c.traumaHistory } };
}
export function normalizeTrajectory(frames: Obj[]): Obj[] {
  return frames.map(f => ({ ...object(f.angles), ...Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'angles')) }));
}
export function videoPayload(body: Obj) {
  return { exerciseType: body.exercise_type, frames_base64: body.frames_base64,
    angle_trajectory: normalizeTrajectory(body.angle_trajectory), flags: body.flags,
    studentContext: { ...body.context, ...body.studentContext, evaluation_intent: body.evaluation_intent },
    assessmentId: body.persist ? body.assessment_id || null : null };
}
export async function invokeAI(fn: string, body: unknown, config: { url: string; anonKey: string }, fetcher: typeof fetch = fetch): Promise<Obj> {
  let response: Response;
  try {
    response = await fetcher(`${config.url}/functions/v1/${fn}`, {
      method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', 'x-ppa-internal': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90000),
    });
  } catch { throw new ApiError(502, 'Função interna indisponível ou tempo de análise excedido', fn); }
  // Não tentar ler JSON nem devolver sucesso quando o HTTP interno falha.
  if (!response.ok) { await response.body?.cancel(); throw new ApiError(502, `Função interna retornou HTTP ${response.status}`, fn); }
  let data: Obj;
  try { data = object(await response.json()); } catch { throw new ApiError(502, 'Resposta interna não é JSON válido', fn); }
  if (data.status !== 'success' || data.error || /análise parcial|verifique manualmente/i.test(String(data.macro_diagnosis || '')))
    throw new ApiError(502, 'Análise interna incompleta ou inválida', fn);
  if (fn === 'analyze-posture' && (!data.segments?.cervical || !data.segments?.shoulders || !data.segments?.pelvis))
    throw new ApiError(502, 'Resposta postural sem segmentos obrigatórios', fn);
  if (fn === 'analyze-movement' && (!data.analysis || typeof data.analysis.ai_summary !== 'string' || !Array.isArray(data.analysis.detected_faults)))
    throw new ApiError(502, 'Resposta de movimento sem resultado válido', fn);
  return data;
}
const angleLabels: Record<string, string> = { cervical_vector_angle: 'Projeção cervical', pelvis_tilt: 'Inclinação pélvica sagital', shoulder_asymmetry_deg: 'Assimetria de ombros', thoracic_kyphosis: 'Cifose torácica', lumbar_lordosis: 'Lordose lombar', elbow_valgus: 'Valgo de cotovelo', kneeAngleL: 'Joelho esquerdo', kneeAngleR: 'Joelho direito', hipAngleL: 'Quadril esquerdo', hipAngleR: 'Quadril direito', trunkAngle: 'Inclinação do tronco' };
function reading(key: string, value: number, source: AngleReading['source'], label = angleLabels[key] || key): AngleReading {
  const ranges: Record<string, [number, number]> = { cervical_vector_angle: [-15, 15], pelvis_tilt: [-5, 15], shoulder_asymmetry_deg: [-3, 3], thoracic_kyphosis: [20, 45], lumbar_lordosis: [20, 60], elbow_valgus: [0, 15], trunkAngle: [0, 45] };
  const base = key.split('.')[0];
  const r = ranges[base];
  return { key, label, value_deg: value, ...(r ? { reference_range: r } : {}), status: r && (value < r[0] || value > r[1]) ? 'alterado' : r ? 'ok' : 'atencao', source };
}
function keypointAngles(body: Obj): AngleReading[] {
  const pts = body.keypoints;
  if (!pts) return [];
  const valid = (i: number) => pts[i] && (pts[i].visibility ?? 1) >= 0.65;
  // Corrigir proporção do frame antes de calcular graus a partir de x/y normalizados.
  if (!body.image_size) return [];
  if (body.view === 'anterior' || body.view === 'posterior') {
    if (valid(11) && valid(12)) {
      const dx = Math.abs((pts[12].x - pts[11].x) * body.image_size.width);
      const dy = (pts[12].y - pts[11].y) * body.image_size.height;
      if (dx > 0) return [reading('shoulder_asymmetry_deg', Math.atan2(dy, dx) * 180 / Math.PI, 'client_mediapipe')];
    }
  }
  return [];
}
export function derivePhoto(body: Obj, raw: Obj) {
  const segments = object(raw.segments);
  const angles: AngleReading[] = [];
  const client = new Map<string, AngleReading>();
  for (const a of [...keypointAngles(body), ...body.angles]) client.set(a.key, reading(a.key, a.value_deg, 'client_mediapipe', a.label));
  const add = (key: string, value: unknown) => {
    const supplied = client.get(key);
    if (supplied) { angles.push(supplied); client.delete(key); }
    else if (numeric(value)) angles.push(reading(key, value, 'ai_estimate'));
  };
  add('cervical_vector_angle', segments.cervical?.vector_angle);
  add('pelvis_tilt', segments.pelvis?.tilt);
  add('shoulder_asymmetry_deg', segments.shoulders?.asymmetry_angle);
  for (const k of ['thoracic_kyphosis', 'lumbar_lordosis', 'elbow_valgus']) add(k, undefined);
  angles.push(...client.values());
  const ids = new Set<string>();
  const values = Object.fromEntries(angles.map(a => [a.key, a.value_deg]));
  if (numeric(values.cervical_vector_angle) ? Math.abs(values.cervical_vector_angle) > THRESHOLDS.cervicalAngle : numeric(segments.cervical?.deviation_score) && segments.cervical.deviation_score >= THRESHOLDS.cervicalScore) ids.add('PEP14');
  if (numeric(values.pelvis_tilt)) {
    if (values.pelvis_tilt > THRESHOLDS.pelvisAnterior) ids.add('PEP07');
    if (values.pelvis_tilt < THRESHOLDS.pelvisPosterior) ids.add('PEP08');
  }
  if (numeric(values.shoulder_asymmetry_deg) ? Math.abs(values.shoulder_asymmetry_deg) > THRESHOLDS.shoulderAngle : ['mid', 'high'].includes(segments.shoulders?.drop_level)) ids.add('PEP13');
  if (values.thoracic_kyphosis > THRESHOLDS.thoracicKyphosis) ids.add('PEP11');
  if (values.lumbar_lordosis > THRESHOLDS.lumbarHyperlordosis) ids.add('PEP09');
  if (numeric(values.lumbar_lordosis) && values.lumbar_lordosis < THRESHOLDS.lumbarFlat) ids.add('PEP10');
  if (values.elbow_valgus > THRESHOLDS.elbowValgus) ids.add('PEP16');
  const metrics: Obj = { deviation_scores: {} };
  for (const [k, s] of Object.entries(segments)) if (numeric(object(s).deviation_score)) metrics.deviation_scores[k] = object(s).deviation_score;
  const warnings = [];
  if (body.keypoints && !body.image_size) warnings.push('keypoints_require_image_size');
  if (body.keypoints && body.image_size && !['anterior', 'posterior'].includes(body.view)) warnings.push('keypoints_require_calibrated_angles');
  if (!angles.some(a => a.key === 'shoulder_asymmetry_deg') && ['mid', 'high'].includes(segments.shoulders?.drop_level)) warnings.push('shoulder_asymmetry_qualitative');
  if (angles.some(a => a.key === 'pelvis_tilt' && a.source === 'ai_estimate')) warnings.push('pelvic_tilt_ai_signed_convention');
  return { ids: [...ids], angles, metrics, warnings, trajectory: [] as Obj[] };
}
export function deriveVideo(body: Obj) {
  const trajectory = normalizeTrajectory(body.angle_trajectory);
  const ids = new Set<string>(body.flags);
  const nums = (key: string) => trajectory.map(f => f[key]).filter(numeric);
  const peakValgus = Math.max(0, ...nums('kneeValgusL').map(v => -v), ...nums('kneeValgusR'));
  if (peakValgus > THRESHOLDS.dynamicValgus) ids.add('DYN01');
  if (peakValgus > THRESHOLDS.femoralRotation) ids.add('DYN02');
  if (nums('trunkAngle').some(v => v > THRESHOLDS.trunk)) ids.add('DYN03');
  if (nums('pelvicTiltDiff').some(v => v > THRESHOLDS.pelvicDrop)) ids.add('DYN04');
  const range = (v: number[]) => v.length ? { min: Math.min(...v), max: Math.max(...v) } : null;
  const rom = Object.fromEntries(['kneeAngleL', 'kneeAngleR', 'hipAngleL', 'hipAngleR'].map(k => [k.replace('Angle', ''), range(nums(k))]));
  if (rom.kneeL && rom.kneeR && Math.abs((rom.kneeL.max - rom.kneeL.min) - (rom.kneeR.max - rom.kneeR.min)) > THRESHOLDS.kneeRomAsymmetry) ids.add('DYN05');
  const angles: AngleReading[] = [];
  for (const f of trajectory) for (const k of ['kneeAngleL', 'kneeAngleR', 'hipAngleL', 'hipAngleR', 'trunkAngle'])
    if (numeric(f[k])) angles.push(reading(`${k}.${f.frame_index}`, f[k], 'client_mediapipe', `${angleLabels[k]} · frame ${f.frame_index}`));
  const hasMeasurements = trajectory.some(f => Object.entries(f).some(([k, v]) => !['frame_index', 't'].includes(k) && numeric(v)));
  return { ids: [...ids], angles, metrics: { rom }, warnings: hasMeasurements ? [] : ['no_angle_trajectory'], trajectory };
}
export async function makeEnvelope(kind: 'photo' | 'video', body: Obj, raw: Obj, admin: any, requestId: string): Promise<Envelope> {
  const derived = kind === 'photo' ? derivePhoto(body, raw) : deriveVideo(body);
  const result = kind === 'photo' ? raw : raw.analysis;
  const warnings = [...derived.warnings];
  if (derived.angles.some(a => a.source === 'ai_estimate')) warnings.push('angles_estimated_by_ai');
  const ids = unique(derived.ids);
  const flags = ids.map(code => {
    const def = getFlagDef(code);
    return { code, name: def?.name || code, group: Object.keys(evaluationFlags).find(g => !!evaluationFlags[g][code]) || 'unknown', severity: def?.severity || 0, implies_lines: def?.implies || [], red_flag: def?.redFlag || false };
  });
  const d = diagnoseFromFlags(ids);
  const diagnosis = d ? { pattern_match: d.diagnosis, severity: d.severity, affected_lines: d.affectedLines, mechanisms: d.mechanisms, prognosis: d.prognosis, protocol_key: d.protocolRef } : null;
  const protocol = d ? await fetchProtocol(admin, d.protocolRef) : null;
  if (d && !protocol) warnings.push('protocol_unavailable');
  if (!d) warnings.push('Nenhuma regra de diagnóstico correspondente encontrada');
  let confidence = clamp(numeric(result.confidence) ? result.confidence : derived.angles.length && derived.angles.every(a => a.source === 'client_mediapipe') ? 0.85 : 0.6);
  if (warnings.includes('no_angle_trajectory')) confidence = Math.min(confidence, 0.35);
  if (derived.angles.some(a => a.source === 'ai_estimate')) confidence = Math.min(confidence, 0.6);
  if (confidence < 0.7) warnings.push('low_confidence');
  const shield = flags.some(f => f.red_flag) || (d?.severity || 0) >= 4;
  const mode = shield ? 'SHIELD' : flags.length || confidence < 0.7 ? 'MIXED' : 'LOAD';
  const recommendations: Obj[] = [];
  // Recomendações clínicas vêm do protocolo determinístico; IA não prescreve carga/protocolo.
  if (protocol) recommendations.push({ category: 'protocolo', text: `Aplicar ${protocol.protocol_key}`, protocol_key: protocol.protocol_key, is_alert: shield });
  if (shield) recommendations.push({ category: 'seguranca', text: 'Proteção: suspender progressão de carga e solicitar avaliação profissional.', is_alert: true });
  if (confidence < 0.7) recommendations.push({ category: 'qualidade', text: 'Confirmar as medidas com captura calibrada antes de progredir carga.', is_alert: true });
  for (const k of ['iep', 'ea', 'pts', 'tns']) if (numeric(result[k])) derived.metrics[k] = result[k];
  return { ok: true, request_id: requestId, kind, student_id: body.student_id, assessment_id: body.assessment_id || null, analysis_run_id: null,
    confidence, confidence_source: numeric(result.confidence) ? 'reported' : 'gateway_policy', angles: derived.angles,
    angles_source: derived.angles.length ? derived.angles.some(a => a.source === 'ai_estimate') ? 'ai_estimate' : 'client_mediapipe' : 'unavailable',
    metrics: derived.metrics, flags, diagnosis, archetype: classifyArchetype(ids),
    ...(kind === 'photo' ? { segments: raw.segments, myofascial_lines: raw.myofascial_lines || [] } : { detected_faults: result.detected_faults, ai_summary: result.ai_summary, angle_trajectory: derived.trajectory }),
    operational_mode: mode, recommendations, recovery_protocol: protocol?.steps || null, protocol, warnings: unique(warnings) };
}
const warn = (envelope: Envelope, stage: string) => envelope.warnings.push(`persistence_failed:${stage}`);
function flattenMetrics(metrics: Obj, prefix = ''): { key: string; value: number }[] {
  return Object.entries(metrics).flatMap(([k, v]) => numeric(v) ? [{ key: prefix + k, value: v }] : v && typeof v === 'object' ? flattenMetrics(v, `${prefix}${k}.`) : []);
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
export async function persistEnvelope(admin: any, envelope: Envelope, body: Obj, teacherId: string) {
  if (!body.persist) return;
  if (!envelope.assessment_id) {
    const r = await admin.from('ppa_assessments').insert({ teacher_id: teacherId, student_id: body.student_id, context: body.context, pain: {}, status: 'pronto' }).select('id').single();
    if (r.error || !r.data) { warn(envelope, 'ppa_assessments'); return; }
    envelope.assessment_id = r.data.id;
  }
  const run = await admin.from('ppa_analysis_runs').insert({ assessment_id: envelope.assessment_id, model_version: 'fitpro-deterministic-v1', status: 'pronto', confidence_final: envelope.confidence }).select('id').single();
  if (run.error || !run.data) { warn(envelope, 'ppa_analysis_runs'); return; }
  envelope.analysis_run_id = run.data.id;
  if (envelope.flags.length) {
    const r = await admin.from('ppa_findings').insert(envelope.flags.map(f => ({ analysis_run_id: run.data.id, finding_key: f.code, severity: f.severity, confidence: envelope.confidence, chain: f.implies_lines })));
    if (r.error) warn(envelope, 'ppa_findings');
  }
  const measurements = [...flattenMetrics(envelope.metrics).map(m => ({ ...m, unit: m.key.startsWith('rom.') ? 'deg' : m.key.startsWith('deviation_scores.') ? '%' : null })), ...envelope.angles.map(a => ({ key: a.key, value: a.value_deg, unit: 'deg' }))];
  if (measurements.length) {
    const r = await admin.from('ppa_metrics').insert(measurements.map(m => ({ ...m, analysis_run_id: run.data.id, severity: envelope.diagnosis?.severity || 0, confidence: envelope.confidence })));
    if (r.error) warn(envelope, 'ppa_metrics');
  }
  const decisionRow = { analysis_run_id: run.data.id, macro_state: envelope.operational_mode, micro_states: {}, final_decision: envelope, risk_level: envelope.operational_mode === 'SHIELD' ? 'alto' : envelope.operational_mode === 'MIXED' ? 'moderado' : 'baixo', decided_by: 'fitpro_rule_engine' };
  const decision = await admin.from('ppa_engine_decisions').insert(decisionRow).select('id').single();
  if (decision.error || !decision.data) { warn(envelope, 'ppa_engine_decisions'); return; }
  if (body.publish) {
    // Criar primeiro: uma falha de publicação não elimina a entrega ativa anterior.
    const html = `<h2>${escapeHtml(envelope.diagnosis?.pattern_match || 'Nenhuma regra de diagnóstico correspondente encontrada')}</h2><p>Modo: ${envelope.operational_mode}</p><ul>${envelope.recommendations.map((r: Obj) => `<li>${escapeHtml(r.text || '')}</li>`).join('')}</ul>`;
    const published = await admin.from('ppa_plan_links').insert({ student_id: body.student_id, analysis_run_id: run.data.id, active: true, published_at: new Date().toISOString(), report_html: html, recommendations: envelope.recommendations, stretching_plan: [] }).select('id').single();
    if (published.error || !published.data) warn(envelope, 'ppa_plan_links');
    else {
      // Só desativar planos ligados às avaliações deste professor.
      const prior = await admin.from('ppa_plan_links').select('id, ppa_analysis_runs!inner(ppa_assessments!inner(teacher_id))').eq('student_id', body.student_id).eq('active', true).eq('ppa_analysis_runs.ppa_assessments.teacher_id', teacherId).neq('id', published.data.id);
      if (prior.error) warn(envelope, 'previous_plans_read');
      else if (prior.data?.length) {
        const r = await admin.from('ppa_plan_links').update({ active: false }).in('id', prior.data.map((p: Obj) => p.id));
        if (r.error) warn(envelope, 'previous_plans_deactivation');
      }
      envelope.published_plan_id = published.data.id;
    }
    const updated = await admin.from('ppa_engine_decisions').update({ final_decision: envelope }).eq('id', decision.data.id);
    if (updated.error) warn(envelope, 'final_decision_update');
  }
}
async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function ensureOwnsStudent(admin: any, teacherId: string, studentId: string) {
  const r = await admin.from('students').select('id').eq('teacher_id', teacherId).eq('student_id', studentId).maybeSingle();
  const data = db(r, 'student_link');
  if (!data) throw new ApiError(403, 'Aluno não vinculado ao professor do token', 'authorization');
}
async function ensureAssessment(admin: any, teacherId: string, id: string, studentId?: string) {
  const r = await admin.from('ppa_assessments').select('id, student_id').eq('id', id).eq('teacher_id', teacherId).maybeSingle();
  const data = db(r, 'assessment_ownership');
  if (!data || (studentId && data.student_id !== studentId)) throw new ApiError(403, 'Avaliação não pertence ao professor/aluno informado', 'authorization');
}
function listLimit(url: URL) {
  return parse(z.coerce.number().int().min(1).max(LIMITS.list), url.searchParams.get('limit') ?? 20);
}
async function teacherStudents(admin: any, teacherId: string) {
  // O RPC usa auth.uid(): fpk não cria sessão JWT. Consultar o vínculo com escopo explícito.
  const rows = db(await admin.from('students').select('student_id, created_at, profiles!students_student_id_fkey(full_name,email)').eq('teacher_id', teacherId).limit(1000), 'teacher_students') || [];
  return rows.map((r: Obj) => ({ student_id: r.student_id, created_at: r.created_at, ...object(r.profiles) }));
}
async function analyses(admin: any, teacherId: string, limit: number, studentId?: string, runId?: string) {
  let query = admin.from('ppa_engine_decisions').select('analysis_run_id, created_at, final_decision, ppa_analysis_runs!inner(ppa_assessments!inner(teacher_id,student_id))')
    .eq('ppa_analysis_runs.ppa_assessments.teacher_id', teacherId);
  if (studentId) query = query.eq('ppa_analysis_runs.ppa_assessments.student_id', studentId);
  if (runId) query = query.eq('analysis_run_id', runId);
  // Não misturar decisões legadas/overrides com envelopes FitPro.
  query = query.eq('decided_by', 'fitpro_rule_engine');
  const rows = db(await query.order('created_at', { ascending: false }).limit(limit), 'analyses_read') || [];
  return rows.map((r: Obj) => ({ ...object(r.final_decision), created_at: r.created_at }));
}
export function createHandler(admin: any, config: { url: string; anonKey: string }, fetcher: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
    const requestId = crypto.randomUUID();
    try {
      const header = req.headers.get('Authorization') || '';
      if (!/^Bearer fpk_[a-f0-9]{64}$/.test(header)) throw new ApiError(401, 'Token Bearer fpk inválido ou ausente', 'authentication');
      const token = db(await admin.from('fitpro_integration_tokens').select('id, teacher_id, revoked_at').eq('token_hash', await sha256Hex(header.slice(7))).maybeSingle(), 'token_lookup');
      if (!token || token.revoked_at) throw new ApiError(401, 'Token inválido ou revogado', 'authentication');
      const teacherId = token.teacher_id;
      const usage = await admin.from('fitpro_integration_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', token.id);
      const url = new URL(req.url);
      const path = url.pathname.replace(/^.*\/fitpro-api/, '') || '/';
      if (req.method === 'POST' && ['/analysis/photo', '/analysis/video'].includes(path)) {
        // Limite agregado antes de alocar/decode de dezenas de MB.
        if (Number(req.headers.get('content-length') || 0) > 46 * 1024 * 1024) throw new ApiError(400, 'body excede 46 MB', 'validation');
        let input: unknown;
        try {
          const text = await req.text();
          if (text.length > 46 * 1024 * 1024) throw new ApiError(400, 'body excede 46 MB', 'validation');
          input = JSON.parse(text);
        } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(400, 'body: JSON inválido', 'validation'); }
        const kind = path.endsWith('photo') ? 'photo' : 'video';
        const body: Obj = kind === 'photo' ? parse(PhotoSchema, input) : parse(VideoSchema, input);
        await ensureOwnsStudent(admin, teacherId, body.student_id);
        if (body.assessment_id) await ensureAssessment(admin, teacherId, body.assessment_id, body.student_id);
        const payload: Obj = kind === 'photo' ? photoPayload(body) : videoPayload(body);
        if (kind === 'photo') for (const k of Object.keys(payload.images)) payload.images[k] = imageUrl(payload.images[k]);
        const quotaBlock = await enforceAiQuota(req, `fitpro:${kind}`, {}, teacherId);
        if (quotaBlock) throw new ApiError(quotaBlock.status, (await quotaBlock.json()).error, 'quota');
        const raw = await invokeAI(kind === 'photo' ? 'analyze-posture' : 'analyze-movement', payload, config, fetcher);
        const envelope = await makeEnvelope(kind, body, raw, admin, requestId);
        if (usage.error) envelope.warnings.push('token_usage_update_failed');
        await persistEnvelope(admin, envelope, body, teacherId);
        return json(envelope);
      }
      if (req.method === 'GET' && path === '/teacher/analyses') return json({ ok: true, analyses: await analyses(admin, teacherId, listLimit(url)) });
      if (req.method === 'GET' && path.startsWith('/teacher/analysis/')) {
        const id = parse(uuid, path.slice('/teacher/analysis/'.length));
        // Validação explícita mesmo quando a decisão não existe.
        const run = db(await admin.from('ppa_analysis_runs').select('assessment_id').eq('id', id).maybeSingle(), 'analysis_run_read');
        if (!run) throw new ApiError(422, 'Análise não encontrada', 'delivery');
        await ensureAssessment(admin, teacherId, run.assessment_id);
        const found = await analyses(admin, teacherId, 1, undefined, id);
        if (!found.length) throw new ApiError(422, 'Envelope não disponível para esta análise', 'delivery');
        return json(found[0]);
      }
      const studentRoutes = ['/student/dashboard', '/student/report', '/student/prescriptions', '/student/analysis', '/student/analyses'];
      if (req.method === 'GET' && studentRoutes.includes(path)) {
        const id = parse(uuid, url.searchParams.get('student_id'));
        await ensureOwnsStudent(admin, teacherId, id);
        if (path === '/student/analysis' || path === '/student/analyses') {
          const found = await analyses(admin, teacherId, path === '/student/analysis' ? 1 : listLimit(url), id);
          if (path === '/student/analyses') return json({ ok: true, student_id: id, analyses: found });
          if (!found.length) throw new ApiError(422, 'Nenhuma análise entregue para este aluno', 'delivery');
          return json(found[0]);
        }
        const assessments = db(await admin.from('ppa_assessments').select('*').eq('teacher_id', teacherId).eq('student_id', id).order('created_at', { ascending: false }).limit(5), 'student_assessments') || [];
        if (path === '/student/report') {
          const ids = assessments.map((a: Obj) => a.id);
          const runs = ids.length ? db(await admin.from('ppa_analysis_runs').select('*').in('assessment_id', ids), 'student_runs') : [];
          return json({ assessments, analysis_runs: runs || [] });
        }
        const plans = db(await admin.from('ppa_plan_links').select('*, ppa_analysis_runs!inner(ppa_assessments!inner(teacher_id))').eq('student_id', id).eq('active', true).eq('ppa_analysis_runs.ppa_assessments.teacher_id', teacherId).order('created_at', { ascending: false }).limit(100), 'student_plans') || [];
        if (path === '/student/prescriptions') return json({ prescriptions: plans });
        const logs = db(await admin.from('ppa_monitoring_logs').select('*').eq('student_id', id).order('created_at', { ascending: false }).limit(10), 'student_logs') || [];
        return json({ last_assessment: assessments[0] || null, active_plan: plans[0] || null, recent_logs: logs });
      }
      if (req.method === 'GET' && path === '/teacher/students') return json({ students: await teacherStudents(admin, teacherId) });
      if (req.method === 'GET' && ['/teacher/dashboard', '/teacher/assessments'].includes(path)) {
        const assessments = db(await admin.from('ppa_assessments').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(listLimit(url)), 'teacher_assessments') || [];
        if (path === '/teacher/assessments') return json({ assessments });
        const students = await teacherStudents(admin, teacherId);
        return json({ students, assessments, stats: { students: students.length, assessments: assessments.length, active: assessments.filter((a: Obj) => ['em_coleta', 'analisando'].includes(a.status)).length, pending: assessments.filter((a: Obj) => a.status === 'novo').length } });
      }
      if (req.method === 'POST' && path === '/train/prescriptions/sync') {
        let input: unknown;
        try { input = await req.json(); } catch { throw new ApiError(400, 'body: JSON inválido', 'validation'); }
        const body = parse(z.object({ student_id: uuid }), input);
        await ensureOwnsStudent(admin, teacherId, body.student_id);
        const plans = db(await admin.from('ppa_plan_links').select('*, ppa_analysis_runs!inner(ppa_assessments!inner(teacher_id))').eq('student_id', body.student_id).eq('active', true).eq('ppa_analysis_runs.ppa_assessments.teacher_id', teacherId).limit(100), 'prescriptions_sync') || [];
        const keys = unique(plans.flatMap((p: Obj) => Array.isArray(p.recommendations) ? p.recommendations.map((r: Obj) => r?.protocol_key).filter((v: unknown) => typeof v === 'string') : []));
        const protocols = keys.length ? db(await admin.from('ppa_protocols_library').select('*').in('protocol_key', keys), 'protocols_sync') : [];
        return json({ student_id: body.student_id, protocols: protocols || [], prescriptions: plans, target_module: 'fitpro.train' });
      }
      return json({ ok: false, request_id: requestId, error: 'Endpoint não encontrado', stage: 'routing' }, 404);
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(502, 'Falha inesperada no gateway', 'gateway');
      // Sem imagens, credenciais nem dados clínicos em logs.
      console.error('fitpro-api', requestId, error.stage, error.status);
      return json({ ok: false, request_id: requestId, error: error.message, stage: error.stage }, error.status);
    }
  };
}
if (import.meta.main) {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) {
    Deno.serve(req => req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : json({ ok: false, error: 'Configuração Supabase incompleta', stage: 'configuration' }, 502));
  } else Deno.serve(createHandler(createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), { url, anonKey }));
}

// Regressões mantidas neste arquivo para respeitar o escopo de três arquivos.
if (!import.meta.main) {
  const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
  const image = 'data:image/jpeg;base64,/9j/AA==';
  const student = '11111111-1111-4111-8111-111111111111';
  Deno.test('FitPro foto mapeia quatro vistas e contexto', () => {
    for (const [view, key] of Object.entries(VIEW_MAP)) {
      const p = photoPayload(PhotoSchema.parse({ student_id: student, view, image_base64: image, context: { altura_cm: 170, peso_kg: 72, age: 35 } }));
      assert(p.images[key] === image && p.clientData.height === 170 && p.clientData.weight === 72, view);
    }
    const p = photoPayload(PhotoSchema.parse({ student_id: student, images: { front: image, back: image } }));
    assert(p.images.front === image && p.images.back === image, 'multivista');
  });
  Deno.test('FitPro vídeo aceita 5 segundos e rejeita mais', () => {
    const b = { student_id: student, exercise_type: 'agachamento', duration_sec: 5, frames_base64: [image] };
    assert(VideoSchema.safeParse(b).success, '5s permitido');
    assert(!VideoSchema.safeParse({ ...b, duration_sec: 5.01 }).success, '>5s bloqueado');
  });
  Deno.test('FitPro máximo oito frames', () => {
    const b = { student_id: student, exercise_type: 'agachamento', duration_sec: 5 };
    assert(VideoSchema.safeParse({ ...b, frames_base64: Array(8).fill(image) }).success, '8 permitidos');
    assert(!VideoSchema.safeParse({ ...b, frames_base64: Array(9).fill(image) }).success, '9 bloqueados');
  });
  Deno.test('FitPro rejeita imagem maior que 4MB', () => {
    assert(!PhotoSchema.safeParse({ student_id: student, view: 'anterior', image_base64: 'A'.repeat(Math.ceil((4 * 1024 * 1024 + 3) / 3) * 4) }).success, 'limite 4MB');
  });
  Deno.test('FitPro vídeo mapeia trajetória flags intenção e avaliação', () => {
    const body = VideoSchema.parse({ student_id: student, assessment_id: student, exercise_type: 'agachamento', duration_sec: 5, frames_base64: [image], flags: ['DOR04'], evaluation_intent: 'valgo', angle_trajectory: [{ frame_index: 0, angles: { kneeValgusL: -5, kneeAngleL: 95 } }] });
    const p = videoPayload(body);
    assert(p.assessmentId === student && p.frames_base64[0] === image && p.studentContext.evaluation_intent === 'valgo', 'contrato interno');
    assert(p.angle_trajectory[0].kneeAngleL === 95 && p.flags[0] === 'DOR04' && deriveVideo(body).ids.includes('DYN01'), 'valgo medido');
  });
  Deno.test('FitPro prefere ângulo do cliente sobre IA', () => {
    const b = PhotoSchema.parse({ student_id: student, view: 'anterior', image_base64: image, angles: [{ key: 'cervical_vector_angle', value_deg: 0 }] });
    const d = derivePhoto(b, { segments: { cervical: { vector_angle: 30, deviation_score: 90 } } });
    assert(!d.ids.includes('PEP14') && d.angles[0].source === 'client_mediapipe', 'cliente tem prioridade');
  });
  Deno.test('FitPro persist padrão true e publicação exige persist', () => {
    const b = { student_id: student, view: 'anterior', image_base64: image };
    assert(PhotoSchema.parse(b).persist === true, 'padrão persist');
    assert(!PhotoSchema.safeParse({ ...b, persist: false, publish: true }).success, 'publish exige persist');
  });
  Deno.test('FitPro sem trajetória retorna aviso e baixa confiança', async () => {
    const b = VideoSchema.parse({ student_id: student, exercise_type: 'agachamento', duration_sec: 5, frames_base64: [image] });
    const e = await makeEnvelope('video', b, { analysis: { detected_faults: [], ai_summary: 'Descrição' } }, {}, 'request');
    assert(e.warnings.includes('no_angle_trajectory') && e.confidence <= 0.35 && e.angles_source === 'unavailable', 'trajetória ausente explícita');
  });
  Deno.test('FitPro rejeita HTTP interno não-ok sem parsear JSON', async () => {
    let failed = false;
    try { await invokeAI('analyze-posture', {}, { url: 'https://example.invalid', anonKey: 'anon' }, (async () => new Response('não JSON', { status: 500 })) as typeof fetch); }
    catch (e) { failed = e instanceof ApiError && e.status === 502 && e.stage === 'analyze-posture'; }
    assert(failed, 'HTTP interno =>502');
  });
  Deno.test('FitPro bloqueia fallback falso de sucesso', async () => {
    let failed = false;
    try { await invokeAI('analyze-posture', {}, { url: 'https://example.invalid', anonKey: 'anon' }, (async () => new Response(JSON.stringify({ status: 'success', macro_diagnosis: 'Análise parcial - verifique manualmente' }))) as typeof fetch); }
    catch (e) { failed = e instanceof ApiError && e.status === 502; }
    assert(failed, 'fallback =>502');
  });
  Deno.test('FitPro erro de vínculo não é aluno não vinculado', async () => {
    const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ error: { message: 'DB indisponível' }, data: null }) };
    let status = 0;
    try { await ensureOwnsStudent({ from: () => query }, student, student); } catch (e) { if (e instanceof ApiError) status = e.status; }
    assert(status === 502, 'DB erro =>502 não 403');
  });
}
