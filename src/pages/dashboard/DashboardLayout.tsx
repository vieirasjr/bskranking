import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Trophy, MapPin, CreditCard, LogOut, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500',
  trial: 'bg-blue-500',
  past_due: 'bg-yellow-500',
  cancelled: 'bg-red-500',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  trial: 'Trial',
  past_due: 'Pagamento pendente',
  cancelled: 'Cancelado',
};

export default function DashboardLayout() {
  const { signOut } = useAuth();
  const { tenant, locations, loading } = useTenant();
  const navigate = useNavigate();

  // Tenant não encontrado após carregar → guia para completar setup
  if (!loading && !tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Configuração incompleta</h1>
          <p className="text-slate-400 text-sm mb-6">
            Sua conta ainda não tem um espaço configurado. Complete o cadastro para acessar o painel.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/cadastro')}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all"
            >
              Completar cadastro
            </button>
            <button
              onClick={signOut}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30 shrink-0">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm truncate">{tenant?.name ?? 'Basquete Next'}</p>
            {tenant && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[tenant.status] ?? 'bg-slate-500'}`} />
                <span className="text-[10px] text-slate-400">{STATUS_LABEL[tenant.status] ?? tenant.status}</span>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/dashboard" end
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }>
            <Trophy className="w-4 h-4 shrink-0" /> Painel
          </NavLink>
          <NavLink to="/dashboard/locais"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }>
            <MapPin className="w-4 h-4 shrink-0" /> Locais
          </NavLink>
          <NavLink to="/dashboard/assinatura"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }>
            <CreditCard className="w-4 h-4 shrink-0" /> Assinatura
          </NavLink>

          {/* Links rápidos dos locais */}
          {locations.length > 0 && (
            <div className="pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-2">Locais ativos</p>
              {locations.map((loc) => (
                <button key={loc.id} onClick={() => navigate(`/${loc.slug}`)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-white hover:bg-slate-800 transition-colors text-left">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">/{loc.slug}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-4 border-t border-slate-800 pt-4">
          <button onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut className="w-4 h-4 shrink-0" /> Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
