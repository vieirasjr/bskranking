-- Habilitar Realtime no placar (partida_sessoes) para atualização em tempo real
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE partida_sessoes;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;  -- já na publicação
END $$;
