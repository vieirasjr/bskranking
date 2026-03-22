-- ============================================
-- BUCKET DE AVATARES + CAMPOS DE PERFIL DE ATLETA
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- Execute após o setup_completo.sql
-- ============================================

-- 1. Bucket para imagens de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas do bucket
DROP POLICY IF EXISTS "Avatar público - leitura" ON storage.objects;
CREATE POLICY "Avatar público - leitura"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar - upload autenticado" ON storage.objects;
CREATE POLICY "Avatar - upload autenticado"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatar - update próprio" ON storage.objects;
CREATE POLICY "Avatar - update próprio"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatar - delete próprio" ON storage.objects;
CREATE POLICY "Avatar - delete próprio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Campos de perfil de atleta em basquete_users
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS height_cm INT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS weight_kg INT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS dominant_hand TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS jersey_number INT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS state TEXT;
