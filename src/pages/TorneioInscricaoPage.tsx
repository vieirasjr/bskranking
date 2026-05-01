import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Swords, Calendar, MapPin, Users, Trophy, Lock,
  ExternalLink, FileText, Phone, User, AlertCircle, ArrowLeft,
  Timer, Clock, CheckCircle2, Pencil,
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import TeamRegistrationWizard, { TeamWizardInitialTeam } from '../components/TeamRegistrationWizard';
import BracketView, { BracketMatch, BracketTeam } from '../components/BracketView';
import { FORMAT_LABEL, type TournamentFormat } from '../lib/bracket';

interface Tournament {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  start_date: string;
  end_date: string | null;
  responsible_name: string | null;
  responsible_contact: string | null;
  location_id: string | null;
  modality: '1x1' | '3x3' | '5x5';
  gender: 'MALE' | 'FEMALE' | 'MIXED' | 'OPEN';
  max_teams: number | null;
  players_per_team: number | null;
  players_on_court: number | null;
  match_duration_minutes: number | null;
  periods_count: number | null;
  period_duration_minutes: number | null;
  is_paid: boolean;
  price_brl: number | null;
  rules_md: string | null;
  rules_document_url: string | null;
  status: 'draft' | 'open' | 'closed' | 'in_progress' | 'finished' | 'cancelled';
  visibility: 'global' | 'tenant' | 'private';
  format: TournamentFormat;
}

const GENDER_LABEL: Record<string, string> = {
  OPEN: 'Aberto', MALE: 'Masculino', FEMALE: 'Feminino', MIXED: 'Misto',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  open: 'Inscrições abertas',
  closed: 'Inscrições encerradas',
  in_progress: 'Em andamento',
  finished: 'Encerrado',
  cancelled: 'Cancelado',
};

export default function TorneioInscricaoPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [existingTeam, setExistingTeam] = useState<TeamWizardInitialTeam | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setT(data as Tournament);
      if (data.location_id) {
        const { data: loc } = await supabase
          .from('locations')
          .select('name')
          .eq('id', data.location_id)
          .maybeSingle();
        setLocationName(loc?.name ?? null);
      }
      setLoading(false);
    })();
  }, [slug]);

  const fetchExistingTeam = useCallback(async () => {
    if (!t?.id || !user?.id) { setExistingTeam(null); return; }
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, logo_url, coach_name, trainer_name, staff, notes')
      .eq('tournament_id', t.id)
      .eq('owner_auth_id', user.id)
      .maybeSingle();
    if (!team) { setExistingTeam(null); return; }
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
    setExistingTeam({
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
    });
  }, [t?.id, user?.id]);

  useEffect(() => { fetchExistingTeam(); }, [fetchExistingTeam]);

  useEffect(() => {
    if (!t?.id) return;
    supabase
      .from('tournament_matches')
      .select(`
        id, round, position, group_label, team_a_score, team_b_score, winner_id, status,
        next_match_id, next_match_slot,
        team_a:teams!tournament_matches_team_a_id_fkey (id, name, logo_url),
        team_b:teams!tournament_matches_team_b_id_fkey (id, name, logo_url)
      `)
      .eq('tournament_id', t.id)
      .order('round', { ascending: true })
      .order('group_label', { ascending: true })
      .order('position', { ascending: true })
      .then(({ data }) => {
        setBracketMatches(
          (data ?? []).map((m: any) => ({
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
      });
  }, [t?.id]);

  const handleInscribeClick = () => {
    if (!user) {
      navigate(`/entrar?redirect=${encodeURIComponent(`/torneios/${slug}`)}`);
      return;
    }
    setShowWizard(true);
  };

  const handleWizardSaved = async () => {
    setShowWizard(false);
    setJustRegistered(true);
    await fetchExistingTeam();
    setTimeout(() => setJustRegistered(false), 3500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !t) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Torneio não encontrado</h1>
          <p className="text-slate-400 text-sm mb-6">O link pode estar incorreto ou o evento foi removido.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all">
            <ArrowLeft className="w-4 h-4" /> Voltar para início
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = t.status === 'draft';
  const isOpen = t.status === 'open';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="relative border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-5 py-8 md:py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Braska
          </Link>

          <div className="flex items-start gap-5 flex-col sm:flex-row">
            {t.logo_url ? (
              <img
                src={t.logo_url}
                alt={t.name}
                className="w-24 h-24 rounded-2xl object-cover border border-slate-800 shrink-0"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Swords className="w-10 h-10 text-orange-400" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
                  Torneio · {t.modality} · {GENDER_LABEL[t.gender]}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  isOpen
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}>
                  {STATUS_LABEL[t.status]}
                </span>
                {t.visibility === 'private' && (
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Privado
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-white">{t.name}</h1>
              {t.description && (
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">{t.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        {/* Info básica */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard icon={Calendar} label="Data de início">
            {new Date(t.start_date + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            })}
          </InfoCard>
          {t.end_date && (
            <InfoCard icon={Calendar} label="Data de término">
              {new Date(t.end_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </InfoCard>
          )}
          {locationName && (
            <InfoCard icon={MapPin} label="Local">{locationName}</InfoCard>
          )}
          <InfoCard icon={Trophy} label="Inscrição">
            {t.is_paid && t.price_brl ? (
              <span className="text-emerald-400 font-bold">
                R$ {(t.price_brl / 100).toFixed(2).replace('.', ',')} por equipe
              </span>
            ) : (
              <span className="text-emerald-400 font-bold">Gratuito</span>
            )}
          </InfoCard>
          {t.max_teams && (
            <InfoCard icon={Users} label="Vagas">{t.max_teams} equipes</InfoCard>
          )}
          {t.players_per_team && (
            <InfoCard icon={Users} label="Elenco">
              {t.players_per_team} jogadores por equipe
              {t.players_on_court && (
                <span className="block text-xs text-slate-500 mt-0.5">
                  {t.players_on_court} em quadra
                </span>
              )}
            </InfoCard>
          )}
          {t.periods_count && t.period_duration_minutes && (
            <InfoCard icon={Timer} label="Partida">
              {t.periods_count} {t.periods_count > 1 ? 'períodos' : 'período'} de {t.period_duration_minutes} min
              <span className="block text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Total: {t.match_duration_minutes ?? t.periods_count * t.period_duration_minutes} min
              </span>
            </InfoCard>
          )}
          {t.responsible_name && (
            <InfoCard icon={User} label="Responsável">
              {t.responsible_name}
              {t.responsible_contact && (
                <span className="block text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {t.responsible_contact}
                </span>
              )}
            </InfoCard>
          )}
        </div>

        {/* CTA de inscrição */}
        <div className="p-6 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              {existingTeam ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Users className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">
                {existingTeam ? `Equipe inscrita: ${existingTeam.name}` : 'Inscrição de equipes'}
              </h3>
              {isDraft ? (
                <p className="text-sm text-slate-400">
                  Este torneio ainda está em rascunho. As inscrições serão liberadas quando o organizador publicar.
                </p>
              ) : isOpen ? (
                existingTeam ? (
                  <>
                    {justRegistered && (
                      <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Salvo com sucesso.
                      </p>
                    )}
                    <p className="text-sm text-slate-300 mb-3">
                      Você já tem uma equipe inscrita neste torneio. Gerencie os jogadores, logotipo e informações a qualquer momento.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setShowWizard(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all"
                      >
                        <Pencil className="w-4 h-4" /> Editar inscrição
                      </button>
                      <Link
                        to="/minhas-equipes"
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all"
                      >
                        <Users className="w-4 h-4" /> Minhas Equipes
                      </Link>
                    </div>
                  </>
                ) : t.is_paid ? (
                  <>
                    <p className="text-sm text-slate-300 mb-2">
                      Este é um torneio pago (R$ {t.price_brl ? (t.price_brl / 100).toFixed(2).replace('.', ',') : '—'} por equipe).
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      O pagamento e inscrição integrados estarão disponíveis em breve.
                    </p>
                    <button
                      disabled
                      className="px-4 py-2.5 rounded-xl bg-orange-500/40 text-white font-bold text-sm cursor-not-allowed"
                    >
                      Pagar e inscrever (em breve)
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-300 mb-4">
                      As inscrições estão abertas. Cadastre sua equipe com técnico e elenco em poucos passos.
                    </p>
                    <button
                      onClick={handleInscribeClick}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all"
                    >
                      <Users className="w-4 h-4" />
                      {user ? 'Inscrever equipe' : 'Entrar e inscrever equipe'}
                    </button>
                  </>
                )
              ) : (
                <p className="text-sm text-slate-400">
                  Status atual: {STATUS_LABEL[t.status]}. Novas inscrições não estão sendo aceitas.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Chaveamento */}
        {bracketMatches.length > 0 && (
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-orange-400" /> Chaveamento
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {FORMAT_LABEL[t.format]}
              </span>
            </div>
            <BracketView format={t.format} matches={bracketMatches} />
          </div>
        )}

        {/* Regras */}
        {(t.rules_md || t.rules_document_url) && (
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" /> Regras oficiais
              </h3>
              {t.rules_document_url && (
                <a
                  href={t.rules_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Documento completo
                </a>
              )}
            </div>
            {t.rules_md && (
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[520px] overflow-y-auto pr-2">
                {t.rules_md}
              </div>
            )}
          </div>
        )}
      </div>

      {showWizard && user && t && (
        <TeamRegistrationWizard
          tournament={{
            id: t.id,
            name: t.name,
            modality: t.modality,
            players_per_team: t.players_per_team,
            players_on_court: t.players_on_court,
            is_paid: t.is_paid,
            price_brl: t.price_brl,
          }}
          userId={user.id}
          initialTeam={existingTeam}
          onClose={() => setShowWizard(false)}
          onSaved={handleWizardSaved}
        />
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-sm text-white">{children}</div>
    </div>
  );
}
