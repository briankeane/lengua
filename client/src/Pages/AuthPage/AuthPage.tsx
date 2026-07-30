import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ContinueWithGoogleButton from '../../Components/ContinueWithGoogleButton';
import { useAuth } from '../../Contexts/useAuth';

export default function AuthPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(decodeURIComponent(redirectTo), { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  return (
    <div className="signin">
      <div className="signin-brand">
        <span className="signin-orb" />
        <h1 className="signin-title">Lengua</h1>
        <p className="signin-tagline">Look it up. Keep it. Say it back.</p>
      </div>
      <div className="signin-actions">
        <ContinueWithGoogleButton />
        <p className="signin-note">No password. No email.</p>
      </div>
    </div>
  );
}
