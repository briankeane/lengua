---
name: create-endpoint
description: Step-by-step workflow for creating REST API endpoints with integration tests and OpenAPI docs
---

# Endpoint Development

## Development Workflow

1. Write integration tests first (in `[module].api.test.ts`)
2. See them fail (red): `make test-server-file GREP="ModuleName"`
3. Implement the endpoint (controller + routing)
4. See them pass (green): `make test-server-file GREP="ModuleName"`
5. Add/update documentation:
   - `[module].api.docs.yaml` — OpenAPI spec
   - Tag in `server/src/docs/index.ts` (if adding tags)
6. Verify: `make build-server`, then confirm endpoints appear in `http://localhost:10020/swagger.json`
7. Final check: `make prettier-server && make lint-server && make build-server && make test-server`

## Reference Implementation

Study these before creating a new endpoint:

- `server/src/api/auth/` — Full example with authentication, validation, and multiple routes (signup, login, Google OAuth)
- `server/src/api/healthCheck/` — Minimal example showing the basic file structure and OpenAPI docs format

## Integration Testing

### Philosophy

These are **integration tests** that test all functionality through the full stack. Test real behavior without mocking anything internally.

### Mocking Rules

**Only mock at borders** — calls to outside services:

- External APIs (Spotify, AWS S3, etc.)
- Email services
- Push notification services
- Third-party webhooks

**Never mock** internal services, database calls, or library functions.

Use `nock` for HTTP mocking (already set up in `mochaSetup.test.ts`).

### Test Data Generation

Always use `server/src/test/testDataGenerator.ts` for generating test models:

```typescript
import { createUser } from '../../test/testDataGenerator';
```

**DO NOT manually create users with hardcoded emails:**

```typescript
// BAD - can cause duplicate email conflicts between tests
const adminUser = await db.models.User.create({
  email: 'admin@example.com',
  role: 'admin',
});

// GOOD - let testDataGenerator handle unique emails
const adminUser = await createUser(db, { role: 'admin' });
```

### Generating Tokens

```typescript
import { generateToken } from '../../utils/jwt';

const user = await createUser(db);
const token = await generateToken(user);
```

If `generateToken` doesn't exist yet, create a JWT token directly using the user's `jwtRepr()` method and the JWT_SECRET from config.

### Test File Location

`server/src/api/[module]/[module].api.test.ts` (co-located with controller)

### Test Pattern

```typescript
import { assert } from 'chai';
import request from 'supertest';
import app from '../../server';
import db from '../../db';
import { createUser } from '../../test/testDataGenerator';

describe('[Module] API', function () {
  describe('GET /v1/[module]', function () {
    it('returns the resource', async function () {
      const user = await createUser(db, { role: 'admin' });
      // generate token for auth...

      const res = await request(app)
        .get('/v1/[module]')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.exists(res.body.id);
    });

    it('returns 401 without auth', async function () {
      await request(app).get('/v1/[module]').expect(401);
    });
  });
});
```

## REST Conventions

### URL Structure

- All endpoints prefixed with `/v1/`
- Routes mounted in `server/src/api/routes.ts`
- Use kebab-case: `/audio-blocks`, not `/audioBlocks`
- Use plural nouns: `/users`, `/stations`
- Use lowercase

### The `/:userId/` Pattern with `me`

User-related endpoints use `/:userId/` where `me` resolves to the authenticated user's ID via the `isOperatingOnSelf` middleware.

```
GET  /v1/users/me           → Get current user
GET  /v1/users/:userId      → Get specific user (admin)
```

### HTTP Methods & Status Codes

| Method | Purpose              | Success Code |
| ------ | -------------------- | ------------ |
| GET    | Retrieve resource(s) | 200          |
| POST   | Create resource      | 201          |
| PUT    | Update resource      | 200          |
| DELETE | Remove resource      | 200          |

| Error Code | Usage                            |
| ---------- | -------------------------------- |
| 400        | Validation error, bad request    |
| 401        | Authentication failure           |
| 403        | Permission/authorization failure |
| 404        | Resource not found               |
| 409        | Conflict error                   |

### Authentication & Authorization Middleware Stack

Apply middleware in this order on protected routes:

```typescript
router.get(
  '/:id',
  authenticate, // 1. Validate JWT
  validateUUIDsInParams(['id']), // 2. Validate UUID format
  requireRoleOfAtLeast('user'), // 3. Check permissions
  controller.get, // 4. Handler
);

router.post(
  '/',
  authenticate,
  checkBodyFor(['name', 'email']), // Required fields
  checkBodyForNoExtraFields(['name', 'email', 'role']), // No extra fields
  validateUUIDsInBody(['relatedId']), // UUID format in body
  controller.create,
);
```

**Permission Middleware Options:**

```typescript
requireRoleOfAtLeast('admin'); // Roles: guest < user < admin
isOperatingOnSelf('userId'); // User can only operate on own data
oneOf([
  // OR logic
  isOperatingOnSelf('userId'),
  requireRoleOfAtLeast('admin'),
]);
```

### Error Handling

**Error Classes (in `utils/errors.ts`):**

- `NotFoundError` → 404
- `AuthenticationError` → 401
- `PermissionError` → 403
- `ValidationError` → 400
- `ConflictError` → 409

```typescript
// Use centralized error messages
throw new NotFoundError(ErrorMessages.RESOURCE_NOT_FOUND);
throw new ValidationError(ErrorMessages.invalidUuidFormat('userId'));
```

**Controller pattern:**

```typescript
async function handler(req: Request, res: Response, next: NextFunction) {
  try {
    // ... implementation
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
```

### Response Structure

**Single resource:** `{ "id": "uuid", "name": "value", ... }`

**Collection:** `[{ "id": "uuid1", ... }, { "id": "uuid2", ... }]`

**Error:** `{ "error": { "message": "Error description" } }`

## File Organization

```
server/src/api/
├── routes.ts                     # Main route mounting
├── security.ts                   # Auth middleware
├── validation.ts                 # Validation middleware
├── [module]/
│   ├── index.ts                  # Route definitions (Express Router)
│   ├── [module].api.ts           # Controller (handler functions)
│   ├── [module].api.test.ts      # Integration tests
│   └── [module].api.docs.yaml    # OpenAPI documentation
```

## API Documentation

### Creating Docs

1. **`[module].api.docs.yaml`** — OpenAPI 3.0 spec. See `healthCheck/healthCheck.api.docs.yaml` for reference.
2. **Tag registration** — Add the module's tag to the `tags` array in `server/src/docs/index.ts` if you're using tags.
3. The YAML files are auto-discovered by the glob pattern in `docs/index.ts`.

### Verification

```bash
make build-server
# Then check: http://localhost:10020/swagger.json
```

## Route Registration

In `server/src/api/routes.ts`, add the new route:

```typescript
import moduleApi from './[module]';

function addRoutes(app: Application) {
  // ... existing routes
  app.use('/v1/[module]', moduleApi);
}
```

## Anti-Patterns to Avoid

**DON'T:** Handle errors with `res.status().json()` — throw typed errors instead.

**DON'T:** Use `/mine` or implicit user endpoints — use `/:userId/` with `me` support.

**DON'T:** Mock internal services — only mock at external boundaries.

## Quality Gates

- [ ] Integration tests written and passing
- [ ] Controller follows try-catch-next pattern
- [ ] Proper error classes used (not raw status codes)
- [ ] Route registered in `routes.ts`
- [ ] OpenAPI docs in `.api.docs.yaml`
- [ ] `make prettier-server` passes
- [ ] `make lint-server` passes
- [ ] `make build-server` passes
- [ ] `make test-server` passes
