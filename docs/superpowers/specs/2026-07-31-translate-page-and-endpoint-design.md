# Translate page + translation endpoint — design

**Date:** 2026-07-31
**Branch:** `briankeane/client-translate-page`
**Status:** Approved design (pending spec review)

## Goal

Port the iOS app's Translate page to the web client as a fully functional feature.
A signed-in user opens `/translate`, types (or dictates) text in one language,
and sees it translated into the other language, with the option to hear the
result spoken aloud. Direction is English↔Spanish, bidirectional, flipped by a
swap button.

Translation runs **server-side through DeepL** (the browser cannot translate
on-device the way the iOS app does with Apple's Translation framework), so this
work adds a backend translate endpoint in addition to the client page.

## Scope

**In scope**

- `POST /v1/translate` endpoint (auth-required) proxying DeepL.
- `TranslatePage` client feature: two-card layout, debounced auto-translate,
  direction swap, mic (speech-to-text) and speaker (text-to-speech).
- Protected `/translate` route + a `Translate` link in the existing top Navbar.

**Out of scope** (present in `mockups/lengua-ux` but not this pass)

- Recent-lookups list, save-as-card, pronunciation line.
- The other four tabs (Deck / Review / Talk / You) and a bottom tab bar.
- Migrating the rest of the client to the new indigo/blue theme (later, separate
  effort). This page's visuals are scoped so they don't touch global tokens.

## Product decisions (locked with user)

1. **Fully functional**, not a UI shell — real translation via a backend endpoint.
2. **DeepL** as the provider (keeps parity with the iOS roadmap's intended cloud
   provider). Key stays server-side.
3. **Faithful iOS visual port** — two stacked cards, indigo/blue palette. This is
   the new theme direction the team will migrate the rest of the client toward
   later; for now it is scoped to this page.
4. **Navbar link + protected `/translate` route** (no bottom tab bar yet).
5. **Mic & speaker wired functionally** via the browser Web Speech API, as
   progressive enhancement (degrade gracefully when unsupported).
6. **Swap** flips direction **and** moves the current output text into the input,
   then re-translates (standard translate-app behavior).
7. Add `RateLimitError` (429) and `UpstreamError` (502) to the shared error
   handler so DeepL failures surface distinctly (vs. a plain 500).

This intentionally diverges from CLAUDE.md's "Nocturne dark is the canonical web
UX" line — a deliberate product call to adopt the iOS look as the new direction.

## API contract

`POST /v1/translate` — requires a valid access token (`authenticateAccessToken`).

Request body:

```ts
type TranslationDirection = 'en-es' | 'es-en';

type TranslateRequest = {
  text: string; // max 5000 chars
  direction: TranslationDirection;
};
```

Response `200`:

```ts
type TranslateResponse = {
  text: string; // translated text; '' for blank input
  direction: TranslationDirection;
};
```

Rules:

- Blank / whitespace-only `text` → `200 { text: '', direction }` with **no DeepL
  call** (mirrors iOS's blank short-circuit).
- `text` is sent to DeepL as typed (after the blank check); only the length guard
  rejects it.

Chosen `direction` (not `{ source, target }`) because only two pairs exist;
`{ source, target }` would invite unsupported combinations and duplicate
validation. A shared client/server enum package is deliberately **not** created —
the server owns the canonical enum, the client mirrors it, and the API docs +
tests are the contract. Revisit only if the repo grows real shared build plumbing.

## Server design

### File layout (follows the per-module convention)

```
server/src/api/translate/
  index.ts                  # exports the router
  translate.api.ts          # controller: reads body, calls lib, sends response
  translate.api.test.ts     # Supertest integration tests (Nock-mocked DeepL)
  translate.api.docs.yaml   # OpenAPI

server/src/lib/translate/
  index.ts
  translate.lib.ts          # translateText(): rules + direction mapping
  translate.lib.test.ts     # unit tests (provider injected/mocked)
  deeplProvider.ts          # DeepL HTTP call (native fetch + timeout)
```

Mount in `server/src/api/routes.ts`: `app.use('/v1/translate', translateApi)`.

### Route middleware chain

```ts
router.post(
  '/',
  authenticateAccessToken,
  checkBodyFor(['text', 'direction']),
  checkBodyForNoExtraFields(['text', 'direction']),
  checkBodyEnum('direction', TRANSLATION_DIRECTIONS),
  handleTranslate,
);
```

### Direction table (single source of truth on the server)

```ts
export const TRANSLATION_DIRECTIONS = ['en-es', 'es-en'] as const;
export type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number];

// DeepL language codes per direction
const DIRECTION_TO_DEEPL = {
  'en-es': { source: 'EN', target: 'ES' },
  'es-en': { source: 'ES', target: 'EN' },
} as const;
```

### Lib layer

```ts
translateText(
  { text, direction }: TranslateRequest,
  provider: TranslateProvider = deeplProvider,
): Promise<TranslateResponse>
```

- Enforces `MAX_INPUT_LENGTH = 5000` → throws `ValidationError` if exceeded.
- Blank/whitespace `text` → returns `{ text: '', direction }` without calling the
  provider.
- Maps `direction` → DeepL source/target and calls `provider.translate(...)`.

Provider seam (keeps DeepL swappable and easy to mock):

```ts
type TranslateProvider = {
  translate(input: {
    text: string;
    sourceLang: 'EN' | 'ES';
    targetLang: 'EN' | 'ES';
  }): Promise<string>;
};
```

### DeepL provider

- Uses Node 22 native `fetch` (no axios added to the server).
- Reads `DEEPL_API_KEY` from config; if absent, throws `ServerError` (500).
- Applies a request timeout (via `AbortSignal.timeout`) so a slow DeepL call
  can't hang the Express worker.
- Translates DeepL outcomes into domain errors; **never leaks DeepL's response
  body**:
  - DeepL `429` → `RateLimitError` (429)
  - DeepL other 4xx / 5xx / network / timeout → `UpstreamError` (502)

### Config

`DEEPL_API_KEY` added to the **optional** env-var list (so local/test boot does
not require a real key). It's guarded at call time in the provider. Production is
expected to set it; a missing key at call time returns 500.

### Error handling additions

Add to `server/src/utils/errors.ts`:

```ts
export class RateLimitError extends AppError {}
export class UpstreamError extends AppError {}
```

Add mappings to `server/src/middleware/errorHandler.ts`:

```ts
} else if (error instanceof RateLimitError) {
  statusCode = 429;
} else if (error instanceof UpstreamError) {
  statusCode = 502;
}
```

Full mapping:

| Condition                         | Status | Error              |
| --------------------------------- | ------ | ------------------ |
| Missing `text` or `direction`     | 400    | `ValidationError`  |
| Unsupported `direction`           | 400    | `ValidationError`  |
| Extra body fields                 | 400    | `ValidationError`  |
| `text` too long (>5000)           | 400    | `ValidationError`  |
| Blank `text`                      | 200    | `{ text: '' }`     |
| Unauthenticated                   | 401    | `AuthenticationError` |
| Missing `DEEPL_API_KEY` at call   | 500    | `ServerError`      |
| DeepL 429                         | 429    | `RateLimitError`   |
| DeepL other failure / timeout     | 502    | `UpstreamError`    |

## Client design

### File layout

```
client/src/Pages/TranslatePage/
  TranslatePage.tsx          # presentational two-card layout
  TranslatePage.test.tsx
  TranslatePage.css          # indigo/blue theme, scoped under .translate-page
  useTranslation.ts          # state + debounce + stale-response guard
  useSpeechRecognition.ts    # mic (speech-to-text)
  useSpeechSynthesis.ts      # speaker (text-to-speech)

client/src/Services/translateService.ts
```

### Service

```ts
export type TranslationDirection = 'en-es' | 'es-en';

export async function translate(
  params: { text: string; direction: TranslationDirection },
  signal?: AbortSignal,
): Promise<{ text: string; direction: TranslationDirection }> {
  const { data } = await apiClient.post('/v1/translate', params, { signal });
  return data;
}
```

Uses the existing `apiClient` (axios; attaches the bearer token via interceptor).

### `useTranslation` hook

State: `direction`, `inputText`, `outputText`, `loading`, `error`.

Behavior:

- Debounce input (~400ms) before calling `translate`.
- Whitespace-only input → clear output/error, abort any in-flight request, no call.
- Every new translate aborts the previous request (`AbortController`) **and**
  bumps a monotonic request id; a response is applied only if its id is still the
  latest. Both guards together — abort alone still races around mocks/promises —
  so a slow earlier translation can never overwrite a newer result.
- `swap()`: abort in-flight, flip `direction`, move current `outputText` into
  `inputText` (and clear `outputText`), which triggers a re-translate via the
  normal debounced path.

The page component is otherwise presentational.

### Speech hooks (progressive enhancement)

`useSpeechRecognition({ locale, onFinalText })`:

- `SpeechRecognition` / `webkitSpeechRecognition`; `continuous: false`,
  `interimResults: true` for live UI but only the **final** transcript is
  committed to the input (avoids translation churn on every interim word).
- `lang` = source speech locale for the current direction (`en-US` / `es-ES`).
- Reports an `isSupported` flag; the page **hides/disables the mic** when false.
- Stops recognition on direction swap and on unmount; ignores events that arrive
  after stop/unmount.

`useSpeechSynthesis({ locale })`:

- Speaks the output via `speechSynthesis`; picks a voice whose `lang` starts with
  the target prefix (`es` / `en`), handling async `voiceschanged`.
- Cancels current speech before speaking again / on swap / on unmount.
- Speaker button disabled when there's no output or synthesis is unsupported.

### Direction / speech locales

| direction | input label | output label | mic locale | speak locale |
| --------- | ----------- | ------------ | ---------- | ------------ |
| `en-es`   | English     | Spanish      | en-US      | es-ES        |
| `es-en`   | Spanish     | English      | es-ES      | en-US        |

### Navigation

- `routeChildren.tsx`: add `{ path: 'translate', element: <ProtectedRoute><TranslatePage/></ProtectedRoute> }`.
- `Navbar.tsx`: add a `Translate` link inside the authenticated block (near
  `Dashboard`).

### Visuals

Faithful port of the iOS Translate page: source input card on top (mic button
bottom-right), target output card below (speaker button bottom-right), swap
button overlapping between them. Indigo/blue palette matching the iOS colors, all
selectors scoped under `.translate-page` so global Nocturne tokens are untouched
this pass.

## Testing strategy

Follow the repo's TDD order (lib → api → client).

**Server lib** (`translate.lib.test.ts`):

- Blank input returns `{ text: '' }` and does not call the provider.
- `en-es` maps EN→ES; `es-en` maps ES→EN (assert provider called with right langs).
- Input > 5000 chars throws `ValidationError`.
- Provider failure propagates as the mapped error.

**Server API** (`translate.api.test.ts`, Supertest + Nock):

- 401 without auth.
- 400 missing fields / unsupported direction / extra fields / too long.
- 200 blank text with **no** Nock DeepL interceptor hit.
- 200 with DeepL mocked success.
- 429 and 502 mapping from mocked DeepL failures.

**Client** (Vitest + RTL):

- Protected `/translate` route renders `TranslatePage` when authenticated.
- Navbar shows `Translate` only when authenticated.
- Blank input does not call the service.
- Debounced typing calls the service once; result renders in the output card.
- A stale (slower) response does not overwrite a newer response.
- Swap aborts/invalidates the in-flight request, flips labels, moves output→input.
- Mic hidden/disabled when `SpeechRecognition` is unsupported.
- Speaker disabled when there's no output.

## Risks / gotchas (ranked)

1. **Cost abuse.** Even authenticated, the endpoint spends money per call. Auth +
   5000-char cap + provider timeout are the first line; per-user/IP rate limiting
   is a sensible follow-up (noted, not built this pass).
2. **Stale translations.** Debounce without abort + request-id guard produces
   wrong UI under normal fast typing. Both guards are required.
3. **Web Speech inconsistency.** Mic support is undependable (Firefox poor, Safari
   gesture/permission quirks, events after stop). Treat strictly as progressive
   enhancement.
4. **Provider leakage.** Do not surface DeepL error bodies / quota details to the
   client.
5. **Env handling.** Fail clearly when the key is missing in prod, but never make
   local/test boot require a real DeepL key.
6. **Theme blast radius.** Keep the new visual direction scoped to `.translate-page`.

## Architecture provenance

Design reviewed with Codex (consult session `019fb7e1-32be-71d2-886c-ab33317b087d`)
against the actual repo conventions before approval.
