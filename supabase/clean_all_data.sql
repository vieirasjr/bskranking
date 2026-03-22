-- ============================================
-- LIMPAR TODOS OS DADOS DE TESTE
-- Execute no SQL Editor do Supabase antes de testar com pessoas reais
-- Dashboard > SQL Editor > New query > Cole o conteúdo > Run
-- ============================================

-- 1. Resetar sessão (antes de deletar partidas referenciadas)
UPDATE session SET
  is_started = false,
  started_at = NULL,
  current_partida_sessao_id = NULL,
  timer_seconds = 0,
  timer_running = false,
  timer_last_sync_at = NULL,
  timer_started_once = false
WHERE id = 'current';

-- 2. Deletar todas as sessões de partida
DELETE FROM partida_sessoes;

-- 3. Deletar histórico de partidas
DELETE FROM partidas;

-- 4. Deletar todos os jogadores da fila (waiting, team1, team2)
DELETE FROM players;

-- 5. Deletar todas as estatísticas (pontos, vitórias, bloqueios, roubos)
DELETE FROM stats;

-- Pronto! Sistema zerado para uso com pessoas reais.
