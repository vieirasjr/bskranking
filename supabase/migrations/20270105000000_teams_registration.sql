-- ============================================================
-- Migration: Team registration for tournaments
-- Equipes inscritas (teams), jogadores (team_players) e bucket
-- team-logos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  owner_auth_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  logo_url        TEXT,
  coach_name      TEXT,
  trainer_name    TEXT,
  staff           TEXT[] NOT NULL DEFAULT '{}',  -- membros adicionais da comissão
  notes           TEXT,

  status          TEXT NOT NULL DEFAULT 'registered'
                  CHECK (status IN ('registered','approved','rejected','withdrawn')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_tournament_idx ON public.teams(tournament_id);
CREATE INDEX IF NOT EXISTS teams_owner_idx      ON public.teams(owner_auth_id);

-- Uma pessoa inscreve 1 equipe por torneio (unique opcional — pode remover se
-- quiser permitir múltiplas equipes do mesmo dono)
CREATE UNIQUE INDEX IF NOT EXISTS teams_tournament_owner_unique
  ON public.teams(tournament_id, owner_auth_id);

CREATE TABLE IF NOT EXISTS public.team_players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  jersey_number   INT CHECK (jersey_number IS NULL OR (jersey_number >= 0 AND jersey_number <= 99)),
  position        TEXT CHECK (position IS NULL OR position IN ('PG','SG','SF','PF','C')),
  is_starter      BOOLEAN NOT NULL DEFAULT false,
  birth_date      DATE,
  order_idx       INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_players_team_idx ON public.team_players(team_id);

-- Trigger updated_at em teams
CREATE OR REPLACE FUNCTION public.teams_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.teams_set_updated_at();

-- RLS
ALTER TABLE public.teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players  ENABLE ROW LEVEL SECURITY;

-- Leitura pública (para exibir elenco na página do torneio)
CREATE POLICY "teams_public_read"
  ON public.teams FOR SELECT USING (true);

CREATE POLICY "team_players_public_read"
  ON public.team_players FOR SELECT USING (true);

-- Escrita: apenas o dono da equipe
CREATE POLICY "teams_owner_write"
  ON public.teams FOR ALL
  USING (auth.uid() = owner_auth_id)
  WITH CHECK (auth.uid() = owner_auth_id);

CREATE POLICY "team_players_owner_write"
  ON public.team_players FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_players.team_id AND t.owner_auth_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_players.team_id AND t.owner_auth_id = auth.uid()
  ));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_players;

-- ============================================================
-- Bucket team-logos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "team_logos_public_read" ON storage.objects;
CREATE POLICY "team_logos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_authenticated_insert" ON storage.objects;
CREATE POLICY "team_logos_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_authenticated_update" ON storage.objects;
CREATE POLICY "team_logos_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'team-logos')
  WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_authenticated_delete" ON storage.objects;
CREATE POLICY "team_logos_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'team-logos');
