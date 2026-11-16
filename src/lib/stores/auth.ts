import { writable, derived, get } from 'svelte/store';
import { apiFetch, setAccessToken, clearAccessToken, getAccessToken } from '$lib/api/api-client';
import type { SessionUser, LoginResponse } from '$lib/types/auth';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** True while the root layout is verifying the stored token on first load */
  isInitializing: boolean;
}

// Start initializing only if there's actually a token to verify
const _hasToken = typeof localStorage !== 'undefined'
  ? !!localStorage.getItem('txops_token')
  : false;

const _auth = writable<AuthState>({
  user: null,
  isAuthenticated: false,
  isInitializing: _hasToken // Only show spinner if there's a token to verify
});

// Public readonly derived stores
export const authState = { subscribe: _auth.subscribe };
export const currentUser = derived(_auth, ($a) => $a.user);
export const isAuthenticated = derived(_auth, ($a) => $a.isAuthenticated);
export const isInitializing = derived(_auth, ($a) => $a.isInitializing);

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------
export function hasPermission(permission: string): boolean {
  const state = get(_auth);
  if (!state.user) return false;
  if (state.user.userType === 'Admin') return true;
  return state.user.permissions.includes(permission);
}

export function hasAnyPermission(...permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(p));
}

export function hasRole(role: string): boolean {
  const state = get(_auth);
  return state.user?.userType === role;
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Called by the root layout after verifying the stored token via /api/auth/me.
 * Hydrates the auth store with the user's profile.
 */
export function setSession(user: SessionUser): void {
  _auth.set({ user, isAuthenticated: true, isInitializing: false });
}

/**
 * Performs login with email + password.
 * Stores the JWT in localStorage and hydrates the auth store.
 */
export async function login(email: string, password: string): Promise<void> {
  const res = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  setAccessToken(res.accessToken);
  _auth.set({
    user: { id: res.id, name: res.name, email: res.email, userType: res.userType, permissions: res.permissions, avatarUrl: res.avatarUrl },
    isAuthenticated: true,
    isInitializing: false
  });
}

/**
 * Helper to update the profile properties in the local state.
 */
export function updateProfileState(name: string, avatarUrl: string | null) {
  _auth.update((s) => {
    if (!s.user) return s;
    return {
      ...s,
      user: { ...s.user, name, avatarUrl }
    };
  });
}

/**
 * Performs logout — clears token from localStorage and resets store.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort — always clear client-side state regardless
  }
  clearSession();
}

/**
 * Clears session state. Used when token is expired/invalid.
 */
export function clearSession(): void {
  clearAccessToken();
  _auth.set({ user: null, isAuthenticated: false, isInitializing: false });
}
