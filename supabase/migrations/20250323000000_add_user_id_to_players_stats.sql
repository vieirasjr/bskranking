-- user_id em players e stats (basquete_users.id)
-- players: nullable - admin pode adicionar por nome quem não está com celular
-- stats: nullable - ranking mostra apenas os com user_id
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES basquete_users(id) ON DELETE CASCADE;
ALTER TABLE stats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES basquete_users(id) ON DELETE SET NULL;
