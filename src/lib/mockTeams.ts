import { supabase } from '../supabase';

export interface MockTeamSeed {
  name: string;
  coach: string;
  slug: string; // usado como seed do logo
}

export const MOCK_TEAMS: MockTeamSeed[] = [
  { name: 'Thunder Bolts',   coach: 'Carlos Freitas',   slug: 'thunder-bolts' },
  { name: 'Flying Eagles',   coach: 'Beatriz Nascimento', slug: 'flying-eagles' },
  { name: 'Urban Hoops',     coach: 'Rafael Souza',     slug: 'urban-hoops' },
  { name: 'Court Kings',     coach: 'Marina Oliveira',  slug: 'court-kings' },
  { name: 'Phoenix Rising',  coach: 'Lucas Martins',    slug: 'phoenix-rising' },
  { name: 'Steel Warriors',  coach: 'Fernanda Alves',   slug: 'steel-warriors' },
  { name: 'Night Hawks',     coach: 'Diego Ribeiro',    slug: 'night-hawks' },
  { name: 'Crimson Raiders', coach: 'Isabela Santos',   slug: 'crimson-raiders' },
  { name: 'Golden Lions',    coach: 'Thiago Costa',     slug: 'golden-lions' },
  { name: 'Electric Storm',  coach: 'Juliana Pereira',  slug: 'electric-storm' },
];

function mockLogoUrl(slug: string): string {
  // Serviço público de avatares determinísticos — sem chave de API
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(slug)}&backgroundType=gradientLinear`;
}

export async function createMockTeamsForTournament(
  tournamentId: string,
  ownerAuthId: string,
  count = 10
): Promise<{ inserted: number; error: string | null }> {
  const seeds = MOCK_TEAMS.slice(0, count);
  const rows = seeds.map((t) => ({
    tournament_id: tournamentId,
    owner_auth_id: ownerAuthId,
    name: t.name,
    logo_url: mockLogoUrl(t.slug),
    coach_name: t.coach,
    notes: 'Equipe de teste criada automaticamente',
  }));
  const { data, error } = await supabase.from('teams').insert(rows).select('id');
  if (error) return { inserted: 0, error: error.message };
  return { inserted: data?.length ?? 0, error: null };
}
