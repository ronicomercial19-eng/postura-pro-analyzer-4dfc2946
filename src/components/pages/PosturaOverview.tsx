import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import AnalyticCanvas from '@/components/dashboard/AnalyticCanvas';
import { BIOMECH_LABELS, BIOMECH_STATUS, VIEW_LABEL } from '@/components/dashboard/BiomechMetricsPanel';

interface Metric { key: string; value: number; unit: string | null; analysis_run_id: string }
interface Photo { image_url: string; view: string }

const ANGLE_RE = /^angle_(.+)_(anterior|posterior|lateral_d|lateral_e)$/;
const KP_RE = /^keypoint_(.+)_(anterior|posterior|lateral_d|lateral_e)$/;
const VIEW_PRIORITY = ['lateral_d', 'lateral_e', 'anterior', 'posterior'];
const RANK: Record<string, number> = { significativo: 0, leve: 1, normal: 2 };

/** Visão geral da avaliação ativa: aluno, foto com sobreposições, métricas e resumo. Só leitura. */
const PosturaOverview = ({ onNavigate }: { onNavigate?: (view: string) => void }) => {
  const { active } = useActiveAssessment();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [summary, setSummary] = useState('');
  const [view, setView] = useState('');

  const load = useCallback(async () => {
    if (!active.assessmentId) return;
    setLoading(true);
    setFailed(false);
    try {
      const runsRes: any = await supabase.from('ppa_analysis_runs' as any).select('id').eq('assessment_id', active.assessmentId).order('created_at', { ascending: false }).limit(10);
      if (runsRes.error) throw runsRes.error;
      const runIds: string[] = (runsRes.data || []).map((r: any) => r.id); // do mais novo para o mais antigo

      const [asmt, media, mets, decs]: any[] = await Promise.all([
        supabase.from('ppa_assessments' as any).select('created_at').eq('id', active.assessmentId).maybeSingle(),
        supabase.from('ppa_media_assets' as any).select('image_url, view').eq('assessment_id', active.assessmentId),
        runIds.length ? supabase.from('ppa_metrics' as any).select('key, value, unit, analysis_run_id').in('analysis_run_id', runIds) : Promise.resolve({ data: [], error: null }),
        runIds.length ? supabase.from('ppa_engine_decisions' as any).select('analysis_run_id, final_decision').in('analysis_run_id', runIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (asmt.error || media.error || mets.error || decs.error) throw new Error('consulta falhou');

      // Para cada chave de métrica vale a leitura da execução mais recente.
      const byKey = new Map<string, Metric>();
      [...(mets.data || [])]
        .sort((a: Metric, b: Metric) => runIds.indexOf(a.analysis_run_id) - runIds.indexOf(b.analysis_run_id))
        .forEach((m: Metric) => { if (!byKey.has(m.key)) byKey.set(m.key, m); });

      const dec = [...(decs.data || [])]
        .sort((a: any, b: any) => runIds.indexOf(a.analysis_run_id) - runIds.indexOf(b.analysis_run_id))
        .find((d: any) => d.final_decision?.clinical_summary || d.final_decision?.diagnosis);

      setAssessmentDate(asmt.data?.created_at ?? null);
      setPhotos((media.data || []) as Photo[]);
      setMetrics(Array.from(byKey.values()));
      setSummary(dec?.final_decision?.clinical_summary || dec?.final_decision?.diagnosis || '');
    } catch (e) {
      console.error('PosturaOverview', e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [active.assessmentId, active.analysisRunId]);

  useEffect(() => {
    setMetrics([]); setPhotos([]); setSummary(''); setAssessmentDate(null); setView('');
    load();
  }, [load]);

  const views = useMemo(() => VIEW_PRIORITY.filter(v => photos.some(p => p.view === v)), [photos]);
  const currentView = view && views.includes(view) ? view : views[0] || photos[0]?.view || '';
  const photo = photos.find(p => p.view === currentView);

  const keypoints = useMemo(
    () => metrics
      .map(m => { const mt = m.key.match(KP_RE); return mt && mt[2] === currentView ? { name: mt[1], x: m.value, y: Number(m.unit) || 0, confidence: 0.9 } : null; })
      .filter((k): k is { name: string; x: number; y: number; confidence: number } => !!k),
    [metrics, currentView],
  );

  const rows = useMemo(() => {
    const out: { id: string; view: string; value: number; cls: string }[] = [];
    metrics.forEach(m => {
      const mt = m.key.match(ANGLE_RE);
      if (mt && BIOMECH_LABELS[mt[1]]) out.push({ id: mt[1], view: mt[2], value: m.value, cls: m.unit || 'normal' });
    });
    return out.sort((a, b) => (RANK[a.cls] ?? 2) - (RANK[b.cls] ?? 2));
  }, [metrics]);

  if (!active.assessmentId) return null;

  const multiView = new Set(rows.map(r => r.view)).size > 1;
  const idade = active.context?.idade;
  const esporte = active.context?.esporte;
  const meta = [idade ? `${idade} anos` : '', esporte].filter(Boolean).join(' • ');
  const dateLabel = assessmentDate
    ? new Date(assessmentDate).toLocaleString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <section aria-label="Visão geral da avaliação" className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="nine-overline">Aluno</p>
            <h2 className="font-heading text-2xl font-bold">{active.studentName || 'Aluno'}</h2>
            {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
            {dateLabel && (
              <p className="mt-3 text-sm">
                <span className="nine-overline mr-2">Avaliação realizada</span>
                <span className="num">{dateLabel}</span>
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-3">
              {rows.slice(0, 3).map(r => {
                const st = BIOMECH_STATUS[r.cls] || BIOMECH_STATUS.normal;
                return (
                  <li key={`${r.id}-${r.view}`}>
                    <p className="nine-overline text-[11px]">{BIOMECH_LABELS[r.id].label}</p>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${st.css}`}>{st.text}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {views.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vista da foto">
              {views.map(v => (
                <Button key={v} role="tab" aria-selected={v === currentView} size="sm" variant={v === currentView ? 'secondary' : 'ghost'} className="h-11 rounded-full px-4" onClick={() => setView(v)}>
                  {VIEW_LABEL[v]}
                </Button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Carregando a avaliação…</span>
            </div>
          ) : failed ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="h-6 w-6 text-status-critical" />
              <p className="text-sm font-medium">Não foi possível carregar a avaliação</p>
              <Button size="sm" variant="outline" className="h-11" onClick={load}>Tentar de novo</Button>
            </div>
          ) : (
            <AnalyticCanvas compact imageUrl={photo?.image_url || ''} keypoints={keypoints} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <p className="nine-overline border-b px-4 py-4 text-sm text-foreground">Métricas principais</p>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Sem medidas ainda. Faça a coleta das fotos e a leitura dos pontos para ver os ângulos aqui.</p>
            ) : (
              <div className="divide-y">
                {rows.slice(0, 5).map(r => {
                  const st = BIOMECH_STATUS[r.cls] || BIOMECH_STATUS.normal;
                  return (
                    <div key={`${r.id}-${r.view}`} className="grid min-h-[52px] grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium uppercase tracking-wider">{BIOMECH_LABELS[r.id].label}</p>
                        {multiView && <p className="text-xs text-muted-foreground">{VIEW_LABEL[r.view]}</p>}
                      </div>
                      <span className="num text-lg font-semibold">{r.value.toFixed(1)}°</span>
                      <span className={`w-16 text-right text-xs font-semibold uppercase tracking-wider ${st.css}`}>{st.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="nine-overline text-sm text-foreground">Resumo da análise</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {summary || 'A análise ainda não foi salva para esta avaliação.'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
        <Button className="h-12 text-sm font-semibold uppercase tracking-wider" onClick={() => onNavigate?.('assessment-wizard')}>
          <Plus className="h-5 w-5" /> Nova avaliação
        </Button>
        <Button variant="outline" className="h-12 border-primary text-sm font-semibold uppercase tracking-wider text-primary hover:bg-primary/10 hover:text-primary" onClick={() => onNavigate?.('progress-dashboard')}>
          <TrendingUp className="h-5 w-5" /> Comparar evolução
        </Button>
      </div>
    </section>
  );
};

export default PosturaOverview;
