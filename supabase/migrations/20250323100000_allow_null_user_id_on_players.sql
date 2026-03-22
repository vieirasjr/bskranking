-- Permite user_id nulo em players (admin pode adicionar por nome quem não está com celular)
-- Se a migration anterior já tinha NOT NULL, remove aqui
ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;
