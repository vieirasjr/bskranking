import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Dumbbell, Sparkles } from 'lucide-react';
import { getThemeDarkStored } from '../lib/appStorage';

export default function TreinosPage() {
  const navigate = useNavigate();
  const darkMode = getThemeDarkStored() !== 'false';

  return (
    <div className={darkMode ? 'min-h-screen bg-[#07090f] text-white' : 'min-h-screen bg-slate-50 text-slate-900'}>
      <header className={`sticky top-0 z-20 backdrop-blur border-b ${darkMode ? 'bg-[#07090f]/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => navigate('/')} className={`p-2 -ml-2 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black flex-1">Treinos</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
        <div className="relative flex items-center justify-center">
          {/* Anéis pulsantes */}
          <motion.div
            aria-hidden
            className="absolute w-60 h-60 rounded-full border-2 border-orange-500/40"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="absolute w-60 h-60 rounded-full border-2 border-orange-500/30"
            animate={{ scale: [1, 1.7, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
          />
          <motion.div
            aria-hidden
            className="absolute w-60 h-60 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.22), transparent 60%)' }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Haltere flutuando */}
          <motion.div
            className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-700 shadow-2xl shadow-orange-500/40 flex items-center justify-center"
            animate={{ y: [0, -10, 0], rotate: [-4, 4, -4] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Dumbbell className="w-14 h-14 text-white" strokeWidth={2.2} />

            {/* Brilho */}
            <motion.div
              aria-hidden
              className="absolute -top-2 -right-2"
              animate={{ rotate: [0, 360], scale: [0.9, 1.2, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-6 h-6 text-amber-300" />
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-10 text-center"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] font-bold uppercase tracking-widest">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-orange-400"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            Em breve
          </span>

          <h2 className={`mt-4 text-3xl sm:text-4xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Treinos chegando
          </h2>
          <p className={`mt-3 text-sm sm:text-base max-w-md mx-auto leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Uma nova experiência de treinos guiados, rotinas personalizadas
            e acompanhamento de desempenho está a caminho.
          </p>

          <div className="mt-8 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-orange-500"
                animate={{ opacity: [0.25, 1, 0.25], y: [0, -6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-10 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all"
          >
            Voltar para o início
          </button>
        </motion.div>
      </main>
    </div>
  );
}
