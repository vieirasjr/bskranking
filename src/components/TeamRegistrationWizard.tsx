import React, { useEffect, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Upload, Trash2, Plus,
  AlertCircle, Users, Shield, Check, ImageIcon, Info,
  Star,
} from 'lucide-react';
import { supabase } from '../supabase';
import PlayerSearchSelect, { BasqueteUserLite } from './PlayerSearchSelect';

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface TeamWizardTournament {
  id: string;
  name: string;
  modality: '1x1' | '3x3' | '5x5';
  players_per_team: number | null;
  players_on_court: number | null;
  is_paid: boolean;
  price_brl: number | null;
}

export interface TeamWizardInitialTeam {
  id: string;
  name: string;
  logo_url: string | null;
  coach_name: string | null;
  trainer_name: string | null;
  staff: string[];
  notes: string | null;
  players: Array<{
    id?: string;
    user_id?: string | null;
    user?: BasqueteUserLite | null;
    name: string;
    jersey_number: number | null;
    position: Position | null;
    is_starter: boolean;
  }>;
}

interface Props {
  tournament: TeamWizardTournament;
  userId: string;
  initialTeam?: TeamWizardInitialTeam | null;
  onClose: () => void;
  onSaved: (teamId: string) => void;
}

interface PlayerRow {
  id?: string;
  user: BasqueteUserLite | null;
  name: string;                 // snapshot do nome (display_name)
  jersey_number: string;
  position: Position | '';
  is_starter: boolean;
}

const STEPS = [
  { id: 1, label: 'Identificação',    icon: ImageIcon },
  { id: 2, label: 'Comissão técnica', icon: Shield },
  { id: 3, label: 'Jogadores',        icon: Users },
  { id: 4, label: 'Revisão',          icon: Check },
] as const;

const POSITION_LABEL: Record<Position, string> = {
  PG: 'Armador', SG: 'Ala-armador', SF: 'Ala', PF: 'Ala-pivô', C: 'Pivô',
};

const inputCls =
  'w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm';

export default function TeamRegistrationWizard({
  tournament, userId, initialTeam, onClose, onSaved,
}: Props) {
  const maxRoster = tournament.players_per_team ?? 10;
  const requiredStarters = tournament.players_on_court ?? 5;
  const isEdit = !!initialTeam;

  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialTeam?.name ?? '');
  const [logoUrl, setLogoUrl] = useState<string>(initialTeam?.logo_url ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coachName, setCoachName] = useState(initialTeam?.coach_name ?? '');
  const [trainerName, setTrainerName] = useState(initialTeam?.trainer_name ?? '');
  const [staff, setStaff] = useState<string[]>(initialTeam?.staff ?? []);
  const [staffInput, setStaffInput] = useState('');
  const [notes, setNotes] = useState(initialTeam?.notes ?? '');
  const [players, setPlayers] = useState<PlayerRow[]>(
    (initialTeam?.players ?? []).map((p) => ({
      id: p.id,
      user: p.user ?? null,
      name: p.name,
      jersey_number: p.jersey_number?.toString() ?? '',
      position: (p.position ?? '') as Position | '',
      is_starter: p.is_starter,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  // Inicializa com uma linha vazia se não há jogadores
  useEffect(() => {
    if (players.length === 0) {
      setPlayers([{ user: null, name: '', jersey_number: '', position: '', is_starter: true }]);
    }
  }, []);

  const pickFile = (file: File | null) => {
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
    if (!file) { setLogoFile(null); setLogoPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Arquivo muito grande (máx. 5MB).'); return; }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setLogoFile(file);
    setLogoPreview(url);
  };

  const clearLogo = () => {
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addStaff = () => {
    const v = staffInput.trim();
    if (!v) return;
    setStaff((s) => [...s, v]);
    setStaffInput('');
  };

  const removeStaff = (i: number) =>
    setStaff((s) => s.filter((_, idx) => idx !== i));

  const addPlayer = () => {
    if (players.length >= maxRoster) return;
    setPlayers((p) => [...p, { user: null, name: '', jersey_number: '', position: '', is_starter: false }]);
  };

  const selectUserFor = (i: number, u: BasqueteUserLite) => {
    updatePlayer(i, {
      user: u,
      name: u.display_name || u.full_name || u.email || '',
    });
  };

  const clearUserFor = (i: number) => {
    updatePlayer(i, { user: null, name: '' });
  };

  const removePlayer = (i: number) =>
    setPlayers((p) => p.filter((_, idx) => idx !== i));

  const updatePlayer = (i: number, patch: Partial<PlayerRow>) =>
    setPlayers((p) => p.map((pl, idx) => (idx === i ? { ...pl, ...patch } : pl)));

  const starterCount = players.filter((p) => p.is_starter).length;

  const toggleStarter = (i: number) => {
    updatePlayer(i, { is_starter: !players[i].is_starter });
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!name.trim()) return 'Nome da equipe é obrigatório.';
    }
    if (s === 3) {
      if (players.length < 1) return 'Adicione pelo menos um jogador.';
      if (players.length > maxRoster) return `Máximo de ${maxRoster} jogadores.`;
      const unselected = players.filter((p) => !p.user);
      if (unselected.length > 0) {
        return 'Selecione um atleta cadastrado em cada linha (ou remova as vazias).';
      }
      const userIds = players.map((p) => p.user!.id);
      if (new Set(userIds).size !== userIds.length) {
        return 'Jogador duplicado na escalação.';
      }
      const nums = players.map((p) => p.jersey_number).filter((n) => n !== '');
      if (new Set(nums).size !== nums.length) return 'Números de camisa duplicados.';
      if (starterCount !== requiredStarters) {
        return `Marque exatamente ${requiredStarters} titular(es) (atualmente ${starterCount}).`;
      }
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length, s + 1));
  };
  const goBack = () => { setError(null); setStep((s) => Math.max(1, s - 1)); };

  const uploadLogo = async (teamId: string, file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) ? ext : 'png';
    const path = `${teamId}/logo-${Date.now()}.${safeExt}`;
    const { error: upErr } = await supabase.storage
      .from('team-logos')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from('team-logos').getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= STEPS.length; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }
    setError(null);
    setLoading(true);

    try {
      const teamPayload: any = {
        tournament_id: tournament.id,
        owner_auth_id: userId,
        name: name.trim(),
        logo_url: logoUrl || null,
        coach_name: coachName.trim() || null,
        trainer_name: trainerName.trim() || null,
        staff,
        notes: notes.trim() || null,
      };

      let teamId: string;
      if (isEdit && initialTeam) {
        const { error: uErr } = await supabase
          .from('teams')
          .update(teamPayload)
          .eq('id', initialTeam.id);
        if (uErr) { setError(uErr.message); setLoading(false); return; }
        teamId = initialTeam.id;
      } else {
        const { data, error: iErr } = await supabase
          .from('teams')
          .insert(teamPayload)
          .select('id')
          .single();
        if (iErr || !data) {
          const msg = iErr?.message ?? 'Falha ao salvar equipe.';
          setError(msg.includes('teams_tournament_owner_unique')
            ? 'Você já tem uma equipe inscrita neste torneio.'
            : msg);
          setLoading(false);
          return;
        }
        teamId = data.id;
      }

      // Upload da logomarca (se houver arquivo novo)
      if (logoFile) {
        try {
          const url = await uploadLogo(teamId, logoFile);
          await supabase.from('teams').update({ logo_url: url }).eq('id', teamId);
        } catch (e: any) {
          setError(`Equipe salva, mas falha ao enviar logo: ${e.message ?? e}`);
          // continua — a equipe foi salva
        }
      }

      // Sincroniza jogadores: apaga todos e reinsere
      await supabase.from('team_players').delete().eq('team_id', teamId);
      if (players.length > 0) {
        const rows = players.map((p, idx) => ({
          team_id: teamId,
          user_id: p.user?.id ?? null,
          name: (p.user?.display_name || p.user?.full_name || p.name || '').trim(),
          jersey_number: p.jersey_number ? parseInt(p.jersey_number) : null,
          position: p.position || null,
          is_starter: p.is_starter,
          order_idx: idx,
        }));
        const { error: pErr } = await supabase.from('team_players').insert(rows);
        if (pErr) { setError(`Equipe salva, mas falha nos jogadores: ${pErr.message}`); setLoading(false); return; }
      }

      onSaved(teamId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 sm:rounded-2xl shadow-2xl my-0 sm:my-6">
        <div className="px-5 pt-5 pb-3 border-b border-slate-800 flex items-start justify-between gap-2">
          <div>
            <h2 className="font-black text-white text-lg">
              {isEdit ? 'Editar equipe' : 'Inscrever equipe'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tournament.name} · {tournament.modality} · {maxRoster} jogadores · {requiredStarters} titular(es)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4">
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
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-4 shrink-0 ${done ? 'bg-orange-500/40' : 'bg-slate-700'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* STEP 1 — Identificação */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome da equipe *</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Braska Basketball"
                  className={inputCls}
                  maxLength={80}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Logomarca da equipe</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {logoPreview || logoUrl ? (
                      <img
                        src={logoPreview ?? logoUrl}
                        alt=""
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
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      {logoFile ? 'Trocar arquivo' : 'Enviar imagem'}
                    </button>
                    {(logoPreview || logoUrl) && (
                      <button
                        type="button"
                        onClick={clearLogo}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </button>
                    )}
                    <p className="text-[11px] text-slate-500">PNG, JPG, WebP ou SVG. Máx. 5MB.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Comissão técnica */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Técnico principal</label>
                <input
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="Nome do técnico"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Preparador (opcional)</label>
                <input
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
                  placeholder="Nome do preparador físico"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Staff adicional</label>
                <div className="flex gap-2">
                  <input
                    value={staffInput}
                    onChange={(e) => setStaffInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStaff(); } }}
                    placeholder="Nome e função (ex: João – fisioterapeuta)"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={addStaff}
                    className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {staff.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {staff.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-200">
                        {s}
                        <button
                          onClick={() => removeStaff(i)}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — Jogadores */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-xs text-slate-400">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-400" />
                <div>
                  Elenco: <strong className="text-white">{players.length}/{maxRoster}</strong> · Titulares: <strong className={starterCount === requiredStarters ? 'text-emerald-400' : 'text-amber-400'}>{starterCount}/{requiredStarters}</strong>
                </div>
              </div>

              <div className="space-y-2">
                {players.map((p, i) => {
                  const excludeIds = players
                    .map((pl, idx) => (idx !== i ? pl.user?.id : null))
                    .filter((x): x is string => !!x);
                  return (
                    <div key={i} className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStarter(i)}
                          title={p.is_starter ? 'Titular' : 'Reserva'}
                          className={`p-1.5 rounded-lg transition-all shrink-0 ${
                            p.is_starter
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${p.is_starter ? 'fill-orange-300' : ''}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <PlayerSearchSelect
                            selected={p.user}
                            onSelect={(u) => selectUserFor(i, u)}
                            onClear={() => clearUserFor(i)}
                            excludeIds={excludeIds}
                            placeholder={`Atleta ${i + 1} — código, nome ou email`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(i)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {p.user && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={p.jersey_number}
                            onChange={(e) => updatePlayer(i, { jersey_number: e.target.value })}
                            placeholder="Nº camisa"
                            className={inputCls}
                          />
                          <select
                            value={p.position}
                            onChange={(e) => updatePlayer(i, { position: e.target.value as Position | '' })}
                            className={inputCls}
                          >
                            <option value="">Posição</option>
                            {(['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map((pos) => (
                              <option key={pos} value={pos}>{pos} — {POSITION_LABEL[pos]}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {players.length < maxRoster && (
                <button
                  type="button"
                  onClick={addPlayer}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-orange-500/40 text-slate-400 hover:text-orange-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Adicionar jogador
                </button>
              )}
            </div>
          )}

          {/* STEP 4 — Revisão */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                {(logoPreview || logoUrl) ? (
                  <img src={logoPreview ?? logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-700" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">{name || '—'}</p>
                  <p className="text-xs text-slate-400 truncate">
                    Técnico: {coachName || '—'}{trainerName ? ` · Preparador: ${trainerName}` : ''}
                  </p>
                </div>
              </div>

              {staff.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Staff</p>
                  <p className="text-xs text-slate-300">{staff.join(' · ')}</p>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-3 py-2 bg-slate-800/60 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Elenco ({players.length})
                  </p>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    {starterCount} titular{starterCount !== 1 ? 'es' : ''}
                  </p>
                </div>
                <div>
                  {players.map((p, i) => (
                    <div
                      key={i}
                      className={`px-3 py-2 flex items-center gap-2 text-sm ${i > 0 ? 'border-t border-slate-800' : ''}`}
                    >
                      <span className={`w-8 text-center font-mono font-bold ${p.is_starter ? 'text-orange-400' : 'text-slate-500'}`}>
                        {p.jersey_number || '—'}
                      </span>
                      <span className="flex-1 text-white truncate">{p.name || '—'}</span>
                      <span className="text-[11px] text-slate-500">{p.position || '—'}</span>
                      {p.is_starter && <Star className="w-3 h-3 text-orange-400 fill-orange-400" />}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Observações (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Algum detalhe para o organizador?"
                  className={`${inputCls} resize-none`}
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

        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={step === 1 ? onClose : goBack}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm font-medium transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> {step === 1 ? 'Cancelar' : 'Voltar'}
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
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Confirmar inscrição'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
