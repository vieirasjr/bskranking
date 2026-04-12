/**
 * Otimiza todos os avatares existentes no Supabase Storage.
 * - Converte para WebP 512×512 (mesma qualidade, ~70% menor)
 * - Atualiza a URL no basquete_users
 * - Remove o arquivo antigo se a extensão mudou
 *
 * Uso: npx tsx scripts/optimize-avatars.ts
 *
 * Pode ser executado várias vezes com segurança — pula imagens já otimizadas.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const MAX_SIZE = 512;
const WEBP_QUALITY = 82;

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Variáveis obrigatórias no .env:\n' +
    '  VITE_SUPABASE_URL\n' +
    '  VITE_SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY para acesso total)',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface UserRow {
  id: string;
  avatar_url: string;
}

async function main() {
  console.log('Buscando usuários com avatar...\n');

  const { data: users, error } = await supabase
    .from('basquete_users')
    .select('id, avatar_url')
    .not('avatar_url', 'is', null)
    .neq('avatar_url', '');

  if (error) {
    console.error('Erro ao buscar usuários:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('Nenhum avatar encontrado. Nada a fazer.');
    return;
  }

  console.log(`Encontrados ${users.length} avatar(es) para processar.\n`);

  let optimized = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users as UserRow[]) {
    const url = user.avatar_url;
    // Extrai o path relativo ao bucket (tudo após /avatars/)
    const match = url.match(/\/avatars\/(.+?)(\?.*)?$/);
    if (!match) {
      console.warn(`  [!] URL inválida para ${user.id}: ${url}`);
      errors++;
      continue;
    }

    const storagePath = decodeURIComponent(match[1]);

    // Pula se já é .webp otimizado (re-execução segura)
    if (storagePath.endsWith('.webp')) {
      console.log(`  [-] ${user.id} já é WebP, pulando.`);
      skipped++;
      continue;
    }

    try {
      // 1. Baixa a imagem original
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('avatars')
        .download(storagePath);

      if (downloadError || !fileData) {
        console.warn(`  [!] Erro ao baixar ${storagePath}: ${downloadError?.message}`);
        errors++;
        continue;
      }

      const originalBuffer = Buffer.from(await fileData.arrayBuffer());
      const originalKB = (originalBuffer.length / 1024).toFixed(1);

      // 2. Converte para WebP 512×512
      const optimizedBuffer = await sharp(originalBuffer)
        .resize(MAX_SIZE, MAX_SIZE, { fit: 'cover' })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const newKB = (optimizedBuffer.length / 1024).toFixed(1);

      // 3. Upload do arquivo otimizado
      const userId = storagePath.split('/')[0];
      const newPath = `${userId}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(newPath, optimizedBuffer, {
          upsert: true,
          contentType: 'image/webp',
        });

      if (uploadError) {
        console.warn(`  [!] Erro ao enviar ${newPath}: ${uploadError.message}`);
        errors++;
        continue;
      }

      // 4. Gera a URL pública e atualiza no banco
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(newPath);

      const freshUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('basquete_users')
        .update({ avatar_url: freshUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.warn(`  [!] Erro ao atualizar DB para ${user.id}: ${updateError.message}`);
        errors++;
        continue;
      }

      // 5. Remove o arquivo antigo se diferente do novo
      if (storagePath !== newPath) {
        await supabase.storage.from('avatars').remove([storagePath]);
      }

      console.log(`  [OK] ${user.id}: ${originalKB}KB → ${newKB}KB (${storagePath} → ${newPath})`);
      optimized++;
    } catch (err) {
      console.error(`  [!] Erro inesperado para ${user.id}:`, err);
      errors++;
    }
  }

  console.log(`\nResultado:`);
  console.log(`  Otimizados: ${optimized}`);
  console.log(`  Já WebP:    ${skipped}`);
  console.log(`  Erros:      ${errors}`);
  console.log(`  Total:      ${users.length}`);
}

main().catch(console.error);
