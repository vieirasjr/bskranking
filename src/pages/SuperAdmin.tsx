import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, BarChart3, Users, CreditCard, Calendar, LogOut,
  ToggleLeft, ToggleRight, Pencil, Trash2, Plus, X, Check,
  AlertCircle, Loader2, ArrowLeft, Search, ChevronDown,
  Trophy, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

type Tab = 'overview' | 'plans' | 'tenants' | 'events';

interface Stats {
  totalTenants: number;
  active: number;
  pastDue: number;
  cancelled: number;
  trial: number;
  totalUsers: number;
  recentPayments: Array<{ id: string; mp_status: string; processed_at: string }>;
}

interface Plan {
  id: string;
  name: string;
  price_brl: number;
  max_players: number | null;
  max_locations: number | null;
  max_events: number | null;
  is_active: boolean;
}

interface TenantRow {
  id: string;
  name: string;
  status: string;
  plan_id: string;
  owner_email: string;
  created_at: string;
  current_period_ends_at: string | null;
  plan?: { id: string; name: string; price_brl: number };
}

interface SystemEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  type: string;
  modality: string | null;
  max_participants: number | null;
  image_url: string | null;
  website: string | null;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', trial: 'Trial', past_due: 'Pendente', cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  trial: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  past_due: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { id: 'plans',    label: 'Planos',      icon: CreditCard },
  { id: 'tenants',  label: 'Usuários',    icon: Users },
  { id: 'events',   label: 'Eventos',     icon: Calendar },
];

const inputCls = 'w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm';

function adminFetch(path: string, token: string, options?: RequestInit) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
}

// ── Overview Tab ─────────────────────────────────────────────
function OverviewTab({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/admin/stats', token)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Loading />;
  if (!stats) return <ErrorMsg msg="Erro ao carregar estatísticas." />;

  const cards = [
    { label: 'Total Espaços', value: stats.totalTenants, color: 'text-white' },
    { label: 'Ativos', value: stats.active, color: 'text-green-400' },
    { label: 'Pendentes', value: stats.pastDue, color: 'text-yellow-400' },
    { label: 'Cancelados', value: stats.cancelled, color: 'text-red-400' },
    { label: 'Trial', value: stats.trial, color: 'text-blue-400' },
    { label: 'Total Usuários', value: stats.totalUsers, color: 'text-white' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
            <p className="text-xs text-slate-500 font-medium">{c.label}</p>
            <p className={`text-2xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-bold text-white mb-3">Últimos pagamentos</h3>
        {stats.recentPayments.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum pagamento registrado.</p>
        ) : (
          <div className="space-y-2">
            {stats.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900 text-sm">
                <span className="text-slate-400 font-mono text-xs">{p.id.slice(0, 8)}…</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  p.mp_status === 'approved' ? 'bg-green-500/15 text-green-400 border-green-500/20' :
                  p.mp_status === 'pending' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' :
                  'bg-red-500/15 text-red-400 border-red-500/20'
                }`}>{p.mp_status}</span>
                <span className="text-slate-500 text-xs">
                  {new Date(p.processed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plans Tab ────────────────────────────────────────────────
function PlansTab({ token }: { token: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price_brl: '', max_players: '', max_locations: '', max_events: '' });
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(() => {
    setLoading(true);
    adminFetch('/api/admin/plans', token)
      .then((r) => r.json())
      .then((d) => setPlans(d))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const togglePlan = async (plan: Plan) => {
    setToggling(plan.id);
    await adminFetch(`/api/admin/plans/${plan.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !plan.is_active }),
    });
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, is_active: !p.is_active } : p));
    setToggling(null);
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditForm({
      name: plan.name,
      price_brl: (plan.price_brl / 100).toFixed(2),
      max_players: plan.max_players?.toString() ?? '',
      max_locations: plan.max_locations?.toString() ?? '',
      max_events: plan.max_events?.toString() ?? '',
    });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: editForm.name.trim(),
      price_brl: Math.round(parseFloat(editForm.price_brl) * 100),
      max_players: editForm.max_players ? parseInt(editForm.max_players) : null,
      max_locations: editForm.max_locations ? parseInt(editForm.max_locations) : null,
      max_events: editForm.max_events ? parseInt(editForm.max_events) : null,
    };
    await adminFetch(`/api/admin/plans/${editingId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setEditingId(null);
    fetchPlans();
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <div key={plan.id} className={`p-4 rounded-2xl border transition-all ${
          plan.is_active ? 'border-slate-800 bg-slate-900' : 'border-red-500/20 bg-red-500/5 opacity-60'
        }`}>
          {editingId === plan.id ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-500 font-mono">{plan.id}</span>
                <span className="text-xs text-orange-400 font-bold">Editando</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Preço (R$)</label>
                  <input type="number" step="0.01" min="0" value={editForm.price_brl} onChange={(e) => setEditForm((f) => ({ ...f, price_brl: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Jogadores/sessão</label>
                  <input type="number" min="0" value={editForm.max_players} onChange={(e) => setEditForm((f) => ({ ...f, max_players: e.target.value }))} placeholder="∞" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Locais</label>
                  <input type="number" min="0" value={editForm.max_locations} onChange={(e) => setEditForm((f) => ({ ...f, max_locations: e.target.value }))} placeholder="∞" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Eventos</label>
                  <input type="number" min="0" value={editForm.max_events} onChange={(e) => setEditForm((f) => ({ ...f, max_events: e.target.value }))} placeholder="∞" className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={cancelEdit} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-all">
                  Cancelar
                </button>
                <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white">{plan.name}</p>
                  <span className="text-xs text-slate-500 font-mono">{plan.id}</span>
                  {!plan.is_active && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      Desativado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                  <span>R${(plan.price_brl / 100).toFixed(2)}</span>
                  <span>{plan.max_players ?? '∞'} jogadores/sessão</span>
                  <span>{plan.max_locations ?? '∞'} locais</span>
                  <span>{plan.max_events ?? '∞'} eventos</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => startEdit(plan)}
                  className="p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                  title="Editar plano"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => togglePlan(plan)}
                  disabled={toggling === plan.id}
                  className="p-2 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                  title={plan.is_active ? 'Desativar plano' : 'Ativar plano'}
                >
                  {toggling === plan.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  ) : plan.is_active ? (
                    <ToggleRight className="w-6 h-6 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-red-400" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tenants Tab ──────────────────────────────────────────────
function TenantsTab({ token }: { token: string }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    adminFetch('/api/admin/tenants', token)
      .then((r) => r.json())
      .then((d) => setTenants(d))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await adminFetch(`/api/admin/tenants/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    setUpdating(null);
  };

  const filtered = tenants.filter((t) => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.owner_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-8 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="past_due">Pendentes</option>
            <option value="cancelled">Cancelados</option>
            <option value="trial">Trial</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <p className="text-xs text-slate-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>

      <div className="space-y-2">
        {filtered.map((t) => (
          <div key={t.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white">{t.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status] ?? ''}`}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t.owner_email}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>Plano: {t.plan?.name ?? t.plan_id}</span>
                  <span>Criado: {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                  {t.current_period_ends_at && (
                    <span>Expira: {new Date(t.current_period_ends_at).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 relative">
                <select
                  value={t.status}
                  onChange={(e) => updateStatus(t.id, e.target.value)}
                  disabled={updating === t.id}
                  className="appearance-none px-3 py-1.5 pr-7 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
                >
                  <option value="active">Ativo</option>
                  <option value="trial">Trial</option>
                  <option value="past_due">Pendente</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Events Tab ───────────────────────────────────────────────
const EMPTY_EVENT = { title: '', description: '', event_date: '', event_time: '', type: 'comunicado', modality: '', max_participants: '', image_url: '', website: '', status: 'published' };

function EventsTab({ token }: { token: string }) {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    adminFetch('/api/admin/events', token)
      .then((r) => r.json())
      .then((d) => setEvents(d))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError('Título obrigatório.'); return; }
    if (!form.event_date) { setError('Data obrigatória.'); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
        event_time: form.event_time || null,
        type: form.type,
        modality: form.modality || null,
        max_participants: form.max_participants ? parseInt(form.max_participants) : null,
        image_url: form.image_url.trim() || null,
        website: form.website.trim() || null,
        status: form.status,
      };

      const url = editingId ? `/api/admin/events/${editingId}` : '/api/admin/events';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await adminFetch(url, token, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); return; }

      setForm(EMPTY_EVENT);
      setShowForm(false);
      setEditingId(null);
      fetchEvents();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await adminFetch(`/api/admin/events/${id}`, token, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchEvents();
  };

  const startEdit = (ev: SystemEvent) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      event_date: ev.event_date,
      event_time: ev.event_time ?? '',
      type: ev.type,
      modality: ev.modality ?? '',
      max_participants: ev.max_participants?.toString() ?? '',
      image_url: ev.image_url ?? '',
      website: ev.website ?? '',
      status: ev.status,
    });
    setShowForm(true);
    setError(null);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_EVENT);
    setError(null);
  };

  const EVENT_STATUS: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
    published: { label: 'Publicado', cls: 'bg-green-500/15 text-green-400 border-green-500/20' },
    cancelled: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      {!showForm && (
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_EVENT); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all">
          <Plus className="w-4 h-4" /> Novo evento
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-slate-700 bg-slate-900 space-y-4">
          <h3 className="font-bold text-white">{editingId ? 'Editar evento' : 'Novo evento global'}</h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Título</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Copa Braska" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição</label>
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
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                <option value="comunicado">Comunicado</option>
                <option value="torneio">Torneio</option>
                <option value="campeonato">Campeonato</option>
                <option value="festival">Festival</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Modalidade</label>
              <select value={form.modality} onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                <option value="5x5">5x5</option>
                <option value="3x3">3x3</option>
                <option value="1x1">1x1</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Máx. participantes</label>
              <input type="number" value={form.max_participants} onChange={(e) => setForm((f) => ({ ...f, max_participants: e.target.value }))} placeholder="—" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Imagem (URL)</label>
            <input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Site / link</label>
            <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
              <option value="published">Publicado</option>
              <option value="draft">Rascunho</option>
              <option value="cancelled">Cancelado</option>
            </select>
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
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all disabled:opacity-50">
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Publicar evento'}
            </button>
          </div>
        </form>
      )}

      {events.length === 0 && !showForm ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-700 text-center">
          <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-sm">Nenhum evento global</p>
          <p className="text-slate-500 text-xs mt-1">Crie eventos que aparecem para todos os usuários.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const st = EVENT_STATUS[ev.status] ?? EVENT_STATUS.draft;
            return (
              <div key={ev.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{ev.type}{ev.modality ? ` · ${ev.modality}` : ''}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="font-semibold text-white">{ev.title}</p>
                    {ev.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ev.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {ev.event_time && <span>{ev.event_time.slice(0, 5)}</span>}
                      {ev.max_participants && <span>{ev.max_participants} vagas</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startEdit(ev)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {deleteConfirm === ev.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(ev.id)} className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold">Confirmar</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold">Não</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(ev.id)} className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function Loading() {
  return (
    <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      <span className="text-sm">Carregando...</span>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
      <AlertCircle className="w-4 h-4 shrink-0" />{msg}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function SuperAdmin() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('basquete_users')
      .select('issuperusuario')
      .eq('auth_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(data?.issuperusuario === true));
  }, [session?.user?.id]);

  if (isAdmin === null) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Acesso restrito</h1>
        <p className="text-slate-400 text-sm mb-6">Você não tem permissão para acessar o painel de administração.</p>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">
          Voltar ao dashboard
        </button>
      </div>
    </div>
  );

  const token = session?.access_token ?? '';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-56 shrink-0 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center shadow-md shadow-red-500/30 shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Super Admin</p>
            <p className="text-[10px] text-slate-500">Braska</p>
          </div>
        </div>

        <nav className="flex lg:flex-col overflow-x-auto lg:overflow-visible px-2 py-3 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                tab === id ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden lg:block px-2 pb-4 mt-auto border-t border-slate-800 pt-3">
          <button onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4 shrink-0" /> Dashboard
          </button>
          <button onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut className="w-4 h-4 shrink-0" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6 sm:p-8 max-w-4xl">
        <h1 className="text-2xl font-black text-white mb-1">
          {TABS.find((t) => t.id === tab)?.label}
        </h1>
        <p className="text-slate-400 text-sm mb-6">Painel de administração do sistema</p>

        {tab === 'overview' && <OverviewTab token={token} />}
        {tab === 'plans' && <PlansTab token={token} />}
        {tab === 'tenants' && <TenantsTab token={token} />}
        {tab === 'events' && <EventsTab token={token} />}
      </main>
    </div>
  );
}
