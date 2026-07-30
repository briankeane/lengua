import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import LegalPage from './LegalPage';

describe('LegalPage', () => {
  it('renders the title heading', () => {
    renderWithProviders(<LegalPage title="Privacy Policy" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/privacy policy/i);
  });

  it('scopes the cobalt landing theme via the lp class', () => {
    renderWithProviders(<LegalPage title="Privacy Policy" />);
    expect(screen.getByRole('main')).toHaveClass('lp');
  });
});
