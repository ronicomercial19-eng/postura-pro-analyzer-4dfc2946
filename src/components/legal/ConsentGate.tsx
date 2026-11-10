import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';
import { CONSENT_TYPES, LEGAL_VERSION } from '@/lib/legal';

/** Bloqueia o uso até o aceite LGPD da versão vigente estar registrado. */
const ConsentGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<'loading' | 'ok' | 'pending'>('loading');
  const [terms, setTerms] = useState(false);
  const [bio, setBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('user_consents')
        .select('consent_type')
        .eq('user_id', user.id)
        .eq('version', LEGAL_VERSION);
      if (error) { setError(error.message); setState('pending'); return; }
      const have = new Set((data || []).map((r) => r.consent_type));
      setState(CONSENT_TYPES.every((t) => have.has(t)) ? 'ok' : 'pending');
    })();
  }, [user]);

  const accept = async () => {
    if (!user) return;
    setSaving(true); setError('');
    const { error } = await supabase.from('user_consents').upsert(
      CONSENT_TYPES.map((t) => ({ user_id: user.id, consent_type: t, version: LEGAL_VERSION })),
      { onConflict: 'user_id,consent_type,version', ignoreDuplicates: true },
    );
    setSaving(false);
    if (error) setError(`Falha ao registrar consentimento: ${error.message}`);
    else setState('ok');
  };

  if (state === 'ok') return <>{children}</>;
  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Consentimento obrigatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            O Postura Pro processa fotos e vídeos corporais, considerados dados pessoais sensíveis pela LGPD. Para continuar, confirme:
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>Li e aceito os <a href="/termos" target="_blank" className="underline text-primary">Termos de Uso</a> e a <a href="/privacidade" target="_blank" className="underline text-primary">Política de Privacidade</a>.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={bio} onChange={(e) => setBio(e.target.checked)} />
            <span>Autorizo a captura e o processamento de imagens corporais por inteligência artificial para fins de avaliação postural e de movimento.</span>
          </label>
          {error && <p className="text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!terms || !bio || saving} onClick={accept}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aceitar e continuar'}
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sair</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsentGate;
