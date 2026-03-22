-- Coluna admin em basquete_users e registro do primeiro admin
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT false;

-- Adiciona vieirajjr@gmail.com como admin (cria se não existir, atualiza se existir)
INSERT INTO basquete_users (email, admin, updated_at)
VALUES ('vieirajjr@gmail.com', true, now())
ON CONFLICT (email) DO UPDATE SET admin = true, updated_at = now();
