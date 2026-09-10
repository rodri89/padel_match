type DenoServeHandler = (request: Request) => Response | Promise<Response>;

const denoRuntime = (globalThis as typeof globalThis & {
  Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve(handler: DenoServeHandler): unknown;
  };
}).Deno;

type MatchRequestPayload = {
  chatThreadId?: string;
  matchId: string;
  requesterDisplayName: string;
};

type AuthUserResponse = {
  id?: string;
};

type MatchRow = {
  complex_name: string;
  creator_id: string;
  id: string;
};

type PushTokenRow = {
  fcm_token: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const projectId = denoRuntime.env.get('FIREBASE_PROJECT_ID');
const clientEmail = denoRuntime.env.get('FIREBASE_CLIENT_EMAIL');
const privateKey = denoRuntime.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const supabaseUrl = denoRuntime.env.get('SUPABASE_URL');
const serviceRoleKey = denoRuntime.env.get('SUPABASE_SERVICE_ROLE_KEY');
const equalsRegex = new RegExp('=', 'g');
const plusRegex = new RegExp('\\+', 'g');
const slashRegex = new RegExp('/', 'g');

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function assertEnv() {
  if (!projectId || !clientEmail || !privateKey || !supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Firebase or Supabase service environment variables');
  }
}

function getServiceHeaders(extraHeaders?: Record<string, string>) {
  assertEnv();

  return {
    apikey: serviceRoleKey!,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extraHeaders,
  };
}

async function fetchJson<T>(url: string, init: RequestInit, errorPrefix: string) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.msg ?? data?.message ?? data?.error_description ?? data?.error ?? text;
    throw new Error(`${errorPrefix}: ${message || response.statusText}`);
  }

  return data as T;
}

async function getRequesterUserId(request: Request) {
  const authorization = request.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('No hay una sesión válida.');
  }

  const user = await fetchJson<AuthUserResponse>(
    `${supabaseUrl}/auth/v1/user`,
    {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: authorization,
      },
    },
    'No se pudo validar la sesión',
  );

  if (!user.id) {
    throw new Error('No se pudo obtener el usuario de la sesión.');
  }

  return user.id;
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

  if (!response.ok) {
    throw new Error(`No se pudo obtener token FCM: ${JSON.stringify(json)}`);
  }

  return json.access_token as string;
}

function validatePayload(payload: MatchRequestPayload) {
  const matchId = payload.matchId?.trim();
  const requesterDisplayName = payload.requesterDisplayName?.trim();
  const chatThreadId = payload.chatThreadId?.trim();

  if (!matchId) {
    throw new Error('Falta matchId.');
  }

  if (!requesterDisplayName) {
    throw new Error('Falta requesterDisplayName.');
  }

  return {
    chatThreadId: chatThreadId || undefined,
    matchId,
    requesterDisplayName,
  };
}

async function getMatch(matchId: string) {
  const matches = await fetchJson<MatchRow[]>(
    `${supabaseUrl}/rest/v1/matches?id=eq.${matchId}&select=id,creator_id,complex_name`,
    {
      headers: getServiceHeaders(),
    },
    'No se pudo obtener el partido',
  );

  const match = matches[0];

  if (!match) {
    throw new Error('Partido no encontrado.');
  }

  return match;
}

async function getCreatorTokens(creatorId: string) {
  const tokens = await fetchJson<PushTokenRow[]>(
    `${supabaseUrl}/rest/v1/push_tokens?user_id=eq.${creatorId}&revoked_at=is.null&select=fcm_token`,
    {
      headers: getServiceHeaders(),
    },
    'No se pudieron obtener tokens del creador',
  );

  return tokens.map(row => row.fcm_token);
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

async function sendPush({
  accessToken,
  chatThreadId,
  complexName,
  matchId,
  requesterDisplayName,
  token,
}: {
  accessToken: string;
  chatThreadId?: string;
  complexName: string;
  matchId: string;
  requesterDisplayName: string;
  token: string;
}) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      body: JSON.stringify({
        message: {
          // Android se sirve por `data`: la app la muestra vía notifee. Un
          // bloque `notification` de nivel superior haría que Android la
          // auto-mostrara desde la bandeja, duplicándola. iOS se sirve por
          // el bloque `apns` de abajo, que es exclusivo de esa plataforma.
          data: {
            body: `${requesterDisplayName} quiere jugar en ${complexName}`,
            matchId,
            ...(chatThreadId ? { threadId: chatThreadId } : {}),
            title: 'Nueva solicitud para tu partido',
            type: 'match_request',
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
                  body: `${requesterDisplayName} quiere jugar en ${complexName}`,
                  title: 'Nueva solicitud para tu partido',
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
    },
  );

  // El fallo de un token no puede tumbar el envío al resto: se loguea y se
  // devuelve false para contarlo aparte.
  if (!response.ok) {
    const body = await response.text();
    console.error(`Error enviando push: ${response.status} ${body}`);

    if (isUnregisteredTokenError(body)) {
      await revokePushToken(token);
    }

    return false;
  }

  return true;
}

denoRuntime.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    assertEnv();

    const requesterId = await getRequesterUserId(request);
    const payload = validatePayload(await request.json());
    const match = await getMatch(payload.matchId);

    if (match.creator_id === requesterId) {
      return jsonResponse({ sent: 0, skipped: 'creator_is_requester' });
    }

    const tokens = await getCreatorTokens(match.creator_id);

    if (tokens.length === 0) {
      return jsonResponse({ sent: 0, success: true, total: 0 });
    }

    // Un solo access token para todo el lote: antes se firmaba un JWT y se hacía
    // un round-trip de OAuth por cada dispositivo.
    const accessToken = await getAccessToken();
    const results = await Promise.all(
      tokens.map(token =>
        sendPush({
          accessToken,
          chatThreadId: payload.chatThreadId,
          complexName: match.complex_name,
          matchId: match.id,
          requesterDisplayName: payload.requesterDisplayName,
          token,
        }).catch(error => {
          console.error('Error enviando push:', error);
          return false;
        }),
      ),
    );

    return jsonResponse({
      sent: results.filter(Boolean).length,
      success: true,
      total: tokens.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo enviar la notificación.';

    console.error('Fallo enviando la notificación de solicitud:', message);
    return jsonResponse({ error: message }, 500);
  }
});
