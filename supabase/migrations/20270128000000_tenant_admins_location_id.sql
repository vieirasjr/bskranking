-- ============================================================
-- tenant_admins: vinculo por local.
--
-- Adiciona location_id (NULL = acesso a todos os locais do tenant,
-- mantendo o comportamento dos registros já criados). Permite que
-- o mesmo gestor (auth_id) seja vinculado a múltiplos locais via
-- linhas separadas.
-- ============================================================

ALTER TABLE public.tenant_admins
  ADD COLUMN IF NOT EXISTS location_id UUID NULL REFERENCES public.locations(id) ON DELETE CASCADE;

ALTER TABLE public.tenant_admins
  DROP CONSTRAINT IF EXISTS tenant_admins_tenant_id_auth_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_admins_tenant_auth_location_uniq
  ON public.tenant_admins (tenant_id, auth_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS tenant_admins_location_idx
  ON public.tenant_admins(location_id);
