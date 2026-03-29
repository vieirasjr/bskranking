import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trophy, Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

const PLAN_NAMES: Record<string, string> = {
  basico: 'Básico — R$100/mês',
  profissional: 'Profissional — R$150/mês',
  enterprise: 'Enterprise — R$200/mês',
};

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

const RESERVED_SLUGS = ['entrar', 'dashboard', 'api', 'admin', 'login', 'cadastro', 'planos'];

export default function CadastroAdmin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedPlan = params.get('plano') ?? 'basico';
  const { signUp, signIn, session } = useAuth();

  // Se já tem sessão (ex: veio do dashboard sem tenant), pula direto para step 2
  const [step, setStep] = useState<1 | 2>(session ? 2 : 1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: criar conta Supabase Auth
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('Preencha email e senha.'); return; }
    if (password.length < 6) { setError('Senha mínimo 6 caracteres.'); return; }
    setLoading(true);
    try {
      const { error: signUpErr } = await signUp(email, password);
      if (signUpErr) { setError(signUpErr.message); return; }
      const { error: signInErr } = await signIn(email, password);
      if (signInErr) { setError('Conta criada! Verifique seu email e faça login.'); return; }
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: criar tenant + location
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tenantName.trim()) { setError('Nome do espaço obrigatório.'); return; }
    if (!locationName.trim()) { setError('Nome do local obrigatório.'); return; }
    if (!slug.trim()) { setError('URL do local obrigatória.'); return; }
    if (RESERVED_SLUGS.includes(slug)) { setError(`A URL "${slug}" é reservada. Escolha outra.`); return; }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setError('Sessão expirada. Faça login novamente.'); return; }

      // Criar tenant
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .insert({
          owner_auth_id: userData.user.id,
          plan_id: selectedPlan,
          name: tenantName.trim(),
          status: 'trial',
        })
        .select('id')
        .single();
      if (tErr) { setError(tErr.message); return; }

      // Criar location
      const { error: lErr } = await supabase
        .from('locations')
        .insert({
          tenant_id: tenant.id,
          name: locationName.trim(),
          slug: slug.trim(),
          is_active: true,
        });
      if (lErr) {
        if (lErr.message.includes('slug_unique')) {
          setError('Essa URL já está em uso. Escolha outra.');
        } else {
          setError(lErr.message);
        }
        // Reverter tenant se location falhar
        await supabase.from('tenants').delete().eq('id', tenant.id);
        return;
      }

      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationNameChange = (val: string) => {
    setLocationName(val);
    if (!slugManual) setSlug(nameToSlug(val));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/20 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <Trophy className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Criar conta</h1>
          <p className="text-slate-400 text-sm mt-1">
            Plano: <span className="text-orange-400 font-semibold">{PLAN_NAMES[selectedPlan] ?? selectedPlan}</span>
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? 'bg-orange-500' : 'bg-slate-700'}`} />
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-xl"
        >
          {step === 1 ? (
            <>
              <h2 className="font-bold text-white mb-4">1. Sua conta</h2>
              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com" autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <User className="w-4 h-4" />}
                  Criar conta
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-bold text-white mb-4">2. Seu espaço e primeiro local</h2>
              <form onSubmit={handleStep2} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do espaço / organização</label>
                  <input value={tenantName} onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Ex: Basquete da Prefeitura"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do primeiro local</label>
                  <input value={locationName} onChange={(e) => handleLocationNameChange(e.target.value)}
                    placeholder="Ex: Parque Ibirapuera"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">URL do local</label>
                  <div className="flex items-center gap-0">
                    <span className="px-3 py-3 bg-slate-700/60 border border-r-0 border-slate-600 rounded-l-xl text-slate-400 text-xs whitespace-nowrap">
                      basquetenext.app/
                    </span>
                    <input value={slug}
                      onChange={(e) => { setSlugManual(true); setSlug(nameToSlug(e.target.value)); }}
                      placeholder="parque-ibirapuera"
                      className="flex-1 px-3 py-3 bg-slate-900/50 border border-slate-600 rounded-r-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Apenas letras minúsculas, números e hifens</p>
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="px-4 py-3 rounded-xl font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 py-3 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                    Criar e ir para o painel
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.div>

        <p className="text-center text-slate-500 text-xs mt-4">
          Já tem conta?{' '}
          <button onClick={() => navigate('/entrar')} className="text-orange-400 hover:text-orange-300 underline">
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}
