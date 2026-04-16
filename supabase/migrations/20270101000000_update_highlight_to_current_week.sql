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
    -- Semana atual: Segunda-feira 00:00 até Domingo 23:59:59 (America/Sao_Paulo)
    SELECT
      (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo'))::date AS ws,
      (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') + interval '6 days')::date AS we
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
  JOIN public.basquete_users bu ON bu.id = w.user_id
  CROSS JOIN week_bounds wb
  ORDER BY efficiency DESC, w.points DESC
  LIMIT 1;
$$;