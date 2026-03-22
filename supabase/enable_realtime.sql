-- Execute no SQL Editor do Supabase para habilitar atualização em tempo real
-- Pode rodar várias vezes; tabelas já na publicação são ignoradas (erro 42710)

-- players
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE players;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;

-- session
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE session;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;

-- partida_sessoes
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE partida_sessoes;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;

-- stats
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE stats;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
