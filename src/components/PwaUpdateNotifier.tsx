import {useEffect} from 'react';
import {useRegisterSW} from 'virtual:pwa-register/react';
import {useNotifications} from '../contexts/NotificationContext';
import {setPwaReloadHandler} from '../pwaUpdateController';
import {migratePwaSessionStorageOnce, PWA_UPDATE_SESSION_KEY} from '../lib/appStorage';

/**
 * Registra o service worker e, quando há build novo no servidor, adiciona
 * notificação na lista (painel + toast no app do local) com ação para atualizar.
 */
export function PwaUpdateNotifier() {
  const {addNotification} = useNotifications();
  const {needRefresh, updateServiceWorker} = useRegisterSW({immediate: true});
  const [needRefreshFlag] = needRefresh;

  useEffect(() => {
    setPwaReloadHandler(() => () => updateServiceWorker(true));
    return () => setPwaReloadHandler(null);
  }, [updateServiceWorker]);

  useEffect(() => {
    migratePwaSessionStorageOnce();
    if (!needRefreshFlag) {
      sessionStorage.removeItem(PWA_UPDATE_SESSION_KEY);
      return;
    }
    if (sessionStorage.getItem(PWA_UPDATE_SESSION_KEY)) return;
    sessionStorage.setItem(PWA_UPDATE_SESSION_KEY, '1');
    addNotification(
      'Nova versão do Braska está disponível. Toque em Atualizar agora para carregar as melhorias.',
      'info',
      {
        silent: true,
        action: {type: 'pwa_reload', label: 'Atualizar agora'},
      }
    );
  }, [needRefreshFlag, addNotification]);

  return null;
}
