-- Execute no SQL Editor do Supabase para adicionar a tabela de sessões de partida

CREATE TABLE IF NOT EXISTS partida_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  team1_points INT NOT NULL DEFAULT 0,
  team2_points INT NOT NULL DEFAULT 0
);

ALTER TABLE session ADD COLUMN IF NOT EXISTS current_partida_sessao_id UUID REFERENCES partida_sessoes(id) ON DELETE SET NULL;

ALTER TABLE partida_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo em partida_sessoes" ON partida_sessoes FOR ALL USING (true) WITH CHECK (true);
