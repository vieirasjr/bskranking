-- Garantir colunas de placar em partida_sessoes (se a tabela foi criada sem elas)
ALTER TABLE partida_sessoes ADD COLUMN IF NOT EXISTS team1_points INT NOT NULL DEFAULT 0;
ALTER TABLE partida_sessoes ADD COLUMN IF NOT EXISTS team2_points INT NOT NULL DEFAULT 0;
