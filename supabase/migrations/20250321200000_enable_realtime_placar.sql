-- Habilitar Realtime no placar (partida_sessoes) para atualização em tempo real
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE partida_sessoes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
