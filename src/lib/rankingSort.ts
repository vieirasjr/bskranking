/**
 * Ordenação do ranking (mesma lógica do tenant em App.tsx / RankingView).
 */
export type SortKey =
  | 'efficiency'
  | 'wins'
  | 'points'
  | 'blocks'
  | 'steals'
  | 'clutch_points'
  | 'assists'
  | 'rebounds';

export interface StatsSortable {
  id: string;
  name: string;
  wins?: number;
  points?: number;
  blocks?: number;
  steals?: number;
  clutch_points?: number;
  assists?: number;
  rebounds?: number;
  shot_1_miss?: number;
  shot_2_miss?: number;
  shot_3_miss?: number;
  turnovers?: number;
}

export const SKILL_LABELS: Record<SortKey, string> = {
  efficiency: 'Eficiência',
  wins: 'Vitórias',
  points: 'Pontos',
  blocks: 'Tocos',
  steals: 'Roubos',
  clutch_points: 'Clutch',
  assists: 'Assistências',
  rebounds: 'Rebotes',
};

/** Mesma ordem e rótulos que `filterOptions` em RankingView (App.tsx). */
export const RANK_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'efficiency', label: 'Eficiência' },
  { key: 'points', label: 'Pontos' },
  { key: 'assists', label: 'Assistências' },
  { key: 'rebounds', label: 'Rebotes' },
  { key: 'blocks', label: 'Tocos' },
  { key: 'steals', label: 'Roubos' },
  { key: 'clutch_points', label: 'Clutch' },
];

export function calculateHighlightScore(p: StatsSortable): number {
  const acertos =
    (p.points ?? 0) * 1.0 +
    (p.assists ?? 0) * 1.5 +
    (p.rebounds ?? 0) * 1.2 +
    (p.blocks ?? 0) * 1.5 +
    (p.steals ?? 0) * 1.3 +
    (p.clutch_points ?? 0) * 2.0 +
    (p.wins ?? 0) * 3.0;
  const erros =
    (p.shot_1_miss ?? 0) * 0.4 +
    (p.shot_2_miss ?? 0) * 0.8 +
    (p.shot_3_miss ?? 0) * 1.2 +
    (p.turnovers ?? 0) * 1.0;
  return Math.max(0, acertos - erros);
}

export function getStatValue(player: StatsSortable, key: SortKey): number {
  if (key === 'efficiency') return calculateHighlightScore(player);
  return (player[key] as number) ?? 0;
}

export function formatStatValue(player: StatsSortable, key: SortKey): string {
  if (key === 'efficiency') return calculateHighlightScore(player).toFixed(1);
  return String((player[key] as number) ?? 0);
}

export function sortStatsByKey<T extends StatsSortable>(rows: T[], key: SortKey): T[] {
  return [...rows].sort((a, b) => getStatValue(b, key) - getStatValue(a, key));
}
