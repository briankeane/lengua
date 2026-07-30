# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a marketing landing page at the site root (`/`) that sells Lengua to cold ad/search traffic and funnels visitors to Google sign-in.

**Architecture:** A new presentational `LandingPage` (composition root + small section components + a single copy-deck module + one scoped stylesheet) becomes the public `index` route. `AuthPage` moves to `/login` + `/signup` only. Marketing SEO/social meta is added statically to `client/index.html` (correct for a Vite SPA whose root URL is what crawlers and ad unfurls hit). The new cobalt theme is scoped to the landing page so the rest of the app is untouched.

**Tech Stack:** React 18, Vite, TypeScript, `react-router-dom` (`createBrowserRouter`), Vitest + React Testing Library. Plain CSS with a scoped `--lp-*` token layer. No new dependencies.

## Global Constraints

- All new files are TypeScript/TSX — no new `.js` files.
- Auth is **Google-only** on the website. Landing CTAs are `<Link>`s to `/login`; the landing page contains **no** auth logic.
- Cobalt theme tokens live in `LandingPage.css` (scoped), **not** global `:root`. Do not restyle AuthPage/Dashboard.
- Copy is fixed — use the **Copy Deck** (end of this doc) verbatim. Do not invent marketing copy.
- Production domain is `https://www.lengua-app.com` (used for canonical, `og:url`, sitemap). Contact email `hello@lengua-app.com`.
- Palette: bg `#2C4EBD`; text on cobalt `#FFFFFF` / muted `rgba(255,255,255,0.72)`; surface `#FBFAF7`; text on surface `#1B1E27` / muted `#5B5F6C`; buttons white pill `#FFFFFF` with `#1B1E27` text; pill radius `999px`.
- Format before finishing: `make prettier-client`. Gates: `make lint-client`, `make test-client`, client build all pass.
- Follow existing test pattern: `renderWithProviders(ui, { initialEntries })` from `src/test/testHelpers.tsx`.

---

## File Structure

```
client/
  index.html                                  # MODIFY — SEO/social <head>
  public/
    robots.txt                                # CREATE
    sitemap.xml                               # CREATE
  src/
    Routes/
      AppRoutes.tsx                           # MODIFY — consume shared routeChildren
      routeChildren.tsx                       # CREATE — testable route table (index -> LandingPage; /privacy /terms)
      AppRoutes.test.tsx                      # CREATE — routing behavior
    Pages/
      LandingPage/
        LandingPage.tsx                       # CREATE — composition root
        LandingPage.css                       # CREATE — scoped cobalt theme + layout
        content.ts                            # CREATE — typed copy deck (single source of copy)
        LandingNav.tsx                        # CREATE
        Hero.tsx                              # CREATE
        HowItWorks.tsx                        # CREATE
        FeatureSection.tsx                    # CREATE — reusable, mapped 3x
        Languages.tsx                         # CREATE
        FinalCta.tsx                          # CREATE
        LandingFooter.tsx                     # CREATE
        LandingPage.test.tsx                  # CREATE
      LegalPage/
        LegalPage.tsx                         # CREATE — minimal placeholder for /privacy /terms
    test/
      seoMeta.test.ts                         # CREATE — asserts index.html meta tags
```

---

## Task 1: Routing swap + landing shell (nav + hero + theme tokens)

**Files:**
- Create: `client/src/Pages/LandingPage/content.ts`
- Create: `client/src/Pages/LandingPage/LandingPage.css`
- Create: `client/src/Pages/LandingPage/LandingNav.tsx`
- Create: `client/src/Pages/LandingPage/Hero.tsx`
- Create: `client/src/Pages/LandingPage/LandingPage.tsx`
- Create: `client/src/Pages/LegalPage/LegalPage.tsx`
- Modify: `client/src/Routes/AppRoutes.tsx`
- Test: `client/src/Routes/AppRoutes.test.tsx`, `client/src/Pages/LandingPage/LandingPage.test.tsx`

**Interfaces:**
- Produces: `default export LandingPage()` (no props). `content.ts` exports `const LANDING` object (see Copy Deck) consumed by all section components. `default export LegalPage({ title }: { title: string })`.
- Consumes: `renderWithProviders` from `src/test/testHelpers.tsx`.

- [ ] **Step 1: Write the failing routing test**

`client/src/Routes/AppRoutes.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: () => () => {},
}));

// Rebuild the same route children the app mounts, without the live GoogleOAuthProvider/env.
async function renderAt(path: string) {
  const { routeChildren } = await import('./routeChildren');
  const router = createMemoryRouter(routeChildren, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('routing', () => {
  it('renders the landing page at /', async () => {
    await renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /exactly the words you need/i,
    );
  });

  it('renders the auth page at /login', async () => {
    await renderAt('/login');
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `make test-client` (or `cd client && npx vitest run src/Routes/AppRoutes.test.tsx`)
Expected: FAIL — `./routeChildren` and `LandingPage` don't exist.

- [ ] **Step 3: Extract route children so they're testable, and swap the index route**

Refactor `client/src/Routes/AppRoutes.tsx` to export the child route array, then swap the index element to `LandingPage` and add `/privacy` + `/terms`.

`client/src/Routes/routeChildren.tsx` (CREATE):

```tsx
import { RouteObject } from 'react-router-dom';
import AuthPage from '../Pages/AuthPage/AuthPage';
import DashboardPage from '../Pages/DashboardPage/DashboardPage';
import LandingPage from '../Pages/LandingPage/LandingPage';
import LegalPage from '../Pages/LegalPage/LegalPage';
import ProtectedRoute from './ProtectedRoute';

export const routeChildren: RouteObject[] = [
  { index: true, element: <LandingPage /> },
  { path: 'login', element: <AuthPage /> },
  { path: 'signup', element: <AuthPage /> },
  { path: 'privacy', element: <LegalPage title="Privacy Policy" /> },
  { path: 'terms', element: <LegalPage title="Terms of Service" /> },
  {
    path: 'dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
];
```

`client/src/Routes/AppRoutes.tsx` (MODIFY) — consume the shared children:

```tsx
import { GoogleOAuthProvider } from '@react-oauth/google';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../Contexts/AuthProvider';
import { routeChildren } from './routeChildren';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GoogleOAuthProvider>
    ),
    children: routeChildren,
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 4: Create the copy deck**

`client/src/Pages/LandingPage/content.ts` — paste the full **Copy Deck** object from the end of this plan (exported as `export const LANDING = { ... } as const;`).

- [ ] **Step 5: Create the scoped stylesheet**

`client/src/Pages/LandingPage/LandingPage.css` — paste the full **Stylesheet** block from the end of this plan.

- [ ] **Step 6: Create LandingNav and Hero**

`client/src/Pages/LandingPage/LandingNav.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { LANDING } from './content';

export default function LandingNav() {
  return (
    <header className="lp-nav">
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
    </header>
  );
}
```

`client/src/Pages/LandingPage/Hero.tsx`:

```tsx
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
```

- [ ] **Step 7: Create the minimal LegalPage placeholder**

`client/src/Pages/LegalPage/LegalPage.tsx`:

```tsx
import { Link } from 'react-router-dom';

export default function LegalPage({ title }: { title: string }) {
  return (
    <main className="lp-legal">
      <h1>{title}</h1>
      <p>
        We&rsquo;re finalizing this document. Questions in the meantime?{' '}
        <a href="mailto:hello@lengua-app.com">hello@lengua-app.com</a>.
      </p>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Create the LandingPage composition root (nav + hero only for now)**

`client/src/Pages/LandingPage/LandingPage.tsx`:

```tsx
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
```

- [ ] **Step 9: Write the landing hero test**

`client/src/Pages/LandingPage/LandingPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('renders one h1 with the headline', () => {
    renderWithProviders(<LandingPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/exactly the words you need/i);
  });

  it('points the primary and nav CTAs at /login', () => {
    renderWithProviders(<LandingPage />);
    const loginLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/login');
    expect(loginLinks.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 10: Run tests to green**

Run: `make test-client`
Expected: `AppRoutes.test.tsx` and `LandingPage.test.tsx` PASS. Existing `AuthPage.test.tsx` still passes.

- [ ] **Step 11: Lint, format, build**

Run: `make prettier-client && make lint-client && cd client && npm run build`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add client/src/Routes client/src/Pages/LandingPage client/src/Pages/LegalPage
git commit -m "feat(client): landing page shell + route swap to /"
```

---

## Task 2: Content sections (how-it-works, features, languages, final CTA, footer)

**Files:**
- Create: `client/src/Pages/LandingPage/HowItWorks.tsx`
- Create: `client/src/Pages/LandingPage/FeatureSection.tsx`
- Create: `client/src/Pages/LandingPage/Languages.tsx`
- Create: `client/src/Pages/LandingPage/FinalCta.tsx`
- Create: `client/src/Pages/LandingPage/LandingFooter.tsx`
- Modify: `client/src/Pages/LandingPage/LandingPage.tsx` (compose the new sections)
- Test: `client/src/Pages/LandingPage/LandingPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `LANDING` from `content.ts` (`how`, `features`, `languages`, `finalCta`, `footer`, `reframe`).
- Produces: `default export HowItWorks()`, `default export Languages()`, `default export FinalCta()`, `default export LandingFooter()`, and `default export FeatureSection({ feature, flip }: { feature: { title: string; body: string }; flip: boolean })`.

- [ ] **Step 1: Extend the test (red)**

Add to `LandingPage.test.tsx`:

```tsx
it('renders the three how-it-works steps', () => {
  renderWithProviders(<LandingPage />);
  expect(screen.getByText(/look it up/i)).toBeInTheDocument();
  expect(screen.getByText(/keep it/i)).toBeInTheDocument();
  expect(screen.getByText(/say it back/i)).toBeInTheDocument();
});

it('renders privacy and terms links in the footer', () => {
  renderWithProviders(<LandingPage />);
  expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd client && npx vitest run src/Pages/LandingPage/LandingPage.test.tsx`
Expected: FAIL — steps/footer not rendered yet.

- [ ] **Step 3: Create HowItWorks**

```tsx
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
```

- [ ] **Step 4: Create FeatureSection (reusable)**

```tsx
export default function FeatureSection({
  feature,
  flip,
}: {
  feature: { title: string; body: string };
  flip: boolean;
}) {
  return (
    <section className={`lp-feature ${flip ? 'lp-feature--flip' : ''}`}>
      <div className="lp-container lp-feature__inner">
        <div className="lp-feature__copy">
          <h2 className="lp-feature__title">{feature.title}</h2>
          <p className="lp-feature__body">{feature.body}</p>
        </div>
        <div className="lp-feature__art" aria-hidden="true" />
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create Languages**

```tsx
import { LANDING } from './content';

export default function Languages() {
  return (
    <section className="lp-section lp-section--cobalt lp-langs">
      <div className="lp-container">
        <h2 className="lp-section__title">{LANDING.languages.heading}</h2>
        <p className="lp-langs__sub">{LANDING.languages.sub}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create FinalCta**

```tsx
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
```

- [ ] **Step 7: Create LandingFooter**

```tsx
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
```

- [ ] **Step 8: Compose everything in LandingPage.tsx**

```tsx
import './LandingPage.css';
import { LANDING } from './content';
import FeatureSection from './FeatureSection';
import FinalCta from './FinalCta';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import LandingFooter from './LandingFooter';
import LandingNav from './LandingNav';
import Languages from './Languages';

export default function LandingPage() {
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
```

- [ ] **Step 9: Run tests to green**

Run: `cd client && npx vitest run src/Pages/LandingPage/LandingPage.test.tsx`
Expected: PASS (all five landing tests).

- [ ] **Step 10: Lint, format, build**

Run: `make prettier-client && make lint-client && cd client && npm run build`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add client/src/Pages/LandingPage
git commit -m "feat(client): landing page content sections"
```

---

## Task 3: SEO & social meta (index.html, robots, sitemap)

**Files:**
- Modify: `client/index.html`
- Create: `client/public/robots.txt`
- Create: `client/public/sitemap.xml`
- Test: `client/src/test/seoMeta.test.ts`

**Interfaces:**
- No runtime interfaces; the test reads `client/index.html` from disk.

- [ ] **Step 1: Write the failing SEO test**

`client/src/test/seoMeta.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

describe('index.html marketing meta', () => {
  it('has a descriptive title and description', () => {
    expect(html).toMatch(/<title>Lengua[^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
  });

  it('has Open Graph and Twitter card tags', () => {
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('name="twitter:card"');
  });

  it('has a canonical link and theme color', () => {
    expect(html).toContain('rel="canonical"');
    expect(html).toMatch(/name="theme-color" content="#2C4EBD"/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd client && npx vitest run src/test/seoMeta.test.ts`
Expected: FAIL — current `index.html` has the Vite default head.

- [ ] **Step 3: Rewrite `client/index.html` head**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#2C4EBD" />

    <title>Lengua — Learn exactly the words you need</title>
    <meta
      name="description"
      content="Lengua builds your vocabulary from the words you actually run into, then drills them with spaced repetition and voice practice so you can say them. Break through the intermediate plateau."
    />
    <link rel="canonical" href="https://www.lengua-app.com/" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.lengua-app.com/" />
    <meta property="og:title" content="Lengua — Learn exactly the words you need" />
    <meta
      property="og:description"
      content="The words you need, exactly when you need them. Personalized vocabulary, spaced repetition, and voice practice to break through the plateau."
    />
    <meta property="og:image" content="https://www.lengua-app.com/og-image.png" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Lengua — Learn exactly the words you need" />
    <meta
      name="twitter:description"
      content="Personalized vocabulary, spaced repetition, and voice practice to break through the intermediate plateau."
    />
    <meta name="twitter:image" content="https://www.lengua-app.com/og-image.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Note: `favicon.svg` and `og-image.png` are referenced but generating final art is out of scope — if they are not present before launch, flag it in the final report (broken favicon/og-image is a launch blocker for ads). A simple SVG favicon may be added to `client/public/favicon.svg` opportunistically.

- [ ] **Step 4: Create robots.txt**

`client/public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://www.lengua-app.com/sitemap.xml
```

- [ ] **Step 5: Create sitemap.xml**

`client/public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.lengua-app.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 6: Run the SEO test to green**

Run: `cd client && npx vitest run src/test/seoMeta.test.ts`
Expected: PASS.

- [ ] **Step 7: Full client gate**

Run: `make prettier-client && make lint-client && make test-client && cd client && npm run build`
Expected: all pass; `dist/` contains `robots.txt` and `sitemap.xml`.

- [ ] **Step 8: Commit**

```bash
git add client/index.html client/public/robots.txt client/public/sitemap.xml client/src/test/seoMeta.test.ts
git commit -m "feat(client): landing page SEO and social meta"
```

---

## Copy Deck

`client/src/Pages/LandingPage/content.ts`:

```ts
export const LANDING = {
  brand: 'Lengua',
  nav: {
    signIn: 'Sign in',
    cta: 'Get started',
  },
  hero: {
    title: 'Exactly the words you need, exactly when you need them.',
    sub: "Lengua learns your level and your life, so you're always practicing exactly the vocabulary you need next — never the words you don't.",
    primaryCta: 'Get started — free',
    secondaryCta: 'See how it works',
    micro: 'No password. No email. Just Google.',
  },
  reframe:
    "You understand far more than you can say. That's the plateau — and it's not more grammar drills that get you past it. It's the specific words of your own life, learned until you can speak them.",
  how: {
    heading: 'Look it up. Keep it. Say it back.',
    steps: [
      {
        title: 'Look it up',
        body: "Hit a word you don't know — in a conversation, a show, a street sign. Look it up and get the translation and pronunciation instantly.",
      },
      {
        title: 'Keep it',
        body: "Save it to your deck in one tap. Lengua schedules it to come back right before you'd forget it.",
      },
      {
        title: 'Say it back',
        body: "Practice out loud. Lengua listens and quizzes you until the word is yours — not just recognized, but spoken.",
      },
    ],
  },
  features: [
    {
      title: 'Learn from your life, not a textbook',
      body: 'Your deck is built from the words you actually ran into — never a generic list. Every card is something you already needed once and will need again.',
    },
    {
      title: 'Always the right word at the right level',
      body: "Spaced repetition tracks what's sticking and what's slipping, surfacing each word at the exact moment it's about to fade. It scales from your first hundred words to your ten-thousandth.",
    },
    {
      title: "Say it out loud, so it's there when you need it",
      body: "Reading a word isn't knowing it. Voice practice makes you produce the word from memory — so it's ready when you're mid-sentence and reaching for it.",
    },
  ],
  languages: {
    heading: 'Start in Spanish, Portuguese, or Japanese.',
    sub: 'More languages on the way.',
  },
  finalCta: {
    heading: 'Break through the plateau.',
    sub: 'The words you need are the ones you keep reaching for. Start keeping them.',
    cta: 'Get started — free',
  },
  footer: {
    tagline: 'No password. No email.',
    copyright: '© 2026 Lengua',
  },
} as const;
```

---

## Stylesheet

`client/src/Pages/LandingPage/LandingPage.css`:

```css
/* Landing page — scoped cobalt theme. Tokens live here (NOT global :root) so the
   rest of the app keeps the existing Nocturne styling. */
.lp {
  --lp-bg: #2c4ebd;
  --lp-on-bg: #ffffff;
  --lp-on-bg-muted: rgba(255, 255, 255, 0.72);
  --lp-surface: #fbfaf7;
  --lp-on-surface: #1b1e27;
  --lp-on-surface-muted: #5b5f6c;
  --lp-btn: #ffffff;
  --lp-btn-text: #1b1e27;
  --lp-radius-pill: 999px;
  --lp-radius-lg: 20px;
  --lp-maxw: 1080px;

  background: var(--lp-bg);
  color: var(--lp-on-bg);
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.5;
}

.lp * {
  box-sizing: border-box;
}

.lp-container {
  width: 100%;
  max-width: var(--lp-maxw);
  margin: 0 auto;
  padding: 0 24px;
}

/* Buttons */
.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  padding: 0 28px;
  border-radius: var(--lp-radius-pill);
  background: var(--lp-btn);
  color: var(--lp-btn-text);
  font-weight: 600;
  font-size: 16px;
  text-decoration: none;
  border: none;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.lp-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}
.lp-btn--sm {
  height: 40px;
  padding: 0 18px;
  font-size: 14px;
}
.lp-link {
  color: var(--lp-on-surface-muted);
  text-decoration: none;
  font-weight: 500;
}
.lp-link--light {
  color: var(--lp-on-bg-muted);
}
.lp-link:hover {
  opacity: 0.85;
}

/* Nav */
.lp-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: var(--lp-maxw);
  margin: 0 auto;
  padding: 18px 24px;
  backdrop-filter: blur(6px);
}
.lp-nav__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--lp-on-bg);
  font-weight: 700;
  font-size: 20px;
  text-decoration: none;
  letter-spacing: -0.01em;
}
.lp-nav__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.lp-nav__actions .lp-link {
  color: var(--lp-on-bg-muted);
}
.lp-mark {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--lp-on-bg);
}

/* Hero */
.lp-hero {
  max-width: var(--lp-maxw);
  margin: 0 auto;
  padding: 64px 24px 88px;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  align-items: center;
}
.lp-hero__title {
  font-size: clamp(36px, 5vw, 60px);
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-weight: 700;
  margin: 0 0 20px;
}
.lp-hero__sub {
  font-size: 19px;
  color: var(--lp-on-bg-muted);
  max-width: 42ch;
  margin: 0 0 32px;
}
.lp-hero__actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.lp-hero__micro {
  margin: 18px 0 0;
  font-size: 13px;
  color: var(--lp-on-bg-muted);
}
.lp-hero__art {
  display: flex;
  justify-content: center;
}
.lp-phone {
  width: 100%;
  max-width: 320px;
  background: var(--lp-surface);
  color: var(--lp-on-surface);
  border-radius: var(--lp-radius-lg);
  padding: 28px 24px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
}
.lp-phone__label {
  font-size: 14px;
  color: var(--lp-on-surface-muted);
  margin: 0 0 6px;
}
.lp-phone__answer {
  font-size: 26px;
  font-weight: 600;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.lp-phone__ipa {
  font-size: 14px;
  color: var(--lp-on-surface-muted);
  margin: 0 0 20px;
}
.lp-phone__chip {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: var(--lp-bg);
  background: color-mix(in srgb, var(--lp-bg) 14%, transparent);
  padding: 6px 12px;
  border-radius: var(--lp-radius-pill);
}

/* Reframe band */
.lp-reframe {
  background: var(--lp-bg);
  padding: 8px 0 64px;
}
.lp-reframe p {
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.3;
  font-weight: 500;
  letter-spacing: -0.01em;
  max-width: 24ch;
  color: var(--lp-on-bg);
}

/* Generic section */
.lp-section {
  padding: 88px 0;
}
.lp-section--surface {
  background: var(--lp-surface);
  color: var(--lp-on-surface);
}
.lp-section--cobalt {
  background: var(--lp-bg);
  color: var(--lp-on-bg);
}
.lp-section__title {
  font-size: clamp(28px, 4vw, 40px);
  letter-spacing: -0.02em;
  font-weight: 700;
  margin: 0 0 40px;
}

/* Steps */
.lp-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}
.lp-step {
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--lp-on-surface) 10%, transparent);
  border-radius: var(--lp-radius-lg);
  padding: 28px;
}
.lp-step__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--lp-radius-pill);
  background: var(--lp-bg);
  color: #fff;
  font-weight: 700;
  margin-bottom: 16px;
}
.lp-step__title {
  font-size: 20px;
  margin: 0 0 8px;
}
.lp-step__body {
  color: var(--lp-on-surface-muted);
  margin: 0;
}

/* Feature rows (alternating surface/cobalt via nth-child) */
.lp-feature {
  padding: 80px 0;
}
.lp-feature:nth-child(even) {
  background: var(--lp-surface);
  color: var(--lp-on-surface);
}
.lp-feature__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}
.lp-feature--flip .lp-feature__copy {
  order: 2;
}
.lp-feature__title {
  font-size: clamp(26px, 3.4vw, 36px);
  letter-spacing: -0.02em;
  margin: 0 0 16px;
}
.lp-feature__body {
  font-size: 18px;
  color: color-mix(in srgb, currentColor 70%, transparent);
  max-width: 46ch;
  margin: 0;
}
.lp-feature__art {
  height: 260px;
  border-radius: var(--lp-radius-lg);
  background: linear-gradient(140deg, var(--lp-bg), #5566d8);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

/* Languages + final CTA */
.lp-langs,
.lp-final {
  text-align: center;
}
.lp-langs__sub,
.lp-final__sub {
  color: var(--lp-on-bg-muted);
  font-size: 18px;
  margin: 0 auto 28px;
  max-width: 40ch;
}
.lp-final__title {
  font-size: clamp(32px, 5vw, 52px);
  letter-spacing: -0.02em;
  margin: 0 0 16px;
}

/* Footer */
.lp-footer {
  background: #10163a;
  color: var(--lp-on-bg);
  padding: 40px 0;
}
.lp-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.lp-footer__brand {
  font-weight: 700;
  margin-right: 12px;
}
.lp-footer__tag {
  color: var(--lp-on-bg-muted);
  font-size: 14px;
}
.lp-footer__links {
  display: flex;
  gap: 20px;
}
.lp-footer__links .lp-link {
  color: var(--lp-on-bg-muted);
}
.lp-footer__copy {
  color: var(--lp-on-bg-muted);
  font-size: 13px;
}

/* Legal placeholder */
.lp-legal {
  max-width: 640px;
  margin: 0 auto;
  padding: 80px 24px;
  color: var(--color-text);
}

/* Responsive */
@media (max-width: 860px) {
  .lp-hero,
  .lp-feature__inner {
    grid-template-columns: 1fr;
  }
  .lp-hero__art {
    order: -1;
  }
  .lp-feature--flip .lp-feature__copy {
    order: 0;
  }
  .lp-steps {
    grid-template-columns: 1fr;
  }
}
```

---

## Self-Review Notes

- **Spec coverage:** routing swap (Task 1), all page sections incl. reframe/plateau (Tasks 1–2), scoped cobalt tokens (Task 1 CSS), Google-only CTAs to `/login` (Tasks 1–2), SEO/OG/robots/sitemap (Task 3), tests (all tasks). Footer Privacy/Terms resolved via minimal `LegalPage` so links aren't broken.
- **Out of scope (from spec):** app-wide restyle, Apple sign-in, inline hero auth, SSR — none included.
- **Known launch flags (report, don't silently ship):** `favicon.svg` and `og-image.png` art are referenced in `index.html` but real assets must be added before running paid ads; real Privacy/Terms copy must replace the `LegalPage` stub before ad platforms will approve.
- **Type consistency:** `LANDING` shape in Copy Deck matches every consumer (`hero`, `reframe`, `how.steps[]`, `features[]`, `languages`, `finalCta`, `footer`, `nav`, `brand`). `FeatureSection` props `{ feature, flip }` match the `.map` call in `LandingPage.tsx`.
```
