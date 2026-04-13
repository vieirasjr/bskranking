/** Basquete apenas — variantes e sinais para listagem pública. */

export const BASKETBALL_FORMAT_OPTIONS = [
  { id: '5x5', label: '5x5' },
  { id: '3x3', label: '3x3' },
  { id: 'street', label: 'Rua' },
] as const;

export type BasketballFormatId = (typeof BASKETBALL_FORMAT_OPTIONS)[number]['id'];

export const BASKETBALL_FORMAT_LABELS: Record<string, string> = {
  '5x5': 'Basquete 5x5',
  '3x3': 'Basquete 3x3',
  street: 'Basquete de rua',
};

export function formatLabelsList(formats: string[] | null | undefined): string[] {
  if (!formats?.length) return [];
  return formats.map((f) => BASKETBALL_FORMAT_LABELS[f] ?? f);
}

/** Chips da tela explorar: variantes + torneios + campeonatos */
export type ExploreFilterChip =
  | 'all'
  | BasketballFormatId
  | 'tournaments'
  | 'championships';

const AVATAR_TINTS = ['bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500'] as const;

export function avatarTintIndicesForId(id: string): [number, number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i);
    h |= 0;
  }
  const x = Math.abs(h);
  return [x % 5, (x >> 3) % 5, (x >> 6) % 5];
}

export function avatarTintClass(i: number): string {
  return AVATAR_TINTS[i % AVATAR_TINTS.length];
}
