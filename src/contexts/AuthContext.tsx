import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

const GUEST_KEY = 'basquete_guest_mode';

async function ensureUserStats(userId: string, displayName: string | null) {
  const normalizedName = displayName?.trim();
  if (!normalizedName) return;

  const { data: existingByUserId } = await supabase
    .from('stats')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingByUserId?.id) return;

  const { data: existingByName } = await supabase
    .from('stats')
    .select('id')
    .eq('name', normalizedName)
    .maybeSingle();

  if (existingByName?.id) {
    await supabase
      .from('stats')
      .update({ user_id: userId })
      .eq('id', existingByName.id);
    return;
  }

  await supabase.from('stats').insert({
    name: normalizedName,
    user_id: userId,
    wins: 0,
    points: 0,
    blocks: 0,
    steals: 0,
    clutch_points: 0,
  });
}

async function syncUserToBasquete(user: User) {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';
  if (!email) return;

  const now = new Date().toISOString();
  const displayName =
    meta.full_name ??
    meta.name ??
    meta.user_name ??
    meta.display_name ??
    email.split('@')[0] ??
    null;

  const { data: byAuth } = await supabase
    .from('basquete_users')
    .select('id, auth_id, display_name')
    .eq('auth_id', user.id)
    .maybeSingle();

  const { data: byEmail } = byAuth
    ? { data: byAuth }
    : await supabase
        .from('basquete_users')
        .select('id, auth_id, display_name')
        .eq('email', email)
        .maybeSingle();
  const existing = byAuth ?? byEmail;
  let basqueteUserId: string | null = existing?.id ?? null;
  let statsName = existing?.display_name ?? displayName;

  if (existing?.id) {
    await supabase
      .from('basquete_users')
      .update({
        auth_id: existing.auth_id ?? user.id,
        display_name: existing.display_name ?? displayName,
        updated_at: now,
      })
      .eq('id', existing.id);
  } else {
    const { data: insertedUser } = await supabase
      .from('basquete_users')
      .insert({
      auth_id: user.id,
      email,
      display_name: displayName,
      updated_at: now,
      })
      .select('id, display_name')
      .single();

    basqueteUserId = insertedUser?.id ?? null;
    statsName = insertedUser?.display_name ?? displayName;
  }

  if (basqueteUserId) {
    await ensureUserStats(basqueteUserId, statsName);
  }
}

type AuthState = {
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  enterAsGuest: () => void;
  leaveGuestMode: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedGuest = localStorage.getItem(GUEST_KEY) === 'true';
    setIsGuest(storedGuest);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        localStorage.removeItem(GUEST_KEY);
        setIsGuest(false);
        syncUserToBasquete(session.user);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        localStorage.removeItem(GUEST_KEY);
        setIsGuest(false);
        // Gravar/corrigir usuário em basquete_users ao autenticar (cadastro ou login)
        syncUserToBasquete(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem(GUEST_KEY);
  };

  const enterAsGuest = () => {
    localStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
  };

  const leaveGuestMode = () => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  };

  const value: AuthContextValue = {
    session,
    user,
    isGuest,
    loading,
    signIn,
    signUp,
    signOut,
    enterAsGuest,
    leaveGuestMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
