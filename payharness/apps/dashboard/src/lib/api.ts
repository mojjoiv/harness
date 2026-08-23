import { getToken, clearSession } from './auth';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const isDevelopment = process.env.NODE_ENV === 'development';

export class ApiError extends Error {
  code: string;
  errors: unknown[];
  status: number;

  constructor(message: string, code = 'API_ERROR', status = 500, errors: unknown[] = []) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

export function getApiUrl() {
  if (process.env.NODE_ENV === 'production' && !configuredApiUrl) {
    throw new ApiError('NEXT_PUBLIC_API_URL is not configured', 'API_URL_NOT_CONFIGURED', 500);
  }

  return (configuredApiUrl || 'http://localhost:3000').replace(/\/+$/, '');
}

export function buildApiUrl(path: string) {
  const apiUrl = getApiUrl();
  return `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface WrappedResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  timestamp?: string;
}

type ParsedBody = {
  payload: unknown;
  rawText: string;
  isJson: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readBody(response: Response): Promise<ParsedBody> {
  const contentType = response.headers?.get?.('content-type') || '';

  // Some test/mocked fetch responses expose json() but not text(). Prefer
  // the JSON reader when the response advertises JSON content.
  if (contentType.toLowerCase().includes('application/json') && typeof response.json === 'function') {
    try {
      const payload = await response.json();
      return { payload, rawText: '', isJson: true };
    } catch {
      // Fall through to text() for a malformed JSON response.
    }
  }

  if (typeof response.text === 'function') {
    const rawText = await response.text();
    if (!rawText) {
      return { payload: undefined, rawText, isJson: contentType.toLowerCase().includes('application/json') };
    }

    try {
      return { payload: JSON.parse(rawText), rawText, isJson: true };
    } catch {
      return { payload: undefined, rawText, isJson: false };
    }
  }

  return { payload: undefined, rawText: '', isJson: false };
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) {
    return fallback;
  }

  const rawMessage = payload.message;
  if (Array.isArray(rawMessage)) {
    return rawMessage.join(', ');
  }
  if (rawMessage) {
    return String(rawMessage);
  }

  return fallback;
}

function getErrorCode(payload: unknown, fallback: string) {
  return isRecord(payload) && payload.code ? String(payload.code) : fallback;
}

function getErrorList(payload: unknown) {
  return isRecord(payload) && Array.isArray(payload.errors) ? payload.errors : [];
}

async function parseResponse<T>(response: Response): Promise<{ data: T; meta: Record<string, unknown> }> {
  const { payload, rawText, isJson } = await readBody(response);

  if (!response.ok) {
    if (isDevelopment) {
      console.log('[api] parsed error body', payload ?? rawText);
    }

    const fallback = rawText || response.statusText || 'Request failed';
    throw new ApiError(
      getErrorMessage(payload, fallback),
      getErrorCode(payload, 'REQUEST_FAILED'),
      response.status,
      getErrorList(payload),
    );
  }

  if (!isJson) {
    throw new ApiError('Invalid JSON response from API', 'INVALID_JSON_RESPONSE', response.status);
  }

  if (isRecord(payload) && 'success' in payload) {
    if (payload.success === false) {
      throw new ApiError(
        getErrorMessage(payload, 'Request failed'),
        getErrorCode(payload, 'REQUEST_FAILED'),
        response.status,
        getErrorList(payload),
      );
    }

    const wrapped = payload as unknown as WrappedResponse<T>;
    return {
      data: wrapped.data,
      meta: wrapped.meta || {},
    };
  }

  return { data: payload as T, meta: {} };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const method = init.method || 'GET';
  const url = buildApiUrl(path);
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (isDevelopment) {
    console.log('[api] request', method, url);
  }

  try {
    const response = await fetch(url, {
      ...init,
      method,
      headers,
    });

    if (isDevelopment) {
      console.log('[api] response', response.status, url);
    }

    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        clearSession();
      }
      throw error;
    }

    if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
      throw new ApiError(
        'Network request failed. The API may be unreachable or blocked by CORS.',
        'NETWORK_ERROR',
        0,
      );
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
