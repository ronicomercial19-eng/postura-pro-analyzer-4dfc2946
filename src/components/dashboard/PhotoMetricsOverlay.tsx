import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { drawOverlay, OverlayAngle, OverlayClass } from '@/services/overlayRenderer';

interface Metric { key: string; value: number; unit: string | null }

// URLs assinadas gravadas no banco expiram: renova a partir do caminho do arquivo.
async function freshUrl(url: string): Promise<string> {
  const m = url?.match(/\/object\/sign\/photos\/([^?]+)/);
  if (!m) return url;
  try {
    const { data } = await supabase.storage.from('photos').createSignedUrl(decodeURIComponent(m[1]), 3600);
    return data?.signedUrl || url;
  } catch { return url; }
}

const PhotoMetricsOverlay = ({ metrics, view }: { metrics: Metric[]; view: string }) => {
  const { active } = useActiveAssessment();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const kps = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    metrics.forEach(m => {
      const r = m.key.match(/^keypoint_(.+)_(anterior|posterior|lateral_d|lateral_e)$/);
      if (r && r[2] === view) out[r[1]] = { x: m.value, y: Number(m.unit) || 0 };
    });
    return out;
  }, [metrics, view]);

  const angles = useMemo(() => {
    const out: Record<string, OverlayAngle> = {};
    metrics.forEach(m => {
      const r = m.key.match(/^angle_(.+)_(anterior|posterior|lateral_d|lateral_e)$/);
      if (r && r[2] === view) out[r[1]] = { value: m.value, cls: ((m.unit as OverlayClass) || 'normal') };
    });
    return out;
  }, [metrics, view]);

  useEffect(() => {
    let off = false;
    setBusy(true); setError(''); setImageUrl('');
    (async () => {
      if (!active.assessmentId) { setBusy(false); return; }
      const { data } = await supabase.from('ppa_media_assets' as any).select('image_url').eq('assessment_id', active.assessmentId).eq('view', view).limit(1);
      const url = (data as any[])?.[0]?.image_url;
      if (!url) { if (!off) { setError('Foto desta vista não encontrada.'); setBusy(false); } return; }
      const fresh = await freshUrl(url);
      if (!off) setImageUrl(fresh);
    })();
    return () => { off = true; };
  }, [active.assessmentId, view]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const W = Math.min(img.naturalWidth, 720);
      const s = W / img.naturalWidth;
      const H = Math.round(img.naturalHeight * s);
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);
      drawOverlay(ctx, { view, scale: s, width: W, height: H, kps, angles });
      setBusy(false);
    };
    img.onerror = () => { setError('Não foi possível carregar a foto.'); setBusy(false); };
    img.src = imageUrl;
  }, [imageUrl, kps, angles, view]);

  const download = () => {
    try {
      canvasRef.current?.toBlob(b => {
        if (!b) { toast.error('Não foi possível gerar a imagem.'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `metricas-${view}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    } catch { toast.error('Não foi possível exportar esta imagem (restrição do navegador).'); }
  };

  return (
    <div className="space-y-2">
      {busy && !error && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Gerando imagem com métricas...</div>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <canvas ref={canvasRef} className="w-full max-w-[720px] rounded-lg border" style={{ display: imageUrl && !error ? 'block' : 'none' }} />
      {imageUrl && !error && (
        <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4 mr-2" />Baixar imagem com métricas</Button>
      )}
    </div>
  );
};

export default PhotoMetricsOverlay;
