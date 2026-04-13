-- Locais privados com whitelist por email.
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS authorized_emails text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.locations.is_private IS
  'Se true, o local aparece na vitrine com tag restrito e so aceita acesso para emails autorizados.';
COMMENT ON COLUMN public.locations.authorized_emails IS
  'Lista de emails autorizados (minusculo), configurada pelo gestor.';
