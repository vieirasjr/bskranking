import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

export interface Plan {
  id: string;
  name: string;
  price_brl: number;
  max_players: number | null;
  max_locations: number | null;
}

export interface Tenant {
  id: string;
  owner_auth_id: string;
  plan_id: string;
  name: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  mp_subscription_id: string | null;
  plan?: Plan;
}

export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  is_active: boolean;
  image_url: string | null;
  cover_image_url: string | null;
  website: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  basketball_formats: string[];
  hosts_tournaments: boolean;
  hosts_championships: boolean;
  phone: string | null;
  whatsapp: string | null;
  opening_hours_note: string | null;
  is_private: boolean;
  authorized_emails: string[];
}

interface TenantContextValue {
  tenant: Tenant | null;
  locations: Location[];
  plan: Plan | null;
  loading: boolean;
  isSubscriptionActive: boolean;
  canAddLocation: boolean;
  maxPlayers: number | null;
  refresh: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setTenant(null);
      setLocations([]);
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*, plan:plans(*)')
        .eq('owner_auth_id', user.id)
        .maybeSingle();

      if (!tenantData) {
        setTenant(null);
        setLocations([]);
        setPlan(null);
        setLoading(false);
        return;
      }

      const p = tenantData.plan as Plan;
      setTenant({ ...tenantData, plan: p });
      setPlan(p);

      const { data: locs } = await supabase
        .from('locations')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('created_at');

      setLocations(
        (locs ?? []).map((l) => ({
          ...(l as Location),
          basketball_formats: (l as { basketball_formats?: string[] }).basketball_formats ?? [],
          hosts_tournaments: (l as { hosts_tournaments?: boolean }).hosts_tournaments ?? false,
          hosts_championships: (l as { hosts_championships?: boolean }).hosts_championships ?? false,
          country: (l as { country?: string | null }).country ?? 'BR',
          cover_image_url: (l as { cover_image_url?: string | null }).cover_image_url ?? null,
          is_private: !!(l as { is_private?: boolean }).is_private,
          authorized_emails: (l as { authorized_emails?: string[] }).authorized_emails ?? [],
        })) as Location[]
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime: atualiza tenant imediatamente quando o backend confirmar pagamento
  useEffect(() => {
    if (!user || !tenant?.id) return;

    const channel = supabase
      .channel(`tenant-status:${tenant.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenant.id}` },
        (payload) => {
          const updated = payload.new as Omit<Tenant, 'plan'>;
          setTenant((prev) => prev ? { ...prev, ...updated } : null);
          // Se o plano mudou, re-fetch para carregar o plano novo
          if (updated.plan_id !== tenant.plan_id) {
            fetch();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, tenant?.id, tenant?.plan_id, fetch]);

  const isSubscriptionActive = (() => {
    if (!tenant) return false;
    if (tenant.status !== 'active') return false;
    // Planos com expiração por tempo (avulso)
    if (tenant.plan_id === 'avulso' && tenant.current_period_ends_at) {
      return new Date() < new Date(tenant.current_period_ends_at);
    }
    return true;
  })();

  const canAddLocation =
    plan?.max_locations == null ||
    locations.length < plan.max_locations;

  return (
    <TenantContext.Provider value={{
      tenant,
      locations,
      plan,
      loading,
      isSubscriptionActive,
      canAddLocation,
      maxPlayers: plan?.max_players ?? null,
      refresh: fetch,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
