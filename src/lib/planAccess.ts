/** Planos com fim de acesso em `current_period_ends_at` (não são mensalidade). */
export const TIME_LIMITED_PLAN_IDS = ['avulso'] as const;

export type TimeLimitedPlanId = (typeof TIME_LIMITED_PLAN_IDS)[number];

export function isTimeLimitedPlan(planId: string | undefined | null): boolean {
  if (!planId) return false;
  return (TIME_LIMITED_PLAN_IDS as readonly string[]).includes(planId);
}

/** Texto amigável do tempo até expirar (ou null se sem data). */
export function formatAccessTimeRemaining(endIso: string | null | undefined): string | null {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return 'Acesso expirado';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) {
    return `${days} dia${days !== 1 ? 's' : ''} e ${hours} hora${hours !== 1 ? 's' : ''}`;
  }
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) {
    return `${hours} hora${hours !== 1 ? 's' : ''} e ${minutes} min`;
  }
  return `${minutes} min`;
}

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
