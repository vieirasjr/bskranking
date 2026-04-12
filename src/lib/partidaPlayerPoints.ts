/**
 * player_points (JSONB em partida_sessoes):
 * - Chave: id da linha em `players` (instância na fila / partida).
 * - Valor: número (legado) ou objeto { points, user_id, name }:
 *   - points: pontos na partida;
 *   - user_id: basquete_users.id quando cadastrado (identidade para ranking / histórico);
 *   - name: nome exibido na lista (sempre útil; visitantes só têm name + user_id null).
 *
 * Totais team1_points / team2_points vêm do trigger (soma points).
 */

export type PlayerPointsIdentity = {
  user_id: string | null;
  /** Nome na lista no momento do lançamento */
  name: string;
};

export type NormalizedPlayerPointsEntry = PlayerPointsIdentity & {
  points: number;
};

export type PartidaPlayerPointsJson = {
  team1: Record<string, NormalizedPlayerPointsEntry>;
  team2: Record<string, NormalizedPlayerPointsEntry>;
};

function normalizeEntry(raw: unknown): NormalizedPlayerPointsEntry {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { points: raw, user_id: null, name: '' };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const pt = typeof o.points === 'number' ? o.points : Number(o.points);
    const points = Number.isFinite(pt) ? pt : 0;
    const user_id =
      typeof o.user_id === 'string'
        ? o.user_id
        : o.user_id === null || o.user_id === undefined
          ? null
          : null;
    const name = typeof o.name === 'string' ? o.name : '';
    return { points, user_id, name };
  }
  return { points: 0, user_id: null, name: '' };
}

function serializeEntry(e: NormalizedPlayerPointsEntry): Record<string, unknown> {
  return {
    points: e.points,
    user_id: e.user_id,
    name: e.name.trim() || '',
  };
}

export function parsePartidaPlayerPoints(raw: unknown): PartidaPlayerPointsJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { team1: {}, team2: {} };
  }
  const o = raw as Record<string, unknown>;
  const asTeam = (v: unknown): Record<string, NormalizedPlayerPointsEntry> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, NormalizedPlayerPointsEntry> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = normalizeEntry(val);
    }
    return out;
  };
  return {
    team1: asTeam(o.team1),
    team2: asTeam(o.team2),
  };
}

/** Serializa para JSONB (objeto por jogador com points + identidade). */
export function partidaPlayerPointsToJson(pp: PartidaPlayerPointsJson): {
  team1: Record<string, Record<string, unknown>>;
  team2: Record<string, Record<string, unknown>>;
} {
  const ser = (m: Record<string, NormalizedPlayerPointsEntry>) => {
    const o: Record<string, Record<string, unknown>> = {};
    for (const [k, e] of Object.entries(m)) {
      o[k] = serializeEntry(e);
    }
    return o;
  };
  return { team1: ser(pp.team1), team2: ser(pp.team2) };
}

export function applyPlayerPointsDelta(
  pp: PartidaPlayerPointsJson,
  team: 'team1' | 'team2',
  playerId: string,
  delta: number,
  identity: PlayerPointsIdentity
): PartidaPlayerPointsJson {
  const next: PartidaPlayerPointsJson = {
    team1: { ...pp.team1 },
    team2: { ...pp.team2 },
  };
  const other: 'team1' | 'team2' = team === 'team1' ? 'team2' : 'team1';
  if (Object.prototype.hasOwnProperty.call(next[other], playerId)) {
    delete next[other][playerId];
  }
  const prev = normalizeEntry(next[team][playerId] as unknown);
  const nv = Math.max(prev.points + delta, 0);
  if (nv === 0) {
    delete next[team][playerId];
  } else {
    const user_id = identity.user_id ?? prev.user_id ?? null;
    const name = (identity.name?.trim() ? identity.name : prev.name) || '';
    next[team][playerId] = { points: nv, user_id, name };
  }
  return next;
}

export function totalsFromPlayerPoints(pp: PartidaPlayerPointsJson): { t1: number; t2: number } {
  const sum = (m: Record<string, NormalizedPlayerPointsEntry>) =>
    Object.values(m).reduce((acc, e) => acc + (Number.isFinite(e.points) ? e.points : 0), 0);
  return { t1: sum(pp.team1), t2: sum(pp.team2) };
}
