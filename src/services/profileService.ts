import { getSupabaseClient } from './supabaseClient';
import type { ProfileUpdatePayload, UserProfile } from '../types/profile';

const PROFILE_PHOTOS_BUCKET = 'profile-photos';
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_PADDING_REGEX = new RegExp('=+$');

async function getCurrentUserId() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('No hay un usuario autenticado.');
  }

  return user.id;
}

export async function getCurrentProfile() {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, avatar_url, role, province, city, sex, player_position, category, phone, dni, birth_date, created_at, updated_at',
    )
    .eq('id', userId)
    .single<UserProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getCurrentUserEmail() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.email ?? null;
}

export async function updateCurrentProfile(payload: ProfileUpdatePayload) {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...payload }, { onConflict: 'id' })
    .select(
      'id, display_name, avatar_url, role, province, city, sex, player_position, category, phone, dni, birth_date, created_at, updated_at',
    )
    .single<UserProfile>();

  if (error) {
    throw error;
  }

  return data;
}

function getExtension(contentType?: string, uri?: string) {
  if (contentType?.includes('png')) {
    return 'png';
  }

  if (contentType?.includes('webp')) {
    return 'webp';
  }

  const uriExtension = uri?.split('.').pop()?.split('?')[0]?.toLowerCase();

  if (uriExtension && ['jpg', 'jpeg', 'png', 'webp'].includes(uriExtension)) {
    return uriExtension === 'jpeg' ? 'jpg' : uriExtension;
  }

  return 'jpg';
}

function base64ToUint8Array(base64: string) {
  const sanitizedBase64 = base64.replace(/\s/g, '');
  const paddingLength = sanitizedBase64.endsWith('==')
    ? 2
    : sanitizedBase64.endsWith('=')
      ? 1
      : 0;
  const cleanBase64 = sanitizedBase64.replace(BASE64_PADDING_REGEX, '');
  const outputLength = Math.floor((sanitizedBase64.length * 3) / 4) - paddingLength;
  const bytes = new Uint8Array(outputLength);
  let index = 0;

  for (let position = 0; position < cleanBase64.length; position += 4) {
    const first = BASE64_CHARS.indexOf(cleanBase64[position]);
    const second = BASE64_CHARS.indexOf(cleanBase64[position + 1]);
    const third = BASE64_CHARS.indexOf(cleanBase64[position + 2] ?? 'A');
    const fourth = BASE64_CHARS.indexOf(cleanBase64[position + 3] ?? 'A');

    if (first < 0 || second < 0 || third < 0 || fourth < 0) {
      continue;
    }

    if (index < outputLength) {
      bytes[index] = first * 4 + Math.floor(second / 16);
      index += 1;
    }

    if (index < outputLength) {
      bytes[index] = (second % 16) * 16 + Math.floor(third / 4);
      index += 1;
    }

    if (index < outputLength) {
      bytes[index] = (third % 4) * 64 + fourth;
      index += 1;
    }
  }

  return bytes;
}

async function getUploadFile(uri: string, base64?: string) {
  if (base64) {
    return base64ToUint8Array(base64);
  }

  const response = await fetch(uri);
  return response.blob();
}

export async function getTotalUsersCount(cities: string[]) {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (cities.length > 0) {
    query = query.in('city', cities);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function uploadProfilePhoto(
  uri: string,
  contentType?: string,
  base64?: string,
) {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  const extension = getExtension(contentType, uri);
  const filePath = `${userId}/avatar-${Date.now()}.${extension}`;
  const file = await getUploadFile(uri, base64);

  const { error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(filePath, file, {
      contentType: contentType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}
