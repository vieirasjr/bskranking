-- Colunas de placar na sessão de partida (para atualização em tempo real)
ALTER TABLE partida_sessoes ADD COLUMN IF NOT EXISTS team1_points INT NOT NULL DEFAULT 0;
ALTER TABLE partida_sessoes ADD COLUMN IF NOT EXISTS team2_points INT NOT NULL DEFAULT 0;
