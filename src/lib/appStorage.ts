/**
 * Chaves locais do app (Braska). Mantém leitura de chaves legadas `basquete_*` onde faz sentido.
 */

export const THEME_DARK_KEY = 'braska_theme_dark';
const LEGACY_THEME_DARK_KEY = 'basquete_theme_dark';

export const GUEST_MODE_KEY = 'braska_guest_mode';
const LEGACY_GUEST_KEY = 'basquete_guest_mode';

export const ADMIN_MODE_KEY = 'braska_admin';
const LEGACY_ADMIN_KEY = 'basquete_admin';

export const INSTALL_MODAL_DISMISS_KEY = 'braska_install_modal_dismissed_at';
const LEGACY_INSTALL_MODAL_DISMISS_KEY = 'basquete_install_modal_dismissed_at';

export const LAST_LOCATION_SLUG_KEY = 'braska_last_location_slug';
const LEGACY_LAST_LOCATION_SLUG_KEY = 'basquete_last_location_slug';

/** Tab inicial ao abrir o tenant (deep link). */
export const INITIAL_TAB_KEY = 'braska_initial_tab';
const LEGACY_INITIAL_TAB_KEY = 'basquete_next_initial_tab';

/** sessionStorage: evita toast duplicado de atualização PWA */
export const PWA_UPDATE_SESSION_KEY = 'braska-pwa-update-prompt';
const LEGACY_PWA_UPDATE_SESSION_KEY = 'basquete-pwa-update-prompt';

export function migratePwaSessionStorageOnce(): void {
  try {
    const old = sessionStorage.getItem(LEGACY_PWA_UPDATE_SESSION_KEY);
    if (old != null && sessionStorage.getItem(PWA_UPDATE_SESSION_KEY) == null) {
      sessionStorage.setItem(PWA_UPDATE_SESSION_KEY, old);
      sessionStorage.removeItem(LEGACY_PWA_UPDATE_SESSION_KEY);
    }
  } catch {
    /* private mode */
  }
}

function readLegacyThenNew(newKey: string, legacyKey: string): string | null {
  const v = localStorage.getItem(newKey);
  if (v != null) return v;
  const old = localStorage.getItem(legacyKey);
  if (old != null) {
    localStorage.setItem(newKey, old);
    localStorage.removeItem(legacyKey);
  }
  return localStorage.getItem(newKey);
}

export function getThemeDarkStored(): string | null {
  return readLegacyThenNew(THEME_DARK_KEY, LEGACY_THEME_DARK_KEY);
}

export function setThemeDarkStored(dark: boolean): void {
  localStorage.setItem(THEME_DARK_KEY, String(dark));
  localStorage.removeItem(LEGACY_THEME_DARK_KEY);
}

export function getGuestModeStored(): boolean {
  const v =
    localStorage.getItem(GUEST_MODE_KEY) ?? localStorage.getItem(LEGACY_GUEST_KEY);
  return v === 'true';
}

export function setGuestModeStored(on: boolean): void {
  if (on) {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    localStorage.removeItem(LEGACY_GUEST_KEY);
  } else {
    localStorage.removeItem(GUEST_MODE_KEY);
    localStorage.removeItem(LEGACY_GUEST_KEY);
  }
}

export function getAdminModeStored(): boolean {
  const v = localStorage.getItem(ADMIN_MODE_KEY) ?? localStorage.getItem(LEGACY_ADMIN_KEY);
  return v === 'true';
}

export function setAdminModeStored(on: boolean): void {
  if (on) {
    localStorage.setItem(ADMIN_MODE_KEY, 'true');
    localStorage.removeItem(LEGACY_ADMIN_KEY);
  } else {
    localStorage.removeItem(ADMIN_MODE_KEY);
    localStorage.removeItem(LEGACY_ADMIN_KEY);
  }
}

/** Lê e remove a tab inicial pedida (deep link). */
export function consumeInitialTab(): string | null {
  const v =
    localStorage.getItem(INITIAL_TAB_KEY) ?? localStorage.getItem(LEGACY_INITIAL_TAB_KEY);
  if (v) {
    localStorage.removeItem(INITIAL_TAB_KEY);
    localStorage.removeItem(LEGACY_INITIAL_TAB_KEY);
    return v;
  }
  return null;
}

export function migrateInstallModalDismissKey(): void {
  const old = localStorage.getItem(LEGACY_INSTALL_MODAL_DISMISS_KEY);
  if (old != null && localStorage.getItem(INSTALL_MODAL_DISMISS_KEY) == null) {
    localStorage.setItem(INSTALL_MODAL_DISMISS_KEY, old);
    localStorage.removeItem(LEGACY_INSTALL_MODAL_DISMISS_KEY);
  }
}

export function migrateLastLocationSlugKey(): void {
  const old = localStorage.getItem(LEGACY_LAST_LOCATION_SLUG_KEY);
  if (old != null && localStorage.getItem(LAST_LOCATION_SLUG_KEY) == null) {
    localStorage.setItem(LAST_LOCATION_SLUG_KEY, old);
    localStorage.removeItem(LEGACY_LAST_LOCATION_SLUG_KEY);
  }
}

const SESSION_EXPLORE_TAB_KEY = 'braska_session_explore_global_tab';

export type StashableExploreTab = 'inicio' | 'rank' | 'eventos' | 'perfil';

/** Ao voltar do fluxo /treinos para `/`, abre esta aba no Explorar. */
export function stashExploreTabForHomeVisit(tab: StashableExploreTab): void {
  try {
    sessionStorage.setItem(SESSION_EXPLORE_TAB_KEY, tab);
  } catch {
    /* private mode */
  }
}

export function consumeStashedExploreTabForHome(): StashableExploreTab | null {
  try {
    const v = sessionStorage.getItem(SESSION_EXPLORE_TAB_KEY);
    sessionStorage.removeItem(SESSION_EXPLORE_TAB_KEY);
    if (v === 'inicio' || v === 'rank' || v === 'eventos' || v === 'perfil') return v;
  } catch {
    /* */
  }
  return null;
}

/** Remove dados locais do app ao deslogar (novo + legado). */
export function clearBraskaLocalStorage(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('basquete_') || key.startsWith('braska_')) keysToRemove.push(key);
  }
  keysToRemove.push('explorar-locais-favoritos');
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
