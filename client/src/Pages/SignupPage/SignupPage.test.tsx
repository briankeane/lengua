import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import SignupPage from './SignupPage';

describe('SignupPage', () => {
  it('renders signup form', () => {
    renderWithProviders(<SignupPage />, { initialEntries: ['/signup'] });
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
  });

  it('has a link to login page', () => {
    renderWithProviders(<SignupPage />, { initialEntries: ['/signup'] });
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
