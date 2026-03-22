-- Bucket para imagens de perfil de atletas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket avatars
DROP POLICY IF EXISTS "Avatar público - leitura" ON storage.objects;
-- Leitura pública (qualquer um pode ver avatares)
CREATE POLICY "Avatar público - leitura"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Upload por usuários autenticados em sua própria pasta (auth.uid())
DROP POLICY IF EXISTS "Avatar - upload autenticado" ON storage.objects;
CREATE POLICY "Avatar - upload autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Atualizar próprio arquivo
DROP POLICY IF EXISTS "Avatar - update próprio" ON storage.objects;
CREATE POLICY "Avatar - update próprio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Deletar próprio arquivo
DROP POLICY IF EXISTS "Avatar - delete próprio" ON storage.objects;
CREATE POLICY "Avatar - delete próprio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Tabela basquete_users (caso não exista - ex.: setup via setup_completo.sql)
CREATE TABLE IF NOT EXISTS basquete_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE basquete_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em basquete_users" ON basquete_users;
CREATE POLICY "Permitir tudo em basquete_users" ON basquete_users FOR ALL USING (true) WITH CHECK (true);

-- Campos completos de perfil de atleta em basquete_users
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS height_cm INT CHECK (height_cm IS NULL OR (height_cm >= 100 AND height_cm <= 250));
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS weight_kg INT CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 200));
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IS NULL OR position IN ('Armador', 'Ala-armador', 'Ala', 'Ala-pivô', 'Pivô'));
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS dominant_hand TEXT CHECK (dominant_hand IS NULL OR dominant_hand IN ('Direito', 'Esquerdo', 'Ambidestro'));
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS jersey_number INT CHECK (jersey_number IS NULL OR (jersey_number >= 0 AND jersey_number <= 99));
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS state TEXT;
