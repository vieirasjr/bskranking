-- ============================================================
-- tenant_admins: co-administradores indicados pelo dono do tenant.
--
-- Máximo 2 por tenant. Podem iniciar/gerenciar/encerrar sessões,
-- pontuar e corrigir stats. NÃO têm acesso ao painel de gestão
-- (dashboard) — apenas o owner_auth_id do tenant tem.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_id    UUID NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, auth_id)
);

CREATE INDEX IF NOT EXISTS tenant_admins_tenant_idx ON public.tenant_admins(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_admins_auth_idx   ON public.tenant_admins(auth_id);

ALTER TABLE public.tenant_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admins_public_read"   ON public.tenant_admins FOR SELECT USING (true);
CREATE POLICY "tenant_admins_owner_manage"  ON public.tenant_admins FOR ALL
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_auth_id = auth.uid())
  );
