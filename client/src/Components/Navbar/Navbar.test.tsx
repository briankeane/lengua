import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
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
});
