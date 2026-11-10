import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const quotaBlock = await enforceAiQuota(req, 'analyze-report', corsHeaders);
  if (quotaBlock) return quotaBlock;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const { findings, metrics, clusters, clientData, context, pain } = await req.json();
    console.log('Received report analysis request');

    const systemPrompt = `Você é um especialista em biomecânica postural e análise clínica do sistema 9FIT PPA (Postura Pro Analyzer).

FILOSOFIA CENTRAL DO SISTEMA 9FIT:
1. "A Estrutura Governa a Função" — Não se fortalece o que está bloqueado.
2. "Postura como GPS, não Sentença" — Desvios posturais são mapas que indicam onde a força vaza.
3. "Stiffness > Alongamento Passivo" (Fator Cleiton) — Estabilidade articular é mais importante que flexibilidade extrema para quem treina com carga. NUNCA prescrever alongamento passivo pré-treino.

MÉTRICAS HUD:
- IEP (Índice de Estabilidade Podal): 0-100, quão firme a base transfere força
- EA (Espaço Articular): 0-100, nível de descompressão
- PTS (Potência de Transferência Segmentar): 0-100, eficiência cinética
- TNS (Tremor Neuromuscular Sistêmico): 0-100, fadiga do SNC (MENOR é melhor)

MOTOR NEURO-METABÓLICO — DETECTAR:
- Edema → contraindicar carga direta, prescrever drenagem
- Formigamento → RED FLAG, recomendação médica imediata
- Inflamação sistêmica → reduzir volume 40%
- Sensibilidade nervosa → mobilização neural suave apenas

FAIL-SAFES OBRIGATÓRIOS:
- L1-S1 Protegido: Se dor lombar + desvio postural lombar → bloquear flexão lombar sob carga
- ADM Joelho: Se dor joelho + valgo → restringir 15°-90°
- Stop Signs: Dor > 3/10, edema, formigamento → modo SHIELD obrigatório

CASOS CLÍNICOS DE REFERÊNCIA:
- Caso Marília (LCA + Joanete): Valgo é de FUGA, não fraqueza isolada. Ancoragem de pé com Short Foot.
- Caso Maria de Lourdes (78a, retrolistese, osteopenia, edema): Carga axial ZERO. Drenagem + mobilidade mínima.
- Caso Cleiton (fisgada leg press): Calçado instável + alongamento relaxante pré-treino = falha de interface.
- Caso Elisa (bursite + shift pélvico): Descompressão em cadeia fechada ANTES de qualquer carga.
- Swayback ≠ Hiperlordose: Swayback tem RETROVERSÃO + retificação lombar (CG anterior). Hiperlordose tem ANTEVERSÃO.

REGRAS DE INTERVENÇÃO:
- Blocos A/B/C obrigatórios (Interface Solo → Quadril → Progressão de Carga)
- Ordem: Ativação → Estabilidade → Força → Alongamento (controlado, no final)
- NUNCA alongamento passivo pré-treino (Fator Cleiton)

Sua tarefa é analisar os dados e gerar o relatório final integrado.`;

    const userPrompt = `Analise os seguintes dados da avaliação postural e gere o relatório final:

PACIENTE:
${JSON.stringify(clientData || {}, null, 2)}

CONTEXTO:
- Calçado: ${context?.footwear || 'Não informado'}
- Superfície: ${context?.surface || 'Não informada'}
- Objetivo: ${context?.objective || 'Não informado'}
- Ambiente: ${context?.environment || 'Não informado'}

DOR:
- Região: ${pain?.region || 'Nenhuma'}
- Intensidade: ${pain?.intensity || 0}/10
- Gatilhos: ${pain?.triggers || 'Nenhum'}

ACHADOS:
${JSON.stringify(findings || [], null, 2)}

MÉTRICAS:
${JSON.stringify(metrics || [], null, 2)}

CLUSTERS:
${JSON.stringify(clusters || [], null, 2)}

Gere o relatório final completo com:
1. GPS biomecânico com mapeamento de desvios
2. Blocos de intervenção A/B/C (Interface Solo, Quadril, Progressão)
3. Red flags (edema, formigamento, dor aguda, falseio joelho)
4. Aplicar Fator Cleiton: priorizar stiffness sobre alongamento
5. Diferenciar Swayback de Hiperlordose se aplicável
6. Considerar motor neuro-metabólico se sinais presentes`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_postural_report',
            description: 'Gera relatório final de análise postural estruturado com GPS, blocos de intervenção e fail-safes',
            parameters: {
              type: 'object',
              properties: {
                macro_diagnosis: { type: 'string', description: 'Diagnóstico macro consolidado' },
                postural_archetype: { type: 'string', enum: ['Swayback', 'FlatBack', 'KyphoLordotic', 'Normal', 'Mixed'], description: 'Arquétipo postural' },
                confidence_score: { type: 'number', description: 'Score de confiança 0-1' },
                risk_assessment: {
                  type: 'object',
                  properties: {
                    lumbar_risk: { type: 'number' }, cervical_risk: { type: 'number' },
                    base_risk: { type: 'number' }, overall_score: { type: 'number' }
                  },
                  required: ['lumbar_risk', 'cervical_risk', 'base_risk', 'overall_score'],
                  additionalProperties: false
                },
                hud_metrics: {
                  type: 'object',
                  properties: { iep: { type: 'number' }, ea: { type: 'number' }, pts: { type: 'number' }, tns: { type: 'number' } },
                  required: ['iep', 'ea', 'pts', 'tns'],
                  additionalProperties: false
                },
                operational_mode: { type: 'string', enum: ['LOAD', 'SHIELD', 'MIXED'] },
                operational_justification: { type: 'string' },
                biomech_gps: {
                  type: 'object',
                  description: 'Mapeamento GPS biomecânico',
                  properties: {
                    retrope_valgo: { type: 'object', properties: { detected: { type: 'boolean' }, severity: { type: 'number' } }, required: ['detected', 'severity'], additionalProperties: false },
                    pelvic_drift: { type: 'object', properties: { detected: { type: 'boolean' }, severity: { type: 'number' }, direction: { type: 'string' } }, required: ['detected', 'severity'], additionalProperties: false },
                    valgo_dinamico: { type: 'object', properties: { detected: { type: 'boolean' }, severity: { type: 'number' } }, required: ['detected', 'severity'], additionalProperties: false },
                    hiperlordose: { type: 'object', properties: { detected: { type: 'boolean' }, severity: { type: 'number' } }, required: ['detected', 'severity'], additionalProperties: false },
                    hipercifose: { type: 'object', properties: { detected: { type: 'boolean' }, severity: { type: 'number' } }, required: ['detected', 'severity'], additionalProperties: false },
                    stiffness_pe: { type: 'object', properties: { detected: { type: 'boolean' }, severity: { type: 'number' } }, required: ['detected', 'severity'], additionalProperties: false }
                  },
                  required: ['retrope_valgo', 'pelvic_drift', 'valgo_dinamico', 'hiperlordose', 'hipercifose', 'stiffness_pe'],
                  additionalProperties: false
                },
                intervention_blocks: {
                  type: 'object',
                  description: 'Blocos A/B/C: Interface Solo, Quadril, Progressão de Carga',
                  properties: {
                    block_a: { type: 'array', items: { type: 'string' }, description: 'Bloco A - Interface Solo: estabilidade do pé (Short Foot, isometria tornozelo)' },
                    block_b: { type: 'array', items: { type: 'string' }, description: 'Bloco B - Quadril: controle lateral (abdução, hinge unilateral)' },
                    block_c: { type: 'array', items: { type: 'string' }, description: 'Bloco C - Progressão de carga (step-down, agachamento parcial)' }
                  },
                  required: ['block_a', 'block_b', 'block_c'],
                  additionalProperties: false
                },
                red_flags: {
                  type: 'array',
                  description: 'Red flags: falseio joelho, dor aguda, edema, formigamento, sensibilidade nervosa',
                  items: {
                    type: 'object',
                    properties: { type: { type: 'string' }, message: { type: 'string' } },
                    required: ['type', 'message'],
                    additionalProperties: false
                  }
                },
                tension_zones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { name: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, intensity: { type: 'number' }, myofascial_line: { type: 'string' } },
                    required: ['name', 'x', 'y', 'intensity', 'myofascial_line'],
                    additionalProperties: false
                  }
                },
                findings_analysis: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { key: { type: 'string' }, direction: { type: 'string', enum: ['anterior', 'posterior', 'medial', 'lateral'] }, severity: { type: 'number' }, confidence: { type: 'number' }, clinical_note: { type: 'string' } },
                    required: ['key', 'direction', 'severity', 'confidence', 'clinical_note'],
                    additionalProperties: false
                  }
                },
                guardrails: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { code: { type: 'string', enum: ['SHOE_INSTABILITY_CHECK', 'DECOMPRESSION_LOGIC', 'STABILITY_SHIELD', 'NEUROMUSCULAR_WAKEUP', 'PAIN_SPIKE_RISK', 'L1_S1_PROTECTED', 'ADM_KNEE_RESTRICTED'] }, triggered: { type: 'boolean' }, message: { type: 'string' } },
                    required: ['code', 'triggered', 'message'],
                    additionalProperties: false
                  }
                },
                recovery_protocol: {
                  type: 'object',
                  properties: {
                    phase_1_release: { type: 'array', items: { type: 'string' } },
                    phase_2_activation: { type: 'array', items: { type: 'string' } },
                    phase_3_integration: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['phase_1_release', 'phase_2_activation', 'phase_3_integration'],
                  additionalProperties: false
                },
                clinical_summary: { type: 'string' }
              },
              required: [
                'macro_diagnosis', 'postural_archetype', 'confidence_score',
                'risk_assessment', 'hud_metrics', 'operational_mode',
                'operational_justification', 'biomech_gps', 'intervention_blocks',
                'red_flags', 'tension_zones', 'findings_analysis',
                'guardrails', 'recovery_protocol', 'clinical_summary'
              ],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_postural_report' } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit. Tente novamente.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generate_postural_report') throw new Error('Unexpected AI response format');

    const report = JSON.parse(toolCall.function.arguments);
    console.log('Report generated:', report.macro_diagnosis);

    return new Response(JSON.stringify({ status: 'success', report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error) {
    console.error('Error in analyze-report:', error);
    return new Response(
      JSON.stringify({ status: 'error', error: error.message || 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
