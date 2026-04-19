-- ============================================================
-- Consolidação de duplicatas em `stats` + índice único
--
-- Há linhas duplicadas da mesma dupla (user_id, location_id) por
-- ausência de unique constraint combinada com inserts "check-then-insert"
-- sobre state stale do front. Esta migration:
--
--   1. Soma os valores de todas as linhas duplicadas na primeira row
--      de cada grupo (ordenada por id).
--   2. Apaga as demais duplicatas.
--   3. Cria índice único em (user_id, location_id) pra permitir upsert
--      atômico no client.
--
-- Linhas com user_id NULL (visitantes sem cadastro) NÃO são deduplicadas
-- nem afetadas pelo índice — NULL é distinto no PG por padrão.
--
-- Nota: Postgres não tem agregação MIN() sobre UUID. Usamos ROW_NUMBER()
-- para escolher a row-guardada deterministicamente.
-- ============================================================

-- 1. Consolida somando valores do grupo na row "rn=1" de cada partição.
WITH ranked AS (
  SELECT
    id,
    user_id,
    location_id,
    COALESCE(partidas, 0)       AS partidas,
    COALESCE(wins, 0)           AS wins,
    COALESCE(points, 0)         AS points,
    COALESCE(blocks, 0)         AS blocks,
    COALESCE(steals, 0)         AS steals,
    COALESCE(clutch_points, 0)  AS clutch_points,
    COALESCE(assists, 0)        AS assists,
    COALESCE(rebounds, 0)       AS rebounds,
    hot_streak_since,
    ROW_NUMBER() OVER (PARTITION BY user_id, location_id ORDER BY id) AS rn
  FROM public.stats
  WHERE user_id IS NOT NULL
),
group_totals AS (
  SELECT
    user_id,
    location_id,
    SUM(partidas)       AS sum_partidas,
    SUM(wins)           AS sum_wins,
    SUM(points)         AS sum_points,
    SUM(blocks)         AS sum_blocks,
    SUM(steals)         AS sum_steals,
    SUM(clutch_points)  AS sum_clutch,
    SUM(assists)        AS sum_assists,
    SUM(rebounds)       AS sum_rebounds,
    MAX(hot_streak_since) AS max_hot_streak,
    COUNT(*)            AS cnt
  FROM ranked
  GROUP BY user_id, location_id
),
keepers AS (
  SELECT id AS keep_id, user_id, location_id
  FROM ranked
  WHERE rn = 1
)
UPDATE public.stats s SET
  partidas         = g.sum_partidas,
  wins             = g.sum_wins,
  points           = g.sum_points,
  blocks           = g.sum_blocks,
  steals           = g.sum_steals,
  clutch_points    = g.sum_clutch,
  assists          = g.sum_assists,
  rebounds         = g.sum_rebounds,
  hot_streak_since = g.max_hot_streak
FROM group_totals g
JOIN keepers k
  ON k.user_id = g.user_id
 AND k.location_id IS NOT DISTINCT FROM g.location_id
WHERE s.id = k.keep_id
  AND g.cnt > 1;

-- 2. Apaga duplicatas (mantém rn=1 de cada partição).
DELETE FROM public.stats
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY user_id, location_id ORDER BY id) AS rn
    FROM public.stats
    WHERE user_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 3. Índice único: impede novas duplicatas e habilita upsert no client.
CREATE UNIQUE INDEX IF NOT EXISTS stats_user_location_uniq
  ON public.stats(user_id, location_id);
