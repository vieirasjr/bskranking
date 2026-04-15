-- ============================================================
-- Controlador de sessão: apenas 1 admin por vez gerencia a partida.
--
-- controlled_by       = auth_id do admin que controla a sessão
-- control_requested_by = auth_id do admin que pediu controle
-- control_requested_name = nome do admin que pediu (para exibir no modal)
-- ============================================================

ALTER TABLE public.session ADD COLUMN IF NOT EXISTS controlled_by         UUID;
ALTER TABLE public.session ADD COLUMN IF NOT EXISTS control_requested_by  UUID;
ALTER TABLE public.session ADD COLUMN IF NOT EXISTS control_requested_name TEXT;
