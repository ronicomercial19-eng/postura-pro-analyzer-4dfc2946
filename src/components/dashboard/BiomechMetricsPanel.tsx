import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PhotoMetricsOverlay from '@/components/dashboard/PhotoMetricsOverlay';

interface Metric { key: string; value: number; unit: string | null; severity: number }

export const BIOMECH_LABELS: Record<string, { label: string; ideal: string }> = {
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
export const VIEW_LABEL: Record<string, string> = {
  anterior: 'Vista anterior', posterior: 'Vista posterior', lateral_d: 'Lateral direita', lateral_e: 'Lateral esquerda',
};
// Classificação da medida (gravada em `unit`) -> rótulo e cor de status do sistema NINE.
export const BIOMECH_STATUS: Record<string, { text: string; css: string }> = {
  normal: { text: 'Bom', css: 'text-status-good' },
  leve: { text: 'Regular', css: 'text-muted-foreground' },
  significativo: { text: 'Atenção', css: 'text-status-alert' },
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
    if (!mt || !BIOMECH_LABELS[mt[1]]) return;
    (groups[mt[2]] ||= []).push({ id: mt[1], value: m.value, cls: m.unit || 'normal' });
  });
  const views = Object.keys(groups);
  if (views.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="nine-overline text-sm text-foreground">Métricas principais</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ângulos 2D estimados a partir dos pontos do corpo. Referência de triagem; não é diagnóstico.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {views.map(view => (
          <div key={view} className="space-y-2">
            <p className="nine-overline">{VIEW_LABEL[view]}</p>
            {metrics.some(m => m.key.startsWith('keypoint_') && m.key.endsWith(`_${view}`)) && (
              <PhotoMetricsOverlay metrics={metrics} view={view} />
            )}
            <div className="divide-y rounded-lg border">
              {groups[view].map(a => {
                const c = BIOMECH_STATUS[a.cls] || BIOMECH_STATUS.normal;
                const note = sideNote(a.id, a.value);
                return (
                  <div key={a.id} className="grid min-h-[52px] grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium uppercase tracking-wider">{BIOMECH_LABELS[a.id].label}</p>
                      <p className="text-xs text-muted-foreground">ideal {BIOMECH_LABELS[a.id].ideal}{note ? ` · ${note}` : ''}</p>
                    </div>
                    <span className="num text-lg font-semibold">{a.value.toFixed(1)}°</span>
                    <span className={`w-16 text-right text-xs font-semibold uppercase tracking-wider ${c.css}`}>{c.text}</span>
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
