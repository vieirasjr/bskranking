import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SortKey } from '../lib/rankingSort';
import { SKILL_LABELS, formatStatValue, type StatsSortable } from '../lib/rankingSort';
import { CountryFlagSvg } from './CountryFlagSvg';
import { isHotStreakActive } from '../lib/hotStreak';
function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

const layoutTransition = { type: 'spring' as const, stiffness: 350, damping: 30 };

/** Rótulo curto no chip (alinhado ao tenant / vitrine). */
const MODALITY_SHORT: Record<string, string> = {
  '5x5': '5x5',
  '3x3': '3x3',
  street: 'Rua',
  '1x1': '1x1',
};

export interface GlobalRankEntry extends StatsSortable {
  hot_streak_since?: string | null;
  user_id?: string | null;
  location_id?: string | null;
  avatarUrl: string | null;
  playerCity: string | null;
  countryIso: string | null;
  /** Primeira modalidade do local da stat, ex.: 5x5 */
  modalityKey: string | null;
}

function modalityLabel(key: string | null): string {
  if (!key) return '—';
  return MODALITY_SHORT[key] ?? key;
}

function HotStreakIcon({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: size, height: size, animation: 'hot-streak-pulse 1.4s ease-in-out infinite' }}
      title="Hot streak"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
        <path
          d="M12 2C10.5 6 6 8 6 13a6 6 0 0 0 12 0c0-5-4.5-7-6-11Z"
          fill="url(#hotGradG)"
          stroke="url(#hotGradG)"
          strokeWidth="0.5"
        />
        <path d="M12 10c-1 2.5-3 3.5-3 6a3 3 0 0 0 6 0c0-2.5-2-3.5-3-6Z" fill="#facc15" />
        <defs>
          <linearGradient id="hotGradG" x1="12" y1="2" x2="12" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function GlobalRankCard({
  player,
  index,
  sortKey,
  darkMode,
}: {
  player: GlobalRankEntry;
  index: number;
  sortKey: SortKey;
  darkMode: boolean;
}) {
  const rankDisplay = index + 1;
  const showAvatar = !!player.avatarUrl && !!player.user_id;

  return (
    <motion.div
      layout
      layoutId={`global-rank-${player.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={layoutTransition}
      className={cn(
        'w-full p-4 rounded-2xl flex items-center justify-between transition-all text-left',
        darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="relative shrink-0">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden',
              darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'
            )}
          >
            {showAvatar ? (
              <img src={player.avatarUrl!} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{rankDisplay}</span>
            )}
          </div>
          {isHotStreakActive(player.hot_streak_since) && (
            <div className="absolute -bottom-1 -left-1">
              <HotStreakIcon size={16} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cn('font-bold truncate', darkMode ? 'text-white' : 'text-slate-900')}>{player.name}</h3>
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1 items-center">
            {(['points', 'assists', 'blocks', 'steals'] as const).map((key, i) => (
              <span key={key} className="flex items-center gap-1.5">
                {i > 0 && <span className={cn('w-0.5 h-0.5 rounded-full', darkMode ? 'bg-slate-600' : 'bg-slate-300')} />}
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    key === sortKey ? 'text-orange-500' : darkMode ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  {player[key] ?? 0} {SKILL_LABELS[key].toLowerCase()}
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={cn(
                'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md',
                darkMode ? 'bg-slate-800 text-orange-300/95 border border-slate-700' : 'bg-orange-50 text-orange-700 border border-orange-100'
              )}
            >
              {modalityLabel(player.modalityKey)}
            </span>
            <span className={cn('flex items-center gap-1.5 min-w-0', darkMode ? 'text-slate-400' : 'text-slate-500')}>
              <CountryFlagSvg code={player.countryIso} className="w-5 h-[13px] rounded-sm shadow-sm shrink-0 overflow-hidden" />
              <span className="text-[11px] font-medium truncate">{player.playerCity?.trim() || '—'}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <div className="text-xl font-black text-orange-500 tabular-nums">{formatStatValue(player, sortKey)}</div>
        <div className={cn('text-[9px] uppercase tracking-widest font-bold', darkMode ? 'text-slate-600' : 'text-slate-500')}>
          {SKILL_LABELS[sortKey]}
        </div>
        <ArrowRight className={cn('w-4 h-4 mt-1 mx-auto', darkMode ? 'text-slate-600' : 'text-slate-400')} aria-hidden />
      </div>
    </motion.div>
  );
}
