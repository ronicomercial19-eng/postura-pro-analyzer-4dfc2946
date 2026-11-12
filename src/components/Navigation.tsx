import {
  Users, BarChart3, BookOpen, Scan, Brain, Camera, TrendingUp, LayoutDashboard, Zap, LogOut,
  Video, MessageSquare, Activity, FileText, ListChecks, Flame, Gauge, ClipboardCheck, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import NineSeal from '@/components/nine/NineSeal';

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface NavItem { id: string; label: string; icon: React.ElementType }
interface NavGroup { title?: string; items: NavItem[] }

const Navigation = ({ activeSection, onSectionChange }: NavigationProps) => {
  const { userRole, signOut, user } = useAuth();
  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  // Mesmos ids de antes. Só a apresentação mudou: itens agrupados por tipo de trabalho.
  const teacherGroups: NavGroup[] = [
    { items: [{ id: 'dashboard', label: 'Painel', icon: LayoutDashboard }] },
    {
      title: 'Avaliar',
      items: [
        { id: 'express', label: 'Express', icon: Zap },
        { id: 'tests-consent', label: 'Testes e termo', icon: ClipboardCheck },
        { id: 'assessment-wizard', label: 'Avaliação postural', icon: Scan },
        { id: 'movement-analyser', label: 'Movimento', icon: Video },
        { id: 'complaint-analyser', label: 'Queixa', icon: MessageSquare },
        { id: 'body-composition', label: 'Composição', icon: Activity },
        { id: 'high-performance', label: 'Alta performance', icon: Gauge },
      ],
    },
    {
      title: 'Analisar',
      items: [
        { id: 'results-hud', label: 'Resultados', icon: BarChart3 },
        { id: 'plan-builder', label: 'Plano', icon: Brain },
        { id: 'session-tracker', label: 'Sessões', icon: Camera },
        { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
      ],
    },
    {
      title: 'Gestão',
      items: [
        { id: 'clients', label: 'Alunos', icon: Users },
        { id: 'protocol-library', label: 'Biblioteca', icon: BookOpen },
        { id: 'fitpro-api', label: 'API FitPro', icon: FileText },
      ],
    },
  ];

  const studentGroups: NavGroup[] = [
    {
      items: [
        { id: 'dashboard', label: 'Meu painel', icon: LayoutDashboard },
        { id: 'student-report', label: 'Meu relatório', icon: FileText },
        { id: 'student-stretching', label: 'Meu plano', icon: Flame },
        { id: 'student-recommendations', label: 'Recomendações', icon: ListChecks },
        { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
      ],
    },
  ];

  const groups = isTeacher ? teacherGroups : studentGroups;

  return (
    <nav className="flex min-h-screen w-64 flex-col border-r border-border bg-background p-4" aria-label="Navegação principal">
      <div className="mb-6 px-2 pt-2">
        <NineSeal />
        <p className="nine-overline mt-3 text-[11px]">{isTeacher ? 'Plataforma do coach' : 'Seu acompanhamento'}</p>
      </div>

      <div className="flex-1 space-y-1">
        {groups.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.title && <p className="nine-overline px-3 pb-1 pt-4 text-[11px]">{group.title}</p>}
            {group.items.map(item => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[13px] font-medium uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-secondary text-foreground before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-primary before:content-['']"
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : ''}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-3 px-2">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-semibold uppercase tracking-wider">{isTeacher ? 'Coach' : 'Aluno'}</p>
            <p className="truncate text-xs text-muted-foreground">{isTeacher ? 'Plataforma exclusiva' : user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" className="h-11 w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;
