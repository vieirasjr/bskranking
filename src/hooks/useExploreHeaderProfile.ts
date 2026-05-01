import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

/** Dados mínimos para o topbar principal (Explorar, Treinos, etc.). */
export function useExploreHeaderProfile(user: User | null) {
  const [profileName, setProfileName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profilePlayerCode, setProfilePlayerCode] = useState<string | null>(null);
  const [tenantFirstLocationSlug, setTenantFirstLocationSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileName('');
      setProfileAvatarUrl(null);
      setProfilePlayerCode(null);
      setTenantFirstLocationSlug(null);
      return;
    }
    const fallbackName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Atleta';
    setProfileName(String(fallbackName));
    let cancelled = false;

    supabase
      .from('basquete_users')
      .select('display_name, avatar_url, player_code')
      .eq('auth_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (data.display_name?.trim()) setProfileName(data.display_name.trim());
        setProfileAvatarUrl((data as { avatar_url?: string | null }).avatar_url ?? null);
        setProfilePlayerCode((data as { player_code?: string | null }).player_code ?? null);
      });

    Promise.all([
      supabase.from('tenants').select('id').eq('owner_auth_id', user.id).limit(1),
      supabase.from('tenant_admins').select('id').eq('auth_id', user.id).limit(1),
    ]).then(async ([owned]) => {
      if (cancelled) return;
      const ownedTenantId = owned.data?.[0]?.id as string | undefined;
      if (ownedTenantId) {
        const { data: loc } = await supabase
          .from('locations')
          .select('slug')
          .eq('tenant_id', ownedTenantId)
          .eq('is_active', true)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        if (!cancelled) setTenantFirstLocationSlug(loc?.slug ?? null);
      } else {
        setTenantFirstLocationSlug(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { profileName, profileAvatarUrl, profilePlayerCode, tenantFirstLocationSlug };
}
