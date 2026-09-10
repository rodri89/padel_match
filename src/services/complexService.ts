import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase';
import type {
  Complex,
  ComplexHomePost,
  ComplexOption,
  ComplexPost,
  ComplexPostRow,
  ComplexPostWithComplexName,
  CreateComplexAdminPayload,
  CreateComplexAdminResult,
  CreateComplexPostPayload,
  UpdateComplexPostPayload,
} from '../types/complex';
import { buildCityOrFilter } from '../utils/cityFilter';
import { getAuthSession } from './authSession';
import { getSupabaseClient } from './supabaseClient';

const COMPLEX_LOGOS_BUCKET = 'complex-logos';
const COMPLEX_POSTS_BUCKET = 'complex-posts';
const CREATE_COMPLEX_ADMIN_FUNCTION = 'dynamic-api';
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_PADDING_REGEX = new RegExp('=+$');

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

async function getRequiredSession() {
  const session = await getAuthSession();

  if (!session) {
    throw new Error('No hay un usuario autenticado.');
  }

  return session;
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

export async function uploadImageToBucket({
  base64,
  bucket,
  contentType,
  filePrefix,
  uri,
}: {
  base64?: string;
  bucket: string;
  contentType?: string;
  filePrefix: string;
  uri: string;
}) {
  const supabase = getSupabaseClient();
  const session = await getRequiredSession();
  const extension = getExtension(contentType, uri);
  const filePath = `${session.userId}/${filePrefix}-${Date.now()}.${extension}`;
  const file = await getUploadFile(uri, base64);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: contentType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function uploadComplexLogo(
  uri: string,
  contentType?: string,
  base64?: string,
) {
  return uploadImageToBucket({
    base64,
    bucket: COMPLEX_LOGOS_BUCKET,
    contentType,
    filePrefix: 'complex-logo',
    uri,
  });
}

export async function uploadComplexPostImage(
  uri: string,
  contentType?: string,
  base64?: string,
) {
  return uploadImageToBucket({
    base64,
    bucket: COMPLEX_POSTS_BUCKET,
    contentType,
    filePrefix: 'post',
    uri,
  });
}

export async function createComplexAdmin(payload: CreateComplexAdminPayload) {
  const session = await getRequiredSession();
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${CREATE_COMPLEX_ADMIN_FUNCTION}`,
    {
      body: JSON.stringify(payload),
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(
      data?.error ??
      data?.message ??
      `No se pudo crear el admin complejo (${response.status}).`,
    );
  }

  return data as CreateComplexAdminResult;
}

export async function getCurrentAdminComplex() {
  const session = await getRequiredSession();
  const supabase = getSupabaseClient();
  const { data: adminLink, error: linkError } = await supabase
    .from('complex_admins')
    .select('complex_id')
    .eq('user_id', session.userId)
    .limit(1)
    .maybeSingle<{ complex_id: string }>();

  if (linkError) {
    throw linkError;
  }

  if (!adminLink) {
    return null;
  }

  const { data: complex, error: complexError } = await supabase
    .from('complexes')
    .select(
      'id, name, email, phone, instagram_url, facebook_url, logo_url, address, city, province, created_at, updated_at',
    )
    .eq('id', adminLink.complex_id)
    .single<Complex>();

  if (complexError) {
    throw complexError;
  }

  return complex;
}

export async function listComplexes() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('complexes')
    .select('id, name')
    .order('name')
    .returns<ComplexOption[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

function mapHomePost(row: ComplexPostRow): ComplexHomePost {
  return {
    complexId: row.complex_id,
    complexName: row.complexes?.name ?? 'PadelMatch',
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    imageUrl: row.image_url,
    whatsapp: row.complexes?.phone ?? null,
  };
}

export async function createComplexPost(payload: CreateComplexPostPayload) {
  const session = await getRequiredSession();
  const supabase = getSupabaseClient();
  let complexId = payload.complexId;

  if (complexId === undefined) {
    const adminComplex = await getCurrentAdminComplex();

    if (!adminComplex) {
      throw new Error('No tenés un complejo asociado para publicar fotos.');
    }

    complexId = adminComplex.id;
  }

  const { error } = await supabase.from('complex_posts').insert({
    admin_id: session.userId,
    complex_id: complexId,
    description: payload.description.trim(),
    image_url: payload.imageUrl,
  });

  if (error) {
    throw error;
  }
}

export async function getCurrentAdminComplexPosts() {
  const supabase = getSupabaseClient();
  const adminComplex = await getCurrentAdminComplex();

  if (!adminComplex) {
    return [];
  }

  const { data, error } = await supabase
    .from('complex_posts')
    .select(
      'id, complex_id, admin_id, image_url, description, is_active, created_at, updated_at',
    )
    .eq('complex_id', adminComplex.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<ComplexPost[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getAllComplexPosts() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('complex_posts')
    .select(
      'id, complex_id, admin_id, image_url, description, is_active, created_at, updated_at, complexes(name)',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<(ComplexPost & { complexes: { name: string } | null })[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map<ComplexPostWithComplexName>(row => ({
    admin_id: row.admin_id,
    complex_id: row.complex_id,
    complexName: row.complexes?.name ?? null,
    created_at: row.created_at,
    description: row.description,
    id: row.id,
    image_url: row.image_url,
    is_active: row.is_active,
    updated_at: row.updated_at,
  }));
}

export async function updateComplexPost(
  postId: string,
  payload: UpdateComplexPostPayload,
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('complex_posts')
    .update({
      description: payload.description.trim(),
      image_url: payload.imageUrl,
    })
    .eq('id', postId);

  if (error) {
    throw error;
  }
}

export async function deleteComplexPost(postId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('complex_posts')
    .update({ is_active: false })
    .eq('id', postId);

  if (error) {
    throw error;
  }
}

const HOME_POSTS_MAX_AGE_DAYS = 30;

export async function getHomeComplexPosts(
  cities: string[],
  options?: { includeAllCities?: boolean },
) {
  const supabase = getSupabaseClient();
  const cutoffDate = new Date(
    Date.now() - HOME_POSTS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let complexPostsQuery = supabase
    .from('complex_posts')
    .select(
      'id, complex_id, image_url, description, created_at, complexes!inner(name, phone, city)',
    )
    .eq('is_active', true)
    .gte('created_at', cutoffDate);

  // El super_admin publica para cualquier complejo del país, así que filtrarle
  // por la ciudad de su perfil le esconde sus propias publicaciones.
  if (cities.length > 0 && !options?.includeAllCities) {
    complexPostsQuery = complexPostsQuery.or(buildCityOrFilter(cities), {
      referencedTable: 'complexes',
    });
  }

  complexPostsQuery = complexPostsQuery.order('created_at', { ascending: false });

  // Posts sin complejo asociado (publicados por super_admin) se muestran a todos,
  // sin importar la ciudad.
  const generalPostsQuery = supabase
    .from('complex_posts')
    .select('id, complex_id, image_url, description, created_at')
    .eq('is_active', true)
    .is('complex_id', null)
    .gte('created_at', cutoffDate)
    .order('created_at', { ascending: false });

  const [complexPostsResult, generalPostsResult] = await Promise.all([
    complexPostsQuery.returns<ComplexPostRow[]>(),
    generalPostsQuery.returns<ComplexPostRow[]>(),
  ]);

  if (complexPostsResult.error) {
    throw complexPostsResult.error;
  }

  if (generalPostsResult.error) {
    throw generalPostsResult.error;
  }

  const posts = [
    ...(complexPostsResult.data ?? []),
    ...(generalPostsResult.data ?? []),
  ].map(mapHomePost);

  posts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return posts;
}
