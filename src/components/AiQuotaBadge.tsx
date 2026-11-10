import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

/** Saldo mensal de análises de IA do usuário logado. */
const AiQuotaBadge = () => {
  const [q, setQ] = useState<{ used: number; limit: number } | null>(null);
  useEffect(() => {
    // RPC fora dos tipos gerados (adapter mínimo).
    (supabase.rpc as any)('get_my_ai_quota').then(({ data }: any) => data && setQ(data));
  }, []);
  if (!q) return null;
  const over = q.used >= q.limit;
  return (
    <Badge variant={over ? 'destructive' : 'outline'} className="gap-1" title="Análises de IA usadas neste mês">
      <Sparkles className="h-3 w-3" /> IA {q.used}/{q.limit}
    </Badge>
  );
};

export default AiQuotaBadge;
