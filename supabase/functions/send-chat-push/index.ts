type DenoServeHandler = (request: Request) => Response | Promise<Response>;

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: DenoServeHandler): unknown;
};

type ChatMessagePayload = {
  record: {
    id: string;
    sender_id: string;
    text: string;
    thread_id: string;
  };
};

type PushTokenRow = {
  fcm_token: string;
};

const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// This function is meant to be invoked only by a Supabase Database Webhook on
// chat_messages inserts (deployed with --no-verify-jwt, since webhooks don't
// send a user JWT). Set this secret both here and as a custom header on the
// webhook config to stop anyone else who finds the URL from spamming pushes.
const webhookSecret = Deno.env.get('CHAT_PUSH_WEBHOOK_SECRET');
const equalsRegex = new RegExp('=', 'g');
const plusRegex = new RegExp('\\+', 'g');
const slashRegex = new RegExp('/', 'g');

function assertEnv() {
  if (!projectId || !clientEmail || !privateKey || !supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Firebase or Supabase service environment variables');
  }
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
          apikey: serviceRoleKey!,
          Authorization: `Bearer ${serviceRoleKey}`,
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

async function getRecipientTokens(threadId: string, senderId: string) {
  assertEnv();

  const participantResponse = await fetch(
    `${supabaseUrl}/rest/v1/chat_thread_participants?thread_id=eq.${threadId}&user_id=neq.${senderId}&select=user_id`,
    {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  const participants = (await participantResponse.json()) as Array<{ user_id: string }>;
  const userIds = participants.map(participant => participant.user_id);

  if (!userIds.length) {
    return [];
  }

  const tokenResponse = await fetch(
    `${supabaseUrl}/rest/v1/push_tokens?user_id=in.(${userIds.join(',')})&revoked_at=is.null&select=fcm_token`,
    {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  return ((await tokenResponse.json()) as PushTokenRow[]).map(row => row.fcm_token);
}

Deno.serve(async request => {
  if (webhookSecret && request.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const payload = (await request.json()) as ChatMessagePayload;
  const tokens = await getRecipientTokens(
    payload.record.thread_id,
    payload.record.sender_id,
  );
  const accessToken = await getAccessToken();

  await Promise.all(
    tokens.map(token =>
      fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        body: JSON.stringify({
          message: {
            // Android se sirve por `data`: la app la muestra vía notifee (ver
            // displayForegroundNotification en src/services/firebaseMessaging.ts).
            // Un bloque `notification` de nivel superior haría que Android la
            // auto-mostrara desde la bandeja *además* de la que muestra la app,
            // duplicándola. iOS se sirve por el bloque `apns` de abajo, que es
            // exclusivo de esa plataforma.
            data: {
              body: payload.record.text,
              threadId: payload.record.thread_id,
              title: 'Nuevo mensaje',
              type: 'chat_message',
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
                    body: payload.record.text,
                    title: 'Nuevo mensaje',
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
      }).then(async response => {
        if (!response.ok) {
          const body = await response.text();
          console.error(`Error enviando push de chat: ${response.status} ${body}`);

          if (isUnregisteredTokenError(body)) {
            await revokePushToken(token);
          }
        }
      }),
    ),
  );

  return new Response(JSON.stringify({ sent: tokens.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
