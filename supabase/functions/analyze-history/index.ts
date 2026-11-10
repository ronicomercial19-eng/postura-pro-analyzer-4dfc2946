import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NINEFIT_CLINICAL_SYSTEM_PROMPT } from "../_shared/clinical-knowledge.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const quotaBlock = await enforceAiQuota(req, 'analyze-history', corsHeaders);
  if (quotaBlock) return quotaBlock;
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');
    const { assessments, monitoringLogs, studentName } = await req.json();

    const userPrompt = `EVOLUÇÃO LONGITUDINAL — ${studentName || 'aluno'}

AVALIAÇÕES (${assessments?.length || 0}):
${JSON.stringify(assessments?.slice(0, 20) || [], null, 2)}

CHECK-INS DE MONITORAMENTO (${monitoringLogs?.length || 0}):
${JSON.stringify(monitoringLogs?.slice(0, 30) || [], null, 2)}

Gere narrativa clínica de evolução: tendências de dor, TNS, padrões emergentes/regredindo, alertas de risco, próximo passo recomendado.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: NINEFIT_CLINICAL_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_history',
            parameters: {
              type: 'object',
              properties: {
                trend_summary: { type: 'string' },
                pain_trend: { type: 'string', enum: ['melhora', 'estavel', 'piora'] },
                tns_trend: { type: 'string', enum: ['melhora', 'estavel', 'piora'] },
                emerging_patterns: { type: 'array', items: { type: 'string' } },
                regressing_patterns: { type: 'array', items: { type: 'string' } },
                risk_alerts: { type: 'array', items: { type: 'string' } },
                next_recommended_action: { type: 'string' },
              },
              required: ['trend_summary', 'pain_trend', 'tns_trend', 'emerging_patterns', 'regressing_patterns', 'risk_alerts', 'next_recommended_action'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_history' } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'Créditos insuficientes' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI Gateway ${response.status}`);
    }
    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error('No tool call');
    return new Response(JSON.stringify({ status: 'success', history: JSON.parse(args) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('analyze-history error', e);
    return new Response(JSON.stringify({ status: 'error', error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
