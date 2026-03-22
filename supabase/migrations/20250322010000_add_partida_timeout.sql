-- Timeout de partida: quando o cronômetro atinge 10 min sem 12 pontos
-- timeout_at: preenchido quando a partida terminou por timeout (evita processamento duplicado)
ALTER TABLE partida_sessoes ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ;
