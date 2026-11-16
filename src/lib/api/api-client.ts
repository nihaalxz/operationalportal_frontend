import { browser } from '$app/environment';
import { parseProblemDetails, NetworkError } from './problem-details';
import type { ApiError } from './problem-details';

import { BACKEND_API_URL, SALES_PORTAL_API_URL } from '$lib/config';

// ---------------------------------------------------------------------------
// Base URL — loaded dynamically from configuration
// ---------------------------------------------------------------------------
export const BASE_URL = BACKEND_API_URL;

// ---------------------------------------------------------------------------
// Token persistence — stored in localStorage (same pattern as sales portal)
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'txops_token';

export function setAccessToken(token: string | null): void {
  if (!browser) return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAccessToken(): string | null {
  if (!browser) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (!browser) return;
  localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Request Caching System (Matches Accounts Portal Performance Architecture)
// ---------------------------------------------------------------------------
const _getCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 5000; // 5 seconds cache TTL

// ---------------------------------------------------------------------------
// Request options interface
// ---------------------------------------------------------------------------
export interface RequestOptions extends RequestInit {
  baseUrl?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Explicitly pass a token — skips localStorage lookup */
  token?: string;
  /** Skip refresh logic for auth endpoints */
  skipRefresh?: boolean;
}

// ---------------------------------------------------------------------------
// Core apiFetch — the single fetch entry-point for the entire application
// ---------------------------------------------------------------------------
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { baseUrl = BASE_URL, params, token, headers, ...rest } = options;

  const method = (rest.method || 'GET').toUpperCase();
  const cacheKey = `${method}:${path}:${JSON.stringify(params || {})}`;

  if (method === 'GET') {
    const cached = _getCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  const url = new URL(
    path.startsWith('/') ? path.slice(1) : path,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  );

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Accept')) requestHeaders.set('Accept', 'application/json');
  if (!requestHeaders.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  // Attach token — explicit override or read from localStorage
  const activeToken = token ?? getAccessToken();
  if (activeToken) requestHeaders.set('Authorization', `Bearer ${activeToken}`);

  const traceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);
  requestHeaders.set('X-Correlation-ID', traceId);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: requestHeaders,
      ...rest
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new NetworkError();
  }

  // Successful 204 No Content
  if (response.status === 204) return null as unknown as T;

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorBody: unknown = null;
    if (isJson) {
      try { errorBody = await response.json(); } catch { /* ignore */ }
    } else {
      try {
        const text = await response.text();
        if (text) {
          errorBody = { detail: text, title: response.status === 400 ? 'Validation Error' : 'Error' };
        }
      } catch { /* ignore */ }
    }
    throw parseProblemDetails(response.status, errorBody);
  }

  const dataPromise = (isJson ? response.json() : response.text()) as Promise<T>;
  return dataPromise.then((data) => {
    if (method === 'GET') {
      _getCache[cacheKey] = { data, timestamp: Date.now() };
    } else {
      // Clear the entire GET cache on successful mutations (POST, PUT, DELETE, PATCH)
      for (const key in _getCache) {
        delete _getCache[key];
      }
    }
    return data;
  });
}

export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { baseUrl = SALES_PORTAL_API_URL, params, token, headers, ...rest } = options;
  const url = new URL(path.startsWith('/') ? path.slice(1) : path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }
  const requestHeaders = new Headers(headers);
  const activeToken = token ?? getAccessToken();
  if (activeToken) requestHeaders.set('Authorization', `Bearer ${activeToken}`);
  const response = await fetch(url.toString(), {
    headers: requestHeaders,
    ...rest
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }
  return response.blob();
}


// ---------------------------------------------------------------------------
// Re-export error types for consumers
// ---------------------------------------------------------------------------
export type { ApiError };
export {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DownstreamUnavailableError,
  TimeoutError,
  NetworkError,
  UnknownApiError
} from './problem-details';
