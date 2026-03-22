-- Colunas do cronômetro de partida (usado quando há 10+ jogadores na fila)
-- timer_seconds: valor em segundos exibido (fonte de verdade quando pausado)
-- timer_running: se está contando
-- timer_last_sync_at: quando timer_seconds foi sincronizado (permite computar tempo em tempo real)
-- timer_started_once: se o cronômetro já foi iniciado pelo menos uma vez (desbloqueia atribuição de pontos)

ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_running BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_last_sync_at TIMESTAMPTZ;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_started_once BOOLEAN NOT NULL DEFAULT false;
