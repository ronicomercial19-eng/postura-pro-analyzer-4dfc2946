import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostureAnalysisRequest {
  images: {
    front?: string;
    back?: string;
    rightProfile?: string;
    leftProfile?: string;
  };
  clientData?: {
    name?: string;
    age?: number;
    height?: number;
    weight?: number;
    complaints?: string;
    traumaHistory?: string;
  };
}

interface PostureAnalysisResponse {
  status: 'success' | 'error';
  macro_diagnosis: string;
  postural_archetype: 'Swayback' | 'FlatBack' | 'KyphoLordotic' | 'Normal';
  segments: {
    cervical: { finding: string; deviation_score: number; vector_angle?: number };
    shoulders: { finding: string; asymmetry_side?: 'L' | 'R'; drop_level?: 'low' | 'mid' | 'high' };
    pelvis: { finding: string; tilt?: number };
  };
  myofascial_lines: Array<{ line_name: string; status: 'tight' | 'weak'; impact: string }>;
  recovery_protocol: {
    phase_1_release: string[];
    phase_2_activation: string[];
    phase_3_integration: string[];
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const quotaBlock = await enforceAiQuota(req, 'analyze-posture', corsHeaders);
  if (quotaBlock) return quotaBlock;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { images, clientData } = await req.json() as PostureAnalysisRequest;

    console.log('Received posture analysis request');
    console.log('Client data:', clientData);
    console.log('Images provided:', Object.keys(images).filter(k => images[k as keyof typeof images]));

    // Build the prompt for Gemini
    const systemPrompt = `Você é um especialista em análise postural e biomecânica com profundo conhecimento em:
- Anatomia funcional e cadeias miofasciais
- Padrões posturais (Swayback, FlatBack, KyphoLordotic)
- Avaliação de desvios segmentares (cervical, ombros, pelve)
- Protocolos de correção baseados em linhas miofasciais (SBL, SFL, LL, SPL, DFL)

Analise as imagens posturais fornecidas e retorne APENAS um JSON estruturado seguindo exatamente este schema:
{
  "status": "success",
  "macro_diagnosis": "Descrição geral do padrão postural identificado",
  "postural_archetype": "Swayback | FlatBack | KyphoLordotic | Normal",
  "segments": {
    "cervical": { 
      "finding": "Descrição do achado cervical", 
      "deviation_score": 0-100,
      "vector_angle": número em graus (opcional)
    },
    "shoulders": { 
      "finding": "Descrição do achado nos ombros", 
      "asymmetry_side": "L ou R (lado mais baixo)",
      "drop_level": "low | mid | high"
    },
    "pelvis": { 
      "finding": "Descrição do achado pélvico", 
      "tilt": número em graus
    }
  },
  "myofascial_lines": [
    { "line_name": "Sigla da linha (ex: LSP, LPA, LL)", "status": "tight | weak", "impact": "Impacto funcional" }
  ],
  "recovery_protocol": {
    "phase_1_release": ["Lista de exercícios de liberação miofascial"],
    "phase_2_activation": ["Lista de exercícios de ativação muscular"],
    "phase_3_integration": ["Lista de exercícios de integração funcional"]
  }
}

Seja preciso e específico. Use nomenclatura técnica apropriada.`;

    // Build user message with images
    const userContent: any[] = [];
    
    // Add client context
    if (clientData) {
      userContent.push({
        type: 'text',
        text: `Dados do cliente:
- Nome: ${clientData.name || 'Não informado'}
- Idade: ${clientData.age || 'Não informada'}
- Altura: ${clientData.height ? `${clientData.height}cm` : 'Não informada'}
- Peso: ${clientData.weight ? `${clientData.weight}kg` : 'Não informado'}
- Queixas: ${clientData.complaints || 'Nenhuma'}
- Histórico de trauma: ${clientData.traumaHistory || 'Nenhum'}

Analise as seguintes imagens posturais:`
      });
    } else {
      userContent.push({
        type: 'text',
        text: 'Analise as seguintes imagens posturais:'
      });
    }

    // Add images
    const imageLabels = {
      front: 'Vista Frontal (Anterior)',
      back: 'Vista Posterior',
      rightProfile: 'Perfil Direito',
      leftProfile: 'Perfil Esquerdo'
    };

    for (const [key, label] of Object.entries(imageLabels)) {
      const imageData = images[key as keyof typeof images];
      if (imageData) {
        // Check if it's a data URL or regular URL
        if (imageData.startsWith('data:')) {
          const base64Data = imageData.split(',')[1];
          const mimeType = imageData.split(';')[0].split(':')[1];
          userContent.push({
            type: 'image_url',
            image_url: {
              url: imageData
            }
          });
        } else {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: imageData
            }
          });
        }
        userContent.push({
          type: 'text',
          text: `[${label}]`
        });
      }
    }

    userContent.push({
      type: 'text',
      text: 'Retorne APENAS o JSON estruturado conforme o schema especificado, sem texto adicional.'
    });

    console.log('Calling Lovable AI Gateway...');

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    // Extract the content from the response
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the response
    let analysisResult: PostureAnalysisResponse;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      // Return a fallback analysis
      analysisResult = {
        status: 'success',
        macro_diagnosis: 'Análise parcial - verifique manualmente',
        postural_archetype: 'Normal',
        segments: {
          cervical: { finding: 'Não foi possível analisar automaticamente', deviation_score: 0 },
          shoulders: { finding: 'Não foi possível analisar automaticamente' },
          pelvis: { finding: 'Não foi possível analisar automaticamente' }
        },
        myofascial_lines: [],
        recovery_protocol: {
          phase_1_release: ['Consulte um profissional para avaliação manual'],
          phase_2_activation: [],
          phase_3_integration: []
        }
      };
    }

    console.log('Analysis complete:', analysisResult.macro_diagnosis);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in analyze-posture function:', error);
    
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message || 'Unknown error',
        macro_diagnosis: 'Erro na análise',
        postural_archetype: 'Normal',
        segments: {
          cervical: { finding: 'Erro', deviation_score: 0 },
          shoulders: { finding: 'Erro' },
          pelvis: { finding: 'Erro' }
        },
        myofascial_lines: [],
        recovery_protocol: {
          phase_1_release: [],
          phase_2_activation: [],
          phase_3_integration: []
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
