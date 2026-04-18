import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Search, Trophy, X } from 'lucide-react';
import { supabase } from '../supabase';
import { getThemeDarkStored } from '../lib/appStorage';

interface Tournament {
  id: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string | null;
  modality: string;
  status: string;
  logo_url: string | null;
  is_paid: boolean;
  price_brl: number | null;
}

type Filter = 'all' | 'open' | 'in_progress' | '3x3' | '5x5' | '1x1' | 'paid' | 'free';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',         label: 'Todos' },
  { id: 'open',        label: 'Abertos' },
  { id: 'in_progress', label: 'Em andamento' },
  { id: '3x3',         label: '3x3' },
  { id: '5x5',         label: '5x5' },
  { id: '1x1',         label: '1x1' },
  { id: 'paid',        label: 'Pagos' },
  { id: 'free',        label: 'Gratuitos' },
];

export default function TorneiosListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const darkMode = getThemeDarkStored() !== 'false';

  useEffect(() => {
    setLoading(true);
    supabase
      .from('tournaments')
      .select('id, name, slug, start_date, end_date, modality, status, logo_url, is_paid, price_brl, visibility')
      .in('status', ['open', 'in_progress', 'closed'])
      .in('visibility', ['tenant', 'global'])
      .order('start_date', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setItems((data ?? []) as Tournament[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'open')        return t.status === 'open';
      if (filter === 'in_progress') return t.status === 'in_progress';
      if (filter === 'paid')        return !!t.is_paid;
      if (filter === 'free')        return !t.is_paid;
      return t.modality === filter;
    });
  }, [items, query, filter]);

  return (
    <div className={darkMode ? 'min-h-screen bg-[#07090f] text-white' : 'min-h-screen bg-slate-50 text-slate-900'}>
      <header className={`sticky top-0 z-20 backdrop-blur border-b ${darkMode ? 'bg-[#07090f]/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/')} className={`p-2 -ml-2 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-black flex-1">Torneios</h1>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar torneio..."
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

          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    active
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : darkMode
                        ? 'bg-transparent border-slate-700 text-slate-400 hover:text-white'
                        : 'bg-white border-slate-300 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
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
            <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">Nenhum torneio encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t) => {
              const dateStr = new Date(t.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/torneios/${t.slug}`)}
                  className={`rounded-2xl border overflow-hidden text-left transition-all ${
                    darkMode
                      ? 'border-slate-700/70 bg-slate-900/60 hover:border-orange-500/40'
                      : 'border-slate-200 bg-white shadow-sm hover:border-orange-400/50'
                  }`}
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
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-bold text-white">
                      {t.modality}
                    </span>
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.status === 'open' ? 'bg-green-500 text-white' :
                      t.status === 'in_progress' ? 'bg-blue-500 text-white' :
                      'bg-slate-600 text-slate-100'
                    }`}>
                      {t.status === 'open' ? 'Aberto' : t.status === 'in_progress' ? 'Em andamento' : 'Fechado'}
                    </span>
                    <div className="absolute bottom-2 left-2 right-2">
                      <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow">{t.name}</h3>
                    </div>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>{dateStr}</span>
                    </div>
                    {t.is_paid ? (
                      <span className="text-orange-400 text-xs font-bold">R$ {((t.price_brl ?? 0) / 100).toFixed(2).replace('.', ',')}</span>
                    ) : (
                      <span className="text-emerald-400 text-xs font-bold">Grátis</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
