import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Metric { key: string; value: number; unit: string | null; severity: number }

const LABELS: Record<string, { label: string; ideal: string }> = {
  head_tilt: { label: 'Inclinação da cabeça', ideal: '0°' },
  shoulders: { label: 'Ombros (desnível)', ideal: '0°' },
  hips: { label: 'Quadril (desnível)', ideal: '0°' },
  knee_D: { label: 'Joelho direito', ideal: '180°' },
  knee_E: { label: 'Joelho esquerdo', ideal: '180°' },
  trunk: { label: 'Desvio do tronco', ideal: '0°' },
  head_forward: { label: 'Cabeça à frente (vs vertical)', ideal: '0°' },
  trunk_lean: { label: 'Inclinação do tronco', ideal: '0°' },
  knee_side: { label: 'Joelho (perfil)', ideal: '180°' },
};
const VIEW_LABEL: Record<string, string> = {
  anterior: 'Vista anterior', posterior: 'Vista posterior', lateral_d: 'Lateral direita', lateral_e: 'Lateral esquerda',
};
const CLS: Record<string, { text: string; css: string }> = {
  normal: { text: 'Normal', css: 'bg-green-100 text-green-800 border-green-300' },
  leve: { text: 'Leve', css: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  significativo: { text: 'Significativo', css: 'bg-red-100 text-red-800 border-red-300' },
};

function sideNote(id: string, v: number): string {
  if (Math.abs(v) < 0.05) return '';
  if (id === 'head_tilt' || id === 'shoulders' || id === 'hips') return v > 0 ? 'lado direito mais alto' : 'lado esquerdo mais alto';
  if (id === 'trunk') return v > 0 ? 'inclinado p/ direita' : 'inclinado p/ esquerda';
  if (id === 'head_forward' || id === 'trunk_lean') return v > 0 ? 'para a frente' : 'para trás';
  if (id === 'knee_side') return v > 180 ? 'hiperextensão' : v < 180 ? 'fletido' : '';
  return '';
}

const BiomechMetricsPanel = ({ metrics }: { metrics: Metric[] }) => {
  const groups: Record<string, { id: string; value: number; cls: string }[]> = {};
  metrics.forEach(m => {
    const mt = m.key.match(/^angle_(.+)_(anterior|posterior|lateral_d|lateral_e)$/);
    if (!mt || !LABELS[mt[1]]) return;
    (groups[mt[2]] ||= []).push({ id: mt[1], value: m.value, cls: m.unit || 'normal' });
  });
  const views = Object.keys(groups);
  if (views.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Métricas Biomecânicas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ângulos 2D estimados a partir dos pontos do corpo. Referência de triagem; não é diagnóstico.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {views.map(view => (
          <div key={view}>
            <p className="text-xs font-semibold text-muted-foreground mb-1">{VIEW_LABEL[view]}</p>
            <div className="divide-y border rounded-lg">
              {groups[view].map(a => {
                const c = CLS[a.cls] || CLS.normal;
                const note = sideNote(a.id, a.value);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{LABELS[a.id].label}</span>
                      <span className="text-xs text-muted-foreground ml-2">ideal {LABELS[a.id].ideal}{note ? ` · ${note}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{a.value.toFixed(1)}°</span>
                      <Badge className={c.css}>{c.text}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BiomechMetricsPanel;
