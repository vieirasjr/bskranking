-- Perfil PRO: preço mensal e campos avançados do atleta

ALTER TABLE public.basquete_users
  ADD COLUMN IF NOT EXISTS pro_cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS pro_profile_tagline TEXT,
  ADD COLUMN IF NOT EXISTS pro_athlete_resume TEXT,
  ADD COLUMN IF NOT EXISTS pro_sponsors JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.products
SET
  price_brl = 990,
  description = 'Assinatura mensal Perfil PRO: perfil customizado, currículo integrado, 50% OFF em camps, 50% OFF em uniformes e 2 fotos profissionais por evento.',
  updated_at = now()
WHERE category = 'perfil_pro';
