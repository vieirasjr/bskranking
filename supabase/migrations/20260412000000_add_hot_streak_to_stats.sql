-- Adiciona campo para rastrear sequência quente (hot streak) dos jogadores.
-- hot_streak_since: timestamp da última atuação com 6+ pontos na partida.
-- Se a diferença para agora for <= 7 dias, o jogador está "on fire" no ranking.
ALTER TABLE public.stats ADD COLUMN IF NOT EXISTS hot_streak_since TIMESTAMPTZ;
