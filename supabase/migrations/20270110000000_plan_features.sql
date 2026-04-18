-- ============================================================
-- Feature flags por plano de assinatura
--
-- Permite ao super-admin ativar/desativar funcionalidades
-- específicas para cada plano. Quando `enabled = false` para um
-- par (plan_id, feature_id), o frontend esconde a funcionalidade
-- (botão, item de menu etc.) para usuários daquele plano.
--
-- Estratégia padrão (retrocompatibilidade):
--   Ao criar um novo par (plan_id, feature_id) que NÃO existe
--   em `plan_features`, o frontend trata como HABILITADO. Assim,
--   features novas vêm ligadas por padrão e o admin só precisa
--   inserir uma linha quando quiser DESABILITAR.
-- ============================================================

-- 1. Catálogo de features
CREATE TABLE IF NOT EXISTS public.features (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'nav',
  sort_order   INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Matriz plano × feature
CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_id    TEXT    NOT NULL REFERENCES public.plans(id)    ON DELETE CASCADE,
  feature_id TEXT    NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan ON public.plan_features(plan_id);

-- 3. Seed do catálogo: itens de navegação + ações principais
INSERT INTO public.features (id, label, description, category, sort_order) VALUES
  ('nav.painel',       'Painel',         'Item de menu do dashboard principal',   'nav', 10),
  ('nav.locais',       'Locais',         'Menu e página de gerenciamento de locais', 'nav', 20),
  ('nav.eventos',      'Eventos',        'Menu e página de eventos',              'nav', 30),
  ('nav.torneios',     'Torneios',       'Menu e página de torneios',             'nav', 40),
  ('nav.equipes',      'Minhas Equipes', 'Menu e página de equipes do usuário',   'nav', 50),
  ('nav.assinatura',   'Assinatura',     'Menu e página de assinatura',           'nav', 60),
  ('action.criar_local',    'Criar local',    'Botão de criar novo local',         'action', 110),
  ('action.criar_torneio',  'Criar torneio',  'Botão de criar novo torneio',       'action', 120),
  ('action.criar_equipe',   'Criar equipe',   'Botão de criar nova equipe',        'action', 130)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- 4. Habilita por padrão todas as features em TODOS os planos existentes
--    (mantém o comportamento atual; admin desativa sob demanda)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, true
FROM public.plans p
CROSS JOIN public.features f
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- 5. RLS: leitura pública (frontend precisa ler para esconder itens);
--    escrita apenas via service-role (API admin)
ALTER TABLE public.features      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS features_read_all      ON public.features;
DROP POLICY IF EXISTS plan_features_read_all ON public.plan_features;

CREATE POLICY features_read_all      ON public.features      FOR SELECT USING (true);
CREATE POLICY plan_features_read_all ON public.plan_features FOR SELECT USING (true);
