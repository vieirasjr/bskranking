import { createContext, useContext, type ReactNode } from 'react';

export type ProfileOpenerFn = (() => void | Promise<void>) | null;

export interface MainExploreShellContextValue {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  setTopBarTrailing: (node: ReactNode | null) => void;
  setTopBarHidden: (hidden: boolean) => void;
  registerProfileOpener: (fn: ProfileOpenerFn) => void;
}

export const MainExploreShellContext = createContext<MainExploreShellContextValue | null>(null);

export function useMainExploreShell(): MainExploreShellContextValue {
  const v = useContext(MainExploreShellContext);
  if (!v) throw new Error('useMainExploreShell must be used within MainExploreLayout');
  return v;
}
