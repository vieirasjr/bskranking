-- ============================================================
-- Reestruturação dos planos de negócio
--
-- Mudanças:
-- 1. Renomeia plano "teste" → "entrada" (plano mensal, não mais 7 dias)
-- 2. max_players agora = max jogadores por SESSÃO (time1+time2+espera)
--    Ranking de jogadores é ILIMITADO em todos os planos.
-- 3. Enterprise agora tem max_locations = 4 (antes ilimitado)
-- 4. Profissional: max_players 60 → 40
-- ============================================================

-- 1. Criar novo plano "entrada"
INSERT INTO public.plans (id, name, price_brl, max_players, max_locations, max_events)
VALUES ('entrada', 'Entrada', 3690, 20, 1, 1)
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  price_brl     = EXCLUDED.price_brl,
  max_players   = EXCLUDED.max_players,
  max_locations = EXCLUDED.max_locations,
  max_events    = EXCLUDED.max_events;

-- 2. Migrar tenants de "teste" para "entrada"
UPDATE public.tenants SET plan_id = 'entrada' WHERE plan_id = 'teste';

-- 3. Desativar plano "teste" (não deletar para preservar histórico)
UPDATE public.plans SET is_active = false WHERE id = 'teste';

-- 4. Atualizar plano básico: max_players = 30 por sessão
UPDATE public.plans SET
  max_players = 30
WHERE id = 'basico';

-- 5. Atualizar plano profissional: max_players = 40 por sessão (era 60)
UPDATE public.plans SET
  max_players = 40
WHERE id = 'profissional';

-- 6. Enterprise: max_locations = 4 (era ilimitado), jogadores/sessão ilimitados
UPDATE public.plans SET
  max_locations = 4
WHERE id = 'enterprise';
