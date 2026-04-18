-- ============================================================
-- Migration: formato do torneio + chaveamento (tournament_matches)
-- ============================================================

-- 1. Formato do torneio
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'KNOCKOUT'
    CHECK (format IN ('ROUND_ROBIN','KNOCKOUT','DOUBLE_ELIMINATION','GROUP_STAGE','CROSS_GROUPS','HOME_AWAY','SWISS'));

-- 2. Tabela de partidas (chaveamento)
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,

  round           INT NOT NULL,          -- 1 = primeira rodada
  position        INT NOT NULL,          -- posição dentro da rodada (0..N)
  group_label     TEXT,                  -- 'A','B' para group stage

  team_a_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,

  team_a_score    INT,
  team_b_score    INT,
  winner_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,

  -- Para brackets: quando esta match termina, vencedor vai pra next_match_id
  next_match_id   UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  next_match_slot TEXT CHECK (next_match_slot IN ('A','B')),

  scheduled_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','live','finished','cancelled','bye')),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_matches_tournament_idx
  ON public.tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_matches_round_idx
  ON public.tournament_matches(tournament_id, round, position);

-- Unicidade: evita duas partidas iguais dentro do mesmo torneio/rodada/posição/grupo.
-- Expressões (COALESCE) só funcionam em índice único, não em UNIQUE inline.
CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_slot_unique
  ON public.tournament_matches (tournament_id, round, position, COALESCE(group_label, ''));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tournament_matches_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tournament_matches_updated_at ON public.tournament_matches;
CREATE TRIGGER tournament_matches_updated_at
  BEFORE UPDATE ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.tournament_matches_set_updated_at();

-- RLS: leitura pública, escrita apenas pelo dono do tenant (criador do torneio)
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_matches_public_read"
  ON public.tournament_matches FOR SELECT USING (true);

CREATE POLICY "tournament_matches_owner_write"
  ON public.tournament_matches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_matches.tournament_id
      AND (t.created_by = auth.uid() OR
           EXISTS (SELECT 1 FROM public.tenants ten
                   WHERE ten.id = t.tenant_id AND ten.owner_auth_id = auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_matches.tournament_id
      AND (t.created_by = auth.uid() OR
           EXISTS (SELECT 1 FROM public.tenants ten
                   WHERE ten.id = t.tenant_id AND ten.owner_auth_id = auth.uid()))
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
