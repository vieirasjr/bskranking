-- Plano de teste R$1 para validar fluxo de pagamento
INSERT INTO public.plans (id, name, price_brl, max_players, max_locations, max_events)
VALUES ('teste', 'Teste', 100, 5, 1, 1)
ON CONFLICT (id) DO NOTHING;
