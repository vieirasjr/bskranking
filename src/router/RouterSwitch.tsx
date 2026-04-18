import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LandingPage from '../pages/LandingPage';
import ExplorarLocaisPage from '../pages/ExplorarLocaisPage';
import LocaisListPage from '../pages/LocaisListPage';
import TorneiosListPage from '../pages/TorneiosListPage';
import TreinosPage from '../pages/TreinosPage';
import Login from '../pages/Login';
import CadastroAdmin from '../pages/CadastroAdmin';
import LocalApp from '../pages/LocalApp';
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import DashboardHome from '../pages/dashboard/DashboardHome';
import DashboardLocais from '../pages/dashboard/DashboardLocais';
import DashboardEventos from '../pages/dashboard/DashboardEventos';
import DashboardTorneios from '../pages/dashboard/DashboardTorneios';
import DashboardAssinatura from '../pages/dashboard/DashboardAssinatura';
import DashboardCheckout from '../pages/dashboard/DashboardCheckout';
import SuperAdmin from '../pages/SuperAdmin';
import TorneioInscricaoPage from '../pages/TorneioInscricaoPage';
import MinhasEquipesPage from '../pages/MinhasEquipesPage';
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

function RedirectToTenant() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/${slug}`} replace />;
}

export default function RouterSwitch() {
  return (
    <Routes future={{ v7_relativeSplatPath: true }}>
      {/* Página inicial pública (atletas) */}
      <Route path="/" element={<ExplorarLocaisPage />} />
      <Route path="/landing" element={<LandingPage />} />

      {/* Listagem completa de locais (busca + filtros) */}
      <Route path="/locais" element={<LocaisListPage />} />
      {/* /locais/:slug redireciona para o tenant diretamente */}
      <Route path="/locais/:slug" element={<RedirectToTenant />} />

      {/* Listagem completa de torneios (busca + filtros) */}
      <Route path="/torneios" element={<TorneiosListPage />} />

      {/* Treinos — em breve */}
      <Route path="/treinos" element={<TreinosPage />} />

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
        <Route path="torneios" element={<DashboardTorneios />} />
        <Route path="assinatura" element={<DashboardAssinatura />} />
        <Route path="checkout/:planId" element={<DashboardCheckout />} />
      </Route>

      {/* Super Admin */}
      <Route path="/admin" element={<PrivateRoute><SuperAdmin /></PrivateRoute>} />

      {/* Página pública de inscrição de torneio */}
      <Route path="/torneios/:slug" element={<TorneioInscricaoPage />} />

      {/* Minhas equipes (logado) */}
      <Route path="/minhas-equipes" element={<MinhasEquipesPage />} />

      {/* App público de cada local (slug dinâmico) */}
      <Route path="/:slug" element={<LocalApp />} />
    </Routes>
  );
}
