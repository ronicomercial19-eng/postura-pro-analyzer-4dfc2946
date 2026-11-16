import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type NinePersona = 'personal' | 'aluno';

/** Aplica o tema da persona na raiz: professor/admin = personal (escuro), aluno = marinho. */
export const useNineTheme = (): NinePersona => {
  const { userRole } = useAuth();
  const persona: NinePersona = userRole === 'student' ? 'aluno' : 'personal';

  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove('tema-personal', 'tema-aluno');
    el.classList.add(`tema-${persona}`);
  }, [persona]);

  return persona;
};
