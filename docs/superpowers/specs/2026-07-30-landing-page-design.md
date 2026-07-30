# Landing Page — Design Spec

**Date:** 2026-07-30
**Status:** Approved (pending user spec review)

## Purpose

Give Lengua a real marketing landing page at the site root (`/`), built for SEO
and paid-ad traffic. Today `/` renders the sign-in screen; a cold visitor from an
ad or search result lands on a login wall with no explanation of the product. This
replaces that with a page that explains the product, sells the wedge, and funnels
visitors to sign-in.

## Product (what we're selling)

Lengua builds your vocabulary from the words **you actually run into** — you look up
a phrase, keep it in your own deck, and the app drills it with spaced repetition and
voice practice until you can say it. Not a canned curriculum: your words, at your
level, surfaced right when you need them next.

The three-beat loop, straight from the app: **Look it up → Keep it → Say it back.**

## Positioning & Copy

- **Target learner:** the **intermediate learner stuck on the plateau** — past the
  basics, understands a lot, but can't break through because textbook vocabulary is
  behind them and progress now depends on the specific words of their own life. The
  page speaks to that plateau while making clear Lengua works for beginners and
  advanced learners too. Leans on the "I understand but can't *speak*" pain and the
  "generic courses teach words I'll never use" frustration.
- **H1:** Exactly the words you need, exactly when you need them.
- **Subhead:** Lengua learns your level and your life, so you're always practicing
  exactly the vocabulary you need next — never the words you don't.
- **Primary CTA label:** "Get started — free" (routes to `/login`).
- **Voice:** confident, plain, a little playful (matches the `¿ ?` wordmark).

## Visual Design

New cobalt theme, sampled from the current auth-screen mockup:

| Token | Value | Use |
| --- | --- | --- |
| `--lp-bg` | `#2C4EBD` | cobalt hero / dark sections |
| `--lp-on-bg` | `#FFFFFF` | text on cobalt |
| `--lp-on-bg-muted` | `rgba(255,255,255,0.72)` | subheads on cobalt |
| `--lp-surface` | `#FBFAF7` | white/off-white sections |
| `--lp-on-surface` | `#1B1E27` | text on white |
| `--lp-on-surface-muted` | `#5B5F6C` | subheads on white |
| `--lp-btn` | `#FFFFFF` | pill button fill on cobalt |
| `--lp-btn-text` | `#1B1E27` | pill button text |
| `--lp-radius-pill` | `999px` | fully rounded buttons |

- Buttons are white, fully-rounded pills with near-black text (matches auth screen).
- Sections **alternate cobalt ↔ off-white** for rhythm and to make app screenshots pop.
- Font: Inter (already loaded); wordmark uses a heavier/rounded weight to echo the mockup.
- Mobile-first; everything collapses to a single centered column.

These tokens are **scoped to the landing page** (defined in `LandingPage.css`, not the
global `:root`) so this PR does not silently restyle the rest of the app. Aligning the
whole app to the cobalt theme is separate, out-of-scope work.

## Page Structure

1. **Sticky nav** — wordmark + icon (left); "Sign in" text link + "Get started" pill (right).
   Transparent over hero, gains a subtle background on scroll.
2. **Hero** (cobalt) — H1, subhead, primary CTA pill, and a phone mockup of the app.
3. **Reframe band** (one line) — kills the generic-course objection, e.g.
   *"Textbooks teach 'the turtle eats lettuce.' You'll learn what you actually say."*
4. **How it works — 3 steps** — Look it up → Keep it → Say it back, each with a heading,
   one line, and a small app visual.
5. **Three feature sections** (alternating cobalt/white):
   - *Learn from your life* — capture the words you actually run into.
   - *Always the right level* — spaced repetition that adapts; the right word at the right time.
   - *Say it out loud* — voice practice so words become speech, not trivia.
6. **Languages band** — Spanish · Portuguese · Japanese (+ "more coming").
7. **Final CTA** (cobalt) — restatement of the promise + Get started button.
8. **Footer** — wordmark, Privacy / Terms / contact, "No password. No email." nod, © line.

## Architecture

- **New page:** `client/src/Pages/LandingPage/LandingPage.tsx` + `LandingPage.css`.
  Presentational only — no auth logic. CTAs are `react-router-dom` `<Link>`s to `/login`.
  Broken into small sub-components (`Hero`, `HowItWorks`, `Feature`, `Footer`, etc.) in
  the same folder so each section stays independently readable and testable.
- **Routing** (`client/src/Routes/AppRoutes.tsx`):
  - `index` (`/`) → `LandingPage` (public)
  - `/login`, `/signup` → `AuthPage` (unchanged; still Google-only OAuth)
  - `/dashboard` → protected (unchanged)
- **Auth entry:** landing is one tap from sign-in via `/login`. Inlining the real
  `ContinueWithGoogleButton` into the hero for one-click signup is a possible future
  conversion optimization, explicitly out of scope here to keep the page presentational.
- **Assets:** app screenshots/mockups live in `client/public/` (or `src/assets/`).
  A lightweight CSS/SVG mock of an app screen is acceptable for v1 if real screenshots
  aren't ready.

## SEO & Ads

- Rewrite `client/index.html` `<head>`:
  - Real `<title>` and `<meta name="description">`.
  - Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) and
    Twitter Card tags for ad/social unfurls.
  - `<link rel="canonical">`, `lang="en"`, favicon/app-icon, theme-color `#2C4EBD`.
- Add `client/public/robots.txt` (allow all, point to sitemap) and
  `client/public/sitemap.xml` (root URL).
- Semantic HTML: one `<h1>`, section `<h2>`s, `<header>`/`<main>`/`<footer>` landmarks,
  descriptive `alt` text, accessible contrast.
- **SPA caveat:** Vite ships a client-rendered SPA. Static `<head>` meta in `index.html`
  covers crawlers and social unfurls for the root URL, which is what ads/SEO need here.
  Full SSR/prerendering for richer per-route SEO is noted as a future upgrade, out of scope.

## Testing

Vitest + React Testing Library (`LandingPage.test.tsx`), behavior-focused:

- Renders exactly one `<h1>` with the headline text.
- Primary CTA and nav "Get started" link to `/login`.
- Each of the three "how it works" steps renders.
- Footer renders Privacy/Terms links.

Routing test: `/` renders LandingPage (not AuthPage); `/login` still renders AuthPage.

## Out of Scope

- Restyling the rest of the app (auth screen, dashboard) to the cobalt theme.
- Apple sign-in on the website (Google-only per this decision).
- Inline one-click Google auth in the hero.
- SSR / prerendering.
- Real testimonial or metric social proof (none exist yet).

## Success Criteria

- Visiting `/` shows the landing page; `/login` still shows Google sign-in.
- H1, subhead, three-step loop, feature sections, and dual CTAs all present.
- `index.html` carries title, description, OG/Twitter tags; `robots.txt` + `sitemap.xml` exist.
- Matches the cobalt theme; responsive from mobile to desktop.
- `make lint-client`, `make test-client`, and the client build all pass.
