-- ============================================================
-- Migration: Super Admin Panel
-- Adds is_active to plans, creates system_events table
-- ============================================================

-- 1. Permitir ativar/desativar planos
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Eventos globais publicados pelo super admin
CREATE TABLE IF NOT EXISTS public.system_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  event_date       DATE NOT NULL,
  event_time       TIME,
  type             TEXT NOT NULL DEFAULT 'comunicado'
                   CHECK (type IN ('torneio','campeonato','festival','comunicado')),
  modality         TEXT CHECK (modality IN ('5x5','3x3','1x1')),
  max_participants INT,
  image_url        TEXT,
  website          TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published','cancelled')),
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS — leitura pública, escrita somente via service_role (server.ts)
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_events_read" ON public.system_events FOR SELECT USING (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_events;
