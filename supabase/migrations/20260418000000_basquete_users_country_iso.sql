-- País de origem do atleta (ISO 3166-1 alpha-2) para exibição no rank global
ALTER TABLE public.basquete_users ADD COLUMN IF NOT EXISTS country_iso TEXT NOT NULL DEFAULT 'BR';

COMMENT ON COLUMN public.basquete_users.country_iso IS 'ISO 3166-1 alpha-2, ex.: BR, US, PT';
