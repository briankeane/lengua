import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import * as useAuthModule from '../../Contexts/useAuth';
import Navbar from './Navbar';

describe('Navbar', () => {
  it('shows a sign in link when not authenticated', () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('shows app brand link', () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole('link', { name: 'App' })).toBeInTheDocument();
  });

  it('shows a Translate link when authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'a@b.c',
        displayName: 'A',
        firstName: 'A',
        lastName: 'B',
        role: 'user',
      },
      token: 'token',
      loading: false,
      login: vi.fn(),
      signup: vi.fn(),
      signInWithGoogle: vi.fn(),
      loginWithToken: vi.fn(),
      logout: vi.fn(),
    });

    renderWithProviders(<Navbar />);
    expect(screen.getByRole('link', { name: 'Translate' })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
