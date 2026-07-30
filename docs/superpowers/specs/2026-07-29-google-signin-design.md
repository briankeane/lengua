# Google Sign-in / Sign-up — Design

**Date:** 2026-07-29
**Status:** Approved pending review
**Branch:** briankeane/google-signin-mockup

## Goal

Replace the scaffold's email/password auth UI with **Google-only** sign-in that
matches the `mockups/lengua-ux/` prototype: a single custom-styled **"Continue
with Google"** button on a dark (Nocturne) screen, "No password. No email."

Sign-up and sign-in are the same action — Google authenticates, the server
finds-or-creates the user.

## Decisions (locked with product owner)

1. **Custom button + OAuth authorization-code flow** (not the ID-token rendered
   button, not the implicit access-token flow). Keeps the custom mockup button.
2. **Keep the scaffold's JWT session** — `generateToken()` HS256 bearer token,
   returned in the response body, stored in `localStorage`, sent as
   `Authorization: Bearer`. No cookie migration in this PR.
3. **Harden the account model** — add a `googleId` (Google `sub`) column, link by
   `sub`, and gate on `email_verified === true`.

## Current state

- Server already has `googleSignIn({ idToken })` (verifies an ID token via
  `google-auth-library`), a `POST /v1/auth/google` route, `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` / `GOOGLE_SIGNIN_REDIRECT_URI` config, and passing tests
  that stub `OAuth2Client.prototype.verifyIdToken`.
- Client `authService.googleAuth()` POSTs `{ credential }` (mismatched with the
  server's `{ idToken }`); no button, no SDK, no `VITE_GOOGLE_CLIENT_ID`.
- The chosen flow changes the server contract from `{ idToken }` to `{ code }`,
  so the existing ID-token endpoint/lib/tests are reworked, not extended.

## Architecture — end-to-end flow

```
Client                                  Server                         Google
  |  click "Continue with Google"          |                              |
  |  useGoogleLogin({flow:'auth-code'})  --|----- consent popup --------->|
  |  <---------------- auth code ----------|------------------------------|
  |  POST /v1/auth/google { code }  ------>|                              |
  |                                        |  oAuth2Client.getToken(code) |
  |                                        |----- exchange code --------->|
  |                                        |<---- { id_token, ... } ------|
  |                                        |  verifyIdToken(id_token)     |
  |                                        |  (audience = GOOGLE_CLIENT_ID)|
  |                                        |  require email_verified      |
  |                                        |  find-or-create by sub/email |
  |                                        |  generateToken(user)         |
  |  <--- { user, token } (app JWT) -------|                              |
  |  save to localStorage, redirect        |                              |
```

The client popup flow uses `redirect_uri: 'postmessage'`; the server exchange
must pass the same `redirect_uri: 'postmessage'`.

## Server changes

**`db/models/user.model.ts` + migration**
- Add `googleId: CreationOptional<string>` — `STRING`, `unique`, nullable.
- New migration `add-google-id-to-users` adds the column + unique index.

**`lib/auth/auth.lib.ts`**
- Replace `googleSignIn({ idToken })` with `googleSignInWithCode({ code })`:
  1. `const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'postmessage')`
  2. `const { tokens } = await client.getToken(code)` → `tokens.id_token`
  3. `client.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID })`
  4. Throw `AuthenticationError` on missing/invalid token or
     `email_verified !== true`.
  5. Private `upsertGoogleUser(payload)`: find by `googleId = sub`, else by
     `email` (backfill `googleId`), else create with `googleId`, name, email,
     `verifiedEmail`, `profileImageUrl`.
  6. `return { user, token: await generateToken(user) }`.
- Keep `ValidationError` when `GOOGLE_CLIENT_ID` is unset.

**`api/auth/auth.api.ts` + `api/auth/index.ts`**
- `handleGoogleSignIn` reads `req.body.code`, calls `googleSignInWithCode`.
- Route: `checkBodyFor(['code'])`.

**`api/auth/auth.api.docs.yaml`** — update request body to `{ code }`.

## Client changes

**Dependency:** add `@react-oauth/google`.

**`main.tsx`** — wrap the app in
`<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>`.

**`Services/authService.ts`** — `googleAuth(code: string)` POSTs
`/v1/auth/google` with `{ code }`; drop the email/password `signup`/`login`
exports' UI usage (functions can remain until backend cleanup).

**`Contexts/AuthProvider.tsx`** — add `signInWithGoogle(code)` action that calls
`authService.googleAuth` then `handleAuthResponse`.

**`Components/ContinueWithGoogleButton.tsx`** (new) — custom outlined button
(Phosphor Google glyph + "Continue with Google"), styled with Nocturne tokens;
`useGoogleLogin({ flow: 'auth-code', onSuccess: r => signInWithGoogle(r.code) })`,
with error state.

**Auth screen** — collapse `LoginPage` + `SignupPage` into the single Nocturne
sign-in screen from the mockup (brand mark, tagline "Look it up. Keep it. Say it
back.", the Google button, "No password. No email."). Keep `/login` and
`/signup` routes both rendering it (or redirect `/signup` → `/login`). Remove
email/password form fields.

**Styling** — import the Nocturne `:root` design tokens (color/space/radius/font
from `mockups/lengua-ux/_ds/nocturne-*/styles.css`) into the client global CSS so
the auth screen matches. Full design-system adoption across all pages is a
follow-up, not this PR.

**Env** — `VITE_GOOGLE_CLIENT_ID` in client env + example.

## Security

- Verify ID token audience = `GOOGLE_CLIENT_ID` (already done by `verifyIdToken`).
- Require `email_verified === true` (new).
- Link accounts by Google `sub`, not email alone (new).
- `GOOGLE_CLIENT_SECRET` stays server-side; code exchange is server-side only.
- **Known follow-up (out of scope):** session lives in `localStorage` (XSS-exposed).
  Migrating to an HttpOnly, Secure, SameSite cookie is tracked separately.

## Testing

**Server (Mocha/Chai/Sinon, per `create-lib` + `create-endpoint`):**
- Lib: stub `OAuth2Client.prototype.getToken` → `{ tokens: { id_token } }` and
  `verifyIdToken` → payload. Cover: new user created with `googleId`; existing
  user matched by `sub`; existing user matched by `email` backfills `googleId`;
  `email_verified === false` rejected; `getToken` failure → auth error; missing
  `GOOGLE_CLIENT_ID` → validation error.
- API: rework existing `POST /v1/auth/google` tests to send `{ code }`; 400 when
  `code` missing; 200 returns `{ user, token }` with a valid JWT.

**Client (Vitest/RTL):**
- Auth screen renders the Google button + "No password. No email."; no
  email/password inputs.
- Mock `useGoogleLogin`; assert `signInWithGoogle` is called with the code and
  auth state updates.

## Out of scope / follow-ups

- HttpOnly cookie session migration.
- Apple sign-in.
- Full Nocturne design-system adoption beyond the auth screen.
- Removing the dormant email/password backend endpoints.

## Open questions

- Full-redirect variant vs popup: config's `GOOGLE_SIGNIN_REDIRECT_URI` implies a
  full-redirect design, but the popup auth-code flow (`redirect_uri: 'postmessage'`)
  is simpler and keeps the custom button. **Proposed: popup.** The redirect-URI
  config can stay for a future server-side redirect variant.
