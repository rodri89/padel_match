import type { Session, User } from '@supabase/supabase-js';

import type { AuthSession } from '../types/session';
import { isSupabaseConfigured } from '../config/supabase';
import { getSupabaseClient } from './supabaseClient';

function getDisplayName(user: User) {
  const metadata = user.user_metadata;

  return (
    metadata?.display_name ??
    metadata?.full_name ??
    metadata?.name ??
    user.email ??
    'Usuario'
  );
}

function mapSupabaseSession(session: Session | null): AuthSession | null {
  if (!session) {
    return null;
  }

  return {
    displayName: getDisplayName(session.user),
    token: session.access_token,
    userId: session.user.id,
  };
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return mapSupabaseSession(data.session);
}

export async function clearAuthSession() {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  return mapSupabaseSession(data.session);
}

export async function signUpWithPassword(
  fullName: string,
  email: string,
  password: string,
) {
  const supabase = getSupabaseClient();
  const displayName = fullName.trim() || email.trim();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    options: {
      data: {
        display_name: displayName,
        full_name: displayName,
      },
    },
    password,
  });

  if (error) {
    throw error;
  }

  return mapSupabaseSession(data.session);
}
