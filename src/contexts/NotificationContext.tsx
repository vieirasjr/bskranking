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
};

type NotificationContextValue = {
  notifications: Notification[];
  visibleToast: Notification | null;
  addNotification: (message: string, type?: NotificationType, options?: AddNotificationOptions) => void;
  dismissToast: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [visibleToast, setVisibleToast] = useState<Notification | null>(null);
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

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setVisibleToast((curr) => (curr?.id === id ? null : curr));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setVisibleToast(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, visibleToast, addNotification, dismissToast, clearNotification, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
