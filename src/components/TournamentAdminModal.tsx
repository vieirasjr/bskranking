import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Users, Swords, Zap, Trash2, AlertCircle, UserCircle,
  Star, RotateCcw, Hand, Sparkles, Shuffle, Check, Beaker,
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import BracketView, { BracketMatch, BracketTeam } from './BracketView';
import {
  generateBracket, FORMAT_LABEL, FORMAT_DESCRIPTION,
  recommendFormat, estimateMatchCount, IMPLEMENTED_FORMATS,
  type TournamentFormat, type SimpleTeam,
} from '../lib/bracket';
import { createMockTeamsForTournament } from '../lib/mockTeams';

interface Tournament {
  id: string;
  name: string;
  max_teams: number | null;
  format: TournamentFormat;
  modality: '1x1' | '3x3' | '5x5';
}

interface TeamEntry {
  id: string;
  name: string;
  logo_url: string | null;
  owner_auth_id: string;
  coach_name: string | null;
  status: string;
  created_at: string;
  player_count: number;
}

interface Props {
  tournament: Tournament;
  onClose: () => void;
}

type DrawMode = 'auto' | 'manual';

export default function TournamentAdminModal({ tournament, onClose }: Props) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [shuffleOverlay, setShuffleOverlay] = useState(false);
  const [manualMode, setManualMode] = useState(false);     // após gerar estrutura vazia
  const [manualAssignments, setManualAssignments] = useState<Record<string, { a: string | null; b: string | null }>>({});
  const [activeFormat, setActiveFormat] = useState<TournamentFormat>(tournament.format);
  const shuffleTimerRef = useRef<number | null>(null);

  // Ajusta o formato ativo ao carregar ou se mudar no DB
  useEffect(() => { setActiveFormat(tournament.format); }, [tournament.format]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: teamData }, { data: matchData }] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, logo_url, owner_auth_id, coach_name, status, created_at, team_players(count)')
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('tournament_matches')
        .select(`
          id, round, position, group_label, team_a_score, team_b_score, winner_id, status,
          next_match_id, next_match_slot,
          team_a:teams!tournament_matches_team_a_id_fkey (id, name, logo_url),
          team_b:teams!tournament_matches_team_b_id_fkey (id, name, logo_url)
        `)
        .eq('tournament_id', tournament.id)
        .order('round', { ascending: true })
        .order('group_label', { ascending: true })
        .order('position', { ascending: true }),
    ]);
    setTeams(
      (teamData ?? []).map((t: any) => ({
        ...t,
        player_count: Array.isArray(t.team_players) ? t.team_players[0]?.count ?? 0 : 0,
      }))
    );
    setMatches(
      (matchData ?? []).map((m: any) => ({
        id: m.id,
        round: m.round,
        position: m.position,
        group_label: m.group_label ?? null,
        team_a: m.team_a as BracketTeam | null,
        team_b: m.team_b as BracketTeam | null,
        team_a_score: m.team_a_score,
        team_b_score: m.team_b_score,
        winner_id: m.winner_id,
        status: m.status,
        next_match_id: m.next_match_id,
        next_match_slot: m.next_match_slot,
      }))
    );
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const persistBracket = async (simpleTeams: SimpleTeam[], emptyFirstRound = false) => {
    // Apaga chaveamento existente (admin pode regenerar)
    await supabase.from('tournament_matches').delete().eq('tournament_id', tournament.id);

    // Se o admin mudou o formato antes de gerar, persiste na tabela tournaments
    if (activeFormat !== tournament.format) {
      await supabase.from('tournaments').update({ format: activeFormat }).eq('id', tournament.id);
    }

    const generated = generateBracket(activeFormat, simpleTeams);
    if (emptyFirstRound) {
      generated.forEach((m) => {
        if (m.round === 1) {
          m.team_a_id = null;
          m.team_b_id = null;
          m.status = 'pending';
        }
      });
    }

    const rowsInitial = generated.map((g) => ({
      tournament_id: tournament.id,
      round: g.round,
      position: g.position,
      team_a_id: g.team_a_id,
      team_b_id: g.team_b_id,
      status: g.status,
      group_label: g.group_label ?? null,
    }));
    const { data: inserted, error: iErr } = await supabase
      .from('tournament_matches')
      .insert(rowsInitial)
      .select('id, round, position');
    if (iErr) throw new Error(iErr.message);

    const byRoundPos = new Map<string, string>();
    (inserted ?? []).forEach((m: any) => {
      byRoundPos.set(`${m.round}:${m.position}:${m.group_label ?? ''}`, m.id);
    });

    const updates = generated
      .map((g) => {
        if (g.next_index === undefined) return null;
        const self = byRoundPos.get(`${g.round}:${g.position}:${g.group_label ?? ''}`);
        const nextGen = generated[g.next_index];
        const next = byRoundPos.get(`${nextGen.round}:${nextGen.position}:${nextGen.group_label ?? ''}`);
        if (!self || !next) return null;
        return { id: self, next_match_id: next, next_match_slot: g.next_slot ?? null };
      })
      .filter((u): u is { id: string; next_match_id: string; next_match_slot: 'A' | 'B' | null } => !!u);

    for (const u of updates) {
      await supabase.from('tournament_matches')
        .update({ next_match_id: u.next_match_id, next_match_slot: u.next_match_slot })
        .eq('id', u.id);
    }
  };

  const handleAutoDraw = async () => {
    setError(null);
    if (teams.length < 2) { setError('Pelo menos 2 equipes precisam estar inscritas.'); return; }
    setGenerating(true);
    setShuffleOverlay(true);

    const simpleTeams: SimpleTeam[] = teams.map((t) => ({ id: t.id, name: t.name, logo_url: t.logo_url }));

    try {
      // Animação de 1.6s em paralelo com geração
      const animPromise = new Promise<void>((resolve) => {
        shuffleTimerRef.current = window.setTimeout(resolve, 1600);
      });
      await Promise.all([animPromise, persistBracket(simpleTeams, false)]);
      setShuffleOverlay(false);
      await fetchAll();
    } catch (e: any) {
      setError(e.message ?? 'Erro ao gerar chaveamento.');
      setShuffleOverlay(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleStartManual = async () => {
    setError(null);
    if (teams.length < 2) { setError('Pelo menos 2 equipes precisam estar inscritas.'); return; }
    setGenerating(true);
    const simpleTeams: SimpleTeam[] = teams.map((t) => ({ id: t.id, name: t.name, logo_url: t.logo_url }));
    try {
      await persistBracket(simpleTeams, true); // gera estrutura com R1 vazia
      setManualMode(true);
      setManualAssignments({});
      await fetchAll();
    } catch (e: any) {
      setError(e.message ?? 'Erro ao iniciar chaveamento manual.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveManual = async () => {
    setError(null);
    setGenerating(true);
    try {
      const firstRound = matches.filter((m) => m.round === 1);
      // Validação: nenhuma equipe repetida
      const picked: string[] = [];
      for (const m of firstRound) {
        const a = manualAssignments[m.id]?.a ?? null;
        const b = manualAssignments[m.id]?.b ?? null;
        if (a) picked.push(a);
        if (b) picked.push(b);
      }
      if (new Set(picked).size !== picked.length) {
        setError('Equipe atribuída em mais de um confronto.');
        setGenerating(false);
        return;
      }

      for (const m of firstRound) {
        const a = manualAssignments[m.id]?.a ?? null;
        const b = manualAssignments[m.id]?.b ?? null;
        await supabase.from('tournament_matches')
          .update({
            team_a_id: a,
            team_b_id: b,
            status: a && b ? 'pending' : (a || b ? 'bye' : 'pending'),
          })
          .eq('id', m.id);
      }
      setManualMode(false);
      setManualAssignments({});
      await fetchAll();
    } finally {
      setGenerating(false);
    }
  };

  const handleSeedMocks = async () => {
    if (!user?.id) return;
    setError(null);
    setSeeding(true);
    const { error: err } = await createMockTeamsForTournament(tournament.id, user.id, 10);
    if (err) setError(err);
    setSeeding(false);
    await fetchAll();
  };

  useEffect(() => () => {
    if (shuffleTimerRef.current) window.clearTimeout(shuffleTimerRef.current);
  }, []);

  const handleResetBracket = async () => {
    setError(null);
    await supabase.from('tournament_matches').delete().eq('tournament_id', tournament.id);
    setResetConfirm(false);
    await fetchAll();
  };

  const handleRemoveTeam = async (teamId: string) => {
    await supabase.from('teams').delete().eq('id', teamId);
    await fetchAll();
  };

  const used = teams.length;
  const cap = tournament.max_teams ?? '—';
  const hasBracket = matches.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="w-full h-full flex flex-col bg-slate-900">
        <div className="px-5 pt-5 pb-3 border-b border-slate-800 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-black text-white text-lg truncate">{tournament.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tournament.modality} · {FORMAT_LABEL[tournament.format]} · {used}/{cap} equipes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Equipes inscritas */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" /> Equipes inscritas ({used})
              </h3>
              {teams.length < 2 && !hasBracket && (
                <button
                  onClick={handleSeedMocks}
                  disabled={seeding}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Beaker className="w-3.5 h-3.5" />
                  {seeding ? 'Criando...' : 'Criar 10 equipes de teste'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : teams.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center">
                <UserCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-semibold">Nenhuma equipe inscrita</p>
                <p className="text-xs text-slate-500 mt-1">
                  Compartilhe o link de inscrição para receber equipes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {teams.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 flex items-center gap-3">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate text-sm">{t.name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" /> {t.player_count} jog.
                        </span>
                        {t.coach_name && <span className="truncate">· {t.coach_name}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveTeam(t.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                      title="Remover equipe"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Chaveamento */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-orange-400" /> Chaveamento
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {hasBracket && !manualMode && !resetConfirm && (
                  <button
                    onClick={() => setResetConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Regenerar
                  </button>
                )}
                {resetConfirm && (
                  <>
                    <button
                      onClick={handleResetBracket}
                      className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold"
                    >
                      Confirmar reset
                    </button>
                    <button
                      onClick={() => setResetConfirm(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            {!hasBracket && !manualMode && (
              <>
                <FormatPicker
                  active={activeFormat}
                  onChange={setActiveFormat}
                  teamsCount={teams.length}
                  originalFormat={tournament.format}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <button
                  onClick={handleAutoDraw}
                  disabled={generating || teams.length < 2}
                  className="p-5 rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-900 hover:border-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
                      <Shuffle className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-white">Sorteio automático</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    O sistema embaralha as equipes e define os confrontos aleatoriamente com animação ao vivo.
                  </p>
                </button>

                <button
                  onClick={handleStartManual}
                  disabled={generating || teams.length < 2}
                  className="p-5 rounded-2xl border border-slate-700 bg-slate-900 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                      <Hand className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-white">Chaveamento manual</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você já fez o sorteio por fora. Atribua cada equipe aos slots da 1ª rodada manualmente.
                  </p>
                </button>
              </div>
              </>
            )}

            {manualMode && (
              <ManualAssignmentUI
                matches={matches}
                teams={teams}
                assignments={manualAssignments}
                onChange={setManualAssignments}
                onCancel={async () => {
                  await supabase.from('tournament_matches').delete().eq('tournament_id', tournament.id);
                  setManualMode(false);
                  setManualAssignments({});
                  await fetchAll();
                }}
                onSave={handleSaveManual}
                saving={generating}
              />
            )}

            {hasBracket && !manualMode && (
              <BracketView format={tournament.format} matches={matches} />
            )}
          </section>
        </div>
      </div>

      {shuffleOverlay && <ShuffleOverlay teams={teams} />}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Overlay do sorteio automático
// ───────────────────────────────────────────────────────────
function ShuffleOverlay({ teams }: { teams: TeamEntry[] }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <Sparkles className="w-10 h-10 text-orange-400 mx-auto mb-2 animate-pulse" />
        <p className="text-white font-black text-xl">Sorteando confrontos...</p>
      </div>
      <div className="relative w-[min(90vw,520px)] h-[min(60vh,360px)]">
        {teams.map((t, i) => {
          // posições iniciais aleatórias via CSS var
          const delay = (i * 0.08) % 1;
          const randX = (i * 73) % 100;
          const randY = (i * 41) % 100;
          return (
            <div
              key={t.id}
              className="absolute w-12 h-12 rounded-full border-2 border-orange-500/60 bg-slate-900 overflow-hidden shadow-lg shadow-orange-500/20"
              style={{
                left: `${randX}%`,
                top: `${randY}%`,
                animation: `tourney-shuffle 1.6s cubic-bezier(.4,0,.2,1) ${delay}s`,
              }}
            >
              {t.logo_url ? (
                <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-orange-300 font-bold text-sm">
                  {t.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
        <style>{`
          @keyframes tourney-shuffle {
            0%   { transform: translate(0,0)       rotate(0deg)   scale(1);   }
            25%  { transform: translate(40px,-20px) rotate(90deg)  scale(1.1); }
            50%  { transform: translate(-30px,30px) rotate(180deg) scale(0.9); }
            75%  { transform: translate(20px,-10px) rotate(270deg) scale(1.1); }
            100% { transform: translate(0,0)       rotate(360deg) scale(1);   }
          }
        `}</style>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// UI de atribuição manual dos slots
// ───────────────────────────────────────────────────────────
function ManualAssignmentUI({
  matches,
  teams,
  assignments,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  matches: BracketMatch[];
  teams: TeamEntry[];
  assignments: Record<string, { a: string | null; b: string | null }>;
  onChange: (a: Record<string, { a: string | null; b: string | null }>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const firstRound = matches
    .filter((m) => m.round === 1)
    .sort((a, b) => {
      const g = (x: BracketMatch) => x.group_label ?? '';
      const c = g(a).localeCompare(g(b));
      if (c !== 0) return c;
      return a.position - b.position;
    });

  const pickedIds = new Set<string>();
  Object.values(assignments).forEach((v) => {
    if (v.a) pickedIds.add(v.a);
    if (v.b) pickedIds.add(v.b);
  });

  const setSlot = (matchId: string, slot: 'a' | 'b', teamId: string) => {
    const current = assignments[matchId] ?? { a: null, b: null };
    onChange({ ...assignments, [matchId]: { ...current, [slot]: teamId || null } });
  };

  const allFilled = firstRound.every((m) => {
    const a = assignments[m.id]?.a;
    const b = assignments[m.id]?.b;
    return a && b;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-xs text-slate-300">
        <Hand className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-400" />
        Atribua as {teams.length} equipes aos {firstRound.length} confrontos da primeira rodada. As rodadas seguintes são preenchidas conforme os vencedores avançam.
      </div>

      <div className="space-y-2">
        {firstRound.map((m, idx) => (
          <div key={m.id} className="p-3 rounded-xl border border-slate-700 bg-slate-800/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Confronto {idx + 1}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <TeamSlotSelect
                value={assignments[m.id]?.a ?? ''}
                teams={teams}
                pickedIds={pickedIds}
                currentId={assignments[m.id]?.a ?? null}
                onChange={(v) => setSlot(m.id, 'a', v)}
              />
              <span className="text-[10px] font-bold text-slate-500 text-center">VS</span>
              <TeamSlotSelect
                value={assignments[m.id]?.b ?? ''}
                teams={teams}
                pickedIds={pickedIds}
                currentId={assignments[m.id]?.b ?? null}
                onChange={(v) => setSlot(m.id, 'b', v)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={!allFilled || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar chaveamento'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Picker de formato com recomendação e contagem de jogos
// ───────────────────────────────────────────────────────────
function FormatPicker({
  active,
  onChange,
  teamsCount,
  originalFormat,
}: {
  active: TournamentFormat;
  onChange: (f: TournamentFormat) => void;
  teamsCount: number;
  originalFormat: TournamentFormat;
}) {
  const recommended = recommendFormat(teamsCount);
  const matchesActive = estimateMatchCount(active, teamsCount);
  const matchesRec = estimateMatchCount(recommended, teamsCount);
  const mismatch = teamsCount >= 2 && active !== recommended;
  const notImplemented = !IMPLEMENTED_FORMATS.includes(active);

  return (
    <div className="mb-3 p-3 rounded-xl border border-slate-800 bg-slate-800/40 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Formato do chaveamento
          </p>
          <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <p className="font-bold text-white text-sm">{FORMAT_LABEL[active]}</p>
            <span className="text-xs text-slate-500">
              {teamsCount >= 2 ? (
                <>· <span className="font-mono font-bold text-white">{matchesActive}</span> jogo{matchesActive !== 1 ? 's' : ''} previsto{matchesActive !== 1 ? 's' : ''} com {teamsCount} equipes</>
              ) : (
                '· adicione equipes para ver a previsão'
              )}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{FORMAT_DESCRIPTION[active]}</p>
        </div>
        <select
          value={active}
          onChange={(e) => onChange(e.target.value as TournamentFormat)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/50 shrink-0"
        >
          {IMPLEMENTED_FORMATS.map((f) => (
            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
          ))}
          {(['GROUP_STAGE','DOUBLE_ELIMINATION','CROSS_GROUPS','HOME_AWAY','SWISS'] as TournamentFormat[]).map((f) => (
            <option key={f} value={f} disabled>{FORMAT_LABEL[f]} (em breve)</option>
          ))}
        </select>
      </div>

      {notImplemented && (
        <div className="flex items-start gap-1.5 text-xs text-amber-300 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            A geração automática para <strong>{FORMAT_LABEL[active]}</strong> ainda não está disponível — o sistema vai usar Mata-mata como fallback.
          </span>
        </div>
      )}

      {mismatch && (
        <div className="flex items-start gap-1.5 text-xs text-amber-300 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            Para <strong>{teamsCount}</strong> equipes recomendamos <strong>{FORMAT_LABEL[recommended]}</strong>
            {' '}({matchesRec} jogos) para evitar slots vazios no chaveamento.
            <button
              onClick={() => onChange(recommended)}
              className="ml-1 underline font-semibold hover:text-amber-200"
            >
              Alterar para {FORMAT_LABEL[recommended]}
            </button>
          </div>
        </div>
      )}

      {active !== originalFormat && (
        <p className="text-[11px] text-slate-500">
          Ao gerar o chaveamento, o formato do torneio será atualizado de{' '}
          <span className="text-slate-400">{FORMAT_LABEL[originalFormat]}</span> para{' '}
          <span className="text-orange-300 font-semibold">{FORMAT_LABEL[active]}</span>.
        </p>
      )}
    </div>
  );
}

function TeamSlotSelect({
  value,
  teams,
  pickedIds,
  currentId,
  onChange,
}: {
  value: string;
  teams: TeamEntry[];
  pickedIds: Set<string>;
  currentId: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
    >
      <option value="">Selecione uma equipe</option>
      {teams.map((t) => (
        <option
          key={t.id}
          value={t.id}
          disabled={pickedIds.has(t.id) && t.id !== currentId}
        >
          {t.name}{pickedIds.has(t.id) && t.id !== currentId ? ' (já escolhida)' : ''}
        </option>
      ))}
    </select>
  );
}
