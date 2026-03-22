-- Execute no SQL Editor do Supabase para remover TODOS os dados fictícios
-- IMPORTANTE: Remove jogadores E estatísticas - senão os stats voltam quando partidas rodam

-- 1. Reseta a sessão de partida
UPDATE session SET
  is_started = false,
  started_at = NULL,
  current_partida_sessao_id = NULL,
  timer_seconds = 0,
  timer_running = false,
  timer_last_sync_at = NULL,
  timer_started_once = false
WHERE id = 'current';

-- 2. Remove sessões de partida
DELETE FROM partida_sessoes;

-- 3. Remove TODOS os jogadores da fila
DELETE FROM players;

-- 4. Remove TODAS as estatísticas do ranking
DELETE FROM stats;
