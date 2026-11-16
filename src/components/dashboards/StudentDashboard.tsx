import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Activity, TrendingUp, Calendar, CheckCircle, AlertCircle, AlertTriangle, Loader2, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { statusOf, STATUS_CHIP } from '@/lib/assessmentStatus';

interface Props { onNavigate: (view: string) => void; }

const LOG_STYLE: Record<string, string> = { fail: 'text-status-critical', warn: 'text-status-alert', pass: 'text-status-good' };

const StudentDashboard = ({ onNavigate }: Props) => {
  const { setAssessment } = useActiveAssessment();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<any>(null);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [pain, setPain] = useState([0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: assessData, error: assessError } = await supabase
        .from('ppa_assessments' as any)
        .select('id, status, created_at, context')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (assessError) throw assessError;
      if (assessData && (assessData as any[]).length > 0) setLastAssessment((assessData as any[])[0]);

      const { data: planData, error: planError } = await supabase
        .from('ppa_plan_links' as any)
        .select('*')
        .eq('student_id', user.id)
        .eq('active', true)
        .limit(1);
      if (planError) throw planError;
      if (planData && (planData as any[]).length > 0) setActivePlan((planData as any[])[0]);

      const { data: logs, error: logsError } = await supabase
        .from('ppa_monitoring_logs' as any)
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (logsError) throw logsError;
      setRecentLogs((logs as any[]) || []);
    } catch (e) {
      console.error('StudentDashboard', e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('ppa_monitoring_logs' as any).insert({
        student_id: user.id,
        integrity_result: pain[0] > 6 ? 'fail' : pain[0] > 3 ? 'warn' : 'pass',
        tns: pain[0],
        pain_delta: { intensidade: pain[0] },
        notes: 'Check-in diário',
      });
      if (error) throw error;

      toast.success('Check-in registrado!');
      setPain([0]);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const lastStatus = lastAssessment ? statusOf(lastAssessment.status) : null;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Meu painel</h2>
        <p className="text-sm text-muted-foreground">Sua avaliação, plano e progresso</p>
      </div>

      {failed && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-status-critical" aria-hidden="true" />
              <p className="text-sm">Não foi possível carregar seus dados.</p>
            </div>
            <Button variant="outline" className="h-11" onClick={load}>Tentar de novo</Button>
          </CardContent>
        </Card>
      )}

      {/* Check-in diário: a ação principal do aluno */}
      <Card>
        <CardHeader><CardTitle className="nine-overline flex items-center gap-2 text-sm text-foreground"><Heart className="h-4 w-4" /> Check-in de dor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Intensidade da dor hoje: <strong className="num">{pain[0]}/10</strong></Label>
            <Slider value={pain} onValueChange={setPain} max={10} step={1} className="mt-3" />
          </div>
          <Button onClick={handleCheckIn} disabled={submitting} className="h-11">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar check-in
          </Button>
          {pain[0] > 6 && (
            <div className="flex items-start gap-2 rounded-lg border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>Dor alta detectada. Modo SHIELD será ativado. Procure seu professor.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="nine-overline flex items-center gap-2 text-sm text-foreground"><Activity className="h-4 w-4" /> Última avaliação</CardTitle></CardHeader>
        <CardContent>
          {lastAssessment && lastStatus ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className={`${STATUS_CHIP} ${lastStatus.css}`}>{lastStatus.label}</span>
                <p className="num mt-2 text-sm">{new Date(lastAssessment.created_at).toLocaleDateString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">{lastAssessment.context?.objetivo || 'Sem objetivo definido'}</p>
              </div>
              {lastAssessment.status === 'pronto' || lastAssessment.status === 'plano_gerado' ? (
                <Button variant="outline" className="h-11" onClick={() => {
                  setAssessment(lastAssessment.id, '', '');
                  onNavigate('results-hud');
                }}>Ver resultados</Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda. Aguarde seu professor.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="nine-overline flex items-center gap-2 text-sm text-foreground"><Calendar className="h-4 w-4" /> Plano ativo</CardTitle></CardHeader>
        <CardContent>
          {activePlan ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-status-good" /><span className="text-sm">Plano ativo desde <span className="num">{new Date(activePlan.created_at).toLocaleDateString('pt-BR')}</span></span></div>
              <Button variant="outline" className="h-11" onClick={() => onNavigate('session-tracker')}>Iniciar sessão</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum plano ativo no momento.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="nine-overline flex items-center gap-2 text-sm text-foreground"><TrendingUp className="h-4 w-4" /> Histórico recente</CardTitle></CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum check-in registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm">
                  <span className="num">{new Date(log.created_at).toLocaleDateString('pt-BR')}</span>
                  <span className={`${STATUS_CHIP} ${LOG_STYLE[log.integrity_result] || 'text-muted-foreground'}`}>
                    Dor <span className="num ml-1">{log.tns}/10</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;
