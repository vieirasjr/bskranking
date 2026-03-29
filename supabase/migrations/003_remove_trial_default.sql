-- Migration 003: Remove trial como status padrão
-- Novos tenants começam como 'cancelled' até ativarem um plano

ALTER TABLE public.tenants
  ALTER COLUMN status SET DEFAULT 'cancelled';

-- Garante que trial_ends_at não seja mais gerado automaticamente
ALTER TABLE public.tenants
  ALTER COLUMN trial_ends_at SET DEFAULT NULL;
