import { supabase } from '../supabase';

export interface PublicTenantBrief {
  id: string;
  name: string;
  status: string;
}

export interface PublicLocationRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  radius_m: number;
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
  tenant?: PublicTenantBrief | null;
}

/**
 * Locais de tenants cadastrados no sistema (exclui tenant cancelado).
 * Apenas linhas com `tenant_id` válido; join garante dados da organização.
 */
export async function fetchPublicLocations(): Promise<PublicLocationRow[]> {
  const baseSelect = `
      id,
      name,
      slug,
      description,
      image_url,
      cover_image_url,
      lat,
      lng,
      website,
      radius_m,
      address_line,
      city,
      state,
      country,
      basketball_formats,
      hosts_tournaments,
      hosts_championships,
      phone,
      whatsapp,
      opening_hours_note,
      tenant:tenants ( id, name, status )
    `;

  let data: unknown[] | null = null;
  let error: { message?: string } | null = null;

  const withPrivacy = await supabase
    .from('locations')
    .select(`${baseSelect}, is_private`)
    .eq('is_active', true)
    .order('name', { ascending: true });

  data = withPrivacy.data as unknown[] | null;
  error = withPrivacy.error as { message?: string } | null;

  // Compatibilidade: se a migration de privacidade ainda não foi aplicada,
  // refaz a consulta sem a coluna nova para não quebrar a vitrine.
  if (error && (error.message ?? '').toLowerCase().includes('is_private')) {
    const fallback = await supabase
      .from('locations')
      .select(baseSelect)
      .eq('is_active', true)
      .order('name', { ascending: true });
    data = fallback.data as unknown[] | null;
    error = fallback.error as { message?: string } | null;
  }

  if (error) {
    console.error('fetchPublicLocations:', error);
    return [];
  }

  const rows = (data ?? []) as (PublicLocationRow & { tenant?: PublicTenantBrief | PublicTenantBrief[] | null })[];
  return rows
    .map((r) => {
      const t = r.tenant;
      const tenant = Array.isArray(t) ? t[0] ?? null : t ?? null;
      return {
        ...r,
        tenant,
        basketball_formats: r.basketball_formats ?? [],
        hosts_tournaments: !!r.hosts_tournaments,
        hosts_championships: !!r.hosts_championships,
        is_private: !!(r as { is_private?: boolean }).is_private,
      } as PublicLocationRow;
    })
    .filter((r) => {
      const st = r.tenant?.status;
      // Se o embed de tenant vier null (ex.: RLS antigo sem política pública), ainda exibimos o local.
      if (st == null) return true;
      return st !== 'cancelled';
    });
}

export function matchesLocationSearch(loc: PublicLocationRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    loc.name,
    loc.description,
    loc.slug,
    loc.address_line,
    loc.city,
    loc.state,
    loc.country,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function googleMapsSearchQuery(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Normaliza WhatsApp para link wa.me */
export function whatsappHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}
