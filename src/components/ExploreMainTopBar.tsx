import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, Menu, ScanLine, Share2, User, X } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { appPublicOrigin } from '../lib/publicAppUrl';

export interface ExploreMainTopBarProps {
  darkMode: boolean;
  onDarkModeChange: (value: boolean) => void;
  user: SupabaseUser | null;
  profileName: string;
  profileAvatarUrl: string | null;
  tenantFirstLocationSlug: string | null;
  profilePlayerCode: string | null;
  onOpenProfile: () => void;
  onSignOut: () => Promise<void>;
  onOpenInitialApp: () => void;
  isAppInstalled: boolean;
  /** Ícones entre o centro e o menu (ex.: busca + filtros na tela Treinos). */
  trailingBeforeMenu?: React.ReactNode;
}

export function ExploreMainTopBar({
  darkMode,
  onDarkModeChange,
  user,
  profileName,
  profileAvatarUrl,
  tenantFirstLocationSlug,
  profilePlayerCode,
  onOpenProfile,
  onSignOut,
  onOpenInitialApp,
  isAppInstalled,
  trailingBeforeMenu,
}: ExploreMainTopBarProps) {
  const navigate = useNavigate();
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [qrSheetOpen, setQrSheetOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const appShareLink = `${appPublicOrigin()}/`;

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Braska', text: 'Quadras e locais', url: appShareLink });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(appShareLink);
        setShareFeedback('Link copiado.');
        window.setTimeout(() => setShareFeedback(null), 2200);
      }
    } catch {
      /* usuário cancelou */
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-xl ${
          darkMode ? 'border-slate-800/80 bg-[#07090f]/92' : 'border-slate-200 bg-white/92'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-3 sm:pt-5 sm:pb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void onOpenProfile();
            }}
            disabled={!user}
            className={`flex items-center gap-2 min-w-0 rounded-xl px-1.5 py-1 text-left transition-colors ${
              user ? (darkMode ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100') : 'cursor-default'
            }`}
            title={user ? 'Abrir meu perfil' : undefined}
          >
            {user && (
              <>
                {profileAvatarUrl ? (
                  <img
                    src={profileAvatarUrl}
                    alt={profileName}
                    className="w-9 h-9 rounded-full object-cover border border-slate-600"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-300">
                    {(profileName?.[0] ?? 'A').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Atleta logado</p>
                  <p className={`text-sm font-semibold truncate max-w-[180px] ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {profileName}
                  </p>
                </div>
              </>
            )}
          </button>
          <div className="justify-self-center" />
          <div className="justify-self-end relative">
            {user && (
              <>
                <div className="flex items-center gap-1.5">
                  {trailingBeforeMenu}
                  <button
                    type="button"
                    onClick={() => setHeaderMenuOpen((v) => !v)}
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                      darkMode ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                    }`}
                    aria-label="Abrir menu"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
                {headerMenuOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-xl p-2 z-20 ${
                      darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                  >
                    {tenantFirstLocationSlug && profilePlayerCode && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/${tenantFirstLocationSlug}`);
                          setHeaderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${
                          darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <User className="w-4 h-4 shrink-0" />
                        Visão de jogador
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setQrSheetOpen(true);
                        setHeaderMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${
                        darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      QR do app
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDarkModeChange(!darkMode);
                        setHeaderMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${
                        darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {darkMode ? 'Modo claro' : 'Modo escuro'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenInitialApp();
                        setHeaderMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${
                        darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      Abrir app inicial
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          await onSignOut();
                          setHeaderMenuOpen(false);
                        })();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 inline-flex items-center justify-between"
                    >
                      Sair da conta <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {shareFeedback && (
          <p className="max-w-5xl mx-auto px-4 pb-2 text-xs text-orange-300">{shareFeedback}</p>
        )}
      </header>

      <AnimatePresence>
        {qrSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4 sm:p-6"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              onClick={() => setQrSheetOpen(false)}
              aria-label="Fechar"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={`relative z-10 my-auto w-full max-w-sm rounded-3xl border p-5 shadow-2xl flex flex-col items-center ${
                darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex w-full items-center justify-between mb-3 shrink-0">
                <h3 className={`font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Compartilhar aplicativo</h3>
                <button
                  type="button"
                  onClick={() => setQrSheetOpen(false)}
                  className={`p-2 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="rounded-2xl bg-white p-3 w-fit mx-auto">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(appShareLink)}`}
                  alt="QR Code do aplicativo"
                  className="w-52 h-52"
                />
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center break-all">{appShareLink}</p>
              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.open('https://webqr.com/', '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold"
                >
                  <ScanLine className="w-4 h-4" /> Scanner
                </button>
                <button
                  type="button"
                  onClick={() => void shareLink()}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-bold"
                >
                  <Share2 className="w-4 h-4" /> Compartilhar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
