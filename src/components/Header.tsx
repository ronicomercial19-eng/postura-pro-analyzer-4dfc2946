import { Button } from '@/components/ui/button';
import { Bell, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Header = () => {
  const { user, userRole, signOut } = useAuth();
  const email = user?.email || '';
  const name: string = (user?.user_metadata as any)?.full_name || email.split('@')[0] || '';
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase() || '9';
  const roleLabel = userRole === 'student' ? 'Aluno' : 'Coach';

  return (
    <header className="border-b border-border bg-background px-4 py-4 md:px-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-2xl font-bold uppercase tracking-wide text-primary md:text-3xl">Postura Pro</h1>
            <p className="nine-overline hidden sm:block">Análise postural avançada</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Notificações">
            <Bell className="h-5 w-5" />
          </Button>
          {user && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card font-heading text-sm font-semibold">
                  {initials}
                </div>
                <div className="hidden min-w-0 lg:block">
                  <p className="max-w-[180px] truncate text-sm font-medium leading-tight">{name}</p>
                  <p className="text-xs font-medium leading-tight text-primary">{roleLabel}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden" onClick={signOut} aria-label="Sair">
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
