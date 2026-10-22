CREATE TABLE IF NOT EXISTS public.ppa_live_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joint text NOT NULL CHECK (joint IN ('tornozelo','joelho','quadril','lombar','ombro','cervical')),
  macro_key text NOT NULL UNIQUE,
  name text NOT NULL, risk text NOT NULL,
  flags text[] NOT NULL DEFAULT '{}', myofascial_lines text[] NOT NULL DEFAULT '{}',
  overloaded text[] NOT NULL DEFAULT '{}', inhibited text[] NOT NULL DEFAULT '{}',
  corrective jsonb NOT NULL DEFAULT '[]', cue text NOT NULL, red_flag_note text,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ppa_live_rules TO authenticated;
GRANT ALL ON public.ppa_live_rules TO service_role;
ALTER TABLE public.ppa_live_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_live_rules" ON public.ppa_live_rules FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.ppa_live_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL, student_id uuid NOT NULL, joint text NOT NULL,
  macro_key text NOT NULL REFERENCES public.ppa_live_rules(macro_key),
  source text NOT NULL DEFAULT 'tap' CHECK (source IN ('tap','photo')),
  corrected boolean NOT NULL DEFAULT false, note text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppa_live_corrections TO authenticated;
GRANT ALL ON public.ppa_live_corrections TO service_role;
CREATE INDEX IF NOT EXISTS idx_live_corr_student ON public.ppa_live_corrections (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_corr_teacher ON public.ppa_live_corrections (teacher_id, created_at DESC);
ALTER TABLE public.ppa_live_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_manage_own_live_corrections" ON public.ppa_live_corrections FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.is_teacher(auth.uid()))
  WITH CHECK (teacher_id = auth.uid() AND public.is_teacher(auth.uid()) AND EXISTS (SELECT 1 FROM public.students s WHERE s.teacher_id = auth.uid() AND s.student_id = ppa_live_corrections.student_id));
CREATE POLICY "student_read_own_live_corrections" ON public.ppa_live_corrections FOR SELECT TO authenticated USING (student_id = auth.uid());

INSERT INTO public.ppa_live_rules (joint, macro_key, name, risk, flags, myofascial_lines, overloaded, inhibited, corrective, cue, red_flag_note, sort_order) VALUES
('joelho','valgo_dinamico','Valgo Dinâmico','Sobrecarga de LCA e menisco; dor femoropatelar',ARRAY['DYN01','DYN02'],ARRAY['LL','LE'],ARRAY['Ligamento colateral medial','TFL/banda iliotibial'],ARRAY['Glúteo médio','Arco plantar'],'[{"name":"Mini-band acima da linha patelar","dose":"na próxima série, para forçar abdução reativa"},{"name":"Clamshell (ostra)","dose":"1 série de 15 antes da próxima série"}]','Rasgue o chão com os pés para fora.',NULL,10),
('joelho','varo','Varo','Sobrecarga do compartimento medial e do LCL; dor medial',ARRAY['PEP05'],ARRAY['LL','LSP'],ARRAY['Compartimento lateral do joelho','Banda iliotibial'],ARRAY['Adutores','Glúteo médio'],'[{"name":"Agachamento com bola entre os joelhos","dose":"2 séries de 10 com pausa de 2s"},{"name":"Ativação de adutores em isometria","dose":"3 x 20s"}]','Empurre os joelhos na direção do segundo dedo do pé.',NULL,20),
('joelho','hiperextensao','Hiperextensão','Sobrecarga de cápsula posterior e LCA; perda de controle excêntrico',ARRAY['PEP06'],ARRAY['LSP'],ARRAY['Cápsula posterior','Gastrocnêmio'],ARRAY['Isquiotibiais','Quadríceps (controle)'],'[{"name":"Tempo controlado no fim da extensão","dose":"parar 5° antes do bloqueio"},{"name":"Isométrico de isquiotibiais","dose":"3 x 20s"}]','Não trave o joelho: termine com o joelho macio.',NULL,30),
('joelho','shift_lateral','Shift Lateral','Sobrecarga unilateral de quadril, joelho e lombar',ARRAY['DYN05'],ARRAY['LL','LE'],ARRAY['Lado dominante','Quadrado lombar'],ARRAY['Glúteo do lado oposto'],'[{"name":"Agachamento com carga no lado deficitário","dose":"2 x 8 com espelho"},{"name":"Apoio uni-podal assistido","dose":"3 x 20s por lado"}]','Divida o peso igual entre os dois pés.',NULL,40),
('tornozelo','pronacao_severa','Pronação Severa','Tendinopatia do calcâneo e fascite plantar; valgo compensatório',ARRAY['PEP01','PEP03'],ARRAY['LPA','LL'],ARRAY['Tibial posterior','Fáscia plantar'],ARRAY['Pé curto (intrínsecos)','Fibulares'],'[{"name":"Short foot","dose":"3 x 10 com pausa de 5s"},{"name":"Elevação de calcanhar com bola entre os tornozelos","dose":"2 x 12"}]','Faça um arco com o pé e mantenha o dedão no chão.',NULL,50),
('tornozelo','dorsiflexao_limitada','Dorsiflexão Limitada','Compensação de joelho e quadril no agachamento; calcanhar levanta',ARRAY['DYN03'],ARRAY['LSP'],ARRAY['Sóleo','Gastrocnêmio'],ARRAY['Tibial anterior'],'[{"name":"Mobilização de tornozelo com joelho à parede","dose":"2 x 10 por lado"},{"name":"Calço de 1 a 2 cm sob o calcanhar","dose":"na série de agachamento"}]','Joelho passa por cima do segundo dedo, calcanhar colado no chão.',NULL,60),
('quadril','colapso_pelvico','Colapso Pélvico (Hip Hike)','Compressão lombar baixa; possível dor irradiada; sobrecarga do quadrado lombar',ARRAY['DYN04','PEP19'],ARRAY['LL','LPA'],ARRAY['Quadrado lombar','TFL'],ARRAY['Glúteo médio'],'[{"name":"Ponte lateral (prancha lateral)","dose":"3 x 20s por lado"},{"name":"Abdução em pé com mini-band","dose":"2 x 12 por lado"}]','Mantenha o quadril nivelado, como se carregasse um copo cheio na cintura.','Se houver dor irradiada para a perna ou formigamento, interromper a carga e encaminhar para avaliação.',70),
('quadril','passada_cruzada','Passada Cruzada (Crossover)','Sobrecarga da banda iliotibial e do quadril lateral',ARRAY['DYN05'],ARRAY['LL','LE'],ARRAY['Banda iliotibial','TFL'],ARRAY['Glúteo médio','Adutores (controle)'],'[{"name":"Passada lateral com mini-band","dose":"2 x 10 passos por lado"},{"name":"Corrida sobre linha larga (pés na largura do quadril)","dose":"drill de 30s"}]','Pés na largura do quadril, não pise na mesma linha.',NULL,80),
('quadril','anteversao','Anteversão Pélvica','Sobrecarga lombar por hiperlordose funcional',ARRAY['PEP07','PEP09'],ARRAY['LPA','LSP'],ARRAY['Iliopsoas','Eretores lombares'],ARRAY['Glúteo máximo','Abdominais profundos'],'[{"name":"Dead bug","dose":"2 x 8 por lado"},{"name":"Ponte de glúteo com pausa","dose":"3 x 10"}]','Costelas para baixo e aperte o bumbum no final.',NULL,90),
('lombar','compensacao_lombar','Compensação Lombar no Agachamento (Butt Wink)','Sobrecarga de discos lombares na fase de fundo',ARRAY['DYN03'],ARRAY['LSP','LPA'],ARRAY['Eretores lombares'],ARRAY['Core profundo','Glúteo máximo'],'[{"name":"Agachamento goblet com pausa no fundo","dose":"2 x 6, amplitude até onde a coluna fica neutra"},{"name":"Respiração 90/90","dose":"5 ciclos"}]','Mantenha a coluna longa e desça só até onde conseguir.','Dor lombar com irradiação ou formigamento: interromper a carga e encaminhar.',100),
('ombro','protracao','Protração de Ombros','Sobrecarga do manguito rotador e tensão cervical',ARRAY['PEP12'],ARRAY['LF','LBA'],ARRAY['Peitoral menor','Trapézio superior'],ARRAY['Romboides','Serrátil anterior'],'[{"name":"Retração escapular com elástico","dose":"2 x 15"},{"name":"Wall slide","dose":"2 x 10"}]','Abra o peito e leve as escápulas para o bolso de trás.',NULL,110),
('ombro','elevacao_ombro','Elevação de Ombro','Tensão cervical unilateral e desequilíbrio da cintura escapular',ARRAY['PEP13'],ARRAY['LBA','LE'],ARRAY['Trapézio superior','Elevador da escápula'],ARRAY['Trapézio inferior'],'[{"name":"Depressão escapular em suspensão ou apoio","dose":"2 x 10"},{"name":"Y-raise em decúbito","dose":"2 x 10"}]','Afaste a orelha do ombro e deslize a escápula para baixo.',NULL,120),
('cervical','projecao_cabeca','Projeção Anterior da Cabeça','Sobrecarga cervical posterior e cefaleia tensional',ARRAY['PEP14'],ARRAY['LSP','LF','LBA'],ARRAY['Extensores cervicais','Trapézio superior'],ARRAY['Flexores profundos do pescoço'],'[{"name":"Retração cervical (queixo duplo)","dose":"3 x 10 com pausa de 3s"},{"name":"Flexão craniocervical deitado","dose":"2 x 10"}]','Faça um queixo duplo e alongue a nuca.','Dor cervical com formigamento nos braços ou tontura: interromper e encaminhar.',130)
ON CONFLICT (macro_key) DO NOTHING;