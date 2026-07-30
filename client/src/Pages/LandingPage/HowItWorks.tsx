import { LANDING } from './content';

export default function HowItWorks() {
  return (
    <section id="how" className="lp-section lp-section--surface">
      <div className="lp-container">
        <h2 className="lp-section__title">{LANDING.how.heading}</h2>
        <ol className="lp-steps">
          {LANDING.how.steps.map((step, i) => (
            <li key={step.title} className="lp-step">
              <span className="lp-step__num">{i + 1}</span>
              <h3 className="lp-step__title">{step.title}</h3>
              <p className="lp-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
