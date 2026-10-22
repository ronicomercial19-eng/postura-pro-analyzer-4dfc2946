import { legacyTable } from '@/integrations/supabase/legacyTables';

export interface PosturalPattern {
  code: string;
  name: string;
  cause: string;
  symptoms: string[];
  severity: number;
  keyExercises: string[];
  duration: string;
  reminders: string[];
}

export interface AnalysisResult {
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  patterns: PosturalPattern[];
  recommendations: string[];
}

/**
 * Calcula análise postural baseada em dados REAIS da avaliação
 */
export async function analyzePosturalData(evaluationId: string): Promise<AnalysisResult> {
  // 1. Buscar dados reais da avaliação
  const { data: evaluation, error } = await legacyTable('evaluations')
    .select('*')
    .eq('id', evaluationId)
    .single();

  if (error || !evaluation) {
    throw new Error('Avaliação não encontrada');
  }

  const patterns: PosturalPattern[] = [];
  let totalScore = 100;

  // 2. Análise de Cifose Torácica (dados reais)
  if (evaluation.thoracic_kyphosis && evaluation.thoracic_kyphosis > 40) {
    const severity = evaluation.thoracic_kyphosis > 50 ? 3 : evaluation.thoracic_kyphosis > 45 ? 2 : 1;
    patterns.push({
      code: 'P01',
      name: 'Hipercifose Torácica',
      cause: 'Curvatura torácica excessiva detectada',
      symptoms: ['Ombros curvados', 'Dor interescapular', 'Respiração superficial'],
      severity,
      keyExercises: [
        'Extensão torácica sobre foam roller (3x10)',
        'Superman hold (3x30s)',
        'Remada alta com escápula (3x12)'
      ],
      duration: '8-12 semanas',
      reminders: ['Corrija postura a cada 1h', 'Evite postura sentada prolongada']
    });
    totalScore -= severity * 5;
  }

  // 3. Análise de Lordose Lombar (dados reais)
  if (evaluation.lumbar_lordosis && evaluation.lumbar_lordosis > 60) {
    const severity = evaluation.lumbar_lordosis > 70 ? 3 : evaluation.lumbar_lordosis > 65 ? 2 : 1;
    patterns.push({
      code: 'P04',
      name: 'Hiperlordose Lombar',
      cause: 'Curvatura lombar excessiva',
      symptoms: ['Dor lombar ao ficar em pé', 'Tensão muscular lombar'],
      severity,
      keyExercises: [
        'Alongamento de iliopsoas (3x30s)',
        'Deadbug (3x15)',
        'Prancha frontal (3x30s)'
      ],
      duration: '8-10 semanas',
      reminders: ['Fortaleça abdômen', 'Evite sapatos de salto alto']
    });
    totalScore -= severity * 5;
  }

  // 4. Análise de Ângulo Craniocervical (dados reais)
  if (evaluation.cranio_cervical_angle && evaluation.cranio_cervical_angle < 45) {
    const severity = evaluation.cranio_cervical_angle < 35 ? 3 : evaluation.cranio_cervical_angle < 40 ? 2 : 1;
    patterns.push({
      code: 'P02',
      name: 'Projeção Anterior da Cabeça',
      cause: 'Ângulo craniocervical abaixo do ideal',
      symptoms: ['Dor na nuca', 'Cefaleia tensional', 'Rigidez cervical'],
      severity,
      keyExercises: [
        'Chin tuck (3x15)',
        'Retração cervical isométrica (4x20s)',
        'Alongamento de trapézio superior (3x30s)'
      ],
      duration: '6-8 semanas',
      reminders: ['Ajuste altura da tela', 'Faça pausas de tela']
    });
    totalScore -= severity * 5;
  }

  // 5. Análise de Desequilíbrio de Ombros (dados reais)
  if (evaluation.shoulder_imbalance && Math.abs(evaluation.shoulder_imbalance) > 5) {
    const severity = Math.abs(evaluation.shoulder_imbalance) > 15 ? 3 : Math.abs(evaluation.shoulder_imbalance) > 10 ? 2 : 1;
    patterns.push({
      code: 'P06',
      name: 'Assimetria de Ombros',
      cause: 'Desnível detectado entre os ombros',
      symptoms: ['Ombro elevado', 'Desconforto unilateral', 'Tensão assimétrica'],
      severity,
      keyExercises: [
        'Alongamento de trapézio (lado elevado) (3x30s)',
        'Fortalecimento escapular (lado baixo) (3x12)',
        'Correção postural ativa'
      ],
      duration: '8-10 semanas',
      reminders: ['Evite carregar peso em um lado', 'Observe simetria ao sentar']
    });
    totalScore -= severity * 4;
  }

  // 6. Análise de Teste de Adams (dados reais)
  if (evaluation.adams_test === 'positive') {
    patterns.push({
      code: 'P13',
      name: 'Escoliose (Adams Positivo)',
      cause: 'Assimetria estrutural detectada',
      symptoms: ['Giba costal', 'Desalinhamento vertebral', 'Assimetria postural'],
      severity: 3,
      keyExercises: [
        'Respiração diferencial',
        'Alongamento específico',
        'Exercícios de Schroth'
      ],
      duration: '12+ semanas',
      reminders: ['Avaliação médica recomendada', 'Monitoramento regular']
    });
    totalScore -= 15;
  }

  // 7. Análise de Padrão de Agachamento (dados reais)
  if (evaluation.squat_pattern === 'compensated') {
    patterns.push({
      code: 'P15',
      name: 'Valgo Dinâmico',
      cause: 'Padrão compensatório durante movimento',
      symptoms: ['Joelhos colapsam para dentro', 'Instabilidade', 'Risco de lesão'],
      severity: 2,
      keyExercises: [
        'Agachamento com feedback visual (3x10)',
        'Fortalecimento de glúteo médio (3x15)',
        'Step-up lateral (3x10)'
      ],
      duration: '10-12 semanas',
      reminders: ['Monitore padrão de movimento', 'Fortaleça glúteos']
    });
    totalScore -= 10;
  }

  // 8. Calcular nível de risco
  const riskLevel: 'low' | 'medium' | 'high' = 
    totalScore >= 80 ? 'low' : 
    totalScore >= 60 ? 'medium' : 'high';

  // 9. Gerar recomendações
  const recommendations = patterns.map(p => `${p.code}: ${p.name}`);

  return {
    overallScore: Math.max(0, totalScore),
    riskLevel,
    patterns,
    recommendations
  };
}

/**
 * Salva análise no banco de dados
 */
export async function saveAnalysis(
  evaluationId: string,
  analysis: AnalysisResult,
  userId: string
): Promise<string> {
  const { data, error } = await legacyTable('postural_analyses')
    .insert([{
      evaluation_id: evaluationId,
      created_by: userId,
      overall_score: analysis.overallScore,
      risk_level: analysis.riskLevel,
      identified_patterns: analysis.patterns as any,
      recommendations: analysis.recommendations as any,
      exercise_protocols: analysis.patterns.map(p => ({
        code: p.code,
        exercises: p.keyExercises,
        duration: p.duration
      })) as any
    }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Busca análise salva
 */
export async function getAnalysis(evaluationId: string): Promise<AnalysisResult | null> {
  const { data, error } = await legacyTable('postural_analyses')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    overallScore: data.overall_score,
    riskLevel: data.risk_level as 'low' | 'medium' | 'high',
    patterns: (data.identified_patterns as any) || [],
    recommendations: (data.recommendations as any) || []
  };
}