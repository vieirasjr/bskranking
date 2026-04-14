const HOT_STREAK_DAYS = 7;

export function isHotStreakActive(hotStreakSince: string | null | undefined): boolean {
  if (!hotStreakSince) return false;
  const diff = Date.now() - new Date(hotStreakSince).getTime();
  return diff <= HOT_STREAK_DAYS * 24 * 60 * 60 * 1000;
}
