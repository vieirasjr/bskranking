/**
 * Página de detalhe do perfil de atleta - visual moderno, jovem, foco em evolução e treino
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Dumbbell,
  Trophy,
  Target,
  Shield,
  Zap,
  TrendingUp,
  Award,
  Activity,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export interface PerfilDetalheData {
  id: string;
  name: string;
  partidas: number;
  wins: number;
  points: number;
  blocks: number;
  steals: number;
  clutch_points: number;
  avatar_url?: string | null;
}

interface PerfilDetalheProps {
  data: PerfilDetalheData;
  darkMode: boolean;
  onBack: () => void;
}

const SKILLS = [
  { key: 'partidas' as const, label: 'Partidas', icon: Dumbbell, color: 'from-cyan-500 to-sky-600' },
  { key: 'wins' as const, label: 'Vitórias', icon: Trophy, color: 'from-amber-500 to-orange-600' },
  { key: 'points' as const, label: 'Pontos', icon: Target, color: 'from-emerald-500 to-teal-600' },
  { key: 'blocks' as const, label: 'Tocos', icon: Shield, color: 'from-blue-500 to-indigo-600' },
  { key: 'steals' as const, label: 'Roubos', icon: Zap, color: 'from-violet-500 to-purple-600' },
  { key: 'clutch_points' as const, label: 'Decisivos', icon: Award, color: 'from-rose-500 to-pink-600' },
] as const;

export default function PerfilDetalhe({ data, darkMode, onBack }: PerfilDetalheProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen"
    >
      {/* Header com gradiente */}
      <div
        className={cn(
          'relative overflow-hidden rounded-b-[2rem] pb-8',
          darkMode
            ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950/30'
            : 'bg-gradient-to-br from-slate-900 via-orange-900/40 to-amber-900/20'
        )}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative px-4 pt-6">
          <button
            onClick={onBack}
            className={cn(
              'flex items-center gap-2 p-2 -ml-2 rounded-xl transition-all active:scale-95',
              darkMode ? 'text-white/90 hover:bg-white/10' : 'text-white/90 hover:bg-white/20'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-sm">Voltar</span>
          </button>

          <div className="flex flex-col items-center mt-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
              className="relative"
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-orange-500/40 ring-offset-4 ring-offset-transparent shadow-2xl shadow-orange-500/20">
                {data.avatar_url ? (
                  <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={cn('w-full h-full flex items-center justify-center text-4xl font-black', darkMode ? 'bg-slate-700 text-orange-400' : 'bg-slate-200 text-orange-600')}>
                    {data.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="absolute -bottom-1 -right-1 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <Activity className="w-5 h-5 text-white" />
              </motion.div>
            </motion.div>
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={cn('text-2xl sm:text-3xl font-black mt-6 tracking-tight', darkMode ? 'text-white' : 'text-white')}
            >
              {data.name}
            </motion.h1>
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={cn('flex items-center gap-1.5 mt-1 text-sm font-semibold', darkMode ? 'text-orange-400' : 'text-orange-200')}
            >
              <TrendingUp className="w-4 h-4" />
              Atleta em evolução
            </motion.p>
          </div>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="px-4 -mt-4 space-y-4">
        {SKILLS.map((skill, i) => {
          const Icon = skill.icon;
          const value = data[skill.key] ?? 0;
          return (
            <motion.div
              key={skill.key}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 * i }}
              className={cn(
                'p-5 rounded-2xl border flex items-center gap-4 transition-all',
                darkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-lg shadow-slate-200/50'
              )}
            >
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br', skill.color)}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-bold uppercase tracking-wider', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                  {skill.label}
                </p>
                <p className={cn('text-2xl font-black', darkMode ? 'text-white' : 'text-slate-900')}>
                  {value}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('text-xs font-medium', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {value === 0 ? 'Em progresso' : value === 1 ? '1 registro' : `${value} registros`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Rodapé motivacional */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className={cn(
          'mx-4 mt-8 mb-12 p-6 rounded-2xl text-center border',
          darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-orange-50 border-orange-200'
        )}
      >
        <p className={cn('text-sm font-medium italic', darkMode ? 'text-slate-400' : 'text-orange-800/80')}>
          "Cada treino é um passo. Cada partida é uma conquista."
        </p>
        <p className={cn('mt-2 text-xs', darkMode ? 'text-slate-500' : 'text-slate-500')}>
          Basquete Next • Evolução em tempo real
        </p>
      </motion.div>
    </motion.div>
  );
}
