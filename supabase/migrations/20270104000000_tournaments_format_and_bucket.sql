-- ============================================================
-- Migration: Tournament format fields + storage bucket
-- Adiciona campos configuráveis de cronômetro/períodos/roster
-- e cria o bucket `tournaments` para armazenar logomarcas.
-- ============================================================

-- 1. Novos campos de configuração da competição
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS players_per_team        INT,
  ADD COLUMN IF NOT EXISTS players_on_court        INT,
  ADD COLUMN IF NOT EXISTS match_duration_minutes  INT,
  ADD COLUMN IF NOT EXISTS periods_count           INT,
  ADD COLUMN IF NOT EXISTS period_duration_minutes INT;

-- 2. Bucket para logomarcas dos torneios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tournaments',
  'tournaments',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas do bucket `tournaments`
-- Leitura pública: todo mundo vê a logo do evento.
DROP POLICY IF EXISTS "tournaments_storage_public_read" ON storage.objects;
CREATE POLICY "tournaments_storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tournaments');

-- Upload: qualquer usuário autenticado pode subir arquivos no bucket
-- (a checagem fina de dono do torneio fica no client/server.ts).
DROP POLICY IF EXISTS "tournaments_storage_authenticated_insert" ON storage.objects;
CREATE POLICY "tournaments_storage_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tournaments');

DROP POLICY IF EXISTS "tournaments_storage_authenticated_update" ON storage.objects;
CREATE POLICY "tournaments_storage_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tournaments')
  WITH CHECK (bucket_id = 'tournaments');

DROP POLICY IF EXISTS "tournaments_storage_authenticated_delete" ON storage.objects;
CREATE POLICY "tournaments_storage_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tournaments');
