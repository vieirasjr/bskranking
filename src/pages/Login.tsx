import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Mail, Lock, UserPlus, User, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

type Mode = 'login' | 'signup' | 'guest-warning';

export default function Login() {
  const { signIn, signUp, enterAsGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showGuestWarning, setShowGuestWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Conta criada! Você já pode entrar.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnterAsGuest = () => {
    setShowGuestWarning(true);
  };

  const confirmGuest = () => {
    enterAsGuest();
    setShowGuestWarning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <Trophy className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Basquete Next</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de Fila em Tempo Real</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                mode === 'login'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              )}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                mode === 'signup'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              )}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Entrando...</span>
              ) : mode === 'login' ? (
                <>
                  <User className="w-4 h-4" />
                  Entrar
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Criar conta
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-800 px-2 text-slate-500">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnterAsGuest}
            className="w-full py-3 rounded-xl font-semibold bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 border border-slate-600"
          >
            <User className="w-4 h-4" />
            Entrar sem cadastro
          </button>
        </motion.div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Ao entrar, você concorda com nossos termos de uso.
        </p>
      </div>

      {/* Modal de aviso - Visitante */}
      <AnimatePresence>
        {showGuestWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Continuar como visitante</h3>
                  <p className="text-sm text-slate-400">Sem cadastro</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Dessa forma você <strong>só poderá usar a lista de partidas</strong> — entrar na fila, jogar e acompanhar os times.
              </p>
              <p className="text-amber-400/90 text-sm mb-6">
                Você <strong>não poderá participar do ranking</strong> do app nem acessar sua tela de perfil. Para isso, faça um cadastro.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGuestWarning(false)}
                  className="flex-1 py-3 rounded-xl font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmGuest}
                  className="flex-1 py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all"
                >
                  Entendi, continuar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
