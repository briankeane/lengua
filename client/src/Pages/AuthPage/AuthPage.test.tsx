import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import AuthPage from './AuthPage';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Continue with Google</button>,
}));

describe('AuthPage', () => {
  it('shows the Google button and no email/password fields', () => {
    renderWithProviders(<AuthPage />, { initialEntries: ['/login'] });
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByText(/no password\. no email\./i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
