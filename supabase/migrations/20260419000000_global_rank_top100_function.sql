-- ============================================================
-- Função get_global_rank_top100()
--
-- Agrega stats por user_id (soma entre locais), enriquece com
-- dados do perfil (avatar, cidade) e retorna os top 100 por
-- score de eficiência composto.
--
-- Substitui 3 queries + agregação client-side por 1 RPC call.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_global_rank_top100()
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
    s.user_id,
    -- location_id do local onde o jogador tem mais pontos
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
    -- Mesmo score de eficiência do frontend:
    -- points*1 + assists*1.5 + rebounds*1.2 + blocks*1.5 + steals*1.3 + clutch*2 + wins*3
    (
      SUM(COALESCE(s.points, 0)) * 1.0 +
      SUM(COALESCE(s.assists, 0)) * 1.5 +
      SUM(COALESCE(s.rebounds, 0)) * 1.2 +
      SUM(COALESCE(s.blocks, 0)) * 1.5 +
      SUM(COALESCE(s.steals, 0)) * 1.3 +
      SUM(COALESCE(s.clutch_points, 0)) * 2.0 +
      SUM(COALESCE(s.wins, 0)) * 3.0
    ) DESC
  LIMIT 100;
$$;
