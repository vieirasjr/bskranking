import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Mail, Lock, UserPlus, User, AlertCircle, CheckCircle, Eye, EyeOff, X, Medal, MapPin, Search, Shield, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

type Mode = 'login' | 'signup';

function translateAuthError(message: string, mode: Mode): { text: string; suggestion?: 'switch-to-login' | 'check-email' } {
  const m = message.toLowerCase();
  if (m.includes('user already registered') || m.includes('already been registered'))
    return { text: 'Este email já possui uma conta.', suggestion: 'switch-to-login' };
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return { text: 'Email ou senha incorretos. Verifique e tente novamente.' };
  if (m.includes('email not confirmed'))
    return { text: 'Confirme seu email antes de entrar. Verifique sua caixa de entrada.', suggestion: 'check-email' };
  if (m.includes('password should be at least') || m.includes('password must be'))
    return { text: 'A senha deve ter pelo menos 6 caracteres.' };
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('email address is invalid'))
    return { text: 'Email inválido. Verifique o endereço digitado.' };
  if (m.includes('signup is disabled') || m.includes('signups not allowed'))
    return { text: 'Cadastro temporariamente desativado. Contate o administrador.' };
  if (m.includes('too many requests') || m.includes('rate limit'))
    return { text: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };
  if (m.includes('network') || m.includes('fetch'))
    return { text: 'Erro de conexão. Verifique sua internet e tente novamente.' };
  if (mode === 'login') return { text: 'Não foi possível entrar. Verifique seus dados.' };
  return { text: 'Não foi possível criar a conta. Tente novamente.' };
}

function validateForm(email: string, password: string, mode: Mode): string | null {
  if (!email.trim()) return 'Informe seu email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email inválido.';
  if (!password) return 'Informe sua senha.';
  if (mode === 'signup' && password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
}

interface LocationResult { id: string; name: string; slug: string; description: string | null }

interface RankEntry { name: string; points: number; wins: number }

interface LoginProps {
  redirectTo?: string;
  locationName?: string;
  locationId?: string;
}

// ─── Formulário reutilizável ──────────────────────────────────────────────────
function AuthForm({
  mode, setMode, onSuccess, onGuest, isPlayerMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  onSuccess: () => void;
  onGuest?: () => void;
  isPlayerMode: boolean;
}) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; suggestion?: 'switch-to-login' | 'check-email' } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const switchMode = (next: Mode) => { setMode(next); setError(null); setSuccessMsg(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccessMsg(null);
    const err = validateForm(email, password, mode);
    if (err) { setError({ text: err }); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(translateAuthError(error.message, 'login'));
        else onSuccess();
      } else {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) { setError(translateAuthError(signUpError.message, 'signup')); return; }
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          const parsed = translateAuthError(signInError.message, 'login');
          if (parsed.suggestion === 'check-email')
            setSuccessMsg('Conta criada! Verifique seu email para confirmar o cadastro.');
          else { setSuccessMsg('Conta criada! Faça login para continuar.'); switchMode('login'); }
        } else {
          onSuccess();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
              mode === m ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white/10 text-white/60 hover:text-white'
            )}>
            {m === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="seu@email.com" autoComplete="email"
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60" />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input type={showPassword ? 'text' : 'password'} value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60" />
          <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {mode === 'signup' && <p className="text-xs text-white/40">Mínimo 6 caracteres</p>}

        <AnimatePresence mode="wait">
          {error && (
            <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-1.5 text-red-300 text-sm bg-red-500/15 border border-red-500/25 rounded-xl px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error.text}</span>
              </div>
              {error.suggestion === 'switch-to-login' && (
                <button type="button" onClick={() => switchMode('login')}
                  className="self-start text-xs font-semibold text-orange-300 underline ml-6">
                  Ir para o login →
                </button>
              )}
            </motion.div>
          )}
          {successMsg && (
            <motion.div key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-2 text-green-300 text-sm bg-green-500/15 border border-green-500/25 rounded-xl px-3 py-2.5">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/40">
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {mode === 'signup' ? 'Criando conta...' : 'Entrando...'}</>
          ) : mode === 'login' ? (
            <><User className="w-4 h-4" /> Entrar</>
          ) : (
            <><UserPlus className="w-4 h-4" /> Criar conta</>
          )}
        </button>
      </form>

      {isPlayerMode && onGuest && (
        <>
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-2 text-white/30">ou</span>
            </div>
          </div>
          <button type="button" onClick={onGuest}
            className="w-full py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all flex items-center justify-center gap-2 border border-white/10 text-sm">
            <User className="w-4 h-4" /> Entrar sem cadastro
          </button>
        </>
      )}
    </div>
  );
}

// ─── Ranking card compacto ────────────────────────────────────────────────────
function RankCard({ entry, rank }: { entry: RankEntry; rank: number }) {
  const medal = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-600';
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/8 mb-3">
      <span className={cn('w-7 text-center font-black text-base shrink-0', medal)}>
        {rank <= 3 ? <Medal className="w-5 h-5 mx-auto" /> : rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{entry.name}</p>
        <p className="text-xs text-slate-500">{entry.wins} vitórias</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-orange-400 font-black text-lg leading-none">{entry.points}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">pts</p>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Login({ redirectTo, locationName, locationId }: LoginProps) {
  const { enterAsGuest } = useAuth();
  const navigate = useNavigate();
  const isPlayerMode = !!locationName;

  const [mode, setMode] = useState<Mode>('login');
  const [formOpen, setFormOpen] = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [showRoleChoice, setShowRoleChoice] = useState(false);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);

  useEffect(() => {
    if (!isPlayerMode || !locationId) return;
    supabase
      .from('stats')
      .select('name, points, wins')
      .eq('location_id', locationId)
      .order('points', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data?.length) setRanking(data as RankEntry[]); });
  }, [locationId, isPlayerMode]);

  useEffect(() => {
    const term = locationSearch.trim();
    if (term.length < 2) { setLocationResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearchingLocations(true);
      const { data } = await supabase
        .from('locations')
        .select('id, name, slug, description')
        .eq('is_active', true)
        .ilike('name', `%${term}%`)
        .limit(10);
      if (!cancelled) {
        setLocationResults((data ?? []) as LocationResult[]);
        setSearchingLocations(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [locationSearch]);

  const handleSuccess = () => navigate(redirectTo ?? '/dashboard', { replace: true });
  const openForm = (m: Mode) => { setMode(m); setFormOpen(true); };
  const handleCreateAccount = () => { setShowRoleChoice(true); };

  // ── Modo admin (tela clássica) ─────────────────────────────────────────────
  if (!isPlayerMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
              <Trophy className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">Basquete Next</h1>
            <p className="text-slate-400 text-sm mt-1">Painel do administrador</p>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-xl">
            <AuthForm mode={mode} setMode={setMode} onSuccess={handleSuccess} isPlayerMode={false} />
          </motion.div>
          <p className="text-center text-slate-500 text-xs mt-6">Ao entrar, você concorda com nossos termos de uso.</p>
        </div>
      </div>
    );
  }

  // ── Modo jogador (tela com ranking + overlay) ──────────────────────────────
  const scrollItems = ranking.length >= 4 ? [...ranking, ...ranking] : ranking;
  const scrollDuration = ranking.length * 4;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden flex flex-col">

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 pt-8 pb-3 px-5">
        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/40 shrink-0">
          <Trophy className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-black text-white leading-tight">{locationName}</h1>
      </div>

      {/* Ranking scrolling list */}
      <div className="relative flex-1 overflow-hidden px-5 pb-40 mask-fade-y">
        {ranking.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 opacity-40">
            <Trophy className="w-8 h-8 text-slate-700" />
            <p className="text-slate-600 text-sm">Nenhum atleta no ranking ainda</p>
          </div>
        ) : (
          <motion.div
            animate={ranking.length >= 4 ? { y: ['0%', '-50%'] } : {}}
            transition={ranking.length >= 4 ? {
              duration: scrollDuration,
              repeat: Infinity,
              ease: 'linear',
              repeatType: 'loop',
            } : {}}
          >
            {scrollItems.map((entry, i) => (
              <RankCard key={i} entry={entry} rank={(i % ranking.length) + 1} />
            ))}
          </motion.div>
        )}

        {/* Fade top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950 to-transparent" />
        {/* Fade bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      {/* Bottom CTA — fixo na base */}
      <div className="fixed bottom-0 inset-x-0 z-20 px-5 pb-8 pt-4 flex flex-col gap-3"
        style={{ background: 'linear-gradient(to top, rgba(2,6,23,1) 60%, rgba(2,6,23,0))' }}>
        <button onClick={handleCreateAccount}
          className="w-full py-4 rounded-2xl font-bold text-white text-base
            bg-gradient-to-r from-orange-500 to-orange-600
            shadow-xl shadow-orange-500/40
            hover:shadow-orange-500/60 hover:from-orange-400 hover:to-orange-500
            active:scale-[0.98] transition-all">
          <span className="flex items-center justify-center gap-2">
            <UserPlus className="w-5 h-5" /> Criar conta
          </span>
        </button>
        <button onClick={() => openForm('login')}
          className="w-full py-4 rounded-2xl font-bold text-white text-base
            bg-white/10 border border-white/20
            hover:bg-white/15 hover:border-white/30
            backdrop-blur-sm active:scale-[0.98] transition-all
            shadow-lg shadow-black/30">
          <span className="flex items-center justify-center gap-2">
            <User className="w-5 h-5" /> Já tenho conta
          </span>
        </button>
        <p className="text-center text-slate-600 text-xs">Ao entrar, você concorda com nossos termos de uso.</p>
      </div>

      {/* Form overlay (glassmorphism) */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', backgroundColor: 'rgba(0,0,0,0.65)' }}
          >
            <motion.div
              key="form-card"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              {/* Header do overlay */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-slate-400 font-medium">{locationName}</p>
                  <h2 className="font-black text-white text-lg leading-tight">
                    {mode === 'login' ? 'Bem-vindo de volta' : 'Criar minha conta'}
                  </h2>
                </div>
                <button onClick={() => setFormOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <AuthForm
                mode={mode}
                setMode={setMode}
                onSuccess={handleSuccess}
                onGuest={() => { setFormOpen(false); setShowGuestWarning(true); }}
                isPlayerMode
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal visitante */}
      <AnimatePresence>
        {showGuestWarning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Continuar como visitante</h3>
                  <p className="text-sm text-slate-400">Sem cadastro</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-3">
                Você <strong>só poderá usar a lista de partidas</strong> — entrar na fila, jogar e acompanhar os times.
              </p>
              <p className="text-amber-400/90 text-sm mb-5">
                Você <strong>não poderá participar do ranking</strong> nem acessar seu perfil.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowGuestWarning(false)}
                  className="flex-1 py-3 rounded-xl font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all">
                  Voltar
                </button>
                <button onClick={() => { enterAsGuest(); setShowGuestWarning(false); }}
                  className="flex-1 py-3 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all">
                  Entendi, continuar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal escolha de perfil */}
      <AnimatePresence>
        {showRoleChoice && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-700"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-black text-white text-lg">Como deseja participar?</h2>
                <button onClick={() => setShowRoleChoice(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setShowRoleChoice(false); setShowLocationConfirm(true); setLocationSearch(''); setLocationResults([]); }}
                  className="w-full p-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:border-orange-500/40 hover:bg-slate-800 transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                      <User className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">Sou atleta</p>
                      <p className="text-xs text-slate-400 mt-0.5">Quero jogar, entrar na fila e acompanhar minhas estatísticas</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" />
                  </div>
                </button>

                <button
                  onClick={() => { setShowRoleChoice(false); navigate('/cadastro'); }}
                  className="w-full p-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:border-orange-500/40 hover:bg-slate-800 transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                      <Shield className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">Sou administrador</p>
                      <p className="text-xs text-slate-400 mt-0.5">Quero criar e gerenciar quadras, eventos e campeonatos</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal confirmação de local (atleta) */}
      <AnimatePresence>
        {showLocationConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl bg-slate-900 border border-slate-700 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-white text-lg">Confirme seu local</h2>
                <button onClick={() => setShowLocationConfirm(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Local atual */}
              <button
                onClick={() => { setShowLocationConfirm(false); openForm('signup'); }}
                className="w-full p-4 rounded-2xl border-2 border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/10 transition-all text-left mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{locationName}</p>
                    <p className="text-xs text-orange-400 mt-0.5">Local atual — toque para confirmar</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-orange-500 shrink-0" />
                </div>
              </button>

              {/* Separador */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-slate-900 px-3 text-slate-500">ou escolha outro local</span></div>
              </div>

              {/* Busca */}
              <div className="relative mt-3 mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Buscar por nome do local..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Resultados */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {searchingLocations && (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!searchingLocations && locationSearch.trim().length >= 2 && locationResults.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-6">Nenhum local encontrado</p>
                )}
                {locationResults.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => { setShowLocationConfirm(false); navigate(`/${loc.slug}`); }}
                    className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:border-orange-500/30 hover:bg-slate-800 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{loc.name}</p>
                        {loc.description && <p className="text-xs text-slate-500 truncate">{loc.description}</p>}
                        <p className="text-[11px] text-slate-600">/{loc.slug}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
