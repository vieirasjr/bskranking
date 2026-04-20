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
    // Handler chamado pelo botão "Atualizar agora" do painel de notificações.
    // 1. updateServiceWorker(true) ativa o SW novo e recarrega a página.
    // 2. Fallback defensivo: se o SW não disparar o reload (update silencioso,
    //    devtools bloqueando, ausência de waiting), força location.reload().
    setPwaReloadHandler(async () => {
      try {
        await updateServiceWorker(true);
      } catch (err) {
        console.error('updateServiceWorker failed:', err);
      }
      // Dá 300ms pro SW assumir; se o reload automático não aconteceu,
      // força manualmente. Em geral o updateServiceWorker(true) já recarrega
      // antes do setTimeout disparar.
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
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
