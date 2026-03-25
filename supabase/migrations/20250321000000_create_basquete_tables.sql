-- Tabela de jogadores (fila em tempo real)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 50),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'team1', 'team2')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de estatísticas
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

-- Sessão única (substitui documento session/current)
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY DEFAULT 'current',
  is_started BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ
);

-- Inserir registro inicial da sessão
INSERT INTO session (id, is_started) VALUES ('current', false)
ON CONFLICT (id) DO NOTHING;

-- Habilitar Realtime: no Dashboard do Supabase, vá em Database > Replication
-- e adicione as tabelas 'players' e 'session' à publicação supabase_realtime.

-- RLS: permitir leitura e escrita públicas (como no Firestore atual)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em players" ON players;
CREATE POLICY "Permitir tudo em players" ON players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em stats" ON stats;
CREATE POLICY "Permitir tudo em stats" ON stats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em session" ON session;
CREATE POLICY "Permitir tudo em session" ON session FOR ALL USING (true) WITH CHECK (true);
