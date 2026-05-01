import { Swords, Trophy } from 'lucide-react';

export interface BracketTeam {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  /** Metade do mata-mata em duas colunas (H1 esquerda, H2 direita); null na final. */
  group_label?: string | null;
  team_a: BracketTeam | null;
  team_b: BracketTeam | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_id: string | null;
  status: 'pending' | 'live' | 'finished' | 'cancelled' | 'bye';
  next_match_id?: string | null;
  next_match_slot?: 'A' | 'B' | null;
}

interface Props {
  format: string;          // KNOCKOUT | ROUND_ROBIN | ...
  matches: BracketMatch[];
  compact?: boolean;
}

export default function BracketView({ format, matches, compact }: Props) {
  if (!matches || matches.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-slate-800 text-center">
        <Swords className="w-8 h-8 text-slate-700 mx-auto mb-2" />
        <p className="text-sm text-slate-400 font-semibold">Chaveamento ainda não gerado</p>
        <p className="text-xs text-slate-500 mt-1">
          O organizador vai gerar o chaveamento depois que as inscrições fecharem.
        </p>
      </div>
    );
  }

  if (format === 'ROUND_ROBIN') {
    return <RoundRobinView matches={matches} />;
  }

  // Default = knockout-style tree
  return <KnockoutView matches={matches} compact={compact} />;
}

function RoundRobinView({ matches }: { matches: BracketMatch[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        Rodada única · todos contra todos
      </p>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}

function KnockoutView({ matches, compact }: { matches: BracketMatch[]; compact?: boolean }) {
  // Agrupa por rodada
  const byRound = new Map<number, BracketMatch[]>();
  matches.forEach((m) => {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  });
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  // Detecta rodada preliminar (round 1 com menos jogos que round 2)
  const r1Count = byRound.get(1)?.length ?? 0;
  const r2Count = byRound.get(2)?.length ?? 0;
  const hasPlayIn = r2Count > 0 && r1Count > 0 && r1Count < r2Count;

  const maxRound = rounds[rounds.length - 1];
  const matchW = compact ? 180 : 220;

  const roundLabel = (r: number) => {
    if (hasPlayIn && r === 1) return 'Preliminar';
    const remaining = maxRound - r;
    if (remaining === 0) return 'Final';
    if (remaining === 1) return 'Semifinal';
    if (remaining === 2) return 'Quartas';
    if (remaining === 3) return 'Oitavas';
    return `Rodada ${r}`;
  };

  // Mapa: id da partida-alvo + slot → posição (1-based) do play-in que alimenta esse slot
  const playInLabelMap = new Map<string, number>();
  if (hasPlayIn) {
    const playInMatches = (byRound.get(1) ?? []).sort((a, b) => a.position - b.position);
    playInMatches.forEach((p, i) => {
      if (p.next_match_id && p.next_match_slot) {
        playInLabelMap.set(`${p.next_match_id}:${p.next_match_slot}`, i + 1);
      }
    });
  }

  // Caso degenerado: torneio com só a final (2 equipes)
  if (rounds.length === 1) {
    const only = (byRound.get(rounds[0]) ?? [])[0];
    return (
      <div className="flex items-center justify-center gap-3 py-6">
        <div style={{ width: matchW }}>
          {only && <BracketNode match={only} hasNextRound={false} isOnTop={false} mirror={false}
            aPlaceholder={playInLabelMap.get(`${only.id}:A`)}
            bPlaceholder={playInLabelMap.get(`${only.id}:B`)} />}
        </div>
        <ChampionTrophy />
      </div>
    );
  }

  // Para cada rodada não-final, divide em metade esquerda (posições baixas)
  // e metade direita (posições altas).
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = (byRound.get(finalRound) ?? [])[0];
  const nonFinalRounds = rounds.slice(0, -1);

  const splitRound = (r: number) => {
    const all = (byRound.get(r) ?? []).sort((a, b) => a.position - b.position);
    const leftLabeled = all.filter((m) => m.group_label === 'H1');
    const rightLabeled = all.filter((m) => m.group_label === 'H2');
    if (leftLabeled.length + rightLabeled.length === all.length && all.length > 0) {
      return {
        left: leftLabeled.sort((a, b) => a.position - b.position),
        right: rightLabeled.sort((a, b) => a.position - b.position),
      };
    }
    const splitIdx = Math.floor(all.length / 2);
    return { left: all.slice(0, splitIdx), right: all.slice(splitIdx) };
  };

  // Espaçamento vertical entre jogos cresce conforme avançamos para o centro
  const gapForRoundIdx = (ri: number) => Math.pow(2, ri) * 12;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-stretch gap-0 min-w-max">
        {/* LADO ESQUERDO: do externo ao interno */}
        {nonFinalRounds.map((r, ri) => {
          const { left } = splitRound(r);
          if (left.length === 0) return null;
          return (
            <RoundColumn
              key={`L-${r}`}
              matches={left}
              label={roundLabel(r)}
              hasNextRound={ri < nonFinalRounds.length - 1}
              mirror={false}
              matchW={matchW}
              gap={gapForRoundIdx(ri)}
              playInLabelMap={playInLabelMap}
            />
          );
        })}

        {/* CENTRO: final + troféu */}
        <div className="flex flex-col shrink-0 items-center justify-center px-2"
             style={{ width: matchW + 64 }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400 text-center mb-3">
            {roundLabel(finalRound)}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 w-full">
            {finalMatch && (
              <div style={{ width: matchW }}>
                <BracketNode
                  match={finalMatch}
                  hasNextRound={false}
                  isOnTop={false}
                  mirror={false}
                  aPlaceholder={playInLabelMap.get(`${finalMatch.id}:A`)}
                  bPlaceholder={playInLabelMap.get(`${finalMatch.id}:B`)}
                />
              </div>
            )}
            <ChampionTrophy />
          </div>
        </div>

        {/* LADO DIREITO: do interno ao externo (espelhado) */}
        {nonFinalRounds.slice().reverse().map((r, riRev) => {
          const ri = nonFinalRounds.length - 1 - riRev;
          const { right } = splitRound(r);
          if (right.length === 0) return null;
          return (
            <RoundColumn
              key={`R-${r}`}
              matches={right}
              label={roundLabel(r)}
              hasNextRound={ri < nonFinalRounds.length - 1}
              mirror={true}
              matchW={matchW}
              gap={gapForRoundIdx(ri)}
              playInLabelMap={playInLabelMap}
            />
          );
        })}
      </div>
    </div>
  );
}

function RoundColumn({
  matches,
  label,
  hasNextRound,
  mirror,
  matchW,
  gap,
  playInLabelMap,
}: {
  matches: BracketMatch[];
  label: string;
  hasNextRound: boolean;
  mirror: boolean;
  matchW: number;
  gap: number;
  playInLabelMap: Map<string, number>;
}) {
  return (
    <div className="flex flex-col shrink-0" style={{ width: matchW + 32 }}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center mb-3">
        {label}
      </div>
      <div className="flex-1 flex flex-col justify-around" style={{ gap: `${gap}px` }}>
        {matches.map((m, mi) => (
          <BracketNode
            key={m.id}
            match={m}
            hasNextRound={hasNextRound}
            isOnTop={mi % 2 === 0}
            mirror={mirror}
            aPlaceholder={playInLabelMap.get(`${m.id}:A`)}
            bPlaceholder={playInLabelMap.get(`${m.id}:B`)}
          />
        ))}
      </div>
    </div>
  );
}

function ChampionTrophy() {
  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
      <Trophy className="w-7 h-7 text-white" />
    </div>
  );
}

function BracketNode({
  match,
  hasNextRound,
  isOnTop,
  mirror,
  aPlaceholder,
  bPlaceholder,
}: {
  match: BracketMatch;
  hasNextRound: boolean;
  isOnTop: boolean;
  mirror: boolean;
  aPlaceholder?: number;
  bPlaceholder?: number;
}) {
  const aIsWinner = match.winner_id && match.winner_id === match.team_a?.id;
  const bIsWinner = match.winner_id && match.winner_id === match.team_b?.id;

  const card = (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden flex-1 min-w-0">
      <TeamRow team={match.team_a} score={match.team_a_score} isWinner={!!aIsWinner} placeholder={aPlaceholder} />
      <div className="h-px bg-slate-800" />
      <TeamRow team={match.team_b} score={match.team_b_score} isWinner={!!bIsWinner} placeholder={bPlaceholder} />
    </div>
  );

  if (mirror) {
    return (
      <div className="relative flex items-center">
        {hasNextRound && (
          <>
            <div
              className="absolute left-0 w-px bg-slate-700"
              style={{ top: isOnTop ? '50%' : 0, bottom: isOnTop ? 0 : '50%' }}
            />
            <div className="w-4 h-px bg-slate-700" />
          </>
        )}
        {card}
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      {card}
      {hasNextRound && (
        <>
          <div className="w-4 h-px bg-slate-700" />
          <div
            className="absolute right-0 w-px bg-slate-700"
            style={{ top: isOnTop ? '50%' : 0, bottom: isOnTop ? 0 : '50%' }}
          />
        </>
      )}
    </div>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  placeholder,
}: {
  team: BracketTeam | null;
  score: number | null;
  isWinner: boolean;
  placeholder?: number;
}) {
  const empty = !team;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${
        isWinner ? 'bg-orange-500/10' : ''
      }`}
    >
      {empty ? (
        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 shrink-0" />
      ) : team.logo_url ? (
        <img
          src={team.logo_url}
          alt=""
          className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-orange-300">
            {team.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          empty ? 'text-slate-600 italic' : isWinner ? 'text-white font-bold' : 'text-slate-200'
        }`}
      >
        {empty
          ? placeholder
            ? `Venc. preliminar ${placeholder}`
            : 'Aguardando'
          : team.name}
      </span>
      {score !== null && (
        <span className={`font-mono font-bold text-sm ${isWinner ? 'text-orange-300' : 'text-slate-500'}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
      <TeamRow team={match.team_a} score={match.team_a_score} isWinner={match.winner_id === match.team_a?.id} />
      <div className="h-px bg-slate-800" />
      <TeamRow team={match.team_b} score={match.team_b_score} isWinner={match.winner_id === match.team_b?.id} />
    </div>
  );
}
