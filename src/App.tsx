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
  ChevronUp,
  ChevronDown,
  Home,
  List as ListIcon,
  Calendar,
  User,
  LogOut,
  Shield,
  Target,
  X,
  Timer,
  MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './supabase';
import { useAuth } from './contexts/AuthContext';
import EditarPerfil from './pages/EditarPerfil';
import { MatchTimer, type TimerState } from './components/MatchTimer';
import { useLocationCheck } from './hooks/useLocationCheck';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Player {
  id: string;
  name: string;
  status: 'waiting' | 'team1' | 'team2';
  joined_at: string;
  admin?: boolean;
}

interface PlayerStats {
  id: string;
  name: string;
  wins: number;
  points: number;
  blocks: number;
  steals: number;
  clutch_points: number;
}

type Tab = 'inicio' | 'lista' | 'eventos' | 'perfil';
type SortKey = 'wins' | 'points' | 'blocks' | 'steals' | 'clutch_points';

const ADMIN_PASSWORD = '1710';
const ADMIN_STORAGE_KEY = 'basquete_admin';

export default function App() {
  const { user, isGuest, signOut, leaveGuestMode } = useAuth();
  const isLoggedIn = !!user;

  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [isMatchStarted, setIsMatchStarted] = useState(false);
  const [currentPartidaSessaoId, setCurrentPartidaSessaoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(() => localStorage.getItem(ADMIN_STORAGE_KEY) === 'true');
  const [team1MatchPoints, setTeam1MatchPoints] = useState(0);
  const [team2MatchPoints, setTeam2MatchPoints] = useState(0);
  const [showWinnerModal, setShowWinnerModal] = useState<'team1' | 'team2' | null>(null);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [isStartingNextMatch, setIsStartingNextMatch] = useState(false);
  const [isProcessingTimeout, setIsProcessingTimeout] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>({
    timerSeconds: 0,
    timerRunning: false,
    timerLastSyncAt: null,
  });
  const [timerStartedOnce, setTimerStartedOnce] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const lastPlacarUpdateAt = useRef<number>(0);

  const { isWithinRadius, isLoading: locationLoading, error: locationError, retry: retryLocation } = useLocationCheck(
    activeTab === 'lista' && !isAdminMode
  );

  const canSeeList = isAdminMode || isWithinRadius === true;
  const canAddToList = isAdminMode || isWithinRadius === true;

  const fetchPlayers = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('players')
      .select('*')
      .order('joined_at', { ascending: true });
    if (err) {
      console.error('Supabase error:', err);
      setError('Erro ao carregar lista. Verifique as permissões.');
      return;
    }
    setPlayers((data ?? []) as Player[]);
  }, []);

  const fetchStats = useCallback(async () => {
    const { data, error: err } = await supabase.from('stats').select('*');
    if (err) {
      console.error('Supabase stats error:', err);
      return;
    }
    const statsData = (data ?? []) as PlayerStats[];
    setStats(statsData);
  }, []);

  const fetchSession = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('session')
      .select('*')
      .eq('id', 'current')
      .single();
    if (err && err.code !== 'PGRST116') {
      console.error('Session error:', err);
      return;
    }
    if (data) {
      setIsMatchStarted(data.is_started);
      setCurrentPartidaSessaoId(data.current_partida_sessao_id ?? null);
      setTimerState({
        timerSeconds: (data.timer_seconds ?? 0) as number,
        timerRunning: !!data.timer_running,
        timerLastSyncAt: data.timer_last_sync_at as string | null,
      });
      setTimerStartedOnce(!!data.timer_started_once);
    } else {
      await supabase.from('session').upsert({ id: 'current', is_started: false });
    }
  }, []);

  const fetchPartidaSessao = useCallback(async (partidaSessaoId: string | null) => {
    if (!partidaSessaoId) {
      setTeam1MatchPoints(0);
      setTeam2MatchPoints(0);
      setShowWinnerModal(null);
      return;
    }
    const { data, error } = await supabase
      .from('partida_sessoes')
      .select('team1_points, team2_points')
      .eq('id', partidaSessaoId)
      .single();
    if (error || !data) {
      return;
    }
    const t1 = (data.team1_points ?? 0) as number;
    const t2 = (data.team2_points ?? 0) as number;
    setTeam1MatchPoints(t1);
    setTeam2MatchPoints(t2);
    if (t1 >= 12) {
      setShowWinnerModal('team1');
      const now = new Date().toISOString();
      await supabase.from('session').update({ timer_seconds: 0, timer_running: false, timer_last_sync_at: now }).eq('id', 'current');
      setTimerState({ timerSeconds: 0, timerRunning: false, timerLastSyncAt: now });
    } else if (t2 >= 12) {
      setShowWinnerModal('team2');
      const now = new Date().toISOString();
      await supabase.from('session').update({ timer_seconds: 0, timer_running: false, timer_last_sync_at: now }).eq('id', 'current');
      setTimerState({ timerSeconds: 0, timerRunning: false, timerLastSyncAt: now });
    } else {
      setShowWinnerModal(null);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
    fetchSession();
    setLoading(false);
  }, [fetchPlayers, fetchSession]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchPartidaSessao(currentPartidaSessaoId);
  }, [currentPartidaSessaoId, fetchPartidaSessao]);

  // Admin por email no banco (basquete_users.admin): se usuário logado for admin, ativa modo admin
  useEffect(() => {
    if (!user?.email) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('basquete_users')
        .select('admin')
        .eq('email', user.email)
        .eq('admin', true)
        .maybeSingle();
      if (data?.admin) {
        setIsAdminMode(true);
        localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      }
    };
    checkAdmin();
  }, [user?.email]);

  // Polling do placar: fonte única de verdade para admin e visitante (Realtime pode falhar em guests)
  const shouldPollPlacar = activeTab === 'lista' && !!currentPartidaSessaoId;
  useEffect(() => {
    if (!shouldPollPlacar) return;
    const doFetch = () => {
      if (Date.now() - lastPlacarUpdateAt.current < 1500) return;
      fetchPartidaSessao(currentPartidaSessaoId);
    };
    doFetch();
    const interval = setInterval(doFetch, 2000);
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
    const { data } = await supabase
      .from('basquete_users')
      .select('display_name, avatar_url')
      .eq('auth_id', user.id)
      .maybeSingle();
    setUserProfile(data ? { display_name: data.display_name, avatar_url: data.avatar_url } : null);
  }, [user?.id]);

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

  // Realtime: placar (para não-admin fechar o modal quando admin iniciar próxima partida)
  useEffect(() => {
    const channel = supabase
      .channel('partida-sessoes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partida_sessoes' }, () => {
        if (currentPartidaSessaoId) fetchPartidaSessao(currentPartidaSessaoId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPartidaSessaoId, fetchPartidaSessao]);

  const team1 = useMemo(() => players.filter((p) => p.status === 'team1'), [players]);
  const team2 = useMemo(() => players.filter((p) => p.status === 'team2'), [players]);
  const waitingList = useMemo(() => players.filter((p) => p.status === 'waiting'), [players]);

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
            .insert({})
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          const now = new Date().toISOString();
          await supabase.from('session').upsert({
            id: 'current',
            is_started: true,
            started_at: now,
            current_partida_sessao_id: partidaSessao?.id,
          });
          setIsMatchStarted(true);
          setCurrentPartidaSessaoId(partidaSessao?.id ?? null);
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

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !canAddToList) return;

    const canAdd = isMatchStarted || waitingList.length < 10;
    if (!canAdd || !canAddToList) return;

    setError(null);

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
        .insert({ name: newName.trim(), status })
        .select()
        .single();

      if (err) throw err;
      setNewName('');

      if (newPlayer) {
        setPlayers((prev) => [...prev, newPlayer as Player].sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        ));
      }
    } catch (err) {
      console.error('Error adding player:', err);
      setError(err instanceof Error ? err.message : 'Erro ao adicionar jogador.');
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
    type: 'MOVE' | 'REMOVE' | 'START_MATCH' | 'END_MATCH' | 'ADMIN_ACTIVATE' | 'RESET_TIMER';
    moveInfo?: { playerId: string; direction: 'up' | 'down' };
    removeInfo?: { playerId: string };
  } | null>(null);
  const [statsModalPlayer, setStatsModalPlayer] = useState<Player | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handleMoveAttempt = (playerId: string, direction: 'up' | 'down') => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'MOVE', moveInfo: { playerId, direction } });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleRemoveAttempt = (playerId: string) => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'REMOVE', removeInfo: { playerId } });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleStartMatchAttempt = () => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'START_MATCH' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleEndMatchAttempt = () => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'END_MATCH' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleAdminActivate = () => {
    setShowPasswordModal({ type: 'ADMIN_ACTIVATE' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleTimerStart = async () => {
    if (!isAdminMode) return;

    if (isMatchStarted && (team1.length < 5 || team2.length < 5)) {
      setError('O cronômetro só pode ser iniciado com jogadores nos dois times (5 em cada).');
      return;
    }

    const now = new Date().toISOString();
    try {
      if (waitingList.length >= 10 && !isMatchStarted) {
        const next10 = waitingList.slice(0, 10);
        for (let i = 0; i < 5 && next10[i]; i++) {
          await supabase.from('players').update({ status: 'team1' }).eq('id', next10[i].id);
        }
        for (let i = 5; i < 10 && next10[i]; i++) {
          await supabase.from('players').update({ status: 'team2' }).eq('id', next10[i].id);
        }

        const { data: partidaSessao, error: insertErr } = await supabase
          .from('partida_sessoes')
          .insert({})
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        await supabase.from('session').upsert({
          id: 'current',
          is_started: true,
          started_at: now,
          current_partida_sessao_id: partidaSessao?.id,
          timer_seconds: 0,
          timer_running: true,
          timer_last_sync_at: now,
          timer_started_once: true,
        });
        setIsMatchStarted(true);
        setCurrentPartidaSessaoId(partidaSessao?.id ?? null);
        setTimerState({ timerSeconds: 0, timerRunning: true, timerLastSyncAt: now });
        setTimerStartedOnce(true);
        setError(null);
        await fetchPlayers();
      } else if (isMatchStarted) {
        await supabase
          .from('session')
          .update({
            timer_seconds: 0,
            timer_running: true,
            timer_last_sync_at: now,
            timer_started_once: true,
          })
          .eq('id', 'current');
        setTimerState({ timerSeconds: 0, timerRunning: true, timerLastSyncAt: now });
        setTimerStartedOnce(true);
      }
    } catch (err) {
      console.error('Error starting timer:', err);
      setError('Erro ao iniciar cronômetro.');
    }
  };

  const handleTimerPause = async () => {
    if (!isAdminMode) return;
    const now = new Date().toISOString();
    const baseSeconds = timerState.timerLastSyncAt
      ? timerState.timerSeconds + Math.floor((Date.now() - new Date(timerState.timerLastSyncAt).getTime()) / 1000)
      : timerState.timerSeconds;
    try {
      await supabase
        .from('session')
        .update({ timer_seconds: baseSeconds, timer_running: false, timer_last_sync_at: now })
        .eq('id', 'current');
      setTimerState({ timerSeconds: baseSeconds, timerRunning: false, timerLastSyncAt: now });
    } catch (err) {
      console.error('Error pausing timer:', err);
    }
  };

  const handleTimerResetRequest = () => {
    if (!isAdminMode) return;
    setShowPasswordModal({ type: 'RESET_TIMER' });
    setPasswordInput('');
    setPasswordError(false);
  };

  const stopAndResetTimer = useCallback(async () => {
    const now = new Date().toISOString();
    try {
      await supabase
        .from('session')
        .update({ timer_seconds: 0, timer_running: false, timer_last_sync_at: now })
        .eq('id', 'current');
      setTimerState({ timerSeconds: 0, timerRunning: false, timerLastSyncAt: now });
    } catch (err) {
      console.error('Error stopping timer:', err);
    }
  }, []);

  const pointsBlocked = waitingList.length >= 10 && !timerStartedOnce;

  const addPlayerStat = async (player: Player, stat: 'points_2' | 'points_3' | 'blocks' | 'steals') => {
    if (pointsBlocked) return;
    try {
      const { data: existing } = await supabase.from('stats').select('*').eq('name', player.name).maybeSingle();

      if (existing) {
        const updates =
          stat === 'points_2'
            ? { points: (existing.points ?? 0) + 2 }
            : stat === 'points_3'
              ? { points: (existing.points ?? 0) + 3 }
              : stat === 'blocks'
                ? { blocks: (existing.blocks ?? 0) + 1 }
                : { steals: (existing.steals ?? 0) + 1 };
        await supabase.from('stats').update(updates).eq('id', existing.id);
      } else {
        const inserts =
          stat === 'points_2'
            ? { name: player.name, points: 2, wins: 0, blocks: 0, steals: 0, clutch_points: 0 }
            : stat === 'points_3'
              ? { name: player.name, points: 3, wins: 0, blocks: 0, steals: 0, clutch_points: 0 }
              : stat === 'blocks'
                ? { name: player.name, points: 0, wins: 0, blocks: 1, steals: 0, clutch_points: 0 }
                : { name: player.name, points: 0, wins: 0, blocks: 0, steals: 1, clutch_points: 0 };
        await supabase.from('stats').insert(inserts);
      }
      fetchStats();
      setStatsModalPlayer(null);

      if (stat === 'points_2' || stat === 'points_3') {
        const pts = stat === 'points_2' ? 2 : 3;
        if (player.status === 'team1' && currentPartidaSessaoId) {
          const newScore = team1MatchPoints + pts;
          lastPlacarUpdateAt.current = Date.now();
          setTeam1MatchPoints(newScore);
          if (newScore >= 12) setShowWinnerModal('team1');
          const { error: updErr } = await supabase
            .from('partida_sessoes')
            .update({ team1_points: newScore })
            .eq('id', currentPartidaSessaoId);
          if (updErr) {
            setTeam1MatchPoints(team1MatchPoints);
            setError(updErr.message || 'Erro ao atualizar placar.');
          } else if (newScore >= 12) {
            await stopAndResetTimer();
          }
        } else if (player.status === 'team2' && currentPartidaSessaoId) {
          const newScore = team2MatchPoints + pts;
          lastPlacarUpdateAt.current = Date.now();
          setTeam2MatchPoints(newScore);
          if (newScore >= 12) setShowWinnerModal('team2');
          const { error: updErr } = await supabase
            .from('partida_sessoes')
            .update({ team2_points: newScore })
            .eq('id', currentPartidaSessaoId);
          if (updErr) {
            setTeam2MatchPoints(team2MatchPoints);
            setError(updErr.message || 'Erro ao atualizar placar.');
          } else if (newScore >= 12) {
            await stopAndResetTimer();
          }
        }
      }
    } catch (err) {
      console.error('Error adding stat:', err);
      setError('Erro ao registrar estatística.');
    }
  };

  const startNextMatch = async () => {
    if (!showWinnerModal) return;
    if (team1MatchPoints < 12 && team2MatchPoints < 12) return;
    if (isStartingNextMatch) return;

    const winningTeamKey = team1MatchPoints >= 12 ? 'team1' : 'team2';
    const losingTeamKey = winningTeamKey === 'team1' ? 'team2' : 'team1';
    const losers = losingTeamKey === 'team1' ? team1 : team2;
    const winners = winningTeamKey === 'team1' ? team1 : team2;

    setShowWinnerModal(null);
    setIsStartingNextMatch(true);

    try {
      if (currentPartidaSessaoId) {
        await supabase
          .from('partida_sessoes')
          .update({ team1_points: 0, team2_points: 0 })
          .eq('id', currentPartidaSessaoId);
      }
      setTeam1MatchPoints(0);
      setTeam2MatchPoints(0);

      const nextPlayers = waitingList.slice(0, 5);
      const maxWaitingTime =
        waitingList.length > 5
          ? Math.max(...waitingList.slice(5).map((p) => new Date(p.joined_at).getTime()))
          : Date.now() - 10000;

      for (let i = 0; i < losers.length; i++) {
        const joinedAt = new Date(maxWaitingTime + (i + 1) * 1000).toISOString();
        await supabase.from('players').update({ status: 'waiting', joined_at: joinedAt }).eq('id', losers[i].id);
      }

      for (const p of nextPlayers) {
        await supabase.from('players').update({ status: losingTeamKey }).eq('id', p.id);
      }
      for (const p of winners) {
        const { data: s } = await supabase.from('stats').select('*').eq('name', p.name).maybeSingle();
        if (s) {
          await supabase.from('stats').update({ wins: (s.wins ?? 0) + 1 }).eq('id', s.id);
        } else {
          await supabase.from('stats').insert({ name: p.name, wins: 1, points: 0, blocks: 0, steals: 0, clutch_points: 0 });
        }
      }
      await fetchPlayers();
      fetchStats();
    } catch (err) {
      console.error('Error starting next match:', err);
      setError('Erro ao iniciar próxima partida.');
    } finally {
      setIsStartingNextMatch(false);
    }
  };

  const handleTimerTimeout = useCallback(async () => {
    if (
      team1MatchPoints >= 12 ||
      team2MatchPoints >= 12 ||
      !isMatchStarted ||
      !currentPartidaSessaoId ||
      isProcessingTimeout
    )
      return;

    const { data: partidaSessao } = await supabase
      .from('partida_sessoes')
      .select('timeout_at')
      .eq('id', currentPartidaSessaoId)
      .single();
    if (partidaSessao?.timeout_at) return; // já processado por outro cliente

    setIsProcessingTimeout(true);
    setShowTimeoutModal(true);

    try {
      const firstTeam = team1MatchPoints >= team2MatchPoints ? team1 : team2;
      const secondTeam = team1MatchPoints >= team2MatchPoints ? team2 : team1;

      const lastInQueue =
        waitingList.length > 0
          ? Math.max(...waitingList.map((p) => new Date(p.joined_at).getTime()))
          : Date.now() - 60000;

      for (let i = 0; i < firstTeam.length; i++) {
        const joinedAt = new Date(lastInQueue + (i + 1) * 1000).toISOString();
        await supabase.from('players').update({ status: 'waiting', joined_at: joinedAt }).eq('id', firstTeam[i].id);
      }
      const afterFirstTeam = lastInQueue + firstTeam.length * 1000 + 1000;
      for (let i = 0; i < secondTeam.length; i++) {
        const joinedAt = new Date(afterFirstTeam + (i + 1) * 1000).toISOString();
        await supabase.from('players').update({ status: 'waiting', joined_at: joinedAt }).eq('id', secondTeam[i].id);
      }

      await supabase
        .from('partida_sessoes')
        .update({ timeout_at: new Date().toISOString() })
        .eq('id', currentPartidaSessaoId);

      const { data: newPartidaSessao, error: insertErr } = await supabase
        .from('partida_sessoes')
        .insert({})
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      const now = new Date().toISOString();
      await supabase.from('session').upsert({
        id: 'current',
        is_started: true,
        started_at: now,
        current_partida_sessao_id: newPartidaSessao?.id,
        timer_seconds: 0,
        timer_running: false,
        timer_last_sync_at: now,
      });

      setCurrentPartidaSessaoId(newPartidaSessao?.id ?? null);
      setTeam1MatchPoints(0);
      setTeam2MatchPoints(0);
      setTimerState({ timerSeconds: 0, timerRunning: false, timerLastSyncAt: now });
      setShowWinnerModal(null);

      await fetchPlayers();

      const updated = await supabase.from('players').select('*').order('joined_at', { ascending: true });
      const allPlayers = (updated.data ?? []) as Player[];
      const next10 = allPlayers.filter((p) => p.status === 'waiting').slice(0, 10);
      for (let i = 0; i < 5 && next10[i]; i++) {
        await supabase.from('players').update({ status: 'team1' }).eq('id', next10[i].id);
      }
      for (let i = 5; i < 10 && next10[i]; i++) {
        await supabase.from('players').update({ status: 'team2' }).eq('id', next10[i].id);
      }
      await fetchPlayers();
    } catch (err) {
      console.error('Error processing timeout:', err);
      setError('Erro ao processar timeout da partida.');
    } finally {
      setIsProcessingTimeout(false);
    }
  }, [
    team1MatchPoints,
    team2MatchPoints,
    isMatchStarted,
    currentPartidaSessaoId,
    isProcessingTimeout,
    team1,
    team2,
    waitingList,
  ]);

  const startNextMatchRef = useRef(startNextMatch);
  startNextMatchRef.current = startNextMatch;

  useEffect(() => {
    if (!showWinnerModal || !isAdminMode) return;
    const t = setTimeout(() => startNextMatchRef.current(), 5000);
    return () => clearTimeout(t);
  }, [showWinnerModal, isAdminMode]);

  useEffect(() => {
    if (!showTimeoutModal) return;
    const t = setTimeout(() => setShowTimeoutModal(false), 3000);
    return () => clearTimeout(t);
  }, [showTimeoutModal]);

  const confirmAction = async () => {
    if (passwordInput !== ADMIN_PASSWORD) {
      setPasswordError(true);
      return;
    }

    if (!showPasswordModal) return;

    if (showPasswordModal.type === 'ADMIN_ACTIVATE') {
      setIsAdminMode(true);
      localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      setShowPasswordModal(null);
      setPasswordInput('');
      return;
    }

    try {
      if (showPasswordModal.type === 'MOVE' && showPasswordModal.moveInfo) {
        const { playerId, direction } = showPasswordModal.moveInfo;
        const currentIndex = waitingList.findIndex((p) => p.id === playerId);
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex >= 0 && targetIndex < waitingList.length) {
          const currentPlayer = waitingList[currentIndex];
          const targetPlayer = waitingList[targetIndex];

          await supabase
            .from('players')
            .update({ joined_at: targetPlayer.joined_at })
            .eq('id', currentPlayer.id);
          await supabase
            .from('players')
            .update({ joined_at: currentPlayer.joined_at })
            .eq('id', targetPlayer.id);
        }
      } else if (showPasswordModal.type === 'REMOVE' && showPasswordModal.removeInfo) {
        const { playerId } = showPasswordModal.removeInfo;
        const playerToRemove = players.find((p) => p.id === playerId);

        if (playerToRemove) {
          const status = playerToRemove.status;

          await supabase.from('players').delete().eq('id', playerId);

          if ((status === 'team1' || status === 'team2') && waitingList.length > 0) {
            const nextInLine = waitingList[0];
            await supabase
              .from('players')
              .update({ status })
              .eq('id', nextInLine.id);
          }
        }
      } else if (showPasswordModal.type === 'START_MATCH') {
        const { data: partidaSessao, error: insertErr } = await supabase
          .from('partida_sessoes')
          .insert({})
          .select('id')
          .single();

        if (insertErr) throw insertErr;

        await supabase
          .from('session')
          .upsert({
            id: 'current',
            is_started: true,
            started_at: new Date().toISOString(),
            current_partida_sessao_id: partidaSessao?.id,
          });

        setIsMatchStarted(true);
        setCurrentPartidaSessaoId(partidaSessao?.id ?? null);
        setTeam1MatchPoints(0);
        setTeam2MatchPoints(0);
      } else if (showPasswordModal.type === 'RESET_TIMER') {
        const now = new Date().toISOString();
        await supabase
          .from('session')
          .update({ timer_seconds: 0, timer_running: false, timer_last_sync_at: now })
          .eq('id', 'current');
        setTimerState({ timerSeconds: 0, timerRunning: false, timerLastSyncAt: now });
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
            timer_seconds: 0,
            timer_running: false,
            timer_last_sync_at: null,
            timer_started_once: false,
          })
          .eq('id', 'current');

        setTimerState({ timerSeconds: 0, timerRunning: false, timerLastSyncAt: null });
        setTimerStartedOnce(false);

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
      setError('Erro ao realizar ação.');
    }
  };

  const resetQueue = async () => {
    if (!window.confirm('Tem certeza que deseja resetar toda a lista?')) return;
    try {
      for (const p of players) {
        await supabase.from('players').delete().eq('id', p.id);
      }
    } catch (err) {
      console.error('Error resetting queue:', err);
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
        'min-h-screen font-sans selection:bg-orange-500/30 transition-colors duration-300',
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}
    >
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
                    : showPasswordModal.type === 'MOVE'
                      ? 'Mover Jogador'
                      : showPasswordModal.type === 'REMOVE'
                        ? 'Remover Jogador'
                        : showPasswordModal.type === 'START_MATCH'
                          ? 'Iniciar Partida'
                          : showPasswordModal.type === 'RESET_TIMER'
                            ? 'Zerar Cronômetro'
                            : 'Encerrar Partida'}
                </h3>
                <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {showPasswordModal.type === 'ADMIN_ACTIVATE'
                    ? 'Digite a senha para ativar o modo administrador.'
                    : showPasswordModal.type === 'MOVE'
                      ? 'Digite a senha para alterar a ordem da fila.'
                      : showPasswordModal.type === 'REMOVE'
                        ? 'Digite a senha para remover este jogador da lista.'
                        : showPasswordModal.type === 'START_MATCH'
                          ? 'Digite a senha para iniciar a sessão de partidas.'
                          : showPasswordModal.type === 'RESET_TIMER'
                            ? 'Digite a senha para zerar o cronômetro.'
                            : 'Digite a senha para encerrar a sessão de partidas.'}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && confirmAction()}
                  placeholder="Senha de administrador"
                  className={cn(
                    'w-full border rounded-xl px-4 py-3 focus:outline-none transition-all text-center text-lg tracking-widest',
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900',
                    passwordError ? 'border-red-500 ring-2 ring-red-500/20' : 'focus:ring-2 focus:ring-orange-500/50'
                  )}
                />
                {passwordError && (
                  <p className="text-red-400 text-xs text-center">Senha incorreta. Tente novamente.</p>
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

      {/* Modal de timeout (10 min sem 12 pontos) */}
      <AnimatePresence>
        {showTimeoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'border p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center',
                darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              )}
            >
              <Timer className={cn('w-12 h-12 mx-auto mb-3', darkMode ? 'text-amber-400' : 'text-amber-500')} />
              <h3 className={cn('text-lg font-bold mb-1', darkMode ? 'text-white' : 'text-slate-900')}>Timeout!</h3>
              <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                Ambas as equipes foram para a fila de espera.
              </p>
              {isProcessingTimeout && (
                <p className={cn('text-xs mt-2', darkMode ? 'text-slate-500' : 'text-slate-400')}>Iniciando próxima partida...</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de estatísticas do jogador */}
      <AnimatePresence>
        {statsModalPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'border p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4',
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className={cn('text-lg font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
                  Registrar: {statsModalPlayer.name}
                </h3>
                <button
                  onClick={() => setStatsModalPlayer(null)}
                  className={cn('p-1 rounded-lg', darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {pointsBlocked && (
                <div
                  className={cn(
                    'p-3 rounded-xl text-sm flex items-center gap-2',
                    darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'
                  )}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {isAdminMode ? 'Inicie o cronômetro para liberar a atribuição de pontos.' : 'Aguardando início da partida.'}
                </div>
              )}
              <div className={cn('grid grid-cols-2 gap-2', pointsBlocked && 'opacity-60 pointer-events-none')}>
                <button
                  onClick={() => addPlayerStat(statsModalPlayer, 'points_2')}
                  disabled={pointsBlocked}
                  className={cn(
                    'p-4 rounded-xl font-bold transition-all',
                    pointsBlocked
                      ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30'
                  )}
                >
                  <Target className="w-5 h-5 mx-auto mb-1" />
                  2 pts
                </button>
                <button
                  onClick={() => addPlayerStat(statsModalPlayer, 'points_3')}
                  disabled={pointsBlocked}
                  className={cn(
                    'p-4 rounded-xl font-bold transition-all',
                    pointsBlocked
                      ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30'
                  )}
                >
                  <Target className="w-5 h-5 mx-auto mb-1" />
                  3 pts
                </button>
                <button
                  onClick={() => addPlayerStat(statsModalPlayer, 'blocks')}
                  disabled={pointsBlocked}
                  className={cn(
                    'p-4 rounded-xl font-bold transition-all',
                    pointsBlocked
                      ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30'
                  )}
                >
                  🛡️
                  <span className="block text-sm">1 bloqueio</span>
                </button>
                <button
                  onClick={() => addPlayerStat(statsModalPlayer, 'steals')}
                  disabled={pointsBlocked}
                  className={cn(
                    'p-4 rounded-xl font-bold transition-all',
                    pointsBlocked
                      ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30'
                  )}
                >
                  🏃
                  <span className="block text-sm">1 roubo</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className={cn(
          'border-b backdrop-blur-md sticky top-0 z-10 transition-colors duration-300',
          darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white/80 border-slate-200'
        )}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Trophy className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className={cn('text-lg sm:text-xl font-bold tracking-tight', darkMode ? 'text-white' : 'text-slate-900')}>
                Basquete Next
              </h1>
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAdminMode ? (
              <button
                onClick={handleAdminActivate}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                )}
                title="Ativar modo administrador"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </button>
            ) : (
              <>
                {activeTab === 'lista' &&
                  (isMatchStarted ? (
                    <button
                      onClick={handleEndMatchAttempt}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        darkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'
                      )}
                    >
                      Encerrar Partida
                    </button>
                  ) : waitingList.length < 10 ? (
                    <button
                      onClick={handleStartMatchAttempt}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        darkMode ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      )}
                    >
                      Iniciar Partida
                    </button>
                  ) : (
                    <span
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg',
                        darkMode ? 'text-slate-500' : 'text-slate-400'
                      )}
                      title="Use o cronômetro na aba Lista (10+ jogadores)"
                    >
                      Use o cronômetro
                    </span>
                  ))}
                <button
                  onClick={resetQueue}
                  className={cn(
                    'transition-colors p-2 rounded-lg',
                    darkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'
                  )}
                  title="Resetar Lista"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={cn(
                'transition-colors p-2 rounded-lg',
                darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-yellow-400' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
              title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {isAdminMode && (
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded-lg',
                  darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                )}
              >
                Admin
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-32">
        {error && (
          <div
            className={cn(
              'border p-3 rounded-xl flex items-center gap-3 text-sm transition-colors duration-300',
              darkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'
            )}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {activeTab === 'inicio' && (
          <>
            {isGuest && (
              <div
                className={cn(
                  'border rounded-xl p-4 flex items-center justify-between gap-4',
                  darkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className={cn('w-5 h-5', darkMode ? 'text-amber-400' : 'text-amber-600')} />
                  <div>
                    <p className={cn('font-semibold text-sm', darkMode ? 'text-amber-200' : 'text-amber-800')}>
                      Você está como visitante
                    </p>
                    <p className={cn('text-xs', darkMode ? 'text-amber-400/80' : 'text-amber-600')}>
                      Cadastre-se para participar do ranking e ter sua tela de perfil.
                    </p>
                  </div>
                </div>
                <button
                  onClick={leaveGuestMode}
                  className="px-4 py-2 rounded-lg font-semibold text-sm bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap"
                >
                  Cadastrar
                </button>
              </div>
            )}
            <RankingView stats={stats} darkMode={darkMode} sortKey={sortKey} onSortChange={setSortKey} />
          </>
        )}

        {activeTab === 'lista' && (
          <div className="relative">
            {!isAdminMode && locationLoading && (
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
            {!isAdminMode && !locationLoading && locationError && (
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
            {!isMatchStarted && waitingList.length < 10 && (
              <div
                className={cn(
                  'mb-6 p-4 rounded-2xl border flex items-center gap-3',
                  darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                )}
              >
                <Users className={cn('w-8 h-8 shrink-0', darkMode ? 'text-orange-400' : 'text-orange-600')} />
                <div>
                  <p className={cn('font-semibold', darkMode ? 'text-slate-200' : 'text-slate-800')}>
                    Adicione seu nome à fila
                  </p>
                  <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Os times (5+5) serão formados automaticamente quando houver 10 jogadores.
                  </p>
                </div>
              </div>
            )}
            {isMatchStarted && waitingList.length < 10 && !isAdminMode && (
              <div
                className={cn(
                  'mb-6 p-4 rounded-2xl border flex items-center gap-3',
                  darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                )}
              >
                <Timer className={cn('w-8 h-8 shrink-0', darkMode ? 'text-slate-500' : 'text-slate-400')} />
                <p className={cn('font-medium', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                  Próxima partida não haverá cronômetro.
                </p>
              </div>
            )}
            {(waitingList.length >= 10 || (isMatchStarted && (timerState.timerRunning || timerStartedOnce))) && (
              <div className={cn('mb-6', !isMatchStarted && 'pointer-events-auto')}>
                <MatchTimer
                  state={timerState}
                  darkMode={darkMode}
                  isAdmin={isAdminMode}
                  onStart={handleTimerStart}
                  onPause={handleTimerPause}
                  onResetRequest={handleTimerResetRequest}
                  onTimeout={handleTimerTimeout}
                  startDisabled={isMatchStarted && (team1.length < 5 || team2.length < 5)}
                  startDisabledReason="O cronômetro só pode ser iniciado com jogadores nos dois times (5 em cada)."
                />
                {pointsBlocked && (
                  <p className={cn('mt-2 text-sm', darkMode ? 'text-amber-400' : 'text-amber-600')}>
                    {isAdminMode ? 'Inicie o cronômetro para liberar a atribuição de pontos.' : 'Aguardando início da partida.'}
                  </p>
                )}
              </div>
            )}
            {waitingList.length >= 10 && !isMatchStarted && (
              <div
                className={cn(
                  'mb-4 p-3 rounded-xl flex items-center gap-3 text-sm',
                  darkMode ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200' : 'bg-amber-50 border border-amber-200 text-amber-800'
                )}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>Os times são formados automaticamente. Inicie o cronômetro para começar a partida.</p>
              </div>
            )}
            {!canSeeList ? (
              <div
                className={cn(
                  'rounded-2xl border p-6 shadow-xl space-y-4',
                  darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className={cn('w-8 h-8 shrink-0', darkMode ? 'text-orange-400' : 'text-orange-600')} />
                  <p className={cn('font-medium', darkMode ? 'text-slate-300' : 'text-slate-700')}>
                    Você está fora do local. Aproxime-se da quadra para ver a lista e entrar na fila.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={cn(
                      'p-4 rounded-xl border text-center',
                      darkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-white border-slate-200'
                    )}
                  >
                    <p className={cn('text-2xl font-black', darkMode ? 'text-white' : 'text-slate-900')}>
                      {team1.length + team2.length}
                    </p>
                    <p className={cn('text-xs font-medium mt-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                      Jogadores em quadra
                    </p>
                  </div>
                  <div
                    className={cn(
                      'p-4 rounded-xl border text-center',
                      darkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-white border-slate-200'
                    )}
                  >
                    <p className={cn('text-2xl font-black', darkMode ? 'text-white' : 'text-slate-900')}>
                      {waitingList.length}
                    </p>
                    <p className={cn('text-xs font-medium mt-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                      Na fila de espera
                    </p>
                  </div>
                </div>
              </div>
            ) : (
            <div
              className={cn(
                'space-y-6 sm:space-y-8',
                !isMatchStarted && waitingList.length >= 10 && 'pointer-events-none select-none opacity-70'
              )}
            >
            {/* Match Section */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8">
              <TeamCard
                title="Time 1"
                players={team1}
                color="blue"
                darkMode={darkMode}
                matchPoints={team1MatchPoints}
                onRemovePlayer={handleRemoveAttempt}
                onPlayerClick={isAdminMode ? setStatsModalPlayer : undefined}
                isAdmin={isAdminMode}
                showWinnerModal={showWinnerModal}
                isLosingTeam={showWinnerModal === 'team2'}
                isWinningTeam={showWinnerModal === 'team1'}
                onStartNext={isAdminMode ? startNextMatch : undefined}
                isStartingNext={isStartingNextMatch}
              />

              <TeamCard
                title="Time 2"
                players={team2}
                color="red"
                darkMode={darkMode}
                matchPoints={team2MatchPoints}
                onRemovePlayer={handleRemoveAttempt}
                onPlayerClick={isAdminMode ? setStatsModalPlayer : undefined}
                isAdmin={isAdminMode}
                showWinnerModal={showWinnerModal}
                isLosingTeam={showWinnerModal === 'team1'}
                isWinningTeam={showWinnerModal === 'team2'}
                onStartNext={isAdminMode ? startNextMatch : undefined}
                isStartingNext={isStartingNextMatch}
              />
            </div>

            {/* Add Player Form */}
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
              <form onSubmit={addPlayer} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  disabled={!canAddToList || (waitingList.length >= 10 && !isMatchStarted)}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={
                    !canAddToList
                      ? 'Aproxime-se da quadra para entrar...'
                      : waitingList.length >= 10 && !isMatchStarted
                        ? 'Times sendo formados...'
                        : isMatchStarted
                          ? 'Seu nome...'
                          : 'Adicione seu nome à fila...'
                  }
                  className={cn(
                    'flex-1 border rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all',
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900',
                    (!canAddToList || (waitingList.length >= 10 && !isMatchStarted)) && 'cursor-not-allowed'
                  )}
                />
                <button
                  type="submit"
                  disabled={!canAddToList || (waitingList.length >= 10 && !isMatchStarted)}
                  className={cn(
                    'px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center gap-2 transition-all active:scale-95 shadow-lg',
                    canAddToList && !(waitingList.length >= 10 && !isMatchStarted)
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  )}
                >
                  <Plus className="w-4 h-4 sm:w-5 h-5" />
                  <span className="hidden xs:inline">Adicionar</span>
                  <span className="xs:hidden">Add</span>
                </button>
              </form>
            </section>

            {/* Waiting List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={cn('text-sm sm:text-lg font-semibold flex items-center gap-2', darkMode ? 'text-slate-400' : 'text-slate-600')}>
                  <Users className="w-4 h-4 sm:w-5 h-5" />
                  Lista de Espera ({waitingList.length})
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                <AnimatePresence mode="popLayout">
                  {waitingList.map((player, index) => (
                    <motion.div
                      key={player.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={cn(
                        'border p-2 sm:p-4 rounded-xl flex items-center justify-between group transition-colors duration-300',
                        darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-2 overflow-hidden flex-1 min-w-0',
                          isAdminMode && 'cursor-pointer'
                        )}
                        onClick={() => isAdminMode && setStatsModalPlayer(player)}
                      >
                        <span className={cn('text-[10px] sm:text-xs font-mono w-4 shrink-0', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                          #{index + 1}
                        </span>
                        <span className={cn('font-medium text-xs sm:text-base truncate', darkMode ? 'text-slate-200' : 'text-slate-800')}>
                          {player.name}
                        </span>
                      </div>
                      {isAdminMode && (
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <div className="flex flex-col">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveAttempt(player.id, 'up'); }}
                            disabled={index === 0}
                            className={cn(
                              'transition-colors',
                              index === 0 ? 'opacity-0 pointer-events-none' : darkMode ? 'text-slate-600 hover:text-orange-400' : 'text-slate-300 hover:text-orange-500'
                            )}
                          >
                            <ChevronUp className="w-3 h-3 sm:w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveAttempt(player.id, 'down'); }}
                            disabled={index === waitingList.length - 1}
                            className={cn(
                              'transition-colors',
                              index === waitingList.length - 1 ? 'opacity-0 pointer-events-none' : darkMode ? 'text-slate-600 hover:text-orange-400' : 'text-slate-300 hover:text-orange-500'
                            )}
                          >
                            <ChevronDown className="w-3 h-3 sm:w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveAttempt(player.id); }}
                          className={cn(
                            'sm:opacity-0 group-hover:opacity-100 transition-all p-1',
                            darkMode ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'
                          )}
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 h-4" />
                        </button>
                      </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {waitingList.length === 0 && (
                  <div
                    className={cn(
                      'col-span-full py-8 text-center text-xs sm:text-sm border-2 border-dashed rounded-2xl transition-colors duration-300',
                      darkMode ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-200'
                    )}
                  >
                    Ninguém na fila. Adicione seu nome acima!
                  </div>
                )}
              </div>
            </section>
            </div>
            )}
          </div>
        )}

        {activeTab === 'eventos' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Calendar className="text-white w-6 h-6" />
              </div>
              <h2 className={cn('text-2xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>Próximos Eventos</h2>
            </div>

            <div className="grid gap-4">
              {[
                { title: 'Torneio de Verão 3x3', date: '25 Mar, 2026', time: '14:00', location: 'Quadra Central', type: 'Torneio' },
                { title: 'Treino Aberto - Iniciantes', date: '28 Mar, 2026', time: '09:00', location: 'Quadra B', type: 'Treino' },
                { title: 'Desafio de Habilidades', date: '02 Abr, 2026', time: '18:30', location: 'Quadra Central', type: 'Desafio' },
              ].map((event, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:scale-[1.02]',
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  )}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{event.type}</span>
                    <h3 className={cn('font-bold text-lg', darkMode ? 'text-white' : 'text-slate-900')}>{event.title}</h3>
                    <div className={cn('flex items-center gap-3 text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {event.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> {event.time}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className={cn('text-sm font-medium', darkMode ? 'text-slate-500' : 'text-slate-400')}>{event.location}</span>
                    <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95">
                      Participar
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="space-y-8">
            {editingProfile && !isGuest ? (
              <EditarPerfil
                darkMode={darkMode}
                onBack={() => setEditingProfile(false)}
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
                    Cadastre-se para acessar seu perfil
                  </h2>
                  <p className={cn('text-sm mb-6 max-w-sm mx-auto', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Com uma conta você participa do ranking, tem sua tela de perfil personalizada e acompanha suas estatísticas.
                  </p>
                  <button
                    onClick={leaveGuestMode}
                    className="px-6 py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <UserPlus className="w-5 h-5" />
                    Fazer cadastro
                  </button>
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
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Partidas', value: '24', icon: <Trophy className="w-4 h-4" /> },
                    { label: 'Vitórias', value: '15', icon: <Trophy className="w-4 h-4 text-yellow-500" /> },
                    { label: 'Pontos', value: '142', icon: <Plus className="w-4 h-4 text-blue-500" /> },
                    { label: 'Ranking', value: '#4', icon: <Trophy className="w-4 h-4 text-orange-500" /> },
                  ].map((stat, i) => (
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

                <div className="space-y-3">
                  <h3 className={cn('font-bold px-1', darkMode ? 'text-slate-400' : 'text-slate-600')}>Configurações</h3>
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
                      onClick={signOut}
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
          darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'
        )}
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-around">
          <NavButton active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} icon={<Home className="w-5 h-5" />} label="Início" darkMode={darkMode} />
          <NavButton active={activeTab === 'lista'} onClick={() => setActiveTab('lista')} icon={<ListIcon className="w-5 h-5" />} label="Lista" darkMode={darkMode} />
          <NavButton active={activeTab === 'eventos'} onClick={() => setActiveTab('eventos')} icon={<Calendar className="w-5 h-5" />} label="Eventos" darkMode={darkMode} />
          <NavButton active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} icon={<User className="w-5 h-5" />} label="Perfil" darkMode={darkMode} />
        </div>
      </nav>

      <footer className={cn('max-w-5xl mx-auto px-4 py-12 text-center text-sm transition-colors duration-300', darkMode ? 'text-slate-600' : 'text-slate-400')}>
        <p>Basquete Next &bull; Sistema de Fila em Tempo Real</p>
      </footer>
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
  showWinnerModal: 'team1' | 'team2' | null;
  isLosingTeam: boolean;
  isWinningTeam: boolean;
  onStartNext?: () => void;
  isStartingNext?: boolean;
}

const slideOut = { x: -200, opacity: 0 };
const slideIn = { x: 0, opacity: 1 };
const slideFromRight = { x: 200, opacity: 0 };

function TeamCard({ title, players, color, darkMode, matchPoints, onRemovePlayer, onPlayerClick, isAdmin, showWinnerModal, isLosingTeam, isWinningTeam, onStartNext, isStartingNext }: TeamCardProps) {
  const bgColor = color === 'blue' ? (darkMode ? 'bg-blue-500/10' : 'bg-blue-50') : (darkMode ? 'bg-red-500/10' : 'bg-red-50');
  const borderColor = color === 'blue' ? (darkMode ? 'border-blue-500/20' : 'border-blue-100') : (darkMode ? 'border-red-500/20' : 'border-red-100');
  const textColor = color === 'blue' ? 'text-blue-500' : 'text-red-500';
  const accentColor = color === 'blue' ? 'bg-blue-500' : 'bg-red-500';

  const showAguarde = !isAdmin && showWinnerModal && isLosingTeam;

  return (
    <div className={cn('relative border rounded-xl sm:rounded-2xl overflow-hidden shadow-xl transition-colors duration-300', bgColor, borderColor)}>
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
                    className={cn('flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0', onPlayerClick && 'cursor-pointer')}
                    onClick={() => onPlayerClick?.(p)}
                  >
                    <div className={cn('w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0', accentColor)} />
                    <span className={cn('font-medium text-xs sm:text-base truncate', darkMode ? 'text-slate-100' : 'text-slate-800')}>{p.name}</span>
                  </div>
                  {isAdmin && (
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
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 py-2 flex flex-col items-center justify-center gap-1 rounded-b-xl font-bold text-xs uppercase tracking-wider',
            'bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/25 dark:text-yellow-400 border-t',
            darkMode ? 'border-yellow-500/30' : 'border-yellow-500/40'
          )}
        >
          <span className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            Vencedor
          </span>
          {isAdmin && onStartNext && (
            <button
              onClick={onStartNext}
              disabled={isStartingNext}
              className={cn(
                'text-[10px] font-normal normal-case px-2 py-0.5 rounded-md transition-colors',
                isStartingNext
                  ? 'opacity-60 cursor-wait'
                  : darkMode ? 'hover:bg-yellow-500/20 text-yellow-400' : 'hover:bg-yellow-500/30 text-yellow-700'
              )}
            >
              {isStartingNext ? 'Iniciando...' : 'Iniciar agora'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  darkMode: boolean;
}

function NavButton({ active, onClick, icon, label, darkMode }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all',
        active ? 'text-orange-500' : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
      )}
    >
      <div className={cn('transition-transform', active && 'scale-110')}>{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-1 h-1 rounded-full bg-orange-500" />}
    </button>
  );
}

interface RankingViewProps {
  stats: PlayerStats[];
  darkMode: boolean;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
}

const layoutTransition = { type: 'spring' as const, stiffness: 350, damping: 30 };

function RankingView({ stats, darkMode, sortKey, onSortChange }: RankingViewProps) {
  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [stats, sortKey]);

  const top3 = sortedStats.slice(0, 3);
  const remaining = sortedStats.slice(3);

  const filterOptions: { key: SortKey; label: string }[] = [
    { key: 'wins', label: 'Vitórias' },
    { key: 'points', label: 'Pontos' },
    { key: 'blocks', label: 'Tocos' },
    { key: 'steals', label: 'Roubos' },
    { key: 'clutch_points', label: 'Decisivos' },
  ];

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Trophy className="text-white w-6 h-6" />
            </div>
            <h2 className={cn('text-2xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>Ranking Geral</h2>
          </div>
        </div>

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

      {/* Podium for Top 3 */}
      <motion.div layout className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-4 pb-2">
        {top3[1] && (
          <motion.div
            layout
            layoutId={`rank-${top3[1].id}`}
            transition={layoutTransition}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-300 rounded-full p-1 shadow-lg">
                <div className={cn('w-full h-full rounded-full flex items-center justify-center', darkMode ? 'bg-slate-900' : 'bg-white')}>
                  <span className={cn('text-xl font-black', darkMode ? 'text-slate-300' : 'text-slate-400')}>2</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-700 border-2 border-white">
                🥈
              </div>
            </div>
            <div className="text-center">
              <p className={cn('font-bold text-xs sm:text-sm truncate max-w-[80px]', darkMode ? 'text-white' : 'text-slate-900')}>{top3[1].name}</p>
              <p className="text-orange-500 font-black text-sm sm:text-lg">{top3[1][sortKey]}</p>
            </div>
            <div className={cn('w-full h-16 sm:h-20 rounded-t-2xl', darkMode ? 'bg-slate-800' : 'bg-slate-200')} />
          </motion.div>
        )}

        {top3[0] && (
          <motion.div
            layout
            layoutId={`rank-${top3[0].id}`}
            transition={layoutTransition}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-yellow-500 rounded-full p-1 shadow-xl ring-4 ring-yellow-500/20">
                <div className={cn('w-full h-full rounded-full flex items-center justify-center', darkMode ? 'bg-slate-900' : 'bg-white')}>
                  <span className={cn('text-2xl font-black', darkMode ? 'text-yellow-500' : 'text-yellow-600')}>1</span>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white shadow-lg">
                👑
              </div>
            </div>
            <div className="text-center">
              <p className={cn('font-bold text-sm sm:text-base truncate max-w-[100px]', darkMode ? 'text-white' : 'text-slate-900')}>{top3[0].name}</p>
              <p className="text-orange-500 font-black text-lg sm:text-2xl">{top3[0][sortKey]}</p>
            </div>
            <div className={cn('w-full h-24 sm:h-32 rounded-t-2xl', darkMode ? 'bg-orange-500/20 border-x border-t border-orange-500/30' : 'bg-orange-500 text-white')} />
          </motion.div>
        )}

        {top3[2] && (
          <motion.div
            layout
            layoutId={`rank-${top3[2].id}`}
            transition={layoutTransition}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-400 rounded-full p-1 shadow-lg">
                <div className={cn('w-full h-full rounded-full flex items-center justify-center', darkMode ? 'bg-slate-900' : 'bg-white')}>
                  <span className={cn('text-lg font-black', darkMode ? 'text-orange-400' : 'text-orange-500')}>3</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white">
                🥉
              </div>
            </div>
            <div className="text-center">
              <p className={cn('font-bold text-xs sm:text-sm truncate max-w-[80px]', darkMode ? 'text-white' : 'text-slate-900')}>{top3[2].name}</p>
              <p className="text-orange-500 font-black text-sm sm:text-lg">{top3[2][sortKey]}</p>
            </div>
            <div className={cn('w-full h-12 sm:h-16 rounded-t-2xl', darkMode ? 'bg-slate-800' : 'bg-slate-200')} />
          </motion.div>
        )}
      </motion.div>

      {/* List for the rest */}
      <motion.div layout className="space-y-3">
        <AnimatePresence mode="popLayout">
          {remaining.map((player, index) => (
            <motion.div
              key={player.id}
              layout
              layoutId={`rank-${player.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={layoutTransition}
              className={cn(
                'p-4 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01]',
                darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs',
                    darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'
                  )}
                >
                  {index + 4}
                </div>
                <div>
                  <h3 className={cn('font-bold', darkMode ? 'text-white' : 'text-slate-900')}>{player.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', darkMode ? 'text-slate-600' : 'text-slate-400')}>
                      {player.wins} Vitórias
                    </span>
                    <span className={cn('w-1 h-1 rounded-full', darkMode ? 'bg-slate-700' : 'bg-slate-200')} />
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', darkMode ? 'text-slate-600' : 'text-slate-400')}>
                      {player.points} Pontos
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-black text-orange-500">{player[sortKey]}</div>
                <div className={cn('text-[9px] uppercase tracking-widest font-bold', darkMode ? 'text-slate-600' : 'text-slate-500')}>
                  {filterOptions.find((o) => o.key === sortKey)?.label}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
