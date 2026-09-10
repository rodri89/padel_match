import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '../config/supabase';

let client: SupabaseClient | null = null;

const REQUEST_TIMEOUT_MS = 15000;

// Sin esto una consulta puede quedar colgada para siempre en una conexión
// celular mala: el spinner del botón gira indefinidamente y el usuario no
// recibe ningún error.
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input as RequestInfo, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'La conexión tardó demasiado. Revisá tu internet e intentá de nuevo.',
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in src/config/supabase.ts.',
    );
    this.name = 'SupabaseConfigurationError';
  }
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigurationError();
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: AsyncStorage,
      },
      global: {
        fetch: fetchWithTimeout,
      },
    });
  }

  return client;
}
