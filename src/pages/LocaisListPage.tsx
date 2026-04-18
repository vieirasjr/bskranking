import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, MapPin, Search, X, Heart } from 'lucide-react';
import { fetchPublicLocations, matchesLocationSearch, type PublicLocationRow } from '../lib/publicLocations';
import { BASKETBALL_FORMAT_OPTIONS, BASKETBALL_FORMAT_LABELS, type ExploreFilterChip } from '../lib/basketballExplore';
import { getThemeDarkStored, LAST_LOCATION_SLUG_KEY } from '../lib/appStorage';

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

function locationSubtitle(loc: PublicLocationRow): string {
  const parts = [loc.city, loc.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return loc.country === 'BR' || !loc.country ? 'Brasil' : (loc.country ?? '');
}

function matchesChip(loc: PublicLocationRow, chip: ExploreFilterChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'tournaments')   return !!loc.hosts_tournaments;
  if (chip === 'championships') return !!loc.hosts_championships;
  return (loc.basketball_formats ?? []).includes(chip);
}

const CHIPS: { id: ExploreFilterChip; label: string }[] = [
  { id: 'all',           label: 'Todos' },
  { id: 'tournaments',   label: 'Torneios' },
  { id: 'championships', label: 'Campeonatos' },
  ...BASKETBALL_FORMAT_OPTIONS.map((f) => ({ id: f.id, label: BASKETBALL_FORMAT_LABELS[f.id] ?? f.label })),
];

export default function LocaisListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ExploreFilterChip>('all');
  const [favs, setFavs] = useState<Set<string>>(() => loadFavs());
  const darkMode = getThemeDarkStored() !== 'false';

  useEffect(() => {
    setLoading(true);
    fetchPublicLocations().then((list) => {
      setItems(list);
      setLoading(false);
    });
  }, []);

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return items.filter((l) => matchesLocationSearch(l, query) && matchesChip(l, chip));
  }, [items, query, chip]);

  return (
    <div className={darkMode ? 'min-h-screen bg-[#07090f] text-white' : 'min-h-screen bg-slate-50 text-slate-900'}>
      <header className={`sticky top-0 z-20 backdrop-blur border-b ${darkMode ? 'bg-[#07090f]/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/')} className={`p-2 -ml-2 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-black flex-1">Locais</h1>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar local, cidade, estado..."
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                darkMode ? 'bg-slate-900 border border-slate-700 text-white placeholder-slate-500' : 'bg-white border border-slate-300 text-slate-900'
              }`}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {CHIPS.map((c) => {
              const active = chip === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChip(c.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    active
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : darkMode
                        ? 'bg-transparent border-slate-700 text-slate-400 hover:text-white'
                        : 'bg-white border-slate-300 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <p className="text-xs text-slate-500 mb-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={`text-center py-16 rounded-3xl border border-dashed ${darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-300 bg-white'}`}>
            <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">Nenhum local encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((loc) => {
              const formats = loc.basketball_formats ?? [];
              const primaryTag = formats.length > 0 ? BASKETBALL_FORMAT_LABELS[formats[0]] ?? formats[0] : 'Basquete';
              const sub = locationSubtitle(loc);
              const fav = favs.has(loc.id);
              const goDetail = () => {
                if (loc.is_private) return;
                localStorage.setItem(LAST_LOCATION_SLUG_KEY, loc.slug);
                navigate(`/${loc.slug}`);
              };
              return (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={goDetail}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    darkMode
                      ? `border-slate-700/70 bg-slate-900/60 ${loc.is_private ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:border-orange-500/40'}`
                      : `border-slate-200 bg-white shadow-sm ${loc.is_private ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:border-orange-400/50'}`
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
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-[9px] font-bold text-white">
                      {primaryTag}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => toggleFav(loc.id, e)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
                    >
                      <Heart className={`w-3 h-3 ${fav ? 'fill-orange-400 text-orange-400' : 'text-white'}`} />
                    </button>
                    <div className="absolute bottom-2 left-2 right-2">
                      <h3 className="text-white font-bold text-xs leading-tight line-clamp-2 drop-shadow">{loc.name}</h3>
                    </div>
                  </div>
                  <div className="px-2.5 py-2">
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
        )}
      </main>
    </div>
  );
}
