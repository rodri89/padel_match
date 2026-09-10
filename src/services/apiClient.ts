import { getAuthSession } from './authSession';

const API_BASE_URL = '';

type RequestOptions = {
  body?: unknown;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requiresAuth?: boolean;
};

export class ApiClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

export function isBackendConfigured() {
  return Boolean(API_BASE_URL);
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  if (!API_BASE_URL) {
    throw new ApiClientError(
      'Backend API base URL is not configured. Set API_BASE_URL in apiClient.ts.',
    );
  }

  const session = await getAuthSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (options.requiresAuth !== false && session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? 'GET',
  });

  if (!response.ok) {
    throw new ApiClientError(
      `Request failed with status ${response.status}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
