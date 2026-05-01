import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  BookOpen,
  Dumbbell,
  GitBranch,
  LayoutGrid,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMainExploreShell } from '../contexts/MainExploreShellContext';
import { ExploreAppBottomNav } from '../components/ExploreAppBottomNav';
import { stashExploreTabForHomeVisit } from '../lib/appStorage';
import {
  MOCK_TREINOS_CURSOS,
  TREINO_NIVEL_LABEL,
  type TreinoCursoMock,
  type TreinoNivel,
  formatTreinoPrice,
} from '../lib/mockTreinos';

type SortKey = 'popular' | 'price_asc' | 'price_desc' | 'recent';
type PriceFilter = 'all' | 'free' | 'paid';

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'popular', label: 'Mais populares' },
  { id: 'price_asc', label: 'Menor preço' },
  { id: 'price_desc', label: 'Maior preço' },
  { id: 'recent', label: 'Mais recentes' },
];

const CATEGORIES = ['Todas', ...Array.from(new Set(MOCK_TREINOS_CURSOS.map((c) => c.category)))];

const CATEGORY_ICON: Record<string, typeof Target> = {
  Todas: LayoutGrid,
  'Técnica individual': Target,
  Tática: GitBranch,
  'Preparação física': Dumbbell,
  Defesa: Shield,
  Metodologia: Sparkles,
};

const NIVEL_FILTERS: { id: 'all' | TreinoNivel; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'iniciante', label: 'Iniciante' },
  { id: 'intermediario', label: 'Intermediário' },
  { id: 'avancado', label: 'Avançado' },
];

const DICAS_BRASKA = [
  {
    emoji: '🎯',
    title: 'Arremesso em grupo',
    description: 'Corrija o mínimo necessário por repetição — o atleta precisa de ritmo, não de palestra em cada bola.',
  },
  {
    emoji: '📐',
    title: 'Spacing no 5v5',
    description: 'Ensine o “túnel” antes da jogada ensaiada: se o pivô não tem espaço, a leitura morre.',
  },
  {
    emoji: '🔊',
    title: 'Defesa com voz',
    description: 'Troque “aja” por gatilhos de uma sílaba no 3v3; o hábito sobe para o jogo completo.',
  },
];

function avgMinutesPerLesson(c: TreinoCursoMock) {
  if (c.lessonCount <= 0) return 15;
  return Math.max(10, Math.round((c.videoHours * 60) / c.lessonCount));
}

function CarouselCourseCard({ c, index, darkMode }: { c: TreinoCursoMock; index: number; darkMode: boolean }) {
  const navigate = useNavigate();
  const free = c.priceBrl <= 0;
  const avgMin = avgMinutesPerLesson(c);
  const levelShort = TREINO_NIVEL_LABEL[c.level];

  return (
    <motion.article
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="min-w-[272px] max-w-[272px] snap-start shrink-0"
    >
      <div
        className={`rounded-[26px] overflow-hidden ${
          darkMode ? 'bg-[#1E1E1E] shadow-xl shadow-black/40' : 'bg-white shadow-lg shadow-slate-300/40'
        }`}
      >
        <button type="button" onClick={() => navigate(`/treinos/${c.slug}`)} className="block w-full text-left">
          <div className={`relative aspect-[4/3] w-full bg-gradient-to-br ${c.coverClass}`}>
            <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-90">
              {c.instructor.avatarEmoji ?? '🏀'}
            </span>
            <div
              className={`absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                darkMode ? 'bg-black/55 text-white' : 'bg-white/95 text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              {c.ratingAvg.toFixed(1)}
            </div>
            <div
              className="absolute bottom-3 left-3 flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-black/55 backdrop-blur-sm
              border border-white/10"
            >
              <span className="w-8 h-8 rounded-full bg-[#1E1E1E] flex items-center justify-center text-base">
                {c.instructor.avatarEmoji ?? '👤'}
              </span>
              <span className="text-[11px] font-semibold text-white max-w-[100px] truncate">{c.instructor.name.split(' ')[0]}</span>
            </div>
            <div className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-[#FF6B00] flex items-center justify-center shadow-lg">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="p-4">
            <h3 className={`font-bold text-[15px] leading-snug line-clamp-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {c.title}
            </h3>
            <p className={`text-xs mt-1.5 ${darkMode ? 'text-[#A0A0A0]' : 'text-slate-600'}`}>
              {avgMin} min · {levelShort}
              {free ? ' · Grátis' : ''}
            </p>
            <p className={`text-sm font-black mt-3 ${free ? 'text-emerald-400' : darkMode ? 'text-white' : 'text-slate-900'}`}>
              {formatTreinoPrice(c.priceBrl)}
            </p>
          </div>
        </button>
      </div>
    </motion.article>
  );
}

export default function TreinosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { darkMode, setTopBarTrailing, registerProfileOpener } = useMainExploreShell();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [nivel, setNivel] = useState<'all' | TreinoNivel>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sort, setSort] = useState<SortKey>('popular');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    registerProfileOpener(() => {
      stashExploreTabForHomeVisit('perfil');
      navigate('/');
    });
    return () => registerProfileOpener(null);
  }, [registerProfileOpener, navigate]);

  useEffect(() => {
    if (!user) {
      setTopBarTrailing(null);
      return;
    }
    setTopBarTrailing(
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
          darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
        }`}
        aria-label="Filtros e ordenação"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>,
    );
    return () => setTopBarTrailing(null);
  }, [user, darkMode, setTopBarTrailing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = MOCK_TREINOS_CURSOS.filter((c) => {
      if (q && !`${c.title} ${c.subtitle} ${c.tags.join(' ')}`.toLowerCase().includes(q)) return false;
      if (category !== 'Todas' && c.category !== category) return false;
      if (nivel !== 'all' && c.level !== nivel) return false;
      if (priceFilter === 'free' && c.priceBrl > 0) return false;
      if (priceFilter === 'paid' && c.priceBrl <= 0) return false;
      return true;
    });

    const copy = [...list];
    if (sort === 'popular') copy.sort((a, b) => b.studentsCount - a.studentsCount);
    else if (sort === 'price_asc') copy.sort((a, b) => a.priceBrl - b.priceBrl);
    else if (sort === 'price_desc') copy.sort((a, b) => b.priceBrl - a.priceBrl);
    else if (sort === 'recent') copy.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    return copy;
  }, [query, category, nivel, priceFilter, sort]);

  const bgMain = darkMode ? 'bg-[#07090f]' : 'bg-slate-50';
  const textMuted = darkMode ? 'text-[#A0A0A0]' : 'text-slate-600';

  return (
    <div className={`min-h-screen ${bgMain} ${darkMode ? 'text-white' : 'text-slate-900'} pb-32`}>
      <div className="max-w-lg mx-auto px-4 pt-4 sm:max-w-2xl lg:max-w-6xl">
        <p className={`text-sm font-bold ${textMuted} mb-3`}>Cursos e masterclasses para treinadores</p>

        <div className="relative mb-6">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
          <input
            ref={searchInputRef}
            id="treinos-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar treinos, técnica ou professor..."
            className={`w-full pl-11 pr-10 py-3.5 rounded-[24px] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/50 ${
              darkMode ? 'bg-[#1E1E1E] text-white placeholder:text-[#A0A0A0]/80 border border-white/5' : 'bg-white border border-slate-200'
            }`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-2 pl-1.5 sm:pl-2">
          <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${textMuted}`}>Categorias</p>
          <div
            className="flex flex-nowrap gap-3 overflow-x-auto overflow-y-hidden pb-2 -mr-4 pr-4 scrollbar-none snap-x min-h-[48px] items-center"
            style={{ scrollbarWidth: 'none' }}
          >
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              const Icon = CATEGORY_ICON[cat] ?? LayoutGrid;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 snap-start inline-flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#FF6B00] text-white shadow-lg shadow-orange-900/20'
                      : darkMode
                        ? 'bg-[#2a2a2a] text-[#A0A0A0] border border-white/[0.06]'
                        : 'bg-slate-200/95 text-slate-600 border border-slate-200'
                  }`}
                >
                  {active ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shrink-0">
                      <Icon className="w-4 h-4 text-[#FF6B00]" />
                    </span>
                  ) : (
                    <Icon className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#FF6B00]' : 'text-orange-500'}`} />
                  )}
                  {cat === 'Todas' ? 'Todas' : cat}
                </button>
              );
            })}
          </div>

          <div className="flex items-end justify-between mt-10 mb-4">
            <div>
              <h2 className="text-xl font-black">Programas</h2>
              <p className={`text-sm ${textMuted}`}>
                <span className="text-[#FF6B00] font-bold">{filtered.length}</span> curso{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-emerald-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              Compra segura
            </div>
          </div>

          {filtered.length === 0 ? (
            <div
              className={`text-center py-16 px-4 rounded-[28px] border border-dashed ${
                darkMode ? 'border-white/10 bg-[#1E1E1E]/50' : 'border-slate-300 bg-white'
              }`}
            >
              <BookOpen className="w-12 h-12 opacity-40 mx-auto mb-3" />
              <p className="font-bold">Nenhum programa com esses filtros</p>
              <p className={`text-sm mt-2 ${textMuted}`}>Ajuste busca ou categorias.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('Todas');
                  setNivel('all');
                  setPriceFilter('all');
                }}
                className="mt-5 text-sm font-bold text-[#FF6B00]"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div
              className="flex gap-4 overflow-x-auto pb-4 -mr-4 pr-4 snap-x scrollbar-none"
              style={{ scrollbarWidth: 'none' }}
            >
            {filtered.map((c, i) => (
              <CarouselCourseCard key={c.id} c={c} index={i} darkMode={darkMode} />
            ))}
            </div>
          )}
        </div>

        <section className="mt-6 mb-4">
          <h2 className="text-lg font-black mb-4">Dicas rápidas</h2>
          <div className="space-y-3">
            {DICAS_BRASKA.map((d) => (
              <div
                key={d.title}
                className={`flex gap-3 p-3 rounded-[22px] ${darkMode ? 'bg-[#1E1E1E]' : 'bg-white shadow-sm border border-slate-100'}`}
              >
                <div
                  className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl ${
                    darkMode ? 'bg-[#2a2a2a]' : 'bg-slate-100'
                  }`}
                >
                  {d.emoji}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[15px]">{d.title}</p>
                  <p className={`text-xs leading-relaxed mt-1 ${textMuted}`}>{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className={`rounded-[24px] p-4 mt-4 ${darkMode ? 'bg-[#1E1E1E] border border-white/5' : 'bg-white border border-slate-200'}`}
        >
          <p className={`text-xs flex items-center gap-2 ${textMuted}`}>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            Checkout e garantias em breve · conteúdo pensado para aplicar na quadra na semana seguinte.
          </p>
        </section>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button type="button" className="absolute inset-0 bg-black/65" aria-label="Fechar" onClick={() => setMenuOpen(false)} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className={`absolute top-0 right-0 bottom-0 w-[min(100%,320px)] shadow-2xl overflow-y-auto ${
              darkMode ? 'bg-[#1E1E1E] border-l border-white/10' : 'bg-white'
            }`}
          >
            <div className={`p-4 flex items-center justify-between border-b ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <span className="font-black flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#FF6B00]" />
                Ajustes
              </span>
              <button type="button" onClick={() => setMenuOpen(false)} className="p-2 rounded-full hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-6">
              <div>
                <p className={`text-xs font-bold uppercase ${textMuted} mb-2`}>Nível</p>
                <div className="flex flex-col gap-1">
                  {NIVEL_FILTERS.map((n) => {
                    const active = nivel === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNivel(n.id);
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left py-3 px-3 rounded-xl text-sm font-semibold ${
                          active
                            ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                            : darkMode
                              ? 'hover:bg-white/5'
                              : 'hover:bg-slate-100'
                        }`}
                      >
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className={`text-xs font-bold uppercase ${textMuted} mb-2`}>Preço</p>
                <div className="flex flex-col gap-1">
                  {(['all', 'free', 'paid'] as PriceFilter[]).map((p) => {
                    const labels = { all: 'Todos', free: 'Grátis', paid: 'Pagos' };
                    const active = priceFilter === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPriceFilter(p);
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left py-3 px-3 rounded-xl text-sm font-semibold ${
                          active
                            ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                            : darkMode
                              ? 'hover:bg-white/5'
                              : 'hover:bg-slate-100'
                        }`}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className={`text-xs font-bold uppercase ${textMuted} mb-2`}>Ordenar</p>
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSort(o.id);
                      setMenuOpen(false);
                    }}
                    className={`w-full text-left py-3 px-3 rounded-xl text-sm font-semibold ${
                      sort === o.id
                        ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                        : darkMode
                          ? 'hover:bg-white/5'
                          : 'hover:bg-slate-100'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {user ? (
        <ExploreAppBottomNav
          darkMode={darkMode}
          exploreActive={null}
          treinosActive
          onSelectInicio={() => {
            stashExploreTabForHomeVisit('inicio');
            navigate('/');
          }}
          onSelectRank={() => {
            stashExploreTabForHomeVisit('rank');
            navigate('/');
          }}
          onSelectEventos={() => {
            stashExploreTabForHomeVisit('eventos');
            navigate('/');
          }}
          onSelectPerfil={() => {
            stashExploreTabForHomeVisit('perfil');
            navigate('/');
          }}
          onSelectTreinos={() => navigate('/treinos')}
        />
      ) : null}
    </div>
  );
}
