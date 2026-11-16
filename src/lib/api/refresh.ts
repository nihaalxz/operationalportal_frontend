import { apiFetch, setAccessToken } from './api-client';
import type { LoginResponse } from '$lib/types/auth';

/**
 * Attempts a token refresh via POST /api/auth/refresh.
 * Returns the new access token on success, or null on failure.
 * Uses skipRefresh:true to prevent recursive 401 handling.
 */
export async function attemptRefresh(): Promise<string | null> {
  try {
    const res = await apiFetch<LoginResponse>('/api/auth/refresh', {
      method: 'POST',
      skipRefresh: true
    });
    if (res?.accessToken) {
      setAccessToken(res.accessToken);
      return res.accessToken;
    }
    return null;
  } catch {
    setAccessToken(null);
    return null;
  }
}
