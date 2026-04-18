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
  team_a: BracketTeam | null;
  team_b: BracketTeam | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_id: string | null;
  status: 'pending' | 'live' | 'finished' | 'cancelled' | 'bye';
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

  const roundLabel = (r: number, max: number) => {
    const remaining = max - r;
    if (remaining === 0) return 'Final';
    if (remaining === 1) return 'Semifinal';
    if (remaining === 2) return 'Quartas';
    if (remaining === 3) return 'Oitavas';
    return `Rodada ${r}`;
  };

  const maxRound = rounds[rounds.length - 1];
  const matchW = compact ? 180 : 220;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-stretch gap-0 min-w-max">
        {rounds.map((r, ri) => {
          const roundMatches = (byRound.get(r) ?? []).sort((a, b) => a.position - b.position);
          // Separação vertical cresce por rodada: matches mais próximos em R1, mais espaçados nas rodadas finais
          const gap = Math.pow(2, ri) * 12;
          return (
            <div
              key={r}
              className="flex flex-col shrink-0"
              style={{ width: matchW + 32 }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center mb-3">
                {roundLabel(r, maxRound)}
              </div>
              <div className="flex-1 flex flex-col justify-around" style={{ gap: `${gap}px` }}>
                {roundMatches.map((m, mi) => (
                  <BracketNode
                    key={m.id}
                    match={m}
                    hasNextRound={ri < rounds.length - 1}
                    isOnTop={mi % 2 === 0}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {/* Troféu final */}
        <div className="flex items-center justify-center pl-4 pr-2 shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Trophy className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketNode({
  match,
  hasNextRound,
  isOnTop,
}: {
  match: BracketMatch;
  hasNextRound: boolean;
  isOnTop: boolean;
}) {
  const aIsWinner = match.winner_id && match.winner_id === match.team_a?.id;
  const bIsWinner = match.winner_id && match.winner_id === match.team_b?.id;

  return (
    <div className="relative flex items-center">
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden flex-1 min-w-0">
        <TeamRow team={match.team_a} score={match.team_a_score} isWinner={!!aIsWinner} />
        <div className="h-px bg-slate-800" />
        <TeamRow team={match.team_b} score={match.team_b_score} isWinner={!!bIsWinner} />
      </div>

      {/* Linha horizontal conectando ao próximo round */}
      {hasNextRound && (
        <>
          <div className="w-4 h-px bg-slate-700" />
          {/* Linha vertical (metade para cima ou para baixo) */}
          <div
            className="absolute right-0 w-px bg-slate-700"
            style={{
              top: isOnTop ? '50%' : 0,
              bottom: isOnTop ? 0 : '50%',
            }}
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
}: {
  team: BracketTeam | null;
  score: number | null;
  isWinner: boolean;
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
        {empty ? 'Aguardando' : team.name}
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
