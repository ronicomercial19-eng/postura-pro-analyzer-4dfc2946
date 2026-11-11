import { LayoutDashboard, TrendingUp, Zap, Users, Video, FileText, ListChecks, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const BottomNavigation = ({ currentView, onViewChange }: BottomNavigationProps) => {
  const { userRole } = useAuth();
  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  const teacherItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'express', label: 'Express', icon: Zap },
    { id: 'movement-analyser', label: 'Movimento', icon: Video },
    { id: 'clients', label: 'Alunos', icon: Users },
    { id: 'tests-consent', label: 'Termo', icon: ClipboardCheck },
    { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
  ];

  const studentItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'student-report', label: 'Relatório', icon: FileText },
    { id: 'student-recommendations', label: 'Dicas', icon: ListChecks },
    { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
  ];

  const navItems = isTeacher ? teacherItems : studentItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navegação principal">
      <div className="flex items-stretch justify-around">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className={`max-w-full truncate text-xs ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
