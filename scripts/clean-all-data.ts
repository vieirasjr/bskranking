/**
 * Limpa todos os dados de teste para uso com pessoas reais.
 * Remove: jogadores, estatísticas, partidas, sessões de partida.
 * Uso: npx tsx scripts/clean-all-data.ts
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

async function main() {
  console.log('Limpando todos os dados de teste...\n');

  const { error: sessionErr } = await supabase
    .from('session')
    .update({
      is_started: false,
      started_at: null,
      current_partida_sessao_id: null,
      timer_seconds: 0,
      timer_running: false,
      timer_last_sync_at: null,
      timer_started_once: false,
    })
    .eq('id', 'current');
  if (sessionErr) {
    console.warn('Aviso ao resetar sessão (execute migrations do timer se necessário):', sessionErr.message);
    await supabase.from('session').update({ is_started: false, started_at: null, current_partida_sessao_id: null }).eq('id', 'current');
  }
  console.log('✓ Sessão resetada');

  const { error: partidaSessoesErr } = await supabase.from('partida_sessoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (partidaSessoesErr) {
    console.error('Erro ao deletar partida_sessoes:', partidaSessoesErr.message);
  } else {
    console.log('✓ Sessões de partida removidas');
  }

  const { error: partidasErr } = await supabase.from('partidas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (partidasErr) {
    if (partidasErr.code === '42P01') {
      console.log('(tabela partidas não existe - ok)');
    } else {
      console.error('Erro ao deletar partidas:', partidasErr.message);
    }
  } else {
    console.log('✓ Histórico de partidas removido');
  }

  const { error: playersErr } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (playersErr) {
    console.error('Erro ao deletar jogadores:', playersErr.message);
  } else {
    console.log('✓ Todos os jogadores removidos');
  }

  const { error: statsErr } = await supabase.from('stats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (statsErr) {
    console.error('Erro ao deletar estatísticas:', statsErr.message);
  } else {
    console.log('✓ Todas as estatísticas removidas');
  }

  console.log('\nPronto! Sistema zerado para uso com pessoas reais.');
}

main().catch(console.error);
