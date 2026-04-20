-- Solicitações de publicação de card nas redes oficiais do app

CREATE TABLE IF NOT EXISTS public.pro_card_publication_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.pro_cards(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL,
  basquete_user_id UUID NOT NULL REFERENCES public.basquete_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'posted')),
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_card_requests_auth_created
  ON public.pro_card_publication_requests (auth_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_card_requests_card
  ON public.pro_card_publication_requests (card_id);

ALTER TABLE public.pro_card_publication_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_card_requests_public_read" ON public.pro_card_publication_requests;
CREATE POLICY "pro_card_requests_public_read"
  ON public.pro_card_publication_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pro_card_requests_public_insert" ON public.pro_card_publication_requests;
CREATE POLICY "pro_card_requests_public_insert"
  ON public.pro_card_publication_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "pro_card_requests_public_update" ON public.pro_card_publication_requests;
CREATE POLICY "pro_card_requests_public_update"
  ON public.pro_card_publication_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);
