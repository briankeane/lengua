import './LandingPage.css';
import { usePageMeta } from '../../hooks/usePageMeta';
import { LANDING } from './content';
import FeatureSection from './FeatureSection';
import FinalCta from './FinalCta';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import LandingFooter from './LandingFooter';
import LandingNav from './LandingNav';
import Languages from './Languages';

export default function LandingPage() {
  // Reset title/canonical to the landing defaults (index.html carries them,
  // but a client-side visit from a legal page would otherwise keep those).
  usePageMeta({ title: 'Lengua — The translator that helps you learn', path: '/' });

  return (
    <div className="lp">
      <LandingNav />
      <main>
        <Hero />
        <section className="lp-reframe">
          <p className="lp-container">{LANDING.reframe}</p>
        </section>
        <HowItWorks />
        {LANDING.features.map((feature, i) => (
          <FeatureSection key={feature.title} feature={feature} flip={i % 2 === 1} />
        ))}
        <Languages />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
