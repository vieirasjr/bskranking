import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Trash2, Pencil, X, Check, AlertCircle, Users } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { supabase } from '../../supabase';

interface Evento {
  id: string;
  location_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  type: 'torneio' | 'campeonato' | 'festival';
  modality: '5x5' | '3x3' | '1x1';
  max_participants: number | null;
  status: 'draft' | 'open' | 'in_progress' | 'finished' | 'cancelled';
  image_url: string | null;
  website: string | null;
  location_name?: string;
}

const TYPE_LABELS: Record<string, string> = { torneio: 'Torneio', campeonato: 'Campeonato', festival: 'Festival' };
const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', open: 'Inscrições abertas', in_progress: 'Em andamento', finished: 'Encerrado', cancelled: 'Cancelado' };
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-500/15 text-green-400 border-green-500/20',
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  finished: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const EMPTY_FORM: { title: string; description: string; event_date: string; event_time: string; type: Evento['type']; modality: Evento['modality']; max_participants: string; location_id: string; image_url: string; website: string } = { title: '', description: '', event_date: '', event_time: '', type: 'torneio', modality: '5x5', max_participants: '', location_id: '', image_url: '', website: '' };

export default function DashboardEventos() {
  const { tenant, locations } = useTenant();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEventos = useCallback(async () => {
    if (!tenant) return;
    const locationIds = locations.map((l) => l.id);
    if (locationIds.length === 0) { setEventos([]); return; }
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .in('location_id', locationIds)
      .order('event_date', { ascending: true });
    setEventos((data ?? []).map((e: any) => ({
      ...e,
      location_name: locations.find((l) => l.id === e.location_id)?.name ?? '',
    })));
  }, [tenant, locations]);

  useEffect(() => { fetchEventos(); }, [fetchEventos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError('Título obrigatório.'); return; }
    if (!form.event_date) { setError('Data obrigatória.'); return; }
    if (!form.location_id) { setError('Selecione um local.'); return; }

    setLoading(true);
    try {
      const payload = {
        location_id: form.location_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
        event_time: form.event_time || null,
        type: form.type,
        modality: form.modality,
        max_participants: form.max_participants ? parseInt(form.max_participants) : null,
        image_url: form.image_url.trim() || null,
        website: form.website.trim() || null,
        status: 'open' as const,
      };

      if (editingId) {
        const { error: err } = await supabase.from('eventos').update(payload).eq('id', editingId);
        if (err) { setError(err.message); return; }
      } else {
        const { error: err } = await supabase.from('eventos').insert(payload);
        if (err) { setError(err.message); return; }
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
      await fetchEventos();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('eventos').delete().eq('id', id);
    setDeleteConfirm(null);
    await fetchEventos();
  };

  const startEdit = (ev: Evento) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      event_date: ev.event_date,
      event_time: ev.event_time ?? '',
      type: ev.type,
      modality: ev.modality,
      max_participants: ev.max_participants?.toString() ?? '',
      location_id: ev.location_id,
      image_url: ev.image_url ?? '',
      website: ev.website ?? '',
    });
    setShowForm(true);
    setError(null);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const inputCls = 'w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm';

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Meus Eventos</h1>
          <p className="text-slate-400 text-sm mt-1">{eventos.length} evento{eventos.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM, location_id: locations[0]?.id ?? '' }); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all">
            <Plus className="w-4 h-4" /> Novo evento
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-slate-700 bg-slate-900 mb-6 space-y-4">
          <h3 className="font-bold text-white">{editingId ? 'Editar evento' : 'Novo evento'}</h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Local</label>
            <select value={form.location_id} onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))} className={inputCls}>
              <option value="">Selecione...</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Título</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Torneio de Verão 3x3" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição (opcional)</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Detalhes do evento" className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Data</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Horário</label>
              <input type="time" value={form.event_time} onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))} className={inputCls}>
                <option value="torneio">Torneio</option>
                <option value="campeonato">Campeonato</option>
                <option value="festival">Festival</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Modalidade</label>
              <select value={form.modality} onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value as any }))} className={inputCls}>
                <option value="5x5">5x5</option>
                <option value="3x3">3x3</option>
                <option value="1x1">1x1</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Máx. jogadores</label>
              <input type="number" value={form.max_participants} onChange={(e) => setForm((f) => ({ ...f, max_participants: e.target.value }))} placeholder="Sem limite" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Imagem / Logo (URL)</label>
            <input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://exemplo.com/banner.png" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Site ou rede social (opcional)</label>
            <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://instagram.com/torneio" className={inputCls} />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={cancelForm}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all disabled:opacity-50">
              {loading ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar evento'}
            </button>
          </div>
        </form>
      )}

      {eventos.length === 0 && !showForm ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-700 text-center">
          <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-sm">Nenhum evento criado</p>
          <p className="text-slate-500 text-xs mt-1">Crie torneios, campeonatos ou festivais para seus locais.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map((ev) => (
            <div key={ev.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
                      {TYPE_LABELS[ev.type]} · {ev.modality}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[ev.status] ?? ''}`}>
                      {STATUS_LABELS[ev.status]}
                    </span>
                  </div>
                  <p className="font-semibold text-white truncate">{ev.title}</p>
                  {ev.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ev.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>{new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {ev.event_time && <span>{ev.event_time.slice(0, 5)}</span>}
                    <span className="text-slate-600">·</span>
                    <span>{ev.location_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => startEdit(ev)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {deleteConfirm === ev.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(ev.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all">
                        Confirmar
                      </button>
                      <button onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold transition-all">
                        Não
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(ev.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
