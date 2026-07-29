import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  it('renders dashboard heading', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
