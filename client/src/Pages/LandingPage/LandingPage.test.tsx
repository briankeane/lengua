import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('renders one h1 with the headline', () => {
    renderWithProviders(<LandingPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/exactly the words you need/i);
  });

  it('points the primary and nav CTAs at /login', () => {
    renderWithProviders(<LandingPage />);
    const loginLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/login');
    expect(loginLinks.length).toBeGreaterThanOrEqual(2);
  });
});
