import { Home, Trophy, Calendar, Dumbbell, User } from 'lucide-react';
import { BottomNavTabButton } from './BottomNavTabButton';

export type ExploreNavTabId = 'inicio' | 'rank' | 'eventos' | 'perfil';

export interface ExploreAppBottomNavProps {
  darkMode: boolean;
  /** Aba do explorar ativa, ou `null` (ex.: visão atleta). */
  exploreActive: ExploreNavTabId | null;
  treinosActive: boolean;
  onSelectInicio: () => void;
  onSelectRank: () => void;
  onSelectEventos: () => void;
  onSelectPerfil: () => void;
  onSelectTreinos: () => void;
}

export function ExploreAppBottomNav({
  darkMode,
  exploreActive,
  treinosActive,
  onSelectInicio,
  onSelectRank,
  onSelectEventos,
  onSelectPerfil,
  onSelectTreinos,
}: ExploreAppBottomNavProps) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 border-t backdrop-blur-lg z-50 transition-colors duration-300 ${
        darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-around">
        <BottomNavTabButton
          active={exploreActive === 'inicio'}
          onClick={onSelectInicio}
          icon={<Home className="w-5 h-5" />}
          label="Início"
          darkMode={darkMode}
        />
        <BottomNavTabButton
          active={exploreActive === 'rank'}
          onClick={onSelectRank}
          icon={<Trophy className="w-5 h-5" />}
          label="Rank"
          darkMode={darkMode}
        />
        <BottomNavTabButton
          active={exploreActive === 'eventos'}
          onClick={onSelectEventos}
          icon={<Calendar className="w-5 h-5" />}
          label="Eventos"
          darkMode={darkMode}
        />
        <BottomNavTabButton
          active={treinosActive}
          onClick={onSelectTreinos}
          icon={<Dumbbell className="w-5 h-5" />}
          label="Treinos"
          darkMode={darkMode}
          pulseBadge={!treinosActive}
        />
        <BottomNavTabButton
          active={exploreActive === 'perfil'}
          onClick={onSelectPerfil}
          icon={<User className="w-5 h-5" />}
          label="Perfil"
          darkMode={darkMode}
        />
      </div>
    </nav>
  );
}
