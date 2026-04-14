-- ============================================
-- SETUP COMPLETO - Braska
-- Execute este script no SQL Editor do seu projeto Supabase
-- Dashboard > SQL Editor > New query > Cole o conteúdo > Run
-- ============================================

-- 1. LISTA EM TEMPO REAL (players)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 50),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'team1', 'team2')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RANKING (stats)
CREATE TABLE IF NOT EXISTS stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  partidas INT DEFAULT 0,
  wins INT DEFAULT 0,
  points INT DEFAULT 0,
  blocks INT DEFAULT 0,
  steals INT DEFAULT 0,
  clutch_points INT DEFAULT 0
);

-- 3. SESSÕES DE PARTIDA (registro de cada partida iniciada)
CREATE TABLE IF NOT EXISTS partida_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  team1_points INT NOT NULL DEFAULT 0,
  team2_points INT NOT NULL DEFAULT 0
);

-- 4. SESSÃO (controle de partida ativa)
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY DEFAULT 'current',
  is_started BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  current_partida_sessao_id UUID REFERENCES partida_sessoes(id) ON DELETE SET NULL
);

INSERT INTO session (id, is_started) VALUES ('current', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE session ADD COLUMN IF NOT EXISTS current_partida_sessao_id UUID REFERENCES partida_sessoes(id) ON DELETE SET NULL;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_running BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_last_sync_at TIMESTAMPTZ;
ALTER TABLE session ADD COLUMN IF NOT EXISTS timer_started_once BOOLEAN NOT NULL DEFAULT false;

-- 5. EVENTOS
CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  type TEXT NOT NULL CHECK (type IN ('Torneio', 'Treino', 'Desafio', 'Amistoso', 'Outro')),
  max_participants INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. USUÁRIOS
CREATE TABLE IF NOT EXISTS basquete_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. INSCRIÇÕES EM EVENTOS
CREATE TABLE IF NOT EXISTS evento_inscricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES basquete_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evento_id, user_id)
);

-- 8. HISTÓRICO DE PARTIDAS
CREATE TABLE IF NOT EXISTS partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_team TEXT NOT NULL CHECK (winner_team IN ('team1', 'team2')),
  team1_player_ids UUID[],
  team2_player_ids UUID[],
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colunas opcionais para vincular a usuários
ALTER TABLE stats ADD COLUMN IF NOT EXISTS partidas INT NOT NULL DEFAULT 0;
ALTER TABLE stats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES basquete_users(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES basquete_users(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE basquete_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_sessoes ENABLE ROW LEVEL SECURITY;

-- Políticas (acesso permitido para o app)
DROP POLICY IF EXISTS "Permitir tudo em players" ON players;
CREATE POLICY "Permitir tudo em players" ON players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em stats" ON stats;
CREATE POLICY "Permitir tudo em stats" ON stats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em session" ON session;
CREATE POLICY "Permitir tudo em session" ON session FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em eventos" ON eventos;
CREATE POLICY "Permitir tudo em eventos" ON eventos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em basquete_users" ON basquete_users;
CREATE POLICY "Permitir tudo em basquete_users" ON basquete_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em evento_inscricoes" ON evento_inscricoes;
CREATE POLICY "Permitir tudo em evento_inscricoes" ON evento_inscricoes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em partidas" ON partidas;
CREATE POLICY "Permitir tudo em partidas" ON partidas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em partida_sessoes" ON partida_sessoes;
CREATE POLICY "Permitir tudo em partida_sessoes" ON partida_sessoes FOR ALL USING (true) WITH CHECK (true);

-- Timeout de partida (10 min sem 12 pontos)
ALTER TABLE partida_sessoes ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ;

-- Realtime (se der erro ao executar de novo, ignore ou habilite em Database > Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE session;
ALTER PUBLICATION supabase_realtime ADD TABLE eventos;
