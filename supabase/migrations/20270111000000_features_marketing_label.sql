-- ============================================================
-- Adiciona rótulo de marketing nas features.
--
-- Quando `marketing_label` está preenchido E a feature está
-- habilitada para o plano (plan_features.enabled = true), o
-- frontend renderiza esse texto como bullet no card do plano
-- (landing page + página de Assinatura).
--
-- Deixe NULL para features internas que não devem aparecer
-- como "vantagem" nos cards de venda.
-- ============================================================

ALTER TABLE public.features
  ADD COLUMN IF NOT EXISTS marketing_label TEXT;

-- Seed de textos de marketing para features existentes.
UPDATE public.features SET marketing_label = 'Gestão de locais'                 WHERE id = 'nav.locais';
UPDATE public.features SET marketing_label = 'Agenda de eventos'                WHERE id = 'nav.eventos';
UPDATE public.features SET marketing_label = 'Torneios com chaveamento'         WHERE id = 'nav.torneios';
UPDATE public.features SET marketing_label = 'Cadastro e gestão de equipes'     WHERE id = 'nav.equipes';

-- Features puramente internas ficam sem marketing_label (NULL)
-- para não aparecerem nos cards:
--   nav.painel, nav.assinatura, action.criar_local,
--   action.criar_torneio, action.criar_equipe
