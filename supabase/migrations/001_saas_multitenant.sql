-- ============================================================
-- Migration 001: SaaS Multi-Tenant
-- Executa no Supabase SQL Editor na ordem abaixo
-- ============================================================

-- ── 1. PLANS (seed fixo) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price_brl     INT  NOT NULL,   -- centavos: 10000 = R$100
  max_players   INT,             -- NULL = ilimitado
  max_locations INT,             -- NULL = ilimitado
  created_at    TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.plans (id, name, price_brl, max_players, max_locations) VALUES
  ('basico',       'Básico',       10000,  30,   1),
  ('profissional', 'Profissional', 15000,  60,   2),
  ('enterprise',   'Enterprise',   20000,  NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── 2. TENANTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_auth_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id               TEXT NOT NULL REFERENCES public.plans(id),
  name                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'trial'
                        CHECK (status IN ('trial','active','past_due','cancelled')),
  trial_ends_at         TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  current_period_ends_at TIMESTAMPTZ,
  mp_subscription_id    TEXT,
  mp_payer_id           TEXT,
  mp_preference_id      TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_owner_idx ON public.tenants(owner_auth_id);

-- ── 3. LOCATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  radius_m    INT NOT NULL DEFAULT 50,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT slug_unique UNIQUE (slug),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- ── 4. SUBSCRIPTION EVENTS (log de webhooks MP) ───────────
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  mp_payment_id   TEXT,
  mp_subscription_id TEXT,
  mp_status       TEXT,
  mp_type         TEXT,
  raw_payload     JSONB,
  processed_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Adicionar location_id nas tabelas existentes ────────
ALTER TABLE public.players         ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.stats           ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.session         ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.partida_sessoes ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;

-- Índices de performance
CREATE INDEX IF NOT EXISTS players_location_idx         ON public.players(location_id);
CREATE INDEX IF NOT EXISTS stats_location_idx           ON public.stats(location_id);
CREATE INDEX IF NOT EXISTS session_location_idx         ON public.session(location_id);
CREATE INDEX IF NOT EXISTS partida_sessoes_location_idx ON public.partida_sessoes(location_id);

-- ── 6. RLS ────────────────────────────────────────────────
ALTER TABLE public.plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- PLANS: leitura pública
DROP POLICY IF EXISTS "plans_read" ON public.plans;
CREATE POLICY "plans_read" ON public.plans FOR SELECT USING (true);

-- TENANTS: owner vê/edita apenas o seu
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT
  USING (owner_auth_id = auth.uid());
CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT
  WITH CHECK (owner_auth_id = auth.uid());
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE
  USING (owner_auth_id = auth.uid());

-- LOCATIONS: leitura pública (para /:slug funcionar sem login)
--            escrita apenas pelo dono do tenant
DROP POLICY IF EXISTS "locations_read" ON public.locations;
DROP POLICY IF EXISTS "locations_write" ON public.locations;
CREATE POLICY "locations_read" ON public.locations FOR SELECT USING (true);
CREATE POLICY "locations_write" ON public.locations FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants WHERE owner_auth_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.tenants WHERE owner_auth_id = auth.uid()
    )
  );

-- SUBSCRIPTION_EVENTS: somente service_role (webhook backend)
-- Nenhuma policy de usuário — acesso via service_role key no server.ts

-- ── 7. Migração dos dados existentes ──────────────────────
-- Execute APÓS criar o primeiro tenant/location via dashboard.
-- Exemplo (substitua <LOCATION_UUID> pelo UUID do local criado):
--
-- UPDATE public.players         SET location_id = '<LOCATION_UUID>' WHERE location_id IS NULL;
-- UPDATE public.stats           SET location_id = '<LOCATION_UUID>' WHERE location_id IS NULL;
-- UPDATE public.partida_sessoes SET location_id = '<LOCATION_UUID>' WHERE location_id IS NULL;
-- UPDATE public.session         SET location_id = '<LOCATION_UUID>' WHERE location_id IS NULL;
