-- ============================================================
-- Persistência do destaque entre sessões.
--
-- Adiciona `ended_at` à tabela session e reescreve get_weekly_highlight
-- pra usar:
--   - Sessão ATIVA:     intervalo [started_at, now()]
--   - Sessão ENCERRADA: intervalo [started_at, ended_at]
--
-- Efeito: o card de Destaque continua visível entre uma sessão e outra,
-- exibindo o melhor da última sessão completa. Só reseta ao iniciar
-- uma nova sessão (quando o started_at é atualizado).
-- ============================================================

ALTER TABLE public.session ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

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
  WITH session_bounds AS (
    SELECT
      started_at AS start_ts,
      CASE
        WHEN is_started = TRUE THEN now()
        ELSE COALESCE(ended_at, now())
      END AS end_ts
    FROM public.session
    WHERE location_id = p_location_id
      AND started_at IS NOT NULL
    LIMIT 1
  ),
  per_user AS (
    SELECT
      sl.user_id,
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
    FROM public.stat_logs sl, session_bounds sb
    WHERE sl.location_id = p_location_id
      AND sl.user_id IS NOT NULL
      AND sl.created_at >= sb.start_ts
      AND sl.created_at <= sb.end_ts
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
      w.wins * 3.0 -
      w.shot_1_miss * 0.4 -
      w.shot_2_miss * 0.8 -
      w.shot_3_miss * 1.2 -
      w.turnovers   * 1.0
    )::numeric AS efficiency,
    sb.start_ts::date AS week_start,
    sb.end_ts::date   AS week_end
  FROM per_user w
  CROSS JOIN session_bounds sb
  LEFT JOIN public.basquete_users bu ON bu.id = w.user_id
  WHERE GREATEST(
    0,
    w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
    w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
    w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
  ) > 0
  ORDER BY
    (
      w.points * 1.0 + w.assists * 1.5 + w.rebounds * 1.2 + w.blocks * 1.5 +
      w.steals * 1.3 + w.clutch_points * 2.0 + w.wins * 3.0 -
      w.shot_1_miss * 0.4 - w.shot_2_miss * 0.8 - w.shot_3_miss * 1.2 - w.turnovers * 1.0
    ) DESC
  LIMIT 1;
$$;
