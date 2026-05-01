import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  Heart,
  Lock,
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
  Filter,
  ShoppingBag,
  Star,
  Crown,
  ChevronRight,
  ArrowLeft,
  Download,
  Radio,
} from 'lucide-react';
import { toPng } from 'html-to-image';
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
import { useMainExploreShell } from '../contexts/MainExploreShellContext';
import {
  INSTALL_MODAL_DISMISS_KEY,
  LAST_LOCATION_SLUG_KEY,
  consumeStashedExploreTabForHome,
  migrateInstallModalDismissKey,
  migrateLastLocationSlugKey,
} from '../lib/appStorage';
import { appPublicOrigin } from '../lib/publicAppUrl';
import {
  type SortKey,
  RANK_SORT_OPTIONS,
  sortStatsByKey,
  SKILL_LABELS,
} from '../lib/rankingSort';
import { GlobalRankCard, type GlobalRankEntry } from '../components/GlobalRankCard';
import PerfilDetalhe, { type PerfilDetalheData } from './PerfilDetalhe';
import EditarPerfil from './EditarPerfil';
import { ProUpgradeModal } from '../components/ProUpgradeModal';
import ProShareCard, { type ProShareCardData } from '../components/ProShareCard';
import { ExploreAppBottomNav } from '../components/ExploreAppBottomNav';

/** Limite de jogadores no rank global. */
const GLOBAL_RANK_LIMIT = 100;

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

import { GlobalPointsListener } from '../components/GlobalPointsListener';

export default function ExplorarLocaisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, signOut } = useAuth();
  const { darkMode, setTopBarHidden, registerProfileOpener } = useMainExploreShell();
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
  const [profileBasqueteUserId, setProfileBasqueteUserId] = useState<string | null>(null);
  const [profilePlayerCode, setProfilePlayerCode] = useState<string | null>(null);
  const [profileAdminPin, setProfileAdminPin] = useState<string | null>(null);
  const [profileIsAdmin, setProfileIsAdmin] = useState(false);
  const [adminCodeCopied, setAdminCodeCopied] = useState(false);
  const [tenantFirstLocationSlug, setTenantFirstLocationSlug] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showProUpgrade, setShowProUpgrade] = useState(false);
  const [profileIsPro, setProfileIsPro] = useState(false);
  const [profileCoverUrl, setProfileCoverUrl] = useState<string | null>(null);
  const [profileTagline, setProfileTagline] = useState<string | null>(null);
  const [proCards, setProCards] = useState<Array<{ id: string; title: string | null; created_at: string; share_slug: string | null; snapshot: ProShareCardData | null }>>([]);
  const [proCardsLoading, setProCardsLoading] = useState(false);
  const [proCardsAvailable, setProCardsAvailable] = useState(true);
  const [proCardActionFeedback, setProCardActionFeedback] = useState<string | null>(null);
  const [submittingProCardId, setSubmittingProCardId] = useState<string | null>(null);
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const [exportCardSnapshot, setExportCardSnapshot] = useState<ProShareCardData | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [globalRank, setGlobalRank] = useState<GlobalRankEntry[]>([]);
  const [globalRankSort, setGlobalRankSort] = useState<SortKey>('efficiency');
  const [globalRankSearch, setGlobalRankSearch] = useState('');
  const globalRankSearchRef = useRef<HTMLInputElement | null>(null);
  const [selectedGlobalProfile, setSelectedGlobalProfile] = useState<PerfilDetalheData | null>(null);
  const [loadingGlobalProfile, setLoadingGlobalProfile] = useState(false);
  const [globalEvents, setGlobalEvents] = useState<Array<{ id: string; title: string; event_date: string; event_time: string | null; modality: string; type: string; status: string; kind: 'evento' | 'torneio'; slug?: string; logo_url?: string | null; is_paid?: boolean; price_brl?: number | null }>>([]);
  const [globalRankLoading, setGlobalRankLoading] = useState(false);
  const [globalEventsLoading, setGlobalEventsLoading] = useState(false);
  const [homeTournaments, setHomeTournaments] = useState<Array<{
    id: string; name: string; slug: string; start_date: string;
    modality: string; logo_url: string | null; is_paid: boolean; price_brl: number | null;
  }>>([]);
  const [globalTab, setGlobalTab] = useState<'inicio' | 'rank' | 'eventos' | 'perfil' | 'atleta'>('inicio');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const highlightedProCard = proCards[0] ?? null;
  const highlightedProCardShareUrl = highlightedProCard?.share_slug
    ? `${appPublicOrigin()}/card/${highlightedProCard.share_slug}`
    : null;
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const openOwnGlobalProfileRef = useRef<() => Promise<void>>(async () => {});

  // Produtos
  interface Product {
    id: string; name: string; description: string | null; price_brl: number;
    image_url: string | null; category: string; is_pro_exclusive: boolean; is_active: boolean;
    stock: number | null;
  }

  const MOCK_PRODUCTS: Product[] = [
    { id: 'mock-2', name: 'Camiseta Braska', description: 'Camiseta oficial dry-fit com logo bordado.', price_brl: 8990, image_url: null, category: 'vestuario', is_pro_exclusive: false, is_active: true, stock: 0 },
    { id: 'mock-3', name: 'Munhequeira PRO', description: 'Munhequeira esportiva com absorção de suor. Exclusivo PRO.', price_brl: 3490, image_url: null, category: 'acessorio', is_pro_exclusive: true, is_active: true, stock: 0 },
    { id: 'mock-4', name: 'Shorts Basquete', description: 'Shorts leve e confortável para treinos e jogos.', price_brl: 6990, image_url: null, category: 'vestuario', is_pro_exclusive: false, is_active: true, stock: 0 },
  ];

  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);

  useEffect(() => {
    supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setProducts((data as Product[]).filter((p) => p.category !== 'perfil_pro'));
        }
      });

    // Torneios em destaque para o hub inicial
    supabase
      .from('tournaments')
      .select('id, name, slug, start_date, modality, status, logo_url, is_paid, price_brl, visibility')
      .in('status', ['open', 'in_progress'])
      .in('visibility', ['tenant', 'global'])
      .order('start_date', { ascending: true })
      .limit(8)
      .then(({ data }) => {
        if (data) setHomeTournaments(data as typeof homeTournaments);
      });
  }, []);

  useEffect(() => {
    migrateInstallModalDismissKey();
    migrateLastLocationSlugKey();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'rank' || tab === 'eventos' || tab === 'perfil' || tab === 'inicio' || tab === 'atleta') {
      setGlobalTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const t = consumeStashedExploreTabForHome();
    if (t) setGlobalTab(t);
  }, []);

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
      setProfilePlayerCode(null);
      setProfileBasqueteUserId(null);
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
      .select('id, display_name, avatar_url, player_code, admin_pin, is_pro, pro_cover_image_url, pro_profile_tagline')
      .eq('auth_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProfileBasqueteUserId((data as { id?: string | null }).id ?? null);
        if (data.display_name?.trim()) setProfileName(data.display_name.trim());
        setProfileAvatarUrl(data.avatar_url ?? null);
        setProfilePlayerCode(data.player_code ?? null);
        setProfileAdminPin((data as { admin_pin?: string | null }).admin_pin ?? null);
        setProfileIsPro(Boolean((data as { is_pro?: boolean }).is_pro));
        setProfileCoverUrl((data as { pro_cover_image_url?: string | null }).pro_cover_image_url ?? null);
        setProfileTagline((data as { pro_profile_tagline?: string | null }).pro_profile_tagline ?? null);
      });

    // Verifica se é admin: dono de tenant OU co-admin em tenant_admins.
    // Para usuários donos de tenant (perfil de gestor), busca o slug do
    // primeiro local ativo — usado no item "Visão de jogador" do menu.
    Promise.all([
      supabase.from('tenants').select('id').eq('owner_auth_id', user.id).limit(1),
      supabase.from('tenant_admins').select('id').eq('auth_id', user.id).limit(1),
    ]).then(async ([owned, coAdmin]) => {
      if (cancelled) return;
      const ownedTenantId = owned.data?.[0]?.id as string | undefined;
      setProfileIsAdmin(!!ownedTenantId || (coAdmin.data?.length ?? 0) > 0);
      if (ownedTenantId) {
        const { data: loc } = await supabase
          .from('locations')
          .select('slug')
          .eq('tenant_id', ownedTenantId)
          .eq('is_active', true)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        if (!cancelled) setTenantFirstLocationSlug(loc?.slug ?? null);
      } else {
        setTenantFirstLocationSlug(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profileIsPro) {
      setProCards([]);
      return;
    }
    let cancelled = false;
    setProCardsLoading(true);
    setProCardsAvailable(true);
    supabase
      .from('pro_cards')
      .select('id, title, created_at, share_slug, snapshot')
      .eq('auth_id', user.id)
      .in('status', ['approved', 'published'])
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Se tabela/relação ainda não existir, não quebra a UI.
          if ((error as { code?: string }).code === '42P01') {
            setProCardsAvailable(false);
            setProCards([]);
          }
          setProCardsLoading(false);
          return;
        }
        setProCards((data ?? []) as Array<{ id: string; title: string | null; created_at: string; share_slug: string | null; snapshot: ProShareCardData | null }>);
        setProCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profileIsPro]);

  useEffect(() => {
    const prevBodyGutter = document.body.style.scrollbarGutter;
    const prevHtmlGutter = document.documentElement.style.scrollbarGutter;
    // Reserva espaço da barra apenas no lado direito, sem deslocar a esquerda.
    document.body.style.scrollbarGutter = 'stable';
    document.documentElement.style.scrollbarGutter = 'stable';
    return () => {
      document.body.style.scrollbarGutter = prevBodyGutter;
      document.documentElement.style.scrollbarGutter = prevHtmlGutter;
    };
  }, []);

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
    
    { id: 'championships', label: 'Campeonatos' },
    { id: 'tournaments', label: 'Torneios' },
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
    setSelectedGlobalProfile(null);
    setGlobalTab('rank');
    setGlobalRankLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_global_rank_top100');
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string; name: string;
        points: number; wins: number; blocks: number; steals: number;
        clutch_points: number; assists: number; rebounds: number;
        user_id: string | null; location_id: string | null;
        avatar_url: string | null; player_city: string | null; player_state?: string | null; country_iso: string | null;
      }>;
      setGlobalRank(
        rows.map((r) => ({
          id: r.id,
          name: r.name ?? '',
          points: r.points ?? 0,
          wins: r.wins ?? 0,
          blocks: r.blocks ?? 0,
          steals: r.steals ?? 0,
          clutch_points: r.clutch_points ?? 0,
          assists: r.assists ?? 0,
          rebounds: r.rebounds ?? 0,
          user_id: r.user_id,
          location_id: r.location_id,
          hot_streak_since: null,
          avatarUrl: r.avatar_url,
          playerCity: r.player_city,
          playerState: r.player_state ?? null,
          countryIso: r.country_iso ?? 'BR',
          modalityKey: null,
        }))
      );
    } catch {
      setGlobalRank([]);
    } finally {
      setGlobalRankLoading(false);
    }
  };

  const openGlobalProfile = async (entry: GlobalRankEntry) => {
    if (!entry.user_id) return;
    setLoadingGlobalProfile(true);
    // Agrega todas as linhas de `stats` do atleta (pode ter várias por tenant)
    // pra conseguir `partidas` e os contadores completos (inclusive misses).
    const { data } = await supabase
      .from('stats')
      .select('*')
      .eq('user_id', entry.user_id);
    type StatRow = {
      partidas?: number; wins?: number; points?: number; blocks?: number;
      steals?: number; clutch_points?: number; assists?: number; rebounds?: number;
      shot_1_miss?: number; shot_2_miss?: number; shot_3_miss?: number; turnovers?: number;
    };
    const rows = (data ?? []) as StatRow[];
    const sum = (k: keyof StatRow) => rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
    setSelectedGlobalProfile({
      id: entry.id,
      user_id: entry.user_id,
      name: entry.name,
      partidas: sum('partidas'),
      wins: sum('wins'),
      points: sum('points'),
      blocks: sum('blocks'),
      steals: sum('steals'),
      clutch_points: sum('clutch_points'),
      assists: sum('assists'),
      rebounds: sum('rebounds'),
      shot_1_miss: sum('shot_1_miss'),
      shot_2_miss: sum('shot_2_miss'),
      shot_3_miss: sum('shot_3_miss'),
      turnovers: sum('turnovers'),
      avatar_url: entry.avatarUrl,
    });
    setGlobalTab('atleta');
    setLoadingGlobalProfile(false);
  };

  const globalRankSearchActive = globalRankSearch.trim().length >= 3;
  const sortedGlobalRank = useMemo(() => {
    const base = globalRankSearchActive
      ? globalRank.filter((p) => (p.name ?? '').toLowerCase().includes(globalRankSearch.trim().toLowerCase()))
      : globalRank;
    return sortStatsByKey(base, globalRankSort);
  }, [globalRank, globalRankSort, globalRankSearch, globalRankSearchActive]);

  const openGlobalEvents = async () => {
    setGlobalTab('eventos');
    setGlobalEventsLoading(true);
    const [{ data: evs }, { data: tournaments }] = await Promise.all([
      supabase
        .from('eventos')
        .select('id, title, event_date, event_time, modality, type, status')
        .in('status', ['open', 'in_progress'])
        .order('event_date', { ascending: true })
        .limit(100),
      supabase
        .from('tournaments')
        .select('id, name, slug, start_date, modality, status, logo_url, is_paid, price_brl, visibility')
        .in('status', ['open', 'in_progress'])
        .in('visibility', ['tenant', 'global'])
        .order('start_date', { ascending: true })
        .limit(100),
    ]);
    const eventItems = (evs ?? []).map((e: any) => ({
      id: `e-${e.id}`,
      title: e.title,
      event_date: e.event_date,
      event_time: e.event_time,
      modality: e.modality,
      type: e.type,
      status: e.status,
      kind: 'evento' as const,
    }));
    const tourneyItems = (tournaments ?? []).map((t: any) => ({
      id: `t-${t.id}`,
      title: t.name,
      event_date: t.start_date,
      event_time: null,
      modality: t.modality,
      type: 'torneio',
      status: t.status,
      kind: 'torneio' as const,
      slug: t.slug,
      logo_url: t.logo_url,
      is_paid: t.is_paid,
      price_brl: t.price_brl,
    }));
    const merged = [...eventItems, ...tourneyItems].sort((a, b) =>
      a.event_date.localeCompare(b.event_date)
    );
    setGlobalEvents(merged);
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

  const openOwnGlobalProfile = async () => {
    if (!user) return;
    setEditingProfile(false);

    const existing = globalRank.find((entry) => entry.user_id === user.id);
    if (existing) {
      await openGlobalProfile(existing);
      return;
    }

    setLoadingGlobalProfile(true);
    try {
      const { data: ownProfile } = await supabase
        .from('basquete_users')
        .select('id, display_name, avatar_url')
        .eq('auth_id', user.id)
        .maybeSingle();

      const ownUserId = (ownProfile as { id?: string | null } | null)?.id ?? null;
      if (!ownUserId) {
        setGlobalTab('perfil');
        return;
      }

      const { data: ownStats } = await supabase
        .from('stats')
        .select('*')
        .eq('user_id', ownUserId);

      type StatRow = {
        partidas?: number; wins?: number; points?: number; blocks?: number;
        steals?: number; clutch_points?: number; assists?: number; rebounds?: number;
        shot_1_miss?: number; shot_2_miss?: number; shot_3_miss?: number; turnovers?: number;
      };
      const rows = (ownStats ?? []) as StatRow[];
      const sum = (k: keyof StatRow) => rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);

      setSelectedGlobalProfile({
        id: ownUserId,
        user_id: ownUserId,
        name: (ownProfile as { display_name?: string | null } | null)?.display_name?.trim() || profileName || 'Atleta',
        partidas: sum('partidas'),
        wins: sum('wins'),
        points: sum('points'),
        blocks: sum('blocks'),
        steals: sum('steals'),
        clutch_points: sum('clutch_points'),
        assists: sum('assists'),
        rebounds: sum('rebounds'),
        shot_1_miss: sum('shot_1_miss'),
        shot_2_miss: sum('shot_2_miss'),
        shot_3_miss: sum('shot_3_miss'),
        turnovers: sum('turnovers'),
        avatar_url: (ownProfile as { avatar_url?: string | null } | null)?.avatar_url ?? profileAvatarUrl ?? null,
      });
      setGlobalTab('atleta');
    } finally {
      setLoadingGlobalProfile(false);
    }
  };

  const requestAppPublication = async (cardId: string) => {
    if (!user) return;
    if (!profileBasqueteUserId) {
      setProCardActionFeedback('Não encontramos seu perfil de atleta para abrir a solicitação.');
      window.setTimeout(() => setProCardActionFeedback(null), 2200);
      return;
    }
    setSubmittingProCardId(cardId);
    setProCardActionFeedback(null);
    try {
      const targetCard = proCards.find((card) => card.id === cardId);
      const { error } = await supabase
        .from('pro_card_publication_requests')
        .insert({
          card_id: cardId,
          auth_id: user.id,
          basquete_user_id: profileBasqueteUserId,
          status: 'pending',
        });
      if (error) throw error;
      setProCardActionFeedback(
        targetCard?.title
          ? `Solicitação enviada para publicação do card "${targetCard.title}".`
          : 'Solicitação enviada para publicação nas redes oficiais do app.'
      );
    } catch {
      setProCardActionFeedback('Não foi possível enviar a solicitação agora.');
    } finally {
      setSubmittingProCardId(null);
      window.setTimeout(() => setProCardActionFeedback(null), 2200);
    }
  };

  const shareProCard = async (shareUrl: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Meu card PRÓ - Braska',
          text: 'Confira meu card de performance na Braska.',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setProCardActionFeedback('Link do card copiado para compartilhar.');
        window.setTimeout(() => setProCardActionFeedback(null), 1800);
      }
    } catch {
      // cancelado ou indisponível
    }
  };

  const saveProCardLocally = async (snapshot: ProShareCardData | null, fallbackSlug: string | null) => {
    if (!snapshot) {
      setProCardActionFeedback('Não há imagem de card disponível para salvar.');
      window.setTimeout(() => setProCardActionFeedback(null), 2000);
      return;
    }
    try {
      setExportCardSnapshot(snapshot);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!exportCardRef.current) throw new Error('Card não renderizado');
      const dataUrl = await toPng(exportCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `braska-card-${fallbackSlug ?? Date.now().toString()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setProCardActionFeedback('Imagem do card salva no aparelho.');
    } catch {
      setProCardActionFeedback('Não foi possível gerar a imagem agora.');
    } finally {
      window.setTimeout(() => setProCardActionFeedback(null), 2000);
    }
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
    navigate('/locais', { replace: true });
  };

  openOwnGlobalProfileRef.current = openOwnGlobalProfile;

  useEffect(() => {
    registerProfileOpener(() => {
      void openOwnGlobalProfileRef.current();
    });
    return () => registerProfileOpener(null);
  }, [registerProfileOpener]);

  useEffect(() => {
    setTopBarHidden(globalTab === 'atleta');
    return () => setTopBarHidden(false);
  }, [globalTab, setTopBarHidden]);

  const renderLocationCard = useCallback((loc: PublicLocationRow) => {
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
      localStorage.setItem(LAST_LOCATION_SLUG_KEY, loc.slug);
      navigate(`/${loc.slug}`);
    };

    return (
      <motion.div
        key={loc.id}
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
        className={`text-left rounded-[22px] border overflow-hidden shadow-xl group transition-all ${
          darkMode
            ? `border-slate-700/70 bg-slate-900/60 shadow-black/30 ${loc.is_private ? 'cursor-not-allowed opacity-85' : 'cursor-pointer hover:border-orange-500/35 hover:bg-slate-800/50'}`
            : `border-slate-200 bg-white shadow-slate-200/60 ${loc.is_private ? 'cursor-not-allowed opacity-85' : 'cursor-pointer hover:border-orange-400/40 hover:shadow-orange-100/40'}`
        }`}
      >
        <div className={`aspect-[16/10] w-full overflow-hidden relative ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
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
          <div className={`flex items-center gap-1.5 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#ff8a4c]/90" />
            <span className="truncate">{sub}</span>
          </div>
          {loc.opening_hours_note && (
            <div className={`flex items-start gap-1.5 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{loc.opening_hours_note}</span>
            </div>
          )}
          {loc.description && (
            <p className={`text-sm line-clamp-2 leading-snug ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{loc.description}</p>
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
                  className={`w-7 h-7 rounded-full border-2 ${darkMode ? 'border-slate-900' : 'border-white'} ${avatarTintClass(ti)} flex items-center justify-center text-[10px] font-bold text-white`}
                >
                  {initials[i]}
                </div>
              ))}
            </div>
            {loc.tenant?.name && (
              <span className={`text-[11px] font-medium truncate max-w-[45%] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{loc.tenant.name}</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }, [darkMode, favorites, navigate, toggleFavorite, user]);

  return (
    <div className={`min-h-screen pb-24 ${darkMode ? 'bg-[#07090f] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <GlobalPointsListener />
      {globalTab !== 'atleta' && (
        <>
        {athleteSuccess && (
          <p className="max-w-5xl mx-auto px-4 pb-2 text-xs text-emerald-300">{athleteSuccess}</p>
        )}

        <AnimatePresence initial={false}>
          {globalTab === 'inicio' && (
            <motion.section
              initial={{ height: 0, opacity: 0, y: -6 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="max-w-5xl mx-auto px-4 pt-1 pb-4">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ff8a4c]/80 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome do local, cidade, bairro, UF..."
                    className={`w-full h-12 pl-12 pr-12 py-3.5 rounded-[12px] border focus:outline-none focus:ring-2 focus:ring-[#ff8a4c]/40 focus:border-[#ff8a4c]/35 text-[15px] ${
                      darkMode
                        ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setFilterSheetOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 text-[#ff8a4c] hover:text-[#ff9a63] transition-colors"
                    aria-label="Filtros"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="max-w-5xl mx-auto px-4 pb-5">
                <div className="flex items-center justify-between mb-3.5">
                  <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Modalidades</span>
                  {chip !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setChip('all')}
                      className="text-xs font-semibold text-[#ff8a4c] hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 -mx-1 px-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {filterChips.map((c) => {
                    const active = chip === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChip(c.id)}
                        className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold border transition-all ${
                          active
                            ? 'bg-[#ff8a4c]/20 border-[#ff8a4c]/50 text-[#ff8a4c]'
                            : darkMode
                              ? 'bg-slate-900/50 border-slate-700/60 text-slate-400 hover:border-slate-600'
                              : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {globalTab === 'rank' && (
          <div className="max-w-5xl mx-auto px-4 pb-5 pt-1">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Ordenar por</span>
                <button
                  type="button"
                  onClick={() => setGlobalRankSort('efficiency')}
                  className="text-xs font-semibold text-orange-500 hover:underline shrink-0"
                >
                  Eficiência (padrão)
                </button>
              </div>
              {/* Mesmo estilo dos filtros do ranking no tenant (RankingView) */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {RANK_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setGlobalRankSort(opt.key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 ${
                        globalRankSort === opt.key
                          ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                          : darkMode
                            ? 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    ref={globalRankSearchRef}
                    type="search"
                    value={globalRankSearch}
                    onChange={(e) => setGlobalRankSearch(e.target.value)}
                    placeholder="Buscar por nome (mín. 3 letras)..."
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                      darkMode ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  {globalRankSearch && (
                    <button
                      type="button"
                      onClick={() => setGlobalRankSearch('')}
                      aria-label="Limpar busca"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {globalRankSearch.trim().length > 0 && globalRankSearch.trim().length < 3 && (
                  <p className={`text-[11px] mt-1.5 px-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Digite pelo menos 3 letras para filtrar.
                  </p>
                )}
                {globalRankSearchActive && (
                  <p className={`text-[11px] mt-1.5 px-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {sortedGlobalRank.length} resultado{sortedGlobalRank.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {(globalTab === 'eventos' || globalTab === 'perfil') && <div className="h-3 sm:h-4" aria-hidden />}
        </>
      )}

      <main className="max-w-5xl mx-auto px-4 pt-0 sm:pt-6 space-y-10">
        {globalTab === 'inicio' && (loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-[#ff8a4c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className={`text-center py-16 px-4 rounded-3xl border border-dashed ${darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-300 bg-white'}`}>
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
        ) : (<>
          {/* Torneios — slide horizontal */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Torneios</h2>
              <button
                type="button"
                onClick={() => navigate('/torneios')}
                className={`inline-flex items-center gap-1 text-xs font-bold ${darkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-500 hover:text-orange-600'}`}
              >
                Ver mais <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {homeTournaments.length === 0 ? (
              <div className={`rounded-2xl border border-dashed px-4 py-8 text-center text-sm ${darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                Nenhum torneio em aberto no momento.
              </div>
            ) : (
              <div
                className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-none"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {homeTournaments.map((t) => {
                  const dateStr = new Date(t.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => navigate(`/torneios/${t.slug}`)}
                      className={`snap-start shrink-0 rounded-2xl border overflow-hidden text-left transition-all ${
                        darkMode
                          ? 'border-slate-700/70 bg-slate-900/60 shadow-lg shadow-black/20 hover:border-orange-500/30'
                          : 'border-slate-200 bg-white shadow-md hover:border-orange-400/40'
                      }`}
                      style={{ width: 'calc(70vw - 12px)', minWidth: 240, maxWidth: 300 }}
                    >
                      <div className={`aspect-[16/9] w-full overflow-hidden relative ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        {t.logo_url ? (
                          <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500/30 to-slate-950">
                            <Trophy className="w-10 h-10 text-orange-400/60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-[10px] font-bold text-white">
                          {t.modality}
                        </span>
                        {t.is_paid && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-orange-500 text-[10px] font-bold text-white">
                            R$ {((t.price_brl ?? 0) / 100).toFixed(2).replace('.', ',')}
                          </span>
                        )}
                        <div className="absolute bottom-2 left-2 right-2">
                          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow">{t.name}</h3>
                        </div>
                      </div>
                      <div className="px-3 py-2 flex items-center gap-1.5">
                        <Calendar className={`w-3 h-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        <span className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dateStr}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Locais — grid */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Locais</h2>
              <button
                type="button"
                onClick={() => navigate('/locais')}
                className={`inline-flex items-center gap-1 text-xs font-bold ${darkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-500 hover:text-orange-600'}`}
              >
                Ver mais <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {displayed.slice(0, 8).map((loc) => {
                const fav = favorites.has(loc.id);
                const formats = loc.basketball_formats ?? [];
                const primaryTag = formats.length > 0 ? BASKETBALL_FORMAT_LABELS[formats[0]] ?? formats[0] : 'Basquete';
                const sub = locationSubtitle(loc);
                const goDetail = () => {
                  if (loc.is_private) return;
                  localStorage.setItem(LAST_LOCATION_SLUG_KEY, loc.slug);
                  navigate(`/${loc.slug}`);
                };
                return (
                  <motion.div
                    key={loc.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={goDetail}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      darkMode
                        ? `border-slate-700/70 bg-slate-900/60 shadow-lg shadow-black/20 ${loc.is_private ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:border-orange-500/30'}`
                        : `border-slate-200 bg-white shadow-md ${loc.is_private ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:border-orange-400/40'}`
                    }`}
                  >
                    <div className={`aspect-[4/3] w-full overflow-hidden relative ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {loc.image_url ? (
                        <img src={loc.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-slate-950">
                          <MapPin className="w-8 h-8 text-orange-400/40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[9px] font-bold text-white border border-white/10">
                        {primaryTag}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(loc.id, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 z-[1]"
                      >
                        <Heart className={`w-3 h-3 ${fav ? 'fill-orange-400 text-orange-400' : 'text-white'}`} />
                      </button>
                      <div className="absolute bottom-2 left-2 right-2">
                        <h3 className="text-white font-bold text-xs leading-tight line-clamp-2 drop-shadow">{loc.name}</h3>
                      </div>
                    </div>
                    <div className="px-2.5 py-2 space-y-0.5">
                      <div className={`flex items-center gap-1 text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <MapPin className="w-2.5 h-2.5 shrink-0 text-orange-400/80" />
                        <span className="truncate">{sub}</span>
                      </div>
                      {loc.tenant?.name && (
                        <p className={`text-[9px] font-medium truncate ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{loc.tenant.name}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Produtos */}
          {products.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Loja</h2>
                <ShoppingBag className={`w-4 h-4 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border overflow-hidden transition-all cursor-pointer group ${
                      darkMode
                        ? 'border-slate-700/70 bg-slate-900/60 hover:border-orange-500/30'
                        : 'border-slate-200 bg-white hover:border-orange-400/40 shadow-sm'
                    }`}
                  >
                    <div className={`aspect-square w-full overflow-hidden relative ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${
                          product.category === 'perfil_pro'
                            ? 'bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-slate-950'
                            : 'bg-gradient-to-br from-slate-700/30 to-slate-950'
                        }`}>
                          {product.category === 'perfil_pro' ? (
                            <Crown className="w-10 h-10 text-amber-400/60" />
                          ) : (
                            <ShoppingBag className="w-10 h-10 text-slate-500/40" />
                          )}
                        </div>
                      )}
                      {product.is_pro_exclusive && (
                        <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-[9px] font-bold text-white">
                          <Star className="w-2.5 h-2.5" /> PRO
                        </span>
                      )}
                      {product.stock === 0 && (
                        <span className={`absolute top-2 ${product.is_pro_exclusive ? 'left-[60px]' : 'left-2'} px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          darkMode ? 'bg-slate-800/90 text-slate-400 border border-slate-700' : 'bg-slate-200/90 text-slate-500'
                        }`}>
                          Esgotado
                        </span>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <h3 className={`font-bold text-sm leading-tight line-clamp-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className={`text-[11px] leading-snug line-clamp-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {product.description}
                        </p>
                      )}
                      <p className="text-orange-500 font-black text-base tabular-nums">
                        R${(product.price_brl / 100).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </>))}

        {globalTab === 'atleta' && selectedGlobalProfile && (
          <section className="space-y-4">
            <PerfilDetalhe
              data={selectedGlobalProfile}
              darkMode={darkMode}
              onBack={() => {
                setSelectedGlobalProfile(null);
                setGlobalTab('rank');
              }}
            />
          </section>
        )}

        {globalTab === 'rank' && !selectedGlobalProfile && (
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className={`text-xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Rank global</h2>
              <span className="text-xs text-slate-500">Top {GLOBAL_RANK_LIMIT} · {SKILL_LABELS[globalRankSort]}</span>
            </div>
            {globalRankLoading || loadingGlobalProfile ? (
              <div className="py-16 flex justify-center">
                <div className="w-9 h-9 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : globalRank.length === 0 ? (
              <p className="text-sm text-slate-400 py-6">Sem dados de ranking global no momento.</p>
            ) : (
              <div className="space-y-3">
                {sortedGlobalRank.map((a, idx) => (
                  <GlobalRankCard
                    key={a.id}
                    player={a}
                    index={idx}
                    sortKey={globalRankSort}
                    darkMode={darkMode}
                    onClick={a.user_id ? () => openGlobalProfile(a) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {globalTab === 'eventos' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Eventos globais</h2>
              <span className="text-xs text-slate-500">Todos os tenants</span>
            </div>
            {globalEventsLoading ? (
              <div className="py-10 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : globalEvents.length === 0 ? (
              <p className="text-sm text-slate-400">Sem eventos globais abertos no momento.</p>
            ) : (
              <div className="space-y-2">
                {globalEvents.map((ev) => {
                  const isTourney = ev.kind === 'torneio';
                  const content = (
                    <div className={`flex items-start gap-3 rounded-xl border p-3 ${darkMode ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-white'} ${isTourney ? 'hover:border-orange-500/40 cursor-pointer transition-colors' : ''}`}>
                      {isTourney && (
                        ev.logo_url ? (
                          <img src={ev.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />
                        ) : (
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${darkMode ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                            <span className="text-orange-500 text-lg font-black">{ev.modality}</span>
                          </div>
                        )
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{ev.title}</p>
                          {isTourney && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/25">
                              TORNEIO
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{ev.event_date}{ev.event_time ? ` · ${ev.event_time}` : ''}</p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                          {ev.type} · {ev.modality} · {ev.status}
                          {isTourney && (ev.is_paid && ev.price_brl
                            ? ` · R$ ${(ev.price_brl / 100).toFixed(2).replace('.', ',')}`
                            : ' · Gratuito')}
                        </p>
                      </div>
                    </div>
                  );
                  return isTourney && ev.slug ? (
                    <button key={ev.id} type="button" onClick={() => navigate(`/torneios/${ev.slug}`)} className="block w-full text-left">
                      {content}
                    </button>
                  ) : (
                    <div key={ev.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {globalTab === 'perfil' && (
          <section className="max-w-md">
            {!user ? (
              <div className={`rounded-2xl border p-5 ${darkMode ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Faça login para acessar seu perfil global.</p>
                <button onClick={openLogin} className="mt-3 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold">Entrar</button>
              </div>
            ) : editingProfile ? (
              <div className="space-y-4">
                <EditarPerfil
                  darkMode={darkMode}
                  onBack={() => setEditingProfile(false)}
                  hasAdminAccess={profileIsAdmin}
                  onSaved={() => {
                    setEditingProfile(false);
                    // refresh rápido dos campos refletidos no resumo do perfil global
                    supabase
                      .from('basquete_users')
                      .select('id, display_name, avatar_url, player_code, admin_pin, is_pro, pro_cover_image_url, pro_profile_tagline')
                      .eq('auth_id', user.id)
                      .maybeSingle()
                      .then(({ data }) => {
                        if (!data) return;
                        setProfileBasqueteUserId((data as { id?: string | null }).id ?? null);
                        if (data.display_name?.trim()) setProfileName(data.display_name.trim());
                        setProfileAvatarUrl(data.avatar_url ?? null);
                        setProfilePlayerCode(data.player_code ?? null);
                        setProfileAdminPin((data as { admin_pin?: string | null }).admin_pin ?? null);
                        setProfileIsPro(Boolean((data as { is_pro?: boolean }).is_pro));
                        setProfileCoverUrl((data as { pro_cover_image_url?: string | null }).pro_cover_image_url ?? null);
                        setProfileTagline((data as { pro_profile_tagline?: string | null }).pro_profile_tagline ?? null);
                      });
                  }}
                />
              </div>
            ) : (
              <div className={`rounded-2xl border p-5 space-y-4 ${darkMode ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                {profileIsPro && profileCoverUrl && (
                  <div className="relative h-28 rounded-xl overflow-hidden border border-orange-500/20">
                    <img src={profileCoverUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 to-transparent" />
                    <span className="absolute left-3 bottom-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/80 text-white">
                      <Crown className="w-3 h-3" /> PRÓ
                    </span>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        disabled={!highlightedProCard || submittingProCardId === highlightedProCard.id}
                        onClick={() => highlightedProCard && requestAppPublication(highlightedProCard.id)}
                        className={`w-9 h-9 rounded-full border text-white flex items-center justify-center transition-all bg-black/10 backdrop-blur-sm ${
                          darkMode ? 'border-white/35 hover:bg-white/15' : 'border-white/80 hover:bg-white/20'
                        } ${(!highlightedProCard || submittingProCardId === highlightedProCard.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Publicar card"
                        aria-label="Publicar card"
                      >
                        <Radio className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!highlightedProCardShareUrl}
                        onClick={() => highlightedProCardShareUrl && void shareProCard(highlightedProCardShareUrl)}
                        className={`w-9 h-9 rounded-full border text-white flex items-center justify-center transition-all bg-black/10 backdrop-blur-sm ${
                          darkMode ? 'border-white/35 hover:bg-white/15' : 'border-white/80 hover:bg-white/20'
                        } ${!highlightedProCardShareUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Compartilhar nas redes"
                        aria-label="Compartilhar nas redes"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!highlightedProCard?.snapshot}
                        onClick={() => void saveProCardLocally(highlightedProCard?.snapshot ?? null, highlightedProCard?.share_slug ?? null)}
                        className={`w-9 h-9 rounded-full border text-white flex items-center justify-center transition-all bg-black/10 backdrop-blur-sm ${
                          darkMode ? 'border-white/35 hover:bg-white/15' : 'border-white/80 hover:bg-white/20'
                        } ${!highlightedProCard?.snapshot ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Salvar card"
                        aria-label="Salvar card"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={profileName} className={`w-12 h-12 rounded-full object-cover border ${darkMode ? 'border-slate-600' : 'border-slate-200'}`} />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm font-bold text-orange-300">
                      {(profileName?.[0] ?? 'A').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{profileName}</p>
                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Perfil global</p>
                    {profileIsPro && (
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/15 border border-orange-500/30 text-orange-400">
                        <Crown className="w-3 h-3" /> PRÓ
                      </span>
                    )}
                  </div>
                </div>
                {profileIsPro && profileTagline && (
                  <p className={`text-xs leading-relaxed ${darkMode ? 'text-orange-200/90' : 'text-orange-700'}`}>
                    {profileTagline}
                  </p>
                )}

                {(profilePlayerCode || (profileIsAdmin && profileAdminPin)) && (
                  <div className={`mt-4 grid gap-2 ${profileIsAdmin && profileAdminPin && profilePlayerCode ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {profilePlayerCode && (
                      <div className={`flex items-start justify-between gap-2 p-3 rounded-xl border ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="min-w-0">
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Código de atleta
                          </p>
                          <p className={`font-mono font-bold text-lg ${darkMode ? 'text-orange-300' : 'text-orange-600'}`}>
                            #{profilePlayerCode}
                          </p>
                          <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            Envie ao capitão da sua equipe.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(profilePlayerCode);
                              setCodeCopied(true);
                              setTimeout(() => setCodeCopied(false), 1800);
                            } catch { /* ignore */ }
                          }}
                          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}`}
                        >
                          {codeCopied ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    )}

                    {profileIsAdmin && profileAdminPin && (
                      <div className={`flex items-start justify-between gap-2 p-3 rounded-xl border ${darkMode ? 'border-red-500/25 bg-red-500/5' : 'border-red-300 bg-red-50'}`}>
                        <div className="min-w-0">
                          <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                            <Shield className="w-3 h-3" />
                            Código admin
                          </p>
                          <p className={`font-mono font-bold text-lg ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                            {profileAdminPin}
                          </p>
                          <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            PIN para confirmar ações administrativas.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(profileAdminPin);
                              setAdminCodeCopied(true);
                              setTimeout(() => setAdminCodeCopied(false), 1800);
                            } catch { /* ignore */ }
                          }}
                          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}`}
                        >
                          {adminCodeCopied ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setEditingProfile(true)}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200'}`}
                >
                  Editar perfil
                </button>
                {!profileIsPro && (
                  <button
                    type="button"
                    onClick={() => setShowProUpgrade(true)}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${darkMode ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border border-orange-500/30' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}
                  >
                    <Crown className="w-4 h-4" />
                    Conheça os benefícios do PRÓ (Em breve)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/minhas-equipes')}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${darkMode ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border border-orange-500/30' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}
                >
                  Minhas Equipes
                </button>

                {profileIsPro && (
                  <div className={`rounded-xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Cards publicados
                      </p>
                      <span className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{proCards.length}</span>
                    </div>
                    {proCardsLoading ? (
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Carregando cards...</p>
                    ) : !proCardsAvailable ? (
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        O módulo de cards ainda não está habilitado neste ambiente.
                      </p>
                    ) : proCards.length === 0 ? (
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Você ainda não possui cards publicados.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {proCards.map((card) => {
                          const shareUrl = card.share_slug ? `${appPublicOrigin()}/card/${card.share_slug}` : null;
                          return (
                            <div key={card.id} className={`rounded-lg border p-2.5 ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
                              <p className={`text-xs font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                {card.title?.trim() || 'Card de performance'}
                              </p>
                              <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                                {new Date(card.created_at).toLocaleDateString('pt-BR')}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => requestAppPublication(card.id)}
                                  disabled={submittingProCardId === card.id}
                                  className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                                    darkMode
                                      ? 'border-orange-500/30 text-orange-300 hover:bg-orange-500/10'
                                      : 'border-orange-200 text-orange-700 hover:bg-orange-50'
                                  } disabled:opacity-50`}
                                >
                                  {submittingProCardId === card.id ? 'Enviando...' : 'Publicar card'}
                                </button>
                                {shareUrl && (
                                  <button
                                    type="button"
                                    onClick={() => void shareProCard(shareUrl)}
                                    className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                                      darkMode
                                        ? 'border-sky-500/30 text-sky-300 hover:bg-sky-500/10'
                                        : 'border-sky-200 text-sky-700 hover:bg-sky-50'
                                    }`}
                                  >
                                    Compartilhar nas redes
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void saveProCardLocally(card.snapshot, card.share_slug)}
                                  className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                                    darkMode
                                      ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {proCardActionFeedback && (
                      <p className={`text-[11px] mt-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {proCardActionFeedback}
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGlobalSignOut}
                  className="mt-2 w-full py-2.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-sm font-semibold"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
              className={`relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <h3 className={`font-black text-lg ${darkMode ? 'text-white' : 'text-slate-900'}`}>Filtros</h3>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className={`p-2 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
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
                        ? darkMode ? 'border-[#ff8a4c]/50 bg-[#ff8a4c]/10 text-white' : 'border-[#ff8a4c]/50 bg-[#ff8a4c]/10 text-orange-700'
                        : darkMode ? 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-semibold">{c.label}</span>
                    {chip === c.id && <span className="text-[#ff8a4c] text-xs font-bold">Ativo</span>}
                  </button>
                ))}
              </div>
              <div className={`p-4 border-t flex gap-2 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setChip('all');
                    setFilterSheetOpen(false);
                  }}
                  className={`flex-1 py-3 rounded-2xl font-bold border ${darkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
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
              className={`relative w-full max-w-md rounded-3xl border p-5 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
            >
              <h3 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Instalar Braska</h3>
              <p className={`text-sm mt-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Aplicativo seguro, rapido e com melhor experiencia para acompanhar jogos e ranking.</p>
              <div className={`mt-3 space-y-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <p className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> Seguro e confiavel</p>
                <p className="flex items-center gap-2"><Zap className="w-4 h-4 text-orange-400" /> Carregamento mais rapido</p>
                <p className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-sky-400" /> Melhor experiencia em tela cheia</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={dismissInstallModal}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
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
                <p className={`text-[11px] mt-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
              className={`relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden p-5 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-black text-lg ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {loginStep === 'role' ? 'Como deseja entrar?' : athleteMode === 'login' ? 'Login de atleta' : 'Cadastro de atleta'}
                </h3>
                <button
                  type="button"
                  onClick={() => setLoginSheetOpen(false)}
                  className={`p-2 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
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
                    className={`w-full text-left p-4 rounded-2xl border hover:border-orange-500/40 ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Sou atleta</p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Entrar ou criar conta de atleta.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginSheetOpen(false);
                      navigate('/landing');
                    }}
                    className={`w-full text-left p-4 rounded-2xl border hover:border-emerald-500/40 transition-all ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Sou gestor</p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ir para a landing page do gestor.</p>
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
                          : darkMode ? 'bg-white/10 text-white/60 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
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
                          : darkMode ? 'bg-white/10 text-white/60 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Cadastrar
                    </button>
                  </div>
                  <label className="block">
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email</span>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={athleteEmail}
                        onChange={(e) => setAthleteEmail(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60 ${
                          darkMode ? 'bg-white/10 border-white/20 text-white placeholder-white/30' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                        placeholder="atleta@email.com"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Senha</span>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={athletePassword}
                        onChange={(e) => setAthletePassword(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60 ${
                          darkMode ? 'bg-white/10 border-white/20 text-white placeholder-white/30' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                        placeholder="******"
                      />
                    </div>
                  </label>
                  {athleteMode === 'signup' && <p className={`text-xs ${darkMode ? 'text-white/40' : 'text-slate-400'}`}>Mínimo 6 caracteres</p>}
                  {athleteError && (
                    <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{athleteError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLoginStep('role')}
                      className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${darkMode ? 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-200'}`}
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

      <ProUpgradeModal
        open={showProUpgrade}
        onClose={() => setShowProUpgrade(false)}
        onActivated={() => {
          setShowProUpgrade(false);
          supabase
            .from('basquete_users')
            .select('is_pro, pro_cover_image_url, pro_profile_tagline')
            .eq('auth_id', user?.id ?? '')
            .maybeSingle()
            .then(({ data }) => {
              if (!data) return;
              setProfileIsPro(Boolean((data as { is_pro?: boolean }).is_pro));
              setProfileCoverUrl((data as { pro_cover_image_url?: string | null }).pro_cover_image_url ?? null);
              setProfileTagline((data as { pro_profile_tagline?: string | null }).pro_profile_tagline ?? null);
            });
        }}
        sessionToken={session?.access_token ?? ''}
        userEmail={user?.email ?? ''}
        darkMode={darkMode}
      />
      {/* alvo oculto para exportar PNG local do card */}
      {profileIsPro && exportCardSnapshot && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
          <div ref={exportCardRef} style={{ width: 1080, height: 1920 }}>
            <ProShareCard data={exportCardSnapshot} format="story" />
          </div>
        </div>
      )}

      {user && (
        <ExploreAppBottomNav
          darkMode={darkMode}
          exploreActive={globalTab === 'atleta' ? null : globalTab}
          treinosActive={false}
          onSelectInicio={() => setGlobalTab('inicio')}
          onSelectRank={() => {
            setSelectedGlobalProfile(null);
            setGlobalTab('rank');
          }}
          onSelectEventos={() => setGlobalTab('eventos')}
          onSelectPerfil={() => setGlobalTab('perfil')}
          onSelectTreinos={() => navigate('/treinos')}
        />
      )}

      {!user && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 px-4 pb-[60px] pt-8 bg-gradient-to-t ${darkMode ? 'from-[#07090f] via-[#07090f]/95 to-transparent' : 'from-slate-50 via-slate-50/95 to-transparent'}`}>
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
