import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  MoreHorizontal,
  Play,
  ShieldCheck,
  ShoppingCart,
  Star,
  User,
} from 'lucide-react';
import { useMainExploreShell } from '../contexts/MainExploreShellContext';
import { stashExploreTabForHomeVisit } from '../lib/appStorage';
import {
  getTreinoCursoBySlug,
  TREINO_NIVEL_LABEL,
  formatTreinoPrice,
} from '../lib/mockTreinos';

export default function TreinoCursoDetalhePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { darkMode, registerProfileOpener, setTopBarTrailing } = useMainExploreShell();
  const curso = slug ? getTreinoCursoBySlug(slug) : undefined;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    registerProfileOpener(() => {
      stashExploreTabForHomeVisit('perfil');
      navigate('/');
    });
    return () => registerProfileOpener(null);
  }, [registerProfileOpener, navigate]);

  useEffect(() => {
    setTopBarTrailing(null);
    return () => setTopBarTrailing(null);
  }, [setTopBarTrailing]);

  const bg = darkMode ? 'bg-[#121212]' : 'bg-slate-100';
  const card = darkMode ? 'bg-[#1E1E1E]' : 'bg-white';
  const muted = darkMode ? 'text-[#A0A0A0]' : 'text-slate-600';
  const borderSubtle = darkMode ? 'border-white/8' : 'border-slate-200';

  if (!curso) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-[#121212] text-white' : 'bg-slate-100 text-slate-900'} pb-8`}>
        <div className="max-w-lg mx-auto px-4 pt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/treinos')}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              darkMode ? 'bg-[#1E1E1E]' : 'bg-white shadow-sm'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black">Curso não encontrado</h1>
        </div>
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className={muted}>Este programa não existe ou foi removido.</p>
          <button
            type="button"
            onClick={() => navigate('/treinos')}
            className="mt-8 w-full py-4 rounded-[20px] bg-[#FF6B00] text-white font-black"
          >
            Ver todos os treinos
          </button>
        </main>
      </div>
    );
  }

  const free = curso.priceBrl <= 0;

  const handleBuy = () => {
    setToast(
      free
        ? 'Em breve: inscrição gratuita com sua conta Braska.'
        : 'Checkout em desenvolvimento. Em breve você poderá pagar com PIX ou cartão.',
    );
    window.setTimeout(() => setToast(null), 4200);
  };

  const scrollToModules = () => {
    document.getElementById('modulos-treino')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={`min-h-screen ${bg} ${darkMode ? 'text-white' : 'text-slate-900'} pb-36 max-sm:pb-[max(9rem,env(safe-area-inset-bottom))]`}
    >
      <div className="relative h-[42vh] min-h-[260px] max-h-[400px]">
        <div className={`absolute inset-0 bg-gradient-to-br ${curso.coverClass}`} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[clamp(4rem,20vw,7rem)] drop-shadow-2xl opacity-90">{curso.instructor.avatarEmoji ?? '🏀'}</span>
        </div>
        <div className="absolute inset-x-0 top-0 p-4 flex justify-between items-start max-w-lg mx-auto sm:max-w-2xl lg:max-w-3xl">
          <button
            type="button"
            onClick={() => navigate('/treinos')}
            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white border border-white/15"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white border border-white/15"
            aria-label="Mais opções"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-4 left-0 right-0 px-4 flex items-end justify-between gap-3 max-w-lg mx-auto sm:max-w-2xl lg:max-w-3xl">
          <div className="flex flex-1 min-w-0 items-center gap-2 pl-1 pr-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15">
            <span className="w-11 h-11 rounded-full bg-[#1E1E1E] flex items-center justify-center text-xl shrink-0 border border-white/10">
              {curso.instructor.avatarEmoji ?? '👤'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-white truncate">{curso.instructor.name}</p>
              <p className="text-[11px] text-white/75 truncate">{curso.instructor.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToModules}
            className="shrink-0 w-14 h-14 rounded-full bg-[#FF6B00] flex items-center justify-center shadow-xl border-2 border-white/20"
            aria-label="Ver módulos"
          >
            <ArrowUpRight className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>

      <div
        className={`relative z-10 -mt-6 rounded-t-[28px] px-4 pt-8 pb-6 max-w-lg mx-auto sm:max-w-2xl lg:max-w-3xl ${bg}`}
      >
        {curso.isBestseller ? (
          <span className="inline-block px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wide mb-2">
            Mais vendido
          </span>
        ) : null}
        {curso.isNew ? (
          <span className="inline-block ml-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wide mb-2">
            Novo
          </span>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-[1.75rem] font-black leading-tight">{curso.title}</h1>
          <p className={`mt-2 text-base font-semibold ${muted}`}>{curso.subtitle}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <strong>{curso.ratingAvg.toFixed(1)}</strong>
              <span className={muted}>({curso.ratingCount})</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 ${muted}`}>
              <GraduationCap className="w-4 h-4 text-[#FF6B00]" />
              {curso.studentsCount.toLocaleString('pt-BR')} alunos
            </span>
          </div>
        </motion.div>

        <div className={`grid grid-cols-3 gap-2 mt-6 p-4 rounded-[22px] border ${borderSubtle} ${card}`}>
          <div className="text-center">
            <BookOpen className="w-5 h-5 mx-auto text-[#FF6B00]" />
            <p className="text-xl font-black mt-1">{curso.lessonCount}</p>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Aulas</p>
          </div>
          <div className={`text-center border-x ${borderSubtle}`}>
            <Play className="w-5 h-5 mx-auto text-[#FF6B00]" />
            <p className="text-xl font-black mt-1">{curso.videoHours}h</p>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Vídeo</p>
          </div>
          <div className="text-center">
            <Clock className="w-5 h-5 mx-auto text-[#FF6B00]" />
            <p className="text-xl font-black mt-1 leading-none pt-0.5">{TREINO_NIVEL_LABEL[curso.level]}</p>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Nível</p>
          </div>
        </div>

        <section className={`mt-6 p-4 rounded-[22px] border border-[#FF6B00]/25 ${darkMode ? 'bg-[#FF6B00]/08' : 'bg-orange-50'}`}>
          <h2 className="text-sm font-black text-[#FF6B00] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
            Resumo técnico
          </h2>
          <p className={`mt-2 text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {curso.technicalSummary}
          </p>
        </section>

        <h2 id="modulos-treino" className="text-lg font-black mt-8 mb-3 scroll-mt-24">
          Módulos do programa
        </h2>
        <div className="space-y-3">
          {curso.modules.map((mod, i) => (
            <div
              key={`${mod.title}-${i}`}
              className={`flex items-center gap-3 p-3 rounded-[22px] border ${borderSubtle} ${card}`}
            >
              <div
                className={`w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br ${curso.coverClass} flex items-center justify-center text-2xl opacity-95`}
              >
                {curso.instructor.avatarEmoji ?? '📹'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-snug">{mod.title}</p>
                <p className={`text-xs mt-1 leading-snug ${muted}`}>
                  {mod.durationMin} min · {mod.subtitle}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 w-11 h-11 rounded-full bg-[#FF6B00] flex items-center justify-center"
                aria-label={`Aula ${i + 1}`}
              >
                <Play className="w-5 h-5 text-white fill-white/95" />
              </button>
            </div>
          ))}
        </div>

        <section className={`mt-8 rounded-[22px] border overflow-hidden ${borderSubtle}`}>
          <div className={`px-4 py-3 font-bold text-sm flex items-center gap-2 ${card}`}>
            <User className="w-4 h-4 text-[#FF6B00]" />
            Professor responsável
          </div>
          <div className={`p-4 ${darkMode ? 'bg-[#1a1a1a]' : 'bg-slate-50'}`}>
            <div className="flex gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${borderSubtle} ${card}`}
              >
                {curso.instructor.avatarEmoji ?? '👤'}
              </div>
              <div>
                <p className="font-black">{curso.instructor.name}</p>
                <p className="text-sm font-semibold text-[#FF6B00]">{curso.instructor.role}</p>
                <p className={`text-sm mt-2 leading-relaxed ${muted}`}>{curso.instructor.bio}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-black mb-2">Sobre o programa</h2>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{curso.description}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-black mb-3">O que você vai aprender</h2>
          <ul className="space-y-2.5">
            {curso.whatYouLearn.map((item) => (
              <li key={item} className="flex gap-3 text-sm">
                <Check className="w-5 h-5 shrink-0 text-emerald-500" />
                <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {curso.requirements.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-black mb-3">Requisitos</h2>
            <ul className={`space-y-1.5 text-sm list-disc list-inside ${muted}`}>
              {curso.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-6">
          {curso.tags.map((t) => (
            <span key={t} className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${borderSubtle} ${card}`}>
              #{t}
            </span>
          ))}
        </div>

        {curso.includesCertificate ? (
          <div className={`flex items-center gap-3 mt-8 rounded-[22px] border p-4 ${borderSubtle} ${card}`}>
            <Award className="w-10 h-10 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">Certificado de conclusão</p>
              <p className={`text-sm ${muted}`}>Disponível após concluir todas as aulas (em lançamento).</p>
            </div>
          </div>
        ) : null}

        <div className={`hidden sm:flex mt-10 rounded-[22px] border p-5 items-end justify-between gap-4 flex-wrap ${borderSubtle} ${card}`}>
          <div>
            {curso.originalPriceBrl && curso.originalPriceBrl > curso.priceBrl ? (
              <p className={`text-sm line-through ${muted}`}>{formatTreinoPrice(curso.originalPriceBrl)}</p>
            ) : null}
            <p className={`text-3xl font-black ${free ? 'text-emerald-400' : ''}`}>{formatTreinoPrice(curso.priceBrl)}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${muted}`}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Pagamento seguro em breve
            </p>
          </div>
          <button
            type="button"
            onClick={handleBuy}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-[20px] bg-[#FF6B00] hover:bg-[#e86200] text-white font-black text-sm transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {free ? 'Inscrever-se grátis' : 'Comprar agora'}
          </button>
        </div>
      </div>

      <div
        className={`fixed z-40 p-4 left-0 right-0 bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t pt-10 sm:hidden ${
          darkMode ? 'from-[#121212] via-[#121212]' : 'from-slate-100 via-slate-100'
        } to-transparent`}
      >
        <button
          type="button"
          onClick={handleBuy}
          className="w-full py-4 rounded-[22px] bg-[#FF6B00] text-white font-black text-base shadow-xl shadow-orange-900/30 flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          {free ? 'Inscrever-se grátis' : 'Comprar agora'}
        </button>
        <div className={`flex items-center justify-center gap-3 mt-2 text-xs ${muted}`}>
          {curso.originalPriceBrl && curso.originalPriceBrl > curso.priceBrl ? (
            <span className="line-through">{formatTreinoPrice(curso.originalPriceBrl)}</span>
          ) : null}
          <span className={`font-black text-sm ${free ? 'text-emerald-500' : darkMode ? 'text-white' : 'text-slate-900'}`}>
            {formatTreinoPrice(curso.priceBrl)}
          </span>
        </div>
      </div>

      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed left-4 right-4 z-[60] max-w-md mx-auto px-4 py-3 rounded-2xl bg-[#1E1E1E] text-white text-sm font-semibold shadow-xl border border-white/10 text-center bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] max-sm:bottom-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))]"
        >
          {toast}
        </motion.div>
      ) : null}
    </div>
  );
}
