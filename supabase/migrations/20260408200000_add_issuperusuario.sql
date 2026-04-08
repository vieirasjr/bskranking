-- Coluna issuperusuario: nível acima de admin, gerencia admins e usuários
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS issuperusuario BOOLEAN NOT NULL DEFAULT false;

-- Definir o superusuário inicial
UPDATE basquete_users SET issuperusuario = true WHERE email = 'vieirajjr@gmail.com';
