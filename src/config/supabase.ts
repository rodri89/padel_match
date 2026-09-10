export const SUPABASE_URL = 'https://qmvdmcgkdfktuswdgjmi.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_B2Go_qqgulWQb5-g4Cq73A_pHRcBOeV';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}