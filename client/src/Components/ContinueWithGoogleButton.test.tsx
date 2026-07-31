import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContinueWithGoogleButton from './ContinueWithGoogleButton';

const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
vi.mock('../Contexts/useAuth', () => ({
  useAuth: () => ({ signInWithGoogle }),
}));

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: { credential: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'id-token-xyz' })}>
      Continue with Google
    </button>
  ),
}));

describe('ContinueWithGoogleButton', () => {
  it('sends the Google ID token to signInWithGoogle on success', async () => {
    render(<ContinueWithGoogleButton />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith('id-token-xyz'));
  });
});
