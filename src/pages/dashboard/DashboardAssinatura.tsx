import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { brl, isTimeLimitedPlan } from '../../lib/planAccess';

const PLANS = [
  { id: 'teste',        name: 'Experiência 7 dias', price: 1,    sessionPlayers: 5,    locations: 1,  note: '7 dias · 5 jogadores/sessão' },
  { id: 'entrada',      name: 'Entrada',        price: 36.9, sessionPlayers: 20,   locations: 1,  note: 'mensal · 20 jogadores/sessão' },
  { id: 'basico',       name: 'Básico',         price: 100,  sessionPlayers: 30,   locations: 1,  note: 'mensal · 30 jogadores/sessão' },
  { id: 'profissional', name: 'Profissional',   price: 150,  sessionPlayers: 40,   locations: 2,  note: 'mensal · 40 jogadores/sessão' },
  { id: 'enterprise',   name: 'Enterprise',     price: 200,  sessionPlayers: null, locations: 4,  note: 'mensal · sessão ilimitada' },
];

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Assinatura ativa',       color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  past_due:  { label: 'Pagamento pendente',     color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  cancelled: { label: 'Sem assinatura ativa — escolha um plano abaixo', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function DashboardAssinatura() {
  const { tenant, plan, refresh } = useTenant();
  const { session: _session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mpResult = searchParams.get('mp');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = (planId: string) => {
    setLoading(planId);
    navigate(`/dashboard/checkout/${planId}`);
  };

  const handleCancel = async () => {
    if (!tenant?.mp_subscription_id) return;
    setLoading('cancel');
    setError(null);
    try {
      const res = await fetch(`/api/mp/cancel-subscription/${tenant.mp_subscription_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${_session?.access_token ?? ''}` },
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Erro ao cancelar.');
        return;
      }
      refresh();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(null);
    }
  };

  const statusInfo = tenant?.status ? STATUS_INFO[tenant.status] : null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Assinatura</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie seu plano e forma de pagamento</p>
      </div>

      {/* MP result feedback */}
      {mpResult === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-300 mb-6">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Pagamento confirmado!</p>
            <p className="text-xs text-green-400 mt-0.5">Sua assinatura será ativada em instantes.</p>
          </div>
          <button onClick={refresh} className="ml-auto p-1.5 hover:bg-green-500/10 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}
      {mpResult === 'pending' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Pagamento em processamento. Pode levar alguns minutos.</p>
        </div>
      )}
      {mpResult === 'failure' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Pagamento não aprovado. Tente novamente ou use outro método.</p>
        </div>
      )}

      {/* Status atual */}
      {statusInfo && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${statusInfo.bg} mb-6`}>
          <CreditCard className={`w-5 h-5 shrink-0 ${statusInfo.color}`} />
          <div>
            <p className={`font-semibold text-sm ${statusInfo.color}`}>{statusInfo.label}</p>
            {tenant?.current_period_ends_at && (
              <p className="text-xs text-slate-400 mt-0.5">
                {isTimeLimitedPlan(tenant.plan_id)
                  ? <>Acesso válido até {new Date(tenant.current_period_ends_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</>
                  : <>Próxima cobrança: {new Date(tenant.current_period_ends_at).toLocaleDateString('pt-BR')}</>}
              </p>
            )}
          </div>
          {tenant?.mp_subscription_id && (
            <button onClick={handleCancel} disabled={loading === 'cancel'}
              className="ml-auto text-xs text-slate-500 hover:text-red-400 underline transition-colors">
              {loading === 'cancel' ? 'Cancelando...' : 'Cancelar assinatura'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Planos */}
      <h2 className="font-bold text-white mb-4">
        {tenant?.status === 'active' ? 'Trocar de plano' : 'Escolha um plano'}
      </h2>
      <div className="space-y-3">
        {PLANS.map((p) => {
          const isCurrent = plan?.id === p.id && tenant?.status === 'active';
          return (
            <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              isCurrent
                ? 'border-orange-500/50 bg-orange-500/5'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white">{p.name}</p>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
                      Atual
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {brl(p.price)} · {p.note} ·{' '}
                  {p.locations} {p.locations === 1 ? 'local' : 'locais'}
                </p>
              </div>
              {!isCurrent && (
                <button
                  onClick={() => handleSubscribe(p.id)}
                  disabled={!!loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50 shrink-0 ml-4"
                >
                  {loading === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {loading === p.id ? 'Aguarde...' : 'Assinar'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 mt-6">
        <img
          src="https://imgmp.mlstatic.com/org-img/banners/br/medios/online/468X60.jpg"
          alt="Meios de pagamento Mercado Pago"
          className="h-8 object-contain opacity-70"
        />
        <p className="text-xs text-slate-600 text-center">
          Pagamentos processados com segurança via Mercado Pago
        </p>
      </div>
    </div>
  );
}
