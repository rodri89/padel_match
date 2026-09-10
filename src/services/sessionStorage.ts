import {
  clearAuthSession,
  getAuthSession,
} from './authSession';

export async function getSessionToken() {
  const session = await getAuthSession();

  return session?.token ?? null;
}

export async function saveMockSession() {
  throw new Error('Mock sessions were replaced by Supabase Auth.');
}

export async function clearSession() {
  await clearAuthSession();
}
