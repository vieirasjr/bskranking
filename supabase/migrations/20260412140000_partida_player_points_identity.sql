-- Cada pontuador pode ser número (legado) ou objeto { "points", "user_id", "name" }
-- para identificar o atleta (user_id em basquete_users) além do id da linha em players.

CREATE OR REPLACE FUNCTION public.partida_team_points_sum(team_json jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    (
      SELECT SUM(
        CASE jsonb_typeof(elem.value)
          WHEN 'number' THEN (elem.value)::text::numeric::int
          WHEN 'object' THEN COALESCE(NULLIF(trim(elem.value->>'points'), '')::numeric::int, 0)
          ELSE 0
        END
      )
      FROM jsonb_each(COALESCE(team_json, '{}'::jsonb)) AS elem
    ),
    0
  );
$$;

COMMENT ON FUNCTION public.partida_team_points_sum(jsonb) IS
  'Soma pontos por time: valores numéricos legados ou objeto.points.';
