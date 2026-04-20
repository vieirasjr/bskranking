-- ============================================================
-- Corrige conflito de overload da função increment_stats.
--
-- A migration 20270113 criou a função com 11 parâmetros. A 20270114
-- tentou REPLACE com 15 (adicionando miss columns), mas como
-- CREATE OR REPLACE só substitui quando a assinatura é IDÊNTICA,
-- o Postgres criou uma NOVA função como overload, deixando as duas
-- coexistindo. Chamadas RPC do cliente passaram a falhar com
-- "function is not unique" porque os nomes de parâmetros enviados
-- casam com ambas as assinaturas.
--
-- Solução: dropar a versão antiga (11 params), mantendo só a nova
-- com suporte aos deltas de erros.
-- ============================================================

DROP FUNCTION IF EXISTS public.increment_stats(
  UUID, UUID, TEXT, INT, INT, INT, INT, INT, INT, INT, INT
);
