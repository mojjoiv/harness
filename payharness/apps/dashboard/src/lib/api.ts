import { getToken, clearSession } from './auth';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  code: string;
  errors: unknown[];
  status: number;

  constructor(message: string, code = 'API_ERROR', status = 500, errors: unknown[] = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

export interface WrappedResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  timestamp?: string;
}

async function parseResponse<T>(response: Response): Promise<{ data: T; meta: Record<string, unknown> }> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = payload?.message || response.statusText || 'Request failed';
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage);
    throw new ApiError(message, payload?.code || 'REQUEST_FAILED', response.status, payload?.errors || []);
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    return {
      data: (payload as WrappedResponse<T>).data,
      meta: (payload as WrappedResponse<T>).meta || {},
    };
  }

  return { data: payload as T, meta: {} };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  if (process.env.NODE_ENV === 'production' && !configuredApiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is required in production for the dashboard API client.');
  }

  const apiUrl = configuredApiUrl || 'http://localhost:3000';
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
  });

  try {
    return await parseResponse<T>(response);
  } catch (error) {
    if ((error as ApiError).status === 401) {
      clearSession();
    }
    throw error;
  }
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
