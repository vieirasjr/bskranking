-- Migration 002: Plano Avulso (evento único, 72h)
INSERT INTO public.plans (id, name, price_brl, max_players, max_locations)
VALUES ('avulso', 'Evento Avulso', 5000, 20, 1)
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  price_brl     = EXCLUDED.price_brl,
  max_players   = EXCLUDED.max_players,
  max_locations = EXCLUDED.max_locations;
