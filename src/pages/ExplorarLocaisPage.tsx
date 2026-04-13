import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Clock,
  Heart,
  MapPin,
  Search,
  SlidersHorizontal,
  Trophy,
  UserCog,
  X,
} from 'lucide-react';
import {
  BASKETBALL_FORMAT_OPTIONS,
  BASKETBALL_FORMAT_LABELS,
  avatarTintClass,
  avatarTintIndicesForId,
  type ExploreFilterChip,
} from '../lib/basketballExplore';
import { fetchPublicLocations, matchesLocationSearch, type PublicLocationRow } from '../lib/publicLocations';

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
  const [locations, setLocations] = useState<PublicLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ExploreFilterChip>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavs());

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

    const goDetail = () => navigate(`/locais/${loc.slug}`);

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
        className="cursor-pointer text-left rounded-[22px] border border-slate-700/70 bg-slate-900/60 hover:border-orange-500/35 hover:bg-slate-800/50 transition-all overflow-hidden shadow-xl shadow-black/30 group"
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
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#07090f] text-white pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#07090f]/92 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-slate-800/80 transition-colors shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2 py-2 px-3 rounded-2xl bg-slate-900/80 border border-slate-700/60">
            <MapPin className="w-4 h-4 text-[#ff8a4c] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Basquete</p>
              <p className="text-sm font-semibold text-white truncate flex items-center gap-1">
                Quadras e locais
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 opacity-50" aria-hidden />
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:bg-slate-800 text-slate-300"
            aria-label="Notificações"
            title="Em breve"
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>

        <p className="max-w-5xl mx-auto px-4 text-[11px] text-slate-500 pb-2">
          Locais cadastrados por organizações na plataforma. Exibindo até {PUBLIC_LOCAIS_DISPLAY_LIMIT} por vez — refine
          com a busca ou filtros.
        </p>

        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ff8a4c]/80 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome do local, cidade, bairro, UF..."
              className="w-full pl-12 pr-4 py-3.5 rounded-[20px] bg-slate-900/90 border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff8a4c]/40 focus:border-[#ff8a4c]/35 text-[15px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="shrink-0 w-14 h-[52px] rounded-[20px] bg-[#ff8a4c] hover:bg-[#ff7a38] flex items-center justify-center shadow-lg shadow-[#ff8a4c]/25 transition-colors"
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
        {loading ? (
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
        )}

        <p className="text-center pt-4 sm:hidden">
          <button
            type="button"
            onClick={() => navigate('/entrar')}
            className="text-sm text-slate-400 underline underline-offset-2"
          >
            É gestor? Acesse o painel
          </button>
        </p>
        <div className="hidden sm:flex justify-center pt-4">
          <button
            type="button"
            onClick={() => navigate('/entrar')}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-600 hover:bg-slate-700"
          >
            <UserCog className="w-4 h-4" />
            Sou gestor
          </button>
        </div>
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
    </div>
  );
}
