/** Rótulo e cor de status das avaliações. O valor gravado no banco não muda; só a forma de exibir. */
export const ASSESSMENT_STATUS: Record<string, { label: string; css: string }> = {
  novo: { label: 'Novo', css: 'text-muted-foreground' },
  em_coleta: { label: 'Em coleta', css: 'text-status-alert' },
  analisando: { label: 'Analisando', css: 'text-foreground' },
  pronto: { label: 'Pronto', css: 'text-status-good' },
  plano_gerado: { label: 'Plano gerado', css: 'text-status-good' },
};

export const statusOf = (s: string) =>
  ASSESSMENT_STATUS[s] || { label: s ? s.replace(/_/g, ' ') : '—', css: 'text-muted-foreground' };

export const STATUS_CHIP = 'inline-flex min-w-[96px] items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold';
