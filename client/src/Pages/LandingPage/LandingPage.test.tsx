import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('renders one h1 with the headline', () => {
    renderWithProviders(<LandingPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/translator that helps you learn/i);
  });

  it('points the primary and nav CTAs at /login', () => {
    renderWithProviders(<LandingPage />);
    const loginLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/login');
    expect(loginLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the three how-it-works steps', () => {
    renderWithProviders(<LandingPage />);
    // Step titles are <h3>s; the section heading also contains these phrases,
    // so match the step headings specifically rather than any text.
    expect(screen.getByRole('heading', { level: 3, name: 'Look it up' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Keep it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Say it back' })).toBeInTheDocument();
  });

  it('renders privacy and terms links in the footer', () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms');
  });
});
