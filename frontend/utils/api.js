/**
 * API utility wrapper for the Test Material Warehouse frontend.
 *
 * - Targets `NEXT_PUBLIC_API_URL` (defaults to http://localhost:5000/api).
 * - Automatically injects the simple JWT token as a `Bearer` token read from
 *   localStorage (no cookies, no session store).
 * - Centralizes JSON parsing, error shaping and 401 session-expiry handling.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* ------------------------- auth storage helpers ------------------------ */

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function storeAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* ------------------------------ request core --------------------------- */

async function request(path, { method = 'GET', body, token, isFormData = false, headers: extraHeaders = {} } = {}) {
  let authToken = token || getToken();

  const headers = { ...extraHeaders };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body:
      isFormData ? body
      : body !== undefined ? JSON.stringify(body)
      : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body (e.g. empty response) - leave data as null.
  }

  if (!response.ok) {
    // Token rejected -> clear local auth and bounce to the login screen,
    // but never when the failed call itself is an auth request.
    if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
      clearAuth();
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }

  return data;
}

/* --------------------------------- api --------------------------------- */

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export { API_BASE_URL };
