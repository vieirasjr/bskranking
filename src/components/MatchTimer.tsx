/**
 * Cronômetro da partida - exibido quando há 10+ jogadores na fila.
 * Controles (Start/Pause/Reset) somente para admin; visualização para todos.
 * Reset exige senha de administrador.
 */

import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TimerState {
  timerSeconds: number;
  timerRunning: boolean;
  timerLastSyncAt: string | null;
}

const TIMEOUT_SECONDS = 600; // 10 minutos

interface MatchTimerProps {
  state: TimerState;
  darkMode: boolean;
  isAdmin: boolean;
  onStart: () => void;
  onPause: () => void;
  onResetRequest: () => void;
  onTimeout?: () => void;
  startDisabled?: boolean;
  startDisabledReason?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function MatchTimer({
  state,
  darkMode,
  isAdmin,
  onStart,
  onPause,
  onResetRequest,
  onTimeout,
  startDisabled = false,
  startDisabledReason,
}: MatchTimerProps) {
  const { timerSeconds, timerRunning, timerLastSyncAt } = state;
  const [displaySeconds, setDisplaySeconds] = useState(timerSeconds);
  const timeoutFiredRef = React.useRef(false);

  useEffect(() => {
    if (!timerRunning) {
      setDisplaySeconds(timerSeconds);
      timeoutFiredRef.current = false;
      return;
    }
    const baseMs = timerLastSyncAt ? new Date(timerLastSyncAt).getTime() : Date.now();
    const baseSeconds = timerSeconds;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - baseMs) / 1000);
      const next = baseSeconds + elapsed;
      setDisplaySeconds(next);
      if (next >= TIMEOUT_SECONDS && onTimeout && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        onTimeout();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds, timerRunning, timerLastSyncAt, onTimeout]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'border rounded-2xl p-4 sm:p-6 shadow-xl transition-colors duration-300',
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              darkMode ? 'bg-orange-500/20' : 'bg-orange-100'
            )}
          >
            <Timer className={cn('w-6 h-6', darkMode ? 'text-orange-400' : 'text-orange-600')} />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', darkMode ? 'text-slate-400' : 'text-slate-600')}>
              Cronômetro da partida
            </h3>
            <p
              className={cn(
                'text-2xl sm:text-3xl font-mono font-bold tabular-nums tracking-wider',
                darkMode ? 'text-white' : 'text-slate-900'
              )}
            >
              {formatTime(displaySeconds)}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {timerRunning ? (
              <button
                onClick={onPause}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95',
                  darkMode
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                )}
                title="Pausar"
              >
                <Pause className="w-4 h-4" />
                Pausar
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={startDisabled}
                title={startDisabled ? startDisabledReason : 'Iniciar cronômetro'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95',
                  startDisabled
                    ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500'
                    : darkMode
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                )}
              >
                <Play className="w-4 h-4" />
                Iniciar
              </button>
            )}
            <button
              onClick={onResetRequest}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95',
                darkMode
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              )}
              title="Zerar cronômetro (requer senha)"
            >
              <RotateCcw className="w-4 h-4" />
              Zerar
            </button>
          </div>
        )}

        {!isAdmin && timerRunning && (
          <span
            className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
            )}
          >
            Em andamento
          </span>
        )}
      </div>
    </motion.div>
  );
}
