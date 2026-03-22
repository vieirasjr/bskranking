/**
 * Script para simular carga: insere 30 jogadores na lista de espera.
 * Uso: npx tsx scripts/seed-30-players.ts
 * Requer .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const NOMES = [
  'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Julia', 'Rafael', 'Fernanda',
  'Bruno', 'Carolina', 'Gabriel', 'Isabela', 'Matheus', 'Larissa', 'Felipe',
  'Amanda', 'Diego', 'Camila', 'Thiago', 'Beatriz', 'Rodrigo', 'Mariana',
  'Gustavo', 'Letícia', 'Leonardo', 'Natália', 'Vinícius', 'Paula', 'Ricardo', 'Renata',
];

async function main() {
  console.log('Limpando jogadores existentes...');
  const { error: delErr } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.warn('Aviso ao limpar:', delErr.message);

  console.log('Inserindo 30 jogadores na lista de espera...');
  const baseTime = Date.now() - 60 * 1000;
  for (let i = 0; i < NOMES.length; i++) {
    const joinedAt = new Date(baseTime + i * 2000).toISOString();
    const { error } = await supabase.from('players').insert({
      name: NOMES[i],
      status: 'waiting',
      joined_at: joinedAt,
    });
    if (error) {
      console.error(`Erro ao inserir ${NOMES[i]}:`, error.message);
    } else {
      console.log(`  ✓ ${i + 1}/30 ${NOMES[i]}`);
    }
  }

  console.log('\nPronto! 30 jogadores adicionados. Abra o app na aba Lista para ver o cronômetro.');
}

main().catch(console.error);
