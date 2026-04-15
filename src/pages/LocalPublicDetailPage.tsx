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
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  googleMapsUrl,
  googleMapsSearchQuery,
  whatsappHref,
  type PublicLocationRow,
} from '../lib/publicLocations';
import { getThemeDarkStored } from '../lib/appStorage';
import { formatLabelsList } from '../lib/basketballExplore';

type LocRow = PublicLocationRow & { cover_image_url?: string | null };

export default function LocalPublicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loc, setLoc] = useState<LocRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
  const wa = whatsappHref(loc.whatsapp);
  const tel = loc.phone?.trim() ? `tel:${loc.phone.replace(/\D/g, '')}` : null;

  const heroImage = (loc.cover_image_url || loc.image_url) as string | null;
  const galleryImages = [loc.image_url, loc.cover_image_url, loc.image_url]
    .filter((u): u is string => !!u)
    .slice(0, 4);
  const features = [
    extras.formats.length ? `Modalidades: ${extras.formats.join(', ')}` : null,
    loc.hosts_tournaments ? 'Suporta torneios' : null,
    loc.hosts_championships ? 'Suporta campeonatos' : null,
    loc.opening_hours_note ? `Horários: ${loc.opening_hours_note}` : null,
    hasCoords ? 'Localização por coordenadas disponível' : null,
    `Raio de acesso: ${loc.radius_m ?? 50}m`,
  ].filter(Boolean) as string[];

  return (
    <div className={darkMode ? 'min-h-screen bg-[#07090f] text-white pb-36' : 'min-h-screen bg-slate-100 text-slate-900 pb-36'}>
      <div className="w-full max-w-xl mx-auto min-h-screen">
        <div className="relative h-60 w-full overflow-hidden rounded-b-3xl">
          {heroImage ? (
            <img src={heroImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#ff8a4c]/35 to-slate-950 flex items-center justify-center">
              <Trophy className="w-20 h-20 text-[#ff8a4c]/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/locais')}
              className="w-9 h-9 rounded-full bg-black/45 border border-white/10 text-white flex items-center justify-center"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFav}
                className="w-9 h-9 rounded-full bg-black/45 border border-white/10 text-white flex items-center justify-center"
                aria-label="Favoritar"
              >
                <Heart className={`w-4 h-4 ${fav ? 'fill-[#ff8a4c] text-[#ff8a4c]' : ''}`} />
              </button>
              <button
                type="button"
                onClick={share}
                className="w-9 h-9 rounded-full bg-black/45 border border-white/10 text-white flex items-center justify-center"
                aria-label="Compartilhar"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={darkMode ? 'mx-3 mt-3 rounded-3xl bg-[#10131a] border border-slate-800 p-4 shadow-xl' : 'mx-3 mt-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-xl'}
        >
          <h1 className={darkMode ? 'text-2xl font-black text-white leading-tight' : 'text-2xl font-black text-slate-900 leading-tight'}>{loc.name}</h1>
          <p className={darkMode ? 'mt-1 text-sm text-slate-400 flex items-start gap-1.5' : 'mt-1 text-sm text-slate-500 flex items-start gap-1.5'}>
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{addressText ?? locationLine}</span>
          </p>
          <p className={darkMode ? 'mt-2 text-sm font-bold text-orange-300' : 'mt-2 text-sm font-bold text-orange-600'}>
            {playerCount != null
              ? `${playerCount.toLocaleString('pt-BR')} jogador${playerCount === 1 ? '' : 'es'} na lista`
              : 'Carregando jogadores...'}
          </p>

          {galleryImages.length > 0 && (
            <div className="relative mt-4">
              <div className={`pointer-events-none absolute inset-y-0 left-0 w-6 z-10 ${darkMode ? 'bg-gradient-to-r from-[#10131a] to-transparent' : 'bg-gradient-to-r from-white to-transparent'}`} />
              <div className={`pointer-events-none absolute inset-y-0 right-0 w-10 z-10 ${darkMode ? 'bg-gradient-to-l from-[#10131a] to-transparent' : 'bg-gradient-to-l from-white to-transparent'}`} />
              <div className="flex gap-2 overflow-x-auto no-scrollbar pr-8 snap-x snap-mandatory">
              {galleryImages.map((img, i) => (
                <img key={`${img}-${i}`} src={img} alt="" className="w-24 h-20 rounded-xl object-cover shrink-0 border border-black/10 snap-start" />
              ))}
              </div>
            </div>
          )}

          <div className={darkMode ? 'mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-3' : 'mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-3'}>
            <h2 className={darkMode ? 'text-sm font-black text-white' : 'text-sm font-black text-slate-900'}>Sobre o local</h2>
            <div className="mt-2 space-y-1.5">
              {features.map((f, i) => (
                <p key={i} className={darkMode ? 'text-xs text-slate-300' : 'text-xs text-slate-600'}>{f}</p>
              ))}
              <p className={darkMode ? 'text-xs text-slate-400 whitespace-pre-wrap' : 'text-xs text-slate-500 whitespace-pre-wrap'}>
                {aboutText}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {(tel || wa) && (
              <>
                {tel && (
                  <a href={tel} className={darkMode ? 'w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center' : 'w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center'}>
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className={darkMode ? 'w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center' : 'w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center'}>
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
              </>
            )}
            {(hasCoords || addressText) && (
              <button
                type="button"
                onClick={openMaps}
                className={darkMode ? 'ml-auto text-xs font-bold text-orange-300 inline-flex items-center gap-1.5' : 'ml-auto text-xs font-bold text-orange-600 inline-flex items-center gap-1.5'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver no mapa
              </button>
            )}
          </div>
        </motion.div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t z-20 ${darkMode ? 'from-[#07090f] via-[#07090f] to-transparent' : 'from-slate-100 via-slate-100 to-transparent'}`}>
        <div className="w-full max-w-xl mx-auto">
         
        </div>
      </div>
    </div>
  );
}
