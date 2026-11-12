import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Activity, Zap, ArrowRight, Plus, BarChart3, BookOpen, TrendingUp, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { statusOf, STATUS_CHIP } from '@/lib/assessmentStatus';

interface Props { onNavigate: (view: string) => void; }

interface RecentAssessment {
  id: string;
  status: string;
  created_at: string;
  student_id: string;
  student_name?: string;
}

const Kpi = ({ icon: Icon, value, label }: { icon: React.ElementType; value: number | string; label: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="num text-3xl font-semibold leading-none">{value}</p>
          <p className="nine-overline mt-1">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const Shortcut = ({ title, hint, icon: Icon, onClick }: { title: string; hint: string; icon: React.ElementType; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[72px] items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
    <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
  </button>
);

const TeacherDashboard = ({ onNavigate }: Props) => {
  const { setAssessment } = useActiveAssessment();
  const [stats, setStats] = useState({ students: 0, assessments: 0, active: 0, pending: 0 });
  const [recent, setRecent] = useState<RecentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentsData, error: studentsError } = await supabase.rpc('get_teacher_students', { teacher_id: user.id });
      const students = (studentsData as any[]) || [];
      const studentMap: Record<string, string> = {};
      students.forEach(s => { studentMap[s.student_id] = s.full_name || s.email; });

      const { data: assessData, error: assessError } = await supabase
        .from('ppa_assessments' as any)
        .select('id, status, created_at, student_id')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (studentsError || assessError) throw studentsError || assessError;

      const assessments = (assessData as any[]) || [];
      const enriched = assessments.map(a => ({ ...a, student_name: studentMap[a.student_id] || 'Aluno' }));

      setRecent(enriched);
      setStats({
        students: students.length,
        assessments: assessments.length,
        active: assessments.filter(a => a.status === 'em_coleta' || a.status === 'analisando').length,
        pending: assessments.filter(a => a.status === 'novo').length,
      });
    } catch (e) {
      console.error('TeacherDashboard', e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold">Painel do coach</h2>
          <p className="text-sm text-muted-foreground">Visão geral dos seus alunos e avaliações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={() => onNavigate('express')}>
            <Zap className="mr-2 h-4 w-4" /> Análise express
          </Button>
          <Button className="h-11" onClick={() => onNavigate('clients')}>
            <Plus className="mr-2 h-4 w-4" /> Nova avaliação
          </Button>
        </div>
      </div>

      {failed && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-status-critical" aria-hidden="true" />
              <p className="text-sm">Não foi possível carregar os dados do painel.</p>
            </div>
            <Button variant="outline" className="h-11" onClick={load}>Tentar de novo</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} value={failed ? '—' : stats.students} label="Alunos" />
        <Kpi icon={BarChart3} value={failed ? '—' : stats.assessments} label="Avaliações" />
        <Kpi icon={Activity} value={failed ? '—' : stats.active} label="Em andamento" />
        <Kpi icon={Clock} value={failed ? '—' : stats.pending} label="Pendentes" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Shortcut title="Gerenciar alunos" hint="Vincular e listar" icon={Users} onClick={() => onNavigate('clients')} />
        <Shortcut title="Biblioteca" hint="Protocolos 9FIT" icon={BookOpen} onClick={() => onNavigate('protocol-library')} />
        <Shortcut title="Evolução" hint="Métricas temporais" icon={TrendingUp} onClick={() => onNavigate('progress-dashboard')} />
      </div>

      <Card>
        <CardHeader><CardTitle className="nine-overline text-sm text-foreground">Avaliações recentes</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : failed ? (
            <p className="text-sm text-muted-foreground">Dados indisponíveis no momento.</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda. Comece criando uma nova.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(a => {
                const st = statusOf(a.status);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`${STATUS_CHIP} ${st.css}`}>{st.label}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.student_name}</p>
                        <p className="num text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    {/* O publicar-para-aluno de verdade fica em Resultados, onde o aiReport
                        completo (relatorio, plano, fail-safes) esta disponivel. Aqui so
                        navegamos para o lugar certo, em vez de abrir um modal em branco. */}
                    <Button variant="ghost" className="h-11" onClick={() => {
                      setAssessment(a.id, a.student_id, a.student_name || '');
                      onNavigate(a.status === 'em_coleta' ? 'media-collector' : 'results-hud');
                    }}>
                      Abrir <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDashboard;
