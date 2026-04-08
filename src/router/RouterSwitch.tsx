import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LandingPage from '../pages/LandingPage';
import Login from '../pages/Login';
import CadastroAdmin from '../pages/CadastroAdmin';
import LocalApp from '../pages/LocalApp';
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import DashboardHome from '../pages/dashboard/DashboardHome';
import DashboardLocais from '../pages/dashboard/DashboardLocais';
import DashboardEventos from '../pages/dashboard/DashboardEventos';
import DashboardAssinatura from '../pages/dashboard/DashboardAssinatura';
import DashboardCheckout from '../pages/dashboard/DashboardCheckout';
import { TenantProvider } from '../contexts/TenantContext';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return session ? <>{children}</> : <Navigate to="/entrar" replace />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return session ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function RouterSwitch() {
  return (
    <Routes future={{ v7_relativeSplatPath: true }}>
      {/* Página inicial pública */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth — redireciona para /dashboard se já autenticado */}
      <Route path="/entrar" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/cadastro" element={<CadastroAdmin />} />

      {/* Dashboard admin — privado */}
      <Route path="/dashboard" element={
        <PrivateRoute>
          <TenantProvider>
            <DashboardLayout />
          </TenantProvider>
        </PrivateRoute>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="locais" element={<DashboardLocais />} />
        <Route path="eventos" element={<DashboardEventos />} />
        <Route path="assinatura" element={<DashboardAssinatura />} />
        <Route path="checkout/:planId" element={<DashboardCheckout />} />
      </Route>

      {/* App público de cada local (slug dinâmico) */}
      <Route path="/:slug" element={<LocalApp />} />
    </Routes>
  );
}
