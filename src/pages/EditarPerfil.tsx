/**
 * Tela de atualização de perfil completo de atleta de basquete
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  User,
  ArrowLeft,
  Camera,
  Loader2,
  Ruler,
  Scale,
  Target,
  Calendar,
  Hash,
  FileText,
  Phone,
  MapPin,
  Check,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export interface PerfilAtleta {
  id: string;
  auth_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  full_name: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  position: string | null;
  dominant_hand: string | null;
  jersey_number: number | null;
  bio: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
}

const POSICOES = ['Armador', 'Ala-armador', 'Ala', 'Ala-pivô', 'Pivô'] as const;
const MAO_DOMINANTE = ['Direito', 'Esquerdo', 'Ambidestro'] as const;

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface EditarPerfilProps {
  darkMode: boolean;
  onBack: () => void;
  onSaved?: () => void;
  /** Primeiro login: obriga nome + avatar antes de continuar */
  mandatory?: boolean;
}

export default function EditarPerfil({ darkMode, onBack, onSaved, mandatory }: EditarPerfilProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    display_name: '',
    full_name: '',
    birth_date: '',
    height_cm: '',
    weight_kg: '',
    position: '',
    dominant_hand: '',
    jersey_number: '',
    bio: '',
    phone: '',
    city: '',
    state: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      setLoading(true);
      setError(null);

      try {
        const { data: profile, error: fetchError } = await supabase
          .from('basquete_users')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (fetchError) {
          setError('Erro ao carregar perfil.');
          setLoading(false);
          return;
        }

        if (profile) {
          setProfileId(profile.id);
          setForm({
            display_name: profile.display_name ?? '',
            full_name: profile.full_name ?? '',
            birth_date: profile.birth_date ?? '',
            height_cm: profile.height_cm != null ? String(profile.height_cm) : '',
            weight_kg: profile.weight_kg != null ? String(profile.weight_kg) : '',
            position: profile.position ?? '',
            dominant_hand: profile.dominant_hand ?? '',
            jersey_number: profile.jersey_number != null ? String(profile.jersey_number) : '',
            bio: profile.bio ?? '',
            phone: profile.phone ?? '',
            city: profile.city ?? '',
            state: profile.state ?? '',
          });
          setAvatarUrl(profile.avatar_url);
        } else {
          const email = user.email?.trim();
          if (!email) {
            setError('Sua conta não tem e-mail. Adicione um e-mail na autenticação para criar o perfil.');
            setLoading(false);
            return;
          }
          const { data: newProfile, error: insertError } = await supabase
            .from('basquete_users')
            .insert({
              auth_id: user.id,
              email,
              display_name: user.user_metadata?.display_name ?? '',
            })
            .select('id')
            .single();

          if (insertError) {
            const hint =
              insertError.message?.includes('relation') ||
              insertError.message?.includes('does not exist') ||
              insertError.code === '42P01'
                ? ' Confirme no Supabase se a tabela public.basquete_users existe e se há política RLS (execute supabase/basquete_users.sql).'
                : '';
            setError(
              `${insertError.message || 'Erro ao criar perfil.'}${hint}`
            );
          } else if (newProfile) {
            setProfileId(newProfile.id);
          }
        }
      } catch (e) {
        setError('Erro ao carregar perfil.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user?.id]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(ext)) {
      setError('Use imagem JPEG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem deve ter no máximo 5MB.');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      if (profileId) {
        await supabase.from('basquete_users').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', profileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar imagem.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !profileId) return;
    const nome = form.display_name.trim() || form.full_name.trim();
    if (!nome) {
      setError('Nome ou apelido é obrigatório.');
      return;
    }
    if (mandatory && !avatarUrl) {
      setError('Selecione uma foto de perfil.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        display_name: form.display_name.trim() || null,
        full_name: form.full_name.trim() || null,
        birth_date: form.birth_date || null,
        height_cm: form.height_cm ? parseInt(form.height_cm, 10) : null,
        weight_kg: form.weight_kg ? parseInt(form.weight_kg, 10) : null,
        position: form.position || null,
        dominant_hand: form.dominant_hand || null,
        jersey_number: form.jersey_number ? parseInt(form.jersey_number, 10) : null,
        bio: form.bio.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        state: form.state || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('basquete_users')
        .update(payload)
        .eq('id', profileId);

      if (updateError) throw updateError;
      setSuccess(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={cn('w-10 h-10 animate-spin', darkMode ? 'text-orange-400' : 'text-orange-500')} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        {!mandatory && (
          <button
            onClick={onBack}
            className={cn(
              'p-2 rounded-xl transition-colors',
              darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className={cn('text-xl font-bold', darkMode ? 'text-white' : 'text-slate-900')}>
          {mandatory ? 'Complete seu perfil para continuar' : 'Atualizar perfil'}
        </h2>
      </div>
      {mandatory && (
        <p className={cn('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>
          Informe seu nome e selecione uma foto. São obrigatórios para entrar na fila.
        </p>
      )}

      {error && (
        <div
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border',
            darkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'
          )}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border',
            darkMode ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-600'
          )}
        >
          <Check className="w-5 h-5 flex-shrink-0" />
          <p>Perfil salvo com sucesso!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className={cn(
                'w-28 h-28 rounded-full overflow-hidden border-4 transition-all flex items-center justify-center',
                darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100',
                'hover:ring-4 hover:ring-orange-500/30'
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className={cn('w-14 h-14', darkMode ? 'text-slate-500' : 'text-slate-400')} />
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className={cn(
                'absolute -bottom-1 -right-1 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all',
                'bg-orange-500 hover:bg-orange-600 text-white'
              )}
            >
              <Camera className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <p className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
            Clique para enviar foto (máx. 5MB){mandatory && <span className="text-orange-500"> *</span>}
          </p>
        </div>

        {/* Nome / Apelido - único campo obrigatório */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Nome ou apelido <span className="text-orange-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="Como te chamam na quadra"
              maxLength={50}
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            />
          </div>
        </div>

        {/* Nome completo */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Nome completo
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Nome completo"
            maxLength={100}
            className={cn(
              'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
          />
        </div>

        {/* Data nascimento */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Data de nascimento
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            />
          </div>
        </div>

        {/* Altura e Peso */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
              Altura (cm)
            </label>
            <div className="relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                min={100}
                max={250}
                value={form.height_cm}
                onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                placeholder="Ex: 185"
                className={cn(
                  'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
              Peso (kg)
            </label>
            <div className="relative">
              <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                min={30}
                max={200}
                value={form.weight_kg}
                onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                placeholder="Ex: 75"
                className={cn(
                  'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
              />
            </div>
          </div>
        </div>

        {/* Posição */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Posição
          </label>
          <div className="relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none bg-no-repeat bg-right',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center', backgroundSize: 20 }}
            >
              <option value="">Selecione</option>
              {POSICOES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mão dominante */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Mão dominante
          </label>
          <div className="flex flex-wrap gap-2">
            {MAO_DOMINANTE.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dominant_hand: f.dominant_hand === op ? '' : op }))}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  form.dominant_hand === op
                    ? 'bg-orange-500 text-white'
                    : darkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200'
                )}
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        {/* Número da camisa */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Número da camisa
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min={0}
              max={99}
              value={form.jersey_number}
              onChange={(e) => setForm((f) => ({ ...f, jersey_number: e.target.value }))}
              placeholder="0–99"
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            />
          </div>
        </div>

        {/* Telefone */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Telefone
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(00) 00000-0000"
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            />
          </div>
        </div>

        {/* Cidade e Estado */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
              Cidade
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Sua cidade"
                maxLength={80}
                className={cn(
                  'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
              Estado
            </label>
            <select
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className={cn(
                'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            >
              <option value="">UF</option>
              {ESTADOS_BR.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            Bio / Sobre você
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-4 w-4 h-4 text-slate-400" />
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Conte um pouco sobre você como atleta..."
              rows={4}
              maxLength={500}
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            />
            <p className={cn('text-xs mt-1 text-right', darkMode ? 'text-slate-500' : 'text-slate-400')}>
              {form.bio.length}/500
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            saving ||
            (mandatory && (!(form.display_name.trim() || form.full_name.trim()) || !avatarUrl))
          }
          className={cn(
            'w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
            'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
          )}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {mandatory ? 'Continuar' : 'Salvar perfil'}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
