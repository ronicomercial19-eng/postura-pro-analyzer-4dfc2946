// ============================================
// SERVICO DE PRESCRICAO DETERMINISTICA
// achados (com lado) + fail-safes  ->  o que LIBERAR / ALONGAR / FORTALECER
//                                      + plano estruturado para o aluno
//
// Nao depende de IA: funciona com o que a foto mediu + o que o avaliador confirmou.
// A IA (Gemini) so complementa o texto; nunca decide sozinha o que o aluno faz.
// ============================================

import { MUSCLE_MAP, ExerciseKind, MapExercise } from '@/data/muscleMap';
import type { StretchingPlanItem, StudentRecommendation } from '@/utils/studentReportGenerator';

export type Side = 'D' | 'E';
export type FlagSource = 'foto' | 'avaliador' | 'ia' | 'questionario';

export interface DetectedFlag {
  code: string;
  sides: Side[];
  severity: number;
  source: FlagSource;
}

export interface PrescribedExercise {
  kind: ExerciseKind;
  name: string;
  sets: number;
  dose: string; // '30s' | '12 reps'
  perSideHint: boolean; // fazer em cada lado
}

export interface PrescriptionEntry {
  code: string;
  label: string;
  sides: Side[];
  sideText: string; // '' | 'lado direito' | 'lado esquerdo' | 'ambos os lados'
  severity: number;
  source: FlagSource;
  liberar: string[];
  alongar: string[];
  fortalecer: string[];
  exercises: PrescribedExercise[];
  note?: string;
  referOut: boolean;
}

export interface Prescription {
  entries: PrescriptionEntry[];
  suspendAll: boolean; // formigamento etc.: parar tudo e encaminhar
  shield: boolean; // modo protecao: so liberacao/alongamento suave
  removedExercises: string[]; // cortados por fail-safe
}

export interface BuildOptions {
  forcedShield?: boolean;
  suspendAll?: boolean;
  blocked?: string[];
}

const KIND_ORDER: ExerciseKind[] = ['liberacao', 'alongamento', 'ativacao', 'fortalecimento'];

export const sideText = (sides: Side[]): string => {
  const set = new Set(sides);
  if (set.has('D') && set.has('E')) return 'ambos os lados';
  if (set.has('D')) return 'lado direito';
  if (set.has('E')) return 'lado esquerdo';
  return '';
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

function isBlocked(exerciseName: string, blocked: string[]): boolean {
  const n = normalize(exerciseName);
  return blocked.some(b => {
    const nb = normalize(b);
    return nb.length > 3 && (n.includes(nb) || nb.includes(n));
  });
}

const FLAG_CODE_RE = /^[A-Z]{3}\d{2}$/;

/**
 * Le os achados gravados pelo pipeline de foto (ppa_findings) e as metricas
 * `side_<codigo>` (unit = 'D' | 'E' | 'D,E') e devolve as flags com lateralidade.
 */
export function flagsFromFindings(
  findings: { finding_key: string; severity: number }[],
  metrics: { key: string; unit: string | null }[]
): DetectedFlag[] {
  const sideByCode = new Map<string, Side[]>();
  metrics.forEach(m => {
    if (!m.key.startsWith('side_') || !m.unit) return;
    const code = m.key.slice(5);
    const sides = m.unit.split(',').map(s => s.trim()).filter((s): s is Side => s === 'D' || s === 'E');
    if (sides.length) sideByCode.set(code, sides);
  });
  const out: DetectedFlag[] = [];
  findings.forEach(f => {
    if (!FLAG_CODE_RE.test(f.finding_key)) return;
    out.push({ code: f.finding_key, sides: sideByCode.get(f.finding_key) || [], severity: f.severity || 1, source: 'foto' });
  });
  return out;
}

export function buildPrescription(flags: DetectedFlag[], opts: BuildOptions = {}): Prescription {
  const blocked = opts.blocked || [];
  const shield = !!opts.forcedShield;
  const suspendAll = !!opts.suspendAll;
  const removed = new Set<string>();

  // une flags repetidas (mesmo codigo): maior severidade + uniao dos lados
  const merged = new Map<string, DetectedFlag>();
  flags.forEach(f => {
    const prev = merged.get(f.code);
    if (!prev) merged.set(f.code, { ...f, sides: [...f.sides] });
    else {
      prev.severity = Math.max(prev.severity, f.severity);
      f.sides.forEach(s => { if (!prev.sides.includes(s)) prev.sides.push(s); });
      if (f.source === 'foto') prev.source = 'foto';
    }
  });

  const entries: PrescriptionEntry[] = [];
  Array.from(merged.values())
    .filter(f => MUSCLE_MAP[f.code])
    .sort((a, b) => b.severity - a.severity)
    .forEach(f => {
      const map = MUSCLE_MAP[f.code];
      const sides = map.unilateral ? f.sides : [];
      const st = sideText(sides);
      const tag = (m: string) => (st ? `${m} (${st})` : m);

      const exercises: PrescribedExercise[] = [];
      if (!suspendAll && !map.referOut) {
        map.exercises.forEach((e: MapExercise) => {
          if (shield && (e.kind === 'ativacao' || e.kind === 'fortalecimento' || e.loaded)) {
            removed.add(e.name);
            return;
          }
          const name = e.perSide && map.unilateral && sides.length === 1 ? `${e.name} — ${st}` : e.name;
          if (isBlocked(e.name, blocked)) { removed.add(e.name); return; }
          exercises.push({
            kind: e.kind,
            name,
            sets: e.sets,
            dose: e.time ? `${e.time}s` : `${e.reps ?? 10} reps`,
            perSideHint: !!e.perSide && !(map.unilateral && sides.length === 1),
          });
        });
      }

      entries.push({
        code: f.code,
        label: map.label,
        sides,
        sideText: st,
        severity: f.severity,
        source: f.source,
        liberar: map.liberar.map(tag),
        alongar: map.alongar.map(tag),
        fortalecer: shield || suspendAll ? [] : map.fortalecer.map(tag),
        exercises,
        note: map.note,
        referOut: !!map.referOut,
      });
    });

  return { entries, suspendAll, shield, removedExercises: Array.from(removed) };
}

const dedupe = (arr: string[]) => Array.from(new Set(arr));

export function prescriptionSummary(p: Prescription) {
  return {
    liberar: dedupe(p.entries.flatMap(e => e.liberar)),
    alongar: dedupe(p.entries.flatMap(e => e.alongar)),
    fortalecer: dedupe(p.entries.flatMap(e => e.fortalecer)),
  };
}

/** Plano estruturado para o aluno (mesmo formato que o StudentStretchingPlan ja le). */
export function prescriptionToPlan(p: Prescription, maxItems = 20): StretchingPlanItem[] {
  if (p.suspendAll) return [];
  const seen = new Map<string, StretchingPlanItem>();
  const items: StretchingPlanItem[] = [];
  let order = 1;

  p.entries.forEach(entry => {
    KIND_ORDER.forEach(kind => {
      entry.exercises.filter(e => e.kind === kind).forEach(e => {
        const key = normalize(e.name);
        const target = (kind === 'liberacao' ? entry.liberar : kind === 'alongamento' ? entry.alongar : entry.fortalecer).join(', ');
        const why = `${entry.label}${entry.sideText ? ` (${entry.sideText})` : ''}`;
        const existing = seen.get(key);
        if (existing) {
          if (!existing.notes.includes(why)) existing.notes += ` Também para: ${why}.`;
          return;
        }
        if (items.length >= maxItems) return;
        const item: StretchingPlanItem = {
          order: order++,
          name: e.name,
          sets: e.sets,
          reps_or_time: e.dose,
          video_url: null,
          notes: `Para: ${why}.${target ? ` Trabalha: ${target}.` : ''}${e.perSideHint ? ' Faça em cada lado.' : ''}`,
          category: kind,
        };
        seen.set(key, item);
        items.push(item);
      });
    });
  });
  return items;
}

/** Recomendacoes em linguagem simples para o aluno (sem jargao interno, sem notas do avaliador). */
export function prescriptionToRecommendations(p: Prescription): StudentRecommendation[] {
  const recs: StudentRecommendation[] = [];
  if (p.suspendAll) {
    recs.push({ category: 'seguranca', text: 'Pare os exercícios por enquanto e procure avaliação médica antes de retomar.', is_alert: true });
  } else if (p.shield) {
    recs.push({ category: 'seguranca', text: 'Seu plano está em modo de proteção: por ora apenas liberação e alongamentos suaves, sem exercícios de força.', is_alert: true });
  }
  p.entries.forEach(e => {
    const where = e.sideText ? ` (${e.sideText})` : '';
    if (e.referOut) {
      recs.push({ category: 'postura', text: `${e.label}: converse com seu professor e com um médico antes de iniciar exercícios específicos.`, is_alert: true });
      return;
    }
    const parts: string[] = [];
    const alongar = dedupe([...e.liberar, ...e.alongar]);
    if (alongar.length) parts.push(`alongar/soltar ${alongar.join(', ')}`);
    if (e.fortalecer.length) parts.push(`fortalecer ${e.fortalecer.join(', ')}`);
    if (parts.length) recs.push({ category: 'postura', text: `${e.label}${where}: ${parts.join('; ')}.`, is_alert: false });
  });
  return recs;
}

// ------------------------------------------------------------
// Relatorio local (fallback quando a IA nao esta disponivel)
// Mesma forma do AIReport usado pelo ResultsHUD/PublishToStudent.
// Nao inventa numeros: riscos e HUD ficam zerados (nao medidos).
// ------------------------------------------------------------
export interface LocalReport {
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
}

export function buildLocalReport(
  p: Prescription,
  findings: { key: string; direction: string; severity: number; confidence: number }[]
): LocalReport {
  const fmt = (e: PrescribedExercise) => `${e.name} (${e.sets}x ${e.dose})`;
  const all = p.entries.flatMap(e => e.exercises);
  const labels = p.entries.map(e => `${e.label}${e.sideText ? ` (${e.sideText})` : ''}`);
  const macro = labels.length ? labels.join(' + ') : 'Nenhum desvio relevante identificado';
  const summary = labels.length
    ? `Foram identificados: ${labels.join('; ')}. A prescrição abaixo indica o que soltar, alongar e fortalecer para cada achado. Relatório gerado por regras locais, sem análise de IA.`
    : 'Não foram identificados desvios posturais relevantes nas fotos analisadas.';
  const avgConf = findings.length ? findings.reduce((s, f) => s + f.confidence, 0) / findings.length : 0.7;

  return {
    macro_diagnosis: macro,
    postural_archetype: 'Avaliação por regras locais',
    confidence_score: Math.max(0.5, Math.min(0.9, avgConf)),
    risk_assessment: { lumbar_risk: 0, cervical_risk: 0, base_risk: 0, overall_score: 0 },
    hud_metrics: { iep: 0, ea: 0, pts: 0, tns: 0 },
    operational_mode: p.suspendAll || p.shield ? 'SHIELD' : 'LOAD',
    operational_justification: p.suspendAll
      ? 'Sinal de alerta neurológico: treino suspenso até avaliação médica.'
      : p.shield ? 'Modo de proteção ativo por fail-safe.' : 'Sem restrições de carga identificadas pelos fail-safes.',
    tension_zones: [],
    findings_analysis: findings.map(f => ({ ...f, clinical_note: '' })),
    guardrails: [],
    recovery_protocol: {
      phase_1_release: all.filter(e => e.kind === 'liberacao' || e.kind === 'alongamento').map(fmt),
      phase_2_activation: all.filter(e => e.kind === 'ativacao').map(fmt),
      phase_3_integration: all.filter(e => e.kind === 'fortalecimento').map(fmt),
    },
    clinical_summary: summary,
  };
}
