import React, { useState } from 'react';
import { MapPin, Plus, Trash2, ExternalLink, AlertCircle, Check, Pencil, X, Image as ImageIcon } from 'lucide-react';
import { useTenant, Location } from '../../contexts/TenantContext';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import { BASKETBALL_FORMAT_OPTIONS } from '../../lib/basketballExplore';

const RESERVED_SLUGS = ['entrar', 'dashboard', 'api', 'admin', 'login', 'cadastro', 'planos', 'locais'];

const BR_UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{children}</p>;
}

export default function DashboardLocais() {
  const { tenant, locations, plan, canAddLocation, refresh } = useTenant();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusM, setRadiusM] = useState('50');
  const [desc, setDesc] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [country, setCountry] = useState('BR');
  const [formats, setFormats] = useState<string[]>([]);
  const [hostsTournaments, setHostsTournaments] = useState(false);
  const [hostsChampionships, setHostsChampionships] = useState(false);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [openingHoursNote, setOpeningHoursNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRadiusM, setEditRadiusM] = useState('50');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editCoverImageUrl, setEditCoverImageUrl] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAddressLine, setEditAddressLine] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editStateUf, setEditStateUf] = useState('');
  const [editCountry, setEditCountry] = useState('BR');
  const [editFormats, setEditFormats] = useState<string[]>([]);
  const [editHostsTournaments, setEditHostsTournaments] = useState(false);
  const [editHostsChampionships, setEditHostsChampionships] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editOpeningHoursNote, setEditOpeningHoursNote] = useState('');

  const toggleFormat = (id: string, current: string[], setFn: (v: string[]) => void) => {
    if (current.includes(id)) setFn(current.filter((x) => x !== id));
    else setFn([...current, id]);
  };

  const parseRadius = (raw: string, fallback: number) => {
    const n = parseInt(raw.trim(), 10);
    if (Number.isNaN(n) || n < 10) return fallback;
    return Math.min(n, 5000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    if (!slug.trim()) { setError('URL obrigatória.'); return; }
    if (RESERVED_SLUGS.includes(slug)) { setError(`"${slug}" é uma URL reservada.`); return; }
    if (!tenant) { setError('Sessão inválida. Recarregue a página.'); return; }

    setLoading(true);
    try {
      const { error: err } = await supabase.from('locations').insert({
        tenant_id: tenant.id,
        name: name.trim(),
        slug: slug.trim(),
        description: desc.trim() || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        radius_m: parseRadius(radiusM, 50),
        image_url: imageUrl.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        website: website.trim() || null,
        is_active: true,
        address_line: addressLine.trim() || null,
        city: city.trim() || null,
        state: stateUf || null,
        country: country.trim() || 'BR',
        basketball_formats: formats,
        hosts_tournaments: hostsTournaments,
        hosts_championships: hostsChampionships,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        opening_hours_note: openingHoursNote.trim() || null,
      });
      if (err) {
        setError(err.message.includes('slug_unique') ? 'URL já em uso. Escolha outra.' : err.message);
        return;
      }
      setName(''); setSlug(''); setLat(''); setLng(''); setRadiusM('50'); setDesc(''); setImageUrl(''); setCoverImageUrl(''); setWebsite('');
      setAddressLine(''); setCity(''); setStateUf(''); setCountry('BR');
      setFormats([]); setHostsTournaments(false); setHostsChampionships(false);
      setPhone(''); setWhatsapp(''); setOpeningHoursNote('');
      setSlugManual(false);
      setShowForm(false);
      refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('locations').delete().eq('id', id);
    setDeleteConfirm(null);
    refresh();
  };

  const handleEdit = async (loc: Location) => {
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Nome obrigatório.');
      return;
    }
    if (!editSlug.trim()) {
      setEditError('URL obrigatória.');
      return;
    }
    if (RESERVED_SLUGS.includes(editSlug.trim())) {
      setEditError(`"${editSlug.trim()}" é uma URL reservada.`);
      return;
    }

    const { error: err } = await supabase.from('locations').update({
      name: editName,
      slug: editSlug.trim(),
      description: editDesc || null,
      lat: editLat ? parseFloat(editLat) : null,
      lng: editLng ? parseFloat(editLng) : null,
      radius_m: parseRadius(editRadiusM, loc.radius_m ?? 50),
      image_url: editImageUrl.trim() || null,
      cover_image_url: editCoverImageUrl.trim() || null,
      website: editWebsite.trim() || null,
      address_line: editAddressLine.trim() || null,
      city: editCity.trim() || null,
      state: editStateUf || null,
      country: editCountry.trim() || 'BR',
      basketball_formats: editFormats,
      hosts_tournaments: editHostsTournaments,
      hosts_championships: editHostsChampionships,
      phone: editPhone.trim() || null,
      whatsapp: editWhatsapp.trim() || null,
      opening_hours_note: editOpeningHoursNote.trim() || null,
    }).eq('id', loc.id);
    if (err) {
      setEditError(err.message.includes('slug_unique') ? 'URL já em uso. Escolha outra.' : err.message);
      return;
    }
    setEditingId(null);
    setEditError(null);
    refresh();
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManual) setSlug(nameToSlug(val));
  };

  const startEdit = (loc: Location) => {
    setEditingId(loc.id);
    setEditError(null);
    setEditName(loc.name);
    setEditSlug(loc.slug);
    setEditDesc(loc.description ?? '');
    setEditLat(loc.lat?.toString() ?? '');
    setEditLng(loc.lng?.toString() ?? '');
    setEditRadiusM(String(loc.radius_m ?? 50));
    setEditImageUrl(loc.image_url ?? '');
    setEditCoverImageUrl(loc.cover_image_url ?? '');
    setEditWebsite(loc.website ?? '');
    setEditAddressLine(loc.address_line ?? '');
    setEditCity(loc.city ?? '');
    setEditStateUf(loc.state ?? '');
    setEditCountry(loc.country ?? 'BR');
    setEditFormats(loc.basketball_formats ?? []);
    setEditHostsTournaments(!!loc.hosts_tournaments);
    setEditHostsChampionships(!!loc.hosts_championships);
    setEditPhone(loc.phone ?? '');
    setEditWhatsapp(loc.whatsapp ?? '');
    setEditOpeningHoursNote(loc.opening_hours_note ?? '');
  };

  const resetCreateForm = () => {
    setShowForm(false);
    setError(null);
  };

  const sectionClass = 'rounded-xl border border-slate-700/80 p-4 space-y-4 bg-slate-800/25';

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Locais</h1>
          <p className="text-slate-400 text-sm mt-1">
            {locations.length} de {plan?.max_locations == null ? '∞' : plan.max_locations} locais
          </p>
          <p className="text-slate-500 text-xs mt-2 max-w-xl leading-relaxed">
            Preencha os blocos abaixo para a vitrine <strong className="text-slate-400">Quadras e locais</strong> e a página
            pública <strong className="text-slate-400">/locais/sua-url</strong> ficarem completas (imagens, endereço, basquete,
            contato e mapa).
          </p>
        </div>
        {canAddLocation && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all">
            <Plus className="w-4 h-4" /> Novo local
          </button>
        )}
        {!canAddLocation && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm">
            <AlertCircle className="w-4 h-4" /> Limite do plano atingido
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="p-5 rounded-2xl border border-slate-700 bg-slate-900 mb-8 space-y-6">
          <div>
            <h3 className="font-bold text-white text-lg">Novo local</h3>
            <p className="text-xs text-slate-500 mt-1">
              Use URLs de imagens públicas (HTTPS). Ideal: hospedar em seu site, Imgur, Cloudinary ou bucket do Supabase.
            </p>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">1 · Identificação</h4>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do local</label>
              <input value={name} onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Arena Centro"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              <Hint>Aparece no card da vitrine, no topo da página pública e no app do local.</Hint>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">URL pública (slug)</label>
              <div className="flex items-center">
                <span className="px-3 py-2.5 bg-slate-700/60 border border-r-0 border-slate-700 rounded-l-xl text-slate-400 text-xs whitespace-nowrap">
                  …/locais/ e app …/
                </span>
                <input value={slug}
                  onChange={(e) => { setSlugManual(true); setSlug(nameToSlug(e.target.value)); }}
                  placeholder="arena-centro"
                  className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-r-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
              <Hint>Vitrine: basquetenext.app/locais/<strong>{slug || 'sua-url'}</strong> · App do tenant: basquetenext.app/<strong>{slug || 'sua-url'}</strong></Hint>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição completa</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5}
                placeholder="Como chegar, estacionamento, tipo de quadra, público-alvo, diferenciais…"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm resize-y min-h-[120px]" />
              <Hint>Texto principal na seção “Sobre o local” na página pública de detalhe.</Hint>
            </div>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-orange-400" /> 2 · Imagens (vitrine e capa)
            </h4>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Imagem da lista / miniatura</label>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…jpg (quadrada ou 16:10)"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              <Hint>Usada nos <strong>cards</strong> da página “Quadras e locais”. Se não houver capa abaixo, também serve de fundo no detalhe.</Hint>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Imagem de capa (fundo grande no detalhe)</label>
              <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://…jpg (paisagem, larga — ex. 1600×900)"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              <Hint>
                <strong>Opcional.</strong> Hero no topo da página <code className="text-slate-400">/locais/seu-slug</code>.
                Recomendado: foto horizontal ampla. Se vazio, usa a miniatura acima.
              </Hint>
            </div>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">3 · Endereço (vitrine e mapas)</h4>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Logradouro e número</label>
              <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Rua Exemplo, 123 — Bairro"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Cidade</label>
                <input value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">UF</label>
                <select value={stateUf} onChange={(e) => setStateUf(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">—</option>
                  {BR_UF.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">País (ISO)</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)}
                placeholder="BR"
                className="w-full max-w-xs px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
            </div>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">4 · Basquete (filtros da vitrine)</h4>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Modalidades</label>
              <div className="flex flex-wrap gap-2">
                {BASKETBALL_FORMAT_OPTIONS.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 cursor-pointer hover:border-orange-500/40">
                    <input
                      type="checkbox"
                      checked={formats.includes(o.id)}
                      onChange={() => toggleFormat(o.id, formats, setFormats)}
                      className="rounded border-slate-600 text-orange-500 focus:ring-orange-500/50"
                    />
                    <span className="text-sm text-slate-200">{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hostsTournaments} onChange={(e) => setHostsTournaments(e.target.checked)} className="rounded border-slate-600 text-orange-500" />
                <span className="text-sm text-slate-300">Recebe / organiza torneios</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hostsChampionships} onChange={(e) => setHostsChampionships(e.target.checked)} className="rounded border-slate-600 text-orange-500" />
                <span className="text-sm text-slate-300">Recebe / organiza campeonatos</span>
              </label>
            </div>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">5 · Contato e horários</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
                <Hint>Botão ligar na página pública de detalhe.</Hint>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">WhatsApp</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="5511999999999 ou link wa.me"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Horários (texto livre)</label>
              <textarea value={openingHoursNote} onChange={(e) => setOpeningHoursNote(e.target.value)} rows={2}
                placeholder="Seg–Sex 7h–23h · Sáb 8h–18h"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm resize-y" />
              <Hint>Aparece no detalhe público e pode entrar junto do “Sobre”.</Hint>
            </div>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">6 · Links</h4>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Site ou redes</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://instagram.com/seulocal"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
            </div>
          </div>

          <div className={sectionClass}>
            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">7 · Coordenadas e raio (app + mapa)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Latitude</label>
                <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)}
                  placeholder="-23.5678"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Longitude</label>
                <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)}
                  placeholder="-46.6543"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Raio do local (metros)</label>
              <input type="number" min={10} max={5000} value={radiusM} onChange={(e) => setRadiusM(e.target.value)}
                className="w-full max-w-xs px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              <Hint>Usado no app do tenant para check-in / geofence (padrão 50 m). Entre 10 e 5000.</Hint>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={resetCreateForm}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all disabled:opacity-50">
              {loading ? 'Criando...' : 'Criar local'}
            </button>
          </div>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-700 text-center">
          <MapPin className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-sm">Nenhum local criado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
              {editingId === loc.id ? (
                <div className="space-y-4">
                  <p className="text-xs font-black text-orange-400 uppercase tracking-widest">Editar local</p>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase">Identificação</h4>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nome</label>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">URL pública (slug)</label>
                      <div className="flex items-center">
                        <span className="px-3 py-2 bg-slate-700/60 border border-r-0 border-slate-700 rounded-l-xl text-slate-400 text-xs whitespace-nowrap">
                          …/locais/ e app …/
                        </span>
                        <input
                          value={editSlug}
                          onChange={(e) => setEditSlug(nameToSlug(e.target.value))}
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-r-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      </div>
                      <Hint>Vitrine: basquetenext.app/locais/{editSlug || 'sua-url'} · App: basquetenext.app/{editSlug || 'sua-url'}</Hint>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label>
                      <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={5}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                    </div>
                  </div>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5" /> Imagens</h4>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Miniatura (lista)</label>
                      <input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Capa grande (detalhe público)</label>
                      <input value={editCoverImageUrl} onChange={(e) => setEditCoverImageUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                      <Hint>Hero em /locais/{loc.slug}. Vazio = usa miniatura.</Hint>
                    </div>
                  </div>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase">Endereço</h4>
                    <input value={editAddressLine} onChange={(e) => setEditAddressLine(e.target.value)} placeholder="Logradouro"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Cidade"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                      <select value={editStateUf} onChange={(e) => setEditStateUf(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm">
                        <option value="">UF</option>
                        {BR_UF.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                    <input value={editCountry} onChange={(e) => setEditCountry(e.target.value)} placeholder="País"
                      className="w-full max-w-[100px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                  </div>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase">Basquete</h4>
                    <div className="flex flex-wrap gap-2">
                      {BASKETBALL_FORMAT_OPTIONS.map((o) => (
                        <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={editFormats.includes(o.id)}
                            onChange={() => toggleFormat(o.id, editFormats, setEditFormats)}
                            className="rounded border-slate-600 text-orange-500"
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={editHostsTournaments} onChange={(e) => setEditHostsTournaments(e.target.checked)} className="rounded text-orange-500" />
                        Torneios
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={editHostsChampionships} onChange={(e) => setEditHostsChampionships(e.target.checked)} className="rounded text-orange-500" />
                        Campeonatos
                      </label>
                    </div>
                  </div>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase">Contato e horários</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Telefone"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                      <input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} placeholder="WhatsApp"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                    </div>
                    <textarea value={editOpeningHoursNote} onChange={(e) => setEditOpeningHoursNote(e.target.value)} rows={2} placeholder="Horários"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm resize-y" />
                  </div>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase">Site</h4>
                    <input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                  </div>

                  <div className={sectionClass}>
                    <h4 className="text-xs font-black text-slate-500 uppercase">Coordenadas e raio</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="any" value={editLat} onChange={(e) => setEditLat(e.target.value)} placeholder="Latitude"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                      <input type="number" step="any" value={editLng} onChange={(e) => setEditLng(e.target.value)} placeholder="Longitude"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                    </div>
                    <input type="number" min={10} max={5000} value={editRadiusM} onChange={(e) => setEditRadiusM(e.target.value)} placeholder="Raio (m)"
                      className="w-full max-w-xs px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(loc)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-all">
                      <Check className="w-3 h-3" /> Salvar
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold transition-all">
                      <X className="w-3 h-3" /> Cancelar
                    </button>
                  </div>
                  {editError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />{editError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{loc.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">basquetenext.app/{loc.slug}</p>
                    {(loc.city || loc.state) && (
                      <p className="text-xs text-slate-500 mt-0.5">{[loc.city, loc.state].filter(Boolean).join(', ')}</p>
                    )}
                    {loc.lat != null && loc.lng != null && (
                      <p className="text-xs text-slate-600 mt-0.5">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button onClick={() => navigate(`/${loc.slug}`)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(loc)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {deleteConfirm === loc.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(loc.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all">
                          Confirmar
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold transition-all">
                          Não
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(loc.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
