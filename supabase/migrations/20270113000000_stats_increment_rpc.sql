-- ============================================================
-- RPC para incremento ATÔMICO de stats.
--
-- Cada cliente envia apenas os DELTAS das colunas (negativos ou
-- positivos). A função roda INSERT ... ON CONFLICT DO UPDATE SET
-- col = stats.col + delta, de modo que duas atualizações simultâneas
-- não se sobrescrevem — o banco combina ambas no mesmo commit.
--
-- Depende do índice único stats_user_location_uniq criado em
-- 20270112000000_stats_dedup_and_unique.sql.
--
-- GREATEST(..., 0) garante que contadores nunca caiam abaixo de zero
-- quando aplicado um delta negativo em uma linha sem histórico.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_stats(
  p_user_id         UUID,
  p_location_id     UUID DEFAULT NULL,
  p_name            TEXT DEFAULT NULL,
  p_partidas        INT  DEFAULT 0,
  p_wins            INT  DEFAULT 0,
  p_points          INT  DEFAULT 0,
  p_blocks          INT  DEFAULT 0,
  p_steals          INT  DEFAULT 0,
  p_rebounds        INT  DEFAULT 0,
  p_assists         INT  DEFAULT 0,
  p_clutch_points   INT  DEFAULT 0
)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.stats AS s (
    user_id, location_id, name,
    partidas, wins, points, blocks, steals, rebounds, assists, clutch_points
  )
  VALUES (
    p_user_id,
    p_location_id,
    COALESCE(p_name, 'Atleta'),
    GREATEST(p_partidas, 0),
    GREATEST(p_wins, 0),
    GREATEST(p_points, 0),
    GREATEST(p_blocks, 0),
    GREATEST(p_steals, 0),
    GREATEST(p_rebounds, 0),
    GREATEST(p_assists, 0),
    GREATEST(p_clutch_points, 0)
  )
  ON CONFLICT (user_id, location_id) DO UPDATE SET
    name          = COALESCE(NULLIF(TRIM(p_name), ''), s.name),
    partidas      = GREATEST(COALESCE(s.partidas,      0) + p_partidas,      0),
    wins          = GREATEST(COALESCE(s.wins,          0) + p_wins,          0),
    points        = GREATEST(COALESCE(s.points,        0) + p_points,        0),
    blocks        = GREATEST(COALESCE(s.blocks,        0) + p_blocks,        0),
    steals        = GREATEST(COALESCE(s.steals,        0) + p_steals,        0),
    rebounds      = GREATEST(COALESCE(s.rebounds,      0) + p_rebounds,      0),
    assists       = GREATEST(COALESCE(s.assists,       0) + p_assists,       0),
    clutch_points = GREATEST(COALESCE(s.clutch_points, 0) + p_clutch_points, 0);
$$;

GRANT EXECUTE ON FUNCTION public.increment_stats(
  UUID, UUID, TEXT, INT, INT, INT, INT, INT, INT, INT, INT
) TO anon, authenticated;
