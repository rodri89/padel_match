import type {
  CreateUserPostPayload,
  UserHomePost,
  UserPostRow,
} from '../types/userPost';
import { buildCityOrFilter } from '../utils/cityFilter';
import { getAuthSession } from './authSession';
import { uploadImageToBucket } from './complexService';
import { getSupabaseClient } from './supabaseClient';

const USER_POSTS_BUCKET = 'user-posts';
const HOME_POSTS_MAX_AGE_DAYS = 30;
const HOME_POST_FIELDS =
  'id, author_id, kind, description, image_url, item_name, price, created_at, profiles!inner(display_name, avatar_url, city)';

async function getRequiredSession() {
  const session = await getAuthSession();

  if (!session) {
    throw new Error('No hay un usuario autenticado.');
  }

  return session;
}

function mapUserHomePost(row: UserPostRow): UserHomePost {
  // Postgres devuelve numeric como string para no perder precisión.
  const price = row.price === null ? null : Number(row.price);

  return {
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
    authorId: row.author_id,
    authorName: row.profiles?.display_name ?? 'Usuario',
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    imageUrl: row.image_url,
    itemName: row.item_name,
    kind: row.kind,
    price: price === null || Number.isNaN(price) ? null : price,
  };
}

export async function uploadUserPostImage(
  uri: string,
  contentType?: string,
  base64?: string,
) {
  return uploadImageToBucket({
    base64,
    bucket: USER_POSTS_BUCKET,
    contentType,
    filePrefix: 'user-post',
    uri,
  });
}

export async function createUserPost(payload: CreateUserPostPayload) {
  const session = await getRequiredSession();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('user_posts').insert({
    author_id: session.userId,
    description: payload.description.trim(),
    image_url: payload.imageUrl ?? null,
    item_name: payload.itemName?.trim() || null,
    kind: payload.kind,
    price: payload.price ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function getHomeUserPosts(
  cities: string[],
  options?: { includeAllCities?: boolean },
) {
  const supabase = getSupabaseClient();
  const cutoffDate = new Date(
    Date.now() - HOME_POSTS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let query = supabase
    .from('user_posts')
    .select(HOME_POST_FIELDS)
    .eq('is_active', true)
    .gte('created_at', cutoffDate);

  // Mismo criterio que getHomeComplexPosts: el super admin ve todo el país y,
  // cuando hay filtro, los perfiles sin ciudad cargada no quedan invisibles.
  if (cities.length > 0 && !options?.includeAllCities) {
    query = query.or(buildCityOrFilter(cities), {
      referencedTable: 'profiles',
    });
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .returns<UserPostRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapUserHomePost);
}

export async function deleteUserPost(postId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('user_posts')
    .update({ is_active: false })
    .eq('id', postId);

  if (error) {
    throw error;
  }
}
