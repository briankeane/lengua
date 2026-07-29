---
name: create-lib
description: Step-by-step workflow for creating server library functions with TDD one function at a time
---

# Library Development

## Development Workflow

1. Write unit tests for ONE function (in `[module].lib.test.ts`)
2. See them fail (red): `make test-server-file GREP="functionName"`
3. Implement the function (in `[module].lib.ts`)
4. See them pass (green): `make test-server-file GREP="functionName"`
5. Pause for commit
6. Repeat for next function
7. When complete: `make prettier-server && make lint-server && make build-server && make test-server`

## Core Principle: One Function at a Time

Never implement multiple functions in parallel. Complete the full cycle for one function before starting the next.

## Reference Implementation

Study these for the existing patterns:

- `server/src/lib/auth/auth.lib.ts` — Full example with user creation, password hashing, token generation
- `server/src/lib/healthCheck/healthCheck.lib.ts` — Minimal example

## File Organization

```
server/src/lib/[module]/
├── index.ts              # Re-exports from lib file
├── [module].lib.ts       # Implementation
└── [module].lib.test.ts  # Tests
```

## Unit Testing

### Test File Location

`server/src/lib/[module]/[module].lib.test.ts` (co-located with implementation)

### Test Structure

- Cover happy path, edge cases, and error conditions
- One describe block per function
- Use `assert` from chai (project convention)

### Test Pattern

```typescript
import { assert } from 'chai';
import db from '../../db';
import { createUser } from '../../test/testDataGenerator';
import * as moduleLib from './[module].lib';

describe('[module] lib', function () {
  describe('functionName', function () {
    it('does the expected thing', async function () {
      const user = await createUser(db);
      const result = await moduleLib.functionName(user.id);
      assert.exists(result);
    });

    it('throws NotFoundError for non-existent resource', async function () {
      try {
        await moduleLib.functionName('non-existent-id');
        assert.fail('should have thrown');
      } catch (err) {
        assert.instanceOf(err, NotFoundError);
      }
    });
  });
});
```

### Test Data Generation

Always use `server/src/test/testDataGenerator.ts`:

```typescript
import { createUser } from '../../test/testDataGenerator';
```

**DO NOT manually create users with hardcoded emails:**

```typescript
// BAD - can cause duplicate email conflicts between tests
const user = await db.models.User.create({ email: 'test@example.com' });

// GOOD - let testDataGenerator handle unique emails
const user = await createUser(db, { role: 'admin' });
```

## Test Commands

```bash
# Run tests matching a pattern
make test-server-file GREP="functionName"

# Run full server test suite (at the end)
make test-server
```

## Quality Gates

- [ ] Tests pass for the completed function
- [ ] `make prettier-server` passes
- [ ] `make lint-server` passes
- [ ] `make build-server` passes
- [ ] `make test-server` passes
- [ ] Code follows existing patterns in codebase
