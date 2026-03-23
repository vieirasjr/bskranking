import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertCircle, Info, AlertTriangle, Trash2, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Notification, NotificationType } from '../contexts/NotificationContext';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

interface NotificationsPanelProps {
  notifications: Notification[];
  darkMode: boolean;
  onClose: () => void;
  onClear: (id: string) => void;
  onClearAll: () => void;
  onAction?: (notificationId: string, actionType: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return 'Agora';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} min atrás`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function IconForType({ type }: { type: NotificationType }) {
  if (type === 'error') return <AlertCircle className="w-5 h-5 text-red-500" />;
  if (type === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return <Info className="w-5 h-5 text-blue-500" />;
}

export function NotificationsPanel({ notifications, darkMode, onClose, onClear, onClearAll, onAction }: NotificationsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notifications.find((n) => n.id === selectedId);

  const headerTitle = selected ? 'Detalhes' : 'Notificações';
  const showBackButton = !!selected;

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-sm z-50 flex flex-col shadow-2xl"
      style={{
        backgroundColor: darkMode ? 'rgb(15 23 42)' : 'white',
        borderLeft: `1px solid ${darkMode ? 'rgb(51 65 85)' : 'rgb(226 232 240)'}`,
      }}
    >
      <div className={cn('p-4 border-b flex items-center gap-2', darkMode ? 'border-slate-800' : 'border-slate-200')}>
        {showBackButton ? (
          <button
            onClick={() => setSelectedId(null)}
            className={cn('p-2 rounded-lg -ml-2', darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <Bell className={cn('w-5 h-5 shrink-0', darkMode ? 'text-orange-400' : 'text-orange-600')} />
        )}
        <h2 className={cn('font-bold flex-1', darkMode ? 'text-white' : 'text-slate-900')}>{headerTitle}</h2>
        <div className="flex items-center gap-2">
          {!selected && notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className={cn(
                'p-2 rounded-lg text-xs font-medium',
                darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-red-400' : 'text-slate-500 hover:bg-slate-100 hover:text-red-600'
              )}
            >
              Limpar tudo
            </button>
          )}
          {selected && (
            <button
              onClick={() => {
                onClear(selected.id);
                setSelectedId(null);
              }}
              className={cn('p-2 rounded-lg', darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-red-400' : 'text-slate-500 hover:bg-slate-100 hover:text-red-600')}
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg', darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-4 space-y-4">
            <div
              className={cn(
                'p-4 rounded-xl border',
                darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <IconForType type={selected.type} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>{formatTime(selected.createdAt)}</p>
                </div>
              </div>
              <p className={cn('text-sm whitespace-pre-wrap', darkMode ? 'text-slate-200' : 'text-slate-800')}>{selected.message}</p>
              {selected.action && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: darkMode ? 'rgb(51 65 85)' : 'rgb(226 232 240)' }}>
                  <button
                    onClick={() => {
                      onAction?.(selected.id, selected.action!.type);
                    }}
                    className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                  >
                    {selected.action.label}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className={cn('py-12 px-4 text-center', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            <AnimatePresence>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  onClick={() => setSelectedId(n.id)}
                  className={cn(
                    'p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors',
                    darkMode ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  <IconForType type={n.type} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm line-clamp-2', darkMode ? 'text-slate-200' : 'text-slate-800')}>{n.message}</p>
                    <p className={cn('text-xs mt-0.5', darkMode ? 'text-slate-500' : 'text-slate-400')}>{formatTime(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClear(n.id);
                    }}
                    className={cn('p-1 rounded shrink-0', darkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50')}
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
