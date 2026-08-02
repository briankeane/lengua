import { Link } from 'react-router-dom';
import { useAuth } from '../../Contexts/useAuth';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        App
      </Link>
      <div className="navbar-links">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/translate">Translate</Link>
            <span className="navbar-user">{user?.displayName || user?.email}</span>
            <button onClick={logout} className="navbar-logout">
              Log Out
            </button>
          </>
        ) : (
          <Link to="/login">Sign In</Link>
        )}
      </div>
    </nav>
  );
}
