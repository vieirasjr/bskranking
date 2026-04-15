import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Trophy, ArrowRight, AlertCircle, Clock, UserPlus, Trash2, Shield } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { appPublicHost } from '../../lib/publicAppUrl';
import { formatAccessTimeRemaining, isTimeLimitedPlan } from '../../lib/planAccess';
import { supabase } from '../../supabase';

interface TenantAdmin {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
}

const MAX_CO_ADMINS = 2;

export default function DashboardHome() {
  const { tenant, locations, plan, isSubscriptionActive } = useTenant();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  // Co-admins
  const [coAdmins, setCoAdmins] = useState<TenantAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase
      .from('tenant_admins')
      .select('id, auth_id, email, name')
      .eq('tenant_id', tenant.id)
      .then(({ data }) => setCoAdmins((data ?? []) as TenantAdmin[]));
  }, [tenant?.id]);

  const addCoAdmin = async () => {
    if (!tenant?.id || !newAdminEmail.trim()) return;
    if (coAdmins.length >= MAX_CO_ADMINS) {
      setAdminError(`Máximo de ${MAX_CO_ADMINS} co-administradores.`);
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      // Buscar auth_id pelo email
      const { data: userRow } = await supabase
        .from('basquete_users')
        .select('auth_id')
        .eq('email', newAdminEmail.trim().toLowerCase())
        .maybeSingle();
      if (!userRow?.auth_id) {
        setAdminError('Usuário não encontrado. O email precisa estar cadastrado na plataforma.');
        return;
      }
      if (userRow.auth_id === tenant.owner_auth_id) {
        setAdminError('Você já é o dono deste tenant.');
        return;
      }
      if (coAdmins.some((a) => a.auth_id === userRow.auth_id)) {
        setAdminError('Este usuário já é co-administrador.');
        return;
      }
      const { error } = await supabase.from('tenant_admins').insert({
        tenant_id: tenant.id,
        auth_id: userRow.auth_id,
        email: newAdminEmail.trim().toLowerCase(),
        name: newAdminName.trim() || null,
      });
      if (error) throw error;
      setNewAdminEmail('');
      setNewAdminName('');
      const { data: updated } = await supabase
        .from('tenant_admins')
        .select('id, auth_id, email, name')
        .eq('tenant_id', tenant.id);
      setCoAdmins((updated ?? []) as TenantAdmin[]);
    } catch {
      setAdminError('Erro ao adicionar co-administrador.');
    } finally {
      setAdminLoading(false);
    }
  };

  const removeCoAdmin = async (adminId: string) => {
    await supabase.from('tenant_admins').delete().eq('id', adminId);
    setCoAdmins((prev) => prev.filter((a) => a.id !== adminId));
  };

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const periodRemaining =
    tenant?.status === 'active' && isTimeLimitedPlan(tenant.plan_id) && tenant.current_period_ends_at
      ? formatAccessTimeRemaining(tenant.current_period_ends_at)
      : null;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Painel</h1>
        <p className="text-slate-400 mt-1">Bem-vindo ao {tenant?.name ?? 'Braska'}</p>
      </div>

      {/* Plano temporário (Avulso): tempo restante */}
      {tenant?.status === 'active' && periodRemaining && tenant.plan_id === 'avulso' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 mb-6">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-white">Evento avulso</p>
            <p className="text-xs mt-0.5">
              Tempo restante: <strong>{periodRemaining}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {tenant?.status === 'trial' && trialDaysLeft !== null && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Trial gratuito</p>
            <p className="text-xs text-blue-400 mt-0.5">
              {trialDaysLeft > 0
                ? `${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}. Assine para continuar após o período.`
                : 'Seu trial expirou. Assine um plano para continuar.'}
            </p>
            <button onClick={() => navigate('/dashboard/assinatura')}
              className="mt-2 text-xs font-semibold text-blue-300 hover:text-white underline">
              Ver planos →
            </button>
          </div>
        </div>
      )}

      {tenant?.status === 'past_due' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Pagamento pendente</p>
            <p className="text-xs text-yellow-400 mt-0.5">Seu acesso pode ser suspenso em breve.</p>
            <button onClick={() => navigate('/dashboard/assinatura')}
              className="mt-2 text-xs font-semibold text-yellow-300 hover:text-white underline">
              Regularizar pagamento →
            </button>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Locais</span>
          </div>
          <p className="text-3xl font-black text-white">{locations.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            de {plan?.max_locations == null ? '∞' : plan.max_locations} disponíveis
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plano</span>
          </div>
          <p className="text-3xl font-black text-white">{plan?.name ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-1">
            {plan?.max_players == null ? 'Sessão ilimitada' : `Até ${plan.max_players} jogadores/sessão`}
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</span>
          </div>
          <p className={`text-3xl font-black ${isSubscriptionActive ? 'text-green-400' : 'text-red-400'}`}>
            {isSubscriptionActive ? 'Ativo' : 'Inativo'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {tenant?.status === 'trial' ? 'Período trial' : tenant?.status}
          </p>
        </div>
      </div>

      {/* Locations list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white">Seus locais</h2>
          <button onClick={() => navigate('/dashboard/locais')}
            className="text-sm text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1">
            Gerenciar <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-700 text-center">
            <MapPin className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold text-sm mb-2">Nenhum local criado ainda</p>
            <button onClick={() => navigate('/dashboard/locais')}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all">
              Criar primeiro local
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-800 bg-slate-900">
                <div>
                  <p className="font-semibold text-white text-sm">{loc.name}</p>
                  {tenant?.plan_id !== 'entrada' && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {appPublicHost()}/{loc.slug}
                    </p>
                  )}
                </div>
                <button onClick={() => navigate(`/${loc.slug}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all">
                  <ArrowRight className="w-3 h-3" /> Abrir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Co-administradores */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-white">Co-administradores</h2>
          <span className="text-xs text-slate-500">({coAdmins.length}/{MAX_CO_ADMINS})</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Co-administradores podem iniciar sessões, gerenciar partidas, pontuar e encerrar sessões nos seus locais. Apenas você (dono) tem acesso a este painel de gestão.
        </p>

        {coAdmins.length > 0 && (
          <div className="space-y-2 mb-4">
            {coAdmins.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900">
                <div>
                  <p className="text-sm font-semibold text-white">{a.name || a.email}</p>
                  {a.name && <p className="text-xs text-slate-500">{a.email}</p>}
                </div>
                <button
                  onClick={() => removeCoAdmin(a.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {coAdmins.length < MAX_CO_ADMINS && (
          <div className="p-4 rounded-xl border border-dashed border-slate-700 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Email do co-admin"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Nome (opcional)"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            {adminError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {adminError}
              </p>
            )}
            <button
              onClick={addCoAdmin}
              disabled={adminLoading || !newAdminEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {adminLoading ? 'Adicionando...' : 'Adicionar co-admin'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
