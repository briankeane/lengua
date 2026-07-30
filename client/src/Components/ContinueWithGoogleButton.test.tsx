import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContinueWithGoogleButton from './ContinueWithGoogleButton';

const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
vi.mock('../Contexts/useAuth', () => ({
  useAuth: () => ({ signInWithGoogle }),
}));

let capturedOnSuccess: ((r: { code: string }) => void) | undefined;
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: (opts: { onSuccess: (r: { code: string }) => void }) => {
    capturedOnSuccess = opts.onSuccess;
    return () => capturedOnSuccess?.({ code: 'auth-code-xyz' });
  },
}));

describe('ContinueWithGoogleButton', () => {
  it('sends the auth code to signInWithGoogle on click', async () => {
    render(<ContinueWithGoogleButton />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledWith('auth-code-xyz');
  });
});
