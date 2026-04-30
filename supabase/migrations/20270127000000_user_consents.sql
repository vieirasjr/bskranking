-- Registro de aceite dos Termos de Uso, Privacidade e Compartilhamento de Dados (LGPD).
-- Mantém histórico por versão para que, ao atualizar o termo, possamos exigir novo aceite.

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL,
  email TEXT,
  consent_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  CONSTRAINT user_consents_unique_user_version UNIQUE (auth_id, consent_version)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_auth ON public.user_consents (auth_id);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Cada usuário lê apenas seus próprios consentimentos
DROP POLICY IF EXISTS "user_consents_select_self" ON public.user_consents;
CREATE POLICY "user_consents_select_self"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = auth_id);

-- Cada usuário insere apenas o próprio aceite (auth_id obrigatoriamente == auth.uid())
DROP POLICY IF EXISTS "user_consents_insert_self" ON public.user_consents;
CREATE POLICY "user_consents_insert_self"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

COMMENT ON TABLE public.user_consents IS
  'Aceite de Termos de Uso, Privacidade e Compartilhamento (LGPD). Uma linha por (auth_id, consent_version).';
