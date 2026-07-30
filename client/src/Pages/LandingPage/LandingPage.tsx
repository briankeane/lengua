import './LandingPage.css';
import Hero from './Hero';
import LandingNav from './LandingNav';

export default function LandingPage() {
  return (
    <div className="lp">
      <LandingNav />
      <main>
        <Hero />
      </main>
    </div>
  );
}
