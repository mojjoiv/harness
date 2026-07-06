import { getToken, clearSession } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
    const message = payload?.message || response.statusText || 'Request failed';
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
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
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
