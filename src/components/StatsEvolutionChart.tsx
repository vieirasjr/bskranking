import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../supabase';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

/* ── Tipos ──────────────────────────────────────────────────────── */

type StatType = 'points' | 'assists' | 'rebounds' | 'blocks' | 'steals' | 'clutch_points' | 'wins' | 'efficiency';

interface TimeRange {
  label: string;
  value: string;
  days: number;
}

const TIME_RANGES: TimeRange[] = [
  { label: '4 sem',  value: '4w',  days: 28 },
  { label: '3 m',    value: '3m',  days: 90 },
  { label: '6 m',    value: '6m',  days: 180 },
  { label: '1 ano',  value: '1y',  days: 365 },
  { label: '2 anos', value: '2y',  days: 730 },
  { label: '3 anos', value: '3y',  days: 1095 },
  { label: '4 anos', value: '4y',  days: 1460 },
  { label: '5 anos', value: '5y',  days: 1825 },
];

const STAT_OPTIONS: { key: StatType; label: string; color: string }[] = [
  { key: 'efficiency',    label: 'Eficiência',   color: '#f97316' },
  { key: 'points',        label: 'Pontos',       color: '#10b981' },
  { key: 'wins',          label: 'Vitórias',     color: '#f59e0b' },
  { key: 'assists',       label: 'Assistências', color: '#06b6d4' },
  { key: 'rebounds',      label: 'Rebotes',      color: '#14b8a6' },
  { key: 'blocks',        label: 'Tocos',        color: '#3b82f6' },
  { key: 'steals',        label: 'Roubos',       color: '#8b5cf6' },
  { key: 'clutch_points', label: 'Decisivos',    color: '#f43f5e' },
];

const EFF_WEIGHTS: Record<string, number> = {
  points: 1.0, assists: 1.5, rebounds: 1.2, blocks: 1.5,
  steals: 1.3, clutch_points: 2.0, wins: 3.0,
};

/* ── Helpers ────────────────────────────────────────────────────── */

function bucketKey(date: Date, days: number): string {
  if (days <= 28) {
    return date.toISOString().slice(0, 10); // daily
  }
  if (days <= 365) {
    // weekly: ISO week start (Monday)
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  }
  // monthly
  return date.toISOString().slice(0, 7);
}

function bucketLabel(key: string, days: number): string {
  if (days <= 28) {
    const d = new Date(key + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  if (days <= 365) {
    const d = new Date(key + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  }
  const [y, m] = key.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[Number(m) - 1]}/${y.slice(2)}`;
}

function generateBuckets(days: number): string[] {
  const buckets: string[] = [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  if (days <= 28) {
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      buckets.push(d.toISOString().slice(0, 10));
    }
  } else if (days <= 365) {
    const d = new Date(start);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    while (d <= now) {
      buckets.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 7);
    }
  } else {
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= now) {
      buckets.push(d.toISOString().slice(0, 7));
      d.setMonth(d.getMonth() + 1);
    }
  }
  return buckets;
}

/* ── Tooltip customizado ────────────────────────────────────────── */

function CustomTooltip({ active, payload, label, darkMode, days }: {
  active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string; darkMode: boolean; days: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn(
      'rounded-xl px-3 py-2 text-xs shadow-xl border backdrop-blur-md',
      darkMode ? 'bg-slate-800/90 border-slate-700 text-white' : 'bg-white/90 border-slate-200 text-slate-900'
    )}>
      <p className={cn('font-semibold mb-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>
        {label ? bucketLabel(label, days) : ''}
      </p>
      {payload.map((p) => {
        const opt = STAT_OPTIONS.find(s => s.key === p.dataKey);
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="font-medium">{opt?.label ?? p.dataKey}:</span>
            <span className="font-bold tabular-nums">{p.dataKey === 'efficiency' ? p.value.toFixed(1) : p.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────── */

interface StatsEvolutionChartProps {
  userId: string;
  darkMode: boolean;
}

export default function StatsEvolutionChart({ userId, darkMode }: StatsEvolutionChartProps) {
  const [range, setRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [activeStats, setActiveStats] = useState<Set<StatType>>(new Set(['points']));
  const [rawLogs, setRawLogs] = useState<Array<{ stat_type: string; value: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [chartKey, setChartKey] = useState(0); // force re-mount for animation

  const toggleStat = useCallback((key: StatType) => {
    setActiveStats(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setChartKey(k => k + 1);
  }, []);

  const handleRangeChange = useCallback((r: TimeRange) => {
    setRange(r);
    setChartKey(k => k + 1);
  }, []);

  // Fetch stat_logs
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - range.days);

    supabase
      .from('stat_logs')
      .select('stat_type, value, created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setRawLogs(data ?? []);
        setLoading(false);
      });
  }, [userId, range]);

  // Build chart data
  const chartData = useMemo(() => {
    const buckets = generateBuckets(range.days);
    const dataMap: Record<string, Record<string, number>> = {};
    for (const b of buckets) {
      dataMap[b] = {};
    }

    for (const log of rawLogs) {
      const d = new Date(log.created_at);
      const bk = bucketKey(d, range.days);
      if (!dataMap[bk]) dataMap[bk] = {};
      dataMap[bk][log.stat_type] = (dataMap[bk][log.stat_type] ?? 0) + log.value;
    }

    return buckets.map(bk => {
      const stats = dataMap[bk] ?? {};
      const eff = Object.entries(EFF_WEIGHTS).reduce(
        (sum, [k, w]) => sum + (stats[k] ?? 0) * w, 0
      );
      return {
        bucket: bk,
        label: bucketLabel(bk, range.days),
        points: stats.points ?? 0,
        assists: stats.assists ?? 0,
        rebounds: stats.rebounds ?? 0,
        blocks: stats.blocks ?? 0,
        steals: stats.steals ?? 0,
        clutch_points: stats.clutch_points ?? 0,
        wins: stats.wins ?? 0,
        efficiency: Math.round(eff * 10) / 10,
      };
    });
  }, [rawLogs, range]);

  const visibleStats = useMemo(
    () => STAT_OPTIONS.filter(s => activeStats.has(s.key)),
    [activeStats]
  );

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    )}>
      {/* Header */}
      <div className={cn('px-5 pt-5 pb-3', darkMode ? '' : '')}>
        <h2 className={cn('font-bold text-base mb-3', darkMode ? 'text-white' : 'text-slate-900')}>
          Evolução
        </h2>

        {/* Time range selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handleRangeChange(r)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                range.value === r.value
                  ? darkMode
                    ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                    : 'bg-orange-500 text-white shadow-sm'
                  : darkMode
                    ? 'bg-slate-800 text-slate-500 hover:text-slate-300'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Stat toggles */}
        <div className="flex flex-wrap gap-1.5">
          {STAT_OPTIONS.map((s) => {
            const active = activeStats.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleStat(s.key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border',
                  active
                    ? 'border-transparent'
                    : darkMode
                      ? 'border-slate-700 bg-slate-800/50 text-slate-500 hover:text-slate-300'
                      : 'border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600'
                )}
                style={active ? {
                  backgroundColor: s.color + '18',
                  color: s.color,
                  borderColor: s.color + '30',
                } : undefined}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? s.color : 'currentColor', opacity: active ? 1 : 0.3 }} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-4" style={{ height: 220 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={chartKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className={cn('text-xs', darkMode ? 'text-slate-600' : 'text-slate-400')}>Sem dados no período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                  <defs>
                    {visibleStats.map(s => (
                      <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={darkMode ? '#1e293b' : '#f1f5f9'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: darkMode ? '#475569' : '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: darkMode ? '#475569' : '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<CustomTooltip darkMode={darkMode} days={range.days} />}
                    cursor={{ stroke: darkMode ? '#334155' : '#e2e8f0', strokeDasharray: '4 4' }}
                  />
                  {visibleStats.map(s => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      fill={`url(#grad-${s.key})`}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, fill: darkMode ? '#0f172a' : '#fff' }}
                      animationDuration={800}
                      animationEasing="ease-in-out"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
