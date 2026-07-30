# Client mockups

Canonical UX reference for the Lengua client. When building or reviewing client
UI, work from these — match the layout, copy, and design tokens.

## lengua-ux

A single-file [DesignCode](https://designcode) prototype of the whole app on the
**Nocturne** dark design system.

- `Lengua.dc.html` — the prototype. Seven screens driven by internal state:
  **sign-in, lookup, deck, review, summary, voice, settings**.
- `support.js` — the DesignCode runtime that renders `<x-dc>` templates (React under the hood).
- `_ds/nocturne-*/` — the Nocturne design system: `styles.css` (all design tokens —
  `--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`), `readme.md`
  (usage guidance), and `_ds_manifest.json` (machine-readable token list).

### Viewing it

Open `Lengua.dc.html` in a browser (it loads its runtime and stylesheet by relative path).

### Auth direction

Sign-in is **OAuth-only, Google only** — a single "Continue with Google" button,
"No password. No email." No email/password in the client UI.
