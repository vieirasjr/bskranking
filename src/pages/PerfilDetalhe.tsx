import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  User,
  ChevronRight,
  MapPin,
  Ruler,
  Scale,
  Crown,
  Link2,
  Share2,
  Download,
  Radio,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toBlob, toPng } from 'html-to-image';
import { supabase } from '../supabase';
import StatsEvolutionChart from '../components/StatsEvolutionChart';
import SkillsRadar from '../components/SkillsRadar';
import { appPublicOrigin } from '../lib/publicAppUrl';
import type { ProShareCardData } from '../components/ProShareCard';
import ProShareCard from '../components/ProShareCard';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export interface PerfilDetalheData {
  id: string;
  user_id?: string | null;
  name: string;
  partidas: number;
  wins: number;
  points: number;
  blocks: number;
  steals: number;
  clutch_points: number;
  assists: number;
  rebounds: number;
  shot_1_miss?: number;
  shot_2_miss?: number;
  shot_3_miss?: number;
  turnovers?: number;
  avatar_url?: string | null;
}

interface ProfileExtra {
  id: string;
  auth_id: string | null;
  position: string | null;
  jersey_number: number | null;
  bio: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  city: string | null;
  state: string | null;
  is_pro: boolean | null;
  pro_cover_image_url: string | null;
  pro_profile_tagline: string | null;
  pro_athlete_resume: string | null;
  pro_sponsors: Array<{ name?: string; logo_url?: string; link_url?: string }> | null;
}

interface PerfilDetalheProps {
  data: PerfilDetalheData;
  darkMode: boolean;
  onBack: () => void;
}

type PerfMode = 'total' | 'perGame';
type CardActionType = 'publish' | 'share' | 'save';
type ShareTarget = 'generic' | 'instagram';
type CardRenderFormat = 'feed' | 'story';

interface SessionCardOption {
  id: string;
  representative_partida_id: string;
  location_id: string | null;
  partidas_count: number;
  started_at: string;
  ended_at: string | null;
  metrics: {
    partidas: number;
    pontos: number;
    winRate: number;
  };
}

function computePlayerScore(d: PerfilDetalheData): string {
  const acertos =
    (d.points ?? 0) * 1.0 +
    (d.assists ?? 0) * 1.5 +
    (d.rebounds ?? 0) * 1.2 +
    (d.blocks ?? 0) * 1.5 +
    (d.steals ?? 0) * 1.3 +
    (d.clutch_points ?? 0) * 2.0 +
    (d.wins ?? 0) * 3.0;
  const erros =
    (d.shot_1_miss ?? 0) * 0.4 +
    (d.shot_2_miss ?? 0) * 0.8 +
    (d.shot_3_miss ?? 0) * 1.2 +
    (d.turnovers ?? 0) * 1.0;
  return Math.max(0, acertos - erros).toFixed(1);
}

function getStatListValue(data: PerfilDetalheData, key: keyof PerfilDetalheData, mode: PerfMode): string {
  const pj = Math.max(data.partidas, 1);
  const t = Number(data[key]) || 0;
  if (mode === 'total') return String(Math.round(t));
  if (key === 'wins') return `${Math.min(100, Math.round((data.wins / pj) * 100))}%`;
  const v = t / pj;
  return v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/* ── Lista estilo "Performed Training" ───────────────────────────── */
const STAT_ROWS: { key: keyof PerfilDetalheData; label: string; emoji: string }[] = [
  { key: 'points',        label: 'Pontos',       emoji: '🏀' },
  { key: 'assists',       label: 'Assistências', emoji: '🤝' },
  { key: 'rebounds',      label: 'Rebotes',      emoji: '📏' },
  { key: 'blocks',        label: 'Tocos',        emoji: '🛡️' },
  { key: 'steals',        label: 'Roubos',       emoji: '⚡' },
  { key: 'clutch_points', label: 'Decisivos',    emoji: '🎯' },
];

/* ── Componente principal ───────────────────────────────────────── */
export default function PerfilDetalhe({ data, darkMode, onBack }: PerfilDetalheProps) {
  const [extra, setExtra] = useState<ProfileExtra | null>(null);
  const [profileTypeLoading, setProfileTypeLoading] = useState(true);
  const [perfMode, setPerfMode] = useState<PerfMode>('total');
  const [viewerAuthId, setViewerAuthId] = useState<string | null>(null);
  const [latestProCard, setLatestProCard] = useState<{ id: string; share_slug: string | null; snapshot: ProShareCardData | null } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [requestingPublish, setRequestingPublish] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [pendingCardAction, setPendingCardAction] = useState<CardActionType | null>(null);
  const [sessionOptions, setSessionOptions] = useState<SessionCardOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget>('generic');
  const [cardRenderFormat, setCardRenderFormat] = useState<CardRenderFormat>('story');
  const [exportCardSnapshot, setExportCardSnapshot] = useState<ProShareCardData | null>(null);
  const [exportCardFormat, setExportCardFormat] = useState<CardRenderFormat>('story');
  const exportCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data.user_id) {
      setExtra(null);
      setProfileTypeLoading(false);
      return;
    }
    setProfileTypeLoading(true);
    supabase
      .from('basquete_users')
      .select('id, auth_id, position, jersey_number, bio, height_cm, weight_kg, city, state, is_pro, pro_cover_image_url, pro_profile_tagline, pro_athlete_resume, pro_sponsors')
      .eq('id', data.user_id)
      .maybeSingle()
      .then(({ data: p }) => { setExtra((p as ProfileExtra | null) ?? null); })
      .finally(() => setProfileTypeLoading(false));
  }, [data.user_id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      setViewerAuthId(authData.user?.id ?? null);
    });
  }, []);

  const canManageProCard = Boolean(extra?.is_pro && extra?.auth_id && viewerAuthId && extra.auth_id === viewerAuthId);

  useEffect(() => {
    if (!canManageProCard || !viewerAuthId) {
      setLatestProCard(null);
      return;
    }
    supabase
      .from('pro_cards')
      .select('id, share_slug, snapshot')
      .eq('auth_id', viewerAuthId)
      .in('status', ['approved', 'published'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!row) {
          setLatestProCard(null);
          return;
        }
        setLatestProCard(row as { id: string; share_slug: string | null; snapshot: ProShareCardData | null });
      });
  }, [canManageProCard, viewerAuthId]);

  const pj = Math.max(data.partidas, 1);
  const winRatePct =
    data.partidas > 0
      ? Math.min(100, Math.max(0, Math.round((data.wins / data.partidas) * 100)))
      : 0;
  const listMax = useMemo(() => {
    if (perfMode === 'total') {
      return Math.max(...STAT_ROWS.map((s) => Number(data[s.key]) || 0), 1);
    }
    return Math.max(...STAT_ROWS.map((s) => (Number(data[s.key]) || 0) / pj), 0.01);
  }, [data, perfMode, pj]);

  const playerScore = computePlayerScore(data);
  const proHeroStats = [
    { label: 'Partidas', value: String(data.partidas ?? 0) },
    { label: 'Pontos', value: String(data.points ?? 0) },
    { label: 'Win rate', value: `${winRatePct}%` },
  ];
  const loadRecentSessions = async () => {
    if (!extra?.id) return;
    setLoadingSessions(true);
    try {
      const { data: sessions } = await supabase
        .from('partida_sessoes')
        .select('id, location_id, started_at, ended_at, team1_points, team2_points, player_points')
        .order('started_at', { ascending: false })
        .limit(120);

      type RawSession = {
        id: string;
        location_id: string | null;
        started_at: string;
        ended_at: string | null;
        team1_points: number;
        team2_points: number;
        player_points: unknown;
      };

      const grouped = new Map<string, SessionCardOption>();

      ((sessions ?? []) as RawSession[]).forEach((session) => {
          const sessionDate = new Date(session.started_at).toISOString().slice(0, 10);
          const groupKey = `${session.location_id ?? 'global'}::${sessionDate}`;
          const pp = (session.player_points ?? {}) as {
            team1?: Record<string, { points?: number; user_id?: string | null }>;
            team2?: Record<string, { points?: number; user_id?: string | null }>;
          };
          const team1Entries = Object.values(pp.team1 ?? {});
          const team2Entries = Object.values(pp.team2 ?? {});
          const team1Player = team1Entries.find((entry) => entry?.user_id === extra.id);
          const team2Player = team2Entries.find((entry) => entry?.user_id === extra.id);
          if (!team1Player && !team2Player) return;
          const pontos = Number(team1Player?.points ?? team2Player?.points ?? 0);
          let winRate = 0;
          if (team1Player) {
            winRate = session.team1_points > session.team2_points ? 100 : 0;
          } else if (team2Player) {
            winRate = session.team2_points > session.team1_points ? 100 : 0;
          }

          const current = grouped.get(groupKey);
          if (!current) {
            grouped.set(groupKey, {
              id: groupKey,
              representative_partida_id: session.id,
              location_id: session.location_id,
              partidas_count: 1,
              started_at: session.started_at,
              ended_at: session.ended_at,
              metrics: {
                partidas: 1,
                pontos,
                winRate,
              },
            });
            return;
          }

          current.partidas_count += 1;
          current.metrics.partidas += 1;
          current.metrics.pontos += pontos;
          const winsNow = (current.metrics.winRate / 100) * (current.metrics.partidas - 1) + (winRate > 0 ? 1 : 0);
          current.metrics.winRate = Math.round((winsNow / current.metrics.partidas) * 100);

          if (new Date(session.started_at).getTime() > new Date(current.started_at).getTime()) {
            current.started_at = session.started_at;
            current.ended_at = session.ended_at;
            current.representative_partida_id = session.id;
          }
          grouped.set(groupKey, current);
        });

      const rows = [...grouped.values()]
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 5);

      setSessionOptions(rows);
      setSelectedSessionId((prev) => prev || rows[0]?.id || '');
    } finally {
      setLoadingSessions(false);
    }
  };

  const createCardForAction = async (selectedSession: SessionCardOption, format: CardRenderFormat) => {
    if (!extra?.id || !viewerAuthId) return null;
    setCreatingCard(true);
    try {
      const shareSlug = `pro-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
      const sessionPartidas = Number(selectedSession.metrics.partidas ?? 0);
      const sessionPontos = Number(selectedSession.metrics.pontos ?? 0);
      const sessionWins = Math.round((Number(selectedSession.metrics.winRate ?? 0) / 100) * sessionPartidas);
      const sessionEfficiency = Math.max(0, Number((sessionPontos + sessionWins * 3).toFixed(1)));
      const positiveExtras: Array<{ label: string; value: number }> = [
        { label: 'Vitórias', value: sessionWins },
        { label: 'Eficiência', value: sessionEfficiency },
      ].filter((item) => item.value > 0);
      const snapshot: ProShareCardData = {
        name: data.name || 'Atleta',
        tagline: extra?.pro_profile_tagline?.trim() || null,
        coverUrl: extra?.pro_cover_image_url?.trim() || null,
        avatarUrl: data.avatar_url ?? null,
        stats: selectedSession.metrics,
        extraStats: positiveExtras,
        renderFormat: format,
      };
      const payload = {
        auth_id: viewerAuthId,
        basquete_user_id: extra.id,
        session_id: selectedSession.representative_partida_id,
        title: `Card da sessão ${new Date(selectedSession.started_at).toLocaleDateString('pt-BR')}`,
        share_slug: shareSlug,
        status: 'published',
        snapshot,
      };
      const { data: inserted, error } = await supabase
        .from('pro_cards')
        .insert(payload)
        .select('id, share_slug, snapshot')
        .single();
      if (error || !inserted) throw error ?? new Error('Falha ao criar card');
      const created = inserted as { id: string; share_slug: string | null; snapshot: ProShareCardData | null };
      setLatestProCard(created);
      return created;
    } catch {
      setActionFeedback('Não foi possível criar o card agora.');
      window.setTimeout(() => setActionFeedback(null), 2200);
      return null;
    } finally {
      setCreatingCard(false);
    }
  };

  const requestAppPublication = async (selectedSession: SessionCardOption, format: CardRenderFormat) => {
    if (!extra?.id || !viewerAuthId) return;
    setRequestingPublish(true);
    setActionFeedback(null);
    try {
      const created = await createCardForAction(selectedSession, format);
      if (!created?.id) throw new Error('Falha ao criar card para publicação');
      const { error } = await supabase.from('pro_card_publication_requests').insert({
        card_id: created.id,
        auth_id: viewerAuthId,
        basquete_user_id: extra.id,
        status: 'pending',
      });
      if (error) throw error;
      setActionFeedback('Solicitação enviada para publicação nas redes do app.');
    } catch {
      setActionFeedback('Não foi possível enviar a solicitação agora.');
    } finally {
      setRequestingPublish(false);
      window.setTimeout(() => setActionFeedback(null), 2200);
    }
  };

  const shareProCard = async (selectedSession: SessionCardOption, target: ShareTarget, format: CardRenderFormat) => {
    const created = await createCardForAction(selectedSession, format);
    if (!created?.share_slug) return;
    const shareUrl = `${appPublicOrigin()}/card/${created.share_slug}`;
    try {
      if (created.snapshot) {
        setExportCardSnapshot(created.snapshot);
        setExportCardFormat(format);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }

      const shareBlob = exportCardRef.current ? await toBlob(exportCardRef.current, { cacheBust: true, pixelRatio: 2 }) : null;
      const shareFile = shareBlob
        ? new File([shareBlob], `braska-card-${created.share_slug}.png`, { type: 'image/png' })
        : null;

      if (navigator.share) {
        if (target === 'instagram') {
          // Para Instagram, prioriza compartilhar SOMENTE o arquivo da imagem
          // (enviar texto/url junto reduz compatibilidade em vários aparelhos).
          if (shareFile && (!navigator.canShare || navigator.canShare({ files: [shareFile] }))) {
            await navigator.share({ files: [shareFile] });
            setActionFeedback('Selecione Instagram para finalizar a publicação do card.');
            window.setTimeout(() => setActionFeedback(null), 3000);
            return;
          }

          await navigator.share({
            title: 'Meu card PRÓ - Braska',
            text: 'Meu card PRÓ Braska.',
            url: shareUrl,
          });
          setActionFeedback('Não foi possível enviar a imagem direto. Link compartilhado como alternativa.');
          window.setTimeout(() => setActionFeedback(null), 3200);
          return;
        }

        if (shareFile && (!navigator.canShare || navigator.canShare({ files: [shareFile] }))) {
          await navigator.share({
            title: 'Meu card PRÓ - Braska',
            text: 'Confira meu card de performance na Braska.',
            files: [shareFile],
          });
        } else {
          await navigator.share({
            title: 'Meu card PRÓ - Braska',
            text: 'Confira meu card de performance na Braska.',
            url: shareUrl,
          });
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setActionFeedback(
          target === 'instagram'
            ? 'Não foi possível abrir compartilhamento nativo. Link copiado para usar no Instagram.'
            : 'Link copiado para compartilhar.'
        );
        window.setTimeout(() => setActionFeedback(null), 1800);
      }
    } catch {
      if (target === 'instagram') {
        await navigator.clipboard.writeText(shareUrl);
        setActionFeedback('Seu aparelho bloqueou envio direto ao Instagram. Link do card copiado.');
        window.setTimeout(() => setActionFeedback(null), 3200);
      }
    }
  };

  const saveProCardLocally = async (selectedSession: SessionCardOption, format: CardRenderFormat) => {
    const created = await createCardForAction(selectedSession, format);
    if (!created?.snapshot) return;
    try {
      setExportCardSnapshot(created.snapshot);
      setExportCardFormat(format);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!exportCardRef.current) throw new Error('Card não renderizado');
      const dataUrl = await toPng(exportCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const filename = `braska-card-${created.share_slug ?? Date.now().toString()}.png`;
      const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);

      // iOS/PWA pode bloquear download direto; tenta share file primeiro.
      if (isIOS && navigator.share && exportCardRef.current) {
        const blob = await toBlob(exportCardRef.current, { cacheBust: true, pixelRatio: 2 });
        if (blob) {
          const file = new File([blob], filename, { type: 'image/png' });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Card PRÓ Braska',
              text: 'Card pronto para salvar/publicar.',
              files: [file],
            });
            setActionFeedback('Card aberto no compartilhamento nativo para salvar no aparelho.');
            window.setTimeout(() => setActionFeedback(null), 2800);
            return;
          }
        }
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setActionFeedback('Download do card iniciado.');
    } catch {
      setActionFeedback('Não foi possível baixar agora. Tente novamente ou use Compartilhar > Instagram.');
    } finally {
      window.setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const beginCardAction = async (action: CardActionType) => {
    if (!canManageProCard || !extra?.id) return;
    setPendingCardAction(action);
    if (action === 'share') setShareTarget('generic');
    setCardRenderFormat('story');
    setSessionPickerOpen(true);
    setActionFeedback(null);
    await loadRecentSessions();
  };

  const confirmCardAction = async () => {
    const selectedSession = sessionOptions.find((s) => s.id === selectedSessionId);
    if (!selectedSession || !pendingCardAction) return;
    setSessionPickerOpen(false);
    if (pendingCardAction === 'publish') {
      await requestAppPublication(selectedSession, cardRenderFormat);
      return;
    }
    if (pendingCardAction === 'share') {
      await shareProCard(selectedSession, shareTarget, cardRenderFormat);
      return;
    }
    await saveProCardLocally(selectedSession, cardRenderFormat);
  };

  if (profileTypeLoading) {
    return (
      <div
        className={cn(
          'rounded-2xl border min-h-[60dvh] flex items-center justify-center',
          darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn('w-8 h-8 animate-spin', darkMode ? 'text-orange-300' : 'text-orange-500')} />
          <p className={cn('text-xs font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Carregando perfil do atleta...
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── HERO ────────────────────────────────────────────────── */}
      <div
        className={cn(
          'relative overflow-hidden',
          extra?.is_pro
            ? '-ml-4 -mr-4 sm:-ml-4 sm:-mr-4 w-[calc(100%+2rem)] rounded-b-3xl rounded-t-none min-h-[500px] sm:min-h-[560px]'
            : 'rounded-3xl'
        )}
        style={{
          background: darkMode
            ? 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #431407 100%)'
            : 'linear-gradient(145deg, #0f172a 0%, #1c1917 50%, #7c2d12 100%)',
        }}
      >
        {extra?.is_pro && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(249,115,22,0.22),transparent_45%),radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.2),transparent_35%)]" />
            {extra?.pro_cover_image_url && (
              <div className="absolute inset-0">
                <img
                  src={extra.pro_cover_image_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/35" />
              </div>
            )}
          </>
        )}
        {extra?.is_pro && canManageProCard && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void beginCardAction('publish')}
              disabled={creatingCard || requestingPublish}
              className={`w-10 h-10 rounded-full border text-white flex items-center justify-center transition-all bg-black/10 backdrop-blur-sm ${
                darkMode ? 'border-white/35 hover:bg-white/15' : 'border-white/80 hover:bg-white/20'
              } ${(creatingCard || requestingPublish) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Publicar card"
              aria-label="Publicar card"
            >
              <Radio className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void beginCardAction('share')}
              disabled={creatingCard}
              className={`w-10 h-10 rounded-full border text-white flex items-center justify-center transition-all bg-black/10 backdrop-blur-sm ${
                darkMode ? 'border-white/35 hover:bg-white/15' : 'border-white/80 hover:bg-white/20'
              } ${creatingCard ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Compartilhar nas redes"
              aria-label="Compartilhar nas redes"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void beginCardAction('save')}
              disabled={creatingCard}
              className={`w-10 h-10 rounded-full border text-white flex items-center justify-center transition-all bg-black/10 backdrop-blur-sm ${
                darkMode ? 'border-white/35 hover:bg-white/15' : 'border-white/80 hover:bg-white/20'
              } ${creatingCard ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Salvar card"
              aria-label="Salvar card"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* back */}
        <div className="relative z-10 px-5 pt-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-semibold transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        {/* avatar + nome */}
        {extra?.is_pro ? (
          <div className="absolute left-0 right-0 bottom-16 z-10 px-5 pb-0">
            <div className="flex flex-col items-start gap-2.5">
              <div className="flex items-center gap-2">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.05 }}
                  className="shrink-0"
                >
                  <div className="w-12 h-12 border-[2px] rounded-full border-orange-400 overflow-hidden shadow-xl shadow-black/50">
                    {data.avatar_url ? (
                      <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>
                </motion.div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-400/40">
                  <Crown className="w-3.5 h-3.5 text-orange-300" />
                  <span className="text-[10px] font-black tracking-widest text-orange-200 uppercase">PRÓ</span>
                </div>
              </div>

              <div className="w-full rounded-xl bg-slate-950/45 backdrop-blur-sm px-3 py-2.5 border border-white/10 shadow-xl">
                <motion.h1
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-white font-black leading-tight text-3xl sm:text-4xl tracking-tight"
                >
                  {data.name}
                </motion.h1>
                {extra?.pro_profile_tagline && (
                  <p className="text-xs text-orange-100/95 mt-2 max-w-md leading-snug line-clamp-3">
                    {extra.pro_profile_tagline}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 px-5 pt-5 pb-6 flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.05 }}
              className="shrink-0"
            >
              <div className="w-20 h-20 rounded-full border-[3px] border-orange-400 overflow-hidden shadow-xl shadow-black/50">
                {data.avatar_url ? (
                  <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <User className="w-10 h-10 text-slate-400" />
                  </div>
                )}
              </div>
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-orange-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                {extra?.position ?? 'Atleta'}
                {extra?.jersey_number != null && (
                  <span className="ml-2 text-white/50">#{extra.jersey_number}</span>
                )}
              </p>
              <motion.h1
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-white font-black leading-tight text-2xl"
              >
                {data.name}
              </motion.h1>
              {(extra?.city || extra?.height_cm) && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {extra?.city && (
                    <span className="flex items-center gap-1 text-white/60 text-[10px]">
                      <MapPin className="w-2.5 h-2.5" />
                      {extra.city}{extra.state ? `, ${extra.state}` : ''}
                    </span>
                  )}
                  {extra?.height_cm && (
                    <span className="flex items-center gap-1 text-white/60 text-[10px]">
                      <Ruler className="w-2.5 h-2.5" />
                      {extra.height_cm}cm
                    </span>
                  )}
                  {extra?.weight_kg && (
                    <span className="flex items-center gap-1 text-white/60 text-[10px]">
                      <Scale className="w-2.5 h-2.5" />
                      {extra.weight_kg}kg
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score — único destaque no card principal */}
        {extra?.is_pro ? (
          <div className="h-8 sm:h-10" />
        ) : (
          <div className="border-t border-white/10 px-5 py-8 text-center">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">Score</p>
            <p className="text-5xl sm:text-6xl font-black text-white tabular-nums leading-none tracking-tight">
              {playerScore}
            </p>
          </div>
        )}
      </div>
      {actionFeedback && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[140] px-4">
          <p
            className={cn(
              'text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border shadow-xl whitespace-nowrap',
              darkMode
                ? 'bg-slate-900/95 text-slate-100 border-slate-700'
                : 'bg-white/95 text-slate-800 border-slate-200'
            )}
          >
            {actionFeedback}
          </p>
        </div>
      )}

      {extra?.is_pro && (
        <div className="-mt-12 sm:-mt-14 relative z-20 px-3 sm:px-4">
          <div className="flex items-stretch justify-between gap-2.5 sm:gap-3">
            {proHeroStats.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex-1 min-w-0 rounded-2xl border backdrop-blur-sm px-3 py-3.5',
                  darkMode
                    ? 'border-white/15 bg-slate-900/78'
                    : 'border-slate-200 bg-white/90'
                )}
              >
                <p className={cn('text-[10px] uppercase tracking-widest font-bold', darkMode ? 'text-white/60' : 'text-slate-500')}>
                  {item.label}
                </p>
                <p className={cn('text-2xl sm:text-3xl font-black tabular-nums mt-1', darkMode ? 'text-white' : 'text-slate-900')}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE (gráfico de barras) ─────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className={cn('font-bold text-base shrink-0', darkMode ? 'text-white' : 'text-slate-900')}>
              Performance
            </h2>
            <div
              className={cn(
                'inline-flex rounded-xl p-1 gap-0.5 w-full sm:w-auto',
                darkMode ? 'bg-slate-800' : 'bg-slate-100'
              )}
              role="tablist"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                role="tab"
                aria-selected={perfMode === 'total'}
                onClick={() => setPerfMode('total')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-2 rounded-lg text-xs font-bold transition-all',
                  perfMode === 'total'
                    ? darkMode
                      ? 'bg-slate-700 text-white shadow'
                      : 'bg-white text-slate-900 shadow-sm'
                    : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Total acumulado
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={perfMode === 'perGame'}
                onClick={() => setPerfMode('perGame')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-2 rounded-lg text-xs font-bold transition-all',
                  perfMode === 'perGame'
                    ? darkMode
                      ? 'bg-slate-700 text-white shadow'
                      : 'bg-white text-slate-900 shadow-sm'
                    : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Por partida
              </button>
            </div>
          </div>

          <div
            className={cn(
              'flex flex-wrap items-center gap-x-6 gap-y-2 text-sm',
              darkMode ? 'text-slate-300' : 'text-slate-600'
            )}
          >
            <span>
              <span className={cn('font-semibold', darkMode ? 'text-slate-500' : 'text-slate-400')}>Partidas </span>
              <span className="font-black tabular-nums">{data.partidas}</span>
            </span>
            <span>
              <span className={cn('font-semibold', darkMode ? 'text-slate-500' : 'text-slate-400')}>Win rate </span>
              <span className="font-black tabular-nums text-amber-500">{winRatePct}%</span>
            </span>
          </div>
        </div>

        <SkillsRadar data={data} mode={perfMode} darkMode={darkMode} />
      </div>

      {/* ── EVOLUÇÃO (gráfico de linha com área) ─────────────────── */}
      {data.user_id && (
        <StatsEvolutionChart userId={data.user_id} darkMode={darkMode} />
      )}

      {/* ── ESTATÍSTICAS (estilo "Performed Training") ───────────── */}
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className={cn('px-5 py-4 border-b flex items-center justify-between gap-2', darkMode ? 'border-slate-800' : 'border-slate-100')}>
          <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
            Estatísticas
          </h2>
          <span className={cn('text-[10px] font-semibold uppercase tracking-wide', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            {perfMode === 'total' ? 'Total acumulado' : 'Média por partida'}
          </span>
        </div>

        {STAT_ROWS.map((stat, i) => {
          const rowNum =
            perfMode === 'total' ? Number(data[stat.key]) || 0 : (Number(data[stat.key]) || 0) / pj;
          const pct = listMax > 0 ? (rowNum / listMax) * 100 : 0;
          const valueLabel = getStatListValue(data, stat.key, perfMode);

          return (
            <div
              key={stat.key}
              className={cn(
                'px-5 py-4 flex items-center gap-4 border-b last:border-b-0',
                darkMode ? 'border-slate-800' : 'border-slate-50'
              )}
            >
              <span className="text-2xl w-8 text-center shrink-0">{stat.emoji}</span>

              <div className="flex-1 min-w-0">
                <p className={cn('font-semibold text-sm', darkMode ? 'text-slate-200' : 'text-slate-800')}>
                  {stat.label}
                </p>
                <div className={cn('mt-1.5 h-1.5 rounded-full overflow-hidden', darkMode ? 'bg-slate-800' : 'bg-slate-100')}>
                  <motion.div
                    className="h-full rounded-full bg-orange-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('font-black text-xl min-w-[3rem] text-right tabular-nums', darkMode ? 'text-white' : 'text-slate-900')}>
                  {valueLabel}
                </span>
                <ChevronRight className={cn('w-4 h-4', darkMode ? 'text-slate-700' : 'text-slate-300')} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BADGES / MARCOS ────────────────────────────────────── */}
      {(() => {
        const THRESHOLDS = [10, 100, 200, 500];
        const BADGE_DEFS: { key: keyof PerfilDetalheData; label: string; emoji: string; colors: string[] }[] = [
          { key: 'points',   label: 'Pontos',       emoji: '🏀', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'assists',  label: 'Assistências', emoji: '🤝', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'rebounds', label: 'Rebotes',      emoji: '📏', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'blocks',   label: 'Tocos',        emoji: '🛡️', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'steals',   label: 'Roubos',       emoji: '⚡', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'wins',     label: 'Vitórias',     emoji: '🏆', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
        ];
        const earned: { label: string; emoji: string; threshold: number; color: string; value: number }[] = [];
        for (const def of BADGE_DEFS) {
          const val = Number(data[def.key]) || 0;
          for (let i = 0; i < THRESHOLDS.length; i++) {
            if (val >= THRESHOLDS[i]) {
              earned.push({ label: def.label, emoji: def.emoji, threshold: THRESHOLDS[i], color: def.colors[i], value: val });
            }
          }
        }
        if (earned.length === 0) return null;
        return (
          <div className={cn('rounded-2xl border overflow-hidden', darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
            <div className={cn('px-5 py-4 border-b', darkMode ? 'border-slate-800' : 'border-slate-100')}>
              <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
                Marcos alcançados
              </h2>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {earned.map((b, i) => (
                <motion.div
                  key={`${b.label}-${b.threshold}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border',
                    darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: b.color + '20' }}
                  >
                    {b.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-xs font-bold leading-tight', darkMode ? 'text-white' : 'text-slate-800')}>
                      {b.threshold}+ {b.label}
                    </p>
                    <p className="text-[10px]" style={{ color: b.color }}>
                      {b.value} alcançados
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── BIO ─────────────────────────────────────────────────── */}
      {extra?.bio && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <h2 className={cn('font-bold text-base mb-2', darkMode ? 'text-white' : 'text-slate-900')}>
            Sobre
          </h2>
          <p className={cn('text-sm leading-relaxed', darkMode ? 'text-slate-400' : 'text-slate-600')}>
            {extra.bio}
          </p>
        </div>
      )}

      {extra?.is_pro && extra?.pro_athlete_resume && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-orange-400" />
            <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
              Currículo do atleta
            </h2>
          </div>
          <p className={cn('text-sm leading-relaxed whitespace-pre-line', darkMode ? 'text-slate-300' : 'text-slate-700')}>
            {extra.pro_athlete_resume}
          </p>
        </div>
      )}

      {extra?.is_pro && Array.isArray(extra.pro_sponsors) && extra.pro_sponsors.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <h2 className={cn('font-bold text-base mb-3', darkMode ? 'text-white' : 'text-slate-900')}>
            Patrocinadores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {extra.pro_sponsors
              .filter((s) => s && (s.name || s.logo_url || s.link_url))
              .slice(0, 4)
              .map((sponsor, idx) => (
                <a
                  key={`${sponsor.name ?? 'sponsor'}-${idx}`}
                  href={sponsor.link_url || '#'}
                  target={sponsor.link_url ? '_blank' : undefined}
                  rel={sponsor.link_url ? 'noopener noreferrer' : undefined}
                  className={cn(
                    'rounded-xl border p-3 flex items-center gap-3 transition-colors',
                    darkMode ? 'bg-slate-800 border-slate-700 hover:border-orange-500/40' : 'bg-slate-50 border-slate-200 hover:border-orange-300'
                  )}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center border',
                    darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                  )}>
                    {sponsor.logo_url ? (
                      <img src={sponsor.logo_url} alt={sponsor.name ?? `Patrocinador ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className={cn('text-[10px] font-bold', darkMode ? 'text-slate-500' : 'text-slate-400')}>LOGO</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold truncate', darkMode ? 'text-white' : 'text-slate-900')}>
                      {sponsor.name || `Patrocinador ${idx + 1}`}
                    </p>
                    {sponsor.link_url && (
                      <p className={cn('text-[11px] inline-flex items-center gap-1 truncate', darkMode ? 'text-orange-300' : 'text-orange-600')}>
                        <Link2 className="w-3 h-3" /> Visitar
                      </p>
                    )}
                  </div>
                </a>
              ))}
          </div>
        </div>
      )}
      {exportCardSnapshot && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
          <div
            ref={exportCardRef}
            style={{
              width: 1080,
              height: exportCardFormat === 'feed' ? 1350 : 1920,
            }}
          >
            <ProShareCard data={exportCardSnapshot} format={exportCardFormat} />
          </div>
        </div>
      )}
      {sessionPickerOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div
            className={cn(
              'w-full max-w-lg rounded-2xl border p-4 sm:p-5',
              darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className={cn('text-sm sm:text-base font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
                Escolha uma sessão para gerar o card
              </h3>
              <button
                type="button"
                onClick={() => setSessionPickerOpen(false)}
                className={cn('text-xs font-semibold px-2 py-1 rounded-lg', darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}
              >
                Fechar
              </button>
            </div>
            <p className={cn('text-xs mt-1 mb-3', darkMode ? 'text-slate-400' : 'text-slate-500')}>
              Últimas 5 sessões com participação do atleta.
            </p>
            <div className="mb-3">
              <p className={cn('text-[11px] font-semibold mb-1.5', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                Formato do card
              </p>
              <div className="inline-flex rounded-xl p-1 gap-1 border border-slate-700/50 bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => setCardRenderFormat('feed')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    cardRenderFormat === 'feed'
                      ? 'bg-orange-500 text-white'
                      : darkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  Feed
                </button>
                <button
                  type="button"
                  onClick={() => setCardRenderFormat('story')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    cardRenderFormat === 'story'
                      ? 'bg-orange-500 text-white'
                      : darkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  Stories
                </button>
              </div>
            </div>
            {pendingCardAction === 'share' && (
              <div className="mb-3 inline-flex rounded-xl p-1 gap-1 border border-slate-700/50 bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => setShareTarget('generic')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    shareTarget === 'generic'
                      ? 'bg-orange-500 text-white'
                      : darkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  Compartilhar
                </button>
                <button
                  type="button"
                  onClick={() => setShareTarget('instagram')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    shareTarget === 'instagram'
                      ? 'bg-orange-500 text-white'
                      : darkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  Instagram
                </button>
              </div>
            )}

            {loadingSessions ? (
              <p className={cn('text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>Carregando sessões...</p>
            ) : sessionOptions.length === 0 ? (
              <p className={cn('text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                Nenhuma sessão encontrada para gerar card.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sessionOptions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={cn(
                      'w-full text-left rounded-xl border p-3 transition-colors',
                      selectedSessionId === session.id
                        ? darkMode
                          ? 'border-orange-400/60 bg-orange-500/10'
                          : 'border-orange-400 bg-orange-50'
                        : darkMode
                          ? 'border-slate-700 hover:border-slate-600'
                          : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className={cn('text-xs font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
                      {new Date(session.started_at).toLocaleDateString('pt-BR')}
                    </p>
                    <p className={cn('text-[11px] mt-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                      {session.partidas_count} partida(s) · Pontos: {session.metrics.pontos} · Win rate: {session.metrics.winRate}%
                    </p>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void confirmCardAction()}
              disabled={creatingCard || loadingSessions || !selectedSessionId}
              className={cn(
                'mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
                creatingCard || loadingSessions || !selectedSessionId
                  ? 'opacity-50 cursor-not-allowed bg-slate-600 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              )}
            >
              {creatingCard
                ? 'Gerando card...'
                : pendingCardAction === 'share' && shareTarget === 'instagram'
                  ? 'Gerar card e compartilhar no Instagram'
                  : `Gerar card ${cardRenderFormat === 'feed' ? 'Feed' : 'Stories'} com sessão selecionada`}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
