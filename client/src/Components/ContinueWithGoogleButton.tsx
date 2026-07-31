import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useAuth } from '../Contexts/useAuth';

export default function ContinueWithGoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');

  const handleSuccess = async ({ credential }: CredentialResponse) => {
    if (!credential) {
      setError('Sign-in failed. Please try again.');
      return;
    }
    setError('');
    try {
      await signInWithGoogle(credential);
    } catch {
      setError('Sign-in failed. Please try again.');
    }
  };

  return (
    <>
      <div className="google-signin">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Sign-in failed. Please try again.')}
          theme="filled_black"
          text="continue_with"
          shape="pill"
          size="large"
        />
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
