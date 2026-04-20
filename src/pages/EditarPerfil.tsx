/**
 * Tela de atualização de perfil completo de atleta de basquete
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  MapPin,
  Check,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  X,
  Crop,
  Crown,
  Sparkles,
  Link2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { COUNTRIES_PT_SORTED } from '../data/countriesPt';
import { CountryFlagSvg } from '../components/CountryFlagSvg';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

const AVATAR_MAX_SIZE = 512;
const PRO_PRICE_BRL = 9.9;

interface SponsorInput {
  name: string;
  logo_url: string;
  link_url: string;
}

async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  // Limita a resolução final para AVATAR_MAX_SIZE px (ex: 512x512)
  const outSize = Math.min(cropArea.width, cropArea.height, AVATAR_MAX_SIZE);

  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outSize,
    outSize,
  );

  // WebP: ~30-50% menor que JPEG na mesma qualidade visual
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))),
      'image/webp',
      0.82,
    );
  });
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
  /** ISO 3166-1 alpha-2 — origem do atleta (bandeira no rank global). */
  country_iso: string | null;
  /** PIN de 4 dígitos para ações administrativas. */
  admin_pin: string | null;
  is_pro?: boolean;
  pro_cover_image_url?: string | null;
  pro_profile_tagline?: string | null;
  pro_athlete_resume?: string | null;
  pro_sponsors?: SponsorInput[] | null;
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
  /** Exibe seção de PIN de admin no perfil */
  hasAdminAccess?: boolean;
}

export default function EditarPerfil({ darkMode, onBack, onSaved, mandatory, hasAdminAccess }: EditarPerfilProps) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPro, setIsPro] = useState(false);

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
    city: '',
    state: '',
    country_iso: 'BR',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [proTagline, setProTagline] = useState('');
  const [proCoverImageUrl, setProCoverImageUrl] = useState('');
  const [proAthleteResume, setProAthleteResume] = useState('');
  const [proSponsors, setProSponsors] = useState<SponsorInput[]>([
    { name: '', logo_url: '', link_url: '' },
    { name: '', logo_url: '', link_url: '' },
  ]);

  // Crop state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      setLoading(true);
      setError(null);

      try {
        const { data: profile, error: fetchError } = await supabase
          .from('basquete_users')
          .select('*, is_pro, pro_cover_image_url, pro_profile_tagline, pro_athlete_resume, pro_sponsors')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (fetchError) {
          setError('Erro ao carregar perfil.');
          setLoading(false);
          return;
        }

        if (profile) {
          let resolvedAdminPin: string | null = profile.admin_pin ?? null;
          if (hasAdminAccess && !resolvedAdminPin) {
            const newPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
            const { error: pinError } = await supabase
              .from('basquete_users')
              .update({ admin_pin: newPin })
              .eq('id', profile.id);
            if (!pinError) resolvedAdminPin = newPin;
          }
          setProfileId(profile.id);
          setAdminPin(resolvedAdminPin);
          setIsPro(Boolean(profile.is_pro));
          setProTagline(profile.pro_profile_tagline ?? '');
          setProCoverImageUrl(profile.pro_cover_image_url ?? '');
          setProAthleteResume(profile.pro_athlete_resume ?? '');
          const loadedSponsors = Array.isArray(profile.pro_sponsors)
            ? (profile.pro_sponsors as SponsorInput[]).filter((s) => s && typeof s === 'object')
            : [];
          setProSponsors([
            loadedSponsors[0] ?? { name: '', logo_url: '', link_url: '' },
            loadedSponsors[1] ?? { name: '', logo_url: '', link_url: '' },
          ]);
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
            city: profile.city ?? '',
            state: profile.state ?? '',
            country_iso: profile.country_iso ?? 'BR',
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
  }, [user?.id, hasAdminAccess]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(ext)) {
      setError('Use imagem JPEG, PNG, WebP ou GIF.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem deve ter no máximo 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
    setCroppedAreaPixels(null);
  };

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !user?.id) return;

    setUploadingImage(true);
    setError(null);

    try {
      const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels);
      const path = `${user.id}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust para forçar exibição imediata
      const freshUrl = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(freshUrl);
      if (profileId) {
        await supabase.from('basquete_users').update({ avatar_url: freshUrl, updated_at: new Date().toISOString() }).eq('id', profileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar imagem.');
    } finally {
      setUploadingImage(false);
      setCropImageSrc(null);
      setCroppedAreaPixels(null);
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
        city: form.city.trim() || null,
        state: form.state || null,
        country_iso: form.country_iso.trim() || 'BR',
        avatar_url: avatarUrl,
        pro_profile_tagline: isPro ? (proTagline.trim() || null) : null,
        pro_cover_image_url: isPro ? (proCoverImageUrl.trim() || null) : null,
        pro_athlete_resume: isPro ? (proAthleteResume.trim() || null) : null,
        pro_sponsors: isPro
          ? proSponsors
            .map((s) => ({
              name: s.name.trim(),
              logo_url: s.logo_url.trim(),
              link_url: s.link_url.trim(),
            }))
            .filter((s) => s.name || s.logo_url || s.link_url)
          : [],
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

  const handleRegeneratePin = async () => {
    if (!profileId) return;
    const newPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const { error } = await supabase
      .from('basquete_users')
      .update({ admin_pin: newPin })
      .eq('id', profileId);
    if (!error) setAdminPin(newPin);
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

      <div className={cn(
        'rounded-2xl overflow-hidden border',
        darkMode ? 'border-orange-500/30 bg-slate-900' : 'border-orange-200 bg-white'
      )}>
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_55%)]" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className={cn('text-[11px] uppercase font-black tracking-[0.2em]', darkMode ? 'text-orange-300' : 'text-orange-600')}>
                  Perfil PRÓ
                </p>
                <h3 className={cn('text-lg sm:text-xl font-black mt-1', darkMode ? 'text-white' : 'text-slate-900')}>
                  Destaque sua carreira de atleta
                </h3>
              </div>
              <span className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black',
                isPro
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
              )}>
                <Crown className="w-3.5 h-3.5" />
                {isPro ? 'ATIVO' : `R$ ${PRO_PRICE_BRL.toFixed(2).replace('.', ',')}/mês`}
              </span>
            </div>

            <p className={cn('text-sm mb-3', darkMode ? 'text-slate-300' : 'text-slate-600')}>
              Benefícios: 50% de desconto em camps de treinamento, 50% em uniformes oficiais, 2 fotos profissionais por evento, perfil customizado e currículo de atleta integrado.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className={cn('rounded-xl px-3 py-2 border', darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                <span className="font-bold text-orange-400">Eventos/camps:</span> 50% OFF
              </div>
              <div className={cn('rounded-xl px-3 py-2 border', darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                <span className="font-bold text-orange-400">Uniformes:</span> 50% OFF
              </div>
              <div className={cn('rounded-xl px-3 py-2 border', darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                <span className="font-bold text-orange-400">Fotos pró:</span> 2 por evento
              </div>
              <div className={cn('rounded-xl px-3 py-2 border', darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                <span className="font-bold text-orange-400">Currículo:</span> integrado ao perfil
              </div>
            </div>

            {!isPro && (
              <div className={cn(
                'mt-4 rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2',
                darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
              )}>
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-orange-400" />
                <p>
                  Após a confirmação do pagamento, os campos avançados do Perfil PRÓ serão liberados automaticamente neste formulário.
                  {searchParams.get('pro') === 'success' ? ' Pagamento recebido! Atualize a página em alguns segundos caso os campos não apareçam imediatamente.' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

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

        {/* País de origem */}
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            País de origem
          </label>
          <div className="flex items-center gap-3">
            <CountryFlagSvg
              code={form.country_iso}
              className={cn(
                'w-9 h-6 rounded-md shadow-sm shrink-0 overflow-hidden border',
                darkMode ? 'border-slate-600' : 'border-slate-200'
              )}
            />
            <select
              value={form.country_iso}
              onChange={(e) => setForm((f) => ({ ...f, country_iso: e.target.value }))}
              className={cn(
                'flex-1 min-w-0 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            >
              {COUNTRIES_PT_SORTED.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
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

        {isPro && (
          <div className={cn(
            'space-y-6 rounded-2xl border p-4 sm:p-5',
            darkMode ? 'border-orange-500/25 bg-slate-900/80' : 'border-orange-200 bg-orange-50/40'
          )}>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-orange-400" />
              <h3 className={cn('text-sm font-black uppercase tracking-wider', darkMode ? 'text-orange-300' : 'text-orange-600')}>
                Campos exclusivos PRÓ
              </h3>
            </div>

            <div className="space-y-2">
              <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                Frase de destaque do perfil
              </label>
              <input
                type="text"
                value={proTagline}
                onChange={(e) => setProTagline(e.target.value)}
                placeholder="Ex: Armador criativo com foco em leitura de jogo"
                maxLength={120}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
              />
            </div>

            <div className="space-y-2">
              <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                Imagem grande de fundo (URL)
              </label>
              <input
                type="url"
                value={proCoverImageUrl}
                onChange={(e) => setProCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className={cn(
                  'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
              />
            </div>

            <div className="space-y-2">
              <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                Currículo do atleta
              </label>
              <textarea
                value={proAthleteResume}
                onChange={(e) => setProAthleteResume(e.target.value)}
                placeholder="Clubes, títulos, campings, métricas, metas e histórico esportivo..."
                rows={5}
                maxLength={2000}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none',
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
              />
              <p className={cn('text-xs text-right', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                {proAthleteResume.length}/2000
              </p>
            </div>

            <div className="space-y-3">
              <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                Patrocinadores (logo + link)
              </label>
              {proSponsors.map((sponsor, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-xl border p-3 space-y-2',
                    darkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-white'
                  )}
                >
                  <p className={cn('text-xs font-semibold', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Patrocinador {idx + 1}
                  </p>
                  <input
                    type="text"
                    value={sponsor.name}
                    onChange={(e) => setProSponsors((prev) => prev.map((item, i) => i === idx ? { ...item, name: e.target.value } : item))}
                    placeholder="Nome da marca"
                    className={cn(
                      'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    )}
                  />
                  <input
                    type="url"
                    value={sponsor.logo_url}
                    onChange={(e) => setProSponsors((prev) => prev.map((item, i) => i === idx ? { ...item, logo_url: e.target.value } : item))}
                    placeholder="URL da logomarca"
                    className={cn(
                      'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                      darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    )}
                  />
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="url"
                      value={sponsor.link_url}
                      onChange={(e) => setProSponsors((prev) => prev.map((item, i) => i === idx ? { ...item, link_url: e.target.value } : item))}
                      placeholder="URL de redirecionamento"
                      className={cn(
                        'w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50',
                        darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasAdminAccess && (
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
              PIN de Administrador
            </label>
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex-1 px-4 py-3 rounded-xl border text-center text-2xl font-black tracking-[0.3em]',
                darkMode ? 'bg-slate-800/50 border-slate-700 text-orange-400' : 'bg-slate-50 border-slate-200 text-orange-600'
              )}>
                {adminPin ?? '----'}
              </div>
              <button
                type="button"
                onClick={handleRegeneratePin}
                className={cn(
                  'px-4 py-3 rounded-xl font-semibold text-sm transition-colors',
                  darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                )}
              >
                {adminPin ? 'Gerar novo' : 'Gerar PIN'}
              </button>
            </div>
            <p className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
              {adminPin
                ? 'Use este PIN para confirmar ações administrativas. Visível apenas para você.'
                : 'Você ainda não tem PIN salvo. Toque em "Gerar PIN" para criar agora.'}
            </p>
          </div>
        )}

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

      {/* Crop Modal */}
      <AnimatePresence>
        {cropImageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={handleCropCancel}
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <span className="text-white font-semibold text-sm flex items-center gap-2">
                <Crop className="w-4 h-4" /> Recortar foto
              </span>
              <button
                type="button"
                onClick={handleCropConfirm}
                disabled={uploadingImage}
                className={cn(
                  'px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2',
                  uploadingImage
                    ? 'bg-orange-500/50 text-white/70 cursor-wait'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                )}
              >
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Salvar
              </button>
            </div>

            <div className="relative flex-1">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="flex items-center justify-center gap-3 px-6 py-4">
              <ZoomOut className="w-4 h-4 text-white/60 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full max-w-xs accent-orange-500"
              />
              <ZoomIn className="w-4 h-4 text-white/60 shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
