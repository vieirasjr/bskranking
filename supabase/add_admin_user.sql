-- Execute no SQL Editor do Supabase para adicionar admin por email
-- Adiciona coluna admin em basquete_users (se não existir)
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT false;

-- Marca vieirajjr@gmail.com como admin (cria ou atualiza o registro)
INSERT INTO basquete_users (email, admin, updated_at)
VALUES ('vieirajjr@gmail.com', true, now())
ON CONFLICT (email) DO UPDATE SET admin = true, updated_at = now();
