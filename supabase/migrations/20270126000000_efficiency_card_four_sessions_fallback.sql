-- Card de eficiência no ranking:
-- 1) Stats do usuário na janela da sessão do local (tabela session).
-- 2) Se vazio: stats do usuário agregados nos últimos 4 dias-distintos (America/Sao_Paulo)
--    em que houve stat_logs naquele local ("últimas 4 sessões").
-- 3) Se ainda vazio: melhor eficiência entre todos no mesmo período de 4 dias (fallback).
--
-- DROP obrigatório: o Postgres não permite CREATE OR REPLACE quando mudam as colunas OUT.

DROP FUNCTION IF EXISTS public.get_user_session_efficiency_card(uuid, uuid);

CREATE FUNCTION public.get_user_session_efficiency_card(
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
  partidas          bigint,
  subject_user_id   uuid,
  subject_display_name text,
  subject_avatar_url   text,
  is_fallback       boolean
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
  agg_session_user AS (
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
      ) AS partidas,
      p_user_id AS subject_user_id,
      COALESCE(NULLIF(TRIM(bu.display_name), ''), NULLIF(TRIM(bu.full_name), ''), 'Atleta')::text AS subject_display_name,
      bu.avatar_url AS subject_avatar_url,
      false AS is_fallback
    FROM agg_session_user w
    LEFT JOIN public.basquete_users bu ON bu.id = p_user_id
    WHERE GREATEST(
      0,
      w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
      w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
      w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
    ) > 0
  ),
  session_days AS (
    SELECT sub.d
    FROM (
      SELECT DISTINCT ((sl.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS d
      FROM public.stat_logs sl
      WHERE sl.location_id = p_location_id
    ) sub
    ORDER BY sub.d DESC
    LIMIT 4
  ),
  four_window AS (
    SELECT
      (min(sd.d))::timestamp AT TIME ZONE 'America/Sao_Paulo' AS start_ts,
      (((max(sd.d) + 1))::timestamp AT TIME ZONE 'America/Sao_Paulo') AS end_ts
    FROM session_days sd
  ),
  agg_four_user AS (
    SELECT
      fw.start_ts,
      fw.end_ts,
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
    CROSS JOIN four_window fw
    WHERE sl.location_id = p_location_id
      AND sl.user_id = p_user_id
      AND (sl.created_at AT TIME ZONE 'America/Sao_Paulo')::date IN (SELECT d FROM session_days)
    GROUP BY fw.start_ts, fw.end_ts
  ),
  four_user_pick AS (
    SELECT
      w.start_ts AS window_start_ts,
      w.end_ts   AS window_end_ts,
      'four_sessions'::text AS source_mode,
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
      ) AS partidas,
      p_user_id AS subject_user_id,
      COALESCE(NULLIF(TRIM(bu.display_name), ''), NULLIF(TRIM(bu.full_name), ''), 'Atleta')::text AS subject_display_name,
      bu.avatar_url AS subject_avatar_url,
      false AS is_fallback
    FROM agg_four_user w
    LEFT JOIN public.basquete_users bu ON bu.id = p_user_id
    WHERE EXISTS (SELECT 1 FROM session_days)
      AND GREATEST(
        0,
        w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
        w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
        w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
      ) > 0
  ),
  per_user_four AS (
    SELECT
      sl.user_id AS uid,
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
    WHERE sl.location_id = p_location_id
      AND sl.user_id IS NOT NULL
      AND (sl.created_at AT TIME ZONE 'America/Sao_Paulo')::date IN (SELECT d FROM session_days)
    GROUP BY sl.user_id
  ),
  ranked_leader AS (
    SELECT
      p.uid,
      p.points,
      p.assists,
      p.rebounds,
      p.blocks,
      p.steals,
      p.clutch_points,
      p.wins,
      p.shot_1_miss,
      p.shot_2_miss,
      p.shot_3_miss,
      p.turnovers,
      (
        p.points * 1.0 + p.assists * 1.5 + p.rebounds * 1.2 + p.blocks * 1.5 +
        p.steals * 1.3 + p.clutch_points * 2.0 + p.wins * 3.0 -
        p.shot_1_miss * 0.4 - p.shot_2_miss * 0.8 - p.shot_3_miss * 1.2 - p.turnovers * 1.0
      )::numeric AS efficiency
    FROM per_user_four p
    WHERE GREATEST(
      0,
      p.points * 1.0 + p.assists * 1.5 + p.rebounds * 1.2 + p.blocks * 1.5 +
      p.steals * 1.3 + p.clutch_points * 2.0 + p.wins * 3.0 -
      p.shot_1_miss * 0.4 - p.shot_2_miss * 0.8 - p.shot_3_miss * 1.2 - p.turnovers * 1.0
    ) > 0
    ORDER BY
      (
        p.points * 1.0 + p.assists * 1.5 + p.rebounds * 1.2 + p.blocks * 1.5 +
        p.steals * 1.3 + p.clutch_points * 2.0 + p.wins * 3.0 -
        p.shot_1_miss * 0.4 - p.shot_2_miss * 0.8 - p.shot_3_miss * 1.2 - p.turnovers * 1.0
      ) DESC
    LIMIT 1
  ),
  four_leader_pick AS (
    SELECT
      fw.start_ts AS window_start_ts,
      fw.end_ts   AS window_end_ts,
      'fallback_leader'::text AS source_mode,
      r.points,
      r.assists,
      r.rebounds,
      r.blocks,
      r.steals,
      r.clutch_points,
      r.wins,
      r.shot_1_miss,
      r.shot_2_miss,
      r.shot_3_miss,
      r.turnovers,
      r.efficiency,
      (
        SELECT COUNT(*)::bigint
        FROM public.partida_sessoes ps
        WHERE ps.location_id = p_location_id
          AND ps.started_at >= fw.start_ts
          AND ps.started_at < fw.end_ts
          AND public.partida_player_points_has_user(ps.player_points, r.uid)
      ) AS partidas,
      r.uid AS subject_user_id,
      COALESCE(NULLIF(TRIM(bu.display_name), ''), NULLIF(TRIM(bu.full_name), ''), 'Atleta')::text AS subject_display_name,
      bu.avatar_url AS subject_avatar_url,
      true AS is_fallback
    FROM ranked_leader r
    CROSS JOIN four_window fw
    LEFT JOIN public.basquete_users bu ON bu.id = r.uid
    WHERE EXISTS (SELECT 1 FROM session_days)
  )
  SELECT * FROM session_pick
  UNION ALL
  SELECT * FROM four_user_pick WHERE NOT EXISTS (SELECT 1 FROM session_pick)
  UNION ALL
  SELECT * FROM four_leader_pick
    WHERE NOT EXISTS (SELECT 1 FROM session_pick)
      AND NOT EXISTS (SELECT 1 FROM four_user_pick)
  LIMIT 1;
$$;
