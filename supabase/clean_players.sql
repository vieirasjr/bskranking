-- Execute no SQL Editor do Supabase para remover jogadores da fila
-- ATENÇÃO: Se o ranking (stats) ainda mostra jogadores fictícios, use clean_all_mock_data.sql
-- pois stats são recriadas quando jogadores da fila jogam partidas
DELETE FROM players;
