// Angulos biomecanicos em graus a partir dos keypoints 2D (para o painel de metricas).
// Estimativas de TRIAGEM: dependem do enquadramento e da qualidade da foto; nao sao diagnostico.
// Sinal (lateralidade anatomica do aluno): tilts positivos = lado DIREITO mais alto.

import type { RawKeypoint } from './postureGeometry';

export type AngleClass = 'normal' | 'leve' | 'significativo';
export interface BiomechAngle { id: string; value: number; cls: AngleClass }

interface Pt { x: number; y: number; c: number }
const MIN_VIS = 0.5;
const deg = (r: number) => (r * 180) / Math.PI;
const r1 = (n: number) => Math.round(n * 10) / 10;
const cls = (v: number, t1: number, t2: number): AngleClass => (v < t1 ? 'normal' : v < t2 ? 'leve' : 'significativo');
const vis = (...p: Pt[]) => p.every(q => q.c >= MIN_VIS);

function interior(a: Pt, b: Pt, c: Pt): number | null {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!m) return null;
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / m))));
}

export function computeBiomechAngles(kps: RawKeypoint[], view: string, w: number, h: number): BiomechAngle[] {
  const out: BiomechAngle[] = [];
  if (!kps || kps.length < 33 || !w || !h) return out;
  const P = (i: number): Pt => ({ x: kps[i].x * w, y: kps[i].y * h, c: kps[i].confidence ?? 0 });
  const shL = P(11), shR = P(12), hipL = P(23), hipR = P(24);

  if (view === 'anterior' || view === 'posterior') {
    if (!vis(shL, shR, hipL, hipR)) return out;
    const msh = { x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2 };
    const mhip = { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2 };
    const torso = Math.hypot(msh.x - mhip.x, msh.y - mhip.y);
    if (!torso || Math.abs(shL.x - shR.x) / torso < 0.55) return out; // nao e foto frontal

    // + = lado direito (anatomico) mais alto. y menor = mais alto.
    const tilt = (L: Pt, R: Pt) => deg(Math.atan2(L.y - R.y, Math.abs(L.x - R.x) || 1e-6));
    const earL = P(7), earR = P(8);
    if (vis(earL, earR)) { const v = tilt(earL, earR); out.push({ id: 'head_tilt', value: r1(v), cls: cls(Math.abs(v), 2, 4) }); }
    { const v = tilt(shL, shR); out.push({ id: 'shoulders', value: r1(v), cls: cls(Math.abs(v), 1, 3) }); }
    { const v = tilt(hipL, hipR); out.push({ id: 'hips', value: r1(v), cls: cls(Math.abs(v), 1, 3) }); }

    const legs: [string, Pt, Pt, Pt][] = [['knee_D', hipR, P(26), P(28)], ['knee_E', hipL, P(25), P(27)]];
    legs.forEach(([id, hip, knee, ank]) => {
      if (!vis(hip, knee, ank)) return;
      const a = interior(hip, knee, ank);
      if (a !== null) out.push({ id, value: r1(a), cls: cls(180 - a, 3.5, 6.5) });
    });

    // tronco: + = inclinado para o lado direito do aluno
    const imgAngle = deg(Math.atan2(msh.x - mhip.x, mhip.y - msh.y));
    const trunk = view === 'anterior' ? -imgAngle : imgAngle;
    out.push({ id: 'trunk', value: r1(trunk), cls: cls(Math.abs(trunk), 2, 4) });
    return out;
  }

  if (view.startsWith('lateral')) {
    if (vis(shL, shR, hipL, hipR)) {
      const torsoF = Math.hypot((shL.x + shR.x) / 2 - (hipL.x + hipR.x) / 2, (shL.y + shR.y) / 2 - (hipL.y + hipR.y) / 2);
      if (torsoF && Math.abs(shL.x - shR.x) / torsoF >= 0.55) return out; // foto de frente
    }
    const right = view !== 'lateral_e';
    const ear = P(right ? 8 : 7), sh = P(right ? 12 : 11), hip = P(right ? 24 : 23);
    const knee = P(right ? 26 : 25), ank = P(right ? 28 : 27), heel = P(right ? 30 : 29), foot = P(right ? 32 : 31), nose = P(0);
    if (!vis(sh, hip)) return out;
    const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y);
    let facing = 0;
    if (vis(heel, foot) && Math.abs(foot.x - heel.x) > 0.02 * torso) facing = Math.sign(foot.x - heel.x);
    else if (vis(nose, ear) && Math.abs(nose.x - ear.x) > 0.02 * torso) facing = Math.sign(nose.x - ear.x);
    if (!facing) return out;

    if (vis(ear, sh)) {
      const a = deg(Math.atan2((ear.x - sh.x) * facing, sh.y - ear.y)); // + = cabeca a frente
      out.push({ id: 'head_forward', value: r1(a), cls: cls(a, 11, 20) });
    }
    { const a = deg(Math.atan2((sh.x - hip.x) * facing, hip.y - sh.y)); out.push({ id: 'trunk_lean', value: r1(a), cls: cls(Math.abs(a), 5, 10) }); }
    if (vis(hip, knee, ank)) {
      const a = interior(hip, knee, ank);
      const dy = ank.y - hip.y;
      if (a !== null && dy > 0) {
        const lineX = hip.x + ((knee.y - hip.y) / dy) * (ank.x - hip.x);
        const back = -((knee.x - lineX) * facing) > 0; // joelho para tras = hiperextensao
        const v = 180 + (back ? 1 : -1) * (180 - a);
        out.push({ id: 'knee_side', value: r1(v), cls: cls(Math.abs(v - 180), 3.5, 6.5) });
      }
    }
  }
  return out;
}
