/**
 * Busca de endereços via Nominatim (OpenStreetMap).
 * Gratuito, sem chave de API.
 * Respeita o rate limit de 1 req/s.
 */

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
}

export interface ParsedAddress {
  displayName: string;
  lat: number;
  lng: number;
  addressLine: string;
  city: string;
  state: string;
  country: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

let lastRequest = 0;

export async function searchAddress(query: string): Promise<NominatimResult[]> {
  if (!query.trim() || query.trim().length < 3) return [];

  // Rate limit: 1 req/s
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'br',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'Braska/1.0' },
  });

  if (!res.ok) return [];
  return res.json() as Promise<NominatimResult[]>;
}

export function parseNominatimResult(r: NominatimResult): ParsedAddress {
  const a = r.address;
  const road = [a.road, a.house_number].filter(Boolean).join(', ');
  const neighbourhood = a.neighbourhood || a.suburb || '';
  const addressLine = [road, neighbourhood].filter(Boolean).join(' — ');
  const city = a.city || a.town || a.village || a.municipality || '';
  const state = a.state || '';
  // Extrai a sigla da UF do state (ex: "São Paulo" → buscar na address, ou usar o state completo)
  const country = (a.country_code || 'BR').toUpperCase();

  return {
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    addressLine,
    city,
    state,
    country,
  };
}
