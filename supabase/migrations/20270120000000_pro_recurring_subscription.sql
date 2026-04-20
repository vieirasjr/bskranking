-- Perfil PRO com assinatura recorrente (Mercado Pago PreApproval)

ALTER TABLE public.basquete_users
  ADD COLUMN IF NOT EXISTS pro_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS pro_subscription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_basquete_users_pro_subscription_id
  ON public.basquete_users (pro_subscription_id);
