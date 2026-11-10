import { Link } from 'react-router-dom';
import { LEGAL_VERSION } from '@/lib/legal';

const COMPANY = '[RAZÃO SOCIAL / CNPJ — preencher]';
const CONTACT = '[e-mail do encarregado (DPO) — preencher]';

const terms = [
  ['Objeto', 'O Postura Pro Analyser é uma ferramenta de apoio à avaliação postural e de movimento destinada a profissionais de educação física e saúde. Os resultados são auxiliares e não substituem diagnóstico médico.'],
  ['Contas', 'O profissional é responsável pelas credenciais, pelos alunos que cadastra e por obter o consentimento deles antes de capturar imagens.'],
  ['Planos e limites', 'Cada plano possui limite mensal de análises por IA. Ao atingir o limite, novas análises ficam bloqueadas até o próximo ciclo ou upgrade.'],
  ['Uso aceitável', 'É proibido enviar imagens de terceiros sem autorização, de menores sem consentimento do responsável legal, ou conteúdo não relacionado à avaliação.'],
  ['Responsabilidade', 'Prescrições geradas devem ser revisadas pelo profissional. Sinais de alerta (dor > 3/10, formigamento, edema) exigem encaminhamento médico.'],
  ['Cancelamento', 'O usuário pode cancelar a qualquer momento e solicitar a exclusão dos dados conforme a Política de Privacidade.'],
];

const privacy = [
  ['Dados coletados', 'Nome, e-mail, papel (professor/aluno), dados antropométricos, queixas, fotos e vídeos corporais, pontos anatômicos estimados e relatórios.'],
  ['Dados sensíveis (LGPD art. 11)', 'Imagens corporais e informações de saúde são tratadas com base no consentimento específico e destacado do titular, exclusivamente para avaliação postural e de movimento.'],
  ['Processamento por IA', 'Imagens são analisadas por modelos de IA para estimativa de pose e geração de relatório. As imagens não são usadas para treinar modelos de terceiros.'],
  ['Armazenamento e segurança', 'Dados ficam em infraestrutura com criptografia em trânsito (HTTPS) e controle de acesso por usuário: cada professor acessa apenas os próprios alunos.'],
  ['Retenção', 'Os dados são mantidos enquanto a conta estiver ativa. Após pedido de exclusão, fotos e registros são removidos em até 15 dias, salvo obrigação legal.'],
  ['Direitos do titular', `Acesso, correção, portabilidade, revogação do consentimento e exclusão podem ser solicitados pelo contato: ${CONTACT}.`],
];

const LegalPage = ({ kind }: { kind: 'termos' | 'privacidade' }) => {
  const items = kind === 'termos' ? terms : privacy;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <Link to="/" className="text-sm text-primary underline">← Voltar</Link>
        <h1 className="text-3xl font-bold">{kind === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}</h1>
        <p className="text-sm text-muted-foreground">Versão {LEGAL_VERSION} · Controlador: {COMPANY}</p>
        {items.map(([h, t], i) => (
          <section key={h} className="space-y-1">
            <h2 className="text-lg font-semibold">{i + 1}. {h}</h2>
            <p className="text-muted-foreground leading-relaxed">{t}</p>
          </section>
        ))}
      </article>
    </main>
  );
};

export default LegalPage;
