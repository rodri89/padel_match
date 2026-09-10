type DenoServeHandler = (request: Request) => Response | Promise<Response>;

const denoRuntime = (globalThis as typeof globalThis & {
  Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve(handler: DenoServeHandler): unknown;
  };
}).Deno;

const supabaseUrl = denoRuntime.env.get('SUPABASE_URL');
const serviceRoleKey = denoRuntime.env.get('SUPABASE_SERVICE_ROLE_KEY');

type CreateComplexAdminPayload = {
  address?: string;
  city?: string;
  email?: string;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  logoUrl?: string | null;
  name?: string;
  password?: string;
  phone?: string | null;
  province?: string;
};

type AuthUserResponse = {
  id?: string;
  email?: string;
  user?: {
    email?: string;
    id: string;
  };
};

type ComplexRow = {
  id: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function assertEnv() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service environment variables');
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

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validatePayload(payload: CreateComplexAdminPayload) {
  const name = normalizeText(payload.name);
  const email = normalizeText(payload.email)?.toLowerCase();
  const password = payload.password ?? '';
  const address = normalizeText(payload.address);
  const city = normalizeText(payload.city);
  const province = normalizeText(payload.province);

  if (!name) {
    throw new Error('Completá el nombre del complejo.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Completá un mail válido.');
  }

  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  if (!address) {
    throw new Error('Completá la dirección.');
  }

  if (!province || !city) {
    throw new Error('Seleccioná provincia y ciudad.');
  }

  return {
    address,
    city,
    email,
    facebookUrl: normalizeText(payload.facebookUrl),
    instagramUrl: normalizeText(payload.instagramUrl),
    logoUrl: normalizeText(payload.logoUrl),
    name,
    password,
    phone: normalizeText(payload.phone),
    province,
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  errorPrefix: string,
) {
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

async function assertSuperAdmin(userId: string) {
  const profiles = await fetchJson<Array<{ role: string }>>(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=role`,
    {
      headers: getServiceHeaders(),
    },
    'No se pudo validar el rol',
  );

  if (profiles[0]?.role !== 'super_admin') {
    throw new Error('Solo un super admin puede crear admins de complejo.');
  }
}

async function createAuthUser(payload: ReturnType<typeof validatePayload>) {
  const authUser = await fetchJson<AuthUserResponse>(
    `${supabaseUrl}/auth/v1/admin/users`,
    {
      body: JSON.stringify({
        email: payload.email,
        email_confirm: true,
        password: payload.password,
        user_metadata: {
          display_name: payload.name,
        },
      }),
      headers: getServiceHeaders({
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    },
    'No se pudo crear el usuario',
  );

  const userId = authUser.id ?? authUser.user?.id;

  if (!userId) {
    throw new Error('No se pudo obtener el usuario creado.');
  }

  return userId;
}

async function deleteAuthUser(userId: string) {
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: getServiceHeaders(),
    method: 'DELETE',
  });
}

async function upsertAdminProfile(
  userId: string,
  payload: ReturnType<typeof validatePayload>,
) {
  await fetchJson(
    `${supabaseUrl}/rest/v1/profiles?on_conflict=id`,
    {
      body: JSON.stringify({
        city: payload.city,
        display_name: payload.name,
        id: userId,
        phone: payload.phone,
        province: payload.province,
        role: 'admin_complejo',
      }),
      headers: getServiceHeaders({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      }),
      method: 'POST',
    },
    'No se pudo crear el perfil admin',
  );
}

async function createComplex(payload: ReturnType<typeof validatePayload>) {
  const complexes = await fetchJson<ComplexRow[]>(
    `${supabaseUrl}/rest/v1/complexes?select=id`,
    {
      body: JSON.stringify({
        address: payload.address,
        city: payload.city,
        email: payload.email,
        facebook_url: payload.facebookUrl,
        instagram_url: payload.instagramUrl,
        logo_url: payload.logoUrl,
        name: payload.name,
        phone: payload.phone,
        province: payload.province,
      }),
      headers: getServiceHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      method: 'POST',
    },
    'No se pudo crear el complejo',
  );

  const complexId = complexes[0]?.id;

  if (!complexId) {
    throw new Error('No se pudo obtener el complejo creado.');
  }

  return complexId;
}

async function linkAdminToComplex(complexId: string, userId: string) {
  await fetchJson(
    `${supabaseUrl}/rest/v1/complex_admins`,
    {
      body: JSON.stringify({
        complex_id: complexId,
        user_id: userId,
      }),
      headers: getServiceHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      method: 'POST',
    },
    'No se pudo vincular el admin al complejo',
  );
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

    const requesterUserId = await getRequesterUserId(request);
    await assertSuperAdmin(requesterUserId);

    const payload = validatePayload(await request.json());
    const authUserId = await createAuthUser(payload);

    try {
      await upsertAdminProfile(authUserId, payload);
      const complexId = await createComplex(payload);
      await linkAdminToComplex(complexId, authUserId);

      return jsonResponse({
        complexId,
        userId: authUserId,
      });
    } catch (error) {
      await deleteAuthUser(authUserId);
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo crear el admin complejo.';

    return jsonResponse({ error: message }, 400);
  }
});
