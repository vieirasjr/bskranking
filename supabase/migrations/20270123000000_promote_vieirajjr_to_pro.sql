-- Ativa Perfil PRÓ para usuário específico solicitado

UPDATE public.basquete_users
SET
  is_pro = true,
  pro_subscription_status = 'authorized',
  updated_at = now()
WHERE lower(email) = lower('vieirajjr@gmail.com');
