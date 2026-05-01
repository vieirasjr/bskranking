import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  partidaPlayerPointsToJson,
  parsePartidaPlayerPoints,
} from './partidaPlayerPoints';

const STORE_VERSION = 2 as const;

export type MatchPlayerStatRow = {
  points: number;
  blocks: number;
  steals: number;
  assists: number;
  rebounds: number;
  clutch_points?: number;
};

export type MissedAttemptsMap = Record<
  string,
  { shot_1: number; shot_2: number; shot_3: number; turnover: number }
>;

export type PartidaOfflineSnapshot = {
  v: typeof STORE_VERSION;
  updatedAt: number;
  partidaSessaoId: string;
  locationId: string | null;
  team1MatchPoints: number;
  team2MatchPoints: number;
  firstScoringTeam: 'team1' | 'team2' | null;
  playerPoints: PartidaPlayerPointsJson;
  matchPlayerStats: Record<string, MatchPlayerStatRow>;
  missedAttempts: MissedAttemptsMap;
  showWinnerModal: 'team1' | 'team2' | null;
};

/** Passo a ser reexecutado ao voltar a conexão (ordem importa dentro do composite). */
export type PendingStep =
  | { kind: 'rpc_increment_stats'; payload: Record<string, unknown> }
  | {
      kind: 'stat_log';
      payload: { stat_type: string; value: number; user_id: string; location_id: string | null };
    }
  | { kind: 'stats_hot_streak'; statsRowId: string }
  | {
      kind: 'partida_player_points';
      partidaId: string;
      body: ReturnType<typeof partidaPlayerPointsToJson>;
    }
  | { kind: 'stats_update'; statsRowId: string; patch: Record<string, unknown> };

export type PendingComposite = {
  id: string;
  createdAt: number;
  steps: PendingStep[];
};

export type PartidaOfflineStored = {
  snapshot: PartidaOfflineSnapshot;
  unsynced: boolean;
  pending: PendingComposite[];
};

export function partidaOfflineKey(locationId: string | undefined | null, partidaId: string) {
  return `braska:partida-offline:v${STORE_VERSION}:${locationId ?? '—'}:${partidaId}`;
}

function reviveSnapshot(s: PartidaOfflineSnapshot): PartidaOfflineSnapshot {
  return {
    ...s,
    playerPoints: parsePartidaPlayerPoints(s.playerPoints as unknown),
  };
}

export function partidaOfflineRead(
  locationId: string | undefined | null,
  partidaId: string | null,
): PartidaOfflineStored | null {
  if (!partidaId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(partidaOfflineKey(locationId, partidaId));
    if (!raw) return null;
    const o = JSON.parse(raw) as PartidaOfflineStored;
    if (!o?.snapshot || o.snapshot.v !== STORE_VERSION) return null;
    o.snapshot = reviveSnapshot(o.snapshot);
    if (!Array.isArray(o.pending)) o.pending = [];
    return o;
  } catch {
    return null;
  }
}

export function partidaOfflineWrite(stored: PartidaOfflineStored, locationId: string | undefined | null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(partidaOfflineKey(locationId, stored.snapshot.partidaSessaoId), JSON.stringify(stored));
}

export function partidaOfflineClear(locationId: string | undefined | null, partidaId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(partidaOfflineKey(locationId, partidaId));
}

/** Substitui snapshot, acrescenta composites e marca unsynced se houver fila. */
export function partidaOfflinePersist(
  locationId: string | undefined | null,
  snapshot: PartidaOfflineSnapshot,
  newComposites: PendingComposite[],
) {
  const cur = partidaOfflineRead(locationId, snapshot.partidaSessaoId);
  const pending = [...(cur?.pending ?? []), ...newComposites];
  const snap: PartidaOfflineSnapshot = {
    ...snapshot,
    v: STORE_VERSION,
    updatedAt: Date.now(),
  };
  partidaOfflineWrite(
    {
      snapshot: snap,
      pending,
      unsynced: pending.length > 0,
    },
    locationId,
  );
}

export function partidaOfflineSaveSnapshotOnly(
  locationId: string | undefined | null,
  snapshot: PartidaOfflineSnapshot,
  keepPending: boolean,
) {
  const cur = partidaOfflineRead(locationId, snapshot.partidaSessaoId);
  const pending = keepPending ? (cur?.pending ?? []) : [];
  const snap: PartidaOfflineSnapshot = { ...snapshot, v: STORE_VERSION, updatedAt: Date.now() };
  partidaOfflineWrite(
    {
      snapshot: snap,
      pending,
      unsynced: pending.length > 0,
    },
    locationId,
  );
}

export function partidaOfflineMarkFlushed(locationId: string | undefined | null, partidaId: string) {
  const cur = partidaOfflineRead(locationId, partidaId);
  if (!cur) return;
  partidaOfflineWrite({ ...cur, pending: [], unsynced: false }, locationId);
}

export function partidaOfflinePendingCount(locationId: string | undefined | null, partidaId: string | null): number {
  return partidaOfflineRead(locationId, partidaId)?.pending.length ?? 0;
}

export async function partidaOfflineTryStepsPartial(
  supabase: SupabaseClient,
  steps: PendingStep[],
): Promise<{ ok: true } | { ok: false; remaining: PendingStep[] }> {
  for (let i = 0; i < steps.length; i++) {
    const { error } = await runStep(supabase, steps[i]);
    if (error) {
      return { ok: false, remaining: steps.slice(i) };
    }
  }
  return { ok: true };
}

async function runStep(supabase: SupabaseClient, step: PendingStep): Promise<{ error: Error | null }> {
  try {
    if (step.kind === 'rpc_increment_stats') {
      const { error } = await supabase.rpc('increment_stats', step.payload as never);
      return { error: error ? new Error(error.message) : null };
    }
    if (step.kind === 'stat_log') {
      const { error } = await supabase.from('stat_logs').insert(step.payload);
      return { error: error ? new Error(error.message) : null };
    }
    if (step.kind === 'stats_hot_streak') {
      const { error } = await supabase
        .from('stats')
        .update({ hot_streak_since: new Date().toISOString() })
        .eq('id', step.statsRowId);
      return { error: error ? new Error(error.message) : null };
    }
    if (step.kind === 'partida_player_points') {
      const { error } = await supabase
        .from('partida_sessoes')
        .update({ player_points: step.body })
        .eq('id', step.partidaId);
      return { error: error ? new Error(error.message) : null };
    }
    if (step.kind === 'stats_update') {
      const { error } = await supabase.from('stats').update(step.patch).eq('id', step.statsRowId);
      return { error: error ? new Error(error.message) : null };
    }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
  return { error: null };
}

/** Processa a fila na ordem; para no primeiro erro e mantém o composite atual e os seguintes. */
export async function partidaOfflineFlush(
  supabase: SupabaseClient,
  locationId: string | undefined | null,
  partidaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const cur = partidaOfflineRead(locationId, partidaId);
  if (!cur || cur.pending.length === 0) {
    if (cur?.unsynced && cur.pending.length === 0) {
      partidaOfflineMarkFlushed(locationId, partidaId);
    }
    return { ok: true };
  }

  for (let i = 0; i < cur.pending.length; i++) {
    const comp = cur.pending[i];
    for (let j = 0; j < comp.steps.length; j++) {
      const { error } = await runStep(supabase, comp.steps[j]);
      if (error) {
        const trimmed: PendingComposite = { ...comp, steps: comp.steps.slice(j) };
        const remaining = [trimmed, ...cur.pending.slice(i + 1)];
        partidaOfflineWrite(
          {
            ...cur,
            pending: remaining,
            unsynced: true,
          },
          locationId,
        );
        return { ok: false, error: error.message };
      }
    }
  }

  partidaOfflineMarkFlushed(locationId, partidaId);
  return { ok: true };
}

export function usePartidaConnectivity(supabase: SupabaseClient, intervalMs = 18000) {
  const [state, setState] = useState(() => ({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    dbOk: true,
  }));

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setState((s) => ({ ...s, online: false, dbOk: false }));
        return;
      }
      const { error } = await supabase.from('session').select('id').limit(1);
      if (cancelled) return;
      setState({ online: true, dbOk: !error });
    };

    const onOnline = () => {
      void ping();
    };
    const onOffline = () => {
      setState({ online: false, dbOk: false });
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void ping();
    const iv = window.setInterval(ping, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [supabase, intervalMs]);

  return state;
}

export function newCompositeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
