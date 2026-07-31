# Voice Tutor — PR 1: Infra + Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the infrastructure and data foundation for the AI voice conversation tutor: provision Redis (Render Key Value) so BullMQ actually runs, add the voice/evaluation env vars, and create the `ConversationSession` model + migration + test factory. No user-facing behavior yet.

**Architecture:** Config/secrets flow through `server/src/config/envVars.ts` + the `Config` class (never `process.env` in app code). Async evaluation (built in later PRs) runs on the existing BullMQ worker, which needs a real Redis instance — added here to `render.yaml` as a Key Value service with `noeviction`. All conversation state lives on one Sequelize table, `ConversationSession`, whose enums follow the project's exported-constant pattern.

**Tech Stack:** Node 22, TypeScript, Express 5, Sequelize + Postgres, BullMQ + ioredis, Render Blueprint (`render.yaml`), Mocha/Chai/Sinon/nock.

**Full design spec:** `docs/superpowers/specs/2026-07-31-ai-voice-conversation-tutor-design.md` (§10 infra, §11 data model).

## Global Constraints

- All new files are TypeScript; no new `.js` files (migrations are the existing exception — they are `.js`).
- New model enums use the exported-constant pattern: `export const X = [...] as const; export type T = (typeof X)[number];`.
- Config values are read from the `Config` class, never `process.env` directly in app code.
- Every commit must build (`make build-server`), lint clean (`make lint-server`), and pass tests (`make test-server`).
- Voice/eval env vars are **optional** (the feature is not enabled in every environment), so a missing one must not crash boot.
- Docker: never hardcode `container_name`; port/service config stays parameterized.

---

## File Structure

- `render.yaml` — add a `keyvalue` service; wire `REDIS_URL` into `web` + `worker`.
- `docker-compose.yaml` — enable the local Redis service.
- `server/src/queue/index.ts` — add `maxRetriesPerRequest: null` to the ioredis connection (BullMQ requirement).
- `server/src/config/envVars.ts` — add the voice/eval vars to `optionalEnvVars`.
- `server/src/config/config.ts` — declare the new optional fields (+ `_`-prefixed variants).
- `server/src/db/models/conversationSession.model/conversationSession.model.ts` — the model + enum constants.
- `server/src/db/models/conversationSession.model/index.ts` — re-export.
- `server/src/db/migrations/<timestamp>-create-conversation-sessions.js` — the table.
- `server/src/test/testDataGenerator.ts` — add `createConversationSession` factory.
- `server/src/db/models/conversationSession.model/conversationSession.model.test.ts` — model smoke test.

---

## Task 1: Provision Redis (Key Value) + wire REDIS_URL + fix BullMQ connection

**Files:**
- Modify: `render.yaml`
- Modify: `docker-compose.yaml`
- Modify: `server/src/queue/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `REDIS_URL` in every environment so `isRedisEnabled === true` and BullMQ jobs run; ioredis connection compatible with BullMQ.

- [ ] **Step 1: Add the Key Value service and wire REDIS_URL in `render.yaml`**

Under the top-level `services:` list, add a Key Value service (Render's managed Redis). Place it as the first `services` entry:

```yaml
  - type: keyvalue
    name: lengua-kv
    plan: starter
    region: ohio
    # BullMQ REQUIRES no eviction — jobs must never be dropped under memory pressure.
    maxmemoryPolicy: noeviction
    # Internal-only access (no public IPs). Empty list = only same-region Render services.
    ipAllowList: []
```

Then add `REDIS_URL` to **both** the `web` and `worker` services' `envVars:` (place it next to the existing `DATABASE_URL` block in each):

```yaml
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: lengua-kv
          property: connectionString
```

- [ ] **Step 2: Enable Redis locally in `docker-compose.yaml`**

Replace the commented-out Redis block (currently lines ~2-6) with an active service, and add `REDIS_URL` to the `server` service environment. Match the existing indentation/style of the other services:

```yaml
  redis:
    image: "redis:alpine"
    command: ["redis-server", "--maxmemory-policy", "noeviction"]
    ports:
      - "127.0.0.1:${REDIS_PORT:-6379}:6379"
```

In the `server` service's `environment:` add:

```yaml
      - REDIS_URL=redis://redis:6379
```

(If a `.env-example` / root `.env-example` lists env vars, add `REDIS_URL=redis://redis:6379` there too so new clones get it.)

- [ ] **Step 3: Make the ioredis connection BullMQ-compatible in `server/src/queue/index.ts`**

In `getRedisConnection()`, add `maxRetriesPerRequest: null` to the returned object (BullMQ throws if this is not null on the blocking connection):

```ts
  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: redisUrl.password || undefined,
    db: process.env.NODE_ENV === 'test' ? 1 : 0,
    maxRetriesPerRequest: null,
    ...(isTLS ? { tls: {} } : {}),
  };
```

- [ ] **Step 4: Verify build + lint**

Run: `make build-server && make lint-server`
Expected: both succeed with no errors.

- [ ] **Step 5: Verify Redis wiring at runtime**

Run: `make launch-detached` then `make logs-server`
Expected: server log shows `Redis connection established` (from `queue/index.ts`), not `Skipping Redis setup... REDIS_URL not found`.
Then: `make terminate`.

- [ ] **Step 6: Commit**

```bash
git add render.yaml docker-compose.yaml server/src/queue/index.ts
git commit -m "feat(infra): provision Redis (Render Key Value) and wire REDIS_URL for BullMQ"
```

---

## Task 2: Add voice/evaluation env vars to config

**Files:**
- Modify: `server/src/config/envVars.ts`
- Modify: `server/src/config/config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `config.ELEVENLABS_API_KEY`, `config.ELEVENLABS_CONVAI_AGENT_ID`, `config.ELEVENLABS_WEBHOOK_SECRET`, `config.VOICE_PROVIDER`, `config.VOICE_MAX_SESSION_SECONDS`, `config.ANTHROPIC_API_KEY`, `config.EVALUATOR_MODEL`, `config.VOICE_MAX_EVALUATIONS_PER_DAY` — all optional strings, later PRs read these.

- [ ] **Step 1: Add the vars to `optionalEnvVars` in `server/src/config/envVars.ts`**

Append to the `optionalEnvVars` array (keep the existing entries):

```ts
export const optionalEnvVars = [
  'SOME_OPTIONAL_ENV_VARIABLE',
  'BASIC_AUTH_TOKENS',
  'REDIS_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_IOS_CLIENT_ID',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_CONVAI_AGENT_ID',
  'ELEVENLABS_WEBHOOK_SECRET',
  'VOICE_PROVIDER',
  'VOICE_MAX_SESSION_SECONDS',
  'ANTHROPIC_API_KEY',
  'EVALUATOR_MODEL',
  'VOICE_MAX_EVALUATIONS_PER_DAY',
] as const;
```

Note: `REDIS_URL` is intentionally **not** promoted to `requiredEnvVars` — the queue code already degrades gracefully, and tests run without Redis. Requiring it would break the test env.

- [ ] **Step 2: Declare the fields on the `Config` class in `server/src/config/config.ts`**

After the existing `GOOGLE_IOS_CLIENT_ID?` / `_GOOGLE_IOS_CLIENT_ID?` declarations, add the new fields following the exact same paired pattern:

```ts
  ELEVENLABS_API_KEY?: string;
  _ELEVENLABS_API_KEY?: string;
  ELEVENLABS_CONVAI_AGENT_ID?: string;
  _ELEVENLABS_CONVAI_AGENT_ID?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  _ELEVENLABS_WEBHOOK_SECRET?: string;
  VOICE_PROVIDER?: string;
  _VOICE_PROVIDER?: string;
  VOICE_MAX_SESSION_SECONDS?: string;
  _VOICE_MAX_SESSION_SECONDS?: string;
  ANTHROPIC_API_KEY?: string;
  _ANTHROPIC_API_KEY?: string;
  EVALUATOR_MODEL?: string;
  _EVALUATOR_MODEL?: string;
  VOICE_MAX_EVALUATIONS_PER_DAY?: string;
  _VOICE_MAX_EVALUATIONS_PER_DAY?: string;
```

No change to `loadEnvVars()` is needed — it already iterates `optionalEnvVars` and assigns both `this[envVar]` and `this[_${envVar}]`.

- [ ] **Step 3: Verify build + lint**

Run: `make build-server && make lint-server`
Expected: both succeed (the new fields are recognized; no missing-env crash because they are optional).

- [ ] **Step 4: Commit**

```bash
git add server/src/config/envVars.ts server/src/config/config.ts
git commit -m "feat(config): add voice + evaluation env vars"
```

---

## Task 3: ConversationSession enums + model

**Files:**
- Create: `server/src/db/models/conversationSession.model/conversationSession.model.ts`
- Create: `server/src/db/models/conversationSession.model/index.ts`

**Interfaces:**
- Consumes: `sequelize` from `../../sequelize` (same import the User model uses).
- Produces:
  - `VOICE_MODES`, `VoiceMode`
  - `CONVERSATION_SESSION_STATUSES`, `ConversationSessionStatus`
  - `EVALUATION_STATUSES`, `EvaluationStatus`
  - default export `ConversationSession` (Sequelize model). Column names used by later PRs are exactly as declared below.

- [ ] **Step 1: Write the model + enums**

Create `server/src/db/models/conversationSession.model/conversationSession.model.ts`:

```ts
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

export const VOICE_MODES = ['quiz', 'weave'] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const CONVERSATION_SESSION_STATUSES = [
  'active',
  'completed',
  'failed',
  'expired',
] as const;
export type ConversationSessionStatus = (typeof CONVERSATION_SESSION_STATUSES)[number];

export const EVALUATION_STATUSES = [
  'not_started',
  'waiting_transcript',
  'pending',
  'ready',
  'failed',
  'expired',
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

class ConversationSession extends Model<
  InferAttributes<ConversationSession>,
  InferCreationAttributes<ConversationSession>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare provider: string;
  declare providerConversationId: CreationOptional<string | null>;
  declare mode: VoiceMode;
  declare targetLanguageCode: string;
  declare status: CreationOptional<ConversationSessionStatus>;
  declare vocabSnapshot: CreationOptional<unknown>;
  declare promptVersion: CreationOptional<string | null>;
  declare providerConfigSnapshot: CreationOptional<unknown>;
  declare evaluationStatus: CreationOptional<EvaluationStatus>;
  declare rawProviderTranscript: CreationOptional<unknown>;
  declare normalizedTranscript: CreationOptional<unknown>;
  declare scoring: CreationOptional<unknown>;
  declare evaluatorProvider: CreationOptional<string | null>;
  declare evaluatorModel: CreationOptional<string | null>;
  declare evaluatorVersion: CreationOptional<string | null>;
  declare transcriptHash: CreationOptional<string | null>;
  declare evaluationAttemptCount: CreationOptional<number>;
  declare evaluationErrorCode: CreationOptional<string | null>;
  declare evaluationErrorMessage: CreationOptional<string | null>;
  declare webhookReceivedAt: CreationOptional<Date | null>;
  declare clientEndedAt: CreationOptional<Date | null>;
  declare evaluationStartedAt: CreationOptional<Date | null>;
  declare evaluationCompletedAt: CreationOptional<Date | null>;
  declare durationSeconds: CreationOptional<number | null>;
  declare costCents: CreationOptional<number | null>;
  declare startedAt: CreationOptional<Date | null>;
  declare endedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ConversationSession.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    provider: { type: DataTypes.STRING, allowNull: false },
    providerConversationId: { type: DataTypes.STRING, unique: true, allowNull: true },
    mode: { type: DataTypes.ENUM(...VOICE_MODES), allowNull: false },
    targetLanguageCode: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM(...CONVERSATION_SESSION_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    vocabSnapshot: { type: DataTypes.JSONB, allowNull: true },
    promptVersion: { type: DataTypes.STRING, allowNull: true },
    providerConfigSnapshot: { type: DataTypes.JSONB, allowNull: true },
    evaluationStatus: {
      type: DataTypes.ENUM(...EVALUATION_STATUSES),
      allowNull: false,
      defaultValue: 'not_started',
    },
    rawProviderTranscript: { type: DataTypes.JSONB, allowNull: true },
    normalizedTranscript: { type: DataTypes.JSONB, allowNull: true },
    scoring: { type: DataTypes.JSONB, allowNull: true },
    evaluatorProvider: { type: DataTypes.STRING, allowNull: true },
    evaluatorModel: { type: DataTypes.STRING, allowNull: true },
    evaluatorVersion: { type: DataTypes.STRING, allowNull: true },
    transcriptHash: { type: DataTypes.STRING, allowNull: true },
    evaluationAttemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    evaluationErrorCode: { type: DataTypes.STRING, allowNull: true },
    evaluationErrorMessage: { type: DataTypes.STRING, allowNull: true },
    webhookReceivedAt: { type: DataTypes.DATE, allowNull: true },
    clientEndedAt: { type: DataTypes.DATE, allowNull: true },
    evaluationStartedAt: { type: DataTypes.DATE, allowNull: true },
    evaluationCompletedAt: { type: DataTypes.DATE, allowNull: true },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
    costCents: { type: DataTypes.INTEGER, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'conversationSession',
  },
);

export default ConversationSession;
```

- [ ] **Step 2: Write the re-export `index.ts`**

Create `server/src/db/models/conversationSession.model/index.ts`:

```ts
import ConversationSession from './conversationSession.model';
export default ConversationSession;
```

- [ ] **Step 3: Verify build + lint**

Run: `make build-server && make lint-server`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/models/conversationSession.model
git commit -m "feat(db): add ConversationSession model and enums"
```

---

## Task 4: ConversationSession migration

**Files:**
- Create: `server/src/db/migrations/<timestamp>-create-conversation-sessions.js`

**Interfaces:**
- Consumes: the column set from Task 3 (names/types must match exactly).
- Produces: the `conversationSessions` table in dev + test DBs.

Note on tooling: `make generate-migration NAME=...` scaffolds an empty migration (it writes to `dist` then copies to `src`). We then replace its body with the content below. Sequelize pluralizes `modelName: 'conversationSession'` to table `conversationSessions`.

- [ ] **Step 1: Scaffold the migration file**

Run: `make generate-migration NAME=create-conversation-sessions`
Expected: a new file `server/src/db/migrations/<timestamp>-create-conversation-sessions.js` appears.

- [ ] **Step 2: Replace the file body**

Set the generated file's contents to:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversationSessions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        autoIncrement: false,
      },
      userId: { type: Sequelize.UUID, allowNull: false },
      provider: { type: Sequelize.STRING, allowNull: false },
      providerConversationId: { type: Sequelize.STRING, unique: true, allowNull: true },
      mode: { type: Sequelize.ENUM('quiz', 'weave'), allowNull: false },
      targetLanguageCode: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'failed', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      vocabSnapshot: { type: Sequelize.JSONB, allowNull: true },
      promptVersion: { type: Sequelize.STRING, allowNull: true },
      providerConfigSnapshot: { type: Sequelize.JSONB, allowNull: true },
      evaluationStatus: {
        type: Sequelize.ENUM(
          'not_started',
          'waiting_transcript',
          'pending',
          'ready',
          'failed',
          'expired',
        ),
        allowNull: false,
        defaultValue: 'not_started',
      },
      rawProviderTranscript: { type: Sequelize.JSONB, allowNull: true },
      normalizedTranscript: { type: Sequelize.JSONB, allowNull: true },
      scoring: { type: Sequelize.JSONB, allowNull: true },
      evaluatorProvider: { type: Sequelize.STRING, allowNull: true },
      evaluatorModel: { type: Sequelize.STRING, allowNull: true },
      evaluatorVersion: { type: Sequelize.STRING, allowNull: true },
      transcriptHash: { type: Sequelize.STRING, allowNull: true },
      evaluationAttemptCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      evaluationErrorCode: { type: Sequelize.STRING, allowNull: true },
      evaluationErrorMessage: { type: Sequelize.STRING, allowNull: true },
      webhookReceivedAt: { type: Sequelize.DATE, allowNull: true },
      clientEndedAt: { type: Sequelize.DATE, allowNull: true },
      evaluationStartedAt: { type: Sequelize.DATE, allowNull: true },
      evaluationCompletedAt: { type: Sequelize.DATE, allowNull: true },
      durationSeconds: { type: Sequelize.INTEGER, allowNull: true },
      costCents: { type: Sequelize.INTEGER, allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      endedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('conversationSessions', ['userId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversationSessions');
    // Drop the ENUM types Postgres created for the enum columns.
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_conversationSessions_mode";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_conversationSessions_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_conversationSessions_evaluationStatus";',
    );
  },
};
```

- [ ] **Step 3: Build and run migrations on dev + test DBs**

Run: `make build-server && make migrate-all`
Expected: migration runs with no error; the `conversationSessions` table exists.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/migrations
git commit -m "feat(db): create conversationSessions table"
```

---

## Task 5: Test data factory + model smoke test

**Files:**
- Modify: `server/src/test/testDataGenerator.ts`
- Create: `server/src/db/models/conversationSession.model/conversationSession.model.test.ts`

**Interfaces:**
- Consumes: `ConversationSession`, `VoiceMode` from Task 3; `createUser` (existing).
- Produces: `createConversationSession(overrides?)` for later PRs' tests.

- [ ] **Step 1: Write the failing model test**

Create `server/src/db/models/conversationSession.model/conversationSession.model.test.ts`:

```ts
import { expect } from 'chai';
import ConversationSession from './conversationSession.model';
import { createUser } from '../../../test/testDataGenerator';

describe('ConversationSession model', () => {
  it('creates a session with sensible defaults', async () => {
    const user = await createUser();
    const session = await ConversationSession.create({
      userId: user.id,
      provider: 'elevenlabs',
      mode: 'quiz',
      targetLanguageCode: 'es',
    });

    expect(session.id).to.be.a('string');
    expect(session.status).to.equal('active');
    expect(session.evaluationStatus).to.equal('not_started');
    expect(session.evaluationAttemptCount).to.equal(0);
  });

  it('persists JSONB fields round-trip', async () => {
    const user = await createUser();
    const vocab = [{ id: 'w1', term: 'perro', translation: 'dog', familiarity: 2, bucket: 'learning' }];
    const session = await ConversationSession.create({
      userId: user.id,
      provider: 'elevenlabs',
      mode: 'weave',
      targetLanguageCode: 'es',
      vocabSnapshot: vocab,
    });

    const reloaded = await ConversationSession.findByPk(session.id);
    expect(reloaded?.vocabSnapshot).to.deep.equal(vocab);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `make test-server` (or the project's single-file test invocation)
Expected: FAIL — `createConversationSession` is not yet exported / factory not present is fine here since the test uses `ConversationSession.create` directly; the failure will instead be a missing import only if paths are wrong. If it already passes, proceed (the model exists from Task 3). The intent of the red step is to confirm the test executes against the new table.

- [ ] **Step 3: Add the `createConversationSession` factory**

In `server/src/test/testDataGenerator.ts`, add near the other factories (after `createUserWithToken`):

```ts
import ConversationSession, {
  VoiceMode,
} from '../db/models/conversationSession.model';

type ConversationSessionOverrides = Partial<{
  userId: string;
  provider: string;
  mode: VoiceMode;
  targetLanguageCode: string;
}>;

export async function createConversationSession(overrides: ConversationSessionOverrides = {}) {
  const userId = overrides.userId ?? (await createUser()).id;
  return ConversationSession.create({
    userId,
    provider: overrides.provider ?? 'elevenlabs',
    mode: overrides.mode ?? 'quiz',
    targetLanguageCode: overrides.targetLanguageCode ?? 'es',
  });
}
```

(Place the `import` with the other imports at the top of the file, not inline.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-server`
Expected: PASS — both model tests green; no other suites broken.

- [ ] **Step 5: Commit**

```bash
git add server/src/test/testDataGenerator.ts server/src/db/models/conversationSession.model/conversationSession.model.test.ts
git commit -m "test(db): ConversationSession factory and model tests"
```

---

## Definition of Done (PR 1)

- [ ] `render.yaml` provisions Key Value; `REDIS_URL` wired into web + worker; local Redis runs via compose.
- [ ] `queue/index.ts` uses `maxRetriesPerRequest: null`; server logs `Redis connection established` locally.
- [ ] All voice/eval env vars readable via `config.*` (optional, no boot crash).
- [ ] `ConversationSession` model + enums + migration applied to dev + test DBs.
- [ ] `createConversationSession` factory + passing model tests.
- [ ] `make build-server && make lint-server && make test-server` all green.
- [ ] `make prettier-all` run before pushing.

## Self-Review Notes

- Spec coverage: implements spec §10 (Redis infra, env vars) and §11 (data model). Prompt/modes/provider/webhook/evaluator/report are later PRs — intentionally absent.
- Type consistency: enum constants (`VOICE_MODES`, `CONVERSATION_SESSION_STATUSES`, `EVALUATION_STATUSES`) and every column name are identical across the model (Task 3), migration (Task 4), and factory/test (Task 5).
- The migration `down` drops the Postgres ENUM types explicitly, which `dropTable` alone does not do — prevents "type already exists" on a re-migrate.
