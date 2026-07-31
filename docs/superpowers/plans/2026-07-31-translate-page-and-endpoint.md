# Translate Page + Translation Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully functional web Translate page (English↔Spanish) backed by a new server endpoint that proxies DeepL.

**Architecture:** A new `POST /v1/translate` endpoint (auth-required) validates input and calls a `translate` lib, which short-circuits blank input and otherwise delegates to a swappable DeepL provider (native `fetch`, error-mapped). The client adds a `TranslatePage` (faithful iOS two-card port) driven by a `useTranslation` hook (debounce + AbortController + request-id stale guard) and two Web Speech API hooks for mic/speaker, reached via a protected `/translate` route and a Navbar link.

**Tech Stack:** Server — Node 22, TypeScript, Express 5, Mocha/Chai, Supertest, Nock v14 (intercepts native `fetch`), Sinon. Client — React, Vite, React Router, Vitest, React Testing Library.

## Global Constraints

- All new files are TypeScript. No new `.js` files.
- Server tests: Mocha + Chai (`assert`), Supertest for API, Nock for external HTTP. Co-located `*.test.ts`. DB clears between tests.
- Server external HTTP is mocked with **Nock** (nock `^14.0.11` intercepts global `fetch`). `disableNetConnect()` is on; only `127.0.0.1` is allowed, so every DeepL call in tests MUST be nocked.
- Endpoints call the lib layer; the lib throws custom errors from `server/src/utils/errors.ts`; `server/src/middleware/errorHandler.ts` maps them to HTTP statuses.
- API versioning under `/v1/`. Auth via `authenticateAccessToken`. Validation via `checkBodyFor` / `checkBodyForNoExtraFields` / `checkBodyEnum`.
- Language pair is exactly English↔Spanish. `direction` is `'en-es' | 'es-en'`. Max input length: **5000** chars. Blank/whitespace input returns `{ text: '', direction }` with no provider call.
- DeepL key comes from `DEEPL_API_KEY` (optional env var; guarded at call time — never require a real key for local/test boot). Never leak DeepL response bodies to the client.
- Client tests: Vitest + jsdom + React Testing Library. Use `renderWithProviders` from `client/src/test/testHelpers.tsx`.
- Run `make prettier-all` before any push. Server gate: `make build-server && make lint-server && make test-server`. Client gate: `make lint-client && make test-client`.
- Commit messages: no `Co-Authored-By` trailer.

---

## File Structure

**Server**

- `server/src/utils/errors.ts` — MODIFY: add `RateLimitError`, `UpstreamError`.
- `server/src/middleware/errorHandler.ts` — MODIFY: map the two new errors (429, 502).
- `server/src/config/envVars.ts` — MODIFY: add `DEEPL_API_KEY` to `optionalEnvVars`.
- `server/src/config/config.ts` — MODIFY: declare `DEEPL_API_KEY?` / `_DEEPL_API_KEY?` fields.
- `server/src/lib/translate/deeplProvider.ts` — CREATE: `TranslateProvider` type + `deeplProvider` (fetch + timeout + error mapping).
- `server/src/lib/translate/translate.lib.ts` — CREATE: direction constants + `translateText`.
- `server/src/lib/translate/index.ts` — CREATE: re-exports.
- `server/src/lib/translate/translate.lib.test.ts` — CREATE.
- `server/src/lib/translate/deeplProvider.test.ts` — CREATE.
- `server/src/api/translate/translate.api.ts` — CREATE: `handleTranslate` controller.
- `server/src/api/translate/index.ts` — CREATE: router.
- `server/src/api/translate/translate.api.test.ts` — CREATE.
- `server/src/api/translate/translate.api.docs.yaml` — CREATE.
- `server/src/api/routes.ts` — MODIFY: mount `/v1/translate`.

**Client**

- `client/src/Services/translateService.ts` — CREATE.
- `client/src/Services/translateService.test.ts` — CREATE.
- `client/src/Pages/TranslatePage/useTranslation.ts` — CREATE.
- `client/src/Pages/TranslatePage/useTranslation.test.ts` — CREATE.
- `client/src/Pages/TranslatePage/useSpeechRecognition.ts` — CREATE.
- `client/src/Pages/TranslatePage/useSpeechSynthesis.ts` — CREATE.
- `client/src/Pages/TranslatePage/speechHooks.test.ts` — CREATE.
- `client/src/Pages/TranslatePage/TranslatePage.tsx` — CREATE.
- `client/src/Pages/TranslatePage/TranslatePage.css` — CREATE.
- `client/src/Pages/TranslatePage/TranslatePage.test.tsx` — CREATE.
- `client/src/Routes/routeChildren.tsx` — MODIFY: add protected `/translate`.
- `client/src/Components/Navbar/Navbar.tsx` — MODIFY: add `Translate` link.
- `client/src/Components/Navbar/Navbar.test.tsx` — MODIFY: assert the link.

---

## Task 1: Error classes + handler mappings (429 / 502)

**Files:**
- Modify: `server/src/utils/errors.ts`
- Modify: `server/src/middleware/errorHandler.ts`
- Test: `server/src/middleware/errorHandler.test.ts`

**Interfaces:**
- Produces: `RateLimitError` (→429) and `UpstreamError` (→502), both extending `AppError`.

- [ ] **Step 1: Write the failing test** — append to `server/src/middleware/errorHandler.test.ts` (match the file's existing describe/style):

```ts
it('maps RateLimitError to 429', function () {
  const { req, res, next } = makeMocks(); // use whatever the file already uses to build mocks
  errorHandler(new RateLimitError('slow down'), req, res, next);
  assert.equal(res.statusCode, 429);
});

it('maps UpstreamError to 502', function () {
  const { req, res, next } = makeMocks();
  errorHandler(new UpstreamError('bad upstream'), req, res, next);
  assert.equal(res.statusCode, 502);
});
```

Import the new classes at the top: `import { RateLimitError, UpstreamError } from '../utils/errors';`. If the existing test file constructs req/res differently, mirror that exact pattern instead of `makeMocks()`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-server`
Expected: FAIL — `RateLimitError`/`UpstreamError` are not exported.

- [ ] **Step 3: Add the error classes** — in `server/src/utils/errors.ts`, next to the other `AppError` subclasses:

```ts
export class RateLimitError extends AppError {}
export class UpstreamError extends AppError {}
```

- [ ] **Step 4: Add the handler mappings** — in `server/src/middleware/errorHandler.ts`, import them and insert the branches in the `if/else` chain BEFORE the generic `else if (error instanceof AppError)` fallback (order matters — the generic `AppError` branch would otherwise catch them as 400):

```ts
} else if (error instanceof RateLimitError) {
  statusCode = 429;
} else if (error instanceof UpstreamError) {
  statusCode = 502;
} else if (error instanceof AppError) {
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/errors.ts server/src/middleware/errorHandler.ts server/src/middleware/errorHandler.test.ts
git commit -m "feat(server): add RateLimitError (429) and UpstreamError (502)"
```

---

## Task 2: DeepL config + provider

**Files:**
- Modify: `server/src/config/envVars.ts`
- Modify: `server/src/config/config.ts`
- Create: `server/src/lib/translate/deeplProvider.ts`
- Test: `server/src/lib/translate/deeplProvider.test.ts`

**Interfaces:**
- Consumes: `RateLimitError`, `UpstreamError`, `ServerError` from `utils/errors`; `config.DEEPL_API_KEY`.
- Produces:
  - `type TranslateProvider = { translate(input: { text: string; sourceLang: 'EN' | 'ES'; targetLang: 'EN' | 'ES' }): Promise<string> }`
  - `const deeplProvider: TranslateProvider`

- [ ] **Step 1: Add the env var** — in `server/src/config/envVars.ts` add `'DEEPL_API_KEY'` to the `optionalEnvVars` array. In `server/src/config/config.ts`, add fields to the `Config` class alongside the other optional pairs:

```ts
DEEPL_API_KEY?: string;
_DEEPL_API_KEY?: string;
```

(The existing `loadEnvVars()` loop assigns optional vars automatically; no other change needed.)

- [ ] **Step 2: Write the failing test** — `server/src/lib/translate/deeplProvider.test.ts`:

```ts
import { assert } from 'chai';
import nock from 'nock';
import * as sinon from 'sinon';
import config from '../../config/config';
import { RateLimitError, ServerError, UpstreamError } from '../../utils/errors';
import { deeplProvider } from './deeplProvider';

describe('deeplProvider', function () {
  const FREE_HOST = 'https://api-free.deepl.com';

  beforeEach(function () {
    config.DEEPL_API_KEY = 'test-key:fx'; // ":fx" selects the free host
  });

  afterEach(function () {
    delete config.DEEPL_API_KEY;
    sinon.restore();
  });

  it('POSTs to DeepL and returns the translated text', async function () {
    const scope = nock(FREE_HOST)
      .post('/v2/translate', (body: string) => {
        const params = new URLSearchParams(body);
        return (
          params.get('text') === 'hello' &&
          params.get('source_lang') === 'EN' &&
          params.get('target_lang') === 'ES'
        );
      })
      .matchHeader('authorization', 'DeepL-Auth-Key test-key:fx')
      .reply(200, { translations: [{ text: 'hola' }] });

    const result = await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });

    assert.equal(result, 'hola');
    assert.isTrue(scope.isDone());
  });

  it('throws RateLimitError on 429', async function () {
    nock(FREE_HOST).post('/v2/translate').reply(429, 'Too Many Requests');
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, RateLimitError);
    }
  });

  it('throws UpstreamError on other DeepL failure', async function () {
    nock(FREE_HOST).post('/v2/translate').reply(500, 'boom');
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, UpstreamError);
    }
  });

  it('throws ServerError when the API key is missing', async function () {
    delete config.DEEPL_API_KEY;
    try {
      await deeplProvider.translate({ text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, ServerError);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `make test-server`
Expected: FAIL — `deeplProvider` does not exist.

- [ ] **Step 4: Implement the provider** — `server/src/lib/translate/deeplProvider.ts`:

```ts
import config from '../../config/config';
import { RateLimitError, ServerError, UpstreamError } from '../../utils/errors';

const DEEPL_TIMEOUT_MS = 8000;

export type TranslateProvider = {
  translate(input: {
    text: string;
    sourceLang: 'EN' | 'ES';
    targetLang: 'EN' | 'ES';
  }): Promise<string>;
};

function deeplBaseUrl(apiKey: string): string {
  // DeepL free-tier keys end with ":fx" and use the api-free host.
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

export const deeplProvider: TranslateProvider = {
  async translate({ text, sourceLang, targetLang }) {
    const apiKey = config.DEEPL_API_KEY;
    if (!apiKey) {
      throw new ServerError('DEEPL_API_KEY is not configured');
    }

    const body = new URLSearchParams({
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    });

    let response: Response;
    try {
      response = await fetch(`${deeplBaseUrl(apiKey)}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(DEEPL_TIMEOUT_MS),
      });
    } catch {
      throw new UpstreamError('Translation provider request failed');
    }

    if (response.status === 429) {
      throw new RateLimitError('Translation provider rate limit exceeded');
    }
    if (!response.ok) {
      throw new UpstreamError('Translation provider returned an error');
    }

    const data = (await response.json()) as { translations?: { text: string }[] };
    const translated = data.translations?.[0]?.text;
    if (translated == null) {
      throw new UpstreamError('Translation provider returned an unexpected response');
    }
    return translated;
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/config/envVars.ts server/src/config/config.ts server/src/lib/translate/deeplProvider.ts server/src/lib/translate/deeplProvider.test.ts
git commit -m "feat(server): add DeepL translation provider with error mapping"
```

---

## Task 3: Translate lib (direction rules + blank/length guards)

**Files:**
- Create: `server/src/lib/translate/translate.lib.ts`
- Create: `server/src/lib/translate/index.ts`
- Test: `server/src/lib/translate/translate.lib.test.ts`

**Interfaces:**
- Consumes: `TranslateProvider`, `deeplProvider` from `./deeplProvider`; `ValidationError` from `utils/errors`.
- Produces:
  - `const TRANSLATION_DIRECTIONS = ['en-es', 'es-en'] as const`
  - `type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number]`
  - `const MAX_INPUT_LENGTH = 5000`
  - `type TranslateResult = { text: string; direction: TranslationDirection }`
  - `translateText({ text, direction }, provider?): Promise<TranslateResult>`

- [ ] **Step 1: Write the failing test** — `server/src/lib/translate/translate.lib.test.ts`:

```ts
import { assert } from 'chai';
import * as sinon from 'sinon';
import { ValidationError } from '../../utils/errors';
import { MAX_INPUT_LENGTH, translateText } from './translate.lib';
import type { TranslateProvider } from './deeplProvider';

function fakeProvider(returnText = 'hola'): TranslateProvider & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async translate(input) {
      calls.push(input);
      return returnText;
    },
  };
}

describe('translateText', function () {
  it('returns empty text and does not call the provider for blank input', async function () {
    const provider = fakeProvider();
    const result = await translateText({ text: '   ', direction: 'en-es' }, provider);
    assert.deepEqual(result, { text: '', direction: 'en-es' });
    assert.lengthOf(provider.calls, 0);
  });

  it('maps en-es to EN->ES', async function () {
    const provider = fakeProvider('hola');
    const result = await translateText({ text: 'hello', direction: 'en-es' }, provider);
    assert.equal(result.text, 'hola');
    assert.deepEqual(provider.calls[0], { text: 'hello', sourceLang: 'EN', targetLang: 'ES' });
  });

  it('maps es-en to ES->EN', async function () {
    const provider = fakeProvider('hello');
    const result = await translateText({ text: 'hola', direction: 'es-en' }, provider);
    assert.equal(result.text, 'hello');
    assert.deepEqual(provider.calls[0], { text: 'hola', sourceLang: 'ES', targetLang: 'EN' });
  });

  it('throws ValidationError when text exceeds the max length', async function () {
    const provider = fakeProvider();
    const longText = 'a'.repeat(MAX_INPUT_LENGTH + 1);
    try {
      await translateText({ text: longText, direction: 'en-es' }, provider);
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, ValidationError);
    }
    assert.lengthOf(provider.calls, 0);
  });

  it('throws ValidationError when text is not a string', async function () {
    const provider = fakeProvider();
    try {
      // @ts-expect-error deliberately passing a wrong type
      await translateText({ text: 42, direction: 'en-es' }, provider);
      assert.fail('should have thrown');
    } catch (err) {
      assert.instanceOf(err, ValidationError);
    }
  });

  it('uses the deeplProvider by default', async function () {
    const mod = await import('./deeplProvider');
    const stub = sinon.stub(mod.deeplProvider, 'translate').resolves('hola');
    const result = await translateText({ text: 'hello', direction: 'en-es' });
    assert.equal(result.text, 'hola');
    assert.isTrue(stub.calledOnce);
    stub.restore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-server`
Expected: FAIL — `translate.lib` does not exist.

- [ ] **Step 3: Implement the lib** — `server/src/lib/translate/translate.lib.ts`:

```ts
import { ValidationError } from '../../utils/errors';
import { deeplProvider, TranslateProvider } from './deeplProvider';

export const TRANSLATION_DIRECTIONS = ['en-es', 'es-en'] as const;
export type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number];

export const MAX_INPUT_LENGTH = 5000;

const DIRECTION_TO_DEEPL: Record<
  TranslationDirection,
  { source: 'EN' | 'ES'; target: 'EN' | 'ES' }
> = {
  'en-es': { source: 'EN', target: 'ES' },
  'es-en': { source: 'ES', target: 'EN' },
};

export type TranslateInput = { text: string; direction: TranslationDirection };
export type TranslateResult = { text: string; direction: TranslationDirection };

export async function translateText(
  { text, direction }: TranslateInput,
  provider: TranslateProvider = deeplProvider,
): Promise<TranslateResult> {
  if (typeof text !== 'string') {
    throw new ValidationError('text must be a string');
  }
  if (text.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(`text must be at most ${MAX_INPUT_LENGTH} characters`);
  }
  if (text.trim() === '') {
    return { text: '', direction };
  }
  const { source, target } = DIRECTION_TO_DEEPL[direction];
  const translated = await provider.translate({ text, sourceLang: source, targetLang: target });
  return { text: translated, direction };
}
```

- [ ] **Step 4: Add the barrel export** — `server/src/lib/translate/index.ts`:

```ts
export {
  translateText,
  TRANSLATION_DIRECTIONS,
  MAX_INPUT_LENGTH,
} from './translate.lib';
export type {
  TranslationDirection,
  TranslateInput,
  TranslateResult,
} from './translate.lib';
export type { TranslateProvider } from './deeplProvider';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/translate/translate.lib.ts server/src/lib/translate/index.ts server/src/lib/translate/translate.lib.test.ts
git commit -m "feat(server): add translate lib with direction mapping and guards"
```

---

## Task 4: Translate API endpoint

**Files:**
- Create: `server/src/api/translate/translate.api.ts`
- Create: `server/src/api/translate/index.ts`
- Create: `server/src/api/translate/translate.api.docs.yaml`
- Modify: `server/src/api/routes.ts`
- Test: `server/src/api/translate/translate.api.test.ts`

**Interfaces:**
- Consumes: `translateText`, `TRANSLATION_DIRECTIONS`, `TranslationDirection` from `lib/translate`; `authenticateAccessToken`; `checkBodyFor`, `checkBodyForNoExtraFields`, `checkBodyEnum`; `createUserWithToken` (test).
- Produces: `POST /v1/translate` → `200 { text, direction }`.

- [ ] **Step 1: Write the failing test** — `server/src/api/translate/translate.api.test.ts`:

```ts
import { assert } from 'chai';
import nock from 'nock';
import request from 'supertest';
import app from '../../server';
import config from '../../config/config';
import { createUserWithToken } from '../../test/testDataGenerator';

describe('Translate API', function () {
  const FREE_HOST = 'https://api-free.deepl.com';

  beforeEach(function () {
    config.DEEPL_API_KEY = 'test-key:fx';
  });

  afterEach(function () {
    delete config.DEEPL_API_KEY;
  });

  it('returns 401 without authentication', async function () {
    await request(app)
      .post('/v1/translate')
      .send({ text: 'hello', direction: 'en-es' })
      .expect(401);
  });

  it('translates authenticated input via DeepL', async function () {
    const { token } = await createUserWithToken();
    nock(FREE_HOST).post('/v2/translate').reply(200, { translations: [{ text: 'hola' }] });

    const res = await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es' })
      .expect(200);

    assert.deepEqual(res.body, { text: 'hola', direction: 'en-es' });
  });

  it('returns empty text for blank input without calling DeepL', async function () {
    const { token } = await createUserWithToken();
    // No nock interceptor: the test setup fails if any DeepL request is made.
    const res = await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '   ', direction: 'en-es' })
      .expect(200);

    assert.deepEqual(res.body, { text: '', direction: 'en-es' });
  });

  it('returns 400 when text is missing', async function () {
    const { token } = await createUserWithToken();
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'en-es' })
      .expect(400);
  });

  it('returns 400 for an unsupported direction', async function () {
    const { token } = await createUserWithToken();
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-fr' })
      .expect(400);
  });

  it('returns 400 for extra body fields', async function () {
    const { token } = await createUserWithToken();
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es', extra: true })
      .expect(400);
  });

  it('maps a DeepL 429 to 429', async function () {
    const { token } = await createUserWithToken();
    nock(FREE_HOST).post('/v2/translate').reply(429, 'Too Many Requests');
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es' })
      .expect(429);
  });

  it('maps a DeepL 500 to 502', async function () {
    const { token } = await createUserWithToken();
    nock(FREE_HOST).post('/v2/translate').reply(500, 'boom');
    await request(app)
      .post('/v1/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hello', direction: 'en-es' })
      .expect(502);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-server`
Expected: FAIL — route not mounted / controller missing.

- [ ] **Step 3: Implement the controller** — `server/src/api/translate/translate.api.ts`:

```ts
import { NextFunction, Request, Response } from 'express';
import { translateText, TranslationDirection } from '../../lib/translate';

export async function handleTranslate(req: Request, res: Response, next: NextFunction) {
  try {
    const { text, direction } = req.body as { text: string; direction: TranslationDirection };
    const result = await translateText({ text, direction });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 4: Implement the router** — `server/src/api/translate/index.ts`:

```ts
import express from 'express';
import { authenticateAccessToken } from '../security';
import { checkBodyEnum, checkBodyFor, checkBodyForNoExtraFields } from '../validation';
import { TRANSLATION_DIRECTIONS } from '../../lib/translate';
import { handleTranslate } from './translate.api';

const router = express.Router();

router.post(
  '/',
  authenticateAccessToken,
  checkBodyFor(['text', 'direction']),
  checkBodyForNoExtraFields(['text', 'direction']),
  checkBodyEnum('direction', TRANSLATION_DIRECTIONS),
  handleTranslate,
);

export default router;
```

- [ ] **Step 5: Mount the route** — in `server/src/api/routes.ts`, add the import and the `app.use` line next to the others:

```ts
import translateApi from './translate';
// ...
app.use('/v1/translate', translateApi);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 7: Add API docs** — `server/src/api/translate/translate.api.docs.yaml` (follow the shape of `server/src/api/user/user.api.docs.yaml`; reference shared responses as `$ref: '#/components/responses/400'`, etc.):

```yaml
paths:
  /v1/translate:
    post:
      summary: Translate text between English and Spanish
      tags:
        - Translate
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [text, direction]
              properties:
                text:
                  type: string
                  maxLength: 5000
                  example: hello
                direction:
                  type: string
                  enum: [en-es, es-en]
                  example: en-es
      responses:
        '200':
          description: The translated text
          content:
            application/json:
              schema:
                type: object
                properties:
                  text:
                    type: string
                    example: hola
                  direction:
                    type: string
                    enum: [en-es, es-en]
        '400':
          $ref: '#/components/responses/400'
        '401':
          $ref: '#/components/responses/401'
        '429':
          description: Translation provider rate limit exceeded
        '502':
          description: Translation provider error
```

- [ ] **Step 8: Build docs and commit**

Run: `make build-server && make lint-server && make test-server`

```bash
git add server/src/api/translate server/src/api/routes.ts
git commit -m "feat(server): add POST /v1/translate endpoint"
```

---

## Task 5: Client translate service

**Files:**
- Create: `client/src/Services/translateService.ts`
- Test: `client/src/Services/translateService.test.ts`

**Interfaces:**
- Consumes: `apiClient` (default export from `./apiClient`).
- Produces:
  - `type TranslationDirection = 'en-es' | 'es-en'`
  - `translate(params: { text: string; direction: TranslationDirection }, signal?: AbortSignal): Promise<{ text: string; direction: TranslationDirection }>`

- [ ] **Step 1: Write the failing test** — `client/src/Services/translateService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import { translate } from './translateService';

describe('translateService', () => {
  it('POSTs to /v1/translate and returns the data', async () => {
    const spy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { text: 'hola', direction: 'en-es' } });

    const controller = new AbortController();
    const result = await translate({ text: 'hello', direction: 'en-es' }, controller.signal);

    expect(spy).toHaveBeenCalledWith(
      '/v1/translate',
      { text: 'hello', direction: 'en-es' },
      { signal: controller.signal },
    );
    expect(result).toEqual({ text: 'hola', direction: 'en-es' });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-client`
Expected: FAIL — `translateService` does not exist.

- [ ] **Step 3: Implement the service** — `client/src/Services/translateService.ts`:

```ts
import apiClient from './apiClient';

export type TranslationDirection = 'en-es' | 'es-en';

export interface TranslateResult {
  text: string;
  direction: TranslationDirection;
}

export async function translate(
  params: { text: string; direction: TranslationDirection },
  signal?: AbortSignal,
): Promise<TranslateResult> {
  const response = await apiClient.post<TranslateResult>('/v1/translate', params, { signal });
  return response.data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `make lint-client && make test-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/Services/translateService.ts client/src/Services/translateService.test.ts
git commit -m "feat(client): add translateService"
```

---

## Task 6: useTranslation hook (debounce + stale-response guard)

**Files:**
- Create: `client/src/Pages/TranslatePage/useTranslation.ts`
- Test: `client/src/Pages/TranslatePage/useTranslation.test.ts`

**Interfaces:**
- Consumes: `translate`, `TranslationDirection` from `../../Services/translateService`.
- Produces a hook returning:
  ```ts
  {
    direction: TranslationDirection;
    inputText: string;
    outputText: string;
    loading: boolean;
    error: string | null;
    setInputText(text: string): void;
    swap(): void;
  }
  ```
- Debounce delay constant: `DEBOUNCE_MS = 400`.

- [ ] **Step 1: Write the failing test** — `client/src/Pages/TranslatePage/useTranslation.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as translateService from '../../Services/translateService';
import { useTranslation } from './useTranslation';

describe('useTranslation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not call the service for blank input', async () => {
    const spy = vi.spyOn(translateService, 'translate');
    const { result } = renderHook(() => useTranslation());
    act(() => result.current.setInputText('   '));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.outputText).toBe('');
  });

  it('debounces typing into a single call and shows the result', async () => {
    const spy = vi
      .spyOn(translateService, 'translate')
      .mockResolvedValue({ text: 'hola', direction: 'en-es' });
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('h'));
    act(() => result.current.setInputText('he'));
    act(() => result.current.setInputText('hello'));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.outputText).toBe('hola'));
  });

  it('ignores a stale response that resolves after a newer one', async () => {
    const resolvers: Array<(v: { text: string; direction: 'en-es' }) => void> = [];
    vi.spyOn(translateService, 'translate').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve as (v: { text: string; direction: 'en-es' }) => void);
        }),
    );
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('one'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    act(() => result.current.setInputText('two'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Resolve the NEWER request first, then the stale older one.
    await act(async () => {
      resolvers[1]({ text: 'dos', direction: 'en-es' });
    });
    await act(async () => {
      resolvers[0]({ text: 'uno', direction: 'en-es' });
    });

    expect(result.current.outputText).toBe('dos');
  });

  it('swap flips direction and moves output into input', async () => {
    vi.spyOn(translateService, 'translate').mockResolvedValue({ text: 'hola', direction: 'en-es' });
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setInputText('hello'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await waitFor(() => expect(result.current.outputText).toBe('hola'));

    act(() => result.current.swap());

    expect(result.current.direction).toBe('es-en');
    expect(result.current.inputText).toBe('hola');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-client`
Expected: FAIL — `useTranslation` does not exist.

- [ ] **Step 3: Implement the hook** — `client/src/Pages/TranslatePage/useTranslation.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { translate, TranslationDirection } from '../../Services/translateService';

export const DEBOUNCE_MS = 400;

export function useTranslation() {
  const [direction, setDirection] = useState<TranslationDirection>('en-es');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = inputText.trim();
    if (trimmed === '') {
      abortRef.current?.abort();
      setOutputText('');
      setError(null);
      setLoading(false);
      return;
    }

    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError(null);
      translate({ text: inputText, direction }, controller.signal)
        .then((result) => {
          if (requestId !== requestIdRef.current) return; // stale
          setOutputText(result.text);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return; // stale
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Translation failed');
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [inputText, direction]);

  const swap = useCallback(() => {
    abortRef.current?.abort();
    requestIdRef.current++; // invalidate any in-flight response
    setDirection((prev) => (prev === 'en-es' ? 'es-en' : 'en-es'));
    setInputText(outputText);
    setOutputText('');
  }, [outputText]);

  return { direction, inputText, outputText, loading, error, setInputText, swap };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `make lint-client && make test-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/Pages/TranslatePage/useTranslation.ts client/src/Pages/TranslatePage/useTranslation.test.ts
git commit -m "feat(client): add useTranslation hook with debounce and stale-response guard"
```

---

## Task 7: Web Speech hooks (mic + speaker)

**Files:**
- Create: `client/src/Pages/TranslatePage/useSpeechRecognition.ts`
- Create: `client/src/Pages/TranslatePage/useSpeechSynthesis.ts`
- Test: `client/src/Pages/TranslatePage/speechHooks.test.ts`

**Interfaces:**
- Produces:
  - `useSpeechRecognition({ locale: string; onFinalText: (text: string) => void }): { isSupported: boolean; isListening: boolean; toggle(): void }`
  - `useSpeechSynthesis({ locale: string }): { isSupported: boolean; speak(text: string): void }`

- [ ] **Step 1: Write the failing test** — `client/src/Pages/TranslatePage/speechHooks.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';

describe('useSpeechRecognition', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test globals
    delete window.SpeechRecognition;
    // @ts-expect-error cleanup test globals
    delete window.webkitSpeechRecognition;
  });

  it('reports unsupported when no SpeechRecognition constructor exists', () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ locale: 'en-US', onFinalText: () => {} }),
    );
    expect(result.current.isSupported).toBe(false);
  });

  it('reports supported and can start listening when available', () => {
    const start = vi.fn();
    const stop = vi.fn();
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = start;
      stop = stop;
    }
    // @ts-expect-error inject test global
    window.SpeechRecognition = FakeRecognition;

    const onFinalText = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ locale: 'en-US', onFinalText }),
    );
    expect(result.current.isSupported).toBe(true);
    act(() => result.current.toggle());
    expect(start).toHaveBeenCalled();
  });
});

describe('useSpeechSynthesis', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test globals
    delete window.speechSynthesis;
  });

  it('reports unsupported when speechSynthesis is absent', () => {
    const { result } = renderHook(() => useSpeechSynthesis({ locale: 'es-ES' }));
    expect(result.current.isSupported).toBe(false);
  });

  it('speaks text via the synthesis API when available', () => {
    const speak = vi.fn();
    // @ts-expect-error inject test global
    window.speechSynthesis = { speak, cancel: vi.fn(), getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() };
    // @ts-expect-error inject test global
    window.SpeechSynthesisUtterance = class {
      lang = '';
      constructor(public text: string) {}
    };

    const { result } = renderHook(() => useSpeechSynthesis({ locale: 'es-ES' }));
    expect(result.current.isSupported).toBe(true);
    act(() => result.current.speak('hola'));
    expect(speak).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-client`
Expected: FAIL — hooks do not exist.

- [ ] **Step 3: Implement `useSpeechRecognition`** — `client/src/Pages/TranslatePage/useSpeechRecognition.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition({
  locale,
  onFinalText,
}: {
  locale: string;
  onFinalText: (text: string) => void;
}) {
  const Ctor = useMemo(getRecognitionCtor, []);
  const isSupported = Ctor !== null;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggle = () => {
    if (!Ctor) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (last && last.isFinal) {
        onFinalText(last[0].transcript.trim());
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return { isSupported, isListening, toggle };
}
```

- [ ] **Step 4: Implement `useSpeechSynthesis`** — `client/src/Pages/TranslatePage/useSpeechSynthesis.ts`:

```ts
import { useEffect, useRef, useState } from 'react';

export function useSpeechSynthesis({ locale }: { locale: string }) {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [, setVoicesLoaded] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      setVoicesLoaded(true);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [isSupported]);

  const speak = (text: string) => {
    if (!isSupported || text.trim() === '') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    const prefix = locale.slice(0, 2).toLowerCase();
    const voice = voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  return { isSupported, speak };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `make lint-client && make test-client`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/Pages/TranslatePage/useSpeechRecognition.ts client/src/Pages/TranslatePage/useSpeechSynthesis.ts client/src/Pages/TranslatePage/speechHooks.test.ts
git commit -m "feat(client): add Web Speech mic and speaker hooks"
```

---

## Task 8: TranslatePage component + styles

**Files:**
- Create: `client/src/Pages/TranslatePage/TranslatePage.tsx`
- Create: `client/src/Pages/TranslatePage/TranslatePage.css`
- Test: `client/src/Pages/TranslatePage/TranslatePage.test.tsx`

**Interfaces:**
- Consumes: `useTranslation`, `useSpeechRecognition`, `useSpeechSynthesis`.
- Direction labels/locales:
  - `en-es`: input "English" (mic `en-US`), output "Spanish" (speak `es-ES`).
  - `es-en`: input "Spanish" (mic `es-ES`), output "English" (speak `en-US`).

- [ ] **Step 1: Write the failing test** — `client/src/Pages/TranslatePage/TranslatePage.test.tsx`:

```ts
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import * as translateService from '../../Services/translateService';
import TranslatePage from './TranslatePage';

describe('TranslatePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error cleanup
    delete window.SpeechRecognition;
    // @ts-expect-error cleanup
    delete window.webkitSpeechRecognition;
  });

  it('shows English and Spanish labels', () => {
    renderWithProviders(<TranslatePage />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Spanish')).toBeInTheDocument();
  });

  it('translates typed input and renders the result', async () => {
    vi.spyOn(translateService, 'translate').mockResolvedValue({
      text: 'hola',
      direction: 'en-es',
    });
    renderWithProviders(<TranslatePage />);
    const input = screen.getByLabelText('English');
    fireEvent.change(input, { target: { value: 'hello' } });
    await waitFor(() => expect(screen.getByText('hola')).toBeInTheDocument());
  });

  it('hides the mic button when speech recognition is unsupported', () => {
    renderWithProviders(<TranslatePage />);
    expect(screen.queryByRole('button', { name: /speak/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-client`
Expected: FAIL — `TranslatePage` does not exist.

- [ ] **Step 3: Implement the component** — `client/src/Pages/TranslatePage/TranslatePage.tsx`:

```tsx
import './TranslatePage.css';
import { useTranslation } from './useTranslation';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';

const DIRECTION_LABELS = {
  'en-es': { input: 'English', output: 'Spanish', micLocale: 'en-US', speakLocale: 'es-ES' },
  'es-en': { input: 'Spanish', output: 'English', micLocale: 'es-ES', speakLocale: 'en-US' },
} as const;

export default function TranslatePage() {
  const { direction, inputText, outputText, loading, error, setInputText, swap } = useTranslation();
  const labels = DIRECTION_LABELS[direction];

  const recognition = useSpeechRecognition({
    locale: labels.micLocale,
    onFinalText: setInputText,
  });
  const synthesis = useSpeechSynthesis({ locale: labels.speakLocale });

  return (
    <div className="translate-page">
      <section className="translate-card translate-card--input">
        <label className="translate-card__label" htmlFor="translate-input">
          {labels.input}
        </label>
        <textarea
          id="translate-input"
          className="translate-card__text"
          aria-label={labels.input}
          placeholder={`Type or speak ${labels.input}`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <div className="translate-card__actions">
          {recognition.isSupported && (
            <button
              type="button"
              className="translate-mic"
              aria-label={`Speak ${labels.input}`}
              aria-pressed={recognition.isListening}
              onClick={recognition.toggle}
            >
              🎤
            </button>
          )}
        </div>
      </section>

      <button type="button" className="translate-swap" aria-label="Swap languages" onClick={swap}>
        ⇅
      </button>

      <section className="translate-card translate-card--output">
        <span className="translate-card__label">{labels.output}</span>
        <div className="translate-card__text translate-card__text--output">
          {loading ? '…' : outputText}
        </div>
        <div className="translate-card__actions">
          <button
            type="button"
            className="translate-speaker"
            aria-label={`Listen in ${labels.output}`}
            disabled={!synthesis.isSupported || outputText.trim() === ''}
            onClick={() => synthesis.speak(outputText)}
          >
            🔊
          </button>
        </div>
      </section>

      {error && <p className="translate-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Implement the styles** — `client/src/Pages/TranslatePage/TranslatePage.css` (faithful iOS port; indigo/blue; all selectors scoped under `.translate-page` so global tokens are untouched):

```css
.translate-page {
  --translate-page-blue: #3d4ad9;
  --translate-page-deep-blue: #26338c;
  --translate-input-card: #fafaf5;
  --translate-output-card: #dee3fa;

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
  background: var(--translate-page-blue);
  min-height: 100%;
}

.translate-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: 20px;
  min-height: 220px;
}

.translate-card--input {
  background: var(--translate-input-card);
}

.translate-card--output {
  background: var(--translate-output-card);
}

.translate-card__label {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--translate-page-deep-blue);
}

.translate-card__text {
  flex: 1;
  border: 0;
  background: transparent;
  resize: none;
  font-size: 28px;
  line-height: 1.2;
  color: #1a1a1a;
  outline: none;
}

.translate-card__text--output {
  color: var(--translate-page-deep-blue);
}

.translate-card__actions {
  display: flex;
  justify-content: flex-end;
}

.translate-mic,
.translate-speaker {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 0;
  font-size: 20px;
  cursor: pointer;
  background: var(--translate-page-blue);
  color: #fff;
}

.translate-speaker {
  background: transparent;
  color: var(--translate-page-deep-blue);
  border: 1px solid rgba(38, 51, 140, 0.3);
}

.translate-speaker:disabled {
  opacity: 0.4;
  cursor: default;
}

.translate-swap {
  align-self: center;
  width: 48px;
  height: 48px;
  margin: -20px 0;
  z-index: 1;
  border-radius: 50%;
  border: 0;
  font-size: 20px;
  cursor: pointer;
  background: var(--translate-page-deep-blue);
  color: #fff;
}

.translate-error {
  margin-top: 16px;
  color: #fff;
  text-align: center;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `make lint-client && make test-client`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/Pages/TranslatePage/TranslatePage.tsx client/src/Pages/TranslatePage/TranslatePage.css client/src/Pages/TranslatePage/TranslatePage.test.tsx
git commit -m "feat(client): add TranslatePage two-card UI"
```

---

## Task 9: Route + Navbar link

**Files:**
- Modify: `client/src/Routes/routeChildren.tsx`
- Modify: `client/src/Components/Navbar/Navbar.tsx`
- Test: `client/src/Components/Navbar/Navbar.test.tsx` (modify)
- Test: `client/src/Routes/AppRoutes.test.tsx` (add, if the file already tests routes — otherwise add a focused route test here)

**Interfaces:**
- Consumes: `TranslatePage`, `ProtectedRoute`.
- Produces: protected `/translate` route; `Translate` nav link visible only when authenticated.

- [ ] **Step 1: Write the failing Navbar test** — add to `client/src/Components/Navbar/Navbar.test.tsx`. Match how the file renders an authenticated state; if it doesn't yet, mock `useAuth`:

```ts
import { vi } from 'vitest';
import * as useAuthModule from '../../Contexts/useAuth';

it('shows a Translate link when authenticated', () => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    isAuthenticated: true,
    user: { id: '1', email: 'a@b.c', displayName: 'A', firstName: 'A', lastName: 'B', role: 'user' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);

  renderWithProviders(<Navbar />);
  expect(screen.getByRole('link', { name: 'Translate' })).toBeInTheDocument();
  vi.restoreAllMocks();
});
```

(Confirm the exact `useAuth` return shape against `client/src/Contexts/useAuth.ts` / `AuthProvider.tsx` and adjust the mock object to match its real fields.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-client`
Expected: FAIL — no `Translate` link.

- [ ] **Step 3: Add the Navbar link** — in `client/src/Components/Navbar/Navbar.tsx`, inside the authenticated block, next to the Dashboard link:

```tsx
<Link to="/translate">Translate</Link>
```

- [ ] **Step 4: Add the protected route** — in `client/src/Routes/routeChildren.tsx`, import `TranslatePage` and add:

```tsx
{
  path: 'translate',
  element: (
    <ProtectedRoute>
      <TranslatePage />
    </ProtectedRoute>
  ),
},
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `make lint-client && make test-client`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/Components/Navbar/Navbar.tsx client/src/Components/Navbar/Navbar.test.tsx client/src/Routes/routeChildren.tsx
git commit -m "feat(client): add /translate route and Navbar link"
```

---

## Task 10: Full-suite verification + format

**Files:** none (verification only).

- [ ] **Step 1: Format everything**

Run: `make prettier-all`

- [ ] **Step 2: Run the full server gate**

Run: `make build-server && make lint-server && make test-server`
Expected: all pass.

- [ ] **Step 3: Run the full client gate**

Run: `make lint-client && make test-client`
Expected: all pass.

- [ ] **Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: run prettier across translate feature"
```

- [ ] **Step 5: Manual smoke (optional, requires a real DeepL key)**

Set `DEEPL_API_KEY` in the server env, `make launch`, sign in, open `/translate`, type "hello", confirm "hola" appears, click the speaker, and (in Chrome) the mic.

---

## Self-Review Notes

- **Spec coverage:** endpoint contract (Task 4), DeepL provider + errors (Tasks 1–2), blank/length rules (Task 3), client service (Task 5), debounce + stale guard + swap (Task 6), Web Speech mic/speaker with graceful degradation (Task 7), two-card UI scoped to `.translate-page` (Task 8), protected route + Navbar link (Task 9), full-suite gate + format (Task 10). Out-of-scope items (recent list, save-as-card, other tabs, global theme migration) are intentionally not tasked.
- **Type consistency:** `TranslationDirection` = `'en-es' | 'es-en'` everywhere; provider `translate({ text, sourceLang, targetLang })` matches lib and provider test; `translateText` returns `{ text, direction }` matching the controller response and client service.
- **Open verification during execution:** in Task 9, confirm the real `useAuth` return shape before finalizing the mock; in Task 1, match the existing `errorHandler.test.ts` mock-construction style.
```
