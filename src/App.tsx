/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Trophy,
  ArrowRight,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Sun,
  Moon,
  Home,
  Calendar,
  User,
  LogOut,
  Shield,
  Target,
  X,
  Timer,
  MapPin,
  Bell,
  Info,
  AlertTriangle,
  CheckCircle,
  Settings,
  UserMinus,
  RotateCcw,
  GripVertical,
  Menu,
  QrCode,
  Crown,
  Globe,
  Percent,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from './supabase';
import { useAuth } from './contexts/AuthContext';
import EditarPerfil from './pages/EditarPerfil';
import GestaoAdmin from './pages/GestaoAdmin';
import {InstallPWA} from './components/InstallPWA';
import PerfilDetalhe from './pages/PerfilDetalhe';
import { NotificationsPanel } from './components/NotificationsPanel';
import { useLocationCheck } from './hooks/useLocationCheck';
import { useNotifications } from './contexts/NotificationContext';
import { runPwaReload } from './pwaUpdateController';
import {
  applyPlayerPointsDelta,
  parsePartidaPlayerPoints,
  partidaPlayerPointsToJson,
  totalsFromPlayerPoints,
} from './lib/partidaPlayerPoints';
import {
  consumeInitialTab,
  getAdminModeStored,
  getThemeDarkStored,
  setAdminModeStored,
  setThemeDarkStored,
} from './lib/appStorage';
import { BASKETBALL_FORMAT_LABELS } from './lib/basketballExplore';

/** Pontos da cesta que levam o time a ≥12 (vitória): somam em clutch_points (1/2/3 por unidade). */
function decisiveBasketPoints(
  team: 'team1' | 'team2',
  t1Before: number,
  t2Before: number,
  t1After: number,
  t2After: number,
  basketPts: number
): number {
  if (team === 'team1' && t1Before < 12 && t1After >= 12) return basketPts;
  if (team === 'team2' && t2Before < 12 && t2After >= 12) return basketPts;
  return 0;
}

/** Ao remover pontos, se o time cai de ≥12 para <12, reverte o mesmo tanto em clutch_points. */
function reverseDecisiveBasketPoints(
  team: 'team1' | 'team2',
  t1Before: number,
  t2Before: number,
  t1After: number,
  t2After: number,
  removedPts: number
): number {
  if (team === 'team1' && t1Before >= 12 && t1After < 12) return removedPts;
  if (team === 'team2' && t2Before >= 12 && t2After < 12) return removedPts;
  return 0;
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RegisteredUserSuggestion {
  id: string;
  display_name: string | null;
  full_name?: string | null;
  email: string;
  avatar_url?: string | null;
  player_code?: string | null;
}

function getRegisteredUserLabel(user: RegisteredUserSuggestion) {
  return user.display_name?.trim() || user.full_name?.trim() || user.email;
}

async function generateUniquePlayerCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const { data } = await supabase
      .from('basquete_users')
      .select('id')
      .eq('player_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error('Não foi possível gerar um código único');
}

async function resolveRegisteredUserByName(
  name: string,
  selectedUser: RegisteredUserSuggestion | null,
  suggestions: RegisteredUserSuggestion[]
) {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) return { userId: null, ambiguous: false };

  if (selectedUser && getRegisteredUserLabel(selectedUser).trim().toLowerCase() === normalizedName) {
    return { userId: selectedUser.id, ambiguous: false };
  }

  const suggestionMatches = suggestions.filter(
    (candidate) => getRegisteredUserLabel(candidate).trim().toLowerCase() === normalizedName
  );

  if (suggestionMatches.length === 1) {
    return { userId: suggestionMatches[0].id, ambiguous: false };
  }

  if (suggestionMatches.length > 1) {
    return { userId: null, ambiguous: true };
  }

  const { data, error } = await supabase
    .from('basquete_users')
    .select('id, display_name')
    .eq('display_name', name.trim())
    .limit(2);

  if (error) {
    throw error;
  }

  if ((data ?? []).length > 1) {
    return { userId: null, ambiguous: true };
  }

  return { userId: data?.[0]?.id ?? null, ambiguous: false };
}

interface Player {
  id: string;
  name: string;
  status: 'waiting' | 'team1' | 'team2' | 'suspended';
  joined_at: string;
  admin?: boolean;
  user_id?: string | null;
}

interface SuspendedInfo {
  originalTeam: 'team1' | 'team2';
  replacedById: string | null;
  /** joined_at no momento da suspensão — restaurado ao voltar para a fila (derrota ou partida sem vencedor). */
  joined_at_before_suspend: string;
}

interface PlayerStats {
  id: string;
  name: string;
  user_id?: string | null;
  partidas?: number;
  wins: number;
  points: number;
  blocks: number;
  steals: number;
  clutch_points: number;
  assists: number;
  rebounds: number;
  hot_streak_since?: string | null;
}

interface Evento {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  type: 'torneio' | 'campeonato' | 'festival';
  modality: '5x5' | '3x3' | '1x1';
  max_participants: number | null;
  status: 'draft' | 'open' | 'in_progress' | 'finished' | 'cancelled';
  created_at: string;
  _inscricoes_count?: number;
}

const EVENT_TYPE_LABELS: Record<Evento['type'], string> = { torneio: 'Torneio', campeonato: 'Campeonato', festival: 'Festival' };
const EVENT_STATUS_LABELS: Record<Evento['status'], string> = { draft: 'Rascunho', open: 'Inscrições abertas', in_progress: 'Em andamento', finished: 'Encerrado', cancelled: 'Cancelado' };

type Tab = 'inicio' | 'lista' | 'eventos' | 'perfil';
type SortKey = 'efficiency' | 'wins' | 'points' | 'blocks' | 'steals' | 'clutch_points' | 'assists' | 'rebounds';


interface AppProps {
  locationId?: string;
  locationSlug?: string;
  locationName?: string;
  isOwner?: boolean;
  maxPlayers?: number | null;
  venueCoords?: { lat: number; lng: number; radiusMeters: number };
}

import { GlobalPointsListener } from './components/GlobalPointsListener';

export default function App({ locationId, locationSlug, locationName, venueCoords, isOwner, maxPlayers }: AppProps = {}) {
  const { user, isGuest, signOut, leaveGuestMode } = useAuth();
  const { notifications, visibleToast, addNotification, dismissToast, clearNotification, clearAll } = useNotifications();
  const isLoggedIn = !!user;

  const [players, setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>([]);
  playersRef.current = players;
  /** Em caso de empate no placar ao resetar times, desempate: time que marcou primeiro na partida. */
  const firstScoringTeamRef = useRef<'team1' | 'team2' | null>(null);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const shownVisitanteRef = useRef(false);
  const shownRankingRef = useRef(false);
  const shownLocationRef = useRef(false);
  const [isMatchStarted, setIsMatchStarted] = useState(false);
  const [currentPartidaSessaoId, setCurrentPartidaSessaoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const requestedTab = consumeInitialTab();
    if (requestedTab === 'inicio' || requestedTab === 'lista' || requestedTab === 'eventos' || requestedTab === 'perfil') {
      return requestedTab as Tab;
    }
    return 'inicio';
  });
  const [sortKey, setSortKey] = useState<SortKey>('efficiency');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = getThemeDarkStored();
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return true;
  });
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean>(!!isOwner);
  const handleGoGlobal = () => {
    window.location.assign('/locais');
  };
  const handleSignOutAndGoExplore = async () => {
    await signOut();
    window.location.assign('/locais');
  };
  const [team1MatchPoints, setTeam1MatchPoints] = useState(0);
  const [team2MatchPoints, setTeam2MatchPoints] = useState(0);
  const [showWinnerModal, setShowWinnerModal] = useState<'team1' | 'team2' | null>(null);
  const [isStartingNextMatch, setIsStartingNextMatch] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; display_name: string | null; avatar_url: string | null; player_code: string | null; admin_pin: string | null } | null>(null);
  const [adminAddName, setAdminAddName] = useState('');
  const [adminUserSuggestions, setAdminUserSuggestions] = useState<RegisteredUserSuggestion[]>([]);
  const [showAdminSuggestions, setShowAdminSuggestions] = useState(false);
  const [isSearchingAdminUsers, setIsSearchingAdminUsers] = useState(false);
  const [selectedAdminUsers, setSelectedAdminUsers] = useState<RegisteredUserSuggestion[]>([]);
  const [unregisteredAddName, setUnregisteredAddName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [showEventoForm, setShowEventoForm] = useState(false);
  const [eventoForm, setEventoForm] = useState({ title: '', description: '', event_date: '', event_time: '', type: 'torneio' as Evento['type'], modality: '5x5' as Evento['modality'], max_participants: '' });
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [userCodes, setUserCodes] = useState<Record<string, string>>({});
  const [showAdminGestao, setShowAdminGestao] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  /** Confirmação antes do modal de senha ao iniciar sessão (mostra modalidade do local). */
  const [showStartSessionConfirm, setShowStartSessionConfirm] = useState(false);
  const [sessionControlledBy, setSessionControlledBy] = useState<string | null>(null);
  const [controlRequestedBy, setControlRequestedBy] = useState<string | null>(null);
  const [controlRequestedName, setControlRequestedName] = useState<string | null>(null);
  const [showControlRequestModal, setShowControlRequestModal] = useState(false);
  const isSessionController = !!user && sessionControlledBy === user.id;
  const hasActiveController = !!sessionControlledBy;
  const canManageSessionPlayers = isAdminMode && (!isMatchStarted || !hasActiveController || isSessionController);
  const [venueModalityLabel, setVenueModalityLabel] = useState('Basquete 5x5');
  const [showHeaderQrModal, setShowHeaderQrModal] = useState(false);
  const adminSuggestionsRef = useRef<HTMLDivElement | null>(null);
  const { isWithinRadius, isLoading: locationLoading, error: locationError, retry: retryLocation } = useLocationCheck(
    activeTab === 'lista' && !isAdminMode && !hasAdminAccess && !!venueCoords,
    venueCoords
  );

  const canSeeList = isAdminMode || (isWithinRadius === true && isMatchStarted);
  const canAddToList = isAdminMode || (isWithinRadius === true && isMatchStarted);
  const canUseQueueInput = !isAdminMode || canManageSessionPlayers;
  const headerQrUrl = locationSlug ? `${window.location.origin}/${locationSlug}` : null;

  const profileComplete = !!(userProfile?.display_name?.trim() && userProfile?.avatar_url);

  useEffect(() => {
    setHasAdminAccess(!!isOwner);
    if (!user) {
      setIsAdminMode(false);
      setAdminModeStored(false);
    } else if (isOwner) {
      // Owner mantém acesso administrativo e preserva o modo admin previamente validado por PIN.
      const storedAdminMode = getAdminModeStored();
      setIsAdminMode(storedAdminMode);
    }
  }, [user, isOwner]);

  useEffect(() => {
    setThemeDarkStored(darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminSuggestionsRef.current && !adminSuggestionsRef.current.contains(event.target as Node)) {
        setShowAdminSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTerm = adminAddName.trim();

    if (!isAdminMode || searchTerm.length < 4) {
      setAdminUserSuggestions([]);
      setShowAdminSuggestions(false);
      setIsSearchingAdminUsers(false);
      return;
    }

    const normalizedSearch = searchTerm.replace(/[%,]/g, ' ').trim();
    const isCodeSearch = /^\d{4}$/.test(normalizedSearch);
    if (!isCodeSearch && normalizedSearch.length < 4) {
      setAdminUserSuggestions([]);
      setShowAdminSuggestions(false);
      setIsSearchingAdminUsers(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingAdminUsers(true);

      let userQuery = supabase
        .from('basquete_users')
        .select(locationId
          ? 'id, display_name, email, avatar_url, player_code, location_members!inner(location_id)'
          : 'id, display_name, email, avatar_url, player_code');
      if (isCodeSearch) {
        userQuery = userQuery.eq('player_code', normalizedSearch);
      } else {
        userQuery = userQuery.ilike('display_name', `%${normalizedSearch}%`);
      }
      userQuery = userQuery.limit(8);
      if (locationId) userQuery = (userQuery as typeof userQuery).eq('location_members.location_id', locationId);
      const { data, error } = await userQuery;

      if (cancelled) return;

      if (error) {
        console.error('Error searching registered users:', error);
        setAdminUserSuggestions([]);
        setShowAdminSuggestions(false);
        setIsSearchingAdminUsers(false);
        return;
      }

      const suggestions = (data ?? []).filter((candidate) => getRegisteredUserLabel(candidate).trim().length > 0) as RegisteredUserSuggestion[];
      setAdminUserSuggestions(suggestions);
      setShowAdminSuggestions(true);
      setIsSearchingAdminUsers(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [adminAddName, isAdminMode]);

  const fetchEventos = useCallback(async () => {
    if (!locationId) return;
    const { data, error } = await supabase
      .from('eventos')
      .select('*, evento_inscricoes(count)')
      .eq('location_id', locationId)
      .neq('status', 'cancelled')
      .order('event_date', { ascending: true });
    if (error) { console.error('Eventos fetch error:', error); return; }
    setEventos((data ?? []).map((e: any) => ({
      ...e,
      _inscricoes_count: Array.isArray(e.evento_inscricoes) ? e.evento_inscricoes[0]?.count ?? 0 : 0,
    })));
  }, [locationId]);

  const fetchPlayers = useCallback(async () => {
    let q = supabase.from('players').select('*').order('joined_at', { ascending: true });
    if (locationId) q = q.eq('location_id', locationId);
    const { data, error: err } = await q;
    if (err) {
      console.error('Supabase error:', err);
      addNotification('Erro ao carregar lista. Verifique as permissões.', 'error', { showToastForMs: 5000 });
      return;
    }
    setPlayers((data ?? []) as Player[]);
  }, [locationId]);

  const fetchStats = useCallback(async () => {
    let q = supabase.from('stats').select('*');
    if (locationId) q = q.eq('location_id', locationId);
    const { data, error: err } = await q;
    if (err) {
      console.error('Supabase stats error:', err);
      return;
    }
    const allStats = (data ?? []) as PlayerStats[];
    // Deduplicar por user_id: cada jogador aparece apenas uma vez no ranking,
    // somando stats de linhas duplicadas caso existam.
    const byUserId = new Map<string, PlayerStats>();
    for (const s of allStats) {
      if (!s.user_id) continue;
      const existing = byUserId.get(s.user_id);
      if (!existing) {
        byUserId.set(s.user_id, {
          ...s,
          partidas: s.partidas ?? 0,
          wins: s.wins ?? 0,
          points: s.points ?? 0,
          blocks: s.blocks ?? 0,
          steals: s.steals ?? 0,
          clutch_points: s.clutch_points ?? 0,
          assists: s.assists ?? 0,
          rebounds: s.rebounds ?? 0,
        });
      } else {
        // Manter o hot_streak_since mais recente entre linhas duplicadas
        const latestStreak = [existing.hot_streak_since, s.hot_streak_since]
          .filter(Boolean)
          .sort()
          .pop() ?? null;
        byUserId.set(s.user_id, {
          ...existing,
          partidas: (existing.partidas ?? 0) + (s.partidas ?? 0),
          wins: (existing.wins ?? 0) + (s.wins ?? 0),
          points: (existing.points ?? 0) + (s.points ?? 0),
          blocks: (existing.blocks ?? 0) + (s.blocks ?? 0),
          steals: (existing.steals ?? 0) + (s.steals ?? 0),
          clutch_points: (existing.clutch_points ?? 0) + (s.clutch_points ?? 0),
          assists: (existing.assists ?? 0) + (s.assists ?? 0),
          hot_streak_since: latestStreak,
        });
      }
    }
    setStats(Array.from(byUserId.values()));
  }, []);

  const fetchSession = useCallback(async () => {
    const sessionId = locationId ?? 'current';
    const { data, error: err } = await supabase
      .from('session')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (err && err.code !== 'PGRST116') {
      console.error('Session error:', err);
      return;
    }
    if (data) {
      setIsMatchStarted(data.is_started);
      setCurrentPartidaSessaoId(data.current_partida_sessao_id ?? null);
      setSessionControlledBy((data as { controlled_by?: string | null }).controlled_by ?? null);
      const reqBy = (data as { control_requested_by?: string | null }).control_requested_by ?? null;
      setControlRequestedBy(reqBy);
      setControlRequestedName((data as { control_requested_name?: string | null }).control_requested_name ?? null);
      // Mostrar modal se há solicitação direcionada ao controlador atual
      if (reqBy && user && (data as { controlled_by?: string | null }).controlled_by === user.id) {
        setShowControlRequestModal(true);
      }
    } else {
      await supabase.from('session').upsert({ id: sessionId, is_started: false, ...(locationId ? { location_id: locationId } : {}) });
    }
  }, [locationId, user]);

  useEffect(() => {
    if (!locationId) {
      setVenueModalityLabel('Basquete 5x5');
      return;
    }
    let cancelled = false;
    supabase
      .from('locations')
      .select('basketball_formats')
      .eq('id', locationId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const raw = (data?.basketball_formats as string[] | null)?.[0];
        setVenueModalityLabel(raw ? (BASKETBALL_FORMAT_LABELS[raw] ?? raw) : 'Basquete 5x5');
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const fetchPartidaSessao = useCallback(async (partidaSessaoId: string | null) => {
    if (!partidaSessaoId) {
      setTeam1MatchPoints(0);
      setTeam2MatchPoints(0);
      setMatchPlayerStats({});
      setShowWinnerModal(null);
      return;
    }
    const { data, error } = await supabase
      .from('partida_sessoes')
      .select('team1_points, team2_points, player_points')
      .eq('id', partidaSessaoId)
      .single();
    if (error || !data) {
      return;
    }
    const t1 = (data.team1_points ?? 0) as number;
    const t2 = (data.team2_points ?? 0) as number;
    setTeam1MatchPoints(t1);
    setTeam2MatchPoints(t2);
    const parsed = parsePartidaPlayerPoints(data.player_points);
    setMatchPlayerStats((prev) => {
      const teamIds = playersRef.current
        .filter((p) => p.status === 'team1' || p.status === 'team2')
        .map((p) => p.id);
      const next: typeof prev = {};
      for (const pid of teamIds) {
        const e1 = parsed.team1[pid];
        const e2 = parsed.team2[pid];
        const pts = (e1 ?? e2)?.points ?? 0;
        const base = prev[pid] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
        next[pid] = { ...base, points: pts };
      }
      return next;
    });
    if (t1 >= 12) {
      setShowWinnerModal('team1');
    } else if (t2 >= 12) {
      setShowWinnerModal('team2');
    } else {
      setShowWinnerModal(null);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
    fetchSession();
    fetchEventos();
    setLoading(false);
  }, [fetchPlayers, fetchSession, fetchEventos]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Avisos temporários: visitante e ranking (mostram toast por alguns segundos, ficam na lista)
  useEffect(() => {
    if (isGuest && activeTab === 'inicio' && !shownVisitanteRef.current) {
      shownVisitanteRef.current = true;
      addNotification('Você está como visitante. Entre ou cadastre-se para participar do ranking.', 'warning', {
        showToastForMs: 6000,
        action: { type: 'leave_guest_mode', label: 'Entrar / Cadastrar' },
      });
    }
  }, [isGuest, activeTab, addNotification]);

  useEffect(() => {
    if (isGuest && activeTab === 'lista' && !shownRankingRef.current) {
      shownRankingRef.current = true;
      addNotification('Você não aparece no ranking. Digite seu nome para entrar na fila.', 'info', { showToastForMs: 5000 });
    }
  }, [isGuest, activeTab, addNotification]);

  useEffect(() => {
    if (activeTab === 'lista' && locationError && !shownLocationRef.current) {
      shownLocationRef.current = true;
      addNotification(locationError, 'warning', { showToastForMs: 5000 });
    }
    if (!locationError) shownLocationRef.current = false;
  }, [activeTab, locationError, addNotification]);

  // Avatares dos usuários no ranking e jogadores em jogo/fila
  useEffect(() => {
    const statsIds = stats.map((s) => s.user_id).filter(Boolean) as string[];
    const playerIds = players.map((p) => p.user_id).filter(Boolean) as string[];
    const userIds = [...new Set([...statsIds, ...playerIds])];
    if (userIds.length === 0) {
      setUserAvatars({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('basquete_users')
        .select('id, avatar_url')
        .in('id', userIds);
      const map: Record<string, string> = {};
      for (const u of data ?? []) {
        if (u.avatar_url) map[u.id] = u.avatar_url;
      }
      setUserAvatars(map);
    })();
  }, [stats, players]);

  // Códigos dos jogadores na fila/times (para exibir no admin e no modal de stats)
  useEffect(() => {
    const userIds = [...new Set(players.map((p) => p.user_id).filter(Boolean))] as string[];
    if (userIds.length === 0) {
      setUserCodes({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('basquete_users')
        .select('id, player_code')
        .in('id', userIds);
      const map: Record<string, string> = {};
      for (const u of data ?? []) {
        if (u.player_code) map[u.id] = u.player_code;
      }
      setUserCodes(map);
    })();
  }, [players]);

  useEffect(() => {
    fetchPartidaSessao(currentPartidaSessaoId);
  }, [currentPartidaSessaoId, players, fetchPartidaSessao]);

  // Admin por email no banco (basquete_users.admin): concede acesso mesmo sem ser owner.
  useEffect(() => {
    if (!user?.email) return;
    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from('basquete_users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      if (!error && data?.admin === true) {
        setHasAdminAccess(true);
        // Usuário com acesso admin só entra em modo admin após validação de PIN.
        setIsAdminMode(false);
        setAdminModeStored(false);
      }
    };
    checkAdmin();
  }, [user?.email]);

  // Polling do placar: atualização em tempo real para todos (logados ou não)
  const shouldPollPlacar = activeTab === 'lista' && !!currentPartidaSessaoId;
  useEffect(() => {
    if (!shouldPollPlacar) return;
    // Busca imediata ao exibir a aba
    fetchPartidaSessao(currentPartidaSessaoId);
    const interval = setInterval(() => {
      fetchPartidaSessao(currentPartidaSessaoId);
    }, 1000);
    return () => clearInterval(interval);
  }, [shouldPollPlacar, currentPartidaSessaoId, fetchPartidaSessao]);

  // Realtime: lista de jogadores (tabela players) - atualização em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('players-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          fetchPlayers();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime players: reconectando...');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPlayers]);

  // Realtime: stats
  useEffect(() => {
    const channel = supabase
      .channel('stats-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stats' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  // Perfil do usuário (avatar e nome do bucket/basquete_users)
  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) {
      setUserProfile(null);
      return;
    }
    let { data } = await supabase
      .from('basquete_users')
      .select('id, display_name, avatar_url, player_code, admin_pin')
      .eq('auth_id', user.id)
      .maybeSingle();
    if (!data) {
      const { data: upserted } = await supabase
        .from('basquete_users')
        .upsert(
          {
            auth_id: user.id,
            email: user.email ?? '',
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email', ignoreDuplicates: false }
        )
        .select('id, display_name, avatar_url, player_code, admin_pin')
        .single();
      if (upserted) data = upserted;
      else {
        const { data: byAuth } = await supabase.from('basquete_users').select('id, display_name, avatar_url, player_code, admin_pin').eq('auth_id', user.id).maybeSingle();
        const { data: byEmail } = user?.email ? await supabase.from('basquete_users').select('id, display_name, avatar_url, player_code, admin_pin').eq('email', user.email).maybeSingle() : { data: null };
        data = byAuth ?? byEmail ?? undefined;
      }
    }
    if (data && !data.player_code) {
      try {
        const newCode = await generateUniquePlayerCode();
        await supabase.from('basquete_users').update({ player_code: newCode }).eq('id', data.id);
        data = { ...data, player_code: newCode };
      } catch {
        // code generation failed silently — will retry next login
      }
    }
    if (data && !data.admin_pin && hasAdminAccess) {
      try {
        const newPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        await supabase.from('basquete_users').update({ admin_pin: newPin }).eq('id', data.id);
        data = { ...data, admin_pin: newPin };
      } catch {
        // PIN generation failed silently — will retry next login
      }
    }
    setUserProfile(data ? { id: data.id, display_name: data.display_name, avatar_url: data.avatar_url, player_code: data.player_code ?? null, admin_pin: data.admin_pin ?? null } : null);
  }, [user?.id, user?.email, user?.user_metadata, hasAdminAccess]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Realtime: session
  useEffect(() => {
    const channel = supabase
      .channel('session-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session' }, () => {
        fetchSession();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSession]);

  // Fallback de sincronização entre navegadores/abas quando a sessão está iniciada.
  // Evita atraso visual de controle após transferência.
  useEffect(() => {
    if (!isMatchStarted) return;
    const interval = setInterval(() => {
      fetchSession();
    }, 2500);
    return () => clearInterval(interval);
  }, [isMatchStarted, fetchSession]);

  // Se o usuário recebeu o controle e tem acesso admin, ativa modo admin automaticamente
  // para exibir imediatamente os controles de gestão.
  useEffect(() => {
    if (!hasAdminAccess || !isMatchStarted || !isSessionController || isAdminMode) return;
    setIsAdminMode(true);
    setAdminModeStored(true);
  }, [hasAdminAccess, isMatchStarted, isSessionController, isAdminMode]);

  // Realtime: placar - atualização instantânea para todos os usuários (logados ou não)
  useEffect(() => {
    const channel = supabase
      .channel('partida-sessoes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partida_sessoes' }, () => {
        if (currentPartidaSessaoId) fetchPartidaSessao(currentPartidaSessaoId);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime placar: reconectando...');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPartidaSessaoId, fetchPartidaSessao]);

  const team1 = useMemo(() => players.filter((p) => p.status === 'team1'), [players]);
  const team2 = useMemo(() => players.filter((p) => p.status === 'team2'), [players]);
  const waitingList = useMemo(() => players.filter((p) => p.status === 'waiting'), [players]);
  const suspendedList = useMemo(() => players.filter((p) => p.status === 'suspended'), [players]);

  // Corrige sessão sem partida: se partida em andamento (5+5) mas currentPartidaSessaoId é null
  const repairPartidaRef = useRef(false);
  useEffect(() => {
    if (
      repairPartidaRef.current ||
      !isMatchStarted ||
      currentPartidaSessaoId ||
      team1.length !== 5 ||
      team2.length !== 5
    )
      return;
    repairPartidaRef.current = true;
    (async () => {
      const { data: novaPartida, error } = await supabase.from('partida_sessoes').insert(locationId ? { location_id: locationId } : {}).select('id').single();
      if (!error && novaPartida?.id) {
        await supabase.from('session').update({ current_partida_sessao_id: novaPartida.id }).eq('id', locationId ?? 'current');
        firstScoringTeamRef.current = null;
        setCurrentPartidaSessaoId(novaPartida.id);
        fetchPartidaSessao(novaPartida.id);
      }
    })().finally(() => {
      repairPartidaRef.current = false;
    });
  }, [isMatchStarted, currentPartidaSessaoId, team1.length, team2.length, fetchPartidaSessao]);

  const autoAssignInProgress = useRef(false);
  useEffect(() => {
    if (
      waitingList.length >= 10 &&
      team1.length === 0 &&
      team2.length === 0 &&
      !isMatchStarted &&
      !autoAssignInProgress.current
    ) {
      autoAssignInProgress.current = true;
      (async () => {
        try {
          const next10 = waitingList.slice(0, 10);
          for (let i = 0; i < 5 && next10[i]; i++) {
            await supabase.from('players').update({ status: 'team1' }).eq('id', next10[i].id);
          }
          for (let i = 5; i < 10 && next10[i]; i++) {
            await supabase.from('players').update({ status: 'team2' }).eq('id', next10[i].id);
          }
          const { data: partidaSessao, error: insertErr } = await supabase
            .from('partida_sessoes')
            .insert(locationId ? { location_id: locationId } : {})
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          const now = new Date().toISOString();
          const sessionId = locationId ?? 'current';
          await supabase.from('session').upsert({
            id: sessionId,
            is_started: true,
            started_at: now,
            current_partida_sessao_id: partidaSessao?.id,
            ...(locationId ? { location_id: locationId } : {}),
          });
          setIsMatchStarted(true);
          setCurrentPartidaSessaoId(partidaSessao?.id ?? null);
          firstScoringTeamRef.current = null;
          setTeam1MatchPoints(0);
          setTeam2MatchPoints(0);
          await fetchPlayers();
        } catch (err) {
          console.error('Auto-assign error:', err);
        } finally {
          autoAssignInProgress.current = false;
        }
      })();
    }
  }, [waitingList.length, team1.length, team2.length, isMatchStarted, waitingList, fetchPlayers]);

  const PLAYERS_PER_TEAM = 5;

  const addPlayerAsRegistered = async () => {
    if (isAdminMode && !canManageSessionPlayers) {
      addNotification('Solicite o controle da sessao para adicionar jogadores.', 'warning', { showToastForMs: 3500 });
      return;
    }
    if (!canAddToList || !userProfile?.display_name?.trim() || isGuest) return;

    if (maxPlayers != null && players.length >= maxPlayers) {
      addNotification(`Limite de ${maxPlayers} jogadores por sessão atingido.`, 'warning', { showToastForMs: 5000 });
      return;
    }
    const canAdd = isMatchStarted || waitingList.length < 10;
    if (!canAdd) return;

    const alreadyInList = players.some(
      (p) => p.user_id === userProfile.id || p.name.toLowerCase().trim() === userProfile.display_name?.toLowerCase().trim()
    );
    if (alreadyInList) {
      addNotification('Você já está na lista.', 'warning', { showToastForMs: 5000 });
      return;
    }

    try {
      let status: 'waiting' | 'team1' | 'team2';
      if (isMatchStarted) {
        if (team1.length < PLAYERS_PER_TEAM) status = 'team1';
        else if (team2.length < PLAYERS_PER_TEAM) status = 'team2';
        else status = 'waiting';
      } else {
        status = 'waiting';
      }

      const { data: newPlayer, error: err } = await supabase
        .from('players')
        .insert({
          name: userProfile.display_name.trim(),
          status,
          user_id: userProfile.id,
          ...(locationId ? { location_id: locationId } : {}),
        })
        .select()
        .single();

      if (err) throw err;

      if (newPlayer) {
        setPlayers((prev) => [...prev, newPlayer as Player].sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        ));
      }
    } catch (err) {
      console.error('Error adding registered player:', err);
      addNotification(err instanceof Error ? err.message : 'Erro ao entrar na fila.', 'error', { showToastForMs: 5000 });
    }
  };

  const addPlayerByNameUnregistered = async () => {
    if (isAdminMode && !canManageSessionPlayers) {
      addNotification('Solicite o controle da sessao para adicionar jogadores.', 'warning', { showToastForMs: 3500 });
      return;
    }
    if (!canAddToList) return;
    const name = unregisteredAddName.trim();
    if (!name) return;

    if (maxPlayers != null && players.length >= maxPlayers) {
      addNotification(`Limite de ${maxPlayers} jogadores por sessão atingido.`, 'warning', { showToastForMs: 5000 });
      return;
    }
    const canAdd = isMatchStarted || waitingList.length < 10;
    if (!canAdd) {
      addNotification('A fila está cheia. Aguarde a partida começar.', 'warning', { showToastForMs: 5000 });
      return;
    }

    const alreadyInList = players.some((p) => p.name.toLowerCase().trim() === name.toLowerCase());
    if (alreadyInList) {
      addNotification('Este nome já está na lista.', 'warning', { showToastForMs: 5000 });
      return;
    }


    try {
      let status: 'waiting' | 'team1' | 'team2';
      if (isMatchStarted) {
        if (team1.length < PLAYERS_PER_TEAM) status = 'team1';
        else if (team2.length < PLAYERS_PER_TEAM) status = 'team2';
        else status = 'waiting';
      } else {
        status = 'waiting';
      }

      const { data: newPlayer, error: err } = await supabase
        .from('players')
        .insert({ name, status, user_id: null, ...(locationId ? { location_id: locationId } : {}) })
        .select()
        .single();

      if (err) throw err;

      if (newPlayer) {
        setUnregisteredAddName('');
        setPlayers((prev) => [...prev, newPlayer as Player].sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        ));
      }
    } catch (err) {
      console.error('Error adding player by name:', err);
      addNotification(err instanceof Error ? err.message : 'Erro ao entrar na fila.', 'error', { showToastForMs: 5000 });
    }
  };

  const addPlayerByNameForAdmin = async () => {
    if (!isAdminMode || !canAddToList || !canManageSessionPlayers) {
      if (isAdminMode && isMatchStarted && !isSessionController) {
        addNotification('Solicite o controle da sessao para adicionar jogadores como gestor.', 'warning', { showToastForMs: 3500 });
      }
      return;
    }

    // Build the list of players to add: selected tags first, then any typed name
    const toAdd: { name: string; userId: string | null }[] = [];
    for (const u of selectedAdminUsers) {
      toAdd.push({ name: getRegisteredUserLabel(u), userId: u.id });
    }
    const typed = adminAddName.trim();
    if (typed && !selectedAdminUsers.some((u) => getRegisteredUserLabel(u) === typed)) {
      toAdd.push({ name: typed, userId: null });
    }
    if (toAdd.length === 0) return;

    if (maxPlayers != null && players.length + toAdd.length > maxPlayers) {
      addNotification(`Limite de ${maxPlayers} jogadores por sessão atingido.`, 'warning', { showToastForMs: 5000 });
      return;
    }

    let currentTeam1Count = team1.length;
    let currentTeam2Count = team2.length;
    let currentWaitingCount = waitingList.length;
    const addedPlayers: Player[] = [];

    try {
      for (const entry of toAdd) {
        const canAdd = isMatchStarted || (currentWaitingCount + currentTeam1Count + currentTeam2Count - team1.length - team2.length) < 10
          ? true
          : currentWaitingCount < 10;
        if (!isMatchStarted && currentWaitingCount >= 10) {
          addNotification('A fila está cheia. Aguarde a partida começar.', 'warning', { showToastForMs: 5000 });
          break;
        }

        const alreadyInList = players.some((p) =>
            p.name.toLowerCase().trim() === entry.name.toLowerCase()
            || (entry.userId && p.user_id && p.user_id === entry.userId)
          )
          || addedPlayers.some((p) =>
            p.name.toLowerCase().trim() === entry.name.toLowerCase()
            || (entry.userId && p.user_id && p.user_id === entry.userId)
          );
        if (alreadyInList) {
          addNotification(`${entry.name} já está na lista.`, 'warning', { showToastForMs: 3000 });
          continue;
        }

        let status: 'waiting' | 'team1' | 'team2';
        if (isMatchStarted) {
          if (currentTeam1Count < PLAYERS_PER_TEAM) { status = 'team1'; currentTeam1Count++; }
          else if (currentTeam2Count < PLAYERS_PER_TEAM) { status = 'team2'; currentTeam2Count++; }
          else { status = 'waiting'; currentWaitingCount++; }
        } else {
          status = 'waiting';
          currentWaitingCount++;
        }

        const { data: newPlayer, error: err } = await supabase
          .from('players')
          .insert({ name: entry.name, status, user_id: entry.userId, ...(locationId ? { location_id: locationId } : {}) })
          .select()
          .single();

        if (err) throw err;
        if (newPlayer) addedPlayers.push(newPlayer as Player);
      }

      if (addedPlayers.length > 0) {
        setAdminAddName('');
        setSelectedAdminUsers([]);
        setAdminUserSuggestions([]);
        setShowAdminSuggestions(false);
        setPlayers((prev) => [...prev, ...addedPlayers].sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        ));
      }
    } catch (err) {
      console.error('Error adding player by name:', err);
      addNotification(err instanceof Error ? err.message : 'Erro ao adicionar jogador.', 'error', { showToastForMs: 5000 });
    }
  };

  const removePlayer = async (id: string) => {
    try {
      await supabase.from('players').delete().eq('id', id);
    } catch (err) {
      console.error('Error removing player:', err);
    }
  };

  const [showPasswordModal, setShowPasswordModal] = useState<{
    type: 'START_MATCH' | 'END_MATCH' | 'ADMIN_ACTIVATE' | 'CLEAR_MOCK';
  } | null>(null);
  const [statsModalPlayer, setStatsModalPlayer] = useState<Player | null>(null);
  const [registeringStatLabel, setRegisteringStatLabel] = useState<string | null>(null);
  const isRegisteringStatRef = useRef(false);
  const [matchPlayerStats, setMatchPlayerStats] = useState<
    Record<string, { points: number; blocks: number; steals: number; assists: number; rebounds: number; clutch_points?: number }>
  >({});
  const [suspendedPlayers, setSuspendedPlayers] = useState<Record<string, SuspendedInfo>>({});
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Fechar modal de stats se o admin perder o controle da sessão
  useEffect(() => {
    if (!canManageSessionPlayers && statsModalPlayer) {
      setStatsModalPlayer(null);
    }
  }, [canManageSessionPlayers, statsModalPlayer]);

  // Bloquear scroll do body em mobile quando modal de stats aberto (evita que toque scrolle em vez de registrar)
  useEffect(() => {
    if (statsModalPlayer) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [statsModalPlayer]);

  // Resetar estado de registro ao fechar o modal
  useEffect(() => {
    if (!statsModalPlayer) {
      setRegisteringStatLabel(null);
      isRegisteringStatRef.current = false;
    }
  }, [statsModalPlayer]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !canManageSessionPlayers) return;
    const oldIndex = waitingList.findIndex((p) => p.id === active.id);
    const newIndex = waitingList.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const draggedPlayer = waitingList[oldIndex];
    const targetPlayer = waitingList[newIndex];
    await supabase.from('players').update({ joined_at: targetPlayer.joined_at }).eq('id', draggedPlayer.id);
    await supabase.from('players').update({ joined_at: draggedPlayer.joined_at }).eq('id', targetPlayer.id);
  }, [canManageSessionPlayers, waitingList]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleRemoveAttempt = async (playerId: string) => {
    if (!canManageSessionPlayers) {
      addNotification('Apenas o gestor com controle da sessao pode remover jogadores.', 'warning', { showToastForMs: 3500 });
      return;
    }
    const playerToRemove = players.find((p) => p.id === playerId);
    if (!playerToRemove) return;
    if (!window.confirm(`Remover ${playerToRemove.name} da lista?`)) return;
    try {
      const status = playerToRemove.status;
      await supabase.from('players').delete().eq('id', playerId);
      if ((status === 'team1' || status === 'team2') && waitingList.length > 0) {
        const nextInLine = waitingList[0];
        await supabase.from('players').update({ status }).eq('id', nextInLine.id);
      }
    } catch (err) {
      console.error('Error removing player:', err);
      addNotification('Erro ao remover jogador.', 'error', { showToastForMs: 5000 });
    }
  };

  const openStartMatchPasswordModal = () => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'START_MATCH' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleStartMatchAttempt = () => {
    if (!isAdminMode) return;
    setShowStartSessionConfirm(true);
  };

  const handleEndMatchAttempt = () => {
    if (!isAdminMode) return;
    if (isMatchStarted && !isSessionController) {
      addNotification('Apenas o gestor que iniciou a sessão pode encerrá-la.', 'warning', { showToastForMs: 4000 });
      return;
    }
    setShowPasswordModal({ type: 'END_MATCH' });
    setPasswordInput('');
    setPasswordError(false);
  };

  // ── Controle de gestão da sessão ─────────────────────────
  const requestSessionControl = async () => {
    if (!user || !hasAdminAccess || !isMatchStarted) return;
    if (isSessionController) return;
    const displayName = userProfile?.display_name?.trim() || user.email?.split('@')[0] || 'Admin';
    await supabase.from('session').update({
      control_requested_by: user.id,
      control_requested_name: displayName,
    }).eq('id', locationId ?? 'current');
    addNotification('Solicitação de controle enviada ao gestor atual.', 'info', { showToastForMs: 3000 });
    fetchSession();
  };

  const acceptControlRequest = async () => {
    if (!controlRequestedBy || !isSessionController) return;
    await supabase.from('session').update({
      controlled_by: controlRequestedBy,
      control_requested_by: null,
      control_requested_name: null,
    }).eq('id', locationId ?? 'current');
    setShowControlRequestModal(false);
    addNotification('Controle da sessão transferido.', 'info', { showToastForMs: 3000 });
    fetchSession();
  };

  const rejectControlRequest = async () => {
    await supabase.from('session').update({
      control_requested_by: null,
      control_requested_name: null,
    }).eq('id', locationId ?? 'current');
    setShowControlRequestModal(false);
    fetchSession();
  };

  const handleAdminActivate = () => {
    if (!hasAdminAccess) {
      addNotification('Apenas administradores podem acessar os controles de configuração.', 'warning', { showToastForMs: 4500 });
      return;
    }
    setShowPasswordModal({ type: 'ADMIN_ACTIVATE' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleClearMockData = () => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'CLEAR_MOCK' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const pointsBlockedByTeams = isMatchStarted && (team1.length < 5 || team2.length < 5);

  const addPlayerStat = async (player: Player, stat: 'points_1' | 'points_2' | 'points_3' | 'blocks' | 'steals' | 'assists' | 'rebounds') => {
    const isPointStat = stat === 'points_1' || stat === 'points_2' || stat === 'points_3';
    const isPlayerInActiveTeam = player.status === 'team1' || player.status === 'team2';
    if (!isPlayerInActiveTeam) {
      addNotification('Atributos só podem ser registrados para jogadores em quadra (Time 1 ou Time 2).', 'warning', { showToastForMs: 4500 });
      return;
    }
    if (isPointStat && pointsBlockedByTeams) {
      addNotification('Times incompletos. É preciso 5 jogadores em cada time para atribuir pontos.', 'warning', { showToastForMs: 4500 });
      return;
    }
    if (isRegisteringStatRef.current) return;
    if (!canManageSessionPlayers) {
      addNotification('Apenas o gestor que iniciou a sessão pode registrar estatísticas.', 'warning', { showToastForMs: 4000 });
      return;
    }
    isRegisteringStatRef.current = true;
    const statLabels: Record<typeof stat, string> = {
      points_1: '1 Ponto',
      points_2: '2 Pontos',
      points_3: '3 Pontos',
      blocks: 'Bloqueio',
      steals: 'Roubo',
      assists: 'Assistência',
      rebounds: 'Rebote',
    };
    setRegisteringStatLabel(statLabels[stat]);
    const userId = player.user_id;
    const isVisitante = !userId;

    // Bloqueios, roubos e assistências: só cadastrados (não afetam placar)
    if (isVisitante && (stat === 'blocks' || stat === 'steals' || stat === 'assists' || stat === 'rebounds')) {
      addNotification('Apenas jogadores cadastrados podem receber bloqueios, roubos, assistências e rebotes no ranking.', 'warning', { showToastForMs: 5000 });
      isRegisteringStatRef.current = false;
      setRegisteringStatLabel(null);
      return;
    }

    const pts = stat === 'points_1' ? 1 : stat === 'points_2' ? 2 : stat === 'points_3' ? 3 : 0;

    // Dispara notificação global de ponto para jogadores cadastrados
    if (pts > 0 && userId) {
      supabase.channel('global-points').send({
        type: 'broadcast',
        event: 'point_scored',
        payload: {
          playerName: player.name,
          points: pts,
          locationId: locationId ?? '',
          locationName: locationName ?? 'Local Desconhecido',
          avatarUrl: userAvatars[userId] || '',
        }
      }).catch(console.error);
    }

    try {
      // Atualizar stats (ranking) apenas para jogadores cadastrados
      if (userId) {
        // Usa o estado local (já carregado pelo fetchStats) para evitar SELECT com filtro que falha via RLS
        const existing = stats.find((s) => s.user_id === userId) ?? null;

        if (existing) {
          const updates =
            (stat === 'points_1' || stat === 'points_2' || stat === 'points_3')
              ? { points: (existing.points ?? 0) + pts, user_id: userId }
              : stat === 'blocks'
                ? { blocks: (existing.blocks ?? 0) + 1, user_id: userId }
                : stat === 'steals'
                  ? { steals: (existing.steals ?? 0) + 1, user_id: userId }
                  : stat === 'rebounds'
                    ? { rebounds: (existing.rebounds ?? 0) + 1, user_id: userId }
                    : { assists: (existing.assists ?? 0) + 1, user_id: userId };
          const { error: updErr } = await supabase.from('stats').update(updates).eq('id', existing.id);
          if (updErr) throw updErr;
        } else {
          const base: Record<string, unknown> = {
            name: player.name,
            user_id: userId,
            wins: 0,
            points: pts,
            blocks: stat === 'blocks' ? 1 : 0,
            steals: stat === 'steals' ? 1 : 0,
            rebounds: stat === 'rebounds' ? 1 : 0,
            clutch_points: 0,
            ...(locationId ? { location_id: locationId } : {}),
          };
          if (stat === 'assists') base.assists = 1;
          const { error: insErr } = await supabase.from('stats').insert(base);
          if (insErr) throw insErr;
        }
        fetchStats();

        // Log para destaque semanal
        const logType = (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') ? 'points' : stat;
        const logValue = (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') ? pts : 1;
        supabase.from('stat_logs').insert({
          stat_type: logType,
          value: logValue,
          user_id: userId,
          location_id: locationId ?? null,
        }).then(() => {});
      }

      // Atualizar matchPlayerStats (tracking por partida)
      const matchStatKey = (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') ? 'points' : stat;
      const delta = (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') ? pts : 1;
      const prevMatchPts = matchPlayerStats[player.id]?.points ?? 0;
      const newMatchPts = matchStatKey === 'points' ? prevMatchPts + delta : prevMatchPts;
      setMatchPlayerStats((prev) => {
        const current = prev[player.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
        return { ...prev, [player.id]: { ...current, [matchStatKey]: (current[matchStatKey as keyof typeof current] ?? 0) + delta } };
      });

      // Hot streak: ao atingir 6+ pontos na partida, atualizar hot_streak_since
      if (userId && newMatchPts >= 6 && prevMatchPts < 6) {
        const existing = stats.find((s) => s.user_id === userId);
        if (existing) {
          await supabase.from('stats').update({ hot_streak_since: new Date().toISOString() }).eq('id', existing.id);
          fetchStats();
        }
      }

      // Pontos: sempre atualiza o placar da partida (visitantes só contam para o jogo)
      if (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') {
        let partidaId = currentPartidaSessaoId;

        // Garantir partida_sessao existe (corrige sessão sem current_partida_sessao_id)
        if (!partidaId && isMatchStarted && (team1.length === 5 && team2.length === 5)) {
          const { data: novaPartida, error: insErr } = await supabase
            .from('partida_sessoes')
            .insert(locationId ? { location_id: locationId } : {})
            .select('id')
            .single();
          if (!insErr && novaPartida?.id) {
            partidaId = novaPartida.id;
            await supabase.from('session').update({ current_partida_sessao_id: partidaId }).eq('id', locationId ?? 'current');
            setCurrentPartidaSessaoId(partidaId);
          }
        }

        if (partidaId) {
          const { data: sessao, error: fetchErr } = await supabase
            .from('partida_sessoes')
            .select('team1_points, team2_points, player_points')
            .eq('id', partidaId)
            .single();
          if (fetchErr || !sessao) {
            addNotification('Erro ao buscar placar da partida.', 'error', { showToastForMs: 5000 });
            throw new Error('fetch_sessao_failed');
          }
          const parsed = parsePartidaPlayerPoints(sessao.player_points);
          
          let teamKey: 'team1' | 'team2' | null = null;
          if (player.status === 'team1' || player.status === 'team2') {
            teamKey = player.status;
          } else if (parsed.team1[player.id]) {
            teamKey = 'team1';
          } else if (parsed.team2[player.id]) {
            teamKey = 'team2';
          }

          if (teamKey) {
            const identity = { user_id: player.user_id ?? null, name: player.name };
            const nextPp = applyPlayerPointsDelta(parsed, teamKey, player.id, pts, identity);
            const totals = totalsFromPlayerPoints(nextPp);
            const t1Before = (sessao.team1_points ?? 0) as number;
            const t2Before = (sessao.team2_points ?? 0) as number;
            if (t1Before === 0 && t2Before === 0 && pts > 0) {
              firstScoringTeamRef.current = teamKey;
            }
            const decisivePts = decisiveBasketPoints(teamKey, t1Before, t2Before, totals.t1, totals.t2, pts);
            setTeam1MatchPoints(totals.t1);
            setTeam2MatchPoints(totals.t2);
            if (totals.t1 >= 12) setShowWinnerModal('team1');
            else if (totals.t2 >= 12) setShowWinnerModal('team2');
            const { error: updErr } = await supabase
              .from('partida_sessoes')
              .update({ player_points: partidaPlayerPointsToJson(nextPp) })
              .eq('id', partidaId);
            if (updErr) {
              const prevT = totalsFromPlayerPoints(parsed);
              setTeam1MatchPoints(prevT.t1);
              setTeam2MatchPoints(prevT.t2);
              addNotification(updErr.message || 'Erro ao atualizar placar.', 'error', { showToastForMs: 5000 });
            } else {
              fetchPartidaSessao(partidaId);
              if (userId && decisivePts > 0) {
                const row = stats.find((s) => s.user_id === userId);
                if (row) {
                  await supabase
                    .from('stats')
                    .update({ clutch_points: (row.clutch_points ?? 0) + decisivePts })
                    .eq('id', row.id);
                  fetchStats();
                }
                setMatchPlayerStats((prev) => {
                  const cur = prev[player.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
                  return {
                    ...prev,
                    [player.id]: {
                      ...cur,
                      clutch_points: (cur.clutch_points ?? 0) + decisivePts,
                    },
                  };
                });
              }
            }
          }
        }
      }
      setStatsModalPlayer(null);
    } catch (err: unknown) {
      console.error('Error adding stat:', err);
      const msg = (err as Error)?.message;
      if (msg !== 'fetch_sessao_failed') {
        addNotification('Erro ao registrar estatística.', 'error', { showToastForMs: 5000 });
      }
    } finally {
      isRegisteringStatRef.current = false;
      setRegisteringStatLabel(null);
    }
  };

  const removePlayerStat = async (player: Player, stat: 'points_1' | 'points_2' | 'points_3' | 'blocks' | 'steals' | 'assists' | 'rebounds') => {
    if (!isAdminMode) return;
    if (!canManageSessionPlayers) {
      addNotification('Apenas o gestor com controle da sessao pode ajustar estatísticas.', 'warning', { showToastForMs: 4000 });
      return;
    }
    if (isRegisteringStatRef.current) return;
    isRegisteringStatRef.current = true;
    const statLabels: Record<typeof stat, string> = {
      points_1: '-1 Ponto', points_2: '-2 Pontos', points_3: '-3 Pontos', blocks: '-Bloqueio',
      steals: '-Roubo', assists: '-Assistência', rebounds: '-Rebote',
    };
    setRegisteringStatLabel(statLabels[stat]);
    const userId = player.user_id;
    const pts = stat === 'points_1' ? 1 : stat === 'points_2' ? 2 : stat === 'points_3' ? 3 : 0;

    try {
      // Update ranking stats for registered players
      if (userId) {
        const existing = stats.find((s) => s.user_id === userId) ?? null;
        if (existing) {
          const updates =
            (stat === 'points_1' || stat === 'points_2' || stat === 'points_3')
              ? { points: Math.max((existing.points ?? 0) - pts, 0) }
              : stat === 'blocks'
                ? { blocks: Math.max((existing.blocks ?? 0) - 1, 0) }
                : stat === 'steals'
                  ? { steals: Math.max((existing.steals ?? 0) - 1, 0) }
                  : stat === 'rebounds'
                    ? { rebounds: Math.max((existing.rebounds ?? 0) - 1, 0) }
                    : { assists: Math.max((existing.assists ?? 0) - 1, 0) };
          await supabase.from('stats').update(updates).eq('id', existing.id);
          fetchStats();
        }
      }

      // Atualizar matchPlayerStats (tracking por partida)
      const matchStatKey = (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') ? 'points' : stat;
      const delta = (stat === 'points_1' || stat === 'points_2' || stat === 'points_3') ? pts : 1;
      setMatchPlayerStats((prev) => {
        const current = prev[player.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
        return { ...prev, [player.id]: { ...current, [matchStatKey]: Math.max((current[matchStatKey as keyof typeof current] ?? 0) - delta, 0) } };
      });

      // Update match scoreboard for points
      if ((stat === 'points_1' || stat === 'points_2' || stat === 'points_3') && (player.status === 'team1' || player.status === 'team2')) {
        const partidaId = currentPartidaSessaoId;
        if (partidaId) {
          const { data: sessao } = await supabase
            .from('partida_sessoes')
            .select('player_points, team1_points, team2_points')
            .eq('id', partidaId)
            .single();
          if (sessao) {
            const parsed = parsePartidaPlayerPoints(sessao.player_points);
            const teamKey = player.status as 'team1' | 'team2';
            const identity = { user_id: player.user_id ?? null, name: player.name };
            const t1Before = (sessao.team1_points ?? 0) as number;
            const t2Before = (sessao.team2_points ?? 0) as number;
            const nextPp = applyPlayerPointsDelta(parsed, teamKey, player.id, -pts, identity);
            const totals = totalsFromPlayerPoints(nextPp);
            const reversePts = reverseDecisiveBasketPoints(teamKey, t1Before, t2Before, totals.t1, totals.t2, pts);
            if (totals.t1 === 0 && totals.t2 === 0) {
              firstScoringTeamRef.current = null;
            }
            await supabase
              .from('partida_sessoes')
              .update({ player_points: partidaPlayerPointsToJson(nextPp) })
              .eq('id', partidaId);
            setTeam1MatchPoints(totals.t1);
            setTeam2MatchPoints(totals.t2);
            setShowWinnerModal(null);
            fetchPartidaSessao(partidaId);
            if (userId && reversePts > 0) {
              const row = stats.find((s) => s.user_id === userId);
              if (row) {
                await supabase
                  .from('stats')
                  .update({ clutch_points: Math.max((row.clutch_points ?? 0) - reversePts, 0) })
                  .eq('id', row.id);
                fetchStats();
              }
              setMatchPlayerStats((prev) => {
                const cur = prev[player.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
                return {
                  ...prev,
                  [player.id]: {
                    ...cur,
                    clutch_points: Math.max((cur.clutch_points ?? 0) - reversePts, 0),
                  },
                };
              });
            }
          }
        }
      }
      setStatsModalPlayer(null);
    } catch (err) {
      console.error('Error removing stat:', err);
      addNotification('Erro ao corrigir estatística.', 'error', { showToastForMs: 5000 });
    } finally {
      isRegisteringStatRef.current = false;
      setRegisteringStatLabel(null);
    }
  };

  // Ajusta stat inline no resumo da partida — sem spinner, sem fechar modal
  const adjustStatFromSummary = async (player: Player, statKey: 'points' | 'blocks' | 'steals' | 'assists' | 'rebounds', delta: number) => {
    if (!isAdminMode && delta < 0) return;
    if (!canManageSessionPlayers) {
      addNotification('Apenas o gestor da sessão pode ajustar estatísticas.', 'warning', { showToastForMs: 4000 });
      return;
    }
    const userId = player.user_id;

    // Pontos: placar + decisivos (cesta da vitória) alinhados ao mesmo update
    if (statKey === 'points') {
      const partidaId = currentPartidaSessaoId;
      if (!partidaId) return;

      const { data: sessao } = await supabase
        .from('partida_sessoes')
        .select('player_points, team1_points, team2_points')
        .eq('id', partidaId)
        .single();
      if (!sessao) return;

      const parsed = parsePartidaPlayerPoints(sessao.player_points);
      
      let teamKey: 'team1' | 'team2' | null = null;
      if (player.status === 'team1' || player.status === 'team2') {
        teamKey = player.status;
      } else if (parsed.team1[player.id]) {
        teamKey = 'team1';
      } else if (parsed.team2[player.id]) {
        teamKey = 'team2';
      }

      if (teamKey) {
        const t1B = (sessao.team1_points ?? 0) as number;
        const t2B = (sessao.team2_points ?? 0) as number;
        const identity = { user_id: player.user_id ?? null, name: player.name };
        const nextPp = applyPlayerPointsDelta(parsed, teamKey, player.id, delta, identity);
        const totals = totalsFromPlayerPoints(nextPp);

        let clutchDelta = 0;
        if (delta > 0) {
          clutchDelta = decisiveBasketPoints(teamKey, t1B, t2B, totals.t1, totals.t2, delta);
          
          // Dispara notificação global de ponto para jogadores cadastrados
          if (userId) {
            supabase.channel('global-points').send({
              type: 'broadcast',
              event: 'point_scored',
              payload: {
                playerName: player.name,
                points: delta,
                locationId: locationId ?? '',
                locationName: locationName ?? 'Local Desconhecido',
                avatarUrl: userAvatars[userId] || '',
              }
            }).catch(console.error);
          }
        } else if (delta < 0) {
          clutchDelta = -reverseDecisiveBasketPoints(teamKey, t1B, t2B, totals.t1, totals.t2, -delta);
        }

        await supabase
          .from('partida_sessoes')
          .update({ player_points: partidaPlayerPointsToJson(nextPp) })
          .eq('id', partidaId);
        setTeam1MatchPoints(totals.t1);
        setTeam2MatchPoints(totals.t2);
        if (delta < 0) setShowWinnerModal(null);
        else if (totals.t1 >= 12) setShowWinnerModal('team1');
        else if (totals.t2 >= 12) setShowWinnerModal('team2');
        fetchPartidaSessao(partidaId);

        if (userId) {
          const existing = stats.find((s) => s.user_id === userId) ?? null;
          if (existing) {
            const newPoints = Math.max((existing.points ?? 0) + delta, 0);
            await supabase
              .from('stats')
              .update({
                points: newPoints,
                clutch_points: Math.max((existing.clutch_points ?? 0) + clutchDelta, 0),
              })
              .eq('id', existing.id);
            fetchStats();
          }
          // Log semanal
          if (delta !== 0) {
            supabase.from('stat_logs').insert({ stat_type: 'points', value: delta, user_id: userId, location_id: locationId ?? null }).then(() => {});
          }
          if (clutchDelta !== 0) {
            supabase.from('stat_logs').insert({ stat_type: 'clutch_points', value: clutchDelta, user_id: userId, location_id: locationId ?? null }).then(() => {});
          }
        }

        setMatchPlayerStats((prev) => {
          const current = prev[player.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
          const newPts = Math.max((current.points ?? 0) + delta, 0);
          return {
            ...prev,
            [player.id]: {
              ...current,
              points: newPts,
              clutch_points: Math.max((current.clutch_points ?? 0) + clutchDelta, 0),
            },
          };
        });
        return;
      }
    }

    setMatchPlayerStats((prev) => {
      const current = prev[player.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
      const newVal = Math.max((current[statKey] ?? 0) + delta, 0);
      return { ...prev, [player.id]: { ...current, [statKey]: newVal } };
    });

    if (userId) {
      const existing = stats.find((s) => s.user_id === userId) ?? null;
      if (existing) {
        const newVal = Math.max((existing[statKey] ?? 0) + delta, 0);
        await supabase.from('stats').update({ [statKey]: newVal }).eq('id', existing.id);
        fetchStats();
      }
      // Log semanal
      if (delta !== 0) {
        supabase.from('stat_logs').insert({ stat_type: statKey, value: delta, user_id: userId, location_id: locationId ?? null }).then(() => {});
      }
    }
  };

  // ── Suspensão temporária de jogador ──────────────────────
  const suspendPlayer = async (player: Player) => {
    if (!isAdminMode) return;
    if (player.status !== 'team1' && player.status !== 'team2') return;

    const originalTeam = player.status as 'team1' | 'team2';
    let replacedById: string | null = null;

    // Mover jogador para status suspended
    await supabase.from('players').update({ status: 'suspended' }).eq('id', player.id);

    // Promover próximo da fila de espera para o time
    if (waitingList.length > 0) {
      const next = waitingList[0];
      await supabase.from('players').update({ status: originalTeam }).eq('id', next.id);
      replacedById = next.id;
    }

    setSuspendedPlayers((prev) => ({
      ...prev,
      [player.id]: { originalTeam, replacedById, joined_at_before_suspend: player.joined_at },
    }));
    setStatsModalPlayer(null);
    await fetchPlayers();
    addNotification(`${player.name} suspenso temporariamente.`, 'info', { showToastForMs: 3000 });
  };

  const reinsertPlayer = async (player: Player) => {
    if (!canManageSessionPlayers) return;
    const info = suspendedPlayers[player.id];
    if (!info) return;

    const { originalTeam, replacedById } = info;

    // Mover substituto de volta para a fila PRIMEIRO (liberar a vaga)
    if (replacedById) {
      const substitute = players.find((p) => p.id === replacedById);
      if (substitute && (substitute.status === 'team1' || substitute.status === 'team2')) {
        const earlyTime = waitingList.length > 0
          ? new Date(Math.min(...waitingList.map((p) => new Date(p.joined_at).getTime())) - 1000).toISOString()
          : new Date(Date.now() - 60000).toISOString();
        await supabase.from('players').update({ status: 'waiting', joined_at: earlyTime }).eq('id', replacedById);
      }
    }

    // Verificar que o time não ficará com mais de 5 após a reinserção
    const { data: teamNow } = await supabase.from('players').select('id').eq('status', originalTeam);
    if ((teamNow ?? []).length >= 5) {
      // Time lotado (substituto pode não ter saído) — mover o mais recente para a fila
      const teamPlayers = players.filter((p) => p.status === originalTeam);
      const last = teamPlayers[teamPlayers.length - 1];
      if (last) {
        await supabase.from('players').update({ status: 'waiting', joined_at: new Date().toISOString() }).eq('id', last.id);
      }
    }

    // Agora sim reinserir o jogador suspenso
    await supabase.from('players').update({ status: originalTeam }).eq('id', player.id);

    setSuspendedPlayers((prev) => {
      const next = { ...prev };
      delete next[player.id];
      return next;
    });
    await fetchPlayers();
    addNotification(`${player.name} reinserido no ${originalTeam === 'team1' ? 'Time 1' : 'Time 2'}.`, 'info', { showToastForMs: 3000 });
  };

  const startNextMatch = async () => {
    if (!showWinnerModal) return;
    if (team1MatchPoints < 12 && team2MatchPoints < 12) return;
    if (isStartingNextMatch) return;
    if (isMatchStarted && !isSessionController) return;

    const winningTeamKey = team1MatchPoints >= 12 ? 'team1' : 'team2';
    const losingTeamKey = winningTeamKey === 'team1' ? 'team2' : 'team1';
    const losers = losingTeamKey === 'team1' ? team1 : team2;
    const winners = winningTeamKey === 'team1' ? team1 : team2;

    setShowWinnerModal(null);
    setIsStartingNextMatch(true);

    try {
      const oldPartidaId = currentPartidaSessaoId;
      const { data: novaPartida, error: insPartidaErr } = await supabase
        .from('partida_sessoes')
        .insert(locationId ? { location_id: locationId } : {})
        .select('id')
        .single();
      if (insPartidaErr) throw insPartidaErr;
      const newPartidaId = novaPartida?.id ?? null;
      if (!newPartidaId) throw new Error('new_partida_missing');

      await supabase
        .from('session')
        .update({ current_partida_sessao_id: newPartidaId })
        .eq('id', locationId ?? 'current');
      setCurrentPartidaSessaoId(newPartidaId);
      firstScoringTeamRef.current = null;

      if (oldPartidaId) {
        await supabase
          .from('partida_sessoes')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', oldPartidaId);
      }

      setTeam1MatchPoints(0);
      setTeam2MatchPoints(0);
      setMatchPlayerStats({});

      const suspendSnapshot: Record<string, SuspendedInfo> = { ...suspendedPlayers };

      // ── Lidar com jogadores suspensos ──
      // Substitutos sempre vão para o novo time (primeiro a entrar)
      const substitutesForNewTeam: string[] = [];

      // IDs de suspensos que serão reinseridos no time vencedor (protegidos do safety check)
      const reinsertedToWinning = new Set<string>();

      for (const sp of suspendedList) {
        const info = suspendSnapshot[sp.id];

        if (!info) {
          // Fallback: estado de suspensão perdido (ex: refresh da página).
          // Tentar inferir: se o time vencedor tem >4 jogadores, o suspenso provavelmente era dele
          // (o substituto está ocupando a vaga). Caso contrário, mover para fila.
          const winCount = winners.length;
          if (winCount >= 5) {
            // Time vencedor está cheio (4 originais + substituto) → suspenso era deste time
            await supabase.from('players').update({ status: winningTeamKey }).eq('id', sp.id);
            reinsertedToWinning.add(sp.id);
          } else {
            await supabase
              .from('players')
              .update({ status: 'waiting', joined_at: sp.joined_at })
              .eq('id', sp.id);
          }
          continue;
        }

        if (info.originalTeam === winningTeamKey) {
          // Suspenso do time vencedor → volta ao time vencedor
          await supabase.from('players').update({ status: winningTeamKey }).eq('id', sp.id);
          reinsertedToWinning.add(sp.id);
        }
        // Perdedor: vai à fila junto com o time no bloco único abaixo (não volta ao time — time “some” na nova partida)

        // Substituto sempre vai direto para o novo time
        if (info.replacedById) {
          substitutesForNewTeam.push(info.replacedById);
        }
      }
      setSuspendedPlayers({});

      // Mover substitutos direto para o novo time
      const substituteSet = new Set(substitutesForNewTeam);
      for (const subId of substitutesForNewTeam) {
        await supabase.from('players').update({ status: losingTeamKey }).eq('id', subId);
      }

      // Perdedores de quadra + suspensos do time perdedor → mesma fila, ordenados (juntos com o time)
      const fieldLosers = losers.filter((p) => !substituteSet.has(p.id));
      const suspendedLosers = suspendedList.filter((sp) => suspendSnapshot[sp.id]?.originalTeam === losingTeamKey);
      const sortLosingKey = (p: Player) => {
        const inf = suspendSnapshot[p.id];
        if (inf?.originalTeam === losingTeamKey) {
          return new Date(inf.joined_at_before_suspend).getTime();
        }
        return new Date(p.joined_at).getTime();
      };
      const losingGroupOrdered = [...fieldLosers, ...suspendedLosers].sort(
        (a, b) => sortLosingKey(a) - sortLosingKey(b)
      );

      const maxWaitingTime =
        waitingList.length > 5
          ? Math.max(...waitingList.slice(5).map((p) => new Date(p.joined_at).getTime()))
          : Date.now() - 10000;

      for (let i = 0; i < losingGroupOrdered.length; i++) {
        const joinedAt = new Date(maxWaitingTime + (i + 1) * 1000).toISOString();
        await supabase.from('players').update({ status: 'waiting', joined_at: joinedAt }).eq('id', losingGroupOrdered[i].id);
      }

      // Re-fetch para obter estado real do banco após todas as movimentações
      const { data: freshPlayers } = await supabase.from('players').select('*').order('joined_at', { ascending: true });
      const allFresh = (freshPlayers ?? []) as Player[];
      const freshWaiting = allFresh.filter((p) => p.status === 'waiting');

      // ── Contagem real do banco: nunca exceder 5 por time ──
      const alreadyOnNewTeam = allFresh.filter((p) => p.status === losingTeamKey).length;
      const spotsNeeded = Math.max(0, 5 - alreadyOnNewTeam);
      const nextFromWaiting = freshWaiting.slice(0, spotsNeeded);

      for (const p of nextFromWaiting) {
        await supabase.from('players').update({ status: losingTeamKey }).eq('id', p.id);
      }

      // Safety: garantir que o time vencedor também não exceda 5
      // Proteger jogadores reinseridos (suspensos devolvidos ao time) — remover outros primeiro
      const onWinningTeam = allFresh.filter((p) => p.status === winningTeamKey);
      if (onWinningTeam.length > 5) {
        // Priorizar a remoção de quem NÃO é reinserido
        const removable = onWinningTeam.filter((p) => !reinsertedToWinning.has(p.id));
        const excessCount = onWinningTeam.length - 5;
        const toRemove = removable.slice(-excessCount);
        for (const ep of toRemove) {
          await supabase.from('players').update({ status: 'waiting', joined_at: new Date().toISOString() }).eq('id', ep.id);
        }
      }
      const jogadoresDaPartida = [
        ...winners.map((player) => ({ player, venceu: true })),
        ...losers.map((player) => ({ player, venceu: false })),
      ];

      for (const { player: p, venceu } of jogadoresDaPartida) {
        const userId = p.user_id;
        if (!userId) continue;
        const s = stats.find((st) => st.user_id === userId)
          ?? stats.find((st) => st.name === p.name)
          ?? null;
        if (s) {
          await supabase
            .from('stats')
            .update({
              partidas: (s.partidas ?? 0) + 1,
              wins: (s.wins ?? 0) + (venceu ? 1 : 0),
              user_id: userId,
            })
            .eq('id', s.id);
        } else {
          await supabase.from('stats').insert({
            name: p.name,
            user_id: userId,
            partidas: 1,
            wins: venceu ? 1 : 0,
            points: 0,
            blocks: 0,
            steals: 0,
            clutch_points: 0,
            ...(locationId ? { location_id: locationId } : {}),
          });
        }
        // Log vitória para destaque semanal
        if (venceu) {
          supabase.from('stat_logs').insert({ stat_type: 'wins', value: 1, user_id: userId, location_id: locationId ?? null }).then(() => {});
        }
      }
      await fetchPlayers();
      fetchStats();
    } catch (err) {
      console.error('Error starting next match:', err);
      addNotification('Erro ao iniciar próxima partida.', 'error', { showToastForMs: 5000 });
    } finally {
      setIsStartingNextMatch(false);
    }
  };


  const startNextMatchRef = useRef(startNextMatch);
  startNextMatchRef.current = startNextMatch;

  useEffect(() => {
    if (!showWinnerModal || !isAdminMode) return;
    const t = setTimeout(() => startNextMatchRef.current(), 5000);
    return () => clearTimeout(t);
  }, [showWinnerModal, isAdminMode]);


  const confirmAction = async () => {
    if (!userProfile?.admin_pin || passwordInput !== userProfile.admin_pin) {
      setPasswordError(true);
      return;
    }

    if (!showPasswordModal) return;

    if (showPasswordModal.type === 'ADMIN_ACTIVATE') {
      setIsAdminMode(true);
      setAdminModeStored(true);
      setShowPasswordModal(null);
      setPasswordInput('');
      return;
    }

    try {
      if (showPasswordModal.type === 'START_MATCH') {
        const { data: partidaSessao, error: insertErr } = await supabase
          .from('partida_sessoes')
          .insert(locationId ? { location_id: locationId } : {})
          .select('id')
          .single();

        if (insertErr) throw insertErr;

        const sessionId = locationId ?? 'current';
        await supabase
          .from('session')
          .upsert({
            id: sessionId,
            is_started: true,
            started_at: new Date().toISOString(),
            current_partida_sessao_id: partidaSessao?.id,
            controlled_by: user?.id ?? null,
            control_requested_by: null,
            control_requested_name: null,
            ...(locationId ? { location_id: locationId } : {}),
          });

        // Alocar jogadores da lista de espera nos times
        const sorted = [...waitingList].sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        );
        let t1 = team1.length;
        let t2 = team2.length;
        for (const p of sorted) {
          if (t1 < PLAYERS_PER_TEAM) {
            await supabase.from('players').update({ status: 'team1' }).eq('id', p.id);
            t1++;
          } else if (t2 < PLAYERS_PER_TEAM) {
            await supabase.from('players').update({ status: 'team2' }).eq('id', p.id);
            t2++;
          } else {
            break;
          }
        }

        setIsMatchStarted(true);
        setCurrentPartidaSessaoId(partidaSessao?.id ?? null);
        firstScoringTeamRef.current = null;
        setTeam1MatchPoints(0);
        setTeam2MatchPoints(0);
        await fetchPlayers();
      } else if (showPasswordModal.type === 'CLEAR_MOCK') {
        await supabase.from('session').update({
          is_started: false,
          started_at: null,
          current_partida_sessao_id: null,
          controlled_by: null,
          control_requested_by: null,
          control_requested_name: null,
        }).eq('id', locationId ?? 'current');
        await supabase.from('partida_sessoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Stats de jogadores rankeados são preservadas
        setIsMatchStarted(false);
        setCurrentPartidaSessaoId(null);
        setTeam1MatchPoints(0);
        setTeam2MatchPoints(0);
        setPlayers([]);
        await fetchPlayers();
      } else if (showPasswordModal.type === 'END_MATCH') {
        if (currentPartidaSessaoId) {
          await supabase
            .from('partida_sessoes')
            .update({ ended_at: new Date().toISOString() })
            .eq('id', currentPartidaSessaoId);
        }

        await supabase
          .from('session')
          .update({
            is_started: false,
            current_partida_sessao_id: null,
            controlled_by: null,
            control_requested_by: null,
            control_requested_name: null,
          })
          .eq('id', locationId ?? 'current');

        for (const p of players) {
          await supabase.from('players').delete().eq('id', p.id);
        }

        setIsMatchStarted(false);
        setCurrentPartidaSessaoId(null);
        setTeam1MatchPoints(0);
        setTeam2MatchPoints(0);
      }

      setShowPasswordModal(null);
    } catch (err) {
      console.error('Error performing action:', err);
      addNotification('Erro ao realizar ação.', 'error', { showToastForMs: 5000 });
    }
  };

  const handleCreateEvento = async () => {
    if (!isAdminMode || !locationId) return;
    const { title, description, event_date, type, modality, max_participants, event_time } = eventoForm;
    if (!title.trim() || !event_date) {
      addNotification('Preencha o título e a data do evento.', 'warning', { showToastForMs: 4000 });
      return;
    }
    try {
      const { error } = await supabase.from('eventos').insert({
        location_id: locationId,
        title: title.trim(),
        description: description.trim() || null,
        event_date,
        event_time: event_time || null,
        type,
        modality,
        max_participants: max_participants ? parseInt(max_participants) : null,
        status: 'open',
      });
      if (error) throw error;
      setShowEventoForm(false);
      setEventoForm({ title: '', description: '', event_date: '', event_time: '', type: 'torneio', modality: '5x5', max_participants: '' });
      await fetchEventos();
      addNotification('Evento criado com sucesso!', 'info', { showToastForMs: 3000 });
    } catch (err) {
      console.error('Error creating evento:', err);
      addNotification('Erro ao criar evento.', 'error', { showToastForMs: 5000 });
    }
  };

  const handleDeleteEvento = async (eventoId: string) => {
    if (!isAdminMode) return;
    if (!window.confirm('Excluir este evento?')) return;
    try {
      await supabase.from('eventos').delete().eq('id', eventoId);
      await fetchEventos();
    } catch (err) {
      console.error('Error deleting evento:', err);
    }
  };

  const resetQueue = async () => {
    if (!window.confirm('Resetar os times? Todos os jogadores dos times voltam para a lista de espera.')) return;
    try {
      const t1 = team1MatchPoints;
      const t2 = team2MatchPoints;
      const sortByJoined = (a: Player, b: Player) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      const team1Players = players.filter((p) => p.status === 'team1').sort(sortByJoined);
      const team2Players = players.filter((p) => p.status === 'team2').sort(sortByJoined);

      const suspendSnap = suspendedPlayers;
      const sortKeyInclSuspended = (p: Player) =>
        p.status === 'suspended' && suspendSnap[p.id]
          ? new Date(suspendSnap[p.id].joined_at_before_suspend).getTime()
          : new Date(p.joined_at).getTime();
      const mergeTeamWithSuspended = (active: Player[], teamKey: 'team1' | 'team2') => {
        const sus = suspendedList.filter((sp) => suspendSnap[sp.id]?.originalTeam === teamKey);
        return [...active, ...sus].sort((a, b) => sortKeyInclSuspended(a) - sortKeyInclSuspended(b));
      };

      const block1 = mergeTeamWithSuspended(team1Players, 'team1');
      const block2 = mergeTeamWithSuspended(team2Players, 'team2');

      let teamPlayersOrdered: Player[] =
        t1 > t2
          ? [...block1, ...block2]
          : t2 > t1
            ? [...block2, ...block1]
            : firstScoringTeamRef.current === 'team2'
              ? [...block2, ...block1]
              : [...block1, ...block2];

      const inOrdered = new Set(teamPlayersOrdered.map((p) => p.id));
      const orphanSuspended = suspendedList.filter((sp) => !inOrdered.has(sp.id));
      if (orphanSuspended.length > 0) {
        teamPlayersOrdered = [...teamPlayersOrdered, ...orphanSuspended.sort(sortByJoined)];
      }

      if (teamPlayersOrdered.length === 0 && suspendedList.length === 0) {
        addNotification('Nenhum jogador nos times para resetar.', 'info', { showToastForMs: 3000 });
        return;
      }

      const oldPartidaId = currentPartidaSessaoId;
      if (oldPartidaId) {
        await supabase.from('partida_sessoes').update({ ended_at: new Date().toISOString() }).eq('id', oldPartidaId);
      }

      setShowWinnerModal(null);

      // Suspensos entram na fila no mesmo bloco do seu time (ordem relativa por joined_at / antes da suspensão), depois do último que já estava em espera
      const waitingTimes = waitingList.map((p) => new Date(p.joined_at).getTime());
      const lastWaiting =
        waitingTimes.length > 0 ? Math.max(...waitingTimes) : Date.now() - 60000;

      for (let i = 0; i < teamPlayersOrdered.length; i++) {
        const joinedAt = new Date(lastWaiting + (i + 1) * 1000).toISOString();
        await supabase.from('players').update({ status: 'waiting', joined_at: joinedAt }).eq('id', teamPlayersOrdered[i].id);
      }
      setSuspendedPlayers({});

      firstScoringTeamRef.current = null;

      const emptyPlayerPoints = partidaPlayerPointsToJson({ team1: {}, team2: {} });
      const { data: updatedPlayers } = await supabase.from('players').select('*').order('joined_at', { ascending: true });
      const allWaiting = ((updatedPlayers ?? []) as Player[]).filter((p) => p.status === 'waiting');

      if (allWaiting.length >= 10) {
        const next10 = allWaiting.slice(0, 10);
        for (let i = 0; i < 5; i++) {
          await supabase.from('players').update({ status: 'team1' }).eq('id', next10[i].id);
        }
        for (let i = 5; i < 10; i++) {
          await supabase.from('players').update({ status: 'team2' }).eq('id', next10[i].id);
        }
        const { data: partidaSessao, error: insertErr } = await supabase
          .from('partida_sessoes')
          .insert(
            locationId
              ? { location_id: locationId, player_points: emptyPlayerPoints }
              : { player_points: emptyPlayerPoints }
          )
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        const sessionRowId = locationId ?? 'current';
        await supabase.from('session').upsert({
          id: sessionRowId,
          is_started: true,
          started_at: new Date().toISOString(),
          current_partida_sessao_id: partidaSessao?.id,
          ...(locationId ? { location_id: locationId } : {}),
        });
        setIsMatchStarted(true);
        setCurrentPartidaSessaoId(partidaSessao?.id ?? null);
      } else {
        await supabase.from('session').update({
          is_started: false,
          current_partida_sessao_id: null,
          controlled_by: null,
          control_requested_by: null,
          control_requested_name: null,
        }).eq('id', locationId ?? 'current');
        setIsMatchStarted(false);
        setCurrentPartidaSessaoId(null);
      }
      setTeam1MatchPoints(0);
      setTeam2MatchPoints(0);
      setMatchPlayerStats({});
      await fetchPlayers();
      await fetchSession();
    } catch (err) {
      console.error('Error resetting queue:', err);
      addNotification('Erro ao resetar lista.', 'error', { showToastForMs: 5000 });
    }
  };

  if (loading) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center transition-colors duration-300',
          darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        )}
      >
        <RefreshCw className="animate-spin w-8 h-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-screen font-sans selection:bg-orange-500/30 transition-colors duration-300 overflow-x-hidden',
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}
    >
      <style>{`
        @keyframes fire-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hot-streak-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.85; }
        }
      `}</style>
      <GlobalPointsListener currentLocationId={locationId} />
      <AnimatePresence>
        {/* Modal: solicitação de controle recebida (para o controlador atual) */}
        {showControlRequestModal && controlRequestedName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className={cn(
                'border p-6 rounded-3xl shadow-2xl max-w-sm w-full space-y-4',
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="text-orange-500 w-6 h-6" />
                </div>
                <h3 className={cn('text-lg font-bold', darkMode ? 'text-white' : 'text-slate-900')}>Solicitação de controle</h3>
                <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  <strong className={darkMode ? 'text-white' : 'text-slate-900'}>{controlRequestedName}</strong> está solicitando o controle da gestão desta sessão.
                </p>
                <p className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                  Ao aceitar, você perde o controle de pontuação e encerramento.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={rejectControlRequest}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-semibold transition-colors',
                    darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={acceptControlRequest}
                  className="flex-1 py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                >
                  Transferir controle
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showStartSessionConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStartSessionConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'border p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-5 transition-colors duration-300',
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Trophy className="text-orange-500 w-6 h-6" />
                </div>
                <h3 className={cn('text-xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>Iniciar sessão?</h3>
                <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  Deseja iniciar uma sessão de partidas neste local?
                </p>
                <p className={cn('text-sm font-semibold', darkMode ? 'text-orange-300' : 'text-orange-700')}>
                  Modalidade: {venueModalityLabel}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowStartSessionConfirm(false)}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-semibold transition-colors',
                    darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartSessionConfirm(false);
                    openStartMatchPasswordModal();
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                'border p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6 transition-colors duration-300',
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Trophy className="text-orange-500 w-6 h-6" />
                </div>
                <h3 className={cn('text-xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
                  {showPasswordModal.type === 'ADMIN_ACTIVATE'
                    ? 'Modo Administrador'
                    : showPasswordModal.type === 'START_MATCH'
                      ? 'Iniciar Partida'
                      : showPasswordModal.type === 'CLEAR_MOCK'
                        ? 'Limpar dados fictícios'
                        : 'Encerrar Partida'}
                </h3>
                <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {showPasswordModal.type === 'ADMIN_ACTIVATE'
                    ? 'Digite seu PIN para ativar o modo administrador.'
                    : showPasswordModal.type === 'START_MATCH'
                      ? 'Digite seu PIN para iniciar a sessão de partidas.'
                      : showPasswordModal.type === 'CLEAR_MOCK'
                        ? 'Remove fila, ranking e partida. PIN para confirmar.'
                        : 'Digite seu PIN para encerrar a sessão de partidas.'}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && confirmAction()}
                  placeholder="PIN de administrador"
                  className={cn(
                    'w-full border rounded-xl px-4 py-3 focus:outline-none transition-all text-center text-lg tracking-widest',
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900',
                    passwordError ? 'border-red-500 ring-2 ring-red-500/20' : 'focus:ring-2 focus:ring-orange-500/50'
                  )}
                />
                {passwordError && (
                  <p className="text-red-400 text-xs text-center">PIN incorreto. Tente novamente.</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPasswordModal(null)}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-semibold transition-colors',
                    darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAction}
                  className="flex-1 py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Painel de Notificações */}
      <AnimatePresence>
        {showNotificationsPanel && (
          <>
            <motion.div
              key="notif-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowNotificationsPanel(false)}
            />
            <NotificationsPanel
              key="notif-panel"
              notifications={notifications}
              darkMode={darkMode}
              onClose={() => setShowNotificationsPanel(false)}
              onClear={clearNotification}
              onClearAll={clearAll}
              onAction={(id, actionType) => {
                if (actionType === 'leave_guest_mode') {
                  leaveGuestMode();
                  setShowNotificationsPanel(false);
                }
                if (actionType === 'pwa_reload') {
                  void runPwaReload();
                  clearNotification(id);
                  setShowNotificationsPanel(false);
                }
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Toast de notificação (auto-dismiss) */}
      <AnimatePresence>
        {visibleToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-4 left-1/2 z-50 max-w-[90vw] sm:max-w-md"
          >
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl shadow-xl border',
                visibleToast.type === 'error'
                  ? darkMode
                    ? 'bg-red-500/20 border-red-500/30 text-red-200'
                    : 'bg-red-50 border-red-200 text-red-800'
                  : visibleToast.type === 'warning'
                    ? darkMode
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-200'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                    : darkMode
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-200'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
              )}
            >
              {visibleToast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              {visibleToast.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
              {visibleToast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
              <p className="text-sm font-medium flex-1">{visibleToast.message}</p>
              {visibleToast.action?.type === 'pwa_reload' && (
                <button
                  type="button"
                  onClick={() => {
                    void runPwaReload();
                    clearNotification(visibleToast.id);
                    dismissToast();
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {visibleToast.action.label}
                </button>
              )}
              <button
                onClick={dismissToast}
                className="p-1 rounded hover:bg-black/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Modal de estatísticas do jogador - otimizado para touch em mobile */}
      <AnimatePresence>
        {statsModalPlayer && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
            style={{ touchAction: 'manipulation', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'border p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 select-none',
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
              onClick={(e) => e.stopPropagation()}
              style={{ touchAction: 'manipulation' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={cn('text-lg font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
                    {statsModalPlayer.name}
                  </h3>
                  {statsModalPlayer.user_id && userCodes[statsModalPlayer.user_id] && (
                    <span className={cn('text-xs font-mono font-bold', darkMode ? 'text-orange-400' : 'text-orange-600')}>
                      #{userCodes[statsModalPlayer.user_id]}
                    </span>
                  )}
                </div>
                {!registeringStatLabel && (
                  <button
                    type="button"
                    onClick={() => setStatsModalPlayer(null)}
                    className={cn('p-2 -m-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center', darkMode ? 'hover:bg-slate-800 active:bg-slate-700' : 'hover:bg-slate-100 active:bg-slate-200')}
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {registeringStatLabel ? (
                <div className="flex flex-col items-center justify-center py-6 gap-4">
                  <div className="w-9 h-9 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className={cn('text-sm font-semibold', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                    Registrando {registeringStatLabel}...
                  </p>
                </div>
              ) : (
                <>
                  {/* Resumo de desempenho na partida atual */}
                  {(() => {
                    const mStats = matchPlayerStats[statsModalPlayer.id] ?? { points: 0, blocks: 0, steals: 0, assists: 0, rebounds: 0 };
                    const isRegistered = !!statsModalPlayer.user_id;
                    const summaryRows = [
                      { key: 'points' as const, label: 'Pontos', emoji: '🏀', value: mStats.points },
                      ...(isRegistered ? [
                        { key: 'blocks' as const, label: 'Bloqueios', emoji: '🛡️', value: mStats.blocks },
                        { key: 'steals' as const, label: 'Roubos', emoji: '🏃', value: mStats.steals },
                        { key: 'assists' as const, label: 'Assistências', emoji: '🤝', value: mStats.assists },
                        { key: 'rebounds' as const, label: 'Rebotes', emoji: '📏', value: mStats.rebounds },
                      ] : []),
                    ];
                    const decisivosPartida = mStats.clutch_points ?? 0;
                    return (
                      <div className={cn('rounded-xl p-3 space-y-2', darkMode ? 'bg-slate-800/60' : 'bg-slate-50')}>
                        <p className={cn('text-xs font-bold uppercase tracking-wider', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                          Desempenho na partida
                        </p>
                        {summaryRows.map(({ key, label, emoji, value }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className={cn('text-sm flex items-center gap-1.5', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                              <span>{emoji}</span> {label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isAdminMode && (
                                <button
                                  type="button"
                                  onClick={() => adjustStatFromSummary(statsModalPlayer, key, key === 'points' ? -1 : -1)}
                                  disabled={value <= 0}
                                  className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition-all',
                                    value <= 0 ? 'opacity-30 cursor-not-allowed' : '',
                                    darkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100'
                                  )}
                                  style={{ touchAction: 'manipulation' }}
                                >-</button>
                              )}
                              <span className={cn('w-10 text-center text-lg font-black tabular-nums', darkMode ? 'text-white' : 'text-slate-900')}>
                                {value}
                              </span>
                              {isAdminMode && (
                                <button
                                  type="button"
                                  onClick={() => adjustStatFromSummary(statsModalPlayer, key, key === 'points' ? 1 : 1)}
                                  className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition-all',
                                    darkMode ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-green-50 text-green-600 hover:bg-green-100'
                                  )}
                                  style={{ touchAction: 'manipulation' }}
                                >+</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {isRegistered && (
                          <div
                            className={cn(
                              'flex items-center justify-between pt-2 mt-1 border-t',
                              darkMode ? 'border-slate-700' : 'border-slate-200'
                            )}
                          >
                            <span className={cn('text-sm flex items-center gap-1.5', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                              <span>🎯</span> Decisivos <span className={cn('text-[10px] font-normal', darkMode ? 'text-slate-500' : 'text-slate-400')}>(cesta da vitória)</span>
                            </span>
                            <span className={cn('text-lg font-black tabular-nums', darkMode ? 'text-rose-300' : 'text-rose-600')}>
                              {decisivosPartida}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Botões rápidos de pontuação */}
                  <div className="grid grid-cols-3 gap-2">
                    <StatButton
                      onClick={() => addPlayerStat(statsModalPlayer, 'points_1')}
                      disabled={false}
                      className="flex-1 bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30 active:scale-[0.98]"
                    >
                      <Target className="w-5 h-5 mx-auto mb-0.5" />
                      +1 pt
                    </StatButton>
                    <StatButton
                      onClick={() => addPlayerStat(statsModalPlayer, 'points_2')}
                      disabled={false}
                      className="flex-1 bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 active:scale-[0.98]"
                    >
                      <Target className="w-5 h-5 mx-auto mb-0.5" />
                      +2 pts
                    </StatButton>
                    <StatButton
                      onClick={() => addPlayerStat(statsModalPlayer, 'points_3')}
                      disabled={false}
                      className="flex-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 active:scale-[0.98]"
                    >
                      <Target className="w-5 h-5 mx-auto mb-0.5" />
                      +3 pts
                    </StatButton>
                  </div>

                </>
              )}
            </motion.div>

            {/* Suspender jogador — fora do modal, canto superior direito */}
            {!registeringStatLabel && isAdminMode && isMatchStarted && (statsModalPlayer.status === 'team1' || statsModalPlayer.status === 'team2') && (
              <button
                type="button"
                onClick={() => suspendPlayer(statsModalPlayer)}
                className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30 transition-all active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                <UserMinus className="w-4 h-4" />
                Suspender
              </button>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className={cn(
          'border-b backdrop-blur-md sticky top-0 transition-colors duration-300',
          headerMenuOpen ? 'z-[45]' : 'z-10',
          darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white/80 border-slate-200'
        )}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.display_name ?? 'Usuário'}
                className="w-9 h-9 rounded-full object-cover border border-slate-600 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                <Trophy className="text-white w-5 h-5" />
              </div>
            )}
            {isGuest && (
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                )}
              >
                Visitante
              </span>
            )}
            {userProfile?.display_name && (
              <span className={cn('text-xl font-bold truncate max-w-[180px]', darkMode ? 'text-white' : 'text-slate-900')}>
                {userProfile.display_name}
              </span>
            )}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                )}
                title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowNotificationsPanel(true)}
                className={cn(
                  'relative transition-colors p-2 rounded-xl',
                  darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                )}
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold bg-orange-500 text-white">
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                )}
              </button>
              {headerQrUrl && (
                <button
                  onClick={() => setShowHeaderQrModal(true)}
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                  )}
                  title="QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setHeaderMenuOpen((v) => !v)}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                )}
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
            {headerMenuOpen && (
              <div
                className={cn(
                  'absolute right-0 mt-2 w-56 rounded-xl border shadow-xl p-2 z-30',
                  darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                )}
              >
                {!isAdminMode && hasAdminAccess ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { handleAdminActivate(); setHeaderMenuOpen(false); }}
                      className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700')}
                    >
                      Ativar admin
                    </button>
                    {isMatchStarted && hasActiveController && !isSessionController && (
                      <button
                        type="button"
                        onClick={() => { requestSessionControl(); setHeaderMenuOpen(false); }}
                        className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-orange-300' : 'hover:bg-slate-100 text-orange-600')}
                      >
                        Solicitar controle da sessão
                      </button>
                    )}
                  </>
                ) : isAdminMode && hasAdminAccess ? (
                  <>
                    {activeTab === 'lista' && isMatchStarted && isSessionController && (
                      <button
                        type="button"
                        onClick={() => { handleEndMatchAttempt(); setHeaderMenuOpen(false); }}
                        className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-red-300' : 'hover:bg-slate-100 text-red-600')}
                      >
                        Encerrar evento
                      </button>
                    )}
                    {isMatchStarted && hasActiveController && !isSessionController && (
                      <button
                        type="button"
                        onClick={() => { requestSessionControl(); setHeaderMenuOpen(false); }}
                        className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-orange-300' : 'hover:bg-slate-100 text-orange-600')}
                      >
                        Solicitar controle da sessão
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { resetQueue(); setHeaderMenuOpen(false); }}
                      className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700')}
                    >
                      Resetar lista
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdminGestao(true); setHeaderMenuOpen(false); }}
                      className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700')}
                    >
                      Gestão de jogadores
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    window.location.assign('/locais');
                    setHeaderMenuOpen(false);
                  }}
                  className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700')}
                >
                  Ir para nível global
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.assign('/locais?tab=rank');
                    setHeaderMenuOpen(false);
                  }}
                  className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-semibold', darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700')}
                >
                  Ver ranking global
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {headerMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[25] cursor-default"
          aria-label="Fechar menu"
          onClick={() => setHeaderMenuOpen(false)}
        />
      )}

      <AnimatePresence>
        {showHeaderQrModal && headerQrUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4 sm:p-6"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Fechar"
              onClick={() => setShowHeaderQrModal(false)}
            />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={cn(
                'relative z-10 my-auto w-full max-w-sm rounded-2xl p-6 border shadow-2xl flex flex-col items-center',
                darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn('text-lg font-bold mb-4 text-center', darkMode ? 'text-white' : 'text-slate-900')}>QR Code do Local</h3>
              <div className="flex justify-center mb-4 w-full">
                <div className="p-4 bg-white rounded-xl inline-flex">
                  <QRCodeSVG value={headerQrUrl} size={200} level="M" />
                </div>
              </div>
              <p className={cn('text-xs text-center break-all mb-4 w-full', darkMode ? 'text-slate-400' : 'text-slate-600')}>{headerQrUrl}</p>
              <button
                type="button"
                onClick={() => setShowHeaderQrModal(false)}
                className="w-full py-2.5 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-40">
        {!isGuest && !profileComplete && user && activeTab === 'perfil' && (
          <div className="space-y-6">
            <EditarPerfil
              darkMode={darkMode}
              onBack={() => {}}
              mandatory
              hasAdminAccess={hasAdminAccess}
              onSaved={() => {
                fetchUserProfile();
              }}
            />
          </div>
        )}
        {activeTab === 'inicio' && (
          <>
            <AnimatePresence mode="wait">
              {selectedProfileId ? (
                (() => {
                  const stat = stats.find((s) => s.user_id === selectedProfileId || s.id === selectedProfileId);
                  if (!stat) return null;
                  return (
                    <PerfilDetalhe
                      key="perfil-detalhe"
                      data={{
                        id: stat.id,
                        user_id: stat.user_id ?? null,
                        name: stat.name,
                        partidas: stat.partidas ?? 0,
                        wins: stat.wins,
                        points: stat.points,
                        blocks: stat.blocks,
                        steals: stat.steals,
                        clutch_points: stat.clutch_points,
                        assists: stat.assists ?? 0,
                        rebounds: stat.rebounds ?? 0,
                        avatar_url: stat.user_id ? userAvatars[stat.user_id] ?? null : null,
                      }}
                      darkMode={darkMode}
                      onBack={() => setSelectedProfileId(null)}
                    />
                  );
                })()
              ) : (
                <motion.div key="ranking-view" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
                <RankingView
                  stats={stats}
                  darkMode={darkMode}
                  sortKey={sortKey}
                  onSortChange={setSortKey}
                  userAvatars={userAvatars}
                  onProfileClick={(stat) => setSelectedProfileId(stat.user_id ?? stat.id)}
                  userProfile={userProfile}
                  isGuest={isGuest}
                  locationSlug={locationSlug}
                  locationId={locationId}
                />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {activeTab === 'lista' && (
          <div className="relative">
            {!isAdminMode && !hasAdminAccess && locationLoading && (
              <div
                className={cn(
                  'mb-4 p-4 rounded-2xl border flex items-center gap-3',
                  darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                )}
              >
                <RefreshCw className={cn('w-6 h-6 animate-spin shrink-0', darkMode ? 'text-orange-400' : 'text-orange-600')} />
                <div>
                  <p className={cn('font-medium', darkMode ? 'text-slate-200' : 'text-slate-800')}>Verificando sua localização...</p>
                  <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Permita o acesso para entrar na fila.
                  </p>
                </div>
              </div>
            )}
            {!isAdminMode && !hasAdminAccess && !locationLoading && locationError && (
              <div
                className={cn(
                  'mb-4 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3',
                  darkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                )}
              >
                <MapPin className={cn('w-6 h-6 shrink-0', darkMode ? 'text-red-400' : 'text-red-600')} />
                <div className="flex-1">
                  <p className={cn('font-medium', darkMode ? 'text-red-200' : 'text-red-800')}>Fora do local</p>
                  <p className={cn('text-sm', darkMode ? 'text-red-300' : 'text-red-600')}>{locationError}</p>
                </div>
                <button
                  onClick={retryLocation}
                  className={cn(
                    'px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 shrink-0',
                    darkMode ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </button>
              </div>
            )}
            {!canSeeList ? (
              <div className={cn('rounded-2xl border p-6 shadow-xl space-y-4', darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                {/* Partida ainda não iniciada pelo admin */}
                {isWithinRadius !== false && !isMatchStarted && (
                  <div className="flex flex-col items-center text-center gap-3 py-4">
                    <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', darkMode ? 'bg-orange-500/10' : 'bg-orange-100')}>
                      <Timer className={cn('w-7 h-7', darkMode ? 'text-orange-400' : 'text-orange-600')} />
                    </div>
                    <p className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-800')}>
                      Aguardando o administrador
                    </p>
                    <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                      A lista será liberada quando o administrador iniciar a partida.
                    </p>
                  </div>
                )}
                {/* Fora do raio geográfico */}
                {isWithinRadius === false && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <MapPin className={cn('w-8 h-8 shrink-0', darkMode ? 'text-orange-400' : 'text-orange-600')} />
                      <p className={cn('font-medium', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                        Você está fora do local. Aproxime-se da quadra para ver a lista e entrar na fila.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn('p-4 rounded-xl border text-center', darkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-white border-slate-200')}>
                        <p className={cn('text-2xl font-black', darkMode ? 'text-white' : 'text-slate-900')}>{team1.length + team2.length}</p>
                        <p className={cn('text-xs font-medium mt-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>Jogadores em quadra</p>
                      </div>
                      <div className={cn('p-4 rounded-xl border text-center', darkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-white border-slate-200')}>
                        <p className={cn('text-2xl font-black', darkMode ? 'text-white' : 'text-slate-900')}>{waitingList.length}</p>
                        <p className={cn('text-xs font-medium mt-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>Na fila de espera</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
            <div
              className={cn(
                'space-y-6 sm:space-y-8',
                !isMatchStarted && waitingList.length >= 10 && 'pointer-events-none select-none opacity-70'
              )}
            >
            {/* Solicitar controle da sessão (admin sem controle) */}
            {isAdminMode && isMatchStarted && hasActiveController && !isSessionController && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={requestSessionControl}
                  className={cn(
                    'px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 border',
                    darkMode
                      ? 'bg-amber-500/10 border-amber-400/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                  )}
                >
                  Solicitar controle
                </button>
              </div>
            )}

            {/* Iniciar Partida (admin, partida não iniciada, menos de 10 jogadores) */}
            {isAdminMode && !isMatchStarted && waitingList.length < 10 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'border rounded-2xl p-4 sm:p-5 shadow-xl flex items-center justify-between gap-4',
                  darkMode ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'
                )}
              >
                <div>
                  <p className={cn('font-semibold text-sm', darkMode ? 'text-green-300' : 'text-green-800')}>
                    Iniciar a sessão
                  </p>
                  <p className={cn('text-xs mt-0.5', darkMode ? 'text-green-400/70' : 'text-green-600')}>
                    Inicia a sessão mesmo com menos de 10 jogadores na fila.
                  </p>
                </div>
                <button
                  onClick={handleStartMatchAttempt}
                  className="shrink-0 px-4 py-2 rounded-xl font-bold text-sm bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 transition-all active:scale-95"
                >
                  Iniciar
                </button>
              </motion.div>
            )}

            {/* Encerrar sessão (apenas controlador) */}
            {isAdminMode && isMatchStarted && (isSessionController || !hasActiveController) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'border rounded-2xl p-4 sm:p-5 shadow-xl flex items-center justify-between gap-4',
                  darkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                )}
              >
                <div>
                  <p className={cn('font-semibold text-sm', darkMode ? 'text-red-300' : 'text-red-800')}>
                    Encerrar a sessão
                  </p>
                  <p className={cn('text-xs mt-0.5', darkMode ? 'text-red-300/80' : 'text-red-700')}>
                    Finaliza a sessão atual e fecha o evento em andamento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEndMatchAttempt}
                  className="shrink-0 px-4 py-2 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-95"
                >
                  Encerrar
                </button>
              </motion.div>
            )}

            {hasAdminAccess && !isAdminMode && isMatchStarted && hasActiveController && !isSessionController && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={requestSessionControl}
                  className={cn(
                    'px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 border',
                    darkMode
                      ? 'bg-amber-500/10 border-amber-400/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                  )}
                >
                  Solicitar controle
                </button>
              </div>
            )}

            {/* 1. Entrar na Fila - apenas usuários cadastrados */}
            <section
              className={cn(
                'border rounded-2xl p-4 sm:p-6 shadow-xl transition-all duration-300',
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <h2 className={cn('text-sm sm:text-lg font-semibold mb-3 flex items-center gap-2', darkMode ? 'text-white' : 'text-slate-900')}>
                <UserPlus className="w-4 h-4 sm:w-5 h-5 text-orange-500" />
                Entrar na Fila
              </h2>
              {isGuest ? (
                <div className="space-y-2">
                  <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-600')}>
                    Digite seu nome para entrar na fila:
                  </p>
                  <div className={cn('flex gap-2', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                    <input
                      type="text"
                      placeholder="Seu nome ou apelido"
                      value={unregisteredAddName}
                      onChange={(e) => setUnregisteredAddName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addPlayerByNameUnregistered()}
                      disabled={!canUseQueueInput || !canAddToList || (waitingList.length >= 10 && !isMatchStarted)}
                      maxLength={50}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-orange-500/50',
                        darkMode ? 'bg-slate-800 border-slate-600 placeholder:text-slate-500' : 'bg-white border-slate-300 placeholder:text-slate-400'
                      )}
                    />
                    <button
                      type="button"
                      onClick={addPlayerByNameUnregistered}
                      disabled={
                        !canUseQueueInput ||
                        !canAddToList ||
                        !unregisteredAddName.trim() ||
                        (waitingList.length >= 10 && !isMatchStarted)
                      }
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                        canUseQueueInput &&
                        canAddToList &&
                        unregisteredAddName.trim() &&
                        !(waitingList.length >= 10 && !isMatchStarted)
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      )}
                    >
                      Entrar na fila
                    </button>
                  </div>
                </div>
              ) : profileComplete ? (
                <button
                  type="button"
                  onClick={addPlayerAsRegistered}
                  disabled={
                    !canUseQueueInput ||
                    !canAddToList ||
                    (waitingList.length >= 10 && !isMatchStarted) ||
                    players.some(
                      (p) => p.user_id === userProfile?.id || p.name.toLowerCase().trim() === userProfile?.display_name?.toLowerCase().trim()
                    )
                  }
                  className={cn(
                    'w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                    canUseQueueInput &&
                    canAddToList &&
                    !(waitingList.length >= 10 && !isMatchStarted) &&
                    !players.some(
                      (p) => p.user_id === userProfile?.id || p.name.toLowerCase().trim() === userProfile?.display_name?.toLowerCase().trim()
                    )
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <User className="w-4 h-4" />
                  Entrar na fila ({userProfile?.display_name})
                </button>
              ) : (
                <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-600')}>
                  Complete seu perfil (nome e foto) na aba Perfil para entrar na fila.
                </p>
              )}
              {isAdminMode && canManageSessionPlayers && (
                <>
                <div className={cn('flex gap-2 mt-3', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                  <div ref={adminSuggestionsRef} className="relative flex-1">
                    <div
                      className={cn(
                        'flex items-center flex-wrap gap-1 min-h-[38px] px-2 py-1 rounded-lg text-sm border outline-none transition-all',
                        darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300',
                        'focus-within:ring-2 focus-within:ring-orange-500/50'
                      )}
                    >
                      {selectedAdminUsers.map((u, idx) => (
                        <span
                          key={u.id}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
                            darkMode ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                          )}
                        >
                          {getRegisteredUserLabel(u)}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAdminUsers((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className={cn('hover:opacity-70 transition-opacity', darkMode ? 'text-orange-400' : 'text-orange-600')}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder={selectedAdminUsers.length > 0 ? 'Buscar mais...' : 'Nome ou código do jogador'}
                        value={adminAddName}
                        onChange={(e) => {
                          setAdminAddName(e.target.value);
                        }}
                        onFocus={() => {
                          const term = adminAddName.trim();
                          if (term.length >= 4 || /^\d{4}$/.test(term)) {
                            setShowAdminSuggestions(true);
                          }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && addPlayerByNameForAdmin()}
                        disabled={!canAddToList || (waitingList.length >= 10 && !isMatchStarted)}
                        maxLength={50}
                        className={cn(
                          'flex-1 min-w-[80px] bg-transparent outline-none text-sm',
                          darkMode ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400'
                        )}
                      />
                    </div>
                    {showAdminSuggestions && (adminAddName.trim().length >= 4 || /^\d{4}$/.test(adminAddName.trim())) && (
                      <div
                        className={cn(
                          'absolute left-0 right-0 top-full mt-2 z-[999] rounded-xl border shadow-2xl overflow-hidden',
                          darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                        )}
                      >
                        {isSearchingAdminUsers ? (
                          <div className={cn('px-3 py-3 text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                            Buscando jogadores cadastrados...
                          </div>
                        ) : adminUserSuggestions.length > 0 ? (
                          <div className="max-h-72 overflow-y-auto">
                            {adminUserSuggestions.map((candidate) => {
                              const candidateLabel = getRegisteredUserLabel(candidate);
                              const alreadyInQueue = players.some(
                                (player) => player.user_id === candidate.id
                                  || player.name.toLowerCase().trim() === candidateLabel.toLowerCase().trim()
                              );
                              const alreadySelected = selectedAdminUsers.some((u) => u.id === candidate.id);
                              const disabled = alreadyInQueue || alreadySelected;

                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => {
                                    if (disabled) return;
                                    setSelectedAdminUsers((prev) => [...prev, candidate]);
                                    setAdminAddName('');
                                    setShowAdminSuggestions(false);
                                  }}
                                  className={cn(
                                    'w-full px-3 py-3 text-left border-b last:border-b-0 transition-colors',
                                    disabled && 'opacity-50 cursor-not-allowed',
                                    darkMode
                                      ? 'border-slate-800 hover:bg-slate-800'
                                      : 'border-slate-100 hover:bg-slate-50'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className={cn('text-sm font-medium truncate', darkMode ? 'text-slate-100' : 'text-slate-900')}>
                                        {candidateLabel}
                                      </p>
                                      <p className={cn('text-xs truncate', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                                        {candidate.player_code ? `#${candidate.player_code} · ` : ''}{candidate.email}
                                      </p>
                                    </div>
                                    {(alreadyInQueue || alreadySelected) && (
                                      <span
                                        className={cn(
                                          'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                                          alreadyInQueue
                                            ? (darkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')
                                            : (darkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700')
                                        )}
                                      >
                                        {alreadyInQueue ? 'Na fila' : 'Selecionado'}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={cn('px-3 py-3 text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                            Nenhum jogador cadastrado encontrado.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addPlayerByNameForAdmin}
                    disabled={
                      !canAddToList ||
                      (selectedAdminUsers.length === 0 && !adminAddName.trim()) ||
                      (waitingList.length >= 10 && !isMatchStarted)
                    }
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                      canAddToList &&
                      (selectedAdminUsers.length > 0 || adminAddName.trim()) &&
                      !(waitingList.length >= 10 && !isMatchStarted)
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    )}
                  >
                    Adicionar{selectedAdminUsers.length > 1 ? ` (${selectedAdminUsers.length})` : ''}
                  </button>
                </div>
                {(selectedAdminUsers.length > 0 || adminAddName.trim()) && (
                  <div className="mt-1 ml-1 flex items-center gap-1 text-xs">
                    {selectedAdminUsers.length > 0 ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                        <span className={darkMode ? 'text-green-400' : 'text-green-600'}>
                          {selectedAdminUsers.length === 1
                            ? 'Jogador cadastrado selecionado — estatísticas serão registradas'
                            : `${selectedAdminUsers.length} jogadores selecionados — estatísticas serão registradas`}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className={darkMode ? 'text-amber-400' : 'text-amber-600'}>
                          Nenhum jogador selecionado na lista — será adicionado como visitante (sem estatísticas)
                        </span>
                      </>
                    )}
                  </div>
                )}
                </>
              )}
            </section>

            {/* 2. Time 1 e Time 2 - exibidos antes da lista de espera */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8">
              <TeamCard
                title="Time 1"
                players={team1}
                color="blue"
                darkMode={darkMode}
                matchPoints={team1MatchPoints}
                onRemovePlayer={handleRemoveAttempt}
                onPlayerClick={canManageSessionPlayers ? setStatsModalPlayer : undefined}
                isAdmin={isAdminMode}
                canManagePlayers={canManageSessionPlayers}
                showWinnerModal={showWinnerModal}
                isLosingTeam={showWinnerModal === 'team2'}
                isWinningTeam={showWinnerModal === 'team1'}
                onStartNext={isAdminMode ? startNextMatch : undefined}
                isStartingNext={isStartingNextMatch}
                userAvatars={userAvatars}
                matchPlayerStats={matchPlayerStats}
              />

              <TeamCard
                title="Time 2"
                players={team2}
                color="red"
                darkMode={darkMode}
                matchPoints={team2MatchPoints}
                onRemovePlayer={handleRemoveAttempt}
                onPlayerClick={canManageSessionPlayers ? setStatsModalPlayer : undefined}
                isAdmin={isAdminMode}
                canManagePlayers={canManageSessionPlayers}
                showWinnerModal={showWinnerModal}
                isLosingTeam={showWinnerModal === 'team1'}
                isWinningTeam={showWinnerModal === 'team2'}
                onStartNext={isAdminMode ? startNextMatch : undefined}
                isStartingNext={isStartingNextMatch}
                userAvatars={userAvatars}
                matchPlayerStats={matchPlayerStats}
              />
            </div>

            {/* 3. Lista de Espera - após os times */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={cn('text-sm sm:text-lg font-semibold flex items-center gap-2', darkMode ? 'text-slate-400' : 'text-slate-600')}>
                  <Users className="w-4 h-4 sm:w-5 h-5" />
                  Lista de Espera ({waitingList.length})
                </h2>
              </div>

              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={waitingList.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 sm:gap-3">
                    {waitingList.map((player, index) => (
                      <SortableWaitingCard
                        key={player.id}
                        player={player}
                        index={index}
                        darkMode={darkMode}
                        isAdminMode={isAdminMode}
                        canManagePlayers={canManageSessionPlayers}
                        userAvatars={userAvatars}
                        userCodes={userCodes}
                        matchPlayerStats={matchPlayerStats}
                        onPlayerClick={canManageSessionPlayers ? setStatsModalPlayer : undefined}
                        onRemove={handleRemoveAttempt}
                      />
                    ))}
                    {waitingList.length === 0 && suspendedList.length === 0 && (
                      <div
                        className={cn(
                          'w-full py-8 text-center text-xs sm:text-sm border-2 border-dashed rounded-2xl transition-colors duration-300',
                          darkMode ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-200'
                        )}
                      >
                        Ninguém na fila. Cadastre-se e entre na fila com seu perfil!
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Jogadores suspensos */}
              {suspendedList.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className={cn('text-xs font-bold uppercase tracking-wider flex items-center gap-1.5', darkMode ? 'text-amber-400/70' : 'text-amber-600')}>
                    <UserMinus className="w-3.5 h-3.5" /> Suspensos ({suspendedList.length})
                  </p>
                  {suspendedList.map((player) => {
                    const info = suspendedPlayers[player.id];
                    return (
                      <div
                        key={player.id}
                        className={cn(
                          'border p-2 sm:p-3 rounded-xl flex items-center justify-between transition-colors duration-300',
                          darkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <UserMinus className={cn('w-4 h-4 shrink-0', darkMode ? 'text-amber-400' : 'text-amber-600')} />
                          <span className={cn('font-medium text-xs sm:text-sm truncate', darkMode ? 'text-amber-200' : 'text-amber-800')}>
                            {player.name}
                          </span>
                          {info && (
                            <span className={cn('text-[10px] shrink-0', darkMode ? 'text-amber-400/50' : 'text-amber-500')}>
                              {info.originalTeam === 'team1' ? 'Time 1' : 'Time 2'}
                            </span>
                          )}
                        </div>
                        {isAdminMode && (
                          <button
                            onClick={() => reinsertPlayer(player)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ml-2',
                              darkMode
                                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            )}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reinserir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            </div>
            )}
          </div>
        )}

        {activeTab === 'eventos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shadow-lg', darkMode ? 'bg-orange-500 shadow-orange-500/20' : 'bg-orange-500 shadow-orange-500/20')}>
                  <Calendar className="text-white w-5 h-5" />
                </div>
                <h2 className={cn('text-xl sm:text-2xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>Eventos</h2>
              </div>
              {isAdminMode && (
                <button
                  onClick={() => setShowEventoForm((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all',
                    showEventoForm
                      ? (darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600')
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                  )}
                >
                  {showEventoForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showEventoForm ? 'Cancelar' : 'Novo evento'}
                </button>
              )}
            </div>

            {/* Formulário de criação */}
            <AnimatePresence>
              {showEventoForm && isAdminMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={cn('p-5 rounded-2xl border space-y-4', darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
                    <input
                      type="text"
                      placeholder="Título do evento"
                      value={eventoForm.title}
                      onChange={(e) => setEventoForm((f) => ({ ...f, title: e.target.value }))}
                      className={cn('w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50', darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200')}
                    />
                    <textarea
                      placeholder="Descrição (opcional)"
                      value={eventoForm.description}
                      onChange={(e) => setEventoForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className={cn('w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50 resize-none', darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={cn('text-xs font-medium mb-1 block', darkMode ? 'text-slate-400' : 'text-slate-500')}>Data</label>
                        <input
                          type="date"
                          value={eventoForm.event_date}
                          onChange={(e) => setEventoForm((f) => ({ ...f, event_date: e.target.value }))}
                          className={cn('w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50', darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                        />
                      </div>
                      <div>
                        <label className={cn('text-xs font-medium mb-1 block', darkMode ? 'text-slate-400' : 'text-slate-500')}>Horário</label>
                        <input
                          type="time"
                          value={eventoForm.event_time}
                          onChange={(e) => setEventoForm((f) => ({ ...f, event_time: e.target.value }))}
                          className={cn('w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50', darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={cn('text-xs font-medium mb-1 block', darkMode ? 'text-slate-400' : 'text-slate-500')}>Tipo</label>
                        <select
                          value={eventoForm.type}
                          onChange={(e) => setEventoForm((f) => ({ ...f, type: e.target.value as Evento['type'] }))}
                          className={cn('w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50', darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                        >
                          <option value="torneio">Torneio</option>
                          <option value="campeonato">Campeonato</option>
                          <option value="festival">Festival</option>
                        </select>
                      </div>
                      <div>
                        <label className={cn('text-xs font-medium mb-1 block', darkMode ? 'text-slate-400' : 'text-slate-500')}>Modalidade</label>
                        <select
                          value={eventoForm.modality}
                          onChange={(e) => setEventoForm((f) => ({ ...f, modality: e.target.value as Evento['modality'] }))}
                          className={cn('w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50', darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                        >
                          <option value="5x5">5x5</option>
                          <option value="3x3">3x3</option>
                          <option value="1x1">1x1</option>
                        </select>
                      </div>
                      <div>
                        <label className={cn('text-xs font-medium mb-1 block', darkMode ? 'text-slate-400' : 'text-slate-500')}>Máx. jogadores</label>
                        <input
                          type="number"
                          placeholder="Sem limite"
                          value={eventoForm.max_participants}
                          onChange={(e) => setEventoForm((f) => ({ ...f, max_participants: e.target.value }))}
                          className={cn('w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-orange-500/50', darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200')}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCreateEvento}
                      className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-lg shadow-orange-500/20"
                    >
                      Criar evento
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lista de eventos */}
            {eventos.length === 0 ? (
              <div className={cn('text-center py-16 rounded-2xl border', darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                <Calendar className={cn('w-10 h-10 mx-auto mb-3', darkMode ? 'text-slate-700' : 'text-slate-300')} />
                <p className={cn('font-semibold', darkMode ? 'text-slate-400' : 'text-slate-500')}>Nenhum evento agendado</p>
                {isAdminMode && (
                  <p className={cn('text-sm mt-1', darkMode ? 'text-slate-500' : 'text-slate-400')}>Crie um torneio, campeonato ou festival.</p>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {eventos.map((evento, i) => {
                  const dateObj = new Date(evento.event_date + 'T12:00:00');
                  const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                  const statusColors: Record<string, string> = {
                    open: darkMode ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200',
                    draft: darkMode ? 'bg-slate-500/15 text-slate-400 border-slate-500/20' : 'bg-slate-100 text-slate-600 border-slate-200',
                    in_progress: darkMode ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200',
                    finished: darkMode ? 'bg-slate-500/15 text-slate-500 border-slate-500/20' : 'bg-slate-100 text-slate-500 border-slate-200',
                  };
                  return (
                    <motion.div
                      key={evento.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        'p-5 rounded-2xl border transition-all',
                        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
                            {EVENT_TYPE_LABELS[evento.type]} · {evento.modality}
                          </span>
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', statusColors[evento.status] ?? '')}>
                            {EVENT_STATUS_LABELS[evento.status]}
                          </span>
                        </div>
                        {isAdminMode && (
                          <button onClick={() => handleDeleteEvento(evento.id)} className={cn('p-1.5 rounded-lg transition-colors', darkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <h3 className={cn('font-bold text-lg mb-1', darkMode ? 'text-white' : 'text-slate-900')}>{evento.title}</h3>
                      {evento.description && (
                        <p className={cn('text-sm mb-2', darkMode ? 'text-slate-400' : 'text-slate-500')}>{evento.description}</p>
                      )}
                      <div className={cn('flex items-center gap-4 text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {dateStr}
                        </span>
                        {evento.event_time && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-3.5 h-3.5" /> {evento.event_time.slice(0, 5)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {evento._inscricoes_count ?? 0}{evento.max_participants ? `/${evento.max_participants}` : ''}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="space-y-8">
            {editingProfile && !isGuest ? (
              <EditarPerfil
                darkMode={darkMode}
                onBack={() => setEditingProfile(false)}
                hasAdminAccess={hasAdminAccess}
                onSaved={() => {
                  setEditingProfile(false);
                  fetchUserProfile();
                }}
              />
            ) : isGuest ? (
              <>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-8 text-center',
                    darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
                  )}
                >
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className={cn('w-10 h-10', darkMode ? 'text-slate-500' : 'text-slate-400')} />
                  </div>
                  <h2 className={cn('text-xl font-bold mb-2', darkMode ? 'text-white' : 'text-slate-900')}>
                    Você está como visitante
                  </h2>
                  <p className={cn('text-sm mb-6 max-w-sm mx-auto', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Entre ou cadastre-se para participar do ranking, ter seu perfil personalizado e acompanhar suas estatísticas.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={leaveGuestMode}
                      className={cn(
                        'flex-1 max-w-[160px] px-5 py-3 rounded-xl font-bold border transition-all flex items-center justify-center gap-2',
                        darkMode
                          ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-white'
                          : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                      )}
                    >
                      <User className="w-4 h-4" />
                      Entrar
                    </button>
                    <button
                      onClick={leaveGuestMode}
                      className="flex-1 max-w-[160px] px-5 py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Cadastrar
                    </button>
                  </div>
                </div>
                <div className="mt-6">
                  <InstallPWA darkMode={darkMode} />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-tr from-orange-500 to-yellow-400 rounded-full p-1 shadow-xl overflow-hidden">
                      <div className={cn('w-full h-full rounded-full flex items-center justify-center overflow-hidden', darkMode ? 'bg-slate-900' : 'bg-white')}>
                        {userProfile?.avatar_url ? (
                          <img src={userProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className={cn('w-12 h-12', darkMode ? 'text-slate-700' : 'text-slate-200')} />
                        )}
                      </div>
                    </div>
                    <button className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full shadow-lg hover:bg-orange-600 transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h2 className={cn('text-2xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
                      {userProfile?.display_name || 'Seu Perfil'}
                    </h2>
                    <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>{user?.email ?? ''}</p>
                    {userProfile?.player_code && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
                        <span className={cn('text-[10px] font-bold uppercase tracking-widest', darkMode ? 'text-orange-400' : 'text-orange-600')}>Código</span>
                        <span className={cn('text-lg font-black tracking-widest', darkMode ? 'text-orange-300' : 'text-orange-700')}>{userProfile.player_code}</span>
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const userStat = stats.find((s) => s.user_id === userProfile?.id);
                  const sortedByWins = [...stats].sort((a, b) => b.wins - a.wins);
                  const rankPos = userProfile?.id ? sortedByWins.findIndex((s) => s.user_id === userProfile.id) + 1 : 0;
                  const pj = userStat?.partidas ?? 0;
                  const winRateStr = pj > 0 ? `${Math.round(((userStat?.wins ?? 0) / pj) * 100)}%` : '—';
                  const avgPtsStr = pj > 0 ? ((userStat?.points ?? 0) / pj).toFixed(1) : '—';
                  const profileStats = [
                    { label: 'Partidas', value: String(userStat?.partidas ?? 0), icon: <Trophy className="w-4 h-4" /> },
                    { label: 'Vitórias', value: String(userStat?.wins ?? 0), icon: <Trophy className="w-4 h-4 text-yellow-500" /> },
                    { label: 'Win rate', value: winRateStr, icon: <Percent className="w-4 h-4 text-emerald-500" /> },
                    { label: 'Pts / jogo', value: avgPtsStr, icon: <Target className="w-4 h-4 text-orange-500" /> },
                    { label: 'Pontos', value: String(userStat?.points ?? 0), icon: <Plus className="w-4 h-4 text-blue-500" /> },
                    { label: 'Assistências', value: String(userStat?.assists ?? 0), icon: <Target className="w-4 h-4 text-cyan-500" /> },
                    { label: 'Tocos', value: String(userStat?.blocks ?? 0), icon: <Shield className="w-4 h-4 text-amber-500" /> },
                    { label: 'Roubos', value: String(userStat?.steals ?? 0), icon: <Target className="w-4 h-4 text-purple-500" /> },
                    { label: 'Decisivos', value: String(userStat?.clutch_points ?? 0), icon: <Trophy className="w-4 h-4 text-red-500" /> },
                    { label: 'Ranking', value: rankPos > 0 ? `#${rankPos}` : '--', icon: <Trophy className="w-4 h-4 text-orange-500" /> },
                  ];
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {profileStats.map((stat, i) => (
                        <div
                          key={i}
                          className={cn('p-4 rounded-2xl border flex flex-col items-center gap-1', darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {stat.icon}
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider', darkMode ? 'text-slate-500' : 'text-slate-400')}>{stat.label}</span>
                          </div>
                          <span className={cn('text-2xl font-black', darkMode ? 'text-white' : 'text-slate-900')}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <h3 className={cn('font-bold px-1', darkMode ? 'text-slate-400' : 'text-slate-600')}>Aplicativo</h3>
                  <InstallPWA darkMode={darkMode} />
                  <h3 className={cn('font-bold px-1 pt-2', darkMode ? 'text-slate-400' : 'text-slate-600')}>Configurações</h3>
                  <div
                    className={cn(
                      'border rounded-2xl divide-y overflow-hidden',
                      darkMode ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100 shadow-sm'
                    )}
                  >
                    <button
                      onClick={() => setEditingProfile(true)}
                      className={cn('w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-500/5 transition-colors', darkMode ? 'text-white' : 'text-slate-900')}
                    >
                      <span>Editar Perfil</span>
                      <ArrowRight className="w-4 h-4 opacity-30" />
                    </button>
                    <button className={cn('w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-500/5 transition-colors', darkMode ? 'text-white' : 'text-slate-900')}>
                      <span>Notificações</span>
                      <ArrowRight className="w-4 h-4 opacity-30" />
                    </button>
                    <button
                      onClick={handleSignOutAndGoExplore}
                      className={cn('w-full px-5 py-4 text-left flex items-center justify-between hover:bg-red-500/5 transition-colors text-red-500')}
                    >
                      <span>Sair da Conta</span>
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 border-t backdrop-blur-lg z-50 transition-colors duration-300',
          darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-end justify-around">
          <NavButton active={false} onClick={handleGoGlobal} icon={<Globe className="w-5 h-5" />} label="Global" darkMode={darkMode} />
          <NavButton active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} icon={<Home className="w-5 h-5" />} label="Início" darkMode={darkMode} />
          <NavButton
            active={activeTab === 'lista'}
            onClick={() => setActiveTab('lista')}
            icon={<BasketballTabIcon className="w-12 h-12" />}
            label="Lista"
            darkMode={darkMode}
            featured
          />
          <NavButton active={activeTab === 'eventos'} onClick={() => setActiveTab('eventos')} icon={<Calendar className="w-5 h-5" />} label="Eventos" darkMode={darkMode} />
          <NavButton active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} icon={<User className="w-5 h-5" />} label="Perfil" darkMode={darkMode} />
        </div>
      </nav>

      <footer className={cn('max-w-5xl mx-auto px-4 py-12 text-center text-sm transition-colors duration-300', darkMode ? 'text-slate-600' : 'text-slate-400')}>
        <p>Braska &bull; Sistema de Fila em Tempo Real</p>
      </footer>

      {/* Gestão Admin - tela full-screen sobreposta */}
      <AnimatePresence>
        {showAdminGestao && (
          <GestaoAdmin
            stats={stats as Parameters<typeof GestaoAdmin>[0]['stats']}
            userAvatars={userAvatars}
            darkMode={darkMode}
            onClose={() => setShowAdminGestao(false)}
            onStatsUpdated={fetchStats}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableWaitingCard({ player, index, darkMode, isAdminMode, canManagePlayers, userAvatars, userCodes, matchPlayerStats, onPlayerClick, onRemove }: {
  player: Player;
  index: number;
  darkMode: boolean;
  isAdminMode: boolean;
  canManagePlayers: boolean;
  userAvatars: Record<string, string>;
  userCodes: Record<string, string>;
  matchPlayerStats: Record<string, { points: number }>;
  onPlayerClick?: (player: Player) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, disabled: !canManagePlayers });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const fireStatus = getPlayerFireStatus(matchPlayerStats[player.id]?.points ?? 0);
  const avatarContent = player.user_id && userAvatars[player.user_id] ? (
    <img src={userAvatars[player.user_id]} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className={cn('w-full h-full flex items-center justify-center', darkMode ? 'bg-slate-700' : 'bg-slate-300')}>
      <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-full border p-2 sm:p-4 rounded-xl flex items-center justify-between group transition-colors duration-300',
        darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
        isDragging && 'shadow-xl ring-2 ring-orange-500/40 scale-[1.03]'
      )}
    >
      {canManagePlayers && (
        <div
          className={cn('touch-none shrink-0 p-1 -ml-1 mr-1 cursor-grab active:cursor-grabbing', darkMode ? 'text-slate-600' : 'text-slate-300')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-2 overflow-hidden flex-1 min-w-0 min-h-[44px] py-2 -my-2 pr-2',
          onPlayerClick && 'cursor-pointer active:opacity-80'
        )}
        onClick={() => onPlayerClick?.(player)}
        style={onPlayerClick ? { touchAction: 'manipulation' } : undefined}
      >
        <span className={cn('text-[10px] sm:text-xs font-mono w-4 shrink-0', darkMode ? 'text-slate-500' : 'text-slate-400')}>
          #{index + 1}
        </span>
        {fireStatus ? (
          <FireRing variant={fireStatus}>
            {avatarContent}
          </FireRing>
        ) : (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden shrink-0">
            {avatarContent}
          </div>
        )}
        <span className={cn('font-medium text-xs sm:text-base truncate', darkMode ? 'text-slate-200' : 'text-slate-800')}>
          {player.name}
        </span>
        {isAdminMode && player.user_id && userCodes[player.user_id] && (
          <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0', darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600')}>
            {userCodes[player.user_id]}
          </span>
        )}
      </div>
      {canManagePlayers && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(player.id); }}
          className={cn(
            'sm:opacity-0 group-hover:opacity-100 transition-all p-1 shrink-0',
            darkMode ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'
          )}
        >
          <Trash2 className="w-3 h-3 sm:w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface TeamCardProps {
  title: string;
  players: Player[];
  color: 'blue' | 'red';
  darkMode: boolean;
  matchPoints: number;
  onRemovePlayer: (id: string) => void;
  onPlayerClick?: (player: Player) => void;
  isAdmin: boolean;
  canManagePlayers: boolean;
  showWinnerModal: 'team1' | 'team2' | null;
  isLosingTeam: boolean;
  isWinningTeam: boolean;
  onStartNext?: () => void;
  isStartingNext?: boolean;
  userAvatars: Record<string, string>;
  matchPlayerStats: Record<string, { points: number }>;
}

function FireRing({ variant, children }: { variant: 'onfire' | 'jordan'; children: React.ReactNode }) {
  const gradient = variant === 'jordan'
    ? 'conic-gradient(from 0deg, #1e40af, #3b82f6, #60a5fa, #93c5fd, #60a5fa, #3b82f6, #1e40af)'
    : 'conic-gradient(from 0deg, #b91c1c, #f97316, #facc15, #f97316, #ef4444, #f97316, #b91c1c)';
  return (
    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full relative overflow-hidden shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: gradient, animation: 'fire-ring-spin 1.2s linear infinite' }}
      />
      <div className="absolute inset-[2px] rounded-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function getPlayerFireStatus(points: number): 'jordan' | 'onfire' | null {
  if (points >= 9) return 'jordan';
  if (points >= 6) return 'onfire';
  return null;
}

const HOT_STREAK_DAYS = 7;

function isHotStreakActive(hotStreakSince: string | null | undefined): boolean {
  if (!hotStreakSince) return false;
  const diff = Date.now() - new Date(hotStreakSince).getTime();
  return diff <= HOT_STREAK_DAYS * 24 * 60 * 60 * 1000;
}

function HotStreakBadge({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: size, height: size, animation: 'hot-streak-pulse 1.4s ease-in-out infinite' }}
      title="Hot Streak"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M12 2C10.5 6 6 8 6 13a6 6 0 0 0 12 0c0-5-4.5-7-6-11Z"
          fill="url(#hotGrad)"
          stroke="url(#hotGrad)"
          strokeWidth="0.5"
        />
        <path
          d="M12 10c-1 2.5-3 3.5-3 6a3 3 0 0 0 6 0c0-2.5-2-3.5-3-6Z"
          fill="#facc15"
        />
        <defs>
          <linearGradient id="hotGrad" x1="12" y1="2" x2="12" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

const slideOut = { x: -200, opacity: 0 };
const slideIn = { x: 0, opacity: 1 };
const slideFromRight = { x: 200, opacity: 0 };

function TeamCard({ title, players, color, darkMode, matchPoints, onRemovePlayer, onPlayerClick, isAdmin, canManagePlayers, showWinnerModal, isLosingTeam, isWinningTeam, onStartNext, isStartingNext, userAvatars, matchPlayerStats }: TeamCardProps) {
  const bgColor = color === 'blue' ? (darkMode ? 'bg-blue-500/10' : 'bg-blue-50') : (darkMode ? 'bg-red-500/10' : 'bg-red-50');
  const borderColor = color === 'blue' ? (darkMode ? 'border-blue-500/20' : 'border-blue-100') : (darkMode ? 'border-red-500/20' : 'border-red-100');
  const textColor = color === 'blue' ? 'text-blue-500' : 'text-red-500';
  const accentColor = color === 'blue' ? 'bg-blue-500' : 'bg-red-500';

  const showAguarde = !isAdmin && showWinnerModal && isLosingTeam;

  return (
    <motion.div
      animate={isWinningTeam ? { scale: [1, 1.03, 1.02] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'relative border rounded-xl sm:rounded-2xl overflow-hidden shadow-xl transition-all duration-500',
        bgColor, borderColor,
        isWinningTeam && 'ring-4 ring-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.35)] z-10',
        isLosingTeam && 'opacity-60 scale-[0.98]'
      )}
    >
      <div className={cn('px-3 py-2 sm:px-6 sm:py-4 border-b flex items-center justify-between', borderColor)}>
        <h3 className={cn('font-bold text-sm sm:text-lg', textColor)}>{title}</h3>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg sm:text-xl font-black', textColor)}>{matchPoints}</span>
          <span className={cn('text-[10px] sm:text-xs font-mono', darkMode ? 'opacity-60' : 'text-slate-500')}>
            pts • {showAguarde ? '0' : players.length}/5
          </span>
        </div>
      </div>

      <div className="p-2 sm:p-4 space-y-1 sm:space-y-2 min-h-[160px] sm:min-h-[240px]">
        <AnimatePresence mode="wait">
          {showAguarde ? (
            <motion.div
              key="aguarde"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'flex flex-col items-center justify-center h-[140px] sm:h-[200px] text-center px-4 rounded-xl border-2 border-dashed',
                darkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
              )}
            >
              <RefreshCw className={cn('w-8 h-8 mb-2 animate-pulse', darkMode ? 'text-slate-500' : 'text-slate-400')} />
              <p className="text-sm font-medium">Aguarde...</p>
              <p className="text-xs mt-0.5">Próximo time está entrando em quadra.</p>
            </motion.div>
          ) : (
            <>
              {players.map((p, index) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={slideFromRight}
                  animate={slideIn}
                  exit={slideOut}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 28,
                    delay: index * 0.1,
                  }}
                  className={cn(
                    'p-1.5 sm:p-3 rounded-lg flex items-center justify-between border overflow-hidden group',
                    darkMode ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-100 shadow-sm'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0 min-h-[44px] py-2 -my-2 px-2 -mx-2',
                      onPlayerClick && 'cursor-pointer active:opacity-80'
                    )}
                    onClick={() => onPlayerClick?.(p)}
                    style={onPlayerClick ? { touchAction: 'manipulation' } : undefined}
                  >
                    {(() => {
                      const fireStatus = getPlayerFireStatus(matchPlayerStats[p.id]?.points ?? 0);
                      const avatarContent = p.user_id && userAvatars[p.user_id] ? (
                        <img src={userAvatars[p.user_id]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={cn('w-full h-full flex items-center justify-center', accentColor)}>
                          <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        </div>
                      );
                      return fireStatus ? (
                        <FireRing variant={fireStatus}>
                          {avatarContent}
                        </FireRing>
                      ) : (
                        <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full overflow-hidden shrink-0">
                          {avatarContent}
                        </div>
                      );
                    })()}
                    <span className={cn('font-medium text-xs sm:text-base truncate', darkMode ? 'text-slate-100' : 'text-slate-800')}>{p.name}</span>
                    {getPlayerFireStatus(matchPlayerStats[p.id]?.points ?? 0) && (
                      <span className={cn(
                        'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider',
                        getPlayerFireStatus(matchPlayerStats[p.id]?.points ?? 0) === 'jordan'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-orange-500/20 text-orange-400'
                      )}>
                        {getPlayerFireStatus(matchPlayerStats[p.id]?.points ?? 0) === 'jordan' ? 'Jordan State' : 'On Fire'}
                      </span>
                    )}
                  </div>
                  {canManagePlayers && (
                    <button
                      onClick={() => onRemovePlayer(p.id)}
                      className={cn(
                        'sm:opacity-0 group-hover:opacity-100 transition-all p-1 shrink-0',
                        darkMode ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'
                      )}
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
              {Array.from({ length: 5 - players.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className={cn(
                    'border border-dashed p-1.5 sm:p-3 rounded-lg text-[10px] sm:text-sm italic truncate',
                    darkMode ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-400'
                  )}
                >
                  Vazio...
                </div>
              ))}
            </>
          )}
        </AnimatePresence>
      </div>
      {isWinningTeam && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
          className={cn(
            'absolute bottom-0 left-0 right-0 py-3 flex flex-col items-center justify-center gap-1.5 rounded-b-xl font-bold text-sm uppercase tracking-wider',
            'bg-gradient-to-t from-yellow-500/60 via-yellow-400/40 to-yellow-300/20 border-t border-yellow-400/50',
            darkMode ? 'text-yellow-300' : 'text-yellow-700'
          )}
          style={{ boxShadow: '0 -4px 20px rgba(234,179,8,0.3)' }}
        >
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            className="flex items-center gap-2 text-base"
          >
            <Trophy className="w-5 h-5" />
            Vencedor! 🏆
          </motion.span>
          {isAdmin && onStartNext && (
            <button
              onClick={onStartNext}
              disabled={isStartingNext}
              className={cn(
                'text-[10px] font-semibold normal-case px-3 py-1 rounded-lg transition-colors border',
                isStartingNext
                  ? 'opacity-60 cursor-wait border-yellow-400/30'
                  : darkMode
                    ? 'hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/40'
                    : 'hover:bg-yellow-500/20 text-yellow-700 border-yellow-500/40'
              )}
            >
              {isStartingNext ? 'Iniciando...' : 'Iniciar agora'}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

interface StatButtonProps {
  onClick: () => void;
  disabled: boolean;
  className: string;
  children: React.ReactNode;
}

function StatButton({ onClick, disabled, className, children }: StatButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-[52px] py-4 px-4 rounded-xl font-bold transition-all flex flex-col items-center justify-center',
        disabled && 'text-slate-500 dark:text-slate-500 cursor-not-allowed',
        className
      )}
      style={{ touchAction: 'manipulation' as const }}
    >
      {children}
    </button>
  );
}

function BasketballTabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path
        fill="#000000"
        d="M248.37 41.094c-49.643 1.754-98.788 20.64-137.89 56.656L210.53 197.8c31.283-35.635 45.59-88.686 37.84-156.706zm18.126.107c7.646 71.205-7.793 129.56-43.223 169.345L256 243.27 401.52 97.75c-38.35-35.324-86.358-54.18-135.024-56.55zM97.75 110.48c-36.017 39.102-54.902 88.247-56.656 137.89 68.02 7.75 121.07-6.557 156.707-37.84L97.75 110.48zm316.5 0L268.73 256l32.71 32.71c33.815-30.112 81.05-45.78 138.183-45.11 10.088.118 20.49.753 31.176 1.9-2.37-48.665-21.227-96.672-56.55-135.02zM210.545 223.272c-39.785 35.43-98.14 50.87-169.344 43.223 2.37 48.666 21.226 96.675 56.55 135.025L243.27 256l-32.725-32.727zm225.002 38.27c-51.25.042-92.143 14.29-121.348 39.928l100.05 100.05c36.017-39.102 54.902-88.247 56.656-137.89-12.275-1.4-24.074-2.096-35.36-2.087zM256 268.73L110.48 414.25c38.35 35.324 86.358 54.18 135.024 56.55-7.646-71.205 7.793-129.56 43.223-169.345L256 268.73zm45.47 45.47c-31.283 35.635-45.59 88.686-37.84 156.706 49.643-1.754 98.788-20.64 137.89-56.656L301.47 314.2z"
      />
    </svg>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  darkMode: boolean;
  featured?: boolean;
}

function NavButton({ active, onClick, icon, label, darkMode, featured = false }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all',
        featured && 'relative -mt-7',
        featured && (darkMode ? 'text-slate-300' : 'text-slate-700'),
        !featured &&
          (active ? 'text-orange-500' : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
      )}
    >
      <div
        className={cn(
          'transition-transform',
          active && 'scale-110',
          featured &&
            'w-14 h-14 rounded-full flex items-center justify-center shadow-xl border-4 text-slate-950',
          featured && (darkMode ? 'border-slate-900/95' : 'border-white/95'),
          featured &&
            'bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/45'
        )}
      >
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
      {active && !featured && <motion.div layoutId="nav-indicator" className="w-1 h-1 rounded-full bg-orange-500" />}
    </button>
  );
}

function getWeekRangeLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}`;
  return `${fmt(monday)} - ${fmt(sunday)} ${sunday.getFullYear()}`;
}

function calculateHighlightScore(p: PlayerStats): number {
  return (
    (p.points ?? 0) * 1.0 +
    (p.assists ?? 0) * 1.5 +
    (p.rebounds ?? 0) * 1.2 +
    (p.blocks ?? 0) * 1.5 +
    (p.steals ?? 0) * 1.3 +
    (p.clutch_points ?? 0) * 2.0 +
    (p.wins ?? 0) * 3.0
  );
}

function getStatValue(player: PlayerStats, key: SortKey): number {
  if (key === 'efficiency') return calculateHighlightScore(player);
  return (player[key] as number) ?? 0;
}

function formatStatValue(player: PlayerStats, key: SortKey): string {
  if (key === 'efficiency') return calculateHighlightScore(player).toFixed(1);
  return String((player[key] as number) ?? 0);
}

interface WeeklyHighlight {
  user_id: string;
  name: string;
  avatar_url: string | null;
  points: number;
  assists: number;
  rebounds: number;
  blocks: number;
  steals: number;
  clutch_points: number;
  wins: number;
  efficiency: number;
  week_start: string;
  week_end: string;
}

interface RankingViewProps {
  stats: PlayerStats[];
  darkMode: boolean;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  userAvatars: Record<string, string>;
  onProfileClick: (stat: PlayerStats) => void;
  userProfile: { id: string; display_name: string | null; avatar_url: string | null } | null;
  isGuest: boolean;
  locationSlug?: string;
  locationId?: string;
}

const layoutTransition = { type: 'spring' as const, stiffness: 350, damping: 30 };

const SKILL_LABELS: Record<SortKey, string> = {
  efficiency: 'Eficiência',
  wins: 'Vitórias',
  points: 'Pontos',
  blocks: 'Tocos',
  steals: 'Roubos',
  clutch_points: 'Clutch',
  assists: 'Assistências',
  rebounds: 'Rebotes',
};

function ShimmerRing({ sizePx, borderPx = 3, children }: { sizePx: number; borderPx?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: sizePx + borderPx * 2,
        height: sizePx + borderPx * 2,
        borderRadius: '50%',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Spinning conic-gradient that creates the moving light effect */}
      <div
        style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          top: '-50%',
          left: '-50%',
          background:
            'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 10%, rgba(255,255,255,0.95) 20%, rgba(255,220,80,1) 30%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.08) 50%, transparent 62%, transparent 100%)',
          animation: 'shimmer-ring-spin 1.8s linear infinite',
        }}
      />
      {/* Avatar clipped inside, inset by borderPx */}
      <div
        style={{
          position: 'absolute',
          inset: borderPx,
          borderRadius: '50%',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function RankPodiumItem({
  rank,
  player,
  sortKey,
  darkMode,
  avatarUrl,
  onClick,
  size,
  medal,
  isTied,
  barHeightPx,
  hotStreak,
}: {
  rank: number;
  player: PlayerStats;
  sortKey: SortKey;
  darkMode: boolean;
  avatarUrl?: string;
  onClick: () => void;
  size: 'sm' | 'md' | 'lg';
  medal: string;
  isTied?: boolean;
  barHeightPx?: number;
  hotStreak?: boolean;
}) {
  const avatarPxMap = { sm: 56, md: 64, lg: 80 };
  const avatarPx = avatarPxMap[size];
  const sizeClasses = { sm: 'w-14 h-14', md: 'w-16 h-16', lg: 'w-20 h-20' };
  const defaultBarHeightPx = { sm: 48, md: 64, lg: 96 };
  const accentColor = rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-slate-300' : 'bg-orange-400';

  const avatarInner = avatarUrl ? (
    <img src={avatarUrl} alt={player.name} className="w-full h-full object-cover" />
  ) : (
    <div className={cn('w-full h-full flex items-center justify-center font-black', darkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-400')}>
      {rank}
    </div>
  );

  const barH = barHeightPx ?? defaultBarHeightPx[size];
  const barBg = isTied
    ? 'bg-black'
    : rank === 1
      ? darkMode ? 'bg-orange-500/20 border-x border-t border-orange-500/30' : 'bg-orange-500'
      : darkMode ? 'bg-slate-800' : 'bg-slate-200';

  return (
    <motion.div
      layout
      layoutId={`rank-${player.id}`}
      transition={layoutTransition}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <button
        type="button"
        onClick={onClick}
        className="relative group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-full"
      >
        {isTied ? (
          <ShimmerRing sizePx={avatarPx} borderPx={3}>
            {avatarInner}
          </ShimmerRing>
        ) : (
          <div className={cn(sizeClasses[size], rank === 1 ? 'ring-4 ring-yellow-500/20' : '', 'rounded-full p-[3px] shadow-lg', accentColor)}>
            <div className="w-full h-full rounded-full overflow-hidden">
              {avatarInner}
            </div>
          </div>
        )}
        <div className={cn('absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white', rank === 1 ? 'bg-yellow-500 text-white -top-3 -right-3 w-8 h-8 text-xs shadow-lg' : rank === 2 ? 'bg-slate-300 text-slate-700' : 'bg-orange-400 text-white')}>
          {medal}
        </div>
        {hotStreak && (
          <div className="absolute -bottom-1 -left-1">
            <HotStreakBadge size={size === 'lg' ? 22 : size === 'md' ? 18 : 16} />
          </div>
        )}
      </button>
      <div className="text-center">
        <p className={cn('font-bold truncate max-w-[80px] sm:max-w-[100px]', size === 'lg' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm', darkMode ? 'text-white' : 'text-slate-900')}>{player.name}</p>
        <p className="text-orange-500 font-black mt-0.5" style={{ fontSize: size === 'lg' ? '1.125rem' : size === 'md' ? '0.875rem' : '0.75rem' }}>{formatStatValue(player, sortKey)}</p>
        <p className={cn('text-[9px] uppercase tracking-wider font-bold mt-0.5', darkMode ? 'text-slate-600' : 'text-slate-500')}>{SKILL_LABELS[sortKey]}</p>
      </div>
      {isTied ? (
        <div className="w-full rounded-t-2xl bg-black relative overflow-hidden" style={{ height: barH }}>
          {/* Brilho fosco diagonal varrendo de cima para baixo */}
          <div
            style={{
              position: 'absolute',
              left: '-20%',
              width: '140%',
              height: '55%',
              background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%, transparent 100%)',
              transform: 'rotate(22deg)',
              animation: 'tied-bar-shimmer 2.4s ease-in-out infinite',
            }}
          />
        </div>
      ) : (
        <div className={cn('w-full rounded-t-2xl', barBg)} style={{ height: barH }} />
      )}
    </motion.div>
  );
}

function RankingView({ stats, darkMode, sortKey, onSortChange, userAvatars, onProfileClick, userProfile, isGuest, locationSlug, locationId }: RankingViewProps) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [weeklyHighlight, setWeeklyHighlight] = useState<WeeklyHighlight | null>(null);

  // Busca destaque da semana anterior via RPC (seg-dom)
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    supabase.rpc('get_weekly_highlight', { p_location_id: locationId }).then(({ data }) => {
      if (cancelled) return;
      const rows = data as WeeklyHighlight[] | null;
      setWeeklyHighlight(rows && rows.length > 0 ? rows[0] : null);
    });
    return () => { cancelled = true; };
  }, [locationId]);

  // Constrói um PlayerStats a partir do destaque semanal para reaproveitar o card
  const highlightPlayer = useMemo<PlayerStats | null>(() => {
    if (!weeklyHighlight) return null;
    // Encontra o stat acumulado para pegar o id correto
    const stat = stats.find((s) => s.user_id === weeklyHighlight.user_id);
    return {
      id: stat?.id ?? weeklyHighlight.user_id,
      name: weeklyHighlight.name,
      points: weeklyHighlight.points,
      wins: weeklyHighlight.wins,
      blocks: weeklyHighlight.blocks,
      steals: weeklyHighlight.steals,
      clutch_points: weeklyHighlight.clutch_points,
      assists: weeklyHighlight.assists,
      rebounds: weeklyHighlight.rebounds,
      user_id: weeklyHighlight.user_id,
      partidas: stat?.partidas ?? 0,
    };
  }, [weeklyHighlight, stats]);

  const highlightScore = weeklyHighlight?.efficiency ?? 0;
  const highlightAvatarUrl = weeklyHighlight?.avatar_url ?? (highlightPlayer?.user_id ? userAvatars[highlightPlayer.user_id] : undefined);
  const weekLabel = weeklyHighlight
    ? (() => {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const ws = new Date(weeklyHighlight.week_start + 'T00:00:00');
        const we = new Date(weeklyHighlight.week_end + 'T00:00:00');
        const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}`;
        return `${fmt(ws)} - ${fmt(we)} ${we.getFullYear()}`;
      })()
    : getWeekRangeLabel();
  const isHighlightCurrentUser =
    !isGuest &&
    !!userProfile?.id &&
    !!highlightPlayer?.user_id &&
    userProfile.id === highlightPlayer.user_id;
  const congratsName =
    userProfile?.display_name?.trim() || highlightPlayer?.name?.trim() || 'Atleta';

  const highlightStatBars = useMemo(() => {
    if (!highlightPlayer) return [];
    const defs = [
      { key: 'points' as const, label: 'Pontos', color: '#f97316' },
      { key: 'assists' as const, label: 'Assistências', color: '#3b82f6' },
      { key: 'rebounds' as const, label: 'Rebotes', color: '#10b981' },
      { key: 'blocks' as const, label: 'Tocos', color: '#8b5cf6' },
      { key: 'steals' as const, label: 'Roubos', color: '#ec4899' },
      { key: 'clutch_points' as const, label: 'Clutch', color: '#ef4444' },
      { key: 'wins' as const, label: 'Vitórias', color: '#f59e0b' },
    ];
    return defs.map((d) => {
      const value = (highlightPlayer[d.key] as number) ?? 0;
      const max = Math.max(...stats.map((p) => (p[d.key] as number) ?? 0), 1);
      return { ...d, value, max };
    });
  }, [highlightPlayer, stats]);

  useEffect(() => {
    if (!showHighlightModal) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [showHighlightModal]);

  const qrUrl = locationSlug ? `${window.location.origin}/${locationSlug}` : null;
  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      const diff = getStatValue(b, sortKey) - getStatValue(a, sortKey);
      if (diff !== 0) return diff;
      return (b.points ?? 0) - (a.points ?? 0);
    });
  }, [stats, sortKey]);

  // Há algum jogador com valor > 0 para o filtro atual?
  const hasAnyData = useMemo(
    () => sortedStats.some((s) => getStatValue(s, sortKey) > 0),
    [sortedStats, sortKey]
  );

  // Pódio: apenas jogadores com valor > 0 no filtro atual (máximo 3)
  const podiumPlayers = useMemo(
    () => sortedStats.filter((s) => getStatValue(s, sortKey) > 0).slice(0, 3),
    [sortedStats, sortKey]
  );
  // top3 com slots vazios (null) para posições sem jogador
  const top3: (PlayerStats | null)[] = [podiumPlayers[0] ?? null, podiumPlayers[1] ?? null, podiumPlayers[2] ?? null];
  // Lista a partir do 4º entre os que têm valor > 0, depois os que têm 0
  const withValue = sortedStats.filter((s) => getStatValue(s, sortKey) > 0).slice(3);
  const withoutValue = sortedStats.filter((s) => getStatValue(s, sortKey) === 0);
  const remaining = [...withValue, ...withoutValue];

  // Empates: só marca valores > 0 (evita shimmer em todos quando todo mundo tem 0)
  const tiedValues = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of sortedStats) {
      const v = getStatValue(s, sortKey);
      if (v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([v]) => v));
  }, [sortedStats, sortKey]);

  // Alturas das barras do pódio — equaliza jogadores empatados
  const top3BarHeights = useMemo(() => {
    const defaults = [96, 64, 48]; // rank 1, 2, 3 em px
    const heights = [...defaults];
    for (let i = 0; i < top3.length; i++) {
      for (let j = i + 1; j < top3.length; j++) {
        if (top3[i] && top3[j] && getStatValue(top3[i], sortKey) === getStatValue(top3[j], sortKey)) {
          const max = Math.max(heights[i], heights[j]);
          heights[i] = max;
          heights[j] = max;
        }
      }
    }
    return heights;
  }, [top3, sortKey]);

  // Tamanhos dos avatares do pódio — equaliza empatados para o maior tamanho do grupo
  const top3Sizes = useMemo((): ('sm' | 'md' | 'lg')[] => {
    const defaults: ('sm' | 'md' | 'lg')[] = ['lg', 'md', 'sm'];
    const sizes = [...defaults];
    for (let i = 0; i < top3.length; i++) {
      for (let j = i + 1; j < top3.length; j++) {
        if (top3[i] && top3[j] && getStatValue(top3[i], sortKey) === getStatValue(top3[j], sortKey)) {
          sizes[i] = 'lg';
          sizes[j] = 'lg';
        }
      }
    }
    return sizes;
  }, [top3, sortKey]);

  const filterOptions: { key: SortKey; label: string }[] = [
    { key: 'efficiency', label: 'Eficiência' },
    { key: 'points', label: 'Pontos' },
    { key: 'assists', label: 'Assistências' },
    { key: 'rebounds', label: 'Rebotes' },
    { key: 'blocks', label: 'Tocos' },
    { key: 'steals', label: 'Roubos' },
    { key: 'clutch_points', label: 'Clutch' },
  ];

  return (
    <section className="space-y-8">
      <style>{`
        @keyframes shimmer-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes tied-bar-shimmer {
          0%   { top: -80%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 120%; opacity: 0; }
        }
        @keyframes crown-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6)); transform: rotate(-5deg); }
          50% { filter: drop-shadow(0 0 12px rgba(251, 191, 36, 1)); transform: rotate(5deg); }
        }
        @keyframes highlight-bar-fill {
          from { width: 0%; }
        }
      `}</style>
      <div className="flex flex-col gap-4">

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSortChange(opt.key)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border',
                sortKey === opt.key
                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                  : darkMode ? 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Destaque da Rodada Card */}
      {highlightPlayer && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
          onClick={() => setShowHighlightModal(true)}
          className="w-full relative overflow-hidden rounded-2xl p-4 shadow-lg group cursor-pointer text-left"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)' }}
        >
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full bg-white/5" />
          <div className="absolute top-3 right-14 w-3 h-3 rounded-full bg-white/15" />
          <div className="absolute bottom-6 right-6 w-2 h-2 rounded-full bg-white/20" />

          <div className="relative flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/30 shadow-lg">
                {highlightAvatarUrl ? (
                  <img src={highlightAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <User className="w-7 h-7 text-white/70" />
                  </div>
                )}
              </div>
              <div className="absolute -top-3 -right-1" style={{ animation: 'crown-glow 2s ease-in-out infinite' }}>
                <Crown className="w-6 h-6 text-yellow-300" style={{ filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.9))' }} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Destaque da Rodada</p>
              <p className="text-lg font-black text-white truncate mt-0.5">{highlightPlayer.name}</p>
              <p className="text-xs text-white/80 mt-1">
                {highlightPlayer.points} pts · {highlightPlayer.assists} ast · {highlightPlayer.rebounds} reb
              </p>
            </div>

            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className="text-2xl font-black text-white leading-none">{highlightScore.toFixed(1)}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Score</span>
            </div>
          </div>
        </motion.button>
      )}

      <>
          {/* Podium for Top 3 — slots vazios quando não há jogador com valor > 0 */}
          {(() => {
            const medals = ['🥈', '👑', '🥉'];
            const sizes: ('sm' | 'md' | 'lg')[] = [top3Sizes[1], top3Sizes[0], top3Sizes[2]];
            const barHeights = [top3BarHeights[1], top3BarHeights[0], top3BarHeights[2]];
            const emptyBarH = [64, 96, 48]; // alturas padrão dos slots vazios
            // ordem de renderização: [2º lugar, 1º lugar, 3º lugar] para o layout de pódio
            const slots = [
              { rank: 2, player: top3[1], sizeIdx: 0 },
              { rank: 1, player: top3[0], sizeIdx: 1 },
              { rank: 3, player: top3[2], sizeIdx: 2 },
            ];
            return (
              <motion.div layout className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-4 pb-2">
                {slots.map(({ rank, player, sizeIdx }) =>
                  player ? (
                    <RankPodiumItem
                      key={player.id}
                      rank={rank}
                      player={player}
                      sortKey={sortKey}
                      darkMode={darkMode}
                      avatarUrl={player.user_id ? userAvatars[player.user_id] : undefined}
                      onClick={() => onProfileClick(player)}
                      size={sizes[sizeIdx]}
                      medal={medals[sizeIdx]}
                      isTied={tiedValues.has(getStatValue(player, sortKey))}
                      barHeightPx={barHeights[sizeIdx]}
                      hotStreak={isHotStreakActive(player.hot_streak_since)}
                    />
                  ) : (
                    <div key={`empty-${rank}`} className="flex flex-col items-center gap-3">
                      <div className={cn(
                        'w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center',
                        darkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
                      )}>
                        <span className={cn('text-lg font-black opacity-30', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                          {rank}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-[10px] font-semibold', darkMode ? 'text-slate-600' : 'text-slate-300')}>—</p>
                      </div>
                      <div
                        className={cn('w-full rounded-t-2xl', darkMode ? 'bg-slate-800/60' : 'bg-slate-100')}
                        style={{ height: emptyBarH[sizeIdx] }}
                      />
                    </div>
                  )
                )}
              </motion.div>
            );
          })()}

          {/* List for the rest */}
          <motion.div layout className="space-y-3">
            <AnimatePresence mode="popLayout">
              {remaining.map((player, index) => (
                <motion.button
                  key={player.id}
                  type="button"
                  layout
                  layoutId={`rank-${player.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={layoutTransition}
                  onClick={() => onProfileClick(player)}
                  className={cn(
                    'w-full p-4 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99] text-left',
                    darkMode ? 'bg-slate-900/50 border border-slate-800 hover:border-slate-700' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {tiedValues.has(getStatValue(player, sortKey)) ? (
                        <ShimmerRing sizePx={40} borderPx={2}>
                          {player.user_id && userAvatars[player.user_id] ? (
                            <img src={userAvatars[player.user_id]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className={cn('w-full h-full flex items-center justify-center font-bold text-xs', darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400')}>
                              {index + 4}
                            </div>
                          )}
                        </ShimmerRing>
                      ) : (
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden',
                            darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'
                          )}
                        >
                          {player.user_id && userAvatars[player.user_id] ? (
                            <img src={userAvatars[player.user_id]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{index + 4}</span>
                          )}
                        </div>
                      )}
                      {isHotStreakActive(player.hot_streak_since) && (
                        <div className="absolute -bottom-1 -left-1">
                          <HotStreakBadge size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={cn('font-bold truncate', darkMode ? 'text-white' : 'text-slate-900')}>{player.name}</h3>
                      <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1 items-center">
                        {(['points', 'assists', 'blocks', 'steals'] as const).map((key, i) => (
                          <span key={key} className="flex items-center gap-1.5">
                            {i > 0 && <span className={cn('w-0.5 h-0.5 rounded-full', darkMode ? 'bg-slate-600' : 'bg-slate-300')} />}
                            <span
                              className={cn(
                                'text-[10px] font-bold uppercase tracking-wider',
                                key === sortKey ? 'text-orange-500' : darkMode ? 'text-slate-500' : 'text-slate-400'
                              )}
                            >
                              {player[key] ?? 0} {SKILL_LABELS[key].toLowerCase()}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-xl font-black text-orange-500">{formatStatValue(player, sortKey)}</div>
                    <div className={cn('text-[9px] uppercase tracking-widest font-bold', darkMode ? 'text-slate-600' : 'text-slate-500')}>
                      {SKILL_LABELS[sortKey]}
                    </div>
                    <ArrowRight className={cn('w-4 h-4 mt-1 mx-auto', darkMode ? 'text-slate-600' : 'text-slate-400')} />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
      </>

      {/* Destaque da Rodada Modal */}
      <AnimatePresence>
        {showHighlightModal && highlightPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 pt-6 pb-[calc(1.5rem+3.5rem+env(safe-area-inset-bottom,0px))] bg-black/70 backdrop-blur-md overflow-hidden overscroll-none"
            onClick={() => setShowHighlightModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'rounded-3xl w-full max-w-md max-h-[min(85dvh,calc(100dvh-1.5rem-(1.5rem+3.5rem+env(safe-area-inset-bottom,0px)))] flex flex-col overflow-hidden shadow-2xl',
                darkMode ? 'bg-slate-900' : 'bg-white'
              )}
            >
              {/* Gradient Header — compacto para caber o card inteiro em telas pequenas */}
              <div
                className="relative px-4 pt-3 pb-4 rounded-t-3xl overflow-hidden shrink-0"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 40%, #ef4444 100%)' }}
              >
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5" />

                <button
                  onClick={() => setShowHighlightModal(false)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/20 text-white/80 hover:bg-black/30 transition-colors z-10"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="relative flex flex-col items-center pt-1">
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Crown
                      className="w-7 h-7 text-yellow-300 mx-auto mb-0.5"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.7))' }}
                    />
                  </motion.div>

                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-0">Destaque da Rodada</p>
                  <p className="text-[10px] text-white/50 mb-2">{weekLabel}</p>

                  <motion.div
                    className="relative"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white/30 shadow-lg">
                      {highlightAvatarUrl ? (
                        <img src={highlightAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/20 flex items-center justify-center">
                          <User className="w-6 h-6 text-white/60" />
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 bg-yellow-400 rounded-full p-1 shadow-md">
                      <Trophy className="w-3 h-3 text-yellow-800" />
                    </div>
                  </motion.div>

                  <h2 className="text-base font-black text-white mt-2 text-center leading-tight px-1">{highlightPlayer.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0 rounded-full bg-white/15 text-[10px] font-bold text-white/90">
                      Score {highlightScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {isHighlightCurrentUser && (
                <div
                  className={cn(
                    'shrink-0 px-4 py-3 border-b text-center text-sm leading-snug',
                    darkMode ? 'bg-orange-500/10 border-orange-500/20 text-orange-100' : 'bg-orange-50 border-orange-100 text-slate-800'
                  )}
                >
                  <p>
                    Parabéns, <span className="font-bold">{congratsName}</span>, você está construindo um currículo incrível.
                  </p>
                </div>
              )}

              {/* Stats: única área com scroll; cabeçalho do modal permanece fixo */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-4 space-y-3">
                  <h3 className={cn('text-xs font-bold uppercase tracking-wider', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Desempenho Geral
                  </h3>

                  <div className="space-y-2.5">
                    {highlightStatBars.map((stat, idx) => (
                      <div key={stat.key}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={cn('text-xs font-semibold', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                            {stat.label}
                          </span>
                          <span className={cn('text-xs font-black tabular-nums', darkMode ? 'text-white' : 'text-slate-900')}>
                            {stat.value}
                          </span>
                        </div>
                        <div className={cn('h-2 rounded-full overflow-hidden', darkMode ? 'bg-slate-800' : 'bg-slate-100')}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.max > 0 ? (stat.value / stat.max) * 100 : 0}%` }}
                            transition={{ duration: 0.7, delay: 0.3 + idx * 0.08, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: stat.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick stats summary */}
                  <div className={cn(
                    'grid grid-cols-3 gap-2 pt-3 border-t',
                    darkMode ? 'border-slate-800' : 'border-slate-100'
                  )}>
                    {[
                      { label: 'Jogos', value: highlightPlayer.partidas ?? 0 },
                      { label: 'Vitórias', value: highlightPlayer.wins ?? 0 },
                      { label: 'Pontos', value: highlightPlayer.points ?? 0 },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <p className={cn('text-lg font-black', darkMode ? 'text-white' : 'text-slate-900')}>{item.value}</p>
                        <p className={cn('text-[10px] uppercase tracking-wider font-bold mt-0.5', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && qrUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4 sm:p-6"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Fechar"
              onClick={() => setShowQrModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative z-10 my-auto w-full max-w-xs flex flex-col items-center gap-5 rounded-2xl p-6 shadow-2xl',
                darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <h3 className={cn('text-lg font-bold', darkMode ? 'text-white' : 'text-slate-900')}>Convide jogadores</h3>
                <button type="button" onClick={() => setShowQrModal(false)} className={cn('p-1 rounded-lg transition-colors', darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-white p-4 rounded-xl inline-flex mx-auto">
                <QRCodeSVG value={qrUrl} size={200} level="M" />
              </div>
              <p className={cn('text-xs text-center', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                Escaneie para entrar nesta quadra
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
