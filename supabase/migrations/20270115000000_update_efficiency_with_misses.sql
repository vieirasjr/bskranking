-- ============================================================
-- Atualiza fórmulas de eficiência pra descontar tentativas erradas.
--
-- Nova fórmula:
--   acertos =  points*1.0 + assists*1.5 + rebounds*1.2 + blocks*1.5
--            + steals*1.3 + clutch_points*2.0 + wins*3.0
--
--   erros   =  shot_1_miss*0.4 + shot_2_miss*0.8 + shot_3_miss*1.2
--            + turnovers*1.0
--
--   eficiência = acertos - erros
--
-- Pesos dos erros refletem a gravidade proporcional à oportunidade
-- perdida (3pts > 2pts > 1pt; turnover ≈ arremesso de 2 errado).
-- ============================================================

-- get_global_rank_top100: retorna erros + ordena com a nova fórmula.
-- DROP obrigatório: Postgres não permite alterar o RETURNS TABLE via
-- CREATE OR REPLACE (as novas colunas shot_*_miss / turnovers mudam o row type).
DROP FUNCTION IF EXISTS public.get_global_rank_top100();

CREATE FUNCTION public.get_global_rank_top100()
RETURNS TABLE (
  id            text,
  name          text,
  points        bigint,
  wins          bigint,
  blocks        bigint,
  steals        bigint,
  clutch_points bigint,
  assists       bigint,
  rebounds      bigint,
  shot_1_miss   bigint,
  shot_2_miss   bigint,
  shot_3_miss   bigint,
  turnovers     bigint,
  user_id       uuid,
  location_id   uuid,
  avatar_url    text,
  player_city   text,
  country_iso   text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(s.user_id::text, s.id::text)                          AS id,
    COALESCE(
      NULLIF(TRIM(bu.display_name), ''),
      NULLIF(TRIM(bu.full_name), ''),
      MAX(s.name)
    )                                                               AS name,
    SUM(COALESCE(s.points, 0))::bigint                             AS points,
    SUM(COALESCE(s.wins, 0))::bigint                               AS wins,
    SUM(COALESCE(s.blocks, 0))::bigint                             AS blocks,
    SUM(COALESCE(s.steals, 0))::bigint                             AS steals,
    SUM(COALESCE(s.clutch_points, 0))::bigint                      AS clutch_points,
    SUM(COALESCE(s.assists, 0))::bigint                            AS assists,
    SUM(COALESCE(s.rebounds, 0))::bigint                           AS rebounds,
    SUM(COALESCE(s.shot_1_miss, 0))::bigint                        AS shot_1_miss,
    SUM(COALESCE(s.shot_2_miss, 0))::bigint                        AS shot_2_miss,
    SUM(COALESCE(s.shot_3_miss, 0))::bigint                        AS shot_3_miss,
    SUM(COALESCE(s.turnovers, 0))::bigint                          AS turnovers,
    s.user_id,
    (ARRAY_AGG(s.location_id ORDER BY s.points DESC NULLS LAST))[1] AS location_id,
    bu.avatar_url,
    bu.city                                                         AS player_city,
    COALESCE(bu.country_iso, 'BR')                                  AS country_iso
  FROM public.stats s
  LEFT JOIN public.basquete_users bu ON bu.id = s.user_id
  GROUP BY
    COALESCE(s.user_id::text, s.id::text),
    s.user_id,
    bu.display_name,
    bu.full_name,
    bu.avatar_url,
    bu.city,
    bu.country_iso
  ORDER BY
    (
      SUM(COALESCE(s.points, 0))        * 1.0 +
      SUM(COALESCE(s.assists, 0))       * 1.5 +
      SUM(COALESCE(s.rebounds, 0))      * 1.2 +
      SUM(COALESCE(s.blocks, 0))        * 1.5 +
      SUM(COALESCE(s.steals, 0))        * 1.3 +
      SUM(COALESCE(s.clutch_points, 0)) * 2.0 +
      SUM(COALESCE(s.wins, 0))          * 3.0 -
      SUM(COALESCE(s.shot_1_miss, 0))   * 0.4 -
      SUM(COALESCE(s.shot_2_miss, 0))   * 0.8 -
      SUM(COALESCE(s.shot_3_miss, 0))   * 1.2 -
      SUM(COALESCE(s.turnovers, 0))     * 1.0
    ) DESC
  LIMIT 100;
$$;

-- get_weekly_highlight: mesma lógica, mas operando sobre stat_logs da
-- semana anterior. Como stat_logs ainda não tem os tipos de miss, por
-- enquanto a fórmula do destaque semanal usa só os acertos (misses
-- serão adicionados quando logarmos esses eventos). Reescrita mantida
-- idêntica ao original.
