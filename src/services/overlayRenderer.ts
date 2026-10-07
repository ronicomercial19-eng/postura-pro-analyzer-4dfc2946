// Desenha, em cima da propria foto, o esqueleto, as linhas de referencia, etiquetas de angulo
// e a caixa "METRICAS BIOMECANICAS" (estilo relatorio profissional). Funcao pura sobre um contexto 2D,
// entao funciona no navegador (canvas) e pode ser exportada como PNG.

export type OverlayClass = 'normal' | 'leve' | 'significativo';
export interface OverlayAngle { value: number; cls: OverlayClass }
export interface OverlayInput {
  view: string;
  scale: number; // keypoints (px da imagem original) -> px do canvas
  width: number;
  height: number;
  kps: Record<string, { x: number; y: number }>;
  angles: Record<string, OverlayAngle>;
}

export const OVERLAY_COLOR: Record<OverlayClass, string> = { normal: '#22c55e', leve: '#f59e0b', significativo: '#ef4444' };
const CLS_TEXT: Record<OverlayClass, string> = { normal: 'Normal', leve: 'Leve', significativo: 'Signif.' };
export const OVERLAY_LABEL: Record<string, string> = {
  head_tilt: 'Cabeça (inclin.)', shoulders: 'Ombros (desnível)', hips: 'Quadril (desnível)', trunk: 'Tronco (desvio)',
  knee_D: 'Joelho Dir', knee_E: 'Joelho Esq', head_forward: 'Cabeça à frente', trunk_lean: 'Tronco (inclin.)', knee_side: 'Joelho (perfil)',
};
const ORDER = ['head_tilt', 'shoulders', 'hips', 'trunk', 'knee_D', 'knee_E', 'head_forward', 'trunk_lean', 'knee_side'];

type Pt = { x: number; y: number };

export function drawOverlay(ctx: CanvasRenderingContext2D, o: OverlayInput): void {
  const { width: W, height: H, scale: s, view } = o;
  const P = (n: string): Pt | null => (o.kps[n] ? { x: o.kps[n].x * s, y: o.kps[n].y * s } : null);
  const col = (id: string) => (o.angles[id] ? OVERLAY_COLOR[o.angles[id].cls] : '#22c55e');
  const mid = (a: Pt | null, b: Pt | null): Pt | null => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);
  const lw = Math.max(2, W / 240);

  const line = (a: Pt | null, b: Pt | null, color: string, dash = false) => {
    if (!a || !b) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash([W / 70, W / 90]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  };
  const pill = (id: string, at: Pt | null, dx = 0, dy = 0) => {
    const a = o.angles[id];
    if (!a || !at) return;
    const text = `${a.value.toFixed(1)}°`;
    ctx.save();
    ctx.font = `bold ${Math.round(W / 46)}px sans-serif`;
    const tw = ctx.measureText(text).width + W / 50, th = W / 32;
    const x = Math.min(Math.max(at.x + dx, tw / 2 + 2), W - tw / 2 - 2), y = Math.min(Math.max(at.y + dy, th / 2 + 2), H - th / 2 - 2);
    ctx.fillStyle = '#fde68a'; ctx.strokeStyle = OVERLAY_COLOR[a.cls]; ctx.lineWidth = Math.max(1.5, W / 400);
    ctx.fillRect(x - tw / 2, y - th / 2, tw, th); ctx.strokeRect(x - tw / 2, y - th / 2, tw, th);
    ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  };

  const used = new Set<string>();
  const frontal = view === 'anterior' || view === 'posterior';

  if (frontal) {
    const lS = P('left_shoulder'), rS = P('right_shoulder'), lH = P('left_hip'), rH = P('right_hip');
    const mS = mid(lS, rS), mH = mid(lH, rH);
    if (mH) line({ x: mH.x, y: 0 }, { x: mH.x, y: H }, 'rgba(255,255,255,0.55)', true); // prumo
    line(P('left_ear'), P('right_ear'), col('head_tilt'));
    line(lS, rS, col('shoulders'));
    line(lH, rH, col('hips'));
    line(mS, mH, col('trunk'));
    line(rH, P('right_knee'), col('knee_D')); line(P('right_knee'), P('right_ankle'), col('knee_D'));
    line(lH, P('left_knee'), col('knee_E')); line(P('left_knee'), P('left_ankle'), col('knee_E'));
    ['left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'nose'].forEach(n => used.add(n));

    const cx = mH ? mH.x : W / 2;
    const out = (p: Pt | null) => (p && p.x < cx ? -1 : 1) * W * 0.075;
    pill('head_tilt', mid(P('left_ear'), P('right_ear')), 0, -W * 0.04);
    pill('shoulders', mS, 0, -W * 0.035);
    pill('hips', mid(lH, rH), 0, W * 0.035);
    pill('trunk', mid(mS, mH), W * 0.09, 0);
    pill('knee_D', P('right_knee'), out(P('right_knee')), 0);
    pill('knee_E', P('left_knee'), out(P('left_knee')), 0);
  } else {
    const pre = view === 'lateral_e' ? 'left_' : 'right_';
    const ear = P(pre + 'ear'), sh = P(pre + 'shoulder'), hip = P(pre + 'hip'), knee = P(pre + 'knee'), ank = P(pre + 'ankle');
    if (ank) line(ank, { x: ank.x, y: 0 }, 'rgba(255,255,255,0.55)', true); // prumo
    line(ear, sh, col('head_forward'));
    line(sh, hip, col('trunk_lean'));
    line(hip, knee, col('knee_side')); line(knee, ank, col('knee_side'));
    ['ear', 'shoulder', 'hip', 'knee', 'ankle'].forEach(n => used.add(pre + n));
    const side = (p: Pt | null) => (p && p.x > W / 2 ? -1 : 1) * W * 0.09;
    pill('head_forward', ear, side(ear), 0);
    pill('trunk_lean', mid(sh, hip), side(hip), 0);
    pill('knee_side', knee, side(knee), 0);
  }

  // pontos do corpo
  used.forEach(n => {
    const p = P(n);
    if (!p) return;
    ctx.save();
    ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, W / 420);
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, W / 130), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // caixa de metricas (canto superior direito)
  const rows = ORDER.filter(id => o.angles[id]);
  if (rows.length) {
    const fs = Math.round(W / 52), pad = fs * 0.7, rowH = fs * 1.55, titleH = fs * 1.7;
    const bw = Math.round(W * 0.42), bh = titleH + rows.length * rowH + pad;
    const bx = W - bw - W * 0.015, by = W * 0.015;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,22,0.88)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = Math.max(1.5, W / 420); ctx.strokeRect(bx, by, bw, bh);
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(fs * 0.82)}px sans-serif`; ctx.fillStyle = '#4ade80'; ctx.textAlign = 'left';
    ctx.fillText('MÉTRICAS BIOMECÂNICAS', bx + pad, by + titleH / 2 + pad * 0.3);
    rows.forEach((id, i) => {
      const a = o.angles[id], y = by + titleH + rowH * i + rowH / 2;
      ctx.font = `${fs}px sans-serif`; ctx.fillStyle = '#e5e7eb'; ctx.textAlign = 'left';
      ctx.fillText(OVERLAY_LABEL[id] || id, bx + pad, y);
      ctx.font = `bold ${fs}px sans-serif`; ctx.fillStyle = '#fde68a'; ctx.textAlign = 'right';
      ctx.fillText(`${a.value.toFixed(1)}°`, bx + bw * 0.64, y);
      ctx.font = `bold ${Math.round(fs * 0.85)}px sans-serif`; ctx.fillStyle = OVERLAY_COLOR[a.cls];
      ctx.fillText(CLS_TEXT[a.cls], bx + bw - pad, y);
    });
    ctx.restore();
  }

  // marca
  ctx.save();
  ctx.font = `bold ${Math.round(W / 40)}px sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('PosturaPro', W * 0.025, H - W * 0.02);
  ctx.restore();
}
