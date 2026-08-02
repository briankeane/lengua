# Sign in with Apple — Design

**Date:** 2026-08-01
**Status:** Approved

## Goal

Add a Sign in with Apple option to the server that mirrors the existing Google
sign-in flow. Reference implementation is `~/playola/playola/server`, but ported
to fit Lengua's lighter OAuth pattern rather than copied literally.

## Why not a literal port of Playola

Playola's Apple module is heavyweight and radio-app-specific: a separate
`appleUsers` table storing Apple's access/refresh tokens, five endpoints
(`mobile/authorize`, `web/authorize`, `mobile/signup`, `revoke`, `webhook`),
`authCode` token exchange, web-redirect flows to a `/spotifyAuth/success` page,
and marketing-conversion hooks. None of that matches how Lengua does OAuth.

Lengua's Google sign-in is a single `POST /v1/auth/google` taking `{ idToken }`,
verifying it, and upserting the user directly via a `googleId` column on `users`
— no provider table, no stored provider tokens. Apple mirrors that shape.

## Data model

- **Migration:** add a unique `appleId` `STRING` column to `users`, identical in
  shape to the existing `googleId` migration
  (`20260729112008-add-google-id-to-users.js`).
- **Model:** add `declare appleId: CreationOptional<string>;` and the matching
  `appleId: { type: DataTypes.STRING, unique: true }` init field to
  `user.model.ts`.
- No separate `appleUsers` table.

## Field mapping (store the Apple equivalent of what Google stores)

| Field             | Google source             | Apple source                                                      |
| ----------------- | ------------------------- | ----------------------------------------------------------------- |
| `appleId` (new)   | `googleId` = `sub`        | `sub` from verified identity token                                |
| `email`           | token `email`             | token `email`, else placeholder `apple-${sub}@lengua.placeholder` |
| `firstName`       | `given_name` ?? localpart | **body** `firstName` ?? email localpart                           |
| `lastName`        | `family_name` ?? `''`     | **body** `lastName` ?? `''`                                       |
| `verifiedEmail`   | `email`                   | `email` (when present)                                            |
| `profileImageUrl` | `picture`                 | — (Apple provides none)                                           |

Apple returns the user's name only once, to the iOS client, on first
authorization — never in the identity token. So the endpoint accepts optional
`firstName`/`lastName` in the body (as Playola's mobile signup does) and the
client forwards them.

`email_verified` does **not** gate sign-in (an unverified claim still logs the
user in via the placeholder path, so no legitimate user — including Hide-My-Email
relay users — is ever rejected). But the email is only **trusted** — for matching
an existing account and for setting `verifiedEmail` — when Apple marks it
verified. Apple returns `email_verified` as a boolean `true` or the string
`"true"`; both count. An unverified email falls through to the placeholder,
closing the account-takeover vector where an attacker-controlled Apple subject
could otherwise link to an existing email account.

## Dependency

Add `apple-signin-auth` (the package Playola uses).

## Config

Add `APPLE_CLIENT_ID` (native iOS bundle id) to `envVars` and `Config`. Used as
the `verifyIdToken` audience. Single value for now; extendable to an array (like
Google's `[GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID]`) if a web services id is
added later.

## Lib (`lib/auth/auth.lib.ts`)

`appleSignInWithIdentityToken({ identityToken, firstName?, lastName? })`:

1. Guard: throw `ValidationError('Apple sign-in is not configured')` if no
   `APPLE_CLIENT_ID`.
2. `appleSignIn.verifyIdToken(identityToken, { audience: config.APPLE_CLIENT_ID })`;
   on failure throw `AuthenticationError('Apple authentication failed')`.
3. `upsertAppleUser` helper mirroring `upsertGoogleUser`: find by `appleId` →
   return; find by `email` → link `appleId` (reject if already linked to a
   different Apple id); else create. Same `UniqueConstraintError` race retry.
4. `generateToken(user)` and return `{ user, token }`.

Export from `lib/auth/index.ts`.

## API

- `handleAppleSignIn` in `auth.api.ts` — reads `identityToken`, `firstName`,
  `lastName` from body; returns `{ user: user.jwtRepr(), token }` (identical
  response shape to Google).
- Route: `POST /v1/auth/apple` with `checkBodyFor(['identityToken'])` in
  `auth/index.ts`.

## Tests

- `auth.lib.test.ts`: new user, existing-by-appleId, link-by-email,
  name-from-body, name fallback to email localpart, email placeholder when
  token has none, invalid token → `AuthenticationError`, not-configured →
  `ValidationError`. Stub `appleSignIn.verifyIdToken` with Sinon.
- `auth.api.test.ts`: happy path (200 + `{ user, token }`), missing
  `identityToken` → 400, invalid token → 401 — mirroring the Google cases.

## Docs

Add the `POST /v1/auth/apple` endpoint to `auth.api.docs.yaml`.

## Explicitly dropped from Playola

`appleUsers` table, `authCode` token exchange, `revoke`, `webhook`, web-redirect
flows, `mobile/authorize`, marketing conversions, hardcoded bundle ids.
