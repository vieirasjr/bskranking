/**
 * Host/origin públicos para textos de ajuda (vitrine, links). No browser usa o deploy atual.
 */
export function appPublicHost(): string {
  if (typeof window !== 'undefined' && window.location?.host) {
    return window.location.host;
  }
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_HOST as string | undefined;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return 'localhost:3000';
}

export function appPublicOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const host = appPublicHost();
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}
