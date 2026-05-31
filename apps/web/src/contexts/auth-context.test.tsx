import React from 'react';
/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

vi.mock('@/lib/utils', () => ({ API_URL: 'http://localhost:4000' }));
vi.mock('@/lib/cart-session', () => ({ clearCartSession: vi.fn() }));
vi.mock('@/lib/guest-favorites', () => ({ clearGuestFavorites: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  completeAuthSession: vi.fn(),
  syncSessionCookie: vi.fn(),
}));

import { apiFetch, completeAuthSession, syncSessionCookie } from '@/lib/api';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('probes session on mount and becomes ready', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true }),
    } as Response);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isReady).toBe(false);
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.token).toBeNull();
  });

  it('reports logged out when status returns unauthenticated', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false }),
    } as Response);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isLoggedIn).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('completeAuthSession delegates to api helper', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false }),
    } as Response);
    vi.mocked(completeAuthSession).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.completeAuthSession('access-token');
    });

    expect(completeAuthSession).toHaveBeenCalledWith('access-token');
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('clearAuth clears session cookie and logged-in state', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true }),
    } as Response);
    vi.mocked(syncSessionCookie).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    act(() => {
      result.current.clearAuth();
    });

    expect(syncSessionCookie).toHaveBeenCalledWith(null);
    expect(result.current.isLoggedIn).toBe(false);
  });
});
