-- Execute no SQL Editor do Supabase
-- user_id em players (nullable: visitantes e admin adiciona por nome) e stats (ranking só cadastrados)

ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES basquete_users(id) ON DELETE CASCADE;
ALTER TABLE stats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES basquete_users(id) ON DELETE SET NULL;
ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;
