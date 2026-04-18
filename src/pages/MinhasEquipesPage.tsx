import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Swords, Star, Trash2, Pencil, AlertCircle,
  Calendar, ExternalLink, Trophy,
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import TeamRegistrationWizard, {
  TeamWizardInitialTeam,
  TeamWizardTournament,
} from '../components/TeamRegistrationWizard';

interface TeamRow {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
  coach_name: string | null;
  trainer_name: string | null;
  staff: string[];
  notes: string | null;
  status: 'registered' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
  tournament: {
    id: string;
    name: string;
    slug: string;
    modality: '1x1' | '3x3' | '5x5';
    start_date: string;
    status: string;
    logo_url: string | null;
    players_per_team: number | null;
    players_on_court: number | null;
    is_paid: boolean;
    price_brl: number | null;
  } | null;
  player_count: number;
}

const STATUS_LABEL: Record<string, string> = {
  registered: 'Inscrita',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  withdrawn: 'Retirada',
};

const STATUS_COLORS: Record<string, string> = {
  registered: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  approved: 'bg-green-500/15 text-green-300 border-green-500/25',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/25',
  withdrawn: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

export default function MinhasEquipesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{
    team: TeamWizardInitialTeam;
    tournament: TeamWizardTournament;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('teams')
      .select(`
        id, tournament_id, name, logo_url, coach_name, trainer_name,
        staff, notes, status, created_at,
        tournament:tournaments (
          id, name, slug, modality, start_date, status, logo_url,
          players_per_team, players_on_court, is_paid, price_brl
        ),
        team_players (count)
      `)
      .eq('owner_auth_id', user.id)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setTeams(
      (data ?? []).map((t: any) => ({
        ...t,
        player_count: Array.isArray(t.team_players) ? t.team_players[0]?.count ?? 0 : 0,
      })) as TeamRow[]
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { if (!authLoading) fetchTeams(); }, [fetchTeams, authLoading]);

  const openEdit = async (team: TeamRow) => {
    if (!team.tournament) { setError('Torneio não encontrado para esta equipe.'); return; }
    const { data: players } = await supabase
      .from('team_players')
      .select(`
        id, name, jersey_number, position, is_starter, order_idx, user_id,
        user:basquete_users!team_players_user_id_fkey (
          id, display_name, full_name, email, avatar_url, player_code
        )
      `)
      .eq('team_id', team.id)
      .order('order_idx', { ascending: true });
    setEditing({
      team: {
        id: team.id,
        name: team.name,
        logo_url: team.logo_url,
        coach_name: team.coach_name,
        trainer_name: team.trainer_name,
        staff: team.staff ?? [],
        notes: team.notes,
        players: (players ?? []).map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          user: p.user ?? null,
          name: p.name,
          jersey_number: p.jersey_number,
          position: p.position,
          is_starter: p.is_starter,
        })),
      },
      tournament: {
        id: team.tournament.id,
        name: team.tournament.name,
        modality: team.tournament.modality,
        players_per_team: team.tournament.players_per_team,
        players_on_court: team.tournament.players_on_court,
        is_paid: team.tournament.is_paid,
        price_brl: team.tournament.price_brl,
      },
    });
  };

  const handleDelete = async (id: string) => {
    await supabase.from('teams').delete().eq('id', id);
    setDeleteConfirm(null);
    await fetchTeams();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Entre para ver suas equipes</h1>
          <p className="text-slate-400 text-sm mb-6">
            Faça login para gerenciar as equipes inscritas em torneios.
          </p>
          <button
            onClick={() => navigate('/entrar?redirect=/minhas-equipes')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Início
          </button>
          <h1 className="font-black text-white flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-orange-400" /> Minhas Equipes
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="p-12 rounded-2xl border border-dashed border-slate-800 text-center">
            <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold text-sm">Nenhuma equipe inscrita</p>
            <p className="text-slate-500 text-xs mt-1">
              Encontre um torneio aberto em Eventos e inscreva sua equipe.
            </p>
          </div>
        ) : (
          teams.map((t) => (
            <div key={t.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-start gap-3">
                {t.logo_url ? (
                  <img
                    src={t.logo_url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-slate-600" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white truncate">{t.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  {t.tournament && (
                    <Link
                      to={`/torneios/${t.tournament.slug}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      <Swords className="w-3 h-3" />
                      {t.tournament.name} · {t.tournament.modality}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                    {t.tournament?.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(t.tournament.start_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {t.player_count} jogador{t.player_count !== 1 ? 'es' : ''}
                    </span>
                    {t.coach_name && (
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {t.coach_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {deleteConfirm === t.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all"
                      >
                        Retirar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(t.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <TeamRegistrationWizard
          tournament={editing.tournament}
          userId={user.id}
          initialTeam={editing.team}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await fetchTeams();
          }}
        />
      )}
    </div>
  );
}
