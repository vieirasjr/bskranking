import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Shield, LayoutDashboard, User, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

type Persona = 'gestor' | 'admin' | 'jogador';

interface Option {
  id: Persona;
  label: string;
  sub: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  current: Persona;
  variant?: 'sidebar' | 'floating';
}

interface Profile {
  isSuperAdmin: boolean;
  tenantName: string | null;
  firstLocationSlug: string | null;
}

/**
 * Troca a view do usuário logado entre Painel (gestor), Super Admin
 * e Visão de jogador — sem deslogar. O mesmo auth_id continua ativo;
 * o botão só muda a rota.
 *
 * Busca perfil próprio em supabase para funcionar em qualquer rota
 * (dentro ou fora de TenantProvider).
 */
export default function PersonaSwitcher({ current, variant = 'sidebar' }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({
    isSuperAdmin: false,
    tenantName: null,
    firstLocationSlug: null,
  });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setProfile({ isSuperAdmin: false, tenantName: null, firstLocationSlug: null });
      return;
    }
    (async () => {
      const [{ data: bu }, { data: tn }] = await Promise.all([
        supabase.from('basquete_users').select('issuperusuario').eq('auth_id', user.id).maybeSingle(),
        supabase.from('tenants').select('id, name').eq('owner_auth_id', user.id).maybeSingle(),
      ]);
      let firstLocationSlug: string | null = null;
      if (tn?.id) {
        const { data: loc } = await supabase
          .from('locations')
          .select('slug')
          .eq('tenant_id', tn.id)
          .eq('is_active', true)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        firstLocationSlug = loc?.slug ?? null;
      }
      if (!cancelled) {
        setProfile({
          isSuperAdmin: bu?.issuperusuario === true,
          tenantName: tn?.name ?? null,
          firstLocationSlug,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const options: Option[] = [];
  if (profile.tenantName) {
    options.push({
      id: 'gestor',
      label: 'Painel de gestão',
      sub: profile.tenantName,
      to: '/dashboard',
      icon: LayoutDashboard,
    });
  }
  if (profile.isSuperAdmin) {
    options.push({
      id: 'admin',
      label: 'Super Admin',
      sub: 'Painel global',
      to: '/admin',
      icon: Shield,
    });
  }
  if (profile.firstLocationSlug) {
    options.push({
      id: 'jogador',
      label: 'Visão de jogador',
      sub: `/${profile.firstLocationSlug}`,
      to: `/${profile.firstLocationSlug}`,
      icon: User,
    });
  }

  if (options.length < 2) return null;

  const currentOpt = options.find((o) => o.id === current) ?? options[0];
  const CurIcon = currentOpt.icon;

  const triggerCls =
    variant === 'floating'
      ? 'flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-700 text-white text-xs font-semibold shadow-lg hover:bg-slate-800 transition-colors'
      : 'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors';

  const menuCls =
    variant === 'floating'
      ? 'absolute right-0 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-50 overflow-hidden'
      : 'absolute left-0 right-0 bottom-full mb-2 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-50 overflow-hidden';

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerCls}>
        <CurIcon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left truncate">{currentOpt.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={menuCls}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 pt-2.5 pb-1.5">
            Trocar view
          </p>
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = opt.id === current;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={active}
                onClick={() => { setOpen(false); navigate(opt.to); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-orange-500/10 text-orange-300 cursor-default'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{opt.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{opt.sub}</p>
                </div>
                {active && <Check className="w-4 h-4 shrink-0 text-orange-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
