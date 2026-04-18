-- ============================================================
-- Migration: Restringir criação de torneios aos planos premium
-- Apenas planos "profissional" (R$150) e "enterprise" (R$200) podem
-- criar torneios.
-- ============================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS can_create_tournaments BOOLEAN NOT NULL DEFAULT false;

-- Libera para os planos elegíveis
UPDATE public.plans
  SET can_create_tournaments = true
  WHERE id IN ('profissional', 'enterprise');

-- Garante que os demais estejam bloqueados explicitamente
UPDATE public.plans
  SET can_create_tournaments = false
  WHERE id NOT IN ('profissional', 'enterprise');
