import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MainExploreShellContext,
  type MainExploreShellContextValue,
} from '../contexts/MainExploreShellContext';
import { ExploreMainTopBar } from '../components/ExploreMainTopBar';
import { getThemeDarkStored, setThemeDarkStored } from '../lib/appStorage';
import { useExploreHeaderProfile } from '../hooks/useExploreHeaderProfile';

export default function MainExploreLayout() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = getThemeDarkStored();
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return true;
  });
  const [topBarTrailing, setTopBarTrailing] = useState<ReactNode>(null);
  const [topBarHidden, setTopBarHidden] = useState(false);
  const profileOpenerRef = useRef<(() => void | Promise<void>) | null>(null);
  const headerProfile = useExploreHeaderProfile(user);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    setThemeDarkStored(darkMode);
  }, [darkMode]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari legacy
      window.navigator.standalone === true;
    setIsAppInstalled(standalone);
  }, []);

  const registerProfileOpener = useCallback((fn: typeof profileOpenerRef.current) => {
    profileOpenerRef.current = fn;
  }, []);

  const setTopBarTrailingStable = useCallback((n: ReactNode | null) => {
    setTopBarTrailing(n);
  }, []);

  const setTopBarHiddenStable = useCallback((h: boolean) => {
    setTopBarHidden(h);
  }, []);

  const handleGlobalSignOut = async () => {
    await signOut();
    navigate('/locais', { replace: true });
  };

  const handleOpenInitialApp = () => {
    if (isAppInstalled) {
      window.location.assign('/');
      return;
    }
    navigate('/');
  };

  const shellValue: MainExploreShellContextValue = {
    darkMode,
    setDarkMode,
    setTopBarTrailing: setTopBarTrailingStable,
    setTopBarHidden: setTopBarHiddenStable,
    registerProfileOpener,
  };

  return (
    <MainExploreShellContext.Provider value={shellValue}>
      {!topBarHidden && (
        <ExploreMainTopBar
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
          user={user}
          profileName={headerProfile.profileName}
          profileAvatarUrl={headerProfile.profileAvatarUrl}
          tenantFirstLocationSlug={headerProfile.tenantFirstLocationSlug}
          profilePlayerCode={headerProfile.profilePlayerCode}
          onOpenProfile={() => {
            void profileOpenerRef.current?.();
          }}
          onSignOut={handleGlobalSignOut}
          onOpenInitialApp={handleOpenInitialApp}
          isAppInstalled={isAppInstalled}
          trailingBeforeMenu={topBarTrailing}
        />
      )}
      <Outlet />
    </MainExploreShellContext.Provider>
  );
}
