import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { NINEFIT_CLINICAL_SYSTEM_PROMPT, NINEFIT_PATTERN_KEYS } from "../_shared/clinical-knowledge.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const quotaBlock = await enforceAiQuota(req, 'analyze-complaint', corsHeaders);
  if (quotaBlock) return quotaBlock;
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');
    const { complaintText, studentContext } = await req.json();
    if (!complaintText || typeof complaintText !== 'string') {
      return new Response(JSON.stringify({ error: 'complaintText required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userPrompt = `QUEIXA DO ALUNO:
"""${complaintText}"""

CONTEXTO: ${JSON.stringify(studentContext || {}, null, 2)}

Extraia: região anatômica, padrão (mecânico/neural/inflamatório/misto), red flags, mapeie para um dos 5 Padrões 9FIT (ou NONE), e gere interpretação clínica concisa.`;

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
            name: 'analyze_complaint',
            description: 'Analisa queixa textual mapeando para taxonomia 9FIT',
            parameters: {
              type: 'object',
              properties: {
                extracted_region: { type: 'string' },
                pattern_type: { type: 'string', enum: ['mecanico', 'neural', 'inflamatorio', 'misto', 'inconclusivo'] },
                pattern_match: { type: 'string', enum: [...NINEFIT_PATTERN_KEYS] },
                red_flags: { type: 'array', items: { type: 'string' } },
                ai_interpretation: { type: 'string' },
                recommended_next_step: { type: 'string' },
              },
              required: ['extracted_region', 'pattern_type', 'pattern_match', 'red_flags', 'ai_interpretation', 'recommended_next_step'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_complaint' } },
        temperature: 0.2,
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
    return new Response(JSON.stringify({ status: 'success', analysis: JSON.parse(args) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('analyze-complaint error', e);
    return new Response(JSON.stringify({ status: 'error', error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
