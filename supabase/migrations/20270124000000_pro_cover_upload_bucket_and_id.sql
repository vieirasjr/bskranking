-- Upload local de capa PRÓ com vínculo por usuário e id da imagem

ALTER TABLE public.basquete_users
ADD COLUMN IF NOT EXISTS pro_cover_image_id TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pro-covers',
  'pro-covers',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Pro cover público - leitura" ON storage.objects;
CREATE POLICY "Pro cover público - leitura"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pro-covers');

DROP POLICY IF EXISTS "Pro cover - upload autenticado" ON storage.objects;
CREATE POLICY "Pro cover - upload autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pro-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Pro cover - update próprio" ON storage.objects;
CREATE POLICY "Pro cover - update próprio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pro-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pro-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Pro cover - delete próprio" ON storage.objects;
CREATE POLICY "Pro cover - delete próprio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pro-covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
