// ============================================
// GERADOR AUTOMATICO DE ENTREGA PARA O ALUNO (item 1 + 2)
// Converte o AIReport (Gemini) + diagnostico local + fail-safes
// em: report_html, recommendations[] e stretching_plan[] estruturado.
// Nada aqui e digitado a mao pelo professor - tudo deriva do aiReport.
// ============================================

import { translateFlagsForStudent, StudentFlagTranslation } from './flagTranslator';
import { Prescription, prescriptionToPlan, prescriptionToRecommendations, prescriptionSummary } from '@/services/prescriptionService';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

export interface StretchingPlanItem {
  order: number;
  name: string;
  sets: number;
  reps_or_time: string; // ex: '30s' ou '10 reps'
  video_url: string | null;
  notes: string;
  category: 'liberacao' | 'alongamento' | 'ativacao' | 'fortalecimento' | 'integracao';
}

export interface StudentRecommendation {
  category: string;
  text: string;
  is_alert: boolean;
}

export interface StudentDeliverable {
  report_html: string;
  recommendations: StudentRecommendation[];
  stretching_plan: StretchingPlanItem[];
}

interface AIReportLike {
  macro_diagnosis: string;
  postural_archetype: string;
  confidence_score: number;
  operational_mode: string;
  clinical_summary: string;
  recovery_protocol: {
    phase_1_release: string[];
    phase_2_activation: string[];
    phase_3_integration: string[];
  };
  findings_analysis: Array<{ key: string; severity: number; clinical_note?: string }>;
}

interface FailSafeLike {
  alerts?: Array<{ type: string; message: string; action: string; severity: string }>;
  forced_mode?: string | null;
  blocked_exercises?: string[];
}

interface NmAlertLike {
  type: string;
  message: string;
  recommendation: string;
  severity: string;
}

/** Extrai um item de treino estruturado a partir de uma frase livre do protocolo IA. */
function parseProtocolLine(line: string, order: number, category: StretchingPlanItem['category']): StretchingPlanItem {
  // tenta achar tempo (ex: 30s, 30 segundos) ou reps (ex: 10x, 10 repeticoes)
  const timeMatch = line.match(/(\d+)\s*(s|seg|segundos)/i);
  const repsMatch = line.match(/(\d+)\s*(x|reps|repeti[cç][oõ]es)/i);
  const setsMatch = line.match(/(\d+)\s*(s[ée]ries|sets)/i);

  const reps_or_time = timeMatch ? `${timeMatch[1]}s` : repsMatch ? `${repsMatch[1]} reps` : '30s';
  const sets = setsMatch ? Number(setsMatch[1]) : 3;

  const paren = line.match(/\((.*?)\)/);
  const cleanName = line.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

  return {
    order,
    name: cleanName,
    sets,
    reps_or_time,
    video_url: null,
    notes: paren ? paren[1] : '',
    category,
  };
}

/** Monta o plano estruturado de alongamento/ativação a partir do recovery_protocol da IA. */
function buildStretchingPlan(protocol: AIReportLike['recovery_protocol']): StretchingPlanItem[] {
  let order = 1;
  const plan: StretchingPlanItem[] = [];

  protocol.phase_1_release.forEach(line => plan.push(parseProtocolLine(line, order++, 'liberacao')));
  protocol.phase_2_activation.forEach(line => plan.push(parseProtocolLine(line, order++, 'ativacao')));
  protocol.phase_3_integration.forEach(line => plan.push(parseProtocolLine(line, order++, 'integracao')));

  return plan;
}

/** Monta a lista de recomendações em linguagem simples, cruzando findings + fail-safes + NM alerts. */
function buildRecommendations(
  findings: AIReportLike['findings_analysis'],
  failSafes?: FailSafeLike | null,
  nmAlerts?: NmAlertLike[]
): StudentRecommendation[] {
  const recs: StudentRecommendation[] = [];

  // Traduz as flags dos achados (usa apenas as chaves, sem código clínico bruto)
  const codes = findings.map(f => f.key).filter(Boolean);
  const translated: StudentFlagTranslation[] = translateFlagsForStudent(codes);
  translated.forEach(t => {
    recs.push({ category: 'postura', text: t.simple_reason, is_alert: t.is_alert });
  });

  // Fail-safes viram recomendações de segurança
  failSafes?.alerts?.forEach(a => {
    recs.push({ category: 'seguranca', text: `${a.message} ${a.action}`.trim(), is_alert: a.severity === 'critical' });
  });

  // Alertas neuro-metabólicos
  nmAlerts?.forEach(a => {
    recs.push({ category: 'saude_geral', text: `${a.message} ${a.recommendation}`.trim(), is_alert: a.severity === 'critical' });
  });

  return recs;
}

/** Gera o HTML do relatório do aluno (linguagem simples, sem jargão, sem código de flag). */
function buildReportHtml(
  studentName: string,
  aiReport: AIReportLike,
  translatedFlags: StudentFlagTranslation[],
  prescription?: Prescription | null
): string {
  const alertFlags = translatedFlags.filter(f => f.is_alert);
  const normalFlags = translatedFlags.filter(f => !f.is_alert);

  const alertBlock = alertFlags.length
    ? `<div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
         <strong style="color:#c2410c;">⚠️ Pontos de atenção</strong>
         <ul style="margin:8px 0 0;padding-left:20px;">
           ${alertFlags.map(f => `<li><strong>${esc(f.simple_name)}:</strong> ${esc(f.simple_reason)}</li>`).join('')}
         </ul>
       </div>`
    : '';

  const findingsBlock = normalFlags.length
    ? `<ul style="padding-left:20px;">
         ${normalFlags.map(f => `<li><strong>${esc(f.simple_name)}:</strong> ${esc(f.simple_reason)}</li>`).join('')}
       </ul>`
    : '<p>Nenhum ponto crítico identificado nesta avaliação.</p>';

  const sum = prescription && !prescription.suspendAll ? prescriptionSummary(prescription) : null;
  const list = (arr: string[]) => arr.map(x => `<li>${esc(x)}</li>`).join('');
  const workBlock = sum && (sum.liberar.length || sum.alongar.length || sum.fortalecer.length)
    ? `<h3 style="color:#111827;margin-top:20px;">O que vamos trabalhar</h3>
       ${[...sum.liberar, ...sum.alongar].length ? `<p style="color:#374151;margin-bottom:4px;"><strong>Soltar e alongar:</strong></p><ul style="padding-left:20px;">${list(Array.from(new Set([...sum.liberar, ...sum.alongar])))}</ul>` : ''}
       ${sum.fortalecer.length ? `<p style="color:#374151;margin-bottom:4px;"><strong>Fortalecer:</strong></p><ul style="padding-left:20px;">${list(sum.fortalecer)}</ul>` : ''}`
    : '';

  return `
<h2 style="color:#111827;">Olá, ${esc(studentName)}! 👋</h2>
<p style="color:#374151;">Aqui está o resumo da sua avaliação postural.</p>

${alertBlock}

<h3 style="color:#111827;margin-top:20px;">O que encontramos</h3>
${findingsBlock}

${workBlock}

<h3 style="color:#111827;margin-top:20px;">Resumo</h3>
<p style="color:#374151;">${esc(aiReport.clinical_summary)}</p>

<p style="color:#6b7280;font-size:13px;margin-top:24px;">Confira seu plano de alongamento na aba "Meu Plano".</p>
`.trim();
}

/**
 * Função principal: gera todo o pacote de entrega ao aluno a partir do AIReport.
 * Deve ser chamada automaticamente ao publicar (PublishToStudent), sem digitação manual.
 */
export function generateStudentDeliverable(params: {
  studentName: string;
  aiReport: AIReportLike;
  failSafes?: FailSafeLike | null;
  nmAlerts?: NmAlertLike[];
  prescription?: Prescription | null;
}): StudentDeliverable {
  const { studentName, aiReport, failSafes, nmAlerts, prescription } = params;

  const codes = aiReport.findings_analysis.map(f => f.key).filter(Boolean);
  const translatedFlags = translateFlagsForStudent(codes);

  const recommendations = [
    ...(prescription ? prescriptionToRecommendations(prescription) : []),
    ...buildRecommendations(aiReport.findings_analysis, failSafes, nmAlerts),
  ];

  // Plano: prescricao deterministica primeiro; itens da IA so complementam,
  // sem duplicar e SEM violar os exercicios bloqueados pelos fail-safes.
  let plan: StretchingPlanItem[] = prescription ? prescriptionToPlan(prescription) : [];
  const blocked = (failSafes?.blocked_exercises || []).map(norm).filter(b => b.length > 3);
  const suspended = !!prescription?.suspendAll;
  if (!suspended && !prescription?.shield) {
    const seen = new Set(plan.map(i => norm(i.name)));
    let order = plan.length + 1;
    buildStretchingPlan(aiReport.recovery_protocol).forEach(item => {
      const n = norm(item.name);
      if (seen.has(n) || blocked.some(b => n.includes(b) || b.includes(n))) return;
      if (plan.length >= 16) return;
      seen.add(n);
      plan.push({ ...item, order: order++ });
    });
  } else if (!prescription) {
    plan = buildStretchingPlan(aiReport.recovery_protocol).filter(i => !blocked.some(b => norm(i.name).includes(b)));
  }

  return {
    report_html: buildReportHtml(studentName, aiReport, translatedFlags, prescription),
    recommendations,
    stretching_plan: plan.map((it, i) => ({ ...it, order: i + 1 })),
  };
}

export default { generateStudentDeliverable };
