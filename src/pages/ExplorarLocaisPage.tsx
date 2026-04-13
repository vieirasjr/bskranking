import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  Heart,
  Home,
  Lock,
  QrCode,
  ScanLine,
  Share2,
  Shield,
  Smartphone,
  Zap,
  Mail,
  MapPin,
  Search,
  SlidersHorizontal,
  Sun,
  Trophy,
  User,
  X,
  Moon,
  Menu,
  LogOut,
} from 'lucide-react';
import {
  BASKETBALL_FORMAT_OPTIONS,
  BASKETBALL_FORMAT_LABELS,
  avatarTintClass,
  avatarTintIndicesForId,
  type ExploreFilterChip,
} from '../lib/basketballExplore';
import { fetchPublicLocations, matchesLocationSearch, type PublicLocationRow } from '../lib/publicLocations';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

/** Máximo de cards nesta página (lista dos tenants na plataforma). */
const PUBLIC_LOCAIS_DISPLAY_LIMIT = 30;

const FAV_KEY = 'explorar-locais-favoritos';

function loadFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFavs(favs: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}

function passesChip(loc: PublicLocationRow, chip: ExploreFilterChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'tournaments') return !!loc.hosts_tournaments;
  if (chip === 'championships') return !!loc.hosts_championships;
  return (loc.basketball_formats ?? []).includes(chip);
}

function locationSubtitle(loc: PublicLocationRow): string {
  const parts = [loc.city, loc.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return loc.country === 'BR' || !loc.country ? 'Brasil' : (loc.country ?? '');
}

export default function ExplorarLocaisPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [locations, setLocations] = useState<PublicLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ExploreFilterChip>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavs());
  const [loginSheetOpen, setLoginSheetOpen] = useState(false);
  const [loginStep, setLoginStep] = useState<'role' | 'athlete'>('role');
  const [athleteMode, setAthleteMode] = useState<'login' | 'signup'>('login');
  const [athleteEmail, setAthleteEmail] = useState('');
  const [athletePassword, setAthletePassword] = useState('');
  const [athleteLoading, setAthleteLoading] = useState(false);
  const [athleteError, setAthleteError] = useState<string | null>(null);
  const [athleteSuccess, setAthleteSuccess] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [qrSheetOpen, setQrSheetOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('basquete_theme_dark');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return true;
  });
  const [globalRank, setGlobalRank] = useState<Array<{ id: string; name: string; points: number; wins: number }>>([]);
  const [globalEvents, setGlobalEvents] = useState<Array<{ id: string; title: string; event_date: string; event_time: string | null; modality: string; type: string; status: string }>>([]);
  const [globalRankLoading, setGlobalRankLoading] = useState(false);
  const [globalEventsLoading, setGlobalEventsLoading] = useState(false);
  const [globalTab, setGlobalTab] = useState<'inicio' | 'rank' | 'eventos' | 'perfil'>('inicio');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const INSTALL_MODAL_DISMISS_KEY = 'basquete_install_modal_dismissed_at';
  const appShareLink =
    typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://basquetenext.app/';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchPublicLocations();
      if (!cancelled) setLocations(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAppInstalled) return;
    const lastDismiss = Number(localStorage.getItem(INSTALL_MODAL_DISMISS_KEY) ?? '0');
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastDismiss < oneDayMs) return;
    const t = window.setTimeout(() => setShowInstallModal(true), 1200);
    return () => window.clearTimeout(t);
  }, [isAppInstalled]);

  useEffect(() => {
    localStorage.setItem('basquete_theme_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari legacy
      window.navigator.standalone === true;
    setIsAppInstalled(standalone);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileName('');
      setProfileAvatarUrl(null);
      return;
    }
    const fallbackName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Atleta';
    setProfileName(String(fallbackName));
    let cancelled = false;
    supabase
      .from('basquete_users')
      .select('display_name, avatar_url')
      .eq('auth_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.display_name?.trim()) setProfileName(data.display_name.trim());
        setProfileAvatarUrl(data.avatar_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    return locations.filter((loc) => matchesLocationSearch(loc, query) && passesChip(loc, chip));
  }, [locations, query, chip]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [filtered]);

  const displayed = useMemo(() => sorted.slice(0, PUBLIC_LOCAIS_DISPLAY_LIMIT), [sorted]);

  const filterChips: { id: ExploreFilterChip; label: string }[] = [
    { id: 'all', label: 'Todos' },
    ...BASKETBALL_FORMAT_OPTIONS.map((o) => ({ id: o.id as ExploreFilterChip, label: o.label })),
    { id: 'tournaments', label: 'Torneios' },
    { id: 'championships', label: 'Campeonatos' },
  ];

  const openLogin = () => {
    setLoginStep('role');
    setAthleteMode('login');
    setAthleteEmail('');
    setAthletePassword('');
    setAthleteError(null);
    setLoginSheetOpen(true);
  };

  const handleAthleteAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAthleteError(null);
    if (!athleteEmail.trim()) {
      setAthleteError('Informe o email do atleta.');
      return;
    }
    if (!athletePassword) {
      setAthleteError('Informe a senha.');
      return;
    }
    if (athleteMode === 'signup' && athletePassword.length < 6) {
      setAthleteError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setAthleteLoading(true);
    try {
      if (athleteMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: athleteEmail.trim(),
          password: athletePassword,
        });
        if (error) {
          setAthleteError('Não foi possível entrar. Verifique email e senha.');
          return;
        }
        setAthleteSuccess('Login efetuado com sucesso.');
      } else {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: athleteEmail.trim(),
          password: athletePassword,
        });
        if (signUpErr) {
          setAthleteError('Não foi possível cadastrar o atleta.');
          return;
        }
        setAthleteSuccess('Cadastro concluído. Você já está logado(a).');
      }
      setLoginSheetOpen(false);
      setTimeout(() => setAthleteSuccess(null), 3500);
    } finally {
      setAthleteLoading(false);
    }
  };

  const openGlobalRank = async () => {
    setGlobalTab('rank');
    setGlobalRankLoading(true);
    const { data } = await supabase
      .from('stats')
      .select('id, name, points, wins')
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(100);
    setGlobalRank((data ?? []) as Array<{ id: string; name: string; points: number; wins: number }>);
    setGlobalRankLoading(false);
  };

  const openGlobalEvents = async () => {
    setGlobalTab('eventos');
    setGlobalEventsLoading(true);
    const { data } = await supabase
      .from('eventos')
      .select('id, title, event_date, event_time, modality, type, status')
      .in('status', ['open', 'in_progress'])
      .order('event_date', { ascending: true })
      .limit(100);
    setGlobalEvents((data ?? []) as Array<{ id: string; title: string; event_date: string; event_time: string | null; modality: string; type: string; status: string }>);
    setGlobalEventsLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    if (globalTab === 'rank' && globalRank.length === 0 && !globalRankLoading) {
      void openGlobalRank();
    }
    if (globalTab === 'eventos' && globalEvents.length === 0 && !globalEventsLoading) {
      void openGlobalEvents();
    }
  }, [globalTab, user]);

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Basquete Next', text: 'Quadras e locais', url: appShareLink });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(appShareLink);
        setShareFeedback('Link copiado.');
        setTimeout(() => setShareFeedback(null), 2200);
      }
    } catch {
      // usuário cancelou compartilhamento
    }
  };

  const handleOpenInitialApp = () => {
    if (isAppInstalled) {
      window.location.assign('/');
      return;
    }
    setShowInstallModal(true);
  };

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) {
      localStorage.setItem(INSTALL_MODAL_DISMISS_KEY, String(Date.now()));
      setShowInstallModal(false);
      return;
    }
    await deferredInstallPrompt.prompt();
    setDeferredInstallPrompt(null);
    localStorage.setItem(INSTALL_MODAL_DISMISS_KEY, String(Date.now()));
    setShowInstallModal(false);
  };

  const dismissInstallModal = () => {
    localStorage.setItem(INSTALL_MODAL_DISMISS_KEY, String(Date.now()));
    setShowInstallModal(false);
  };

  const handleGlobalSignOut = async () => {
    await signOut();
    setHeaderMenuOpen(false);
    navigate('/locais', { replace: true });
  };

  const LocationCard = ({ loc }: { loc: PublicLocationRow }) => {
    const fav = favorites.has(loc.id);
    const formats = loc.basketball_formats ?? [];
    const primaryTag =
      formats.length > 0 ? BASKETBALL_FORMAT_LABELS[formats[0]] ?? formats[0] : 'Basquete';
    const tintIdx = avatarTintIndicesForId(loc.id);
    const sub = locationSubtitle(loc);
    const nameParts = loc.name.trim().split(/\s+/).filter(Boolean);
    const initials = [
      (nameParts[0]?.[0] ?? '?').toUpperCase(),
      (nameParts[1]?.[0] ?? '·').toUpperCase(),
      (nameParts[2]?.[0] ?? '·').toUpperCase(),
    ];

    const goDetail = () => {
      if (loc.is_private) return;
      localStorage.setItem('basquete_last_location_slug', loc.slug);
      navigate(`/locais/${loc.slug}`);
    };
    const goTenantDirect = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (loc.is_private) return;
      localStorage.setItem('basquete_last_location_slug', loc.slug);
      navigate(`/${loc.slug}`);
    };

    return (
      <motion.div
        layout
        role="button"
        tabIndex={0}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={goDetail}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goDetail();
          }
        }}
        className={`text-left rounded-[22px] border border-slate-700/70 bg-slate-900/60 overflow-hidden shadow-xl shadow-black/30 group transition-all ${
          loc.is_private ? 'cursor-not-allowed opacity-85' : 'cursor-pointer hover:border-orange-500/35 hover:bg-slate-800/50'
        }`}
      >
        <div className="aspect-[16/10] w-full overflow-hidden bg-slate-800 relative">
          {loc.image_url ? (
            <img
              src={loc.image_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#ff8a4c]/25 to-slate-950">
              <MapPin className="w-14 h-14 text-orange-400/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white flex items-center gap-1.5 max-w-[85%]">
            <Trophy className="w-3.5 h-3.5 text-[#ff8a4c] shrink-0" />
            <span className="truncate">{primaryTag}</span>
          </span>
          {loc.is_private && (
            <span className="absolute top-3 left-[120px] px-2.5 py-1 rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30 text-[10px] font-bold text-red-200">
              Restrito
            </span>
          )}
          <button
            type="button"
            onClick={(e) => toggleFavorite(loc.id, e)}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/55 transition-colors z-[1]"
            aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'}
          >
            <Heart className={`w-4 h-4 ${fav ? 'fill-[#ff8a4c] text-[#ff8a4c]' : 'text-white'}`} />
          </button>
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-white font-black text-lg leading-tight drop-shadow-lg line-clamp-2">{loc.name}</h3>
          </div>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#ff8a4c]/90" />
            <span className="truncate">{sub}</span>
          </div>
          {loc.opening_hours_note && (
            <div className="flex items-start gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{loc.opening_hours_note}</span>
            </div>
          )}
          {loc.description && (
            <p className="text-sm text-slate-400 line-clamp-2 leading-snug">{loc.description}</p>
          )}
          {(loc.hosts_tournaments || loc.hosts_championships) && (
            <p className="text-[10px] font-bold text-amber-400/95">
              {loc.hosts_tournaments && loc.hosts_championships
                ? 'Torneios e campeonatos'
                : loc.hosts_tournaments
                  ? 'Torneios'
                  : 'Campeonatos'}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex -space-x-2">
              {tintIdx.map((ti, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full border-2 border-slate-900 ${avatarTintClass(ti)} flex items-center justify-center text-[10px] font-bold text-white`}
                >
                  {initials[i]}
                </div>
              ))}
            </div>
            {loc.tenant?.name && (
              <span className="text-[11px] font-medium text-slate-500 truncate max-w-[45%]">{loc.tenant.name}</span>
            )}
          </div>
          {user && (
            <button
              type="button"
              onClick={goTenantDirect}
              disabled={loc.is_private}
              className={`w-full mt-2 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                loc.is_private ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              {loc.is_private ? 'Acesso restrito' : 'Entrar no local'}
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`min-h-screen pb-24 ${darkMode ? 'bg-[#07090f] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${darkMode ? 'border-slate-800/80 bg-[#07090f]/92' : 'border-slate-200 bg-white/92'}`}>
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {user && (
              <>
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt={profileName} className="w-9 h-9 rounded-full object-cover border border-slate-600" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-300">
                    {(profileName?.[0] ?? 'A').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Atleta logado</p>
                  <p className={`text-sm font-semibold truncate max-w-[180px] ${darkMode ? 'text-white' : 'text-slate-900'}`}>{profileName}</p>
                </div>
              </>
            )}
          </div>
          <div className="justify-self-center" />
          <div className="justify-self-end relative">
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen((v) => !v)}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
                    darkMode
                      ? 'bg-slate-800/90 border-slate-700/70 text-slate-200 hover:bg-slate-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-label="Abrir menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
                {headerMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-xl p-2 z-20 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <button
                      type="button"
                      onClick={() => { setQrSheetOpen(true); setHeaderMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      QR do app
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDarkMode((v) => !v); setHeaderMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      {darkMode ? 'Modo claro' : 'Modo escuro'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleOpenInitialApp(); setHeaderMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      Abrir app inicial
                    </button>
                    <button
                      type="button"
                      onClick={handleGlobalSignOut}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 inline-flex items-center justify-between"
                    >
                      Sair da conta <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {athleteSuccess && (
          <p className="max-w-5xl mx-auto px-4 pb-2 text-xs text-emerald-300">{athleteSuccess}</p>
        )}
        {shareFeedback && (
          <p className="max-w-5xl mx-auto px-4 pb-2 text-xs text-orange-300">{shareFeedback}</p>
        )}

        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ff8a4c]/80 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome do local, cidade, bairro, UF..."
              className={`w-full pl-12 pr-4 py-3.5 rounded-[20px] border focus:outline-none focus:ring-2 focus:ring-[#ff8a4c]/40 focus:border-[#ff8a4c]/35 text-[15px] ${
                darkMode
                  ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder:text-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="shrink-0 w-14 h-[52px] rounded-[20px] bg-[#ff8a4c]/72 hover:bg-[#ff8a4c]/86 flex items-center justify-center shadow-lg shadow-[#ff8a4c]/15 transition-colors"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">Modalidades</span>
            <button
              type="button"
              onClick={() => setChip('all')}
              className="text-xs font-semibold text-[#ff8a4c] hover:underline"
            >
              Limpar filtros
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {filterChips.map((c) => {
              const active = chip === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChip(c.id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    active
                      ? 'bg-[#ff8a4c]/20 border-[#ff8a4c]/50 text-[#ff8a4c]'
                      : 'bg-slate-900/50 border-slate-700/60 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-2 space-y-8">
        {globalTab === 'inicio' && (loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-[#ff8a4c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-700 bg-slate-900/40">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              {locations.length === 0
                ? 'Nenhum local de tenant cadastrado.'
                : 'Nenhum resultado — ajuste a busca ou o filtro.'}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-4 text-sm text-[#ff8a4c] font-semibold hover:underline"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-black text-white">Locais</h2>
              <span className="text-xs text-slate-500">
                {displayed.length}
                {sorted.length > PUBLIC_LOCAIS_DISPLAY_LIMIT
                  ? ` de ${sorted.length} (limite ${PUBLIC_LOCAIS_DISPLAY_LIMIT} na tela)`
                  : ` local${displayed.length === 1 ? '' : 'ais'}`}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayed.map((loc) => (
                <LocationCard key={loc.id} loc={loc} />
              ))}
            </div>
          </section>
        ))}

        {globalTab === 'rank' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-white">Rank global</h2>
              <span className="text-xs text-slate-500">Todos os tenants</span>
            </div>
            {globalRankLoading ? (
              <div className="py-10 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : globalRank.length === 0 ? (
              <p className="text-sm text-slate-400">Sem dados de ranking global no momento.</p>
            ) : (
              <div className="space-y-2">
                {globalRank.map((a, idx) => (
                  <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">#{idx + 1}</p>
                      <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-orange-300 font-bold">{a.points ?? 0} pts</p>
                      <p className="text-slate-400">{a.wins ?? 0} vitórias</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {globalTab === 'eventos' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-white">Eventos globais</h2>
              <span className="text-xs text-slate-500">Todos os tenants</span>
            </div>
            {globalEventsLoading ? (
              <div className="py-10 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : globalEvents.length === 0 ? (
              <p className="text-sm text-slate-400">Sem eventos globais abertos no momento.</p>
            ) : (
              <div className="space-y-2">
                {globalEvents.map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                    <p className="text-sm font-semibold text-white">{ev.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{ev.event_date}{ev.event_time ? ` · ${ev.event_time}` : ''}</p>
                    <p className="text-xs text-orange-300 mt-1">{ev.type} · {ev.modality} · {ev.status}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {globalTab === 'perfil' && (
          <section className="max-w-md">
            {!user ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                <p className="text-slate-300 text-sm">Faça login para acessar seu perfil global.</p>
                <button onClick={openLogin} className="mt-3 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold">Entrar</button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                <div className="flex items-center gap-3">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={profileName} className="w-12 h-12 rounded-full object-cover border border-slate-600" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm font-bold text-orange-300">
                      {(profileName?.[0] ?? 'A').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold">{profileName}</p>
                    <p className="text-xs text-slate-400">Perfil global</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGlobalSignOut}
                  className="mt-4 w-full py-2.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-sm font-semibold"
                >
                  Sair da conta
                </button>
              </div>
            )}
          </section>
        )}

      </main>

      <AnimatePresence>
        {filterSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Fechar"
              onClick={() => setFilterSheetOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h3 className="font-black text-lg">Filtros</h3>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-2 max-h-[50vh] overflow-y-auto">
                {filterChips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setChip(c.id);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-colors ${
                      chip === c.id
                        ? 'border-[#ff8a4c]/50 bg-[#ff8a4c]/10 text-white'
                        : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="font-semibold">{c.label}</span>
                    {chip === c.id && <span className="text-[#ff8a4c] text-xs font-bold">Ativo</span>}
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChip('all');
                    setFilterSheetOpen(false);
                  }}
                  className="flex-1 py-3 rounded-2xl font-bold border border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-bold bg-[#ff8a4c] hover:bg-[#ff7a38] text-white"
                >
                  Aplicar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          >
            <button type="button" className="absolute inset-0 bg-black/70" onClick={dismissInstallModal} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5"
            >
              <h3 className="text-lg font-black text-white">Instalar Basquete Next</h3>
              <p className="text-sm text-slate-300 mt-2">Aplicativo seguro, rapido e com melhor experiencia para acompanhar jogos e ranking.</p>
              <div className="mt-3 space-y-2 text-xs text-slate-400">
                <p className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> Seguro e confiavel</p>
                <p className="flex items-center gap-2"><Zap className="w-4 h-4 text-orange-400" /> Carregamento mais rapido</p>
                <p className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-sky-400" /> Melhor experiencia em tela cheia</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={dismissInstallModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                >
                  Agora nao
                </button>
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold"
                >
                  Instalar app
                </button>
              </div>
              {!deferredInstallPrompt && (
                <p className="text-[11px] text-slate-500 mt-3">
                  Se estiver no iPhone/iPad: Safari &gt; Compartilhar &gt; Adicionar a Tela de Inicio.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {loginSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Fechar login"
              onClick={() => setLoginSheetOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-white">
                  {loginStep === 'role' ? 'Como deseja entrar?' : athleteMode === 'login' ? 'Login de atleta' : 'Cadastro de atleta'}
                </h3>
                <button
                  type="button"
                  onClick={() => setLoginSheetOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loginStep === 'role' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAthleteMode('login');
                      setLoginStep('athlete');
                    }}
                    className="w-full text-left p-4 rounded-2xl border border-slate-700 bg-slate-800/50 hover:border-orange-500/40"
                  >
                    <p className="font-bold text-white">Sou atleta</p>
                    <p className="text-xs text-slate-400 mt-1">Entrar ou criar conta de atleta.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginSheetOpen(false);
                      navigate('/landing');
                    }}
                    className="w-full text-left p-4 rounded-2xl border border-slate-700 bg-slate-800/50 hover:border-emerald-500/40 transition-all"
                  >
                    <p className="font-bold text-white">Sou gestor</p>
                    <p className="text-xs text-slate-400 mt-1">Ir para a landing page do gestor.</p>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAthleteAuth} className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAthleteMode('login')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        athleteMode === 'login'
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                          : 'bg-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setAthleteMode('signup')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        athleteMode === 'signup'
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                          : 'bg-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      Cadastrar
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-xs text-slate-400">Email</span>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={athleteEmail}
                        onChange={(e) => setAthleteEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60"
                        placeholder="atleta@email.com"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Senha</span>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={athletePassword}
                        onChange={(e) => setAthletePassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60"
                        placeholder="******"
                      />
                    </div>
                  </label>
                  {athleteMode === 'signup' && <p className="text-xs text-white/40">Mínimo 6 caracteres</p>}
                  {athleteError && (
                    <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{athleteError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLoginStep('role')}
                      className="px-4 py-3 rounded-xl bg-white/10 text-white/70 hover:text-white hover:bg-white/15 text-sm font-semibold transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={athleteLoading}
                      className="flex-1 py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white transition-all disabled:opacity-50 shadow-lg shadow-orange-500/40"
                    >
                      {athleteLoading ? 'Enviando...' : athleteMode === 'login' ? 'Entrar como atleta' : 'Cadastrar atleta'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {qrSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          >
            <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setQrSheetOpen(false)} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-white">Compartilhar aplicativo</h3>
                <button onClick={() => setQrSheetOpen(false)} className="p-2 rounded-xl hover:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="rounded-2xl bg-white p-3 w-fit mx-auto">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(appShareLink)}`}
                  alt="QR Code do aplicativo"
                  className="w-52 h-52"
                />
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center break-all">{appShareLink}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.open('https://webqr.com/', '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold"
                >
                  <ScanLine className="w-4 h-4" /> Scanner
                </button>
                <button
                  type="button"
                  onClick={shareLink}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-bold"
                >
                  <Share2 className="w-4 h-4" /> Compartilhar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {user && (
        <nav
          className={`fixed bottom-0 left-0 right-0 border-t backdrop-blur-lg z-50 transition-colors duration-300 ${
            darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-around">
            <button
              type="button"
              onClick={() => setGlobalTab('inicio')}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
                globalTab === 'inicio'
                  ? (darkMode ? 'text-orange-400' : 'text-orange-500')
                  : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-0.5">Início</span>
            </button>
            <button
              type="button"
              onClick={() => setGlobalTab('rank')}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
                globalTab === 'rank'
                  ? (darkMode ? 'text-orange-400' : 'text-orange-500')
                  : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
              }`}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5">Rank</span>
            </button>
            <button
              type="button"
              onClick={() => setGlobalTab('eventos')}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
                globalTab === 'eventos'
                  ? (darkMode ? 'text-orange-400' : 'text-orange-500')
                  : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5">Eventos</span>
            </button>
            <button
              type="button"
              onClick={() => setGlobalTab('perfil')}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
                globalTab === 'perfil'
                  ? (darkMode ? 'text-orange-400' : 'text-orange-500')
                  : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5">Perfil</span>
            </button>
          </div>
        </nav>
      )}

      {!user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[60px] pt-8 bg-gradient-to-t from-[#07090f] via-[#07090f]/95 to-transparent">
          <div className="max-w-5xl mx-auto flex justify-center">
            <button
              type="button"
              onClick={openLogin}
              className="w-[80vw] max-w-[520px] h-14 rounded-2xl bg-[#ff8a4c] hover:bg-[#ff7a38] text-white font-black text-base shadow-[0_12px_34px_rgba(255,138,76,0.45)] transition-all active:scale-[0.99] inline-flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
