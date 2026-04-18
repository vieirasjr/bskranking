import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Loader2, Check } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { brl, isTimeLimitedPlan } from '../../lib/planAccess';
import { supabase } from '../../supabase';

interface DbPlan {
  id: string;
  name: string;
  price_brl: number;
  max_players: number | null;
  max_locations: number | null;
  max_events: number | null;
  is_active: boolean;
  can_create_tournaments?: boolean;
}

interface FeatureRow {
  id: string;
  marketing_label: string | null;
  sort_order: number;
}

interface PlanFeatureRow {
  plan_id: string;
  feature_id: string;
  enabled: boolean;
}

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
  const [dbPlans, setDbPlans] = useState<DbPlan[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatureRow[]>([]);

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price_brl')
      .then(({ data }) => { if (data) setDbPlans(data); });

    supabase
      .from('features')
      .select('id, marketing_label, sort_order')
      .order('sort_order')
      .then(({ data }) => { if (data) setFeatures(data as FeatureRow[]); });

    supabase
      .from('plan_features')
      .select('plan_id, feature_id, enabled')
      .then(({ data }) => { if (data) setPlanFeatures(data as PlanFeatureRow[]); });
  }, []);

  const marketingBullets = (planId: string): string[] => {
    const disabled = new Set(
      planFeatures.filter((r) => r.plan_id === planId && r.enabled === false).map((r) => r.feature_id),
    );
    return features
      .filter((f) => f.marketing_label && !disabled.has(f.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => f.marketing_label!);
  };

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
        {dbPlans.length === 0 && (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Carregando planos...</span>
          </div>
        )}
        {dbPlans.map((p) => {
          const isCurrent = plan?.id === p.id && tenant?.status === 'active';
          const price = p.price_brl / 100;
          const locs = p.max_locations ?? '∞';
          const players = p.max_players ? `${p.max_players} jogadores/sessão` : 'sessão ilimitada';
          const bullets = marketingBullets(p.id);
          return (
            <div key={p.id} className={`flex items-start justify-between p-4 rounded-2xl border transition-all ${
              isCurrent
                ? 'border-orange-500/50 bg-orange-500/5'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white">{p.name}</p>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
                      Atual
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {brl(price)} · {players} · {locs} {(p.max_locations ?? 2) === 1 ? 'local' : 'locais'}
                </p>
                {bullets.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <Check className="w-3 h-3 shrink-0 mt-0.5 text-orange-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
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
        <p className="text-xs text-slate-600 text-center">
          Pagamentos processados com segurança
        </p>
      </div>
    </div>
  );
}
