import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, Zap, ArrowRight, Plus, BarChart3, BookOpen, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';

interface Props { onNavigate: (view: string) => void; }

interface RecentAssessment {
  id: string;
  status: string;
  created_at: string;
  student_id: string;
  student_name?: string;
}

const TeacherDashboard = ({ onNavigate }: Props) => {
  const { setAssessment } = useActiveAssessment();
  const [stats, setStats] = useState({ students: 0, assessments: 0, active: 0, pending: 0 });
  const [recent, setRecent] = useState<RecentAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentsData } = await supabase.rpc('get_teacher_students', { teacher_id: user.id });
      const students = (studentsData as any[]) || [];
      const studentMap: Record<string, string> = {};
      students.forEach(s => { studentMap[s.student_id] = s.full_name || s.email; });

      const { data: assessData } = await supabase
        .from('ppa_assessments' as any)
        .select('id, status, created_at, student_id')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const assessments = (assessData as any[]) || [];
      const enriched = assessments.map(a => ({ ...a, student_name: studentMap[a.student_id] || 'Aluno' }));

      setRecent(enriched);
      setStats({
        students: students.length,
        assessments: assessments.length,
        active: assessments.filter(a => a.status === 'em_coleta' || a.status === 'analisando').length,
        pending: assessments.filter(a => a.status === 'novo').length,
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: string) => ({
    pronto: 'bg-green-100 text-green-800',
    analisando: 'bg-blue-100 text-blue-800',
    em_coleta: 'bg-yellow-100 text-yellow-800',
    plano_gerado: 'bg-purple-100 text-purple-800',
  } as any)[s] || 'bg-muted text-muted-foreground';

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel do Professor</h1>
          <p className="text-muted-foreground text-sm">Visão geral dos seus alunos e avaliações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate('express')}>
            <Zap className="h-4 w-4 mr-2" /> Análise Express
          </Button>
          <Button onClick={() => onNavigate('clients')}>
            <Plus className="h-4 w-4 mr-2" /> Nova Avaliação
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.students}</p><p className="text-xs text-muted-foreground">Alunos</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats.assessments}</p><p className="text-xs text-muted-foreground">Avaliações</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Activity className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{stats.active}</p><p className="text-xs text-muted-foreground">Em andamento</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pendentes</p></div></div></CardContent></Card>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('clients')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">Gerenciar Alunos</p><p className="text-xs text-muted-foreground">Vincular e listar</p></div>
            <Users className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('protocol-library')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">Biblioteca</p><p className="text-xs text-muted-foreground">Protocolos 9FIT</p></div>
            <BookOpen className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('progress-dashboard')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="font-medium">Evolução</p><p className="text-xs text-muted-foreground">Métricas temporais</p></div>
            <TrendingUp className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Avaliações recentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Avaliações Recentes</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda. Comece criando uma nova.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Badge className={statusColor(a.status)}>{a.status}</Badge>
                    <div>
                      <p className="text-sm font-medium">{a.student_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* O publicar-para-aluno de verdade fica em Resultados, onde o aiReport
                        completo (relatorio, plano, fail-safes) esta disponivel. Aqui so
                        navegamos para o lugar certo, em vez de abrir um modal em branco. */}
                    <Button variant="ghost" size="sm" onClick={() => {
                      setAssessment(a.id, a.student_id, a.student_name || '');
                      onNavigate(a.status === 'em_coleta' ? 'media-collector' : 'results-hud');
                    }}>
                      Abrir <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDashboard;
