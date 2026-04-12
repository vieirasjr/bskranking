-- Pontuação individual por partida + totais derivados (team1_points / team2_points) para placar em tempo real.
-- Uma linha em partida_sessoes = uma partida; histórico: linhas anteriores com ended_at preenchido.

ALTER TABLE public.partida_sessoes
  ADD COLUMN IF NOT EXISTS player_points JSONB NOT NULL DEFAULT '{"team1": {}, "team2": {}}'::jsonb;

COMMENT ON COLUMN public.partida_sessoes.player_points IS
  'JSON: { "team1": { "<players.id>": pontos }, "team2": { ... } }. Totais team1_points/team2_points são derivados por trigger.';

-- Soma valores numéricos em um objeto JSON (chaves = id de jogador ou __legacy_total__ em migração).
CREATE OR REPLACE FUNCTION public.partida_team_points_sum(team_json jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    (
      SELECT SUM((elem.value)::text::numeric::int)
      FROM jsonb_each(COALESCE(team_json, '{}'::jsonb)) AS elem
    ),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.partida_sessoes_sync_team_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.team1_points := public.partida_team_points_sum(NEW.player_points->'team1');
  NEW.team2_points := public.partida_team_points_sum(NEW.player_points->'team2');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partida_sessoes_team_totals ON public.partida_sessoes;

CREATE TRIGGER trg_partida_sessoes_team_totals
  BEFORE INSERT OR UPDATE OF player_points ON public.partida_sessoes
  FOR EACH ROW
  EXECUTE PROCEDURE public.partida_sessoes_sync_team_totals();

-- Preservar placares existentes sem detalhe por jogador (chave legada por time).
UPDATE public.partida_sessoes
SET player_points = jsonb_build_object(
  'team1',
  CASE
    WHEN team1_points > 0 THEN jsonb_build_object('__legacy_total__', team1_points)
    ELSE '{}'::jsonb
  END,
  'team2',
  CASE
    WHEN team2_points > 0 THEN jsonb_build_object('__legacy_total__', team2_points)
    ELSE '{}'::jsonb
  END
)
WHERE team1_points > 0 OR team2_points > 0;

-- Reaplicar trigger aos registros já atualizados (totais já batem com o JSON legado).
UPDATE public.partida_sessoes SET player_points = player_points WHERE true;
