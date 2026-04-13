-- Campos para listagem pública "Quadras e locais" e filtros reais (basquete, endereço, contato)

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'BR';

-- Modalidades de basquete oferecidas (valores: '5x5', '3x3', 'street')
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS basketball_formats TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS hosts_tournaments BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS hosts_championships BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS opening_hours_note TEXT;

CREATE INDEX IF NOT EXISTS locations_explore_city_state ON public.locations (lower(city), lower(state));

COMMENT ON COLUMN public.locations.basketball_formats IS 'Tags: 5x5, 3x3, street';
COMMENT ON COLUMN public.locations.hosts_tournaments IS 'Local promove ou recebe torneios';
COMMENT ON COLUMN public.locations.hosts_championships IS 'Local promove ou recebe campeonatos';
