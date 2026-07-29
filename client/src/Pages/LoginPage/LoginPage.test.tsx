import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders login form', () => {
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
  });

  it('has a link to signup page', () => {
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });
});
