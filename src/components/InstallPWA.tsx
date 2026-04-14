import {useCallback, useEffect, useState} from 'react';
import {Download, Smartphone} from 'lucide-react';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Evento não exposto em todas as libs TypeScript DOM */
interface PwaInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & {standalone?: boolean}).standalone === true
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function InstallPWA({darkMode}: {darkMode: boolean}) {
  const [deferred, setDeferred] = useState<PwaInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PwaInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const mq = window.matchMedia('(display-mode: standalone)');
    const onMq = () => setStandalone(isStandaloneDisplay());
    mq.addEventListener('change', onMq);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      mq.removeEventListener('change', onMq);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  if (standalone) {
    return (
      <div
        className={cn(
          'rounded-2xl border px-4 py-3 flex items-start gap-3',
          darkMode ? 'bg-slate-900/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
        )}
      >
        <Smartphone className="w-5 h-5 shrink-0 mt-0.5 text-orange-500" />
        <p className="text-sm leading-snug">
          Este app já está instalado neste aparelho. Quando houver uma nova versão, você recebe um aviso nas notificações (ícone do sino) e pode tocar em &quot;Atualizar agora&quot;.
        </p>
      </div>
    );
  }

  if (isIOS()) {
    return (
      <div
        className={cn(
          'rounded-2xl border px-4 py-3 flex items-start gap-3',
          darkMode ? 'bg-slate-900/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
        )}
      >
        <Download className="w-5 h-5 shrink-0 mt-0.5 text-orange-500" />
        <p className="text-sm leading-snug">
          No iPhone/iPad: toque em <span className="font-semibold">Compartilhar</span> e depois em{' '}
          <span className="font-semibold">Adicionar à Tela de Início</span> para instalar o Braska.
        </p>
      </div>
    );
  }

  if (deferred) {
    return (
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        )}
      >
        <button
          type="button"
          onClick={onInstall}
          className={cn(
            'w-full px-5 py-4 text-left flex items-center justify-between gap-3 transition-colors',
            darkMode ? 'text-white hover:bg-white/5' : 'text-slate-900 hover:bg-slate-50'
          )}
        >
          <span className="flex items-center gap-2 font-semibold">
            <Download className="w-5 h-5 text-orange-500 shrink-0" />
            Instalar aplicativo
          </span>
          <span className={cn('text-xs font-medium', darkMode ? 'text-slate-500' : 'text-slate-400')}>Abre como app na tela inicial</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm leading-snug',
        darkMode ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
      )}
    >
      A opção <span className="font-medium text-slate-600 dark:text-slate-400">Instalar aplicativo</span> aparece quando o navegador (por exemplo Chrome no Android) oferecer o atalho — use HTTPS e acesse o site algumas vezes.
    </div>
  );
}
