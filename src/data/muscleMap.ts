// ============================================
// MAPA MUSCULAR: achado postural -> o que LIBERAR, ALONGAR e FORTALECER
//
// Base conceitual: padroes de desequilibrio muscular de Janda (sindromes cruzadas)
// e postura estatica de Kendall. E um ponto de PARTIDA para o avaliador, nao um
// diagnostico: toda prescricao deve ser revisada pelo profissional antes de publicar.
//
// Convencao de lado: 'D' / 'E' e sempre o lado ANATOMICO do aluno.
// ============================================

export type ExerciseKind = 'liberacao' | 'alongamento' | 'ativacao' | 'fortalecimento';

export interface MapExercise {
  kind: ExerciseKind;
  name: string;
  sets: number;
  time?: number; // segundos (isometria / alongamento / liberacao)
  reps?: number;
  perSide?: boolean; // repetir em cada lado
  loaded?: boolean; // envolve carga externa/axial relevante (cortado em modo SHIELD)
}

export interface MuscleMapEntry {
  code: string;
  label: string;
  unilateral: boolean; // o campo `side` do achado se aplica a este achado
  sideMeaning?: string; // como ler o lado (ex.: 'lado elevado')
  liberar: string[];
  alongar: string[];
  fortalecer: string[];
  exercises: MapExercise[];
  note?: string;
  referOut?: boolean; // sem exercicios genericos: encaminhar
  detectedBy: 'foto' | 'avaliador';
}

// ---- Exercicios reutilizados ----
const EX = {
  peitoralPorta: { kind: 'alongamento', name: 'Alongamento de peitoral na porta', sets: 3, time: 30 } as MapExercise,
  peitoralBola: { kind: 'liberacao', name: 'Liberação de peitoral menor com bola', sets: 2, time: 60, perSide: true } as MapExercise,
  trapSuperior: { kind: 'alongamento', name: 'Alongamento de trapézio superior (inclinação lateral do pescoço)', sets: 3, time: 30, perSide: true } as MapExercise,
  remadaElastico: { kind: 'fortalecimento', name: 'Remada com elástico (retração escapular)', sets: 3, reps: 12 } as MapExercise,
  ponteGluteo: { kind: 'fortalecimento', name: 'Ponte de glúteo', sets: 3, reps: 12 } as MapExercise,
  deadBug: { kind: 'ativacao', name: 'Dead bug (controle do abdômen)', sets: 3, reps: 10 } as MapExercise,
  flexoresQuadril: { kind: 'alongamento', name: 'Alongamento de flexores do quadril (meio-ajoelhado)', sets: 3, time: 30, perSide: true } as MapExercise,
  isquios: { kind: 'alongamento', name: 'Alongamento de isquiotibiais deitado com faixa', sets: 3, time: 30, perSide: true } as MapExercise,
  tflRolo: { kind: 'liberacao', name: 'Liberação de tensor da fáscia lata / banda iliotibial com rolo', sets: 2, time: 60, perSide: true } as MapExercise,
  tflAlong: { kind: 'alongamento', name: 'Alongamento de tensor da fáscia lata (pernas cruzadas em pé)', sets: 3, time: 30, perSide: true } as MapExercise,
  panturrilha: { kind: 'alongamento', name: 'Alongamento de panturrilha na parede', sets: 3, time: 30, perSide: true } as MapExercise,
};

export const MUSCLE_MAP: Record<string, MuscleMapEntry> = {
  // ---------- Detectados por foto ----------
  PEP14: {
    code: 'PEP14', label: 'Anteriorização de cabeça', unilateral: false, detectedBy: 'foto',
    liberar: ['Suboccipitais', 'Trapézio superior'],
    alongar: ['Trapézio superior', 'Elevador da escápula', 'Escalenos', 'Peitoral maior e menor'],
    fortalecer: ['Flexores profundos do pescoço', 'Trapézio médio e inferior', 'Romboides'],
    exercises: [
      { kind: 'liberacao', name: 'Liberação de suboccipitais com bola de tênis', sets: 2, time: 60 },
      EX.trapSuperior,
      EX.peitoralPorta,
      { kind: 'ativacao', name: 'Chin tuck (retração cervical) deitado', sets: 3, reps: 10 },
      EX.remadaElastico,
    ],
    note: 'Costuma vir junto com protração de ombros (síndrome cruzada superior): vale avaliar a cintura escapular.',
  },
  PEP13: {
    code: 'PEP13', label: 'Elevação de ombro', unilateral: true, sideMeaning: 'lado do ombro elevado', detectedBy: 'foto',
    liberar: ['Trapézio superior'],
    alongar: ['Trapézio superior', 'Elevador da escápula'],
    fortalecer: ['Trapézio inferior', 'Serrátil anterior'],
    exercises: [
      { ...EX.trapSuperior, perSide: true },
      { kind: 'alongamento', name: 'Alongamento de elevador da escápula', sets: 3, time: 30, perSide: true },
      { kind: 'fortalecimento', name: 'Elevação em Y deitado de bruços (depressão escapular)', sets: 3, reps: 10 },
      { kind: 'fortalecimento', name: 'Prancha com protração escapular', sets: 3, time: 20 },
    ],
    note: 'Ombro elevado de um lado pode ser reflexo de escoliose ou desnível pélvico. Se aparecer junto com desnível de quadril, confirme com Teste de Adams e Teste do Calço antes de tratar como problema isolado do ombro.',
  },
  PEP20: {
    code: 'PEP20', label: 'Desnível pélvico', unilateral: true, sideMeaning: 'lado do quadril elevado', detectedBy: 'foto',
    liberar: ['Quadrado lombar'],
    alongar: ['Quadrado lombar'],
    fortalecer: ['Glúteo médio', 'Core lateral (oblíquos)'],
    exercises: [
      { kind: 'alongamento', name: 'Alongamento de quadrado lombar (inclinação lateral do tronco)', sets: 3, time: 30, perSide: true },
      { kind: 'ativacao', name: 'Abdução de quadril em decúbito lateral', sets: 3, reps: 12, perSide: true },
      { kind: 'fortalecimento', name: 'Prancha lateral', sets: 3, time: 20, perSide: true },
    ],
    note: 'Hipótese a confirmar: investigue discrepância de comprimento de membros com o Teste do Calço (1–1,5 cm) antes de aplicar correção assimétrica. Se o desnível se corrige com o calço, considere palmilha; se não, avalie estrutura.',
  },
  PEP04: {
    code: 'PEP04', label: 'Joelho valgo', unilateral: true, sideMeaning: 'joelho com valgo', detectedBy: 'foto',
    liberar: ['Tensor da fáscia lata / banda iliotibial', 'Adutores'],
    alongar: ['Tensor da fáscia lata / banda iliotibial', 'Adutores'],
    fortalecer: ['Glúteo médio', 'Glúteo máximo', 'Vasto medial oblíquo (VMO)', 'Tibial posterior'],
    exercises: [
      { ...EX.tflRolo },
      { ...EX.tflAlong },
      { kind: 'alongamento', name: 'Alongamento de adutores (afastamento lateral sentado)', sets: 3, time: 30 },
      { kind: 'ativacao', name: 'Clamshell com elástico', sets: 3, reps: 15, perSide: true },
      { kind: 'fortalecimento', name: 'Abdução de quadril em decúbito lateral', sets: 3, reps: 12, perSide: true },
      { kind: 'fortalecimento', name: 'Agachamento parcial com elástico acima dos joelhos (joelho alinhado ao 2º dedo)', sets: 3, reps: 10 },
    ],
    note: 'Valgo estático costuma acompanhar pé pronado e fraqueza de glúteo médio. Vale observar o joelho em agachamento (valgo dinâmico).',
  },
  PEP05: {
    code: 'PEP05', label: 'Joelho varo', unilateral: true, sideMeaning: 'joelho com varo', detectedBy: 'foto',
    liberar: ['Tensor da fáscia lata / banda iliotibial', 'Bíceps femoral'],
    alongar: ['Tensor da fáscia lata / banda iliotibial', 'Bíceps femoral'],
    fortalecer: ['Adutores do quadril', 'Isquiotibiais mediais', 'Glúteo máximo'],
    exercises: [
      { ...EX.tflRolo },
      { ...EX.tflAlong },
      { kind: 'alongamento', name: 'Alongamento de bíceps femoral (perna esticada, pé levemente para dentro)', sets: 3, time: 30, perSide: true },
      { kind: 'fortalecimento', name: 'Adução de quadril em decúbito lateral (perna de baixo)', sets: 3, reps: 12, perSide: true },
      EX.ponteGluteo,
    ],
    note: 'Varo leve pode ser variação anatômica. Correlacione com dor no compartimento medial/lateral do joelho antes de intervir.',
  },
  PEP06: {
    code: 'PEP06', label: 'Hiperextensão de joelho', unilateral: true, sideMeaning: 'joelho hiperestendido', detectedBy: 'foto',
    liberar: [],
    alongar: [],
    fortalecer: ['Isquiotibiais', 'Glúteo máximo', 'Sóleo'],
    exercises: [
      { kind: 'fortalecimento', name: 'Flexão de joelho com elástico (isquiotibiais)', sets: 3, reps: 12, perSide: true },
      EX.ponteGluteo,
      { kind: 'ativacao', name: 'Treino de postura em pé com joelhos destravados (leve flexão)', sets: 3, time: 30 },
    ],
    note: 'Oriente manter os joelhos levemente destravados em pé e nos exercícios; evite "travar" o joelho na extensão total sob carga.',
  },

  // ---------- Confirmados pelo avaliador (foto 2D nao mede) ----------
  PEP12: {
    code: 'PEP12', label: 'Protração de ombros', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Peitoral menor'],
    alongar: ['Peitoral menor', 'Peitoral maior', 'Deltoide anterior'],
    fortalecer: ['Romboides', 'Trapézio médio e inferior', 'Serrátil anterior', 'Rotadores externos do ombro'],
    exercises: [
      EX.peitoralBola,
      EX.peitoralPorta,
      { kind: 'ativacao', name: 'Rotação externa de ombro com elástico', sets: 3, reps: 15, perSide: true },
      EX.remadaElastico,
      { kind: 'fortalecimento', name: 'Deslizamento de braços na parede (wall slides)', sets: 3, reps: 10 },
    ],
  },
  PEP11: {
    code: 'PEP11', label: 'Hipercifose torácica', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Peitoral menor', 'Paravertebrais torácicos'],
    alongar: ['Peitoral maior e menor', 'Latíssimo do dorso'],
    fortalecer: ['Extensores torácicos', 'Trapézio médio e inferior', 'Romboides'],
    exercises: [
      { kind: 'liberacao', name: 'Mobilização torácica em extensão sobre o rolo', sets: 2, reps: 10 },
      EX.peitoralPorta,
      { kind: 'alongamento', name: 'Alongamento de latíssimo (posição da criança com braços à frente)', sets: 3, time: 30 },
      { kind: 'fortalecimento', name: 'Extensão torácica em decúbito ventral (mãos na nuca, elevação leve)', sets: 3, reps: 10 },
      EX.remadaElastico,
    ],
    note: 'Hipercifose rígida (que não corrige ao se alongar) merece avaliação médica.',
  },
  PEP09: {
    code: 'PEP09', label: 'Hiperlordose lombar', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Iliopsoas', 'Reto femoral'],
    alongar: ['Flexores do quadril (iliopsoas e reto femoral)', 'Eretores da espinha lombar'],
    fortalecer: ['Glúteo máximo', 'Abdominais (reto abdominal e oblíquos)', 'Isquiotibiais'],
    exercises: [
      EX.flexoresQuadril,
      { kind: 'alongamento', name: 'Alongamento de reto femoral em pé', sets: 3, time: 30, perSide: true },
      { kind: 'ativacao', name: 'Inclinação pélvica posterior deitado', sets: 3, reps: 12 },
      EX.deadBug,
      EX.ponteGluteo,
    ],
  },
  PEP07: {
    code: 'PEP07', label: 'Anteversão pélvica', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Iliopsoas', 'Reto femoral'],
    alongar: ['Flexores do quadril (iliopsoas e reto femoral)', 'Eretores da espinha lombar'],
    fortalecer: ['Glúteo máximo', 'Abdominais (reto abdominal e oblíquos)', 'Isquiotibiais'],
    exercises: [
      EX.flexoresQuadril,
      { kind: 'alongamento', name: 'Alongamento de reto femoral em pé', sets: 3, time: 30, perSide: true },
      { kind: 'ativacao', name: 'Inclinação pélvica posterior deitado', sets: 3, reps: 12 },
      EX.deadBug,
      EX.ponteGluteo,
    ],
  },
  PEP08: {
    code: 'PEP08', label: 'Retroversão pélvica', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Isquiotibiais'],
    alongar: ['Isquiotibiais', 'Reto abdominal (se encurtado)'],
    fortalecer: ['Flexores do quadril (iliopsoas)', 'Extensores lombares (multífidos)'],
    exercises: [
      EX.isquios,
      { kind: 'ativacao', name: 'Anteversão pélvica consciente em quatro apoios (gato-vaca)', sets: 2, reps: 10 },
      { kind: 'ativacao', name: 'Bird dog', sets: 3, reps: 10 },
      { kind: 'fortalecimento', name: 'Elevação de perna estendida deitado (flexores do quadril)', sets: 3, reps: 10, perSide: true },
    ],
  },
  PEP10: {
    code: 'PEP10', label: 'Retificação lombar', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Isquiotibiais'],
    alongar: ['Isquiotibiais'],
    fortalecer: ['Extensores lombares (multífidos)', 'Flexores do quadril (iliopsoas)'],
    exercises: [
      EX.isquios,
      { kind: 'ativacao', name: 'Anteversão pélvica consciente em quatro apoios (gato-vaca)', sets: 2, reps: 10 },
      { kind: 'ativacao', name: 'Bird dog', sets: 3, reps: 10 },
    ],
  },
  PEP01: {
    code: 'PEP01', label: 'Pé pronado', unilateral: false, detectedBy: 'avaliador',
    liberar: ['Fáscia plantar', 'Fibulares'],
    alongar: ['Gastrocnêmio e sóleo', 'Fibulares'],
    fortalecer: ['Tibial posterior', 'Musculatura intrínseca do pé', 'Glúteo médio'],
    exercises: [
      { kind: 'liberacao', name: 'Liberação da fáscia plantar com bola', sets: 2, time: 60, perSide: true },
      EX.panturrilha,
      { kind: 'ativacao', name: 'Short foot (ativação do arco plantar)', sets: 3, reps: 10, perSide: true },
      { kind: 'fortalecimento', name: 'Elevação de panturrilha com bola entre os calcanhares', sets: 3, reps: 12 },
    ],
    note: 'Considere avaliar calçado e apoio plantar.',
  },
  PEP15: {
    code: 'PEP15', label: 'Escoliose estrutural', unilateral: false, detectedBy: 'avaliador',
    liberar: [], alongar: [], fortalecer: [],
    exercises: [],
    referOut: true,
    note: 'Escoliose estrutural exige avaliação médica/ortopédica. Exercícios específicos (ex.: método Schroth) só com fisioterapeuta habilitado — o app não gera prescrição genérica para este achado.',
  },
};

/** Flags que a foto 2D NAO mede e que o avaliador pode confirmar manualmente. */
export const MANUAL_FLAG_OPTIONS: { code: string; label: string }[] = Object.values(MUSCLE_MAP)
  .filter(e => e.detectedBy === 'avaliador')
  .map(e => ({ code: e.code, label: e.label }));
