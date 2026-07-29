import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import Navbar from './Navbar';

describe('Navbar', () => {
  it('shows login and signup links when not authenticated', () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole('link', { name: 'Log In' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign Up' })).toBeInTheDocument();
  });

  it('shows app brand link', () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByRole('link', { name: 'App' })).toBeInTheDocument();
  });
});
