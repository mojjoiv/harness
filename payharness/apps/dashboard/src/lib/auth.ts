export const AUTH_TOKEN_KEY = 'payharness_access_token';
export const AUTH_USER_KEY = 'payharness_user';

export interface AuthSession {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  merchantId: string;
  role: string;
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function getSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  return raw ? (JSON.parse(raw) as AuthSession) : null;
}

export function setSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}
