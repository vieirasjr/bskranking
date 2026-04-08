-- ============================================================
-- Migration: Eventos system + max_events on plans
-- ============================================================

-- 1. Add max_events to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_events INT;

UPDATE public.plans SET max_events = 2   WHERE id = 'basico';
UPDATE public.plans SET max_events = 6   WHERE id = 'profissional';
-- enterprise: NULL = ilimitado
UPDATE public.plans SET max_events = NULL WHERE id = 'enterprise';
-- avulso: 1 evento
UPDATE public.plans SET max_events = 1   WHERE id = 'avulso';

-- 2. Recreate eventos table with location_id, modality, and updated types
DROP TABLE IF EXISTS evento_inscricoes CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;

CREATE TABLE public.eventos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  event_date       DATE NOT NULL,
  event_time       TIME,
  type             TEXT NOT NULL CHECK (type IN ('torneio','campeonato','festival')),
  modality         TEXT NOT NULL CHECK (modality IN ('5x5','3x3','1x1')),
  max_participants INT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','in_progress','finished','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.evento_inscricoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id  UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.basquete_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evento_id, user_id)
);

-- 3. RLS open (same pattern as other tables)
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_all" ON public.eventos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "evento_inscricoes_all" ON public.evento_inscricoes FOR ALL USING (true) WITH CHECK (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evento_inscricoes;
