-- Cards compartilháveis do Perfil PRÓ

CREATE TABLE IF NOT EXISTS public.pro_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL,
  basquete_user_id UUID NOT NULL REFERENCES public.basquete_users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.partida_sessoes(id) ON DELETE SET NULL,
  title TEXT,
  share_slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'submitted', 'approved', 'published', 'rejected')),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_cards_auth_id_created_at
  ON public.pro_cards (auth_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_cards_share_slug
  ON public.pro_cards (share_slug);

ALTER TABLE public.pro_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_cards_public_read" ON public.pro_cards;
CREATE POLICY "pro_cards_public_read"
  ON public.pro_cards FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pro_cards_public_insert" ON public.pro_cards;
CREATE POLICY "pro_cards_public_insert"
  ON public.pro_cards FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "pro_cards_public_update" ON public.pro_cards;
CREATE POLICY "pro_cards_public_update"
  ON public.pro_cards FOR UPDATE
  USING (true)
  WITH CHECK (true);
