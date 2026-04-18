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
  KNOCKOUT:           'Confrontos diretos. Quem perde está fora. Ideal quando o nº de equipes é potência de 2.',
  DOUBLE_ELIMINATION: 'Só é eliminado com duas derrotas. Mais justo, mas com mais jogos.',
  GROUP_STAGE:        'Times divididos em grupos, classificados avançam ao mata-mata.',
  CROSS_GROUPS:       'Vencedores de grupos se cruzam na fase seguinte.',
  HOME_AWAY:          'Cada confronto em dois jogos (ida/volta). Melhor para torneios longos.',
  SWISS:              'Emparelhamento por desempenho. Ótimo para torneios com muitas equipes.',
};

/**
 * Potência de 2 (2, 4, 8, 16, 32, ...). Se a quantidade de equipes não é
 * potência de 2, o knockout fica com slots vazios (BYEs) — pouco elegante.
 */
function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/**
 * Recomenda o formato com base no nº de equipes reais (ou max_teams se ainda
 * não houver inscritos). A lógica prioriza:
 *   - Brackets "limpos": Knockout só quando N é potência de 2
 *   - Round Robin para N pequeno/não-pot2 (evita bracket cheio de BYEs)
 *   - Knockout com BYEs para N grande não-potência-de-2 (menos jogos que RR)
 */
export function recommendFormat(
  teamsCount: number | null | undefined,
  _modality?: TournamentModality
): TournamentFormat {
  const n = teamsCount ?? 0;
  if (n < 2) return 'KNOCKOUT';
  if (n <= 3) return 'ROUND_ROBIN';
  if (isPowerOfTwo(n) && n <= 16) return 'KNOCKOUT';
  if (n <= 12) return 'ROUND_ROBIN';
  return 'KNOCKOUT';
}

/**
 * Estima quantos jogos o formato vai gerar com N equipes.
 */
export function estimateMatchCount(
  format: TournamentFormat,
  teamsCount: number | null | undefined
): number {
  const n = teamsCount ?? 0;
  if (n < 2) return 0;
  switch (format) {
    case 'ROUND_ROBIN':        return (n * (n - 1)) / 2;
    case 'KNOCKOUT':           return n - 1;              // single-elim elimina 1 por jogo
    case 'HOME_AWAY':          return n * (n - 1);        // round robin em ida/volta
    case 'DOUBLE_ELIMINATION': return Math.max(0, 2 * n - 2); // aproximação
    case 'GROUP_STAGE':        return estimateGroupStage(n);
    case 'CROSS_GROUPS':       return estimateGroupStage(n);
    case 'SWISS':              return n * Math.ceil(Math.log2(n)) / 2;
    default:                   return n - 1;
  }
}

function estimateGroupStage(n: number): number {
  // 2 grupos, aproximação: round robin dentro dos grupos + mata-mata (semis+final)
  const perGroup = Math.ceil(n / 2);
  const groupMatches = 2 * (perGroup * (perGroup - 1)) / 2;
  return groupMatches + 3; // 2 semis + 1 final
}

/**
 * Formatos cuja geração já está implementada no sistema.
 */
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
  /** índice (0-based) para referenciar a próxima partida desta chave */
  next_index?: number;
  next_slot?: 'A' | 'B';
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
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

/**
 * Gera um chaveamento eliminatório (knockout) simples.
 * Suporta qualquer nº de equipes — completa com BYEs até chegar à próxima
 * potência de 2.
 */
export function generateKnockout(teams: SimpleTeam[]): GeneratedMatch[] {
  const total = nextPowerOfTwo(teams.length);
  const seeded = shuffle(teams);
  // Preenche com null (BYE) até completar `total`
  const slots: (SimpleTeam | null)[] = [...seeded];
  while (slots.length < total) slots.push(null);

  const matches: GeneratedMatch[] = [];
  const rounds = Math.log2(total);

  // Contabiliza índices por rodada para saber onde cada vencedor vai
  // Vencedor de round R posição P vai para round R+1 posição floor(P/2), slot A se P par, B se ímpar.
  let globalIdx = 0;
  const firstRoundIdxMap: Record<string, number> = {}; // key = `${round}:${position}`
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = total / Math.pow(2, r);
    for (let p = 0; p < matchesInRound; p++) {
      const isFirstRound = r === 1;
      const a = isFirstRound ? slots[p * 2] : null;
      const b = isFirstRound ? slots[p * 2 + 1] : null;
      const isBye = isFirstRound && (!a || !b) && !(a === null && b === null);
      matches.push({
        round: r,
        position: p,
        team_a_id: a?.id ?? null,
        team_b_id: b?.id ?? null,
        status: isBye ? 'bye' : 'pending',
      });
      firstRoundIdxMap[`${r}:${p}`] = globalIdx;
      globalIdx++;
    }
  }

  // Preenche next_index/slot
  matches.forEach((m) => {
    if (m.round >= rounds) return;
    const nextR = m.round + 1;
    const nextP = Math.floor(m.position / 2);
    const slot: 'A' | 'B' = m.position % 2 === 0 ? 'A' : 'B';
    const nextIdx = firstRoundIdxMap[`${nextR}:${nextP}`];
    m.next_index = nextIdx;
    m.next_slot = slot;
  });

  return matches;
}

/**
 * Gera partidas de round-robin (cada time joga com todos).
 */
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
      // Fallback: knockout até implementarmos os demais
      return generateKnockout(teams);
  }
}
