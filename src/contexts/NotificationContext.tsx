import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type NotificationType = 'info' | 'warning' | 'error';

export interface NotificationAction {
  type: string;
  label: string;
}

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  action?: NotificationAction;
}

export type AddNotificationOptions = {
  showToastForMs?: number;
  action?: NotificationAction;
  /** Adiciona a notificação à lista sem mostrar o toast flutuante. */
  silent?: boolean;
};

type NotificationContextValue = {
  notifications: Notification[];
  visibleToast: Notification | null;
  hasUnread: boolean;
  addNotification: (message: string, type?: NotificationType, options?: AddNotificationOptions) => void;
  dismissToast: () => void;
  markAllRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [visibleToast, setVisibleToast] = useState<Notification | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addNotification = useCallback(
    (message: string, type: NotificationType = 'info', options?: AddNotificationOptions) => {
      const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const n: Notification = {
        id,
        message,
        type,
        createdAt: new Date().toISOString(),
        action: options?.action,
      };
      setNotifications((prev) => [n, ...prev].slice(0, 100));
      setHasUnread(true);

      // Notificações de atualização do PWA NUNCA viram toast — só o ponto
      // laranja no sino. Evita a mensagem invadir a UI em refreshes ou
      // quando bundles legados esquecem o flag `silent`.
      const isPwaReload = options?.action?.type === 'pwa_reload';
      if (options?.silent || isPwaReload) return;

      setVisibleToast(n);
      const showFor = options?.showToastForMs ?? 5000;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setVisibleToast((curr) => (curr?.id === id ? null : curr));
        toastTimerRef.current = null;
      }, showFor);
    },
    []
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setVisibleToast(null);
  }, []);

  const markAllRead = useCallback(() => {
    setHasUnread(false);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setVisibleToast((curr) => (curr?.id === id ? null : curr));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setVisibleToast(null);
    setHasUnread(false);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, visibleToast, hasUnread, addNotification, dismissToast, markAllRead, clearNotification, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
