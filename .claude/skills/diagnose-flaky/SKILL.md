---
name: diagnose-flaky
description: Step-by-step procedure for diagnosing and fixing flaky server tests
---

# Diagnosing Flaky Tests

## Quick Reference

```bash
# Run a test multiple times until it fails
./server/scripts/run-flaky-test.sh -n 100 -g "test name or pattern"
```

## Procedure

### 1. Add Debug Logging First

Before running the test multiple times, add `console.log` statements to capture state when failure occurs. This saves time for rare failures.

Add conditional logging that only prints on failure:

```typescript
if (actualValue !== expectedValue) {
  console.log('DEBUG flaky test - failure state:', {
    actualValue,
    expectedValue,
    relevantState: someVariable,
    timestamp: new Date().toISOString(),
  });
}
```

### 2. Reproduce the Flaky Test

Use the `run-flaky-test.sh` script:

```bash
./server/scripts/run-flaky-test.sh -n 100 -g "exact test name"
```

- `-n`: Number of iterations (default: 10)
- `-g`: Grep pattern to match test name (required)

The script stops on first failure and shows the debug output.

### 3. Common Causes of Flaky Tests

#### Timezone Issues

Tests that check dates/times may fail when local time crosses a day boundary in UTC.

**Fix:** Use timezone-aware assertions or freeze to a specific time that avoids boundary issues.

#### Random Selection

Tests involving random choices may not always hit the expected branch.

**Fix:** Seed the random number generator or assert over a range of valid outcomes.

#### Database State

Tests may pollute shared database state or run in unexpected order.

**Fix:** Ensure proper cleanup. The `clearDatabase()` function in `test.helpers.ts` runs in `afterEach` via `mochaSetup.test.ts`. If a test needs specific isolation, add explicit setup/teardown.

#### Race Conditions

Async operations completing in different orders.

**Fix:** Use proper `await` and ensure deterministic ordering.

#### nock Leaks

HTTP mocks from one test leaking into the next.

**Fix:** Call `nock.cleanAll()` in `afterEach` for tests that set up nocks. The global `mochaSetup.test.ts` already handles this, but test-specific nocks may need explicit cleanup.

### 4. Verify the Fix

After fixing, run the flaky test script with a high iteration count:

```bash
./server/scripts/run-flaky-test.sh -n 50 -g "test name"
```

All iterations should pass consistently.

### 5. Clean Up

Remove any debug logging before committing.
