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
    { id: 'movement-analyser', label: 'Movim.', icon: Video },
    { id: 'clients', label: 'Alunos', icon: Users },
    { id: 'tests-consent', label: 'Termo', icon: ClipboardCheck },
    { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
  ];

  const studentItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'student-report', label: 'Relatório', icon: FileText },
    { id: 'student-recommendations', label: 'Recom.', icon: ListChecks },
    { id: 'progress-dashboard', label: 'Evolução', icon: TrendingUp },
  ];

  const navItems = isTeacher ? teacherItems : studentItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center justify-center p-1.5 min-w-0 flex-1 transition-colors ${
                isActive ? 'text-[#2E5A88]' : 'text-gray-500'
              }`}
            >
              <Icon className={`h-5 w-5 mb-0.5 ${isActive ? 'text-[#2E5A88]' : 'text-gray-500'}`} />
              <span className={`text-[10px] truncate ${isActive ? 'text-[#2E5A88] font-medium' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;
