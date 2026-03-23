-- Execute no SQL Editor do Supabase
-- Garante que a tabela session tenha todas as colunas do cronômetro
-- (corrige erro 400 ao atingir 12 pontos e iniciar substituição)

ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_running BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_last_sync_at TIMESTAMPTZ;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_started_once BOOLEAN NOT NULL DEFAULT false;
