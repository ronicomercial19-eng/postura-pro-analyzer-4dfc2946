import { Button } from '@/components/ui/button';
import {
  Users, BarChart3, BookOpen, Scan, Brain, Camera, TrendingUp, LayoutDashboard, Zap, LogOut,
  Video, MessageSquare, Activity, FileText, ListChecks, Flame, Gauge, ClipboardCheck
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Navigation = ({ activeSection, onSectionChange }: NavigationProps) => {
  const { userRole, signOut, user } = useAuth();
  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  const teacherMenu = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'express', label: 'Express', icon: Zap },
    { id: 'clients', label: 'Alunos', icon: Users },
    { id: 'tests-consent', label: 'Testes e Termo', icon: ClipboardCheck },
    { id: 'assessment-wizard', label: 'Avaliação Postura', icon: Scan },
    { id: 'movement-analyser', label: 'Mov. Analyser', icon: Video },
    { id: 'complaint-analyser', label: 'Queixa', icon: MessageSquare },
    { id: 'body-composition', label: 'Composição', icon: Activity },
    { id: 'high-performance', label: 'Alta Performance', icon: Gauge },
    { id: 'results-hud', label: 'Resultados', icon: BarChart3 },
    { id: 'plan-builder', label: 'Plano', icon: Brain },
    { id: 'session-tracker', label: 'Sessões', icon: Camera },
    { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
    { id: 'protocol-library', label: 'Biblioteca', icon: BookOpen },
    { id: 'fitpro-api', label: 'API FitPro', icon: FileText },
  ];

  const studentMenu = [
    { id: 'dashboard', label: 'Meu Painel', icon: LayoutDashboard },
    { id: 'student-report', label: 'Meu Relatório', icon: FileText },
    { id: 'student-stretching', label: 'Meu Plano', icon: Flame },
    { id: 'student-recommendations', label: 'Recomendações', icon: ListChecks },
    { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
  ];

  const menuItems = isTeacher ? teacherMenu : studentMenu;

  return (
    <nav className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
      <div className="mb-6 px-4 py-6 bg-gradient-to-br from-[#2E5A88] to-[#4CAF50] rounded-lg text-white">
        <h2 className="text-xl font-bold mb-1">PosturaPro</h2>
        <p className="text-xs opacity-90">{isTeacher ? 'Modo Professor' : 'Modo Aluno'}</p>
      </div>

      <div className="space-y-1 flex-1">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={activeSection === item.id ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onSectionChange(item.id)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </div>

      <div className="border-t pt-3 mt-3">
        <p className="text-xs text-muted-foreground px-2 truncate mb-2">{user?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;
