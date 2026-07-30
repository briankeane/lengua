import { Link } from 'react-router-dom';
import { LANDING } from './content';

export default function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-hero__copy">
        <h1 className="lp-hero__title">{LANDING.hero.title}</h1>
        <p className="lp-hero__sub">{LANDING.hero.sub}</p>
        <div className="lp-hero__actions">
          <Link to="/login" className="lp-btn">
            {LANDING.hero.primaryCta}
          </Link>
          <a href="#how" className="lp-link lp-link--light">
            {LANDING.hero.secondaryCta}
          </a>
        </div>
        <p className="lp-hero__micro">{LANDING.hero.micro}</p>
      </div>
      <div className="lp-hero__art" aria-hidden="true">
        <div className="lp-phone">
          <p className="lp-phone__label">the bill please</p>
          <p className="lp-phone__answer">la cuenta, por favor</p>
          <p className="lp-phone__ipa">/la ˈkwenta poɾ faˈβoɾ/</p>
          <span className="lp-phone__chip">Saved · due now</span>
        </div>
      </div>
    </section>
  );
}
