import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const quotaBlock = await enforceAiQuota(req, 'analyze-body-composition', corsHeaders);
  if (quotaBlock) return quotaBlock;
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');
    const { frontPhotoBase64, sidePhotoBase64, heightCm, weightKg, age, sex } = await req.json();

    if (!frontPhotoBase64 || !sidePhotoBase64) {
      return new Response(JSON.stringify({ error: 'Duas fotos são obrigatórias' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `Você é um analista de composição corporal por imagem. Use heurísticas visuais antropométricas (relação cintura/quadril, definição muscular visível, distribuição adiposa) para ESTIMAR percentual de gordura corporal e massa magra. Sempre retorne baixa confiança (max 0.7) e nota explícita de que é estimativa visual, não substitui DEXA/bioimpedância. NUNCA dê diagnóstico clínico.`;

    const userMsg = `Altura: ${heightCm}cm | Peso: ${weightKg}kg | Idade: ${age || 'N/I'} | Sexo: ${sex || 'N/I'}
Estime % gordura corporal e massa magra a partir das fotos frente e lateral.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: userMsg },
            { type: 'image_url', image_url: { url: frontPhotoBase64 } },
            { type: 'image_url', image_url: { url: sidePhotoBase64 } },
          ] },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'estimate_body_composition',
            parameters: {
              type: 'object',
              properties: {
                estimated_body_fat_pct: { type: 'number' },
                estimated_lean_mass_kg: { type: 'number' },
                somatotype: { type: 'string', enum: ['ectomorfo', 'mesomorfo', 'endomorfo', 'misto'] },
                visible_definition_score: { type: 'number', description: '0-10' },
                fat_distribution: { type: 'string' },
                confidence: { type: 'number' },
                notes: { type: 'string' },
              },
              required: ['estimated_body_fat_pct', 'estimated_lean_mass_kg', 'somatotype', 'visible_definition_score', 'fat_distribution', 'confidence', 'notes'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'estimate_body_composition' } },
        temperature: 0.4,
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
    return new Response(JSON.stringify({ status: 'success', composition: JSON.parse(args) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('analyze-body-composition error', e);
    return new Response(JSON.stringify({ status: 'error', error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
