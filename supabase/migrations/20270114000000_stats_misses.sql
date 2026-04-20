-- ============================================================
-- Colunas de tentativas erradas em `stats` + RPC atualizada.
--
-- shot_1_miss   → lance livre / arremesso de 1 errado
-- shot_2_miss   → arremesso de 2 pts errado
-- shot_3_miss   → arremesso de 3 pts errado
-- turnovers     → erros de passe / perda de posse
--
-- Usadas pra calcular eficiência real do jogador
-- (acertos - erros ponderados).
-- ============================================================

ALTER TABLE public.stats ADD COLUMN IF NOT EXISTS shot_1_miss INT NOT NULL DEFAULT 0;
ALTER TABLE public.stats ADD COLUMN IF NOT EXISTS shot_2_miss INT NOT NULL DEFAULT 0;
ALTER TABLE public.stats ADD COLUMN IF NOT EXISTS shot_3_miss INT NOT NULL DEFAULT 0;
ALTER TABLE public.stats ADD COLUMN IF NOT EXISTS turnovers   INT NOT NULL DEFAULT 0;

-- Estende increment_stats: novos parâmetros com default 0 pra manter
-- retrocompat. com clientes que ainda não mandam esses deltas.
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
  p_clutch_points   INT  DEFAULT 0,
  p_shot_1_miss     INT  DEFAULT 0,
  p_shot_2_miss     INT  DEFAULT 0,
  p_shot_3_miss     INT  DEFAULT 0,
  p_turnovers       INT  DEFAULT 0
)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.stats AS s (
    user_id, location_id, name,
    partidas, wins, points, blocks, steals, rebounds, assists, clutch_points,
    shot_1_miss, shot_2_miss, shot_3_miss, turnovers
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
    GREATEST(p_clutch_points, 0),
    GREATEST(p_shot_1_miss, 0),
    GREATEST(p_shot_2_miss, 0),
    GREATEST(p_shot_3_miss, 0),
    GREATEST(p_turnovers, 0)
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
    clutch_points = GREATEST(COALESCE(s.clutch_points, 0) + p_clutch_points, 0),
    shot_1_miss   = GREATEST(COALESCE(s.shot_1_miss,   0) + p_shot_1_miss,   0),
    shot_2_miss   = GREATEST(COALESCE(s.shot_2_miss,   0) + p_shot_2_miss,   0),
    shot_3_miss   = GREATEST(COALESCE(s.shot_3_miss,   0) + p_shot_3_miss,   0),
    turnovers     = GREATEST(COALESCE(s.turnovers,     0) + p_turnovers,     0);
$$;

GRANT EXECUTE ON FUNCTION public.increment_stats(
  UUID, UUID, TEXT, INT, INT, INT, INT, INT, INT, INT, INT, INT, INT, INT, INT
) TO anon, authenticated;
