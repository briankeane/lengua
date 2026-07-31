import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import * as translateService from '../../Services/translateService';
import TranslatePage from './TranslatePage';

describe('TranslatePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error cleanup
    delete window.SpeechRecognition;
    // @ts-expect-error cleanup
    delete window.webkitSpeechRecognition;
  });

  it('shows English and Spanish labels', () => {
    renderWithProviders(<TranslatePage />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Spanish')).toBeInTheDocument();
  });

  it('translates typed input and renders the result', async () => {
    vi.spyOn(translateService, 'translate').mockResolvedValue({
      text: 'hola',
      direction: 'en-es',
    });
    renderWithProviders(<TranslatePage />);
    const input = screen.getByLabelText('English');
    fireEvent.change(input, { target: { value: 'hello' } });
    await waitFor(() => expect(screen.getByText('hola')).toBeInTheDocument());
  });

  it('hides the mic button when speech recognition is unsupported', () => {
    renderWithProviders(<TranslatePage />);
    expect(screen.queryByRole('button', { name: /speak/i })).not.toBeInTheDocument();
  });
});
