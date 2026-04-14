import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Trophy, MapPin, CreditCard, LogOut, ExternalLink, AlertCircle, Menu, X, ChevronLeft, ChevronRight, LayoutDashboard, Calendar, Shield, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { supabase } from '../../supabase';
import { formatAccessTimeRemaining, isTimeLimitedPlan } from '../../lib/planAccess';

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-500',
  trial:     'bg-blue-500',
  past_due:  'bg-yellow-500',
  cancelled: 'bg-red-500',
};
const STATUS_LABEL: Record<string, string> = {
  active:    'Ativo',
  trial:     'Trial',
  past_due:  'Pendente',
  cancelled: 'Cancelado',
};

const NAV_ITEMS = [
  { to: '/dashboard', end: true,              icon: LayoutDashboard, label: 'Painel'      },
  { to: '/dashboard/locais', end: false,       icon: MapPin,          label: 'Locais'      },
  { to: '/dashboard/eventos', end: false,      icon: Calendar,        label: 'Eventos'     },
  { to: '/dashboard/assinatura', end: false,   icon: CreditCard,      label: 'Assinatura'  },
];

export default function DashboardLayout() {
  const { signOut, user } = useAuth();
  const { tenant, locations, loading, plan } = useTenant();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('basquete_users')
      .select('issuperusuario')
      .eq('auth_id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(data?.issuperusuario === true));
  }, [user?.id]);

  const accessCountdown =
    tenant?.status === 'active' && isTimeLimitedPlan(tenant.plan_id) && tenant.current_period_ends_at
      ? formatAccessTimeRemaining(tenant.current_period_ends_at)
      : null;

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
            <button onClick={() => navigate('/cadastro')}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">
              Completar cadastro
            </button>
            <button onClick={signOut}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all">
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (isMobile = false) => (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 border-b border-slate-800 shrink-0 ${collapsed && !isMobile ? 'px-3 py-5 justify-center' : 'px-5 py-5'}`}>
        <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30 shrink-0">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="font-bold text-white text-sm truncate">{tenant?.name ?? 'Braska'}</p>
            {tenant && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[tenant.status] ?? 'bg-slate-500'}`} />
                <span className="text-[10px] text-slate-400">{STATUS_LABEL[tenant.status] ?? tenant.status}</span>
              </div>
            )}
            {tenant?.status === 'active' && accessCountdown && (!collapsed || isMobile) && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 px-2 py-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-orange-300/90 truncate">
                    Acesso temporário
                  </p>
                  <p className="text-[10px] text-orange-100/95 leading-tight">
                    Falta: <span className="font-bold text-white">{accessCountdown}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end}
            onClick={() => isMobile && setDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                collapsed && !isMobile ? 'justify-center' : ''
              } ${isActive ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }>
            <Icon className="w-4 h-4 shrink-0" />
            {(!collapsed || isMobile) && label}
          </NavLink>
        ))}

        {/* Links rápidos dos locais */}
        {(!collapsed || isMobile) && locations.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-2">Locais ativos</p>
            {locations.map((loc) => (
              <button key={loc.id} onClick={() => { navigate(`/${loc.slug}`); isMobile && setDrawerOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-white hover:bg-slate-800 transition-colors text-left">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">/{loc.slug}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <div className="px-2 pb-2 border-t border-slate-800 pt-3">
          <button onClick={() => setCollapsed(v => !v)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>}
          </button>
        </div>
      )}

      {/* Admin + Sign out */}
      <div className={`px-2 pb-4 border-t border-slate-800 pt-3 space-y-1`}>
        {isAdmin && (
          <button onClick={() => { navigate('/admin'); isMobile && setDrawerOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors ${collapsed && !isMobile ? 'justify-center' : ''}`}>
            <Shield className="w-4 h-4 shrink-0" />
            {(!collapsed || isMobile) && 'Super Admin'}
          </button>
        )}
        <button onClick={signOut}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${collapsed && !isMobile ? 'justify-center' : ''}`}>
          <LogOut className="w-4 h-4 shrink-0" />
          {(!collapsed || isMobile) && 'Sair'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">

      {/* ── Mobile top bar ─────────────────────────────────── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-30">
        <button onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm truncate max-w-[160px]">{tenant?.name ?? 'Braska'}</span>
        </div>
        {tenant && (
          <div className={`w-2 h-2 rounded-full ${STATUS_COLOR[tenant.status] ?? 'bg-slate-500'}`} />
        )}
      </header>

      {/* ── Mobile drawer overlay ───────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          {/* Drawer */}
          <aside className="relative z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-full">
            <button onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className={`hidden lg:flex flex-col shrink-0 bg-slate-900 border-r border-slate-800 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        {sidebarContent(false)}
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-h-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
        {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-orange-400' : 'text-slate-500'
              }`
            }>
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Padding para não sobrepor bottom nav no mobile */}
      <div className="lg:hidden h-16 shrink-0" />
    </div>
  );
}
