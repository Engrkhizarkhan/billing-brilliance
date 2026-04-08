const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

let accessToken: string | null = localStorage.getItem('access_token');
let refreshToken: string | null = localStorage.getItem('refresh_token');

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

export const getAccessToken = () => accessToken;

const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const transformKeys = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        snakeToCamel(key),
        transformKeys(value),
      ])
    );
  }
  return obj;
};

const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const transformKeysToSnake = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(transformKeysToSnake);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        camelToSnake(key),
        transformKeysToSnake(value),
      ])
    );
  }
  return obj;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipTransform?: boolean;
};

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

const processRefreshQueue = (token: string | null, error?: Error) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error || new Error('Refresh failed'));
  });
  refreshQueue = [];
};

const attemptTokenRefresh = async (): Promise<string> => {
  if (!refreshToken) throw new Error('No refresh token');

  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      throw new Error('Token refresh failed');
    }

    const json = await res.json();
    const newAccess = json.data.token;
    const newRefresh = json.data.refreshToken;
    setTokens(newAccess, newRefresh);
    processRefreshQueue(newAccess);
    return newAccess;
  } catch (err) {
    clearTokens();
    processRefreshQueue(null, err as Error);
    throw err;
  } finally {
    isRefreshing = false;
  }
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export const request = async <T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = 'GET', body, headers = {}, skipAuth = false, skipTransform = false } = options;

  const url = `${BASE_URL}${path}`;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth && accessToken) {
    reqHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOpts: RequestInit = { method, headers: reqHeaders };
  if (body !== undefined) {
    fetchOpts.body = JSON.stringify(body);
  }

  let res = await fetch(url, fetchOpts);

  if (res.status === 401 && !skipAuth && refreshToken && !path.includes('/auth/refresh')) {
    try {
      const newToken = await attemptTokenRefresh();
      reqHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...fetchOpts, headers: reqHeaders });
    } catch {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      throw new ApiError(401, 'Session expired');
    }
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    const msg =
      (json as Record<string, string>)?.error ||
      (json as Record<string, string>)?.message ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, json);
  }

  if (skipTransform) return json as T;

  return transformKeys(json) as T;
};

export const get = <T = unknown>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
  request<T>(path, { ...opts, method: 'GET' });

export const post = <T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'POST', body });

export const put = <T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'PUT', body });

export const patch = <T = unknown>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  request<T>(path, { ...opts, method: 'PATCH', body });

export const del = <T = unknown>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
  request<T>(path, { ...opts, method: 'DELETE' });

export const buildQuery = (params: Record<string, string | number | boolean | undefined | null>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
};
