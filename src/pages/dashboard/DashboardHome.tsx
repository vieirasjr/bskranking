import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Trophy, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { appPublicHost } from '../../lib/publicAppUrl';
import { formatAccessTimeRemaining, isTimeLimitedPlan } from '../../lib/planAccess';

export default function DashboardHome() {
  const { tenant, locations, plan, isSubscriptionActive } = useTenant();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
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
    </div>
  );
}
