import type { TournamentModality } from './tournamentDefaults';

export type TournamentFormat =
  | 'ROUND_ROBIN'
  | 'KNOCKOUT'
  | 'DOUBLE_ELIMINATION'
  | 'GROUP_STAGE'
  | 'CROSS_GROUPS'
  | 'HOME_AWAY'
  | 'SWISS';

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  ROUND_ROBIN:        'Todos contra todos',
  KNOCKOUT:           'Mata-mata (eliminação simples)',
  DOUBLE_ELIMINATION: 'Eliminação dupla',
  GROUP_STAGE:        'Fase de grupos + mata-mata',
  CROSS_GROUPS:       'Grupos cruzados',
  HOME_AWAY:          'Ida e volta',
  SWISS:              'Sistema suíço',
};

export const FORMAT_DESCRIPTION: Record<TournamentFormat, string> = {
  ROUND_ROBIN:        'Cada equipe enfrenta todas as outras. Ideal para poucas equipes.',
  KNOCKOUT:           'Confrontos diretos até restar um campeão. Funciona com qualquer nº de equipes (bye e fases decrescentes por metade).',
  DOUBLE_ELIMINATION: 'Só é eliminado com duas derrotas. Mais justo, mas com mais jogos.',
  GROUP_STAGE:        'Times divididos em grupos, classificados avançam ao mata-mata.',
  CROSS_GROUPS:       'Vencedores de grupos se cruzam na fase seguinte.',
  HOME_AWAY:          'Cada confronto em dois jogos (ida/volta). Melhor para torneios longos.',
  SWISS:              'Emparelhamento por desempenho. Ótimo para torneios com muitas equipes.',
};

/**
 * Recomenda o formato com base no nº de equipes reais (ou max_teams se ainda
 * não houver inscritos). O mata-mata usa duas metades (árvore decrescente
 * em cada lado até a final central), então qualquer N ≥ 2 funciona bem.
 */
export function recommendFormat(
  teamsCount: number | null | undefined,
  _modality?: TournamentModality
): TournamentFormat {
  const n = teamsCount ?? 0;
  if (n < 2) return 'KNOCKOUT';
  if (n <= 3) return 'ROUND_ROBIN';
  return 'KNOCKOUT';
}

export function estimateMatchCount(
  format: TournamentFormat,
  teamsCount: number | null | undefined
): number {
  const n = teamsCount ?? 0;
  if (n < 2) return 0;
  switch (format) {
    case 'ROUND_ROBIN':        return (n * (n - 1)) / 2;
    case 'KNOCKOUT':           return n - 1;
    case 'HOME_AWAY':          return n * (n - 1);
    case 'DOUBLE_ELIMINATION': return Math.max(0, 2 * n - 2);
    case 'GROUP_STAGE':        return estimateGroupStage(n);
    case 'CROSS_GROUPS':       return estimateGroupStage(n);
    case 'SWISS':              return n * Math.ceil(Math.log2(n)) / 2;
    default:                   return n - 1;
  }
}

function estimateGroupStage(n: number): number {
  const perGroup = Math.ceil(n / 2);
  const groupMatches = 2 * (perGroup * (perGroup - 1)) / 2;
  return groupMatches + 3;
}

export const IMPLEMENTED_FORMATS: TournamentFormat[] = ['KNOCKOUT', 'ROUND_ROBIN'];

export interface SimpleTeam {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface GeneratedMatch {
  round: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  group_label?: string | null;
  status: 'pending' | 'bye';
  next_index?: number;
  next_slot?: 'A' | 'B';
}

/**
 * Embaralha in-place (Fisher–Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type HalfRoot =
  | { kind: 'match'; idx: number }
  | { kind: 'team'; teamId: string };

/**
 * Constrói metade do mata-mata: em cada "camada externa" há ⌊n/2⌋ jogos;
 * times ímpares sobem de bye. Ex.: 5 equipes → 2 jogos + 1 bye, depois 1 jogo + 1 bye, etc.
 * (12 do lado → 3 jogos na 1ª rodada da metade, como em chave clássico.)
 */
function buildHalfMatches(teams: SimpleTeam[]): { matches: GeneratedMatch[]; root: HalfRoot } {
  if (teams.length === 0) throw new Error('buildHalfMatches: lista vazia');
  if (teams.length === 1) {
    return { matches: [], root: { kind: 'team', teamId: teams[0].id } };
  }

  type Slot =
    | { kind: 'team'; teamId: string }
    | { kind: 'winner'; matchIdx: number };

  let round = 1;
  let current: Slot[] = teams.map((t) => ({ kind: 'team', teamId: t.id }));
  const matches: GeneratedMatch[] = [];

  while (current.length > 1) {
    const g = Math.floor(current.length / 2);
    const next: Slot[] = [];
    let pos = 0;
    for (let i = 0; i < g; i++) {
      const a = current[i * 2]!;
      const b = current[i * 2 + 1]!;
      const parentIdx = matches.length;
      const gm: GeneratedMatch = {
        round,
        position: pos,
        team_a_id: a.kind === 'team' ? a.teamId : null,
        team_b_id: b.kind === 'team' ? b.teamId : null,
        status: 'pending',
      };
      if (a.kind === 'winner') {
        matches[a.matchIdx].next_index = parentIdx;
        matches[a.matchIdx].next_slot = 'A';
      }
      if (b.kind === 'winner') {
        matches[b.matchIdx].next_index = parentIdx;
        matches[b.matchIdx].next_slot = 'B';
      }
      matches.push(gm);
      next.push({ kind: 'winner', matchIdx: parentIdx });
      pos++;
    }
    if (current.length % 2 === 1) {
      next.push(current[current.length - 1]!);
    }
    current = next;
    round++;
  }

  const last = current[0]!;
  if (last.kind === 'team') {
    return { matches, root: { kind: 'team', teamId: last.teamId } };
  }
  return { matches, root: { kind: 'match', idx: last.matchIdx } };
}

const HALF_LEFT = 'H1';
const HALF_RIGHT = 'H2';

/**
 * Dois chaveamentos independentes (metade esquerda + metade direita), cada um com
 * árvore que diminui dos bordos ao centro; a final recebe os dois campeões das metades.
 * `group_label`: H1 | H2 para o layout; final com null.
 */
function buildSplitKnockout(teams: SimpleTeam[]): GeneratedMatch[] {
  const n = teams.length;
  const nL = Math.ceil(n / 2);
  const leftTeams = teams.slice(0, nL);
  const rightTeams = teams.slice(nL);

  const leftBuilt = buildHalfMatches(leftTeams);
  const rightBuilt = buildHalfMatches(rightTeams);

  const leftM = leftBuilt.matches.map((m) => ({ ...m, group_label: HALF_LEFT }));
  const rightM = rightBuilt.matches.map((m) => ({ ...m, group_label: HALF_RIGHT }));

  const lenL = leftM.length;
  const combined: GeneratedMatch[] = [...leftM, ...rightM];

  for (let i = lenL; i < combined.length; i++) {
    const m = combined[i];
    if (m.next_index !== undefined) m.next_index += lenL;
  }

  let finalRound = 1;
  if (combined.length > 0) {
    finalRound = Math.max(...combined.map((m) => m.round)) + 1;
  }

  const finalMatch: GeneratedMatch = {
    round: finalRound,
    position: 0,
    team_a_id: null,
    team_b_id: null,
    group_label: null,
    status: 'pending',
  };

  const finalIdx = combined.length;
  combined.push(finalMatch);

  if (leftBuilt.root.kind === 'match') {
    const li = leftBuilt.root.idx;
    combined[li].next_index = finalIdx;
    combined[li].next_slot = 'A';
  } else {
    finalMatch.team_a_id = leftBuilt.root.teamId;
  }

  if (rightBuilt.root.kind === 'match') {
    const ri = rightBuilt.root.idx + lenL;
    combined[ri].next_index = finalIdx;
    combined[ri].next_slot = 'B';
  } else {
    finalMatch.team_b_id = rightBuilt.root.teamId;
  }

  return combined;
}

/**
 * Gera um chaveamento eliminatório (knockout).
 * N ≥ 3: duas metades com árvore decrescente até a final central.
 * N = 2: uma única final.
 */
export function generateKnockout(teams: SimpleTeam[]): GeneratedMatch[] {
  const n = teams.length;
  if (n < 2) return [];
  const seeded = shuffle(teams);
  if (n === 2) return buildCleanKnockout(seeded);
  return buildSplitKnockout(seeded);
}

function buildCleanKnockout(teams: SimpleTeam[]): GeneratedMatch[] {
  const total = teams.length;
  const matches: GeneratedMatch[] = [];
  const rounds = Math.log2(total);
  const idxMap = new Map<string, number>();

  let globalIdx = 0;
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = total / Math.pow(2, r);
    for (let p = 0; p < matchesInRound; p++) {
      const isFirst = r === 1;
      const a = isFirst ? teams[p * 2] : null;
      const b = isFirst ? teams[p * 2 + 1] : null;
      matches.push({
        round: r,
        position: p,
        team_a_id: a?.id ?? null,
        team_b_id: b?.id ?? null,
        group_label: null,
        status: 'pending',
      });
      idxMap.set(`${r}:${p}`, globalIdx++);
    }
  }

  matches.forEach((m) => {
    if (m.round >= rounds) return;
    const nextR = m.round + 1;
    const nextP = Math.floor(m.position / 2);
    const slot: 'A' | 'B' = m.position % 2 === 0 ? 'A' : 'B';
    m.next_index = idxMap.get(`${nextR}:${nextP}`);
    m.next_slot = slot;
  });

  return matches;
}

export function generateRoundRobin(teams: SimpleTeam[]): GeneratedMatch[] {
  const matches: GeneratedMatch[] = [];
  let pos = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        round: 1,
        position: pos++,
        team_a_id: teams[i].id,
        team_b_id: teams[j].id,
        status: 'pending',
      });
    }
  }
  return matches;
}

export function generateBracket(
  format: TournamentFormat,
  teams: SimpleTeam[]
): GeneratedMatch[] {
  switch (format) {
    case 'KNOCKOUT':
      return generateKnockout(teams);
    case 'ROUND_ROBIN':
      return generateRoundRobin(teams);
    default:
      return generateKnockout(teams);
  }
}
