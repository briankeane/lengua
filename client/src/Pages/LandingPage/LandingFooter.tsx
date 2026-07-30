import { Link } from 'react-router-dom';
import { LANDING } from './content';

export default function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer__inner">
        <div>
          <span className="lp-footer__brand">{LANDING.brand}</span>
          <span className="lp-footer__tag">{LANDING.footer.tagline}</span>
        </div>
        <nav className="lp-footer__links">
          <Link to="/privacy" className="lp-link">
            Privacy
          </Link>
          <Link to="/terms" className="lp-link">
            Terms
          </Link>
          <a href="mailto:hello@lengua-app.com" className="lp-link">
            Contact
          </a>
        </nav>
        <span className="lp-footer__copy">{LANDING.footer.copyright}</span>
      </div>
    </footer>
  );
}
