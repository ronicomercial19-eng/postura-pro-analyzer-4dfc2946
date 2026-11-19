import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Clock } from 'lucide-react';

type Access = { applies: boolean; active?: boolean; plan_status?: string; trial_ends_at?: string };

/** Bloqueia professores com teste grátis expirado e sem plano ativo. */
const TrialGate = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth() as any;
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (supabase.rpc as any)('get_teacher_access').then(({ data, error }: any) => {
      if (error) { setError(error.message); setAccess({ applies: false }); return; }
      setAccess((data as Access) || { applies: false });
    });
  }, [user]);

  if (!access) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!access.applies || access.active) {
    const days = access.plan_status === 'trial' && access.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(access.trial_ends_at).getTime() - Date.now()) / 86400000)) : null;
    return (
      <>
        {error && <div className="bg-destructive/10 text-destructive text-xs text-center py-1">Falha ao verificar plano: {error}</div>}
        {days !== null && <div className="bg-primary/10 text-primary text-xs text-center py-1">Teste grátis: {days} dia(s) restante(s)</div>}
        {children}
      </>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Teste grátis encerrado</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">Seu período de teste de 14 dias terminou. Assine um plano para continuar acessando seus alunos e avaliações.</p>
          <Button variant="outline" className="w-full" onClick={() => signOut?.()}>Sair</Button>
        </CardContent>
      </Card>
    </div>
  );
};
export default TrialGate;
