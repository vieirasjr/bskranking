import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Users,
  Trophy,
  ArrowRight,
  AlertCircle,
  Clock,
  UserPlus,
  Trash2,
  Settings,
  Lock,
  Globe,
  X,
} from 'lucide-react';
import { useTenant, type Location } from '../../contexts/TenantContext';
import { appPublicHost } from '../../lib/publicAppUrl';
import { formatAccessTimeRemaining, isTimeLimitedPlan } from '../../lib/planAccess';
import { supabase } from '../../supabase';

interface LocationAdmin {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
}

const MAX_ADMINS_PER_LOCATION = 2;

export default function DashboardHome() {
  const { tenant, locations, plan, isSubscriptionActive, refresh } = useTenant();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [manageLoc, setManageLoc] = useState<Location | null>(null);

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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white text-sm truncate">{loc.name}</p>
                    {loc.is_private && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-400">
                        <Lock className="w-2.5 h-2.5" /> Privado
                      </span>
                    )}
                  </div>
                  {tenant?.plan_id !== 'entrada' && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {appPublicHost()}/{loc.slug}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setManageLoc(loc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                  >
                    <Settings className="w-3 h-3" /> Gestão
                  </button>
                  <button onClick={() => navigate(`/${loc.slug}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all">
                    <ArrowRight className="w-3 h-3" /> Abrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {manageLoc && tenant && (
        <LocationManageModal
          location={manageLoc}
          tenantId={tenant.id}
          ownerAuthId={tenant.owner_auth_id}
          onClose={() => setManageLoc(null)}
          onLocationChanged={refresh}
        />
      )}
    </div>
  );
}

interface ModalProps {
  location: Location;
  tenantId: string;
  ownerAuthId: string;
  onClose: () => void;
  onLocationChanged: () => void;
}

function LocationManageModal({ location, tenantId, ownerAuthId, onClose, onLocationChanged }: ModalProps) {
  const [isPrivate, setIsPrivate] = useState<boolean>(location.is_private);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const [admins, setAdmins] = useState<LocationAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const reloadAdmins = async () => {
    setLoadingAdmins(true);
    const { data } = await supabase
      .from('tenant_admins')
      .select('id, auth_id, email, name')
      .eq('tenant_id', tenantId)
      .eq('location_id', location.id);
    setAdmins((data ?? []) as LocationAdmin[]);
    setLoadingAdmins(false);
  };

  useEffect(() => {
    reloadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.id, tenantId]);

  const togglePrivacy = async (next: boolean) => {
    setSavingPrivacy(true);
    setPrivacyError(null);
    const { error } = await supabase
      .from('locations')
      .update({ is_private: next })
      .eq('id', location.id);
    setSavingPrivacy(false);
    if (error) {
      setPrivacyError('Não foi possível salvar.');
      return;
    }
    setIsPrivate(next);
    onLocationChanged();
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    if (admins.length >= MAX_ADMINS_PER_LOCATION) {
      setAdminError(`Máximo de ${MAX_ADMINS_PER_LOCATION} administradores por local.`);
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      const email = newAdminEmail.trim().toLowerCase();
      const { data: userRow } = await supabase
        .from('basquete_users')
        .select('auth_id')
        .eq('email', email)
        .maybeSingle();
      if (!userRow?.auth_id) {
        setAdminError('Usuário não encontrado. O email precisa estar cadastrado na plataforma.');
        return;
      }
      if (userRow.auth_id === ownerAuthId) {
        setAdminError('Você já é o dono deste local.');
        return;
      }
      if (admins.some((a) => a.auth_id === userRow.auth_id)) {
        setAdminError('Este usuário já é administrador deste local.');
        return;
      }
      const { error } = await supabase.from('tenant_admins').insert({
        tenant_id: tenantId,
        auth_id: userRow.auth_id,
        email,
        name: newAdminName.trim() || null,
        location_id: location.id,
      });
      if (error) throw error;
      setNewAdminEmail('');
      setNewAdminName('');
      await reloadAdmins();
    } catch {
      setAdminError('Erro ao adicionar administrador.');
    } finally {
      setAdminLoading(false);
    }
  };

  const removeAdmin = async (id: string) => {
    await supabase.from('tenant_admins').delete().eq('id', id);
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950 border border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-950">
          <div>
            <h3 className="font-bold text-white">Gestão do local</h3>
            <p className="text-xs text-slate-500 mt-0.5">{location.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Privacidade */}
          <section>
            <h4 className="text-sm font-bold text-white mb-3">Visibilidade</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => !savingPrivacy && togglePrivacy(false)}
                disabled={savingPrivacy}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                  !isPrivate
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                <p className="text-sm font-semibold">Público</p>
                <p className="text-xs opacity-80">Qualquer pessoa com o link entra.</p>
              </button>
              <button
                onClick={() => !savingPrivacy && togglePrivacy(true)}
                disabled={savingPrivacy}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                  isPrivate
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Lock className="w-4 h-4" />
                <p className="text-sm font-semibold">Privado</p>
                <p className="text-xs opacity-80">Só donos, gestores e emails autorizados.</p>
              </button>
            </div>
            {privacyError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {privacyError}
              </p>
            )}
          </section>

          {/* Administradores */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white">Administradores</h4>
              <span className="text-xs text-slate-500">
                {admins.length}/{MAX_ADMINS_PER_LOCATION}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Administradores podem iniciar sessões, gerenciar partidas, pontuar e encerrar sessões neste local.
            </p>

            {loadingAdmins ? (
              <p className="text-xs text-slate-500">Carregando...</p>
            ) : admins.length > 0 ? (
              <div className="space-y-2 mb-3">
                {admins.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{a.name || a.email}</p>
                      {a.name && <p className="text-xs text-slate-500 truncate">{a.email}</p>}
                    </div>
                    <button
                      onClick={() => removeAdmin(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-3">Nenhum administrador vinculado.</p>
            )}

            {admins.length < MAX_ADMINS_PER_LOCATION && (
              <div className="p-3 rounded-xl border border-dashed border-slate-700 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Email"
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
                  onClick={addAdmin}
                  disabled={adminLoading || !newAdminEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {adminLoading ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
