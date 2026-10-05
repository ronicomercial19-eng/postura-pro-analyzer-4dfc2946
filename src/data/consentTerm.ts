// Termo de Consentimento (LGPD). Texto-modelo: recomenda-se revisao por advogado antes do uso comercial.
// O texto EXATO aceito e gravado em ppa_consents.term_snapshot (prova do que foi assinado).

export const TERM_VERSION = '2026-10-v1';

export const TERM_SECTIONS: { title: string; text: string }[] = [
  {
    title: '1. Finalidade',
    text: 'Este termo autoriza a realização de avaliação postural e funcional (fotos, vídeos, medidas e testes) com o objetivo de orientar a prescrição de exercícios e o acompanhamento da evolução pelo profissional responsável.',
  },
  {
    title: '2. Dados coletados',
    text: 'Imagens e vídeos do corpo, medidas corporais, queixas de dor, histórico de lesões e resultados de testes. Parte desses dados é considerada dado pessoal sensível (dado de saúde), tratado conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), art. 11.',
  },
  {
    title: '3. Uso de inteligência artificial',
    text: 'As imagens e medidas são processadas por algoritmos de visão computacional e, para a redação de relatórios, por serviços de inteligência artificial de terceiros. O resultado é um apoio à decisão e é sempre revisado pelo profissional; não constitui diagnóstico médico.',
  },
  {
    title: '4. Compartilhamento',
    text: 'Os dados são acessíveis apenas ao profissional responsável e ao próprio aluno. Não são vendidos nem divulgados a terceiros, exceto aos operadores técnicos necessários ao funcionamento do sistema (hospedagem e processamento).',
  },
  {
    title: '5. Armazenamento e exclusão',
    text: 'Os dados são mantidos enquanto durar o acompanhamento e pelo prazo exigido em lei. O titular pode solicitar a eliminação dos dados, ressalvadas as hipóteses legais de guarda.',
  },
  {
    title: '6. Direitos do titular',
    text: 'O titular pode, a qualquer momento, solicitar acesso, correção, portabilidade e eliminação dos dados, e revogar este consentimento. A revogação não afeta o tratamento já realizado, mas impede novas coletas de imagem.',
  },
  {
    title: '7. Limitações',
    text: 'A avaliação postural por foto é uma triagem e não substitui avaliação médica. Em caso de dor intensa, formigamento, perda de força ou outros sinais de alerta, procure um médico.',
  },
  {
    title: '8. Menores de idade',
    text: 'Para menores de 18 anos, este termo deve ser assinado por pai, mãe ou responsável legal.',
  },
];

export const TERM_TEXT = TERM_SECTIONS.map(s => `${s.title}\n${s.text}`).join('\n\n');

export const CONSENT_SCOPES: { key: string; label: string; required: boolean }[] = [
  { key: 'imagem', label: 'Autorizo a captura de fotos e vídeos do meu corpo para a avaliação.', required: true },
  { key: 'saude', label: 'Autorizo o tratamento dos meus dados de saúde (dor, lesões, medidas e testes).', required: true },
  { key: 'ia', label: 'Estou ciente do uso de inteligência artificial de apoio, revisada pelo profissional.', required: true },
  { key: 'melhoria', label: 'Autorizo o uso anônimo dos dados para melhoria do sistema (opcional).', required: false },
];
