import { Crown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export interface ProShareCardData {
  name: string;
  tagline: string | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  stats: {
    partidas: number;
    pontos: number;
    winRate: number;
  };
  extraStats?: Array<{
    label: string;
    value: number | string;
  }>;
  renderFormat?: 'feed' | 'story';
}

interface ProShareCardProps {
  data: ProShareCardData;
  className?: string;
  format?: 'default' | 'story' | 'feed';
}

export default function ProShareCard({ data, className, format = 'default' }: ProShareCardProps) {
  const resolvedFormat = format === 'default' ? (data.renderFormat ?? 'default') : format;
  const isStory = resolvedFormat === 'story';
  const isFeed = resolvedFormat === 'feed';
  const primaryStats = [
    { label: 'Partidas', value: data.stats.partidas },
    { label: 'Pontos', value: data.stats.pontos },
    { label: 'Win rate', value: `${data.stats.winRate}%` },
  ];
  const extras = (data.extraStats ?? []).filter((s) => {
    const n = typeof s.value === 'number' ? s.value : Number(s.value);
    if (!Number.isNaN(n)) return n > 0;
    return String(s.value).trim().length > 0;
  });
  const storyStats = [...primaryStats, ...extras].slice(0, 9);

  return (
    <div
      className={cn(
        'overflow-hidden bg-[#060b1a] shadow-2xl',
        (isStory || isFeed) ? 'rounded-none border-0 h-full w-full' : 'rounded-3xl border border-white/20',
        className
      )}
    >
      <div className={cn('relative', isStory ? 'h-[62%] min-h-0' : isFeed ? 'h-[58%] min-h-0' : 'min-h-[420px]')}>
        {data.coverUrl && (
          <img
            src={data.coverUrl}
            alt=""
            className={cn(
              'absolute inset-0 h-full w-full object-cover object-center opacity-95',
              isStory && 'scale-[1.14]'
            )}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/35" />

        <div className={cn('absolute z-10 inline-flex items-center gap-2 rounded-full bg-black/40 border border-white/10', isStory ? 'left-8 top-10 px-6 py-3' : isFeed ? 'left-6 top-6 px-5 py-2.5' : 'left-4 top-4 px-3 py-1.5')}>
          <span className={cn('font-black tracking-wide text-orange-300', isStory ? 'text-3xl' : isFeed ? 'text-2xl' : 'text-base')}>Braska</span>
        </div>

        <div className={cn('absolute left-0 right-0 z-10', isStory ? 'bottom-10 px-8' : isFeed ? 'bottom-8 px-6' : 'bottom-16 px-5')}>
          <div className="flex flex-col items-start gap-2.5">
            <div className="flex items-center gap-2">
              <div className={cn('border-[2px] rounded-full border-orange-400 overflow-hidden shadow-xl shadow-black/50 bg-slate-800', isStory ? 'w-24 h-24' : isFeed ? 'w-20 h-20' : 'w-12 h-12')}>
                {data.avatarUrl ? (
                  <img src={data.avatarUrl} alt={data.name} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 border border-orange-400/40', isStory ? 'px-4 py-2' : isFeed ? 'px-3.5 py-1.5' : 'px-2.5 py-1')}>
                <Crown className={cn('text-orange-300', isStory ? 'w-6 h-6' : isFeed ? 'w-5 h-5' : 'w-3.5 h-3.5')} />
                <span className={cn('font-black tracking-widest text-orange-200 uppercase', isStory ? 'text-base' : isFeed ? 'text-sm' : 'text-[10px]')}>PRÓ</span>
              </div>
            </div>

            <div className={cn('w-full rounded-xl bg-slate-950/45 backdrop-blur-sm border border-white/10 shadow-xl', isStory ? 'px-5 py-4' : isFeed ? 'px-4 py-3.5' : 'px-3 py-2.5')}>
              <h1 className={cn('text-white font-black leading-tight tracking-tight', isStory ? 'text-6xl' : isFeed ? 'text-5xl' : 'text-3xl sm:text-4xl')}>
                {data.name}
              </h1>
              {data.tagline && (
                <p className={cn('text-orange-100/95 mt-2 leading-snug', isStory ? 'text-2xl max-w-3xl line-clamp-4' : isFeed ? 'text-xl max-w-2xl line-clamp-3' : 'text-xs max-w-md line-clamp-3')}>
                  {data.tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={cn('relative z-20', isStory ? '-mt-14 px-7 pt-4 pb-8 h-[38%] flex items-end' : isFeed ? '-mt-12 px-6 pt-4 pb-6 h-[42%] flex items-end' : '-mt-12 px-3 sm:px-4 pb-4')}>
        {(isStory || isFeed) ? (
          <div className={cn('grid w-full content-end', isStory ? 'grid-cols-3 gap-3' : 'grid-cols-3 gap-2.5')}>
            {storyStats.map((item) => (
              <StatCard key={item.label} label={item.label} value={String(item.value)} story={isStory} feed={isFeed} />
            ))}
          </div>
        ) : (
          <div className="flex items-stretch justify-between gap-2.5 sm:gap-3">
            <StatCard label="Partidas" value={String(data.stats.partidas)} story={false} />
            <StatCard label="Pontos" value={String(data.stats.pontos)} story={false} />
            <StatCard label="Win rate" value={`${data.stats.winRate}%`} story={false} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, story = false, feed = false }: { label: string; value: string; story?: boolean; feed?: boolean }) {
  return (
    <div className={cn('flex-1 min-w-0 rounded-2xl border border-white/15 bg-slate-900/78 backdrop-blur-sm', story ? 'px-5 py-5' : feed ? 'px-4 py-4' : 'px-3 py-3.5')}>
      <p className={cn('uppercase tracking-widest font-bold text-white/60', story ? 'text-base' : feed ? 'text-sm' : 'text-[10px]')}>{label}</p>
      <p className={cn('font-black tabular-nums mt-1 text-white', story ? 'text-5xl' : feed ? 'text-4xl' : 'text-2xl sm:text-3xl')}>{value}</p>
    </div>
  );
}
