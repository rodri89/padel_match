type DenoServeHandler = (request: Request) => Response | Promise<Response>;

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: DenoServeHandler): unknown;
};

type MatchCreatedPayload = {
  matchId: string;
};

type MatchRow = {
  city: string;
  complex_name: string;
  creator_id: string;
  id: string;
  match_date: string;
  province: string | null;
  start_time: string;
  target_categories: number[];
};

type ProfileRow = {
  id: string;
};

type PreferenceRow = {
  user_id: string;
  visible_categories: number[];
};

type AvailabilityRow = {
  day_of_week: number;
  end_time: string;
  start_time: string;
  user_id: string;
};

type PushTokenRow = {
  fcm_token: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const equalsRegex = new RegExp('=', 'g');
const plusRegex = new RegExp('\\+', 'g');
const slashRegex = new RegExp('/', 'g');

function assertEnv() {
  if (!projectId || !clientEmail || !privateKey || !supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Firebase or Supabase service environment variables');
  }
}

function getServiceHeaders() {
  assertEnv();

  return {
    apikey: serviceRoleKey!,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

// FCM devuelve UNREGISTERED / NotRegistered cuando el token ya no existe (app
// desinstalada, token rotado). Sin esto el token muerto se reintenta para
// siempre y ensucia cada envío. register_push_token vuelve a poner revoked_at
// en null si el dispositivo se registra de nuevo, así que es auto-corregible.
function isUnregisteredTokenError(responseBody: string) {
  return (
    responseBody.includes('UNREGISTERED') || responseBody.includes('NotRegistered')
  );
}

async function revokePushToken(token: string) {
  try {
    await fetch(
      `${supabaseUrl}/rest/v1/push_tokens?fcm_token=eq.${encodeURIComponent(token)}`,
      {
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        headers: {
          ...getServiceHeaders(),
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      },
    );
    console.log('Token de push revocado por estar dado de baja en FCM.');
  } catch (error) {
    console.error('No se pudo revocar el token de push:', error);
  }
}

async function getAccessToken() {
  assertEnv();

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encoder = new TextEncoder();
  const base64url = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(equalsRegex, '')
      .replace(plusRegex, '-')
      .replace(slashRegex, '_');

  const unsignedToken = `${base64url(header)}.${base64url(claimSet)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey!),
    { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(unsignedToken),
  );
  const jwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      assertion: jwt,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  const json = await response.json();
  return json.access_token as string;
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(equalsRegex, '')
    .replace(plusRegex, '-')
    .replace(slashRegex, '_');
}

function getIsoDayOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function hasCategoryOverlap(first: number[], second: number[]) {
  return first.some(category => second.includes(category));
}

async function fetchJson<T>(path: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: getServiceHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as T;
}

async function getMatch(matchId: string) {
  const matches = await fetchJson<MatchRow[]>(
    `matches?id=eq.${matchId}&select=id,creator_id,city,province,complex_name,match_date,start_time,target_categories`,
  );

  return matches[0];
}

async function getEligibleUserIds(match: MatchRow) {
  const encodedCity = encodeURIComponent(match.city);
  const profilePath = match.province
    ? `profiles?city=eq.${encodedCity}&province=eq.${encodeURIComponent(match.province)}&id=neq.${match.creator_id}&select=id`
    : `profiles?city=eq.${encodedCity}&id=neq.${match.creator_id}&select=id`;
  const profiles = await fetchJson<ProfileRow[]>(profilePath);
  const candidateIds = profiles.map(profile => profile.id);

  if (!candidateIds.length) {
    return [];
  }

  const idsFilter = candidateIds.join(',');
  const [preferences, availability] = await Promise.all([
    fetchJson<PreferenceRow[]>(
      `player_match_preferences?user_id=in.(${idsFilter})&select=user_id,visible_categories`,
    ),
    fetchJson<AvailabilityRow[]>(
      `player_availability?user_id=in.(${idsFilter})&day_of_week=eq.${getIsoDayOfWeek(match.match_date)}&select=user_id,day_of_week,start_time,end_time`,
    ),
  ]);

  const preferencesByUser = new Map(
    preferences.map(preference => [preference.user_id, preference.visible_categories]),
  );
  const matchStartTime = normalizeTime(match.start_time);

  return candidateIds.filter(userId => {
    const visibleCategories = preferencesByUser.get(userId) ?? [];
    const hasValidCategory = hasCategoryOverlap(
      visibleCategories,
      match.target_categories,
    );
    const hasValidAvailability = availability.some(
      slot =>
        slot.user_id === userId &&
        normalizeTime(slot.start_time) <= matchStartTime &&
        normalizeTime(slot.end_time) >= matchStartTime,
    );

    return hasValidCategory && hasValidAvailability;
  });
}

async function getRecipientTokens(userIds: string[]) {
  if (!userIds.length) {
    return [];
  }

  const tokenResponse = await fetch(
    `${supabaseUrl}/rest/v1/push_tokens?user_id=in.(${userIds.join(',')})&revoked_at=is.null&select=fcm_token`,
    {
      headers: getServiceHeaders(),
    },
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Push token request failed: ${tokenResponse.status} ${errorText}`);
  }

  return ((await tokenResponse.json()) as PushTokenRow[])
    .map(row => row.fcm_token)
    .filter(Boolean);
}

Deno.serve(async request => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders,
      });
    }

    const payload = (await request.json()) as MatchCreatedPayload;
    console.log('Match push payload:', payload);

    if (!payload.matchId) {
      throw new Error('Payload inválido: falta matchId');
    }

    const match = await getMatch(payload.matchId);

    if (!match) {
      return new Response(JSON.stringify({ sent: 0, success: false }), {
        headers: corsHeaders,
        status: 404,
      });
    }

    const userIds = await getEligibleUserIds(match);
    console.log(`Eligible users: ${userIds.length}`);

    if (!userIds.length) {
      return new Response(
        JSON.stringify({
          eligible: 0,
          message: 'No hay jugadores elegibles para este partido',
          sent: 0,
          success: true,
        }),
        {
          headers: corsHeaders,
          status: 200,
        },
      );
    }

    const tokens = await getRecipientTokens(userIds);
    console.log(`Push tokens: ${tokens.length}`);

    if (!tokens.length) {
      return new Response(
        JSON.stringify({
          eligible: userIds.length,
          message: 'Hay jugadores elegibles pero no tienen tokens activos',
          sent: 0,
          success: true,
        }),
        {
          headers: corsHeaders,
          status: 200,
        },
      );
    }

    const accessToken = await getAccessToken();
    const results = await Promise.all(
      tokens.map(token =>
        fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          body: JSON.stringify({
            message: {
              // Android se sirve por `data`: la app la muestra vía notifee. Un
              // bloque `notification` de nivel superior haría que Android la
              // auto-mostrara desde la bandeja, duplicándola. iOS se sirve por
              // el bloque `apns` de abajo, que es exclusivo de esa plataforma.
              data: {
                body: `${match.complex_name} - ${match.match_date} ${normalizeTime(match.start_time)} hs`,
                matchId: match.id,
                title: 'Nuevo partido disponible',
                type: 'match_created',
              },
              // Sin esto Android trata el mensaje data-only como prioridad
              // "normal": lo encola en Doze/App Standby y nunca despierta al
              // headless handler, así que la notificación no se muestra jamás.
              android: {
                priority: 'high',
              },
              // iOS necesita un `alert` real. Con sólo `content-available` el
              // push es silencioso: no muestra nada, iOS lo throttlea y no lo
              // entrega si el usuario cerró la app desde el selector.
              apns: {
                headers: {
                  'apns-priority': '10',
                  'apns-push-type': 'alert',
                },
                payload: {
                  aps: {
                    alert: {
                      body: `${match.complex_name} - ${match.match_date} ${normalizeTime(match.start_time)} hs`,
                      title: 'Nuevo partido disponible',
                    },
                    sound: 'default',
                  },
                },
              },
              token,
            },
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })
          .then(async response => {
            if (!response.ok) {
              const body = await response.text();
              console.error(`Error enviando push: ${response.status} ${body}`);

              if (isUnregisteredTokenError(body)) {
                await revokePushToken(token);
              }

              return null;
            }

            return response.json();
          })
          .catch(error => {
            console.error('Error enviando push:', error);
            return null;
          }),
      ),
    );
    const sent = results.filter(Boolean).length;

    return new Response(
      JSON.stringify({
        eligible: userIds.length,
        sent,
        success: true,
        total: tokens.length,
      }),
      {
        headers: corsHeaders,
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error en send-match-created-push:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        headers: corsHeaders,
        status: 500,
      },
    );
  }
});
