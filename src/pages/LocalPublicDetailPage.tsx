import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Trophy,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  googleMapsUrl,
  googleMapsSearchQuery,
  whatsappHref,
  type PublicLocationRow,
} from '../lib/publicLocations';
import { getThemeDarkStored } from '../lib/appStorage';
import { formatLabelsList, avatarTintIndicesForId, avatarTintClass } from '../lib/basketballExplore';

type LocRow = PublicLocationRow & { cover_image_url?: string | null };

export default function LocalPublicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loc, setLoc] = useState<LocRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [fav, setFav] = useState(false);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [darkMode] = useState<boolean>(() => {
    const saved = getThemeDarkStored();
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return true;
  });

  useEffect(() => {
    if (!slug) {
      navigate('/locais', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select(
          `
          id,
          name,
          slug,
          description,
          image_url,
          cover_image_url,
          lat,
          lng,
          website,
          radius_m,
          address_line,
          city,
          state,
          country,
          basketball_formats,
          hosts_tournaments,
          hosts_championships,
          phone,
          whatsapp,
          opening_hours_note,
          tenant:tenants ( status, name )
        `
        )
        .eq('slug', slug)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoc(null);
      } else {
        const raw = data as LocRow & { tenant?: LocRow['tenant'] | LocRow['tenant'][] };
        const t = raw.tenant;
        const tenantNorm = Array.isArray(t) ? t[0] ?? null : t ?? null;
        const row = { ...raw, tenant: tenantNorm } as LocRow;
        if (row.tenant?.status === 'cancelled') {
          setNotFound(true);
          setLoc(null);
        } else {
          setLoc({
            ...row,
            basketball_formats: row.basketball_formats ?? [],
            hosts_tournaments: !!row.hosts_tournaments,
            hosts_championships: !!row.hosts_championships,
          });
          setNotFound(false);
          try {
            const raw = localStorage.getItem('explorar-locais-favoritos');
            const arr = raw ? (JSON.parse(raw) as string[]) : [];
            setFav(Array.isArray(arr) && arr.includes(row.id));
          } catch {
            setFav(false);
          }
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  useEffect(() => {
    if (!loc?.id) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', loc.id);
      if (!cancelled) setPlayerCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [loc?.id]);

  const extras = useMemo(() => {
    if (!loc) return null;
    const formats = formatLabelsList(loc.basketball_formats);
    return { formats };
  }, [loc]);

  const toggleFav = () => {
    if (!loc) return;
    try {
      const raw = localStorage.getItem('explorar-locais-favoritos');
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      const set = new Set(Array.isArray(arr) ? arr : []);
      if (set.has(loc.id)) set.delete(loc.id);
      else set.add(loc.id);
      localStorage.setItem('explorar-locais-favoritos', JSON.stringify([...set]));
      setFav(set.has(loc.id));
    } catch {
      /* noop */
    }
  };

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: loc?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* noop */
    }
  };

  const openMaps = () => {
    if (!loc) return;
    if (loc.lat != null && loc.lng != null) {
      const ok = window.confirm('Abrir o Google Maps com a localização deste local?');
      if (!ok) return;
      window.open(googleMapsUrl(loc.lat, loc.lng), '_blank', 'noopener,noreferrer');
      return;
    }
    const q = [loc.address_line, loc.city, loc.state, loc.country].filter(Boolean).join(', ');
    if (q.length > 0) {
      const ok = window.confirm('Abrir o Google Maps pesquisando o endereço cadastrado?');
      if (!ok) return;
      window.open(googleMapsSearchQuery(q), '_blank', 'noopener,noreferrer');
    }
  };

  const goToTenantLogin = () => {
    if (!loc) return;
    navigate(`/${loc.slug}`);
  };

  if (loading) {
    return (
      <div className={darkMode ? 'min-h-screen flex items-center justify-center bg-[#07090f]' : 'min-h-screen flex items-center justify-center bg-slate-50'}>
        <div className="w-10 h-10 border-2 border-[#ff8a4c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !loc || !extras) {
    return (
      <div className={darkMode ? 'min-h-screen flex flex-col items-center justify-center bg-[#07090f] text-white p-6 text-center' : 'min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6 text-center'}>
        <MapPin className="w-12 h-12 text-slate-600 mb-4" />
        <h1 className="text-2xl font-black mb-2">Local não encontrado</h1>
        <p className="text-slate-400 mb-6">Este local não existe ou não está disponível.</p>
        <button
          type="button"
          onClick={() => navigate('/locais')}
          className="px-6 py-3 rounded-xl bg-[#ff8a4c] hover:bg-[#ff7a38] font-bold transition-all"
        >
          Voltar aos locais
        </button>
      </div>
    );
  }

  const hasCoords = loc.lat != null && loc.lng != null;
  const addressText = [loc.address_line, loc.city, loc.state].filter(Boolean).join(', ') || null;
  const locationLine = hasCoords
    ? `${loc.lat!.toFixed(5)}, ${loc.lng!.toFixed(5)}`
    : addressText ?? 'Complete o endereço no painel do gestor para mapa e rotas.';

  const aboutParts = [loc.description, loc.opening_hours_note].filter(Boolean).join('\n\n');
  const aboutText = aboutParts || 'Sem descrição cadastrada.';
  const aboutShort = aboutText.length > 280 ? `${aboutText.slice(0, 280)}…` : aboutText;
  const showReadMore = aboutText.length > 280;

  const wa = whatsappHref(loc.whatsapp);
  const tel = loc.phone?.trim() ? `tel:${loc.phone.replace(/\D/g, '')}` : null;

  const tintIdx = avatarTintIndicesForId(loc.id);
  const initials = (loc.tenant?.name ?? loc.name).trim().split(/\s+/).filter(Boolean);
  const letters = [
    (initials[0]?.[0] ?? '?').toUpperCase(),
    (initials[1]?.[0] ?? '·').toUpperCase(),
    (initials[2]?.[0] ?? '·').toUpperCase(),
  ];

  return (
    <div className={darkMode ? 'min-h-screen bg-[#07090f] text-white pb-32' : 'min-h-screen bg-slate-50 text-slate-900 pb-32'}>
      <div className="relative h-[min(52vh,520px)] w-full overflow-hidden">
        {(loc.cover_image_url || loc.image_url) ? (
          <img
            src={(loc.cover_image_url || loc.image_url) as string}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#ff8a4c]/35 to-slate-950 flex items-center justify-center">
            <Trophy className="w-24 h-24 text-[#ff8a4c]/30" />
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t ${darkMode ? 'from-[#07090f] via-[#07090f]/35 to-black/30' : 'from-slate-50 via-slate-50/35 to-black/20'}`} />

        <div className="absolute top-0 left-0 right-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate('/locais')}
            className="p-2.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 hover:bg-black/55 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={share}
              className="p-2.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 hover:bg-black/55 transition-colors"
              aria-label="Compartilhar"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={toggleFav}
              className="p-2.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 hover:bg-black/55 transition-colors"
              aria-label="Favoritar"
            >
              <Heart className={`w-5 h-5 ${fav ? 'fill-[#ff8a4c] text-[#ff8a4c]' : 'text-white'}`} />
            </button>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto px-4 -mt-14 relative z-10"
      >
        <div className={`rounded-t-[28px] rounded-b-3xl border backdrop-blur-xl shadow-2xl overflow-hidden ${darkMode ? 'border-slate-700/80 bg-slate-900/95' : 'border-slate-200 bg-white/95'}`}>
          <div className={`h-1.5 w-12 rounded-full mx-auto mt-3 mb-1 opacity-60 ${darkMode ? 'bg-slate-700' : 'bg-slate-300'}`} aria-hidden />

          <div className="px-5 pt-4 pb-5">
            {extras.formats.length > 0 && (
              <p className="text-[#ff8a4c] text-xs font-black uppercase tracking-widest mb-1">{extras.formats.join(' · ')}</p>
            )}
            {(loc.hosts_tournaments || loc.hosts_championships) && (
              <p className="text-amber-400/95 text-[11px] font-bold mb-1">
                {loc.hosts_tournaments && loc.hosts_championships
                  ? 'Torneios e campeonatos'
                  : loc.hosts_tournaments
                    ? 'Torneios'
                    : 'Campeonatos'}
              </p>
            )}
            <h1 className={`text-2xl sm:text-3xl font-black leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{loc.name}</h1>

            <div className={`mt-4 space-y-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#ff8a4c] shrink-0 mt-0.5" />
                <span className="leading-snug">{locationLine}</span>
              </div>
              {addressText && (
                <p className={`text-xs pl-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{addressText}</p>
              )}
              {loc.opening_hours_note && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#ff8a4c] shrink-0 mt-0.5" />
                  <span className="leading-snug">{loc.opening_hours_note}</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex -space-x-2">
                {tintIdx.map((ti, i) => (
                  <div
                    key={i}
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-bold text-white ${darkMode ? 'border-slate-900' : 'border-white'} ${avatarTintClass(ti)}`}
                  >
                    {letters[i]}
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {playerCount != null ? (
                    <>
                      {playerCount.toLocaleString('pt-BR')} jogador{playerCount === 1 ? '' : 'es'} na lista
                    </>
                  ) : (
                    'Carregando lista…'
                  )}
                </p>
                <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Contagem em tempo real neste local</p>
              </div>
              <button
                type="button"
                onClick={goToTenantLogin}
                className="text-xs font-bold text-[#ff8a4c] shrink-0 hover:underline"
              >
                Ver lista
              </button>
            </div>
          </div>

          <div className={`border-t px-5 py-5 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <h2 className={`text-sm font-black mb-2 flex items-center justify-between ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Sobre o local
              {showReadMore && (
                <button
                  type="button"
                  onClick={() => setAboutOpen((v) => !v)}
                  className="text-[#ff8a4c] text-xs font-bold flex items-center gap-0.5"
                >
                  {aboutOpen ? (
                    <>
                      Ler menos <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Ler mais <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </h2>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {aboutOpen || !showReadMore ? aboutText : aboutShort}
            </p>
          </div>

          <div className={`border-t px-5 py-5 ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'}`}>
            <h2 className={`text-sm font-black mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Organização</h2>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#ff8a4c]/20 flex items-center justify-center text-[#ff8a4c] font-black text-lg shrink-0">
                {(loc.tenant?.name ?? loc.name).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{loc.tenant?.name ?? loc.name}</p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Organização (tenant)</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {tel && (
                  <a
                    href={tel}
                    className="w-11 h-11 rounded-full bg-[#ff8a4c] flex items-center justify-center shadow-lg shadow-[#ff8a4c]/20 hover:bg-[#ff7a38] transition-colors"
                    aria-label="Ligar"
                  >
                    <Phone className="w-5 h-5 text-white" />
                  </a>
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full bg-[#ff8a4c] flex items-center justify-center shadow-lg shadow-[#ff8a4c]/20 hover:bg-[#ff7a38] transition-colors"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5 text-white" />
                  </a>
                )}
              </div>
            </div>
            {!tel && !wa && (
              <p className={`text-[11px] mt-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Telefone e WhatsApp podem ser cadastrados no painel do gestor.</p>
            )}
          </div>

          <div className={`border-t px-5 py-5 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Endereço</h2>
              {(hasCoords || addressText) && (
                <button type="button" onClick={openMaps} className="text-xs font-bold text-[#ff8a4c] hover:underline">
                  Ver no mapa
                </button>
              )}
            </div>
            <p className={`text-sm flex items-start gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <MapPin className="w-4 h-4 text-[#ff8a4c] shrink-0 mt-0.5" />
              <span>{addressText ?? locationLine}</span>
            </p>
            {(hasCoords || addressText) && (
              <button
                type="button"
                onClick={openMaps}
                className={`mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-colors ${darkMode ? 'border-slate-600 bg-slate-800/50 hover:bg-slate-800 text-white' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
              >
                <ExternalLink className="w-4 h-4" />
                {hasCoords ? 'Abrir no Google Maps (coordenadas)' : 'Abrir no Google Maps (endereço)'}
              </button>
            )}
            {loc.website && (
              <a
                href={loc.website.startsWith('http') ? loc.website : `https://${loc.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-sm text-[#ff8a4c] font-semibold hover:underline"
              >
                Site do local
              </a>
            )}
          </div>
        </div>
      </motion.div>

      <div className={`fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t z-20 pointer-events-none ${darkMode ? 'from-[#07090f] via-[#07090f] to-transparent' : 'from-slate-50 via-slate-50 to-transparent'}`}>
        <div className="max-w-lg mx-auto pointer-events-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] uppercase tracking-wider font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Lista do local</p>
            <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>Entrar na fila Braska</p>
          </div>
          <button
            type="button"
            onClick={goToTenantLogin}
            className="shrink-0 px-6 py-3.5 rounded-2xl font-black text-sm bg-[#ff8a4c] hover:bg-[#ff7a38] text-white shadow-xl shadow-[#ff8a4c]/25 flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            <Users className="w-5 h-5" />
            Entrar na lista
          </button>
        </div>
      </div>
    </div>
  );
}
