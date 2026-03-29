import React, { useState } from 'react';
import { MapPin, Plus, Trash2, ExternalLink, AlertCircle, Check, Pencil, X } from 'lucide-react';
import { useTenant, Location } from '../../contexts/TenantContext';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';

const RESERVED_SLUGS = ['entrar', 'dashboard', 'api', 'admin', 'login', 'cadastro', 'planos'];

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

export default function DashboardLocais() {
  const { tenant, locations, plan, canAddLocation, refresh } = useTenant();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

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
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        is_active: true,
      });
      if (err) {
        setError(err.message.includes('slug_unique') ? 'URL já em uso. Escolha outra.' : err.message);
        return;
      }
      setName(''); setSlug(''); setLat(''); setLng('');
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
    await supabase.from('locations').update({
      name: editName,
      description: editDesc || null,
      lat: editLat ? parseFloat(editLat) : null,
      lng: editLng ? parseFloat(editLng) : null,
    }).eq('id', loc.id);
    setEditingId(null);
    refresh();
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManual) setSlug(nameToSlug(val));
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Locais</h1>
          <p className="text-slate-400 text-sm mt-1">
            {locations.length} de {plan?.max_locations == null ? '∞' : plan.max_locations} locais
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

      {/* Form novo local */}
      {showForm && (
        <form onSubmit={handleAdd} className="p-5 rounded-2xl border border-slate-700 bg-slate-900 mb-6 space-y-4">
          <h3 className="font-bold text-white">Novo local</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome</label>
              <input value={name} onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Parque Ibirapuera"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">URL pública</label>
              <div className="flex items-center">
                <span className="px-3 py-2.5 bg-slate-700/60 border border-r-0 border-slate-700 rounded-l-xl text-slate-400 text-xs whitespace-nowrap">
                  basquetenext.app/
                </span>
                <input value={slug}
                  onChange={(e) => { setSlugManual(true); setSlug(nameToSlug(e.target.value)); }}
                  placeholder="parque-ibirapuera"
                  className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-r-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Latitude (opcional)</label>
                <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)}
                  placeholder="-23.5678"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Longitude (opcional)</label>
                <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)}
                  placeholder="-46.6543"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm" />
              </div>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(null); }}
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

      {/* Lista */}
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
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nome</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Descrição (opcional)</label>
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Ex: Quadra coberta, entrada pela rua X"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Latitude</label>
                      <input type="number" step="any" value={editLat} onChange={(e) => setEditLat(e.target.value)}
                        placeholder="-23.5678"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Longitude</label>
                      <input type="number" step="any" value={editLng} onChange={(e) => setEditLng(e.target.value)}
                        placeholder="-46.6543"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">Deixe em branco para desativar o geofencing.</p>
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
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{loc.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">basquetenext.app/{loc.slug}</p>
                    {loc.lat && loc.lng && (
                      <p className="text-xs text-slate-600 mt-0.5">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button onClick={() => navigate(`/${loc.slug}`)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditingId(loc.id); setEditName(loc.name); setEditDesc(loc.description ?? ''); setEditLat(loc.lat?.toString() ?? ''); setEditLng(loc.lng?.toString() ?? ''); }}
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
