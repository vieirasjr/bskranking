import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  User,
  ChevronRight,
  MapPin,
  Ruler,
  Scale,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../supabase';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export interface PerfilDetalheData {
  id: string;
  user_id?: string | null;
  name: string;
  partidas: number;
  wins: number;
  points: number;
  blocks: number;
  steals: number;
  clutch_points: number;
  assists: number;
  avatar_url?: string | null;
}

interface ProfileExtra {
  position: string | null;
  jersey_number: number | null;
  bio: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  city: string | null;
  state: string | null;
}

interface PerfilDetalheProps {
  data: PerfilDetalheData;
  darkMode: boolean;
  onBack: () => void;
}

/* ── Stat bars do gráfico de performance ─────────────────────────── */
const PERF_BARS: { key: keyof PerfilDetalheData; label: string; color: string }[] = [
  { key: 'points',       label: 'Pts',  color: '#10b981' },
  { key: 'wins',         label: 'Vit',  color: '#f59e0b' },
  { key: 'assists',      label: 'Ast',  color: '#06b6d4' },
  { key: 'blocks',       label: 'Blk',  color: '#3b82f6' },
  { key: 'steals',       label: 'Rou',  color: '#8b5cf6' },
  { key: 'clutch_points',label: 'Dec',  color: '#f43f5e' },
];

/* ── Lista estilo "Performed Training" ───────────────────────────── */
const STAT_ROWS: { key: keyof PerfilDetalheData; label: string; emoji: string }[] = [
  { key: 'points',        label: 'Pontos',       emoji: '🏀' },
  { key: 'assists',       label: 'Assistências', emoji: '🤝' },
  { key: 'blocks',        label: 'Tocos',        emoji: '🛡️' },
  { key: 'steals',        label: 'Roubos',       emoji: '⚡' },
  { key: 'clutch_points', label: 'Decisivos',    emoji: '🎯' },
];

/* ── Barra animada vertical ─────────────────────────────────────── */
function AnimatedBar({
  value,
  maxValue,
  color,
  label,
  delay,
  darkMode,
}: {
  value: number;
  maxValue: number;
  color: string;
  label: string;
  delay: number;
  darkMode: boolean;
}) {
  const MAX_PX = 90;
  const heightPx = maxValue > 0 ? Math.max((value / maxValue) * MAX_PX, value > 0 ? 4 : 0) : 0;

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span
        className="text-[10px] font-bold tabular-nums"
        style={{ color, minHeight: 14 }}
      >
        {value > 0 ? value : ''}
      </span>

      {/* track */}
      <div
        className={cn('w-full rounded-lg flex items-end', darkMode ? 'bg-slate-800' : 'bg-slate-100')}
        style={{ height: MAX_PX }}
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: heightPx }}
          transition={{ duration: 0.65, delay, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ backgroundColor: color, width: '100%', borderRadius: 6 }}
        />
      </div>

      <span
        className={cn('text-[9px] font-semibold uppercase tracking-wide', darkMode ? 'text-slate-500' : 'text-slate-400')}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Anel de win-rate SVG animado ───────────────────────────────── */
function WinRateRing({ rate, darkMode }: { rate: number; darkMode: boolean }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;

  return (
    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={darkMode ? '#1e293b' : '#f1f5f9'} strokeWidth="8"
        />
        <motion.circle
          cx="40" cy="40" r={r} fill="none"
          stroke="#f59e0b" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className={cn('text-base font-black leading-none', darkMode ? 'text-white' : 'text-slate-900')}>
          {rate}%
        </p>
        <p className={cn('text-[8px] font-bold uppercase tracking-wide', darkMode ? 'text-slate-500' : 'text-slate-400')}>
          win
        </p>
      </div>
    </div>
  );
}

/* ── Barra de progresso horizontal animada ──────────────────────── */
function ProgressBar({ pct, color = '#f97316', delay = 0 }: { pct: number; color?: string; delay?: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay, ease: 'easeOut' }}
      />
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────── */
export default function PerfilDetalhe({ data, darkMode, onBack }: PerfilDetalheProps) {
  const [extra, setExtra] = useState<ProfileExtra | null>(null);

  useEffect(() => {
    if (!data.user_id) return;
    supabase
      .from('basquete_users')
      .select('position, jersey_number, bio, height_cm, weight_kg, city, state')
      .eq('id', data.user_id)
      .maybeSingle()
      .then(({ data: p }) => { if (p) setExtra(p as ProfileExtra); });
  }, [data.user_id]);

  const maxVal = Math.max(...PERF_BARS.map((s) => Number(data[s.key]) || 0), 1);
  const winRate = data.partidas > 0 ? Math.round((data.wins / data.partidas) * 100) : 0;
  const avgPts = data.partidas > 0 ? (data.points / data.partidas).toFixed(1) : '0.0';
  const losses = data.partidas - data.wins;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── HERO ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: darkMode
            ? 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #431407 100%)'
            : 'linear-gradient(145deg, #0f172a 0%, #1c1917 50%, #7c2d12 100%)',
        }}
      >
        {/* back */}
        <div className="px-5 pt-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-semibold transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        {/* avatar + nome */}
        <div className="px-5 pt-5 pb-6 flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.05 }}
            className="shrink-0"
          >
            <div className="w-20 h-20 rounded-full border-[3px] border-orange-400 overflow-hidden shadow-xl shadow-black/50">
              {data.avatar_url ? (
                <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <User className="w-10 h-10 text-slate-400" />
                </div>
              )}
            </div>
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {extra?.position ?? 'Atleta'}
              {extra?.jersey_number != null && (
                <span className="ml-2 text-white/40">#{extra.jersey_number}</span>
              )}
            </p>
            <motion.h1
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-white text-2xl font-black leading-tight truncate"
            >
              {data.name}
            </motion.h1>
            {(extra?.city || extra?.height_cm) && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {extra?.city && (
                  <span className="flex items-center gap-1 text-white/40 text-[10px]">
                    <MapPin className="w-2.5 h-2.5" />
                    {extra.city}{extra.state ? `, ${extra.state}` : ''}
                  </span>
                )}
                {extra?.height_cm && (
                  <span className="flex items-center gap-1 text-white/40 text-[10px]">
                    <Ruler className="w-2.5 h-2.5" />
                    {extra.height_cm}cm
                  </span>
                )}
                {extra?.weight_kg && (
                  <span className="flex items-center gap-1 text-white/40 text-[10px]">
                    <Scale className="w-2.5 h-2.5" />
                    {extra.weight_kg}kg
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* mini stats row */}
        <div className="grid grid-cols-3 border-t border-white/10">
          {[
            { value: data.partidas, label: 'Partidas' },
            { value: `${winRate}%`, label: 'Win Rate' },
            { value: avgPts, label: 'Pts/Jogo' },
          ].map((item, i) => (
            <div
              key={i}
              className={cn(
                'py-3 text-center',
                i < 2 && 'border-r border-white/10'
              )}
            >
              <p className="text-white font-black text-xl leading-none">{item.value}</p>
              <p className="text-white/40 text-[9px] font-semibold uppercase tracking-wide mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PERFORMANCE (gráfico de barras) ─────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
            Performance
          </h2>
          <span className={cn('text-[10px] font-semibold uppercase tracking-wide', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            Total acumulado
          </span>
        </div>

        <div className="flex items-end gap-2">
          {PERF_BARS.map((stat, i) => (
            <AnimatedBar
              key={stat.key}
              value={Number(data[stat.key]) || 0}
              maxValue={maxVal}
              color={stat.color}
              label={stat.label}
              delay={i * 0.07}
              darkMode={darkMode}
            />
          ))}
        </div>
      </div>

      {/* ── ATIVIDADE ───────────────────────────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <h2 className={cn('font-bold text-base mb-4', darkMode ? 'text-white' : 'text-slate-900')}>
          Atividade
        </h2>

        <div className="flex items-center gap-5">
          {/* Win rate ring */}
          <WinRateRing rate={winRate} darkMode={darkMode} />

          {/* breakdown */}
          <div className="flex-1 space-y-2.5">
            {[
              { label: 'Vitórias', value: data.wins, color: '#f59e0b', pct: winRate },
              { label: 'Derrotas', value: losses, color: '#f43f5e', pct: data.partidas > 0 ? Math.round((losses / data.partidas) * 100) : 0 },
            ].map((row, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-semibold', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    {row.label}
                  </span>
                  <span className="text-sm font-black" style={{ color: row.color }}>
                    {row.value}
                  </span>
                </div>
                <ProgressBar pct={row.pct} color={row.color} delay={0.3 + i * 0.15} />
              </div>
            ))}
          </div>
        </div>

        {/* pontos por jogo destaque */}
        {data.partidas > 0 && (
          <div
            className={cn(
              'mt-4 rounded-xl p-3 flex items-center justify-between',
              darkMode ? 'bg-slate-800' : 'bg-slate-50'
            )}
          >
            <span className={cn('text-xs font-semibold', darkMode ? 'text-slate-400' : 'text-slate-500')}>
              Média de pontos por partida
            </span>
            <span className={cn('text-lg font-black text-orange-500')}>
              {avgPts}
            </span>
          </div>
        )}
      </div>

      {/* ── ESTATÍSTICAS (estilo "Performed Training") ───────────── */}
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className={cn('px-5 py-4 border-b', darkMode ? 'border-slate-800' : 'border-slate-100')}>
          <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
            Estatísticas
          </h2>
        </div>

        {STAT_ROWS.map((stat, i) => {
          const value = Number(data[stat.key]) || 0;
          const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;

          return (
            <div
              key={stat.key}
              className={cn(
                'px-5 py-4 flex items-center gap-4 border-b last:border-b-0',
                darkMode ? 'border-slate-800' : 'border-slate-50'
              )}
            >
              <span className="text-2xl w-8 text-center shrink-0">{stat.emoji}</span>

              <div className="flex-1 min-w-0">
                <p className={cn('font-semibold text-sm', darkMode ? 'text-slate-200' : 'text-slate-800')}>
                  {stat.label}
                </p>
                <div className={cn('mt-1.5 h-1.5 rounded-full overflow-hidden', darkMode ? 'bg-slate-800' : 'bg-slate-100')}>
                  <motion.div
                    className="h-full rounded-full bg-orange-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('font-black text-xl w-10 text-right tabular-nums', darkMode ? 'text-white' : 'text-slate-900')}>
                  {value}
                </span>
                <ChevronRight className={cn('w-4 h-4', darkMode ? 'text-slate-700' : 'text-slate-300')} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BIO ─────────────────────────────────────────────────── */}
      {extra?.bio && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <h2 className={cn('font-bold text-base mb-2', darkMode ? 'text-white' : 'text-slate-900')}>
            Sobre
          </h2>
          <p className={cn('text-sm leading-relaxed', darkMode ? 'text-slate-400' : 'text-slate-600')}>
            {extra.bio}
          </p>
        </div>
      )}
    </motion.div>
  );
}
