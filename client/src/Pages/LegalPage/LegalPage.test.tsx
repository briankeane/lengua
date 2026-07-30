import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import LegalPage from './LegalPage';

describe('LegalPage', () => {
  it('renders the privacy policy title and real content (not a placeholder)', () => {
    renderWithProviders(<LegalPage kind="privacy" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/privacy policy/i);
    expect(screen.getByRole('heading', { level: 2, name: /what we collect/i })).toBeInTheDocument();
    expect(screen.queryByText(/finalizing this document/i)).not.toBeInTheDocument();
  });

  it('renders the terms of service content', () => {
    renderWithProviders(<LegalPage kind="terms" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/terms of service/i);
  });

  it('sets a per-page document title', () => {
    renderWithProviders(<LegalPage kind="privacy" />);
    expect(document.title).toMatch(/privacy policy — lengua/i);
  });

  it('scopes the cobalt landing theme via the lp class', () => {
    renderWithProviders(<LegalPage kind="privacy" />);
    expect(screen.getByRole('main')).toHaveClass('lp');
  });
});
