import { getSupabaseClient } from './supabaseClient';
import type { AdminUserListItem, AdminUserSearchResult } from '../types/admin';

export async function searchCommonUsers(query: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('search_common_users', {
    search_text: query.trim(),
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminUserSearchResult[];
}

export async function listAllUsers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_all_users');

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminUserListItem[];
}

export async function promoteUserToComplexAdmin(userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('promote_user_to_complex_admin', {
    target_user_id: userId,
  });

  if (error) {
    throw error;
  }
}
