import React, { useEffect, useMemo, useState } from 'react';
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
import StatsEvolutionChart from '../components/StatsEvolutionChart';

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
  rebounds: number;
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

type PerfMode = 'total' | 'perGame';

function computePlayerScore(d: PerfilDetalheData): string {
  return (
    (d.points ?? 0) * 1.0 +
    (d.assists ?? 0) * 1.5 +
    (d.rebounds ?? 0) * 1.2 +
    (d.blocks ?? 0) * 1.5 +
    (d.steals ?? 0) * 1.3 +
    (d.clutch_points ?? 0) * 2.0 +
    (d.wins ?? 0) * 3.0
  ).toFixed(1);
}

/** Valores do gráfico: total acumulado ou média por partida (PTS = pontos/jogo; VIT = % vitórias no modo por partida). */
function getPerformanceBars(data: PerfilDetalheData, mode: PerfMode) {
  const pj = Math.max(data.partidas, 1);
  const safe = (n: number) => (Number.isFinite(n) ? n : 0);
  const total = (k: keyof PerfilDetalheData) => safe(Number(data[k]) || 0);
  const winRateRaw =
    data.partidas > 0 ? Math.min(1, Math.max(0, data.wins / data.partidas)) : 0;
  const winRatePct = Math.round(winRateRaw * 100);

  const bars = PERF_BARS.map((s) => {
    if (mode === 'total') {
      return {
        key: s.key,
        label: s.label,
        color: s.color,
        value: total(s.key),
        display: undefined as string | undefined,
      };
    }
    if (s.key === 'wins') {
      return {
        key: s.key,
        label: 'Vit%',
        color: s.color,
        value: winRatePct,
        display: `${winRatePct}%`,
      };
    }
    const v = total(s.key) / pj;
    return {
      key: s.key,
      label: s.label,
      color: s.color,
      value: v,
      display: v >= 10 ? v.toFixed(1) : v.toFixed(2),
    };
  });

  const maxVal = Math.max(...bars.map((b) => b.value), 0.01);
  return { bars, maxVal };
}

function getStatListValue(data: PerfilDetalheData, key: keyof PerfilDetalheData, mode: PerfMode): string {
  const pj = Math.max(data.partidas, 1);
  const t = Number(data[key]) || 0;
  if (mode === 'total') return String(Math.round(t));
  if (key === 'wins') return `${Math.min(100, Math.round((data.wins / pj) * 100))}%`;
  const v = t / pj;
  return v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/* ── Stat bars do gráfico de performance ─────────────────────────── */
const PERF_BARS: { key: keyof PerfilDetalheData; label: string; color: string }[] = [
  { key: 'points',       label: 'Pts',  color: '#10b981' },
  { key: 'wins',         label: 'Vit',  color: '#f59e0b' },
  { key: 'assists',      label: 'Ast',  color: '#06b6d4' },
  { key: 'rebounds',     label: 'Reb',  color: '#14b8a6' },
  { key: 'blocks',       label: 'Blk',  color: '#3b82f6' },
  { key: 'steals',       label: 'Rou',  color: '#8b5cf6' },
  { key: 'clutch_points',label: 'Dec',  color: '#f43f5e' },
];

/* ── Lista estilo "Performed Training" ───────────────────────────── */
const STAT_ROWS: { key: keyof PerfilDetalheData; label: string; emoji: string }[] = [
  { key: 'points',        label: 'Pontos',       emoji: '🏀' },
  { key: 'assists',       label: 'Assistências', emoji: '🤝' },
  { key: 'rebounds',      label: 'Rebotes',      emoji: '📏' },
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
  display,
}: {
  value: number;
  maxValue: number;
  color: string;
  label: string;
  delay: number;
  darkMode: boolean;
  /** Texto exibido acima da barra (ex.: médias com decimais) */
  display?: string;
}) {
  const MAX_PX = 90;
  const heightPx = maxValue > 0 ? Math.max((value / maxValue) * MAX_PX, value > 0 ? 4 : 0) : 0;
  const labelTop =
    display ??
    (value > 0 ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : '');

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span
        className="text-[10px] font-bold tabular-nums"
        style={{ color, minHeight: 14 }}
      >
        {labelTop}
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

/* ── Componente principal ───────────────────────────────────────── */
export default function PerfilDetalhe({ data, darkMode, onBack }: PerfilDetalheProps) {
  const [extra, setExtra] = useState<ProfileExtra | null>(null);
  const [perfMode, setPerfMode] = useState<PerfMode>('total');

  useEffect(() => {
    if (!data.user_id) return;
    supabase
      .from('basquete_users')
      .select('position, jersey_number, bio, height_cm, weight_kg, city, state')
      .eq('id', data.user_id)
      .maybeSingle()
      .then(({ data: p }) => { if (p) setExtra(p as ProfileExtra); });
  }, [data.user_id]);

  const pj = Math.max(data.partidas, 1);
  const winRatePct =
    data.partidas > 0
      ? Math.min(100, Math.max(0, Math.round((data.wins / data.partidas) * 100)))
      : 0;
  const { bars: perfBars, maxVal: perfMaxVal } = getPerformanceBars(data, perfMode);
  const listMax = useMemo(() => {
    if (perfMode === 'total') {
      return Math.max(...STAT_ROWS.map((s) => Number(data[s.key]) || 0), 1);
    }
    return Math.max(...STAT_ROWS.map((s) => (Number(data[s.key]) || 0) / pj), 0.01);
  }, [data, perfMode, pj]);

  const playerScore = computePlayerScore(data);

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

        {/* Score — único destaque no card principal */}
        <div className="border-t border-white/10 px-5 py-8 text-center">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">Score</p>
          <p className="text-5xl sm:text-6xl font-black text-white tabular-nums leading-none tracking-tight">
            {playerScore}
          </p>
        </div>
      </div>

      {/* ── PERFORMANCE (gráfico de barras) ─────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className={cn('font-bold text-base shrink-0', darkMode ? 'text-white' : 'text-slate-900')}>
              Performance
            </h2>
            <div
              className={cn(
                'inline-flex rounded-xl p-1 gap-0.5 w-full sm:w-auto',
                darkMode ? 'bg-slate-800' : 'bg-slate-100'
              )}
              role="tablist"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                role="tab"
                aria-selected={perfMode === 'total'}
                onClick={() => setPerfMode('total')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-2 rounded-lg text-xs font-bold transition-all',
                  perfMode === 'total'
                    ? darkMode
                      ? 'bg-slate-700 text-white shadow'
                      : 'bg-white text-slate-900 shadow-sm'
                    : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Total acumulado
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={perfMode === 'perGame'}
                onClick={() => setPerfMode('perGame')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-2 rounded-lg text-xs font-bold transition-all',
                  perfMode === 'perGame'
                    ? darkMode
                      ? 'bg-slate-700 text-white shadow'
                      : 'bg-white text-slate-900 shadow-sm'
                    : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Por partida
              </button>
            </div>
          </div>

          <div
            className={cn(
              'flex flex-wrap items-center gap-x-6 gap-y-2 text-sm',
              darkMode ? 'text-slate-300' : 'text-slate-600'
            )}
          >
            <span>
              <span className={cn('font-semibold', darkMode ? 'text-slate-500' : 'text-slate-400')}>Partidas </span>
              <span className="font-black tabular-nums">{data.partidas}</span>
            </span>
            <span>
              <span className={cn('font-semibold', darkMode ? 'text-slate-500' : 'text-slate-400')}>Win rate </span>
              <span className="font-black tabular-nums text-amber-500">{winRatePct}%</span>
            </span>
            {perfMode === 'perGame' && data.partidas > 0 && (
              <span className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                Coluna Pts = pontos por jogo
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end gap-1.5 sm:gap-2">
          {perfBars.map((stat, i) => (
            <AnimatedBar
              key={stat.key}
              value={stat.value}
              maxValue={perfMaxVal}
              color={stat.color}
              label={stat.label}
              display={stat.display}
              delay={i * 0.07}
              darkMode={darkMode}
            />
          ))}
        </div>
      </div>

      {/* ── EVOLUÇÃO (gráfico de linha com área) ─────────────────── */}
      {data.user_id && (
        <StatsEvolutionChart userId={data.user_id} darkMode={darkMode} />
      )}

      {/* ── ESTATÍSTICAS (estilo "Performed Training") ───────────── */}
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <div className={cn('px-5 py-4 border-b flex items-center justify-between gap-2', darkMode ? 'border-slate-800' : 'border-slate-100')}>
          <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
            Estatísticas
          </h2>
          <span className={cn('text-[10px] font-semibold uppercase tracking-wide', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            {perfMode === 'total' ? 'Total acumulado' : 'Média por partida'}
          </span>
        </div>

        {STAT_ROWS.map((stat, i) => {
          const rowNum =
            perfMode === 'total' ? Number(data[stat.key]) || 0 : (Number(data[stat.key]) || 0) / pj;
          const pct = listMax > 0 ? (rowNum / listMax) * 100 : 0;
          const valueLabel = getStatListValue(data, stat.key, perfMode);

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
                <span className={cn('font-black text-xl min-w-[3rem] text-right tabular-nums', darkMode ? 'text-white' : 'text-slate-900')}>
                  {valueLabel}
                </span>
                <ChevronRight className={cn('w-4 h-4', darkMode ? 'text-slate-700' : 'text-slate-300')} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BADGES / MARCOS ────────────────────────────────────── */}
      {(() => {
        const THRESHOLDS = [10, 100, 200, 500];
        const BADGE_DEFS: { key: keyof PerfilDetalheData; label: string; emoji: string; colors: string[] }[] = [
          { key: 'points',   label: 'Pontos',       emoji: '🏀', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'assists',  label: 'Assistências', emoji: '🤝', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'rebounds', label: 'Rebotes',      emoji: '📏', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'blocks',   label: 'Tocos',        emoji: '🛡️', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'steals',   label: 'Roubos',       emoji: '⚡', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
          { key: 'wins',     label: 'Vitórias',     emoji: '🏆', colors: ['#a3e635', '#22c55e', '#14b8a6', '#f59e0b'] },
        ];
        const earned: { label: string; emoji: string; threshold: number; color: string; value: number }[] = [];
        for (const def of BADGE_DEFS) {
          const val = Number(data[def.key]) || 0;
          for (let i = 0; i < THRESHOLDS.length; i++) {
            if (val >= THRESHOLDS[i]) {
              earned.push({ label: def.label, emoji: def.emoji, threshold: THRESHOLDS[i], color: def.colors[i], value: val });
            }
          }
        }
        if (earned.length === 0) return null;
        return (
          <div className={cn('rounded-2xl border overflow-hidden', darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
            <div className={cn('px-5 py-4 border-b', darkMode ? 'border-slate-800' : 'border-slate-100')}>
              <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
                Marcos alcançados
              </h2>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {earned.map((b, i) => (
                <motion.div
                  key={`${b.label}-${b.threshold}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border',
                    darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: b.color + '20' }}
                  >
                    {b.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-xs font-bold leading-tight', darkMode ? 'text-white' : 'text-slate-800')}>
                      {b.threshold}+ {b.label}
                    </p>
                    <p className="text-[10px]" style={{ color: b.color }}>
                      {b.value} alcançados
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

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
