-- ============================================================
-- Migration: Produtos para venda + Perfil PRO
-- ============================================================

-- 1. Flag "is_pro" no perfil do atleta
ALTER TABLE public.basquete_users
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;

-- 2. Tabela de produtos
CREATE TABLE IF NOT EXISTS public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  price_brl       INT NOT NULL,            -- centavos: 5000 = R$50
  image_url       TEXT,
  category        TEXT NOT NULL DEFAULT 'geral'
                  CHECK (category IN ('geral', 'vestuario', 'acessorio', 'servico', 'perfil_pro')),
  is_pro_exclusive BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  stock           INT,                     -- NULL = ilimitado
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos visíveis para todos"
  ON public.products FOR SELECT USING (true);

-- Produto padrão: Perfil PRO
INSERT INTO public.products (id, name, description, price_brl, category, is_pro_exclusive, stock)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Perfil PRO',
  'Perfil profissional com card exclusivo, fotografia profissional e compartilhamento direto no Instagram.',
  2990,
  'perfil_pro',
  false,
  NULL
) ON CONFLICT (id) DO NOTHING;
