import { useEffect, useRef, useState } from 'react';
import { Search, X, Check, UserCircle } from 'lucide-react';
import { supabase } from '../supabase';

export interface BasqueteUserLite {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  player_code: string | null;
}

interface Props {
  selected: BasqueteUserLite | null;
  onSelect: (user: BasqueteUserLite) => void;
  onClear: () => void;
  excludeIds?: string[];     // IDs já escolhidos (ocultar nas sugestões)
  placeholder?: string;
  autoFocus?: boolean;
}

export default function PlayerSearchSelect({
  selected, onSelect, onClear, excludeIds = [], placeholder = 'Código, nome ou email', autoFocus,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BasqueteUserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click fora fecha o dropdown
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Busca debounced
  useEffect(() => {
    if (selected) return; // não busca enquanto tiver seleção
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      // Se parece um código (5-8 chars alfanuméricos), tenta match exato primeiro
      const codeMatch = /^[A-Za-z0-9]{5,8}$/.test(q) ? q.toUpperCase() : null;

      let rows: BasqueteUserLite[] = [];
      if (codeMatch) {
        const { data } = await supabase
          .from('basquete_users')
          .select('id, display_name, full_name, email, avatar_url, player_code')
          .eq('player_code', codeMatch)
          .limit(5);
        rows = (data ?? []) as BasqueteUserLite[];
      }
      if (rows.length === 0) {
        const like = `%${q}%`;
        const { data } = await supabase
          .from('basquete_users')
          .select('id, display_name, full_name, email, avatar_url, player_code')
          .or(`display_name.ilike.${like},full_name.ilike.${like},email.ilike.${like}`)
          .limit(8);
        rows = (data ?? []) as BasqueteUserLite[];
      }
      if (cancelled) return;
      const filtered = rows.filter((u) => !excludeIds.includes(u.id));
      setResults(filtered);
      setLoading(false);
    }, 250);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, excludeIds, selected]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl">
        {selected.avatar_url ? (
          <img src={selected.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-orange-300" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate font-medium">
            {selected.display_name || selected.full_name || selected.email}
          </p>
          <p className="text-[11px] text-slate-500 font-mono truncate">
            {selected.player_code ? `#${selected.player_code}` : selected.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          title="Remover seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          {loading ? (
            <div className="p-3 text-xs text-slate-500">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-slate-500">
              Nenhum atleta encontrado. O jogador precisa ter conta no app.
            </div>
          ) : (
            results.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => { onSelect(u); setQuery(''); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                    <UserCircle className="w-5 h-5 text-orange-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">
                    {u.display_name || u.full_name || u.email}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    {u.player_code ? `#${u.player_code}` : ''}{u.player_code && u.email ? ' · ' : ''}{u.email ?? ''}
                  </p>
                </div>
                <Check className="w-4 h-4 text-orange-400 opacity-0 hover:opacity-100 shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
