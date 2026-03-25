-- Execute no SQL Editor do Supabase
ALTER TABLE stats
ADD COLUMN IF NOT EXISTS partidas INT NOT NULL DEFAULT 0;
