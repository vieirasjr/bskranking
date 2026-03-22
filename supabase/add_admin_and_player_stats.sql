-- Execute no SQL Editor do Supabase
-- Adiciona coluna admin em players e vincula stats ao jogador

ALTER TABLE players ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT false;

-- stats pode ser vinculada ao jogador por player_id (opcional, nome também funciona)
ALTER TABLE stats ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE SET NULL;
