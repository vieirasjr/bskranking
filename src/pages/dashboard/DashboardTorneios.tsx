import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swords, Plus, Trash2, Pencil, AlertCircle, Copy, Check,
  ExternalLink, RefreshCw, Globe, Building2, Lock, Eye, EyeOff,
  ChevronLeft, ChevronRight, Upload, X, Users, Clock, Timer,
  Trophy, MapPin, FileText, ImageIcon, Info, Sparkles,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase';
import TournamentAdminModal from '../../components/TournamentAdminModal';
import {
  DEFAULT_TOURNAMENT_RULES,
  MODALITY_DEFAULTS,
  slugifyTournamentName,
  type TournamentModality,
} from '../../lib/tournamentDefaults';
import {
  recommendFormat,
  estimateMatchCount,
  FORMAT_LABEL,
  FORMAT_DESCRIPTION,
  type TournamentFormat,
} from '../../lib/bracket';

type Visibility = 'global' | 'tenant' | 'private';
type Gender = 'MALE' | 'FEMALE' | 'MIXED' | 'OPEN';
type Status = 'draft' | 'open' | 'closed' | 'in_progress' | 'finished' | 'cancelled';

interface Tournament {
  id: string;
  tenant_id: string | null;
  location_id: string | null;
  visibility: Visibility;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  start_date: string;
  end_date: string | null;
  responsible_name: string | null;
  responsible_contact: string | null;
  modality: TournamentModality;
  gender: Gender;
  max_teams: number | null;
  players_per_team: number | null;
  players_on_court: number | null;
  match_duration_minutes: number | null;
  periods_count: number | null;
  period_duration_minutes: number | null;
  is_paid: boolean;
  price_brl: number | null;
  rules_md: string | null;
  rules_document_url: string | null;
  format: TournamentFormat;
  status: Status;
  created_at: string;
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  global: 'Global',
  tenant: 'Do meu espaço',
  private: 'Privado (só com link)',
};
const VISIBILITY_ICON = { global: Globe, tenant: Building2, private: Lock };

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Rascunho',
  open: 'Inscrições abertas',
  closed: 'Inscrições encerradas',
  in_progress: 'Em andamento',
  finished: 'Encerrado',
  cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<Status, string> = {
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  open: 'bg-green-500/15 text-green-400 border-green-500/20',
  closed: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  finished: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const GENDER_LABEL: Record<Gender, string> = {
  OPEN: 'Aberto', MALE: 'Masculino', FEMALE: 'Feminino', MIXED: 'Misto',
};

const STEPS = [
  { id: 1, label: 'Identificação', icon: ImageIcon,  shortLabel: 'Info'     },
  { id: 2, label: 'Local e responsável', icon: MapPin, shortLabel: 'Local'   },
  { id: 3, label: 'Formato',        icon: Users,      shortLabel: 'Formato'  },
  { id: 4, label: 'Cronômetro',     icon: Timer,      shortLabel: 'Tempo'    },
  { id: 5, label: 'Inscrição',      icon: Trophy,     shortLabel: 'Inscr.'   },
  { id: 6, label: 'Regras e revisão', icon: FileText, shortLabel: 'Regras'   },
] as const;

interface FormState {
  name: string;
  description: string;
  logo_url: string;                    // URL persistida (após upload ou se editando)
  logoFile: File | null;               // arquivo selecionado (upload pendente)
  logoPreview: string | null;          // object URL para preview antes do upload
  start_date: string;
  end_date: string;
  responsible_name: string;
  responsible_contact: string;
  location_id: string;
  modality: TournamentModality;
  gender: Gender;
  max_teams: string;
  players_per_team: string;
  players_on_court: string;
  periods_count: string;
  period_duration_minutes: string;
  is_paid: boolean;
  price_brl: string;
  rules_md: string;
  rules_document_url: string;
  visibility: Visibility;
  format: TournamentFormat;
  formatOverridden: boolean;           // se o admin forçou um valor diferente do sugerido
}

const emptyForm = (): FormState => {
  const d = MODALITY_DEFAULTS['3x3'];
  return {
    name: '',
    description: '',
    logo_url: '',
    logoFile: null,
    logoPreview: null,
    start_date: '',
    end_date: '',
    responsible_name: '',
    responsible_contact: '',
    location_id: '',
    modality: '3x3',
    gender: 'OPEN',
    max_teams: '',
    players_per_team: String(d.playersPerTeam),
    players_on_court: String(d.playersOnCourt),
    periods_count: String(d.periodsCount),
    period_duration_minutes: String(d.periodDurationMin),
    is_paid: false,
    price_brl: '',
    rules_md: DEFAULT_TOURNAMENT_RULES['3x3'],
    rules_document_url: '',
    visibility: 'tenant',
    format: recommendFormat(null, '3x3'),
    formatOverridden: false,
  };
};

const inputCls =
  'w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm';

export default function DashboardTorneios() {
  const { tenant, locations, plan, canCreateTournaments } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Tournament[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adminModal, setAdminModal] = useState<Tournament | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showRulesPreview, setShowRulesPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastPreviewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('basquete_users')
      .select('issuperusuario')
      .eq('auth_id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsSuperAdmin(data?.issuperusuario === true));
  }, [user?.id]);

  const fetchItems = useCallback(async () => {
    if (!tenant || !user?.id) return;
    // Mostra torneios do meu tenant OU criados por mim (cobre global/privado
    // quando tenant_id fica null).
    const { data, error: err } = await supabase
      .from('tournaments')
      .select('*')
      .or(`tenant_id.eq.${tenant.id},created_by.eq.${user.id}`)
      .order('start_date', { ascending: false });
    if (err) { setError(err.message); return; }
    setItems((data ?? []) as Tournament[]);
  }, [tenant, user?.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Cleanup do object URL do preview quando form fechar ou mudar arquivo
  useEffect(() => {
    return () => {
      if (lastPreviewRef.current) URL.revokeObjectURL(lastPreviewRef.current);
    };
  }, []);

  const locationById = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.id, l])),
    [locations]
  );

  const openNew = () => {
    if (!canCreateTournaments) {
      setError('Seu plano atual não inclui criação de torneios.');
      return;
    }
    setEditingId(null);
    const f = emptyForm();
    f.location_id = locations[0]?.id ?? '';
    setForm(f);
    setError(null);
    setShowRulesPreview(false);
    setStep(1);
    setWizardOpen(true);
  };

  const openEdit = (t: Tournament) => {
    const d = MODALITY_DEFAULTS[t.modality];
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? '',
      logo_url: t.logo_url ?? '',
      logoFile: null,
      logoPreview: null,
      start_date: t.start_date,
      end_date: t.end_date ?? '',
      responsible_name: t.responsible_name ?? '',
      responsible_contact: t.responsible_contact ?? '',
      location_id: t.location_id ?? '',
      modality: t.modality,
      gender: t.gender,
      max_teams: t.max_teams?.toString() ?? '',
      players_per_team: (t.players_per_team ?? d.playersPerTeam).toString(),
      players_on_court: (t.players_on_court ?? d.playersOnCourt).toString(),
      periods_count: (t.periods_count ?? d.periodsCount).toString(),
      period_duration_minutes: (t.period_duration_minutes ?? d.periodDurationMin).toString(),
      is_paid: t.is_paid,
      price_brl: t.price_brl ? (t.price_brl / 100).toFixed(2) : '',
      rules_md: t.rules_md ?? DEFAULT_TOURNAMENT_RULES[t.modality],
      rules_document_url: t.rules_document_url ?? '',
      visibility: t.visibility,
      format: t.format ?? recommendFormat(t.max_teams, t.modality),
      formatOverridden: !!t.format,
    });
    setError(null);
    setShowRulesPreview(false);
    setStep(1);
    setWizardOpen(true);
  };

  const cancelWizard = () => {
    if (lastPreviewRef.current) {
      URL.revokeObjectURL(lastPreviewRef.current);
      lastPreviewRef.current = null;
    }
    setWizardOpen(false);
    setEditingId(null);
    setError(null);
  };

  const onModalityChange = (m: TournamentModality) => {
    const d = MODALITY_DEFAULTS[m];
    setForm((f) => {
      const wasDefault = Object.values(DEFAULT_TOURNAMENT_RULES).includes(f.rules_md) || !f.rules_md.trim();
      const teams = f.max_teams ? parseInt(f.max_teams) : null;
      return {
        ...f,
        modality: m,
        players_per_team: String(d.playersPerTeam),
        players_on_court: String(d.playersOnCourt),
        periods_count: String(d.periodsCount),
        period_duration_minutes: String(d.periodDurationMin),
        rules_md: wasDefault ? DEFAULT_TOURNAMENT_RULES[m] : f.rules_md,
        format: f.formatOverridden ? f.format : recommendFormat(teams, m),
      };
    });
  };

  const onMaxTeamsChange = (val: string) => {
    setForm((f) => {
      const n = val ? parseInt(val) : null;
      return {
        ...f,
        max_teams: val,
        format: f.formatOverridden ? f.format : recommendFormat(n, f.modality),
      };
    });
  };

  const onFormatChange = (fmt: TournamentFormat) => {
    setForm((f) => ({ ...f, format: fmt, formatOverridden: true }));
  };

  const onPickFile = (file: File | null) => {
    if (lastPreviewRef.current) {
      URL.revokeObjectURL(lastPreviewRef.current);
      lastPreviewRef.current = null;
    }
    if (!file) {
      setForm((f) => ({ ...f, logoFile: null, logoPreview: null }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande (máx. 5MB).');
      return;
    }
    const url = URL.createObjectURL(file);
    lastPreviewRef.current = url;
    setForm((f) => ({ ...f, logoFile: file, logoPreview: url }));
  };

  const clearLogo = () => {
    if (lastPreviewRef.current) {
      URL.revokeObjectURL(lastPreviewRef.current);
      lastPreviewRef.current = null;
    }
    setForm((f) => ({ ...f, logoFile: null, logoPreview: null, logo_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const restoreDefaultRules = () => {
    setForm((f) => ({ ...f, rules_md: DEFAULT_TOURNAMENT_RULES[f.modality] }));
  };

  const buildUniqueSlug = async (name: string, startDate: string, ignoreId?: string): Promise<string> => {
    const year = startDate ? new Date(startDate + 'T12:00:00').getFullYear() : new Date().getFullYear();
    const base = slugifyTournamentName(name, String(year)) || `torneio-${Date.now()}`;
    let candidate = base;
    for (let i = 0; i < 8; i++) {
      const { data } = await supabase
        .from('tournaments')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();
      if (!data || data.id === ignoreId) return candidate;
      const suffix = Math.random().toString(36).slice(2, 6);
      candidate = `${base}-${suffix}`;
    }
    return `${base}-${Date.now()}`;
  };

  const uploadLogo = async (tournamentId: string, file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) ? ext : 'png';
    const path = `${tournamentId}/logo-${Date.now()}.${safeExt}`;
    const { error: upErr } = await supabase.storage
      .from('tournaments')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from('tournaments').getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.name.trim()) return 'Nome do torneio é obrigatório.';
      if (!form.start_date) return 'Data de início é obrigatória.';
    }
    if (s === 3) {
      const ppt = parseInt(form.players_per_team);
      const poc = parseInt(form.players_on_court);
      if (!ppt || ppt < 1) return 'Jogadores por equipe deve ser ≥ 1.';
      if (!poc || poc < 1) return 'Jogadores em quadra deve ser ≥ 1.';
      if (poc > ppt) return 'Jogadores em quadra não pode ser maior que o total por equipe.';
    }
    if (s === 4) {
      const pc = parseInt(form.periods_count);
      const pd = parseInt(form.period_duration_minutes);
      if (!pc || pc < 1) return 'Quantidade de períodos deve ser ≥ 1.';
      if (!pd || pd < 1) return 'Tempo por período deve ser ≥ 1 minuto.';
    }
    if (s === 5 && form.is_paid) {
      const price = parseFloat(form.price_brl.replace(',', '.'));
      if (!price || price <= 0) return 'Informe um valor válido para torneio pago.';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length, s + 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleFinalSubmit = async (publish: boolean) => {
    if (!canCreateTournaments) {
      setError('Seu plano atual não inclui criação de torneios. Faça upgrade para Profissional ou Enterprise.');
      return;
    }
    for (let s = 1; s <= STEPS.length; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }
    if (!tenant) { setError('Tenant não carregado.'); return; }
    setError(null);
    setLoading(true);

    try {
      const slug = editingId
        ? (items.find((i) => i.id === editingId)?.slug ?? await buildUniqueSlug(form.name, form.start_date))
        : await buildUniqueSlug(form.name, form.start_date);

      const pc = parseInt(form.periods_count) || 1;
      const pd = parseInt(form.period_duration_minutes) || 10;

      const payload: any = {
        tenant_id: form.visibility === 'global' ? null : tenant.id,
        location_id: form.location_id || null,
        visibility: form.visibility,
        name: form.name.trim(),
        slug,
        logo_url: form.logo_url || null,
        description: form.description.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        responsible_name: form.responsible_name.trim() || null,
        responsible_contact: form.responsible_contact.trim() || null,
        modality: form.modality,
        gender: form.gender,
        max_teams: form.max_teams ? parseInt(form.max_teams) : null,
        players_per_team: parseInt(form.players_per_team),
        players_on_court: parseInt(form.players_on_court),
        periods_count: pc,
        period_duration_minutes: pd,
        match_duration_minutes: pc * pd,
        is_paid: form.is_paid,
        price_brl: form.is_paid
          ? Math.round(parseFloat(form.price_brl.replace(',', '.')) * 100)
          : null,
        rules_md: form.rules_md.trim() || null,
        rules_document_url: form.rules_document_url.trim() || null,
        format: form.format,
        created_by: user?.id ?? null,
      };
      if (!editingId || publish) {
        payload.status = publish ? 'open' : 'draft';
      }

      let tournamentId: string;
      if (editingId) {
        const { error: err } = await supabase.from('tournaments').update(payload).eq('id', editingId);
        if (err) { setError(err.message); setLoading(false); return; }
        tournamentId = editingId;
      } else {
        const { data, error: err } = await supabase
          .from('tournaments')
          .insert(payload)
          .select('id')
          .single();
        if (err || !data) { setError(err?.message ?? 'Falha ao criar torneio.'); setLoading(false); return; }
        tournamentId = data.id;
      }

      // Upload da logomarca (se houver arquivo novo)
      if (form.logoFile) {
        try {
          const url = await uploadLogo(tournamentId, form.logoFile);
          const { error: updErr } = await supabase
            .from('tournaments')
            .update({ logo_url: url })
            .eq('id', tournamentId);
          if (updErr) throw updErr;
        } catch (e: any) {
          setError(`Torneio salvo, mas falha ao enviar logo: ${e.message ?? e}`);
          setLoading(false);
          await fetchItems();
          return;
        }
      }

      cancelWizard();
      await fetchItems();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tournaments').delete().eq('id', id);
    // (limpeza do bucket ficaria num job de GC — arquivos ficam órfãos aqui)
    setDeleteConfirm(null);
    await fetchItems();
  };

  const publishToggle = async (t: Tournament) => {
    const next: Status = t.status === 'draft' ? 'open' : 'draft';
    await supabase.from('tournaments').update({ status: next }).eq('id', t.id);
    await fetchItems();
  };

  const copyRegistrationLink = async (t: Tournament) => {
    const url = `${window.location.origin}/torneios/${t.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId((c) => (c === t.id ? null : c)), 1800);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6 md:mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <Swords className="w-6 h-6 text-orange-400" /> Torneios
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {items.length} torneio{items.length !== 1 ? 's' : ''} criado{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!wizardOpen && canCreateTournaments && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Novo torneio
          </button>
        )}
      </div>

      {!canCreateTournaments && !wizardOpen && (
        <div className="mb-6 p-5 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-900">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">Disponível nos planos Profissional e Enterprise</h3>
              <p className="text-sm text-slate-300 mb-3">
                A criação de torneios está incluída a partir do plano <strong className="text-white">Profissional (R$ 150/mês)</strong>.
                {plan && (
                  <span className="block text-xs text-slate-400 mt-1">
                    Seu plano atual: <strong>{plan.name}</strong>.
                  </span>
                )}
              </p>
              <button
                onClick={() => navigate('/dashboard/assinatura')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all"
              >
                Ver planos
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 mb-6">
          {/* Step indicator */}
          <div className="px-5 pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">
                {editingId ? 'Editar torneio' : 'Novo torneio'}
                <span className="ml-2 text-xs text-slate-500 font-normal">
                  Passo {step} de {STEPS.length}
                </span>
              </h3>
              <button
                onClick={cancelWizard}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = s.id === step;
                const done = s.id < step;
                return (
                  <React.Fragment key={s.id}>
                    <button
                      type="button"
                      onClick={() => { setError(null); setStep(s.id); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                        active
                          ? 'bg-orange-500 text-white'
                          : done
                          ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25'
                          : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{s.label}</span>
                      <span className="sm:hidden">{s.shortLabel}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={`h-px w-4 shrink-0 ${done ? 'bg-orange-500/40' : 'bg-slate-700'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* STEP 1 — Identificação */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do torneio *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Torneio de Verão 3x3 Vitória"
                    className={inputCls}
                    maxLength={120}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Logomarca do evento</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                      {form.logoPreview || form.logo_url ? (
                        <img
                          src={form.logoPreview ?? form.logo_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      ) : (
                        <ImageIcon className="w-7 h-7 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        {form.logoFile ? 'Trocar arquivo' : 'Enviar do meu computador'}
                      </button>
                      {(form.logoPreview || form.logo_url) && (
                        <button
                          type="button"
                          onClick={clearLogo}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover logomarca
                        </button>
                      )}
                      <p className="text-[11px] text-slate-500">
                        PNG, JPG, WebP ou SVG. Máx. 5MB. Será salva em uma pasta exclusiva deste torneio.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Resumo do torneio visível na página pública"
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Data de início *</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Data de término (opcional)</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — Local e responsável */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Local</label>
                  <select
                    value={form.location_id}
                    onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Sem local definido</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Associar um local permite usar a estrutura do local (quadras, vitrine pública, etc.).
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Responsável</label>
                    <input
                      value={form.responsible_name}
                      onChange={(e) => setForm((f) => ({ ...f, responsible_name: e.target.value }))}
                      placeholder="Nome do organizador"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Contato (WhatsApp ou email)</label>
                    <input
                      value={form.responsible_contact}
                      onChange={(e) => setForm((f) => ({ ...f, responsible_contact: e.target.value }))}
                      placeholder="(27) 99999-0000"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Formato */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Modalidade *</label>
                    <select
                      value={form.modality}
                      onChange={(e) => onModalityChange(e.target.value as TournamentModality)}
                      className={inputCls}
                    >
                      <option value="3x3">3x3</option>
                      <option value="5x5">5x5</option>
                      <option value="1x1">1x1</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Gênero</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))}
                      className={inputCls}
                    >
                      <option value="OPEN">Aberto</option>
                      <option value="MALE">Masculino</option>
                      <option value="FEMALE">Feminino</option>
                      <option value="MIXED">Misto</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Qtd. de equipes</label>
                    <input
                      type="number"
                      min="2"
                      value={form.max_teams}
                      onChange={(e) => onMaxTeamsChange(e.target.value)}
                      placeholder="Sem limite"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Jogadores por equipe *</label>
                    <input
                      type="number"
                      min="1"
                      value={form.players_per_team}
                      onChange={(e) => setForm((f) => ({ ...f, players_per_team: e.target.value }))}
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Inclui titulares e reservas.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Jogadores em quadra *</label>
                    <input
                      type="number"
                      min="1"
                      value={form.players_on_court}
                      onChange={(e) => setForm((f) => ({ ...f, players_on_court: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-xs text-slate-400">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-400" />
                  Trocar a modalidade recarrega automaticamente os valores padrão (pode editar depois).
                </div>

                {/* Formato da disputa */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="block text-xs font-medium text-slate-400">
                      Formato da disputa
                    </label>
                    {form.formatOverridden && (
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = recommendFormat(
                            form.max_teams ? parseInt(form.max_teams) : null,
                            form.modality
                          );
                          setForm((f) => ({ ...f, format: suggested, formatOverridden: false }));
                        }}
                        className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold"
                      >
                        Usar recomendação
                      </button>
                    )}
                  </div>
                  <select
                    value={form.format}
                    onChange={(e) => onFormatChange(e.target.value as TournamentFormat)}
                    className={inputCls}
                  >
                    {(['KNOCKOUT','ROUND_ROBIN','GROUP_STAGE','DOUBLE_ELIMINATION','CROSS_GROUPS','HOME_AWAY','SWISS'] as TournamentFormat[]).map((f) => (
                      <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    {FORMAT_DESCRIPTION[form.format]}
                  </p>

                  {(() => {
                    const n = form.max_teams ? parseInt(form.max_teams) : 0;
                    const jogos = estimateMatchCount(form.format, n);
                    const recomendado = recommendFormat(n, form.modality);
                    const mesmoQueRecomendado = form.format === recomendado;
                    return (
                      <div className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 text-xs space-y-1.5">
                        {n > 0 ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Jogos previstos com {n} equipes:</span>
                            <span className="font-mono font-bold text-white">{jogos}</span>
                          </div>
                        ) : (
                          <p className="text-slate-500">Defina a quantidade de equipes para ver a previsão de jogos.</p>
                        )}
                        {n > 0 && !mesmoQueRecomendado && (
                          <div className="flex items-start gap-1.5 pt-1 border-t border-slate-700/50">
                            <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span className="text-amber-300">
                              Para {n} equipes recomendamos <strong>{FORMAT_LABEL[recomendado]}</strong>
                              {' '}({estimateMatchCount(recomendado, n)} jogos).
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* STEP 4 — Cronômetro */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Quantidade de períodos *</label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={form.periods_count}
                      onChange={(e) => setForm((f) => ({ ...f, periods_count: e.target.value }))}
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Ex.: 3x3 usa 1 período, 5x5 usa 4 períodos.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Tempo por período (min) *</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={form.period_duration_minutes}
                      onChange={(e) => setForm((f) => ({ ...f, period_duration_minutes: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-300 text-sm">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span>Duração total da partida</span>
                  </div>
                  <span className="text-white font-bold text-lg">
                    {(parseInt(form.periods_count) || 0) * (parseInt(form.period_duration_minutes) || 0)} min
                  </span>
                </div>
              </div>
            )}

            {/* STEP 5 — Inscrição e visibilidade */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:border-slate-600 transition-all">
                    <input
                      type="checkbox"
                      checked={form.is_paid}
                      onChange={(e) => setForm((f) => ({ ...f, is_paid: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm text-white font-medium">Torneio pago (taxa de inscrição por equipe)</span>
                  </label>
                  {form.is_paid && (
                    <div className="mt-3 max-w-xs">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Valor por equipe (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.price_brl}
                        onChange={(e) => setForm((f) => ({ ...f, price_brl: e.target.value }))}
                        placeholder="Ex: 150,00"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Visibilidade do evento</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['tenant', 'private', 'global'] as Visibility[]).map((v) => {
                      const Icon = VISIBILITY_ICON[v];
                      const disabled = v === 'global' && !isSuperAdmin;
                      return (
                        <button
                          type="button"
                          key={v}
                          disabled={disabled}
                          onClick={() => setForm((f) => ({ ...f, visibility: v }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            disabled
                              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              : form.visibility === v
                              ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-left">{VISIBILITY_LABEL[v]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!isSuperAdmin && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Apenas super admins podem publicar torneios globais.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 6 — Regras e revisão */}
            {step === 6 && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Resumo</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-300">
                    <li><span className="text-slate-500">Nome:</span> {form.name || '—'}</li>
                    <li><span className="text-slate-500">Modalidade:</span> {form.modality} · {GENDER_LABEL[form.gender]}</li>
                    <li><span className="text-slate-500">Início:</span> {form.start_date || '—'}</li>
                    <li><span className="text-slate-500">Local:</span> {locationById[form.location_id]?.name ?? '—'}</li>
                    <li><span className="text-slate-500">Equipes:</span> {form.max_teams || 'sem limite'} · {form.players_per_team} jog/equipe</li>
                    <li><span className="text-slate-500">Partida:</span> {form.periods_count}x{form.period_duration_minutes} min</li>
                    <li><span className="text-slate-500">Inscrição:</span> {form.is_paid ? `R$ ${form.price_brl}` : 'Gratuita'}</li>
                    <li><span className="text-slate-500">Visibilidade:</span> {VISIBILITY_LABEL[form.visibility]}</li>
                  </ul>
                </div>

                <div>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <label className="text-xs font-medium text-slate-400">
                      Documento oficial de regras (editável)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRulesPreview((v) => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                      >
                        {showRulesPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showRulesPreview ? 'Editar' : 'Pré-visualizar'}
                      </button>
                      <button
                        type="button"
                        onClick={restoreDefaultRules}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Restaurar {form.modality}
                      </button>
                    </div>
                  </div>
                  {showRulesPreview ? (
                    <div className="px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {form.rules_md || 'Sem regras definidas.'}
                    </div>
                  ) : (
                    <textarea
                      value={form.rules_md}
                      onChange={(e) => setForm((f) => ({ ...f, rules_md: e.target.value }))}
                      rows={12}
                      placeholder="Escreva ou cole as regras oficiais do torneio (aceita markdown)"
                      className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Link do documento oficial (PDF externo — opcional)
                  </label>
                  <input
                    value={form.rules_document_url}
                    onChange={(e) => setForm((f) => ({ ...f, rules_document_url: e.target.value }))}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer navegação */}
          <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-sm font-medium transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={goNext}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition-all disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar rascunho'}
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalSubmit(true)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editingId ? 'Salvar e publicar' : 'Criar e publicar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {items.length === 0 && !wizardOpen ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-700 text-center">
          <Swords className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-sm">Nenhum torneio criado</p>
          <p className="text-slate-500 text-xs mt-1">
            Crie um torneio 3x3, 5x5 ou 1x1 e gere o link de inscrição de equipes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => {
            const VisibilityIcon = VISIBILITY_ICON[t.visibility];
            const locName = t.location_id ? locationById[t.location_id]?.name : null;
            return (
              <div key={t.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex items-start gap-3">
                  {t.logo_url ? (
                    <img
                      src={t.logo_url}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                      onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <Swords className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
                        {t.modality} · {GENDER_LABEL[t.gender]}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <VisibilityIcon className="w-3 h-3" /> {VISIBILITY_LABEL[t.visibility]}
                      </span>
                    </div>
                    <p className="font-semibold text-white truncate">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>
                        {new Date(t.start_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                      {locName && (<><span className="text-slate-600">·</span><span>{locName}</span></>)}
                      {t.periods_count && t.period_duration_minutes && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span>{t.periods_count}x{t.period_duration_minutes} min</span>
                        </>
                      )}
                      {t.is_paid && t.price_brl ? (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-emerald-400 font-semibold">
                            R$ {(t.price_brl / 100).toFixed(2).replace('.', ',')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-emerald-400 font-semibold">Gratuito</span>
                        </>
                      )}
                    </div>
                    {t.status !== 'draft' && (
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <code className="text-[11px] text-slate-400 bg-slate-800 px-2 py-1 rounded-lg truncate max-w-[260px]">
                          /torneios/{t.slug}
                        </code>
                        <button
                          onClick={() => copyRegistrationLink(t)}
                          className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 transition-all"
                        >
                          {copiedId === t.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === t.id ? 'Copiado' : 'Copiar link'}
                        </button>
                        <a
                          href={`/torneios/${t.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-all"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir
                        </a>
                        <button
                          onClick={() => setAdminModal(t)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-orange-200 transition-all ml-auto"
                        >
                          <Users className="w-3 h-3" /> Gerenciar equipes e chaveamento
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => publishToggle(t)}
                      title={t.status === 'draft' ? 'Publicar' : 'Voltar para rascunho'}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                    >
                      {t.status === 'draft' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {deleteConfirm === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 rounded-xl bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                      >
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

      {adminModal && (
        <TournamentAdminModal
          tournament={{
            id: adminModal.id,
            name: adminModal.name,
            max_teams: adminModal.max_teams,
            format: adminModal.format,
            modality: adminModal.modality,
          }}
          onClose={() => setAdminModal(null)}
        />
      )}
    </div>
  );
}
