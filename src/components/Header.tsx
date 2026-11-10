import { Button } from '@/components/ui/button';
import { Bell, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AiQuotaBadge from '@/components/AiQuotaBadge';

const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-4 min-w-0">
          <Button variant="ghost" size="sm" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-[#2E5A88] truncate">PosturaPro</h1>
            <p className="text-xs md:text-sm text-gray-600 hidden sm:block">Sistema de Análise Postural</p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="ghost" size="sm">
            <Bell className="h-5 w-5" />
          </Button>
          {user && (
            <>
              <AiQuotaBadge />
              <span className="hidden lg:inline text-xs text-gray-500 max-w-[180px] truncate">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sair</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
