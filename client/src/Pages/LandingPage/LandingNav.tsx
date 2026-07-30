import { Link } from 'react-router-dom';
import { LANDING } from './content';

export default function LandingNav() {
  return (
    <header className="lp-nav">
      <div className="lp-nav__inner">
        <Link to="/" className="lp-nav__brand" aria-label={`${LANDING.brand} home`}>
          <span className="lp-mark" aria-hidden="true" />
          {LANDING.brand}
        </Link>
        <nav className="lp-nav__actions">
          <Link to="/login" className="lp-link">
            {LANDING.nav.signIn}
          </Link>
          <Link to="/login" className="lp-btn lp-btn--sm">
            {LANDING.nav.cta}
          </Link>
        </nav>
      </div>
    </header>
  );
}
