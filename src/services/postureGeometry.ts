// ============================================
// GEOMETRIA POSTURAL 2D CONSCIENTE DA VISTA
//
// Recebe os 33 landmarks do MediaPipe (x,y normalizados 0..1) + a vista da foto
// e devolve apenas o que uma foto 2D consegue medir com honestidade:
//   Vista frontal (anterior/posterior): desnivel de ombros (PEP13), desnivel
//     pelvico (PEP20), joelho valgo (PEP04) e varo (PEP05) - sempre com o LADO.
//   Vista sagital (lateral_d/lateral_e): anteriorizacao de cabeca (PEP14) e
//     hiperextensao de joelho (PEP06).
//
// NAO mede (exige radiografia ou marcadores ossos-especificos): cifose, lordose,
// inclinacao pelvica, escoliose, pronacao do pe. Esses achados entram por
// confirmacao do avaliador, nao por foto.
//
// Todas as distancias sao calculadas em PIXELS (x*largura, y*altura) e normalizadas
// pelo comprimento do tronco ou da perna, entao nao dependem do enquadramento.
// ============================================

export interface RawKeypoint {
  x: number;
  y: number;
  z?: number;
  confidence: number;
}

export type Side = 'D' | 'E';

export interface PostureFlag {
  code: 'PEP13' | 'PEP20' | 'PEP04' | 'PEP05' | 'PEP14' | 'PEP06';
  name: string;
  side?: Side;
  severity: number;
  measurement: number; // percentual do referencial (tronco ou perna)
  unit: string;
  view: string;
  confidence: number; // 0..1
}

export interface GeometryMetric {
  key: string;
  value: number;
  unit: string;
}

export interface PostureGeometryResult {
  flags: PostureFlag[];
  metrics: GeometryMetric[];
  plane: 'frontal' | 'sagital' | 'obliqua' | 'desconhecido';
  warnings: string[];
}

// Indices do MediaPipe Pose
const I = {
  NOSE: 0,
  EAR_L: 7, EAR_R: 8,
  SH_L: 11, SH_R: 12,
  HIP_L: 23, HIP_R: 24,
  KNEE_L: 25, KNEE_R: 26,
  ANK_L: 27, ANK_R: 28,
  HEEL_L: 29, HEEL_R: 30,
  FOOT_L: 31, FOOT_R: 32,
} as const;

// Nomes em ingles (canonicos) usados pelo AnalyticCanvas
export const KEYPOINT_NAMES_EN: Record<number, string> = {
  0: 'nose', 7: 'left_ear', 8: 'right_ear',
  11: 'left_shoulder', 12: 'right_shoulder',
  13: 'left_elbow', 14: 'right_elbow',
  15: 'left_wrist', 16: 'right_wrist',
  23: 'left_hip', 24: 'right_hip',
  25: 'left_knee', 26: 'right_knee',
  27: 'left_ankle', 28: 'right_ankle',
  29: 'left_heel', 30: 'right_heel',
  31: 'left_foot_index', 32: 'right_foot_index',
};

const MIN_VIS = 0.5;

interface Pt { x: number; y: number; c: number }

function severityFrom(mag: number, t1: number, t2: number, t3: number): number {
  if (mag >= t3) return 3;
  if (mag >= t2) return 2;
  if (mag >= t1) return 1;
  return 0;
}

function confidenceFrom(...pts: Pt[]): number {
  const minVis = Math.min(...pts.map(p => p.c));
  const clamped = Math.max(MIN_VIS, Math.min(1, minVis));
  return Math.round((0.6 + 0.4 * ((clamped - MIN_VIS) / (1 - MIN_VIS))) * 100) / 100;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const vis = (...pts: Pt[]) => pts.every(p => p.c >= MIN_VIS);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function analyzePostureGeometry(
  keypoints: RawKeypoint[],
  view: string,
  imageWidth: number,
  imageHeight: number
): PostureGeometryResult {
  const result: PostureGeometryResult = { flags: [], metrics: [], plane: 'desconhecido', warnings: [] };
  if (!keypoints || keypoints.length < 33 || !imageWidth || !imageHeight) {
    result.warnings.push(`Dados insuficientes para medir a vista ${view}.`);
    return result;
  }

  const P = (i: number): Pt => {
    const k = keypoints[i];
    return { x: k.x * imageWidth, y: k.y * imageHeight, c: k.confidence ?? 0 };
  };

  const expectedFrontal = view === 'anterior' || view === 'posterior';
  const expectedSagittal = view.startsWith('lateral');

  const shL = P(I.SH_L), shR = P(I.SH_R), hipL = P(I.HIP_L), hipR = P(I.HIP_R);

  // ---- Checagem de plano: a largura dos ombros colapsa numa foto lateral ----
  let plane: PostureGeometryResult['plane'] = 'desconhecido';
  if (vis(shL, shR, hipL, hipR)) {
    const torso = dist({ x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2, c: 1 }, { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2, c: 1 });
    if (torso > 0) {
      const ratio = Math.abs(shL.x - shR.x) / torso;
      plane = ratio >= 0.55 ? 'frontal' : ratio <= 0.35 ? 'sagital' : 'obliqua';
      result.metrics.push({ key: `plane_ratio_${view}`, value: round2(ratio), unit: 'largura ombros / tronco' });
    }
  }
  result.plane = plane;

  if (expectedFrontal) {
    if (plane === 'sagital' || plane === 'obliqua') {
      result.warnings.push(
        plane === 'sagital'
          ? `A foto marcada como "${view}" parece estar de perfil. As medidas de frente foram ignoradas — refaça a foto de frente.`
          : `A foto marcada como "${view}" está girada (3/4). As medidas foram ignoradas — o aluno deve ficar de frente para a câmera.`
      );
      return result;
    }
    if (plane === 'desconhecido') {
      result.warnings.push(`Ombros/quadril não visíveis na vista ${view}. Refaça o enquadramento (corpo inteiro).`);
      return result;
    }
    analyzeFrontal(result, P, view, shL, shR, hipL, hipR);
  } else if (expectedSagittal) {
    if (plane === 'frontal') {
      result.warnings.push(`A foto marcada como "${view}" parece estar de frente. As medidas de perfil foram ignoradas — refaça a foto de lado.`);
      return result;
    }
    analyzeSagittal(result, P, view);
  }

  return result;
}

// ------------------------------------------------------------
// PLANO FRONTAL
// ------------------------------------------------------------
function analyzeFrontal(
  result: PostureGeometryResult,
  P: (i: number) => Pt,
  view: string,
  shL: Pt, shR: Pt, hipL: Pt, hipR: Pt
) {
  const midSh = { x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2, c: 1 };
  const midHip = { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2, c: 1 };
  const torso = dist(midSh, midHip);
  if (torso <= 0) return;

  // Aviso de camera inclinada: ombros, quadril e tornozelos inclinados igual = camera torta
  const ankL = P(I.ANK_L), ankR = P(I.ANK_R);
  const lineAngle = (a: Pt, b: Pt) => {
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    return (Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI;
  };
  let rollSuspect = false;
  if (vis(ankL, ankR)) {
    const aS = lineAngle(shL, shR), aH = lineAngle(hipL, hipR), aA = lineAngle(ankL, ankR);
    if (Math.abs(aA) >= 1.5 && Math.sign(aA) === Math.sign(aS) && Math.sign(aA) === Math.sign(aH)) {
      rollSuspect = true;
      result.warnings.push(`Possível inclinação da câmera na vista ${view} (linhas de ombro, quadril e pés inclinadas igualmente). Desnível de ombros e quadril ignorado nesta foto — nivele o celular e refaça.`);
    }
  }

  // 1) Desnivel de ombros: lado ELEVADO = menor y
  {
    const diff = Math.abs(shL.y - shR.y) / torso;
    result.metrics.push({ key: `shoulder_diff_${view}`, value: round2(diff * 100), unit: shR.y < shL.y ? 'D' : 'E' });
    const sev = rollSuspect ? 0 : severityFrom(diff, 0.03, 0.055, 0.09);
    if (sev > 0) {
      const side: Side = shR.y < shL.y ? 'D' : 'E';
      result.flags.push({
        code: 'PEP13', name: `Elevação de ombro ${side === 'D' ? 'direito' : 'esquerdo'}`,
        side, severity: sev, measurement: round2(diff * 100), unit: '% do tronco', view,
        confidence: confidenceFrom(shL, shR, hipL, hipR),
      });
    }
  }

  // 2) Desnivel pelvico: lado ELEVADO = menor y
  {
    const diff = Math.abs(hipL.y - hipR.y) / torso;
    result.metrics.push({ key: `hip_diff_${view}`, value: round2(diff * 100), unit: hipR.y < hipL.y ? 'D' : 'E' });
    const sev = rollSuspect ? 0 : severityFrom(diff, 0.03, 0.055, 0.09);
    if (sev > 0) {
      const side: Side = hipR.y < hipL.y ? 'D' : 'E';
      result.flags.push({
        code: 'PEP20', name: `Desnível pélvico (quadril ${side === 'D' ? 'direito' : 'esquerdo'} elevado)`,
        side, severity: sev, measurement: round2(diff * 100), unit: '% do tronco', view,
        confidence: confidenceFrom(hipL, hipR),
      });
    }
  }

  // 3) Valgo / varo: desvio do joelho em relacao a linha quadril->tornozelo,
  //    medido em direcao a linha media do corpo (independe de frente/costas e de lado)
  const midlineX = (hipL.x + hipR.x) / 2;
  const legs: { side: Side; hip: Pt; knee: Pt; ank: Pt }[] = [
    { side: 'D', hip: hipR, knee: P(I.KNEE_R), ank: P(I.ANK_R) },
    { side: 'E', hip: hipL, knee: P(I.KNEE_L), ank: P(I.ANK_L) },
  ];
  legs.forEach(({ side, hip, knee, ank }) => {
    if (!vis(hip, knee, ank)) return;
    const legLen = dist(hip, ank);
    const dy = ank.y - hip.y;
    if (legLen <= 0 || dy < legLen * 0.5) return; // perna precisa estar na vertical
    const t = (knee.y - hip.y) / dy;
    const lineX = hip.x + t * (ank.x - hip.x);
    const medialSign = Math.sign(midlineX - hip.x);
    if (medialSign === 0) return;
    const inward = ((knee.x - lineX) * medialSign) / legLen; // >0 valgo, <0 varo
    result.metrics.push({ key: `knee_inward_${side}_${view}`, value: round2(inward * 100), unit: '% da perna' });
    const sev = severityFrom(Math.abs(inward), 0.03, 0.055, 0.085);
    if (sev > 0) {
      const valgus = inward > 0;
      result.flags.push({
        code: valgus ? 'PEP04' : 'PEP05',
        name: `Joelho ${valgus ? 'valgo' : 'varo'} ${side === 'D' ? 'direito' : 'esquerdo'}`,
        side, severity: sev, measurement: round2(Math.abs(inward) * 100), unit: '% da perna', view,
        confidence: Math.min(0.85, confidenceFrom(hip, knee, ank)), // joelho em 2D e menos confiavel
      });
    }
  });
}

// ------------------------------------------------------------
// PLANO SAGITAL (perfil)
// ------------------------------------------------------------
function analyzeSagittal(result: PostureGeometryResult, P: (i: number) => Pt, view: string) {
  type Idx = { ear: number; sh: number; hip: number; knee: number; ank: number; heel: number; foot: number };
  const right: Idx = { ear: I.EAR_R, sh: I.SH_R, hip: I.HIP_R, knee: I.KNEE_R, ank: I.ANK_R, heel: I.HEEL_R, foot: I.FOOT_R };
  const left: Idx = { ear: I.EAR_L, sh: I.SH_L, hip: I.HIP_L, knee: I.KNEE_L, ank: I.ANK_L, heel: I.HEEL_L, foot: I.FOOT_L };

  let idx: Idx | null = view === 'lateral_d' ? right : view === 'lateral_e' ? left : null;
  if (!idx) {
    const score = (m: Idx) => P(m.sh).c + P(m.hip).c + P(m.ear).c + P(m.ank).c;
    idx = score(right) >= score(left) ? right : left;
  }
  const side: Side = idx === right ? 'D' : 'E';

  const ear = P(idx.ear), sh = P(idx.sh), hip = P(idx.hip), knee = P(idx.knee), ank = P(idx.ank);
  const heel = P(idx.heel), foot = P(idx.foot), nose = P(I.NOSE);

  if (!vis(sh, hip)) {
    result.warnings.push(`Ombro/quadril do lado ${side === 'D' ? 'direito' : 'esquerdo'} não visíveis na vista ${view}.`);
    return;
  }
  const torso = dist(sh, hip);
  if (torso <= 0) return;

  // Direcao do olhar: prefere a ponta do pe, senao nariz vs orelha
  let facing = 0;
  if (vis(heel, foot) && Math.abs(foot.x - heel.x) > 0.02 * torso) facing = Math.sign(foot.x - heel.x);
  else if (vis(nose, ear) && Math.abs(nose.x - ear.x) > 0.02 * torso) facing = Math.sign(nose.x - ear.x);
  if (facing === 0) {
    result.warnings.push(`Não foi possível determinar para que lado o aluno está olhando na vista ${view}. Medidas de perfil ignoradas.`);
    return;
  }

  // Cabeca anteriorizada: orelha a frente do acromio, normalizada pelo tronco
  if (vis(ear, sh)) {
    const fh = ((ear.x - sh.x) * facing) / torso;
    result.metrics.push({ key: `head_forward_${view}`, value: round2(fh * 100), unit: '% do tronco' });
    const sev = severityFrom(fh, 0.08, 0.15, 0.23);
    if (sev > 0) {
      result.flags.push({
        code: 'PEP14', name: 'Anteriorização de cabeça', severity: sev,
        measurement: round2(fh * 100), unit: '% do tronco', view,
        confidence: confidenceFrom(ear, sh, hip),
      });
    }
  }

  // Prumo (apenas metricas de contexto para o relatorio - nao geram flag)
  if (vis(ank)) {
    result.metrics.push({ key: `plumb_hip_ankle_${view}`, value: round2((((hip.x - ank.x) * facing) / torso) * 100), unit: '% do tronco' });
    result.metrics.push({ key: `plumb_shoulder_ankle_${view}`, value: round2((((sh.x - ank.x) * facing) / torso) * 100), unit: '% do tronco' });
  }

  // Hiperextensao de joelho: joelho deslocado para TRAS da linha quadril->tornozelo
  if (vis(hip, knee, ank)) {
    const legLen = dist(hip, ank);
    const dy = ank.y - hip.y;
    if (legLen > 0 && dy > legLen * 0.5) {
      const t = (knee.y - hip.y) / dy;
      const lineX = hip.x + t * (ank.x - hip.x);
      const back = -((knee.x - lineX) * facing) / legLen; // >0 = joelho para tras
      result.metrics.push({ key: `knee_back_${side}_${view}`, value: round2(back * 100), unit: '% da perna' });
      const sev = severityFrom(back, 0.03, 0.05, 0.075);
      if (sev > 0) {
        result.flags.push({
          code: 'PEP06', name: `Hiperextensão de joelho ${side === 'D' ? 'direito' : 'esquerdo'}`,
          side, severity: sev, measurement: round2(back * 100), unit: '% da perna', view,
          confidence: Math.min(0.85, confidenceFrom(hip, knee, ank)),
        });
      }
    }
  }
}
