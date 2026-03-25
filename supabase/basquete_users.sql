-- ============================================
-- Tabela basquete_users + RLS + colunas do app
-- Execute no Supabase: SQL Editor > New query > Run
-- ============================================

CREATE TABLE IF NOT EXISTS public.basquete_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_id uuid NULL,
  email text NOT NULL,
  display_name text NULL,
  avatar_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT basquete_users_pkey PRIMARY KEY (id),
  CONSTRAINT basquete_users_email_key UNIQUE (email),
  CONSTRAINT basquete_users_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Colunas usadas pelo app (perfil de atleta e admin)
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS height_cm integer;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS weight_kg integer;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS dominant_hand text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS jersey_number integer;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS admin boolean NOT NULL DEFAULT false;

-- Índice para busca por auth (login)
CREATE INDEX IF NOT EXISTS basquete_users_auth_id_idx ON public.basquete_users (auth_id);

-- RLS: o cliente usa a chave anon com JWT do usuário logado
ALTER TABLE public.basquete_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em basquete_users" ON public.basquete_users;
CREATE POLICY "Permitir tudo em basquete_users"
  ON public.basquete_users
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
