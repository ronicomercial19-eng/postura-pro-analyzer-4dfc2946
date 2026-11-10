import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { NINEFIT_CLINICAL_SYSTEM_PROMPT } from "../_shared/clinical-knowledge.ts";
import { diagnoseFromFlags, fetchProtocol, getFlagDef } from "../_shared/myofascial-engine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FRAMES = 8;

interface AnglePoint {
  frame_index?: number;
  t?: number;
  kneeAngleL?: number | null;
  kneeAngleR?: number | null;
  hipAngleL?: number | null;
  hipAngleR?: number | null;
  trunkAngle?: number | null;
  kneeValgusL?: number | null;
  kneeValgusR?: number | null;
  pelvicTiltDiff?: number | null;
}

const nums = (arr: (number | null | undefined)[]) =>
  arr.filter((v): v is number => typeof v === 'number' && isFinite(v));

/** Extrai evaluationFlags determinísticas a partir da trajetória de ângulos. */
function extractFlags(traj: AnglePoint[], extraFlags: string[] = []): string[] {
  const flags = new Set<string>(extraFlags.filter(Boolean));
  if (!traj?.length) return Array.from(flags);

  const valgusL = nums(traj.map((f) => f.kneeValgusL));
  const valgusR = nums(traj.map((f) => f.kneeValgusR));
  // Valgo dinâmico: joelho desviando medialmente > 3% da largura em algum frame
  const peakValgus = Math.max(
    valgusL.length ? Math.max(...valgusL.map((v) => -v)) : 0, // esquerda: medial = -x
    valgusR.length ? Math.max(...valgusR.map((v) => v)) : 0,  // direita: medial = +x
  );
  if (peakValgus > 3) {
    flags.add('DYN01');
    if (peakValgus > 6) flags.add('DYN02');
  }

  // Compensação lombar / perda de neutralidade: tronco muito inclinado
  const trunk = nums(traj.map((f) => f.trunkAngle));
  if (trunk.length && Math.max(...trunk) > 45) flags.add('DYN03');

  // Trendelenburg / shift pélvico: desnível pélvico sustentado
  const pelvis = nums(traj.map((f) => f.pelvicTiltDiff));
  if (pelvis.length && Math.max(...pelvis) > 4) flags.add('DYN04');

  // Assimetria de ROM de joelho entre lados
  const kL = nums(traj.map((f) => f.kneeAngleL));
  const kR = nums(traj.map((f) => f.kneeAngleR));
  if (kL.length && kR.length) {
    const romL = Math.max(...kL) - Math.min(...kL);
    const romR = Math.max(...kR) - Math.min(...kR);
    if (Math.abs(romL - romR) > 15) flags.add('DYN05');
  }

  return Array.from(flags);
}

function romFromTrajectory(traj: AnglePoint[]) {
  const kL = nums(traj.map((f) => f.kneeAngleL));
  const kR = nums(traj.map((f) => f.kneeAngleR));
  const hL = nums(traj.map((f) => f.hipAngleL));
  const hR = nums(traj.map((f) => f.hipAngleR));
  const range = (a: number[]) => (a.length ? { min: Math.min(...a), max: Math.max(...a) } : null);
  return { kneeL: range(kL), kneeR: range(kR), hipL: range(hL), hipR: range(hR) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const quotaBlock = await enforceAiQuota(req, 'analyze-movement', corsHeaders);
  if (quotaBlock) return quotaBlock;
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

    const body = await req.json();
    const exerciseType: string = body.exerciseType || 'agachamento';
    const framesBase64: string[] = Array.isArray(body.frames_base64) ? body.frames_base64 : [];
    const trajectory: AnglePoint[] = Array.isArray(body.angle_trajectory) ? body.angle_trajectory : [];
    const manualFlags: string[] = Array.isArray(body.flags) ? body.flags : [];
    const studentContext = body.studentContext || {};
    const assessmentId: string | null = body.assessmentId || null;

    // Limitar frames enviados à IA (custo/contexto)
    const step = framesBase64.length > MAX_FRAMES ? framesBase64.length / MAX_FRAMES : 1;
    const keyFrames = framesBase64.length > MAX_FRAMES
      ? Array.from({ length: MAX_FRAMES }, (_, i) => framesBase64[Math.floor(i * step)])
      : framesBase64;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // === MOTOR DETERMINÍSTICO (autoridade do diagnóstico) ===
    const flags = extractFlags(trajectory, manualFlags);
    const diagnosis = diagnoseFromFlags(flags);
    const protocol = diagnosis ? await fetchProtocol(admin, diagnosis.protocolRef) : null;
    const romData = romFromTrajectory(trajectory);

    const flagsDescription = flags.length
      ? flags.map((f) => `${f} (${getFlagDef(f)?.name || 'desconhecida'})`).join(', ')
      : 'Nenhuma flag dinâmica detectada';

    const deterministicBlock = diagnosis
      ? `DIAGNÓSTICO DO MOTOR DE REGRAS (AUTORIDADE — NÃO ALTERE):
- Diagnóstico: ${diagnosis.diagnosis}
- Severidade: ${diagnosis.severity}
- Linhas miofasciais afetadas: ${diagnosis.affectedLines.join(', ')}
- Mecanismos: ${diagnosis.mechanisms.join(' | ')}
- Prognóstico: ${diagnosis.prognosis}
- Protocolo: ${diagnosis.protocolRef}${protocol ? ` (fases: ${JSON.stringify(protocol.steps).slice(0, 1200)})` : ''}`
      : 'DIAGNÓSTICO DO MOTOR DE REGRAS: Nenhuma regra de diagnóstico correspondente encontrada.';

    const promptText = `ANÁLISE DE MOVIMENTO
Exercício: ${exerciseType}
Frames-chave anexados: ${keyFrames.length}
Contexto do aluno: ${JSON.stringify(studentContext)}

FLAGS DETECTADAS (MediaPipe, cliente): ${flagsDescription}
ROM medido: ${JSON.stringify(romData)}
Trajetória de ângulos: ${JSON.stringify(trajectory.slice(0, MAX_FRAMES))}

${deterministicBlock}

Sua tarefa: observar os frames anexados e FORMATAR a explicação técnica.
NÃO decida o diagnóstico — ele já foi determinado pelo motor de regras acima.
Descreva as falhas de execução visíveis frame a frame, o ROM efetivo e as correções práticas,
coerentes com o diagnóstico e o protocolo fornecidos.`;

    const content: any[] = [{ type: 'text', text: promptText }];
    for (const f of keyFrames) {
      if (!f) continue;
      const url = f.startsWith('data:') ? f : `data:image/jpeg;base64,${f}`;
      content.push({ type: 'image_url', image_url: { url } });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: NINEFIT_CLINICAL_SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_movement',
            description: 'Descreve falhas de execução observadas nos frames',
            parameters: {
              type: 'object',
              properties: {
                detected_faults: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      fault: { type: 'string' },
                      severity: { type: 'number' },
                      phase: { type: 'string' },
                      correction: { type: 'string' },
                    },
                    required: ['fault', 'severity', 'phase', 'correction'],
                    additionalProperties: false,
                  },
                },
                rom_assessment: { type: 'string' },
                ai_summary: { type: 'string' },
                load_recommendation: { type: 'string', enum: ['LOAD', 'SHIELD', 'MIXED'] },
              },
              required: ['detected_faults', 'rom_assessment', 'ai_summary', 'load_recommendation'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_movement' } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'Créditos insuficientes' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const errText = await response.text();
      console.error('AI Gateway error', response.status, errText);
      throw new Error(`AI Gateway ${response.status}`);
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error('No tool call');
    const aiPart = JSON.parse(args);

    const analysis = {
      ...aiPart,
      // O diagnóstico é do motor determinístico, não da IA
      pattern_match: diagnosis?.diagnosis || 'Nenhuma regra de diagnóstico correspondente encontrada',
      detected_flags: flags,
      severity: diagnosis?.severity ?? null,
      affected_lines: diagnosis?.affectedLines ?? [],
      mechanisms: diagnosis?.mechanisms ?? [],
      prognosis: diagnosis?.prognosis ?? null,
      protocol_key: diagnosis?.protocolRef ?? null,
      protocol,
      rom_data: romData,
    };

    if (assessmentId) {
      const { error: insertError } = await admin.from('ppa_movement_analyses').insert({
        assessment_id: assessmentId,
        exercise_type: exerciseType,
        angle_trajectory: trajectory,
        keypoint_trajectory: trajectory,
        detected_faults: aiPart.detected_faults,
        rom_data: romData,
        ai_summary: aiPart.ai_summary,
        pattern_match: analysis.pattern_match,
        protocol_key: analysis.protocol_key,
      });
      if (insertError) console.error('insert ppa_movement_analyses', insertError.message);
    }

    return new Response(JSON.stringify({ status: 'success', analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('analyze-movement error', e);
    return new Response(JSON.stringify({ status: 'error', error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
