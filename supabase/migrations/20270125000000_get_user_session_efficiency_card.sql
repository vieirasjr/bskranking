-- Eficiência do usuário no local: prioriza a janela da sessão do venue (tabela session);
-- se não houver registros nessa janela, usa o último dia civil (America/Sao_Paulo) em que
-- o usuário teve stat_logs naquele local.

CREATE OR REPLACE FUNCTION public.partida_player_points_has_user(pp jsonb, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM jsonb_each(COALESCE(pp->'team1', '{}'::jsonb)) kv
      WHERE (kv.value->>'user_id') = p_user_id::text
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_each(COALESCE(pp->'team2', '{}'::jsonb)) kv
      WHERE (kv.value->>'user_id') = p_user_id::text
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_session_efficiency_card(
  p_location_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  window_start_ts timestamptz,
  window_end_ts   timestamptz,
  source_mode       text,
  points            bigint,
  assists           bigint,
  rebounds          bigint,
  blocks            bigint,
  steals            bigint,
  clutch_points     bigint,
  wins              bigint,
  shot_1_miss       bigint,
  shot_2_miss       bigint,
  shot_3_miss       bigint,
  turnovers         bigint,
  efficiency        numeric,
  partidas          bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH session_bounds AS (
    SELECT
      s.started_at AS start_ts,
      CASE
        WHEN s.is_started = TRUE THEN now()
        ELSE COALESCE(s.ended_at, now())
      END AS end_ts
    FROM public.session s
    WHERE s.location_id = p_location_id
      AND s.started_at IS NOT NULL
    LIMIT 1
  ),
  agg_in_window AS (
    SELECT
      sb.start_ts,
      sb.end_ts,
      SUM(CASE WHEN sl.stat_type = 'points'        THEN sl.value ELSE 0 END) AS points,
      SUM(CASE WHEN sl.stat_type = 'assists'       THEN sl.value ELSE 0 END) AS assists,
      SUM(CASE WHEN sl.stat_type = 'rebounds'      THEN sl.value ELSE 0 END) AS rebounds,
      SUM(CASE WHEN sl.stat_type = 'blocks'        THEN sl.value ELSE 0 END) AS blocks,
      SUM(CASE WHEN sl.stat_type = 'steals'        THEN sl.value ELSE 0 END) AS steals,
      SUM(CASE WHEN sl.stat_type = 'clutch_points' THEN sl.value ELSE 0 END) AS clutch_points,
      SUM(CASE WHEN sl.stat_type = 'wins'          THEN sl.value ELSE 0 END) AS wins,
      SUM(CASE WHEN sl.stat_type = 'shot_1_miss'   THEN sl.value ELSE 0 END) AS shot_1_miss,
      SUM(CASE WHEN sl.stat_type = 'shot_2_miss'   THEN sl.value ELSE 0 END) AS shot_2_miss,
      SUM(CASE WHEN sl.stat_type = 'shot_3_miss'   THEN sl.value ELSE 0 END) AS shot_3_miss,
      SUM(CASE WHEN sl.stat_type = 'turnovers'     THEN sl.value ELSE 0 END) AS turnovers
    FROM public.stat_logs sl
    INNER JOIN session_bounds sb ON TRUE
    WHERE sl.location_id = p_location_id
      AND sl.user_id = p_user_id
      AND sl.created_at >= sb.start_ts
      AND sl.created_at <= sb.end_ts
    GROUP BY sb.start_ts, sb.end_ts
  ),
  session_pick AS (
    SELECT
      w.start_ts AS window_start_ts,
      w.end_ts   AS window_end_ts,
      'session'::text AS source_mode,
      w.points,
      w.assists,
      w.rebounds,
      w.blocks,
      w.steals,
      w.clutch_points,
      w.wins,
      w.shot_1_miss,
      w.shot_2_miss,
      w.shot_3_miss,
      w.turnovers,
      (
        w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
        w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
        w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
      )::numeric AS efficiency,
      (
        SELECT COUNT(*)::bigint
        FROM public.partida_sessoes ps
        WHERE ps.location_id = p_location_id
          AND ps.started_at >= w.start_ts
          AND ps.started_at <= w.end_ts
          AND public.partida_player_points_has_user(ps.player_points, p_user_id)
      ) AS partidas
    FROM agg_in_window w
    WHERE GREATEST(
      0,
      w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
      w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
      w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
    ) > 0
  ),
  last_log AS (
    SELECT max(sl.created_at) AS mx
    FROM public.stat_logs sl
    WHERE sl.location_id = p_location_id
      AND sl.user_id = p_user_id
  ),
  day_bounds AS (
    SELECT
      (date_trunc('day', ll.mx AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AS d0,
      (date_trunc('day', ll.mx AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' AS d1
    FROM last_log ll
    WHERE ll.mx IS NOT NULL
  ),
  agg_day AS (
    SELECT
      db.d0 AS start_ts,
      db.d1 AS end_ts,
      SUM(CASE WHEN sl.stat_type = 'points'        THEN sl.value ELSE 0 END) AS points,
      SUM(CASE WHEN sl.stat_type = 'assists'       THEN sl.value ELSE 0 END) AS assists,
      SUM(CASE WHEN sl.stat_type = 'rebounds'      THEN sl.value ELSE 0 END) AS rebounds,
      SUM(CASE WHEN sl.stat_type = 'blocks'        THEN sl.value ELSE 0 END) AS blocks,
      SUM(CASE WHEN sl.stat_type = 'steals'        THEN sl.value ELSE 0 END) AS steals,
      SUM(CASE WHEN sl.stat_type = 'clutch_points' THEN sl.value ELSE 0 END) AS clutch_points,
      SUM(CASE WHEN sl.stat_type = 'wins'          THEN sl.value ELSE 0 END) AS wins,
      SUM(CASE WHEN sl.stat_type = 'shot_1_miss'   THEN sl.value ELSE 0 END) AS shot_1_miss,
      SUM(CASE WHEN sl.stat_type = 'shot_2_miss'   THEN sl.value ELSE 0 END) AS shot_2_miss,
      SUM(CASE WHEN sl.stat_type = 'shot_3_miss'   THEN sl.value ELSE 0 END) AS shot_3_miss,
      SUM(CASE WHEN sl.stat_type = 'turnovers'     THEN sl.value ELSE 0 END) AS turnovers
    FROM public.stat_logs sl
    INNER JOIN day_bounds db ON TRUE
    WHERE sl.location_id = p_location_id
      AND sl.user_id = p_user_id
      AND sl.created_at >= db.d0
      AND sl.created_at < db.d1
    GROUP BY db.d0, db.d1
  ),
  day_pick AS (
    SELECT
      w.start_ts AS window_start_ts,
      w.end_ts   AS window_end_ts,
      'last_day'::text AS source_mode,
      w.points,
      w.assists,
      w.rebounds,
      w.blocks,
      w.steals,
      w.clutch_points,
      w.wins,
      w.shot_1_miss,
      w.shot_2_miss,
      w.shot_3_miss,
      w.turnovers,
      (
        w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
        w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
        w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
      )::numeric AS efficiency,
      (
        SELECT COUNT(*)::bigint
        FROM public.partida_sessoes ps
        WHERE ps.location_id = p_location_id
          AND ps.started_at >= w.start_ts
          AND ps.started_at < w.end_ts
          AND public.partida_player_points_has_user(ps.player_points, p_user_id)
      ) AS partidas
    FROM agg_day w
    WHERE GREATEST(
      0,
      w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
      w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
      w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
    ) > 0
  )
  SELECT * FROM session_pick
  UNION ALL
  SELECT * FROM day_pick WHERE NOT EXISTS (SELECT 1 FROM session_pick)
  LIMIT 1;
$$;
