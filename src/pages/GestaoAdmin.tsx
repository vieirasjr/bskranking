import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Search,
  User,
  Check,
  X,
  Loader2,
  Pencil,
  ChevronRight,
  Trophy,
  Shield,
  Target,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../supabase';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

// ─── tipos ────────────────────────────────────────────────────────────────────

interface StatRow {
  id: string;
  user_id: string | null;
  name: string;
  partidas?: number;
  wins: number;
  points: number;
  blocks: number;
  steals: number;
  clutch_points: number;
  assists: number;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  player_code: string | null;
  email: string | null;
  position: string | null;
  jersey_number: number | null;
  bio: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  city: string | null;
  state: string | null;
}

// Item unificado para a lista (ranking ou busca em basquete_users)
interface PlayerListItem {
  basqueteUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  playerCode: string | null;
  email: string | null;
  stat: StatRow | null;
  rankPosition: number | null; // null = não está no ranking
}

interface GestaoAdminProps {
  stats: StatRow[];
  userAvatars: Record<string, string>;
  darkMode: boolean;
  onClose: () => void;
  onStatsUpdated: () => void;
}

// ─── campo editável inline ────────────────────────────────────────────────────

type FieldStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

interface EditableFieldProps {
  label: string;
  value: string | number | null;
  type?: 'number' | 'text' | 'textarea';
  min?: number;
  darkMode: boolean;
  onSave: (newValue: string) => Promise<void>;
  icon?: React.ReactNode;
  unit?: string;
}

function EditableField({ label, value, type = 'text', min = 0, darkMode, onSave, icon, unit }: EditableFieldProps) {
  const [status, setStatus] = useState<FieldStatus>('idle');
  const [draft, setDraft] = useState(String(value ?? ''));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // sync when value changes externally
  useEffect(() => {
    if (status === 'idle') setDraft(String(value ?? ''));
  }, [value, status]);

  const startEdit = () => {
    setDraft(String(value ?? ''));
    setStatus('editing');
    setErrorMsg(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const cancel = () => {
    setStatus('idle');
    setErrorMsg(null);
  };

  const confirm = useCallback(async () => {
    if (status !== 'editing') return;
    const trimmed = draft.trim();
    if (type === 'number') {
      const n = Number(trimmed);
      if (isNaN(n) || n < min) {
        setErrorMsg(`Mínimo ${min}`);
        return;
      }
    }
    setStatus('saving');
    setErrorMsg(null);
    try {
      await onSave(trimmed);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1800);
    } catch {
      setStatus('error');
      setErrorMsg('Erro ao salvar.');
      setTimeout(() => setStatus('editing'), 2000);
    }
  }, [status, draft, type, min, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') cancel();
  };

  const displayValue = value === null || value === '' ? '—' : `${value}${unit ? ` ${unit}` : ''}`;

  return (
    <div
      className={cn(
        'group flex items-center justify-between px-4 py-3 border-b last:border-b-0 transition-colors',
        darkMode ? 'border-slate-800' : 'border-slate-100',
        status === 'idle' && 'cursor-pointer',
        status === 'idle' && (darkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50')
      )}
      onClick={status === 'idle' ? startEdit : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon && <span className={cn('shrink-0', darkMode ? 'text-slate-500' : 'text-slate-400')}>{icon}</span>}
        <span className={cn('text-sm font-medium shrink-0', darkMode ? 'text-slate-400' : 'text-slate-500')}>{label}</span>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {status === 'editing' ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {type === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className={cn(
                  'w-40 text-sm px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none',
                  darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                min={type === 'number' ? min : undefined}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'w-24 text-sm text-right px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                  darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            )}
            {errorMsg && <span className="text-xs text-red-400">{errorMsg}</span>}
            <button
              onClick={confirm}
              className="w-7 h-7 rounded-lg bg-green-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-green-600 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancel}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                darkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : status === 'saving' ? (
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        ) : status === 'saved' ? (
          <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
            <Check className="w-3.5 h-3.5" /> Salvo
          </span>
        ) : status === 'error' ? (
          <span className="text-xs text-red-400">{errorMsg}</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-semibold', darkMode ? 'text-white' : 'text-slate-900')}>{displayValue}</span>
            <Pencil className={cn(
              'w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0',
              darkMode ? 'text-slate-400' : 'text-slate-500'
            )} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── tela de detalhe do jogador ───────────────────────────────────────────────

interface PlayerDetailProps {
  item: PlayerListItem;
  darkMode: boolean;
  onBack: () => void;
  onStatsUpdated: () => void;
}

function PlayerDetail({ item, darkMode, onBack, onStatsUpdated }: PlayerDetailProps) {
  const [stat, setStat] = useState<StatRow | null>(item.stat);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    setLoadingProfile(true);
    supabase
      .from('basquete_users')
      .select('id, display_name, avatar_url, player_code, email, position, jersey_number, bio, height_cm, weight_kg, city, state')
      .eq('id', item.basqueteUserId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data ?? null);
        setLoadingProfile(false);
      });
  }, [item.basqueteUserId]);

  const saveStat = async (field: string, rawValue: string) => {
    const numValue = Number(rawValue);

    if (stat) {
      // Jogador já está no ranking — atualiza direto pelo id
      const { error } = await supabase
        .from('stats')
        .update({ [field]: numValue })
        .eq('id', stat.id);
      if (error) throw error;
      setStat(prev => prev ? { ...prev, [field]: numValue } : prev);
    } else {
      // Jogador ainda não tem stats — insere e guarda o id retornado
      const newRow: Record<string, unknown> = {
        name: item.displayName ?? 'Jogador',
        user_id: item.basqueteUserId,
        wins: 0, points: 0,
        blocks: 0, steals: 0, clutch_points: 0,
        [field]: numValue,
      };
      const { error: insErr } = await supabase
        .from('stats')
        .insert(newRow);
      if (insErr) throw insErr;
      // Constrói o estado local sem depender do retorno do banco
      setStat({
        id: '',
        user_id: item.basqueteUserId,
        name: item.displayName ?? 'Jogador',
        wins: 0, points: 0,
        blocks: 0, steals: 0, clutch_points: 0, assists: 0,
        [field]: numValue,
      } as StatRow);
    }

    onStatsUpdated();
  };

  const saveProfile = async (field: string, rawValue: string) => {
    if (!profile) throw new Error('no profile');
    const isNum = ['jersey_number', 'height_cm', 'weight_kg'].includes(field);
    const value = isNum ? (rawValue === '' ? null : Number(rawValue)) : rawValue || null;
    const { error } = await supabase
      .from('basquete_users')
      .update({ [field]: value })
      .eq('id', profile.id);
    if (error) throw error;
    setProfile((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const statFields: { field: string; label: string; icon: React.ReactNode }[] = [
    { field: 'wins', label: 'Vitórias', icon: <Trophy className="w-4 h-4 text-yellow-500" /> },
    { field: 'points', label: 'Pontos', icon: <Target className="w-4 h-4 text-blue-500" /> },
    { field: 'assists', label: 'Assistências', icon: <Zap className="w-4 h-4 text-cyan-500" /> },
    { field: 'blocks', label: 'Tocos', icon: <Shield className="w-4 h-4 text-amber-500" /> },
    { field: 'steals', label: 'Roubos', icon: <Target className="w-4 h-4 text-purple-500" /> },
    { field: 'clutch_points', label: 'Pontos Decisivos', icon: <Zap className="w-4 h-4 text-red-500" /> },
  ];

  const profileFields: { field: string; label: string; type?: 'number' | 'text' | 'textarea'; unit?: string; min?: number }[] = [
    { field: 'display_name', label: 'Nome de exibição' },
    { field: 'position', label: 'Posição' },
    { field: 'jersey_number', label: 'Número da camisa', type: 'number', min: 0 },
    { field: 'height_cm', label: 'Altura', type: 'number', min: 100, unit: 'cm' },
    { field: 'weight_kg', label: 'Peso', type: 'number', min: 30, unit: 'kg' },
    { field: 'city', label: 'Cidade' },
    { field: 'bio', label: 'Bio', type: 'textarea' },
  ];

  const name = item.displayName ?? stat?.name ?? 'Jogador';
  const partidas = stat?.partidas ?? 0;
  const wins = stat?.wins ?? 0;
  const winRate = partidas > 0 ? Math.round((wins / partidas) * 100) : 0;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="absolute inset-0 flex flex-col overflow-hidden"
    >
      {/* top bar */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 border-b shrink-0',
        darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
      )}>
        <button
          onClick={onBack}
          className={cn(
            'p-2 -ml-2 rounded-xl transition-colors',
            darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          )}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className={cn('font-bold text-base truncate', darkMode ? 'text-white' : 'text-slate-900')}>
          {name}
        </span>
        {item.playerCode && (
          <span className={cn(
            'ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded-lg shrink-0',
            darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
          )}>
            #{item.playerCode}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* hero */}
        <div className={cn(
          'px-4 py-5 flex items-center gap-4 border-b',
          darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
        )}>
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-tr from-orange-500 to-yellow-400 p-[2px] shrink-0">
            <div className={cn('w-full h-full rounded-full overflow-hidden flex items-center justify-center', darkMode ? 'bg-slate-900' : 'bg-white')}>
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className={cn('w-7 h-7', darkMode ? 'text-slate-600' : 'text-slate-300')} />
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className={cn('font-bold text-lg truncate', darkMode ? 'text-white' : 'text-slate-900')}>{name}</p>
            {item.email && (
              <p className={cn('text-xs truncate', darkMode ? 'text-slate-400' : 'text-slate-500')}>{item.email}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {stat ? (
                <span className={cn('text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {partidas} partidas · {winRate}% vitórias
                </span>
              ) : (
                <span className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                  Sem estatísticas ainda
                </span>
              )}
              {item.rankPosition !== null && (
                <span className={cn('text-xs font-bold', darkMode ? 'text-orange-400' : 'text-orange-600')}>
                  #{item.rankPosition}º no ranking
                </span>
              )}
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="px-4 pt-5 pb-2">
          <p className={cn('text-[11px] font-bold uppercase tracking-widest', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            Estatísticas
          </p>
        </div>
        <div className={cn('mx-4 rounded-2xl border overflow-hidden', darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          {statFields.map(({ field, label, icon }) => (
            <EditableField
              key={field}
              label={label}
              value={(stat as Record<string, number> | null)?.[field] ?? 0}
              type="number"
              min={0}
              darkMode={darkMode}
              icon={icon}
              onSave={(v) => saveStat(field, v)}
            />
          ))}
        </div>

        {/* perfil */}
        <div className="px-4 pt-5 pb-2">
          <p className={cn('text-[11px] font-bold uppercase tracking-widest', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            Perfil
          </p>
        </div>
        {loadingProfile ? (
          <div className="flex justify-center py-6 mb-8">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          </div>
        ) : profile ? (
          <div className={cn('mx-4 mb-8 rounded-2xl border overflow-hidden', darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
            {profileFields.map(({ field, label, type, unit, min }) => (
              <EditableField
                key={field}
                label={label}
                value={(profile as Record<string, string | number | null>)[field]}
                type={type}
                min={min}
                unit={unit}
                darkMode={darkMode}
                onSave={(v) => saveProfile(field, v)}
              />
            ))}
          </div>
        ) : (
          <div className={cn('mx-4 mb-8 flex items-center gap-2 text-sm px-4 py-3 rounded-2xl border', darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400')}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            Perfil não encontrado.
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── tela principal de gestão ─────────────────────────────────────────────────

export default function GestaoAdmin({ stats, userAvatars, darkMode, onClose, onStatsUpdated }: GestaoAdminProps) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PlayerListItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  // Converte um stat do ranking para PlayerListItem
  const statToItem = useCallback((stat: StatRow, rankPos: number): PlayerListItem => ({
    basqueteUserId: stat.user_id ?? stat.id,
    displayName: stat.name,
    avatarUrl: stat.user_id ? (userAvatars[stat.user_id] ?? null) : null,
    playerCode: null, // não temos o código aqui, PlayerDetail faz o fetch completo
    email: null,
    stat,
    rankPosition: rankPos,
  }), [userAvatars]);

  // Top 10 do ranking para exibição padrão
  const top10: PlayerListItem[] = stats.slice(0, 10).map((s, i) => statToItem(s, i + 1));

  // Busca em basquete_users com debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const term = search.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('basquete_users')
          .select('id, display_name, avatar_url, player_code, email')
          .or(`display_name.ilike.%${term}%,email.ilike.%${term}%`)
          .order('display_name')
          .limit(20);

        const results: PlayerListItem[] = (data ?? []).map((u) => {
          // verifica se esse usuário está no ranking
          const statIdx = stats.findIndex((s) => s.user_id === u.id);
          const stat = statIdx >= 0 ? stats[statIdx] : null;
          return {
            basqueteUserId: u.id,
            displayName: u.display_name,
            avatarUrl: u.avatar_url ?? (u.id ? (userAvatars[u.id] ?? null) : null),
            playerCode: u.player_code,
            email: u.email,
            stat,
            rankPosition: statIdx >= 0 ? statIdx + 1 : null,
          };
        });

        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, stats, userAvatars]);

  const displayList = search.trim() ? searchResults : top10;
  const isDefaultView = !search.trim();

  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col', darkMode ? 'bg-slate-950' : 'bg-slate-50')}>
      <AnimatePresence mode="wait">
        {selectedItem ? (
          <PlayerDetail
            key={selectedItem.basqueteUserId}
            item={selectedItem}
            darkMode={darkMode}
            onBack={() => setSelectedItem(null)}
            onStatsUpdated={onStatsUpdated}
          />
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* header */}
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 border-b shrink-0',
              darkMode ? 'border-slate-800 bg-slate-900' : 'border-white bg-white shadow-sm'
            )}>
              <button
                onClick={onClose}
                className={cn(
                  'p-2 -ml-2 rounded-xl transition-colors shrink-0',
                  darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className={cn('font-bold text-lg', darkMode ? 'text-white' : 'text-slate-900')}>
                Gestão de Jogadores
              </h2>
              <span className={cn(
                'ml-auto text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
              )}>
                {stats.length} no ranking
              </span>
            </div>

            {/* search */}
            <div className={cn('px-4 py-3 border-b shrink-0', darkMode ? 'border-slate-800' : 'border-slate-200')}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  className={cn(
                    'w-full pl-10 pr-9 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all',
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  )}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-orange-500" />
                )}
                {search && !isSearching && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* section label */}
            <div className={cn('px-4 py-2 shrink-0', darkMode ? 'bg-slate-900/50' : 'bg-slate-50')}>
              <p className={cn('text-[11px] font-bold uppercase tracking-widest', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                {isDefaultView ? 'Top 10 ranking' : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto">
              {!isDefaultView && !isSearching && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <Search className={cn('w-8 h-8', darkMode ? 'text-slate-700' : 'text-slate-300')} />
                  <p className={cn('text-sm', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                    Nenhum jogador encontrado.
                  </p>
                  <p className={cn('text-xs', darkMode ? 'text-slate-600' : 'text-slate-400')}>
                    Busque por nome ou email cadastrado.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayList.map((item, i) => (
                    <motion.button
                      key={item.basqueteUserId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-colors',
                        darkMode
                          ? 'border-slate-800 hover:bg-slate-800/60 active:bg-slate-800'
                          : 'border-slate-100 hover:bg-white active:bg-slate-50'
                      )}
                    >
                      {/* avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-orange-500 to-yellow-400 p-[2px] shrink-0">
                        <div className={cn('w-full h-full rounded-full overflow-hidden flex items-center justify-center', darkMode ? 'bg-slate-900' : 'bg-white')}>
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className={cn('w-5 h-5', darkMode ? 'text-slate-600' : 'text-slate-300')} />
                          )}
                        </div>
                      </div>

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('font-semibold text-sm truncate', darkMode ? 'text-white' : 'text-slate-900')}>
                            {item.displayName ?? item.email ?? 'Sem nome'}
                          </p>
                          {item.playerCode && (
                            <span className={cn(
                              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0',
                              darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                            )}>
                              {item.playerCode}
                            </span>
                          )}
                        </div>
                        <div className={cn('flex items-center gap-2 mt-0.5 text-xs flex-wrap', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                          {item.stat ? (
                            <>
                              <span>{item.stat.partidas} jogos</span>
                              <span>·</span>
                              <span>{item.stat.wins} vitórias</span>
                              <span>·</span>
                              <span>{item.stat.points} pts</span>
                            </>
                          ) : (
                            <span>{item.email ?? ''}</span>
                          )}
                        </div>
                      </div>

                      {/* rank / sem ranking */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.rankPosition !== null ? (
                          <div className="flex flex-col items-end">
                            <span className={cn('text-sm font-bold', darkMode ? 'text-orange-400' : 'text-orange-600')}>
                              #{item.rankPosition}
                            </span>
                            <span className={cn('text-[10px]', darkMode ? 'text-slate-600' : 'text-slate-400')}>rank</span>
                          </div>
                        ) : (
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
                            darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                          )}>
                            sem rank
                          </span>
                        )}
                        <ChevronRight className={cn('w-4 h-4', darkMode ? 'text-slate-600' : 'text-slate-400')} />
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              )}

              {/* hint quando exibindo top 10 */}
              {isDefaultView && stats.length > 10 && (
                <div className={cn('px-4 py-4 text-center text-xs', darkMode ? 'text-slate-600' : 'text-slate-400')}>
                  {stats.length - 10} jogadores adicionais — use a busca para encontrá-los
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
