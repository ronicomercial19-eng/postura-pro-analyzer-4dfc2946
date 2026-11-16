import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Ruler, Crosshair, RotateCcw, ZoomIn, ZoomOut, Loader2, ImageOff, AlertTriangle } from 'lucide-react';
import { resolvePhotoUrl, isPlaceholderUrl } from '@/lib/photoUrl';

interface Keypoint {
  name: string;
  x: number;
  y: number;
  confidence?: number;
}

interface AnalyticCanvasProps {
  imageUrl: string;
  keypoints: Keypoint[];
  showPlumbLine?: boolean;
  showJointMarkers?: boolean;
  showAngles?: boolean;
  /** Modo embutido: só a imagem com as sobreposições, sem cartão, controles nem legenda. */
  compact?: boolean;
}

type LoadStatus = 'loading' | 'ready' | 'error' | 'empty';
type AngleClass = 'good' | 'regular' | 'alert';
interface AngleItem { name: string; short: string; value: number; points: string[]; cls: AngleClass }

const classify = (v: number): AngleClass => (v <= 5 ? 'good' : v <= 10 ? 'regular' : 'alert');
const CLASS_TEXT: Record<AngleClass, string> = { good: 'text-status-good', regular: 'text-muted-foreground', alert: 'text-status-alert' };

// Desvio de uma reta em relação à horizontal, em graus (0 a 90), sem depender de qual ponto é esquerdo ou direito.
const tiltFromHorizontal = (a: Keypoint, b: Keypoint) => {
  const deg = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  return Math.round((deg > 90 ? 180 - deg : deg) * 10) / 10;
};

const jointAngle = (p1: Keypoint, p2: Keypoint, p3: Keypoint) => {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!m) return NaN;
  const c = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / m));
  return Math.round((Math.acos(c) * 180) / Math.PI);
};

const CONNECTIONS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
];

// Lê o token do tema ativo (personal ou aluno) para desenhar no canvas.
const tok = (name: string, alpha = 1) =>
  `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()} / ${alpha})`;

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const AnalyticCanvas = ({
  imageUrl,
  keypoints,
  showPlumbLine: initialShowPlumbLine = true,
  showJointMarkers: initialShowJointMarkers = true,
  showAngles: initialShowAngles = true,
  compact = false,
}: AnalyticCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [width, setWidth] = useState(0);
  const [showPlumbLine, setShowPlumbLine] = useState(initialShowPlumbLine);
  const [showJointMarkers, setShowJointMarkers] = useState(initialShowJointMarkers);
  const [showAngles, setShowAngles] = useState(initialShowAngles);
  const [plumbLineX, setPlumbLineX] = useState(50);
  const [zoom, setZoom] = useState(1);

  // Carrega a foto. O bucket é privado: renova a URL assinada antes de usar.
  useEffect(() => {
    let cancelled = false;
    setImage(null);
    if (isPlaceholderUrl(imageUrl)) { setStatus('empty'); return; }
    setStatus('loading');
    (async () => {
      const url = await resolvePhotoUrl(imageUrl);
      if (cancelled) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { if (!cancelled) { setImage(img); setStatus('ready'); } };
      img.onerror = () => { if (!cancelled) setStatus('error'); };
      img.src = url;
    })();
    return () => { cancelled = true; };
  }, [imageUrl, reloadKey]);

  // Acompanha a largura do contêiner.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const angles = useMemo<AngleItem[]>(() => {
    if (keypoints.length < 2) return [];
    const kp = (n: string) => keypoints.find(k => k.name === n);
    const out: AngleItem[] = [];
    // `dev` é o desvio em relação ao ideal (0° para alinhamentos, 180° para o joelho).
    const push = (name: string, short: string, value: number, points: string[], dev = value) => {
      if (Number.isFinite(value)) out.push({ name, short, value, points, cls: classify(dev) });
    };
    const le = kp('left_ear'), re = kp('right_ear');
    if (le && re) push('Inclinação da cabeça', 'Cabeça', tiltFromHorizontal(le, re), ['left_ear', 'right_ear']);
    const ls = kp('left_shoulder'), rs = kp('right_shoulder');
    if (ls && rs) push('Desnível dos ombros', 'Ombros', tiltFromHorizontal(ls, rs), ['left_shoulder', 'right_shoulder']);
    const lh = kp('left_hip'), rh = kp('right_hip');
    if (lh && rh) push('Desnível da pelve', 'Pelve', tiltFromHorizontal(lh, rh), ['left_hip', 'right_hip']);
    const lk = kp('left_knee'), la = kp('left_ankle');
    if (lh && lk && la) push('Ângulo do joelho esquerdo', 'Joelho E', jointAngle(lh, lk, la), ['left_hip', 'left_knee', 'left_ankle'], Math.abs(180 - jointAngle(lh, lk, la)));
    const rk = kp('right_knee'), ra = kp('right_ankle');
    if (rh && rk && ra) push('Ângulo do joelho direito', 'Joelho D', jointAngle(rh, rk, ra), ['right_hip', 'right_knee', 'right_ankle'], Math.abs(180 - jointAngle(rh, rk, ra)));
    return out;
  }, [keypoints]);

  // Desenho. Tudo (foto e sobreposições) usa a mesma transformação, então o zoom mantém o alinhamento.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (status !== 'ready' || !canvas || !ctx || !image || width <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = width;
    const cssH = (width * image.height) / image.width;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cssW / 2, -cssH / 2);
    ctx.drawImage(image, 0, 0, cssW, cssH);

    const px = (n: number) => n / zoom; // espessura e texto constantes na tela
    const sx = cssW / image.width;
    const sy = cssH / image.height;
    ctx.textBaseline = 'middle';

    if (showPlumbLine) {
      const x = (plumbLineX / 100) * cssW;
      ctx.strokeStyle = tok('--muted-foreground', 0.9);
      ctx.lineWidth = px(1.5);
      ctx.setLineDash([px(8), px(5)]);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = tok('--muted-foreground');
      ctx.font = `500 ${px(11)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillText('LINHA DE PRUMO', x + px(6), px(14));
    }

    if (showJointMarkers && keypoints.length > 0) {
      ctx.strokeStyle = tok('--primary');
      ctx.lineWidth = px(2);
      CONNECTIONS.forEach(([a, b]) => {
        const p1 = keypoints.find(k => k.name === a);
        const p2 = keypoints.find(k => k.name === b);
        if (!p1 || !p2) return;
        ctx.beginPath(); ctx.moveTo(p1.x * sx, p1.y * sy); ctx.lineTo(p2.x * sx, p2.y * sy); ctx.stroke();
      });
      keypoints.forEach(k => {
        const dim = (k.confidence ?? 1) < 0.5 ? 0.45 : 1;
        ctx.beginPath(); ctx.arc(k.x * sx, k.y * sy, px(6.5), 0, Math.PI * 2);
        ctx.fillStyle = tok('--background', 0.55 * dim); ctx.fill();
        ctx.beginPath(); ctx.arc(k.x * sx, k.y * sy, px(3.5), 0, Math.PI * 2);
        ctx.fillStyle = tok('--foreground', dim); ctx.fill();
      });
    }

    if (showAngles) {
      angles.forEach((a, i) => {
        const pts = a.points.map(n => keypoints.find(k => k.name === n)).filter((p): p is Keypoint => !!p);
        if (pts.length === 0) return;
        const cx = (pts.reduce((s, p) => s + p.x, 0) / pts.length) * sx;
        const cy = (pts.reduce((s, p) => s + p.y, 0) / pts.length) * sy;
        const label = `${a.short} ${a.value}°`;
        ctx.font = `600 ${px(11)}px "IBM Plex Mono", monospace`;
        const w = ctx.measureText(label).width + px(14);
        const h = px(22);
        const x = Math.min(Math.max(cx + px(14), px(4)), cssW - w - px(4));
        const y = Math.min(Math.max(cy - h / 2 + (i % 2 ? px(16) : -px(16)), px(4)), cssH - h - px(4));
        const color = a.cls === 'good' ? tok('--status-good') : a.cls === 'alert' ? tok('--status-alert') : tok('--foreground');
        ctx.strokeStyle = color; ctx.lineWidth = px(1);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y + h / 2); ctx.stroke();
        roundRect(ctx, x, y, w, h, px(6));
        ctx.fillStyle = tok('--background', 0.88); ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color; ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + h / 2 + px(0.5));
      });
    }
    ctx.restore();
  }, [status, image, width, keypoints, angles, showPlumbLine, showJointMarkers, showAngles, plumbLineX, zoom]);

  const resetView = () => { setZoom(1); setPlumbLineX(50); };

  const stage = (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg border bg-background">
      {status === 'ready' && <canvas ref={canvasRef} className="block w-full h-auto" role="img" aria-label="Foto com sobreposições de prumo, marcadores e ângulos" />}
      {status === 'loading' && (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando a foto…</span>
        </div>
      )}
      {status === 'empty' && (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
          <ImageOff className="h-6 w-6" />
          <p className="text-sm font-medium text-foreground">Sem foto para esta avaliação</p>
          <p className="max-w-xs text-xs">Faça a coleta das fotos para ver prumo, marcadores e ângulos sobre a imagem.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-status-critical" />
          <p className="text-sm font-medium text-foreground">Não foi possível carregar a foto</p>
          <p className="max-w-xs text-xs text-muted-foreground">O link pode ter expirado ou a conexão falhou.</p>
          <Button size="sm" variant="outline" className="h-11" onClick={() => setReloadKey(k => k + 1)}>Tentar de novo</Button>
        </div>
      )}
    </div>
  );

  if (compact) return stage;

  const ready = status === 'ready';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="nine-overline flex items-center gap-2 text-sm text-foreground">
          <Ruler className="h-4 w-4" /> Vista analítica — sobreposições vetoriais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center space-x-2">
            <Switch id="plumb" checked={showPlumbLine} onCheckedChange={setShowPlumbLine} />
            <Label htmlFor="plumb" className="text-sm">Linha de prumo</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="joints" checked={showJointMarkers} onCheckedChange={setShowJointMarkers} />
            <Label htmlFor="joints" className="text-sm">Marcadores</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="angles" checked={showAngles} onCheckedChange={setShowAngles} />
            <Label htmlFor="angles" className="text-sm">Ângulos</Label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Diminuir zoom" disabled={!ready} onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="num w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Aumentar zoom" disabled={!ready} onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Restaurar vista" disabled={!ready} onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showPlumbLine && (
          <div className="flex items-center gap-3">
            <Crosshair className="h-4 w-4 text-muted-foreground" />
            <span className="min-w-[110px] text-sm">Posição do prumo</span>
            <Slider value={[plumbLineX]} onValueChange={([v]) => setPlumbLineX(v)} min={0} max={100} step={1} className="flex-1" disabled={!ready} />
            <span className="num w-10 text-right text-sm">{plumbLineX}%</span>
          </div>
        )}

        {stage}

        {ready && showAngles && angles.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {angles.map(a => (
              <div key={a.name} className="rounded-lg border p-3 text-center">
                <p className="nine-overline">{a.short}</p>
                <p className={`num text-2xl font-semibold ${CLASS_TEXT[a.cls]}`}>{a.value}°</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-foreground" />Ponto anatômico</span>
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-primary" />Linha de postura</span>
          <span className="flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dashed border-muted-foreground" />Linha de prumo</span>
          <span className="flex items-center gap-2"><span className="num rounded border px-1 text-[11px] text-foreground">12°</span>Ângulo medido</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticCanvas;
