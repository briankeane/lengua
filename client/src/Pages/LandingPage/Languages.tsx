import { LANDING } from './content';

export default function Languages() {
  return (
    <section className="lp-section lp-section--surface lp-langs">
      <div className="lp-container">
        <h2 className="lp-section__title">{LANDING.languages.heading}</h2>
        <p className="lp-langs__sub">{LANDING.languages.sub}</p>
      </div>
    </section>
  );
}
