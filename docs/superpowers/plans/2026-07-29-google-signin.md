# Google Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email/password auth UI with a single custom "Continue with Google" button using the OAuth authorization-code flow, matching the `mockups/lengua-ux/` design.

**Architecture:** Client custom button → `useGoogleLogin({ flow: 'auth-code' })` → sends `code` to `POST /v1/auth/google` → server exchanges the code with Google (`getToken`), verifies the returned `id_token`, requires `email_verified`, finds-or-creates the user by Google `sub`, and issues the scaffold's existing HS256 JWT. Session stays in localStorage as a bearer token.

**Tech Stack:** Express 5, Sequelize, Postgres, `google-auth-library` (server); React + Vite, `@react-oauth/google`, Vitest/RTL (client).

## Global Constraints

- All new files are TypeScript; no new `.js` files (migrations are `.js` per the existing pattern).
- Server tests: Mocha + Chai + Sinon + Supertest, DB cleared between runs.
- Client tests: Vitest + React Testing Library, jsdom.
- Run before pushing: `make prettier-all`.
- Server verify loop: `make build-server && make lint-server && make test-server`.
- Client verify loop: `make test-client && make lint-client`.
- Contract standardized on `{ code }` at `POST /v1/auth/google`. App JWT via `generateToken(user)`; client keeps localStorage bearer.
- Backend email/password endpoints (`/v1/auth/signup`, `/v1/auth/login`) stay; only their client UI is removed.

---

## File Structure

**Server**
- `db/models/user.model.ts` — add `googleId`.
- `db/migrations/<ts>-add-google-id-to-users.js` — new column + unique index.
- `lib/auth/auth.lib.ts` — replace `googleSignIn` with `googleSignInWithCode`.
- `api/auth/auth.api.ts` — controller reads `code`.
- `api/auth/index.ts` — `checkBodyFor(['code'])`.
- `api/auth/auth.api.docs.yaml` — request body `{ code }`.
- `api/auth/auth.api.test.ts` — rework the `POST /v1/auth/google` block.

**Client**
- `Services/authService.ts` — `googleAuth(code)`.
- `Contexts/authContext.ts` — add `signInWithGoogle` to the type.
- `Contexts/AuthProvider.tsx` — add `signInWithGoogle` action.
- `Components/ContinueWithGoogleButton.tsx` (new) + `.test.tsx`.
- `Pages/AuthPage/AuthPage.tsx` (new) + `.test.tsx`.
- `Routes/AppRoutes.tsx` — mount `GoogleOAuthProvider`; routes → `AuthPage`.
- delete `Pages/LoginPage/`, `Pages/SignupPage/`.
- `index.css` — Nocturne design tokens + auth styles.
- `.env`, `.env-example` — `VITE_GOOGLE_CLIENT_ID`.
- `package.json` — add `@react-oauth/google`.

---

## Task 1: Add `googleId` to the User model + migration

**Files:**
- Modify: `server/src/db/models/user.model.ts`
- Create: `server/src/db/migrations/<timestamp>-add-google-id-to-users.js`

**Interfaces:**
- Produces: `User.googleId: string | null` — the Google `sub`, unique.

- [ ] **Step 1: Add the field to the model class**

In `user.model.ts`, add after the `passwordHash` declaration:

```typescript
  declare googleId: CreationOptional<string>;
```

And in the `User.init({ ... })` attribute map, add after `passwordHash: DataTypes.STRING,`:

```typescript
    googleId: {
      type: DataTypes.STRING,
      unique: true,
    },
```

- [ ] **Step 2: Generate the migration**

Run: `make generate-migration NAME=add-google-id-to-users`

- [ ] **Step 3: Fill in the migration**

Replace the generated file's contents:

```javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'googleId', {
      type: Sequelize.STRING,
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'googleId');
  },
};
```

- [ ] **Step 4: Run migrations for dev + test DBs**

Run: `make migrate-all`
Expected: both databases migrate with no error.

- [ ] **Step 5: Build to confirm types compile**

Run: `make build-server`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/models/user.model.ts server/src/db/migrations/
git commit -m "feat: add googleId column to users"
```

---

## Task 2: Server — auth-code exchange endpoint

**Files:**
- Modify: `server/src/lib/auth/auth.lib.ts`
- Modify: `server/src/api/auth/auth.api.ts`
- Modify: `server/src/api/auth/index.ts`
- Modify: `server/src/api/auth/auth.api.docs.yaml`
- Test: `server/src/api/auth/auth.api.test.ts`

**Interfaces:**
- Produces: `googleSignInWithCode({ code }: { code: string }): Promise<{ user: User; token: string }>`
- Consumes: `generateToken(user)`, `User`, error classes, `config.GOOGLE_CLIENT_ID`, `config.GOOGLE_CLIENT_SECRET`.

- [ ] **Step 1: Rewrite the `POST /v1/auth/google` test block (failing)**

In `auth.api.test.ts`, replace the entire `describe('POST /v1/auth/google', ...)` block with:

```typescript
  describe('POST /v1/auth/google', function () {
    const originalGoogleClientId = config.GOOGLE_CLIENT_ID;
    const originalGoogleClientSecret = config.GOOGLE_CLIENT_SECRET;

    beforeEach(function () {
      config.GOOGLE_CLIENT_ID = 'test-google-client-id';
      config.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    });

    afterEach(function () {
      config.GOOGLE_CLIENT_ID = originalGoogleClientId;
      config.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
      sinon.restore();
    });

    function stubGoogle(payload: TokenPayload) {
      sinon
        .stub(OAuth2Client.prototype, 'getToken')
        .resolves({ tokens: { id_token: 'fake-id-token' } } as never);
      sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves(mockTicket(payload));
    }

    function basePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
      return {
        email: 'google@example.com',
        email_verified: true,
        given_name: 'Google',
        family_name: 'User',
        picture: 'https://example.com/photo.jpg',
        sub: 'google-user-id-123',
        aud: 'test-google-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'accounts.google.com',
        ...overrides,
      };
    }

    it('creates a new user from an auth code and stores googleId', async function () {
      stubGoogle(basePayload());

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 200);
      assert.exists(res.body.token);
      assert.equal(res.body.user.email, 'google@example.com');
      assert.equal(res.body.user.firstName, 'Google');

      const user = await User.findOne({ where: { email: 'google@example.com' } });
      assert.equal(user?.googleId, 'google-user-id-123');
    });

    it('matches an existing user by googleId (sub)', async function () {
      await User.create({
        email: 'old@example.com',
        firstName: 'Old',
        googleId: 'google-user-id-123',
      });

      stubGoogle(basePayload({ email: 'new-address@example.com' }));

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'old@example.com');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('backfills googleId on an existing email-matched user', async function () {
      await User.create({ email: 'google@example.com', firstName: 'Existing' });

      stubGoogle(basePayload());

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 200);
      const user = await User.findOne({ where: { email: 'google@example.com' } });
      assert.equal(user?.googleId, 'google-user-id-123');
      const count = await User.count();
      assert.equal(count, 1);
    });

    it('returns 401 when the email is not verified', async function () {
      stubGoogle(basePayload({ email_verified: false }));

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 401);
    });

    it('returns 401 when the code exchange fails', async function () {
      sinon.stub(OAuth2Client.prototype, 'getToken').rejects(new Error('invalid_grant'));

      const res = await request(app).post('/v1/auth/google').send({ code: 'bad-code' });

      assert.equal(res.status, 401);
    });

    it('returns 400 if GOOGLE_CLIENT_ID is not set', async function () {
      config.GOOGLE_CLIENT_ID = undefined;

      const res = await request(app).post('/v1/auth/google').send({ code: 'auth-code' });

      assert.equal(res.status, 400);
    });

    it('returns 400 if code is missing', async function () {
      const res = await request(app).post('/v1/auth/google').send({});

      assert.equal(res.status, 400);
    });
  });
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `make test-server`
Expected: FAIL — server still expects `{ idToken }` and has no `getToken` path.

- [ ] **Step 3: Replace `googleSignIn` in `auth.lib.ts`**

Remove the existing `googleSignIn` export and add (keep `signup` and `login` untouched):

```typescript
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export async function googleSignInWithCode({
  code,
}: {
  code: string;
}): Promise<{ user: User; token: string }> {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ValidationError('Google sign-in is not configured');
  }

  const client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    'postmessage',
  );

  let payload: TokenPayload | undefined;
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new Error('No id_token returned from Google');
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AuthenticationError('Google authentication failed');
  }

  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw new AuthenticationError('Google authentication failed');
  }

  const user = await upsertGoogleUser(payload);
  const token = await generateToken(user);
  return { user, token };
}

async function upsertGoogleUser(payload: TokenPayload): Promise<User> {
  const sub = payload.sub as string;
  const email = payload.email as string;

  const bySub = await User.findOne({ where: { googleId: sub } });
  if (bySub) {
    return bySub;
  }

  const byEmail = await User.findOne({ where: { email } });
  if (byEmail) {
    await byEmail.update({
      googleId: sub,
      verifiedEmail: byEmail.verifiedEmail ?? email,
      profileImageUrl: byEmail.profileImageUrl ?? payload.picture,
    });
    return byEmail;
  }

  return User.create({
    googleId: sub,
    email,
    firstName: payload.given_name ?? email.split('@')[0],
    lastName: payload.family_name ?? '',
    verifiedEmail: email,
    profileImageUrl: payload.picture,
  });
}
```

Ensure the file still imports `AuthenticationError` and `ValidationError` from `../../utils/errors` (drop `ConflictError` only if now unused — `signup` still uses it, so keep it).

- [ ] **Step 4: Update the controller `auth.api.ts`**

Change the import from `googleSignIn` to `googleSignInWithCode`, and rewrite the handler:

```typescript
export async function handleGoogleSignIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.body;
    const { user, token } = await googleSignInWithCode({ code });
    res.status(200).json({ user: user.jwtRepr(), token });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Update the route validation in `api/auth/index.ts`**

```typescript
router.post('/google', checkBodyFor(['code']), handleGoogleSignIn);
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 7: Update the OpenAPI docs**

In `auth.api.docs.yaml`, under `/v1/auth/google`, change the request body `required`/`properties` from `idToken` to `code` (string, "Google OAuth authorization code"), and update the 400 description to "Google sign-in not configured or missing code".

- [ ] **Step 8: Build docs**

Run: `make build-server`
Expected: success.

- [ ] **Step 9: Commit**

```bash
git add server/src/lib/auth/auth.lib.ts server/src/api/auth/
git commit -m "feat: exchange Google auth code and upsert user by sub"
```

---

## Task 3: Client — auth service + provider action

**Files:**
- Modify: `client/src/Services/authService.ts`
- Modify: `client/src/Contexts/authContext.ts`
- Modify: `client/src/Contexts/AuthProvider.tsx`
- Test: `client/src/Contexts/AuthProvider.test.tsx` (new)

**Interfaces:**
- Produces: `authService.googleAuth(code: string): Promise<AuthResponse>`; context `signInWithGoogle(code: string): Promise<void>`.

- [ ] **Step 1: Write the failing provider test**

Create `client/src/Contexts/AuthProvider.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import * as authService from '../Services/authService';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider.signInWithGoogle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('exchanges a code and stores the session', async () => {
    vi.spyOn(authService, 'googleAuth').mockResolvedValue({
      token: 'jwt-123',
      user: {
        id: 'u1',
        email: 'g@example.com',
        displayName: '',
        firstName: 'G',
        lastName: '',
        role: 'user',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signInWithGoogle('auth-code');
    });

    expect(authService.googleAuth).toHaveBeenCalledWith('auth-code');
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(localStorage.getItem('token')).toBe('jwt-123');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `make test-client`
Expected: FAIL — `signInWithGoogle` does not exist.

- [ ] **Step 3: Update `authService.googleAuth`**

Replace the current `googleAuth` in `authService.ts`:

```typescript
export async function googleAuth(code: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/v1/auth/google', { code });
  return response.data;
}
```

- [ ] **Step 4: Add `signInWithGoogle` to the context type**

In `authContext.ts`, add to `AuthContextValue`:

```typescript
  signInWithGoogle: (code: string) => Promise<void>;
```

- [ ] **Step 5: Implement the action in `AuthProvider.tsx`**

Add after the `signup` callback:

```typescript
  const signInWithGoogle = useCallback(
    async (code: string) => {
      const response = await authService.googleAuth(code);
      handleAuthResponse(response);
    },
    [handleAuthResponse],
  );
```

Add `signInWithGoogle` to the `useMemo` value object and its dependency array.

- [ ] **Step 6: Run the test to confirm it passes**

Run: `make test-client`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/Services/authService.ts client/src/Contexts/
git commit -m "feat: add signInWithGoogle auth action"
```

---

## Task 4: Client — Google button + provider wiring

**Files:**
- Modify: `client/package.json` (add dependency)
- Modify: `client/src/Routes/AppRoutes.tsx`
- Modify: `client/.env`, `client/.env-example`
- Create: `client/src/Components/ContinueWithGoogleButton.tsx`
- Test: `client/src/Components/ContinueWithGoogleButton.test.tsx`

**Interfaces:**
- Consumes: `useAuth().signInWithGoogle`, `@react-oauth/google` `useGoogleLogin`, `GoogleOAuthProvider`.
- Produces: default-exported `ContinueWithGoogleButton` component.

- [ ] **Step 1: Install the dependency**

Run: `docker compose run --rm client npm install @react-oauth/google` (or add `"@react-oauth/google": "^0.12.2"` to `client/package.json` and rebuild the client container). Confirm it lands in `dependencies`.

- [ ] **Step 2: Write the failing button test**

Create `client/src/Components/ContinueWithGoogleButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ContinueWithGoogleButton from './ContinueWithGoogleButton';

const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
vi.mock('../Contexts/useAuth', () => ({
  useAuth: () => ({ signInWithGoogle }),
}));

let capturedOnSuccess: ((r: { code: string }) => void) | undefined;
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: (opts: { onSuccess: (r: { code: string }) => void }) => {
    capturedOnSuccess = opts.onSuccess;
    return () => capturedOnSuccess?.({ code: 'auth-code-xyz' });
  },
}));

describe('ContinueWithGoogleButton', () => {
  it('sends the auth code to signInWithGoogle on click', async () => {
    render(<ContinueWithGoogleButton />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledWith('auth-code-xyz');
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `make test-client`
Expected: FAIL — component file does not exist.

- [ ] **Step 4: Implement the component**

Create `client/src/Components/ContinueWithGoogleButton.tsx`:

```tsx
import { useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useAuth } from '../Contexts/useAuth';

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function ContinueWithGoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');

  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async ({ code }) => {
      setError('');
      try {
        await signInWithGoogle(code);
      } catch {
        setError('Sign-in failed. Please try again.');
      }
    },
    onError: () => setError('Sign-in failed. Please try again.'),
  });

  return (
    <>
      <button type="button" className="google-btn" onClick={() => login()}>
        <GoogleGlyph />
        Continue with Google
      </button>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `make test-client`
Expected: PASS.

- [ ] **Step 6: Wire `GoogleOAuthProvider` and env**

In `AppRoutes.tsx`, import `{ GoogleOAuthProvider }` from `@react-oauth/google` and wrap the route element:

```tsx
    element: (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GoogleOAuthProvider>
    ),
```

Add to `client/.env` and `client/.env-example`:

```
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 7: Build + lint client**

Run: `make lint-client && make build-client 2>/dev/null || true`
Expected: lint clean. (If no `build-client` target, skip; `make test-client` already type-checks via Vite.)

- [ ] **Step 8: Commit**

```bash
git add client/package.json client/package-lock.json client/src/Components/ client/src/Routes/AppRoutes.tsx client/.env client/.env-example
git commit -m "feat: add Continue with Google button and OAuth provider"
```

---

## Task 5: Client — Nocturne auth screen, remove email/password

**Files:**
- Create: `client/src/Pages/AuthPage/AuthPage.tsx`, `client/src/Pages/AuthPage/AuthPage.test.tsx`
- Modify: `client/src/Routes/AppRoutes.tsx`
- Modify: `client/src/index.css`
- Delete: `client/src/Pages/LoginPage/`, `client/src/Pages/SignupPage/`

**Interfaces:**
- Consumes: `useAuth().isAuthenticated`, `ContinueWithGoogleButton`.

- [ ] **Step 1: Write the failing AuthPage test**

Create `client/src/Pages/AuthPage/AuthPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testHelpers';
import AuthPage from './AuthPage';

vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => () => {},
}));

describe('AuthPage', () => {
  it('shows the Google button and no email/password fields', () => {
    renderWithProviders(<AuthPage />, { initialEntries: ['/login'] });
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByText(/no password\. no email\./i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `make test-client`
Expected: FAIL — `AuthPage` does not exist.

- [ ] **Step 3: Implement `AuthPage`**

Create `client/src/Pages/AuthPage/AuthPage.tsx` (markup mirrors the mockup's sign-in screen):

```tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ContinueWithGoogleButton from '../../Components/ContinueWithGoogleButton';
import { useAuth } from '../../Contexts/useAuth';

export default function AuthPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(decodeURIComponent(redirectTo), { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  return (
    <div className="signin">
      <div className="signin-brand">
        <span className="signin-orb" />
        <h1 className="signin-title">Lengua</h1>
        <p className="signin-tagline">Look it up. Keep it. Say it back.</p>
      </div>
      <div className="signin-actions">
        <ContinueWithGoogleButton />
        <p className="signin-note">No password. No email.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Point the routes at `AuthPage`**

In `AppRoutes.tsx`: remove the `LoginPage`/`SignupPage` imports, import `AuthPage`, and set the `index`, `login`, and `signup` route elements all to `<AuthPage />`. Keep the `login` route (ProtectedRoute redirects there).

- [ ] **Step 5: Delete the old pages**

```bash
git rm -r client/src/Pages/LoginPage client/src/Pages/SignupPage
```

- [ ] **Step 6: Add Nocturne tokens + auth styles to `index.css`**

Prepend the design tokens to `index.css` `:root` (values from `mockups/lengua-ux/_ds/nocturne-*/styles.css`) and add auth styles:

```css
:root {
  --color-bg: #161826;
  --color-text: #e9e9ed;
  --color-accent: #9184d9;
  --color-accent-200: #e7e5fe;
  --color-accent-300: #d2cefd;
  --color-neutral-500: #9397ab;
  --color-neutral-600: #75798c;
  --color-neutral-700: #595d6c;
  --color-neutral-900: #292b31;
  --radius-md: 8px;
  --font-body: 'Inter', system-ui, sans-serif;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

.signin {
  min-height: 100vh;
  max-width: 460px;
  margin: 0 auto;
  padding: 64px 28px 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.signin-brand { margin-top: 14vh; display: flex; flex-direction: column; gap: 14px; }
.signin-orb {
  width: 26px; height: 26px; border-radius: 50%;
  border: 1px solid var(--color-accent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--color-accent) 45%, transparent);
}
.signin-title { font-size: 40px; letter-spacing: -0.03em; margin: 0; }
.signin-tagline { margin: 0; font-size: 15px; color: var(--color-neutral-500); max-width: 20ch; }
.signin-actions { display: flex; flex-direction: column; gap: 10px; }
.google-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  height: 50px; border-radius: var(--radius-md);
  border: 1px solid var(--color-neutral-700); background: transparent;
  color: var(--color-text); font-size: 15px; font-weight: 500; cursor: pointer;
}
.google-btn:hover { background: var(--color-neutral-900); border-color: var(--color-neutral-600); }
.signin-note { margin: 10px 0 0; font-size: 11px; color: var(--color-neutral-700); text-align: center; }
.auth-error { color: #ff8080; font-size: 13px; text-align: center; }
```

Remove the old light-theme `color`/`background-color` and `a`/`button` rules from `index.css` that conflict (keep it minimal and dark).

- [ ] **Step 7: Run the full client test + lint suite**

Run: `make test-client && make lint-client`
Expected: PASS (LoginPage/SignupPage tests are gone with their pages).

- [ ] **Step 8: Format**

Run: `make prettier-all`

- [ ] **Step 9: Commit**

```bash
git add client/src/Pages/AuthPage client/src/Routes/AppRoutes.tsx client/src/index.css
git commit -m "feat: Nocturne Google-only auth screen; remove email/password UI"
```

---

## Final verification

- [ ] `make build-server && make lint-server && make test-server` — all green.
- [ ] `make test-client && make lint-client` — all green.
- [ ] `make prettier-all` — clean.
- [ ] Manual smoke (needs real `GOOGLE_CLIENT_ID`/secret + `VITE_GOOGLE_CLIENT_ID` and an authorized origin in Google Cloud): click "Continue with Google", complete consent, land on `/dashboard`.
- [ ] Codex adversarial review of the final diff (`/codex review` then `/codex challenge`), fix findings, re-run.

## Self-review notes

- Spec coverage: flow (T2/T3/T4), `googleId`+`email_verified` (T1/T2), `{ code }` contract (T2/T3), custom button (T4), Nocturne screen + email/password removal (T5), docs (T2), tests (all). ✓
- Out of scope, per spec: HttpOnly cookie migration, Apple, full design-system adoption, deleting dormant backend email/password endpoints. ✓
