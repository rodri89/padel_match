import { getAuthSession } from './authSession';
import { createChatThread, sendChatMessage } from './chatService';
import { getSelectedCities } from './citySettingsService';
import { getCurrentMatchPreferences } from './matchPreferencesService';
import { getCurrentProfile } from './profileService';
import { getCurrentAdminComplex } from './complexService';
import { getSupabaseClient } from './supabaseClient';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase';
import type {
  CreateMatchPayload,
  CreateMatchResult,
  Match,
  MatchRequest,
  MatchRequestRow,
  MatchRow,
} from '../types/match';

export type MatchVisibilityScope = 'all' | 'preferred';

function dateFromIso(value?: string | null) {
  return value ? new Date(value) : undefined;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function getIsoDayOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function hasCategoryOverlap(first: number[], second: number[]) {
  return first.some(category => second.includes(category));
}

function getTodayDateString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${today.getFullYear()}-${month}-${day}`;
}

function mapRequest(row: MatchRequestRow, avatarUrlMap: Record<string, string | null> = {}): MatchRequest {
  return {
    chatThreadId: row.chat_thread_id ?? undefined,
    createdAt: dateFromIso(row.created_at),
    id: row.id,
    requesterAvatarUrl: avatarUrlMap[row.requester_id] ?? undefined,
    requesterDisplayName: row.requester_display_name,
    requesterId: row.requester_id,
    status: row.status,
  };
}

function mapMatch(row: MatchRow, currentUserId: string, avatarUrlMap: Record<string, string | null> = {}): Match {
  const requests = row.match_requests?.map(r => mapRequest(r, avatarUrlMap)) ?? [];

  return {
    city: row.city,
    complexName: row.complex_name,
    confirmedRequests: requests.filter(request => request.status === 'confirmed'),
    createdAt: dateFromIso(row.created_at),
    creatorAvatarUrl: avatarUrlMap[row.creator_id] ?? undefined,
    creatorDisplayName: row.creator_display_name,
    creatorId: row.creator_id,
    currentUserRequest: requests.find(request => request.requesterId === currentUserId),
    id: row.id,
    isCreator: row.creator_id === currentUserId,
    matchDate: row.match_date,
    matchType: row.match_type ?? 'libre',
    missingPlayers: row.missing_players,
    pendingRequests: requests.filter(request => request.status === 'pending'),
    province: row.province ?? undefined,
    startTime: normalizeTime(row.start_time),
    status: row.status,
    targetCategories: row.target_categories,
  };
}

async function getProfileAvatarUrlMap(userIds: string[]) {
  if (userIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(userIds)];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', uniqueIds)
    .returns<{ id: string; avatar_url: string | null }[]>();

  if (error) {
    return {};
  }

  const map: Record<string, string | null> = {};
  for (const profile of data ?? []) {
    map[profile.id] = profile.avatar_url;
  }

  return map;
}

async function getRequiredSession() {
  const session = await getAuthSession();

  if (!session) {
    throw new Error('No hay un usuario autenticado.');
  }

  return session;
}

function isRelatedMatch(match: Match) {
  return (
    match.currentUserRequest?.status === 'pending' ||
    match.currentUserRequest?.status === 'confirmed'
  );
}

function isSameLocationMatch(
  match: Match,
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  selectedCities: string[],
) {
  // Al elegir ciudades a mano el usuario puede cruzar provincias, así que exigir
  // que la provincia coincida con la de su perfil le escondería justo lo que
  // pidió ver. Sin selección se mantiene el criterio ciudad + provincia.
  if (selectedCities.length > 0) {
    return selectedCities.includes(match.city);
  }

  const sameCity = Boolean(profile.city) && profile.city === match.city;
  const sameProvince = (profile.province ?? '') === (match.province ?? '');

  return sameCity && sameProvince;
}

async function getReadableMatches(scope: MatchVisibilityScope = 'all') {
  const session = await getRequiredSession();
  const supabase = getSupabaseClient();
  const [profile, preferences, selectedCities, matchesResult] = await Promise.all([
    getCurrentProfile(),
    getCurrentMatchPreferences(),
    getSelectedCities(),
    supabase
      .from('matches')
      .select(
        'id, creator_id, creator_display_name, city, province, complex_name, match_date, match_type, start_time, missing_players, target_categories, status, created_at, match_requests(id, requester_id, requester_display_name, chat_thread_id, status, created_at)',
      )
      .order('match_date', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<MatchRow[]>(),
  ]);

  if (matchesResult.error) {
    throw matchesResult.error;
  }

  const rows = matchesResult.data ?? [];

  const creatorIds = [...new Set(rows.map(row => row.creator_id))];
  const requesterIds = rows.flatMap(row =>
    (row.match_requests ?? []).map(req => req.requester_id),
  );
  const allUserIds = [...creatorIds, ...requesterIds];
  const avatarUrlMap = await getProfileAvatarUrlMap(allUserIds);
  return rows
    .map(row => mapMatch(row, session.userId, avatarUrlMap))
    .filter(match => {
      if (match.isCreator) {
        return true;
      }

      if (isRelatedMatch(match)) {
        return true;
      }

      const sameLocation = isSameLocationMatch(match, profile, selectedCities);

      if (scope === 'all') {
        return sameLocation;
      }

      const hasValidCategory = hasCategoryOverlap(
        preferences.visibleCategories,
        match.targetCategories,
      );
      const hasValidAvailability = preferences.availability.some(
        slot =>
          slot.day_of_week === getIsoDayOfWeek(match.matchDate) &&
          slot.start_time <= match.startTime &&
          slot.end_time >= match.startTime,
      );

      return (
        match.status === 'open' &&
        sameLocation &&
        hasValidCategory &&
        hasValidAvailability
      );
    });
}

export async function getVisibleMatches(scope: MatchVisibilityScope = 'all') {
  const today = getTodayDateString();
  const matches = await getReadableMatches(scope);

  return matches.filter(match => match.status !== 'cancelled' && match.matchDate >= today);
}

export async function getMatchHistory() {
  const today = getTodayDateString();
  const matches = await getReadableMatches('all');

  return matches.filter(match => match.status === 'cancelled' || match.matchDate < today);
}

export async function createMatch(payload: CreateMatchPayload): Promise<CreateMatchResult> {
  const session = await getRequiredSession();
  const profile = await getCurrentProfile();

  if (!profile.city) {
    throw new Error('Completá tu ciudad en el perfil antes de crear un partido.');
  }

  let complexName = payload.complexName.trim();

  if (profile.role === 'admin_complejo') {
    const adminComplex = await getCurrentAdminComplex();

    if (!adminComplex) {
      throw new Error('No tenés un complejo asociado para crear partidos.');
    }

    complexName = adminComplex.name;
  }

  if (!complexName) {
    throw new Error('Completá el complejo.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('matches')
    .insert({
      city: profile.city,
      complex_name: complexName,
      creator_display_name: profile.display_name || session.displayName,
      creator_id: session.userId,
      match_date: payload.matchDate,
      match_type: payload.matchType,
      missing_players: payload.missingPlayers,
      province: profile.province,
      start_time: payload.startTime,
      target_categories: payload.targetCategories,
    })
    .select(
      'id, creator_id, creator_display_name, city, province, complex_name, match_date, match_type, start_time, missing_players, target_categories, status, created_at, match_requests(id, requester_id, requester_display_name, chat_thread_id, status, created_at)',
    )
    .single<MatchRow>();

  if (error) {
    throw error;
  }

  let notificationWarning: string | undefined;

  try {
    const notificationData = await notifyMatchCreated(data.id, session.token);

    if (
      notificationData &&
      typeof notificationData === 'object' &&
      'success' in notificationData &&
      notificationData.success === false
    ) {
      notificationWarning = 'El partido se creó, pero la función de notificación falló.';
    }
  } catch (notificationError) {
    notificationWarning =
      notificationError instanceof Error
        ? `El partido se creó, pero no se pudo enviar la notificación: ${notificationError.message}`
        : 'El partido se creó, pero la función de notificación no está disponible.';
  }

  return {
    match: mapMatch(data, session.userId),
    notificationWarning,
  };
}

async function getExistingRequest(matchId: string, requesterId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('match_requests')
    .select('id, requester_id, requester_display_name, chat_thread_id, status, created_at')
    .eq('match_id', matchId)
    .eq('requester_id', requesterId)
    .maybeSingle<MatchRequestRow>();

  if (error) {
    throw error;
  }

  return data ? mapRequest(data) : undefined;
}

export async function requestToPlay(match: Match) {
  const session = await getRequiredSession();

  if (match.creatorId === session.userId) {
    throw new Error('No podés solicitar jugar tu propio partido.');
  }

  const existingRequest = await getExistingRequest(match.id, session.userId);

  if (existingRequest?.chatThreadId) {
    return existingRequest.chatThreadId;
  }

  const profile = await getCurrentProfile();
  const requesterDisplayName = profile.display_name || session.displayName;
  const threadId = await createChatThread({
    contextId: match.id,
    contextType: 'match',
    participantIds: [match.creatorId],
    participantNames: {
      [match.creatorId]: match.creatorDisplayName,
    },
  });

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('match_requests').upsert(
    {
      chat_thread_id: threadId,
      match_id: match.id,
      requester_display_name: requesterDisplayName,
      requester_id: session.userId,
      status: 'pending',
    },
    {
      onConflict: 'match_id,requester_id',
    },
  );

  if (error) {
    throw error;
  }

  try {
    await notifyMatchRequestCreated({
      chatThreadId: threadId,
      matchId: match.id,
      requesterDisplayName,
      token: session.token,
    });
  } catch (notificationError) {
    // La solicitud y el chat ya se crearon; el push no debe bloquear el flujo.
    console.error('No se pudo enviar la notificación de solicitud de partido:', notificationError);
  }

  return threadId;
}

type ConfirmRejectResult = {
  chat_thread_id?: string | null;
  match_id: string;
  requester_display_name: string;
};

const NOTIFICATION_TIMEOUT_MS = 10000;

// Estas llamadas se hacen DESPUÉS de insertar el partido. Sin timeout, en una
// conexión mala la promesa nunca resuelve y el botón queda girando aunque el
// partido ya se haya creado.
async function fetchNotification(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La notificación tardó demasiado y se canceló.');
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function notifyMatchCreated(matchId: string, token: string) {
  const response = await fetchNotification(`${SUPABASE_URL}/functions/v1/send-match-created-push`, {
    body: JSON.stringify({ matchId }),
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseText || response.statusText}`);
  }

  return responseText ? JSON.parse(responseText) : undefined;
}

async function notifyMatchRequestCreated({
  chatThreadId,
  matchId,
  requesterDisplayName,
  token,
}: {
  chatThreadId: string;
  matchId: string;
  requesterDisplayName: string;
  token: string;
}) {
  const response = await fetchNotification(`${SUPABASE_URL}/functions/v1/send-match-request-push`, {
    body: JSON.stringify({
      chatThreadId,
      matchId,
      requesterDisplayName,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseText || response.statusText}`);
  }

  return responseText ? JSON.parse(responseText) : undefined;
}

async function sendAutomaticRequestMessage(
  threadId: string | undefined | null,
  text: string,
) {
  const session = await getRequiredSession();

  if (threadId) {
    await sendChatMessage(threadId, text, session);
  }
}

export async function confirmMatchRequest(requestId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('confirm_match_request', {
    input_request_id: requestId,
  });

  if (error) {
    throw error;
  }

  const result = (data as ConfirmRejectResult[] | null)?.[0];

  if (result) {
    await sendAutomaticRequestMessage(
      result.chat_thread_id,
      `Confirmé a ${result.requester_display_name} para este partido.`,
    );
  }
}

export async function rejectMatchRequest(requestId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('reject_match_request', {
    input_request_id: requestId,
  });

  if (error) {
    throw error;
  }

  const result = (data as ConfirmRejectResult[] | null)?.[0];

  if (result) {
    await sendAutomaticRequestMessage(
      result.chat_thread_id,
      `No puedo confirmar a ${result.requester_display_name} para este partido.`,
    );
  }
}

export async function cancelMatch(matchId: string) {
  const session = await getRequiredSession();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId)
    .eq('creator_id', session.userId);

  if (error) {
    throw error;
  }
}

export async function completeMatch(matchId: string) {
  const session = await getRequiredSession();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('matches')
    .update({
      missing_players: 0,
      status: 'full',
    })
    .eq('id', matchId)
    .eq('creator_id', session.userId);

  if (error) {
    throw error;
  }
}
