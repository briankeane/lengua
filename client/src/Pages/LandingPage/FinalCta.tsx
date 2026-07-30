import { Link } from 'react-router-dom';
import { LANDING } from './content';

export default function FinalCta() {
  return (
    <section className="lp-section lp-section--cobalt lp-final">
      <div className="lp-container">
        <h2 className="lp-final__title">{LANDING.finalCta.heading}</h2>
        <p className="lp-final__sub">{LANDING.finalCta.sub}</p>
        <Link to="/login" className="lp-btn">
          {LANDING.finalCta.cta}
        </Link>
      </div>
    </section>
  );
}
