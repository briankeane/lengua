import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import * as authService from '../Services/authService';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider.signInWithGoogle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('verifies a Google ID token and stores the session', async () => {
    vi.spyOn(authService, 'googleAuth').mockResolvedValue({
      token: 'jwt-123',
      user: {
        id: 'u1',
        email: 'g@example.com',
        displayName: '',
        firstName: 'G',
        lastName: '',
        role: 'user',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signInWithGoogle('id-token-abc');
    });

    expect(authService.googleAuth).toHaveBeenCalledWith('id-token-abc');
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(localStorage.getItem('token')).toBe('jwt-123');
  });
});
