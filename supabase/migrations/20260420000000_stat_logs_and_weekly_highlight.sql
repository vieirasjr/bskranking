-- ============================================================
-- stat_logs: log de cada evento de estatística com timestamp
--
-- Permite calcular o "Destaque da Rodada" baseado apenas na
-- semana anterior (segunda a domingo), não no acumulado total.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stat_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_type     TEXT NOT NULL,  -- 'points', 'blocks', 'steals', 'assists', 'rebounds', 'wins', 'clutch_points'
  value         INT NOT NULL DEFAULT 1,
  player_stat_id UUID,          -- ref à row em stats (pode ser null se ainda não existe)
  user_id       UUID,
  location_id   UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stat_logs_location_created_idx ON public.stat_logs(location_id, created_at);
CREATE INDEX IF NOT EXISTS stat_logs_user_created_idx     ON public.stat_logs(user_id, created_at);

ALTER TABLE public.stat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stat_logs_public_read" ON public.stat_logs FOR SELECT USING (true);
CREATE POLICY "stat_logs_public_insert" ON public.stat_logs FOR INSERT WITH CHECK (true);

-- ============================================================
-- get_weekly_highlight(p_location_id)
--
-- Retorna o destaque da semana ANTERIOR (segunda 00:00 a domingo 23:59).
-- Se a semana atual ainda não completou (estamos nela), usa a semana
-- passada. Usa o mesmo score de eficiência:
--   points*1 + assists*1.5 + rebounds*1.2 + blocks*1.5
--   + steals*1.3 + clutch_points*2 + wins*3
--
-- Retorna 1 row com os dados do destaque, ou 0 rows se não houver.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_weekly_highlight(p_location_id UUID)
RETURNS TABLE (
  user_id       UUID,
  name          text,
  avatar_url    text,
  points        bigint,
  assists       bigint,
  rebounds      bigint,
  blocks        bigint,
  steals        bigint,
  clutch_points bigint,
  wins          bigint,
  efficiency    numeric,
  week_start    date,
  week_end      date
)
LANGUAGE sql
STABLE
AS $$
  WITH week_bounds AS (
    -- Segunda-feira passada 00:00 UTC até domingo passado 23:59:59 UTC
    SELECT
      (date_trunc('week', now() - interval '1 day') - interval '6 days')::date AS ws,
      (date_trunc('week', now() - interval '1 day'))::date                     AS we
  ),
  weekly AS (
    SELECT
      sl.user_id,
      SUM(CASE WHEN sl.stat_type = 'points'        THEN sl.value ELSE 0 END) AS points,
      SUM(CASE WHEN sl.stat_type = 'assists'        THEN sl.value ELSE 0 END) AS assists,
      SUM(CASE WHEN sl.stat_type = 'rebounds'       THEN sl.value ELSE 0 END) AS rebounds,
      SUM(CASE WHEN sl.stat_type = 'blocks'         THEN sl.value ELSE 0 END) AS blocks,
      SUM(CASE WHEN sl.stat_type = 'steals'         THEN sl.value ELSE 0 END) AS steals,
      SUM(CASE WHEN sl.stat_type = 'clutch_points'  THEN sl.value ELSE 0 END) AS clutch_points,
      SUM(CASE WHEN sl.stat_type = 'wins'           THEN sl.value ELSE 0 END) AS wins
    FROM public.stat_logs sl, week_bounds wb
    WHERE sl.location_id = p_location_id
      AND sl.user_id IS NOT NULL
      AND sl.created_at >= wb.ws::timestamptz
      AND sl.created_at <  (wb.we + 1)::timestamptz
    GROUP BY sl.user_id
  )
  SELECT
    w.user_id,
    COALESCE(NULLIF(TRIM(bu.display_name), ''), NULLIF(TRIM(bu.full_name), ''), 'Atleta') AS name,
    bu.avatar_url,
    w.points,
    w.assists,
    w.rebounds,
    w.blocks,
    w.steals,
    w.clutch_points,
    w.wins,
    (
      w.points * 1.0 +
      w.assists * 1.5 +
      w.rebounds * 1.2 +
      w.blocks * 1.5 +
      w.steals * 1.3 +
      w.clutch_points * 2.0 +
      w.wins * 3.0
    )::numeric AS efficiency,
    wb.ws AS week_start,
    wb.we AS week_end
  FROM weekly w
  CROSS JOIN week_bounds wb
  LEFT JOIN public.basquete_users bu ON bu.id = w.user_id
  WHERE (
    w.points * 1.0 +
    w.assists * 1.5 +
    w.rebounds * 1.2 +
    w.blocks * 1.5 +
    w.steals * 1.3 +
    w.clutch_points * 2.0 +
    w.wins * 3.0
  ) > 0
  ORDER BY (
    w.points * 1.0 +
    w.assists * 1.5 +
    w.rebounds * 1.2 +
    w.blocks * 1.5 +
    w.steals * 1.3 +
    w.clutch_points * 2.0 +
    w.wins * 3.0
  ) DESC
  LIMIT 1;
$$;
