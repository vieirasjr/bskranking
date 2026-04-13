import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import Login from './Login';
import App from '../App';
import type { Location } from '../contexts/TenantContext';

interface TenantInfo {
  status: string;
  plan_id: string;
  name: string;
  owner_auth_id: string;
  plan: { max_players: number | null } | null;
}

function normalizeEmails(list: string[] | null | undefined): string[] {
  return (list ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export default function LocalApp() {
  const { slug } = useParams<{ slug: string }>();
  const { session, isGuest, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [location, setLocation] = useState<Location | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { navigate('/'); return; }

    (async () => {
      setLoadingLoc(true);
      const { data } = await supabase
        .from('locations')
        .select('*, tenant:tenants(status, plan_id, name, owner_auth_id, plan:plans(max_players))')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (!data) {
        setNotFound(true);
      } else {
        setLocation(data as Location);
        setTenant((data as { tenant: TenantInfo }).tenant);
      }
      setLoadingLoc(false);
    })();
  }, [slug, navigate]);

  if (authLoading || loadingLoc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <MapPin className="w-12 h-12 text-slate-700 mb-4" />
        <h1 className="text-2xl font-black mb-2">Local não encontrado</h1>
        <p className="text-slate-400 mb-6">O endereço <span className="text-orange-400">/{slug}</span> não existe ou foi desativado.</p>
        <button onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">
          Página inicial
        </button>
      </div>
    );
  }

  // Tenant cancelado / inativo
  if (tenant && (tenant.status === 'cancelled' || tenant.status === 'past_due')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-slate-500" />
        </div>
        <h1 className="text-2xl font-black mb-2">Local temporariamente inativo</h1>
        <p className="text-slate-400 max-w-xs">
          {location?.name} está com a assinatura {tenant.status === 'cancelled' ? 'cancelada' : 'com pagamento pendente'}.
        </p>
      </div>
    );
  }

  const isOwner = !!session?.user && session.user.id === tenant?.owner_auth_id;
  const authorizedEmails = normalizeEmails((location as Location & { authorized_emails?: string[] | null })?.authorized_emails);
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const emailAuthorized = !!currentEmail && authorizedEmails.includes(currentEmail);
  const isPrivate = !!(location as Location & { is_private?: boolean })?.is_private;

  if (isPrivate && (isGuest || (session?.user && !isOwner && !emailAuthorized))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-orange-400" />
        </div>
        <h1 className="text-2xl font-black mb-2">Acesso restrito</h1>
        <p className="text-slate-400 max-w-sm">
          Este local e privado. O gestor precisa autorizar seu email para voce entrar.
        </p>
        <button onClick={() => navigate('/locais')} className="mt-6 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">
          Voltar para locais
        </button>
      </div>
    );
  }

  if (!session && !isGuest) {
    return <Login redirectTo={`/${slug}`} locationName={location?.name} locationId={location?.id} allowGuest={!isPrivate} />;
  }

  // Garante vínculo do usuário autenticado com este local
  if (session?.user && location) {
    supabase
      .from('basquete_users')
      .select('id')
      .eq('auth_id', session.user.id)
      .maybeSingle()
      .then(({ data: bu }) => {
        if (!bu?.id) return;
        supabase
          .from('location_members')
          .upsert({ location_id: location.id, user_id: bu.id }, { onConflict: 'location_id,user_id', ignoreDuplicates: true })
          .then(() => {});
      });
  }

  return (
    <App
      locationId={location!.id}
      locationSlug={slug!}
      locationName={location!.name}
      isOwner={isOwner}
      maxPlayers={tenant?.plan?.max_players ?? null}
      venueCoords={
        location?.lat != null && location?.lng != null
          ? { lat: location.lat, lng: location.lng, radiusMeters: location.radius_m ?? 50 }
          : undefined
      }
    />
  );
}

// Header mínimo reutilizável (usado dentro do App também)
export function LocationHeader({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <Trophy className="w-4 h-4 text-orange-500" />
      <span className="font-semibold text-white">{name}</span>
      <span>·</span>
      <span>/{slug}</span>
    </div>
  );
}
