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

type StatType =
  | 'points' | 'assists' | 'rebounds' | 'blocks' | 'steals' | 'clutch_points' | 'wins'
  | 'shot_1_miss' | 'shot_2_miss' | 'shot_3_miss' | 'turnovers'
  | 'efficiency';

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
  { key: 'shot_1_miss',   label: 'Arr. 1 errado', color: '#fb7185' },
  { key: 'shot_2_miss',   label: 'Arr. 2 errado', color: '#f87171' },
  { key: 'shot_3_miss',   label: 'Arr. 3 errado', color: '#ef4444' },
  { key: 'turnovers',     label: 'Turnovers',     color: '#dc2626' },
];

// Pesos da eficiência — mesma fórmula do PerfilDetalhe e do ranking:
//   acertos - erros_ponderados
// Aplicada sobre os totais do dia (cada ponto = um dia com sessão).
const EFF_WEIGHTS: Record<string, number> = {
  points: 1.0, assists: 1.5, rebounds: 1.2, blocks: 1.5,
  steals: 1.3, clutch_points: 2.0, wins: 3.0,
  shot_1_miss: -0.4, shot_2_miss: -0.8, shot_3_miss: -1.2, turnovers: -1.0,
};

/* ── Helpers ────────────────────────────────────────────────────── */

const DAY_TZ = 'America/Sao_Paulo';

type RawLogRow = { stat_type: string; value: number; created_at: string };

/** Chave YYYY-MM-DD no fuso de São Paulo (um bucket = um dia com jogo). */
function dayKeySaoPaulo(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function dayLabelPt(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ── Tooltip customizado ────────────────────────────────────────── */

function CustomTooltip({ active, payload, label, darkMode }: {
  active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string; darkMode: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn(
      'rounded-xl px-3 py-2 text-xs shadow-xl border backdrop-blur-md',
      darkMode ? 'bg-slate-800/90 border-slate-700 text-white' : 'bg-white/90 border-slate-200 text-slate-900'
    )}>
      <p className={cn('font-semibold mb-1', darkMode ? 'text-slate-400' : 'text-slate-500')}>
        {label ?? ''}
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
  const [rawLogs, setRawLogs] = useState<RawLogRow[]>([]);
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

  // Um ponto por dia em que houve registro (fuso São Paulo). Sem dias “vazios” no eixo.
  const chartData = useMemo(() => {
    const keys = [
      'points', 'assists', 'rebounds', 'blocks', 'steals', 'clutch_points', 'wins',
      'shot_1_miss', 'shot_2_miss', 'shot_3_miss', 'turnovers',
    ] as const;

    const byDay = new Map<string, RawLogRow[]>();
    for (const log of rawLogs) {
      const dk = dayKeySaoPaulo(log.created_at);
      const arr = byDay.get(dk);
      if (arr) arr.push(log);
      else byDay.set(dk, [log]);
    }

    const sortedDays = [...byDay.keys()].sort();

    return sortedDays.map((dayKey) => {
      const logs = byDay.get(dayKey) ?? [];
      const sums: Record<string, number> = {};
      for (const k of keys) sums[k] = 0;
      for (const log of logs) {
        sums[log.stat_type] = (sums[log.stat_type] ?? 0) + log.value;
      }
      const rawEff = Object.entries(EFF_WEIGHTS).reduce(
        (sum, [k, w]) => sum + (sums[k] ?? 0) * w,
        0
      );
      return {
        dayKey,
        label: dayLabelPt(dayKey),
        points: sums.points ?? 0,
        assists: sums.assists ?? 0,
        rebounds: sums.rebounds ?? 0,
        blocks: sums.blocks ?? 0,
        steals: sums.steals ?? 0,
        clutch_points: sums.clutch_points ?? 0,
        wins: sums.wins ?? 0,
        shot_1_miss: sums.shot_1_miss ?? 0,
        shot_2_miss: sums.shot_2_miss ?? 0,
        shot_3_miss: sums.shot_3_miss ?? 0,
        turnovers: sums.turnovers ?? 0,
        efficiency: Math.round(Math.max(0, rawEff) * 10) / 10,
      };
    });
  }, [rawLogs]);

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
        <div className="mb-3">
          <h2 className={cn('font-bold text-base', darkMode ? 'text-white' : 'text-slate-900')}>
            Evolução
          </h2>
          <p className={cn('text-[11px] mt-1 leading-snug', darkMode ? 'text-slate-500' : 'text-slate-500')}>
            Só aparecem dias em que houve registro de jogo (fuso horário de São Paulo). Cada ponto soma tudo daquele dia.
          </p>
        </div>

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
                    allowDecimals
                  />
                  <Tooltip
                    content={<CustomTooltip darkMode={darkMode} />}
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
