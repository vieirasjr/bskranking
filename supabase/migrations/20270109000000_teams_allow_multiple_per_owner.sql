-- ============================================================
-- Permitir que o admin crie múltiplas equipes no mesmo torneio
-- (para testes e para sorteios presenciais onde o admin cadastra).
-- A regra de "1 equipe por atleta no torneio" passa a ser reforçada
-- apenas no cliente durante inscrição pública.
-- ============================================================

DROP INDEX IF EXISTS public.teams_tournament_owner_unique;
