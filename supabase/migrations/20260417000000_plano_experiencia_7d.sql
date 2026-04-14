-- Plano introdutório: R$ 36,90 · acesso por 7 dias (expiração: server PLAN_EXPIRY_HOURS.teste = 168h)
INSERT INTO public.plans (id, name, price_brl, max_players, max_locations, max_events)
VALUES ('teste', 'Experiência 7 dias', 3690, 5, 1, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_brl = EXCLUDED.price_brl;
