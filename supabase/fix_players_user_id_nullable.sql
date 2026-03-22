-- Execute no SQL Editor do Supabase para permitir jogadores sem cadastro (visitantes, admin adiciona por nome)
ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;
