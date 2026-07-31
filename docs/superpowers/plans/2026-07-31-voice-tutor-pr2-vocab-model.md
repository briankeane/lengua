# Voice Tutor — PR 2: User-Authored Vocab Data Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the per-user vocabulary data foundation for the voice tutor: the `VocabItem` model + enums, its migration, and a test factory + model tests. This is the storage layer for the app's core input loop (the learner types everyday English phrases, we generate the Spanish, Save persists the per-user pair). **No endpoints, no translation call, no VocabSource selection** — those are PR 3+.

**Architecture:** Vocabulary is **per-user by design** — every row is owned by one user (`userId` FK, `ON DELETE CASCADE`), there is **no shared/curated catalog**. A vocab item is an English `sourceText` the learner typed plus the generated target-language `term` (the learning object). Mastery fields (`familiarity`, counters, `nextDueAt`) live on the row but are **not driven by anything in this PR** — writeback is PR 6. `bucket` is derived from `familiarity`, never stored. Enums follow the project's exported-constant pattern. Mirrors the shape of the `ConversationSession` model that landed in PR 1.

**Tech Stack:** Node 22, TypeScript, Express 5, Sequelize 6 + Postgres, sequelize-cli migrations (`.js`), Mocha/Chai.

**Full design spec:** `docs/superpowers/specs/2026-07-31-ai-voice-conversation-tutor-design.md` (§6 vocabulary, §11 data model — the `vocabItems` table).

## Global Constraints

- All new app files are TypeScript; migrations are the existing `.js` exception.
- Enums use the exported-constant pattern: `export const X = [...] as const; export type T = (typeof X)[number];`.
- Config values are read from the `Config` class, never `process.env` directly (not exercised in this PR, but keep the rule).
- Every commit must build (`make build-server`), lint clean (`make lint-server`), and pass tests (`make test-server`).
- Don't build endpoints, the translate call, `VocabSource`, prompt injection, or mastery writeback — later PRs.
- The migration `down` must drop the Postgres ENUM types explicitly (as PR 1's did) so a re-migrate doesn't hit "type already exists".

---

## File Structure

- `server/src/db/models/vocabItem.model/vocabItem.model.ts` — the model + enum constants.
- `server/src/db/models/vocabItem.model/index.ts` — re-export (default + `export *`).
- `server/src/db/migrations/<timestamp>-create-vocab-items.js` — the table.
- `server/src/test/testDataGenerator.ts` — add `createVocabItem` factory.
- `server/src/db/models/vocabItem.model/vocabItem.model.test.ts` — model smoke test.

---

## Task 1: VocabItem enums + model

**Files:**
- Create: `server/src/db/models/vocabItem.model/vocabItem.model.ts`
- Create: `server/src/db/models/vocabItem.model/index.ts`

**Interfaces:**
- Consumes: `sequelize` from `../../sequelize` (same import User + ConversationSession use).
- Produces:
  - `VOCAB_ITEM_TYPES`, `VocabItemType`
  - `TRANSLATION_SOURCES`, `TranslationSource`
  - default export `VocabItem` (Sequelize model). Column names used by later PRs are exactly as declared below.

- [ ] **Step 1: Write the model + enums**

Create `server/src/db/models/vocabItem.model/vocabItem.model.ts`:

```ts
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

export const VOCAB_ITEM_TYPES = ['word', 'phrase'] as const;
export type VocabItemType = (typeof VOCAB_ITEM_TYPES)[number];

export const TRANSLATION_SOURCES = ['ai', 'user'] as const;
export type TranslationSource = (typeof TRANSLATION_SOURCES)[number];

class VocabItem extends Model<
  InferAttributes<VocabItem>,
  InferCreationAttributes<VocabItem>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare targetLanguageCode: string;
  declare sourceText: string;
  declare term: string;
  declare termNormalized: string;
  declare itemType: VocabItemType;
  declare partOfSpeech: CreationOptional<string | null>;
  declare translationSource: CreationOptional<TranslationSource>;
  declare familiarity: CreationOptional<number>;
  declare lastSeenAt: CreationOptional<Date | null>;
  declare timesSeen: CreationOptional<number>;
  declare timesCorrect: CreationOptional<number>;
  declare timesIncorrect: CreationOptional<number>;
  declare lastOutcome: CreationOptional<string | null>;
  declare nextDueAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

VocabItem.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    targetLanguageCode: { type: DataTypes.STRING, allowNull: false },
    sourceText: { type: DataTypes.STRING, allowNull: false },
    term: { type: DataTypes.STRING, allowNull: false },
    termNormalized: { type: DataTypes.STRING, allowNull: false },
    itemType: { type: DataTypes.ENUM(...VOCAB_ITEM_TYPES), allowNull: false },
    partOfSpeech: { type: DataTypes.STRING, allowNull: true },
    translationSource: {
      type: DataTypes.ENUM(...TRANSLATION_SOURCES),
      allowNull: false,
      defaultValue: 'ai',
    },
    familiarity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    timesSeen: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    timesCorrect: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    timesIncorrect: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastOutcome: { type: DataTypes.STRING, allowNull: true },
    nextDueAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'vocabItem',
    indexes: [
      { unique: true, fields: ['userId', 'targetLanguageCode', 'termNormalized'] },
      { fields: ['userId', 'familiarity'] },
      { fields: ['userId', 'nextDueAt'] },
    ],
  },
);

export default VocabItem;
```

- [ ] **Step 2: Write the re-export `index.ts`**

Create `server/src/db/models/vocabItem.model/index.ts`:

```ts
import VocabItem from './vocabItem.model';

export * from './vocabItem.model';
export default VocabItem;
```

(The `export *` re-exports the enums/types so later PRs import them from the model dir — same pattern PR 1 settled on for `conversationSession.model`.)

- [ ] **Step 3: Verify build + lint**

Run: `make build-server && make lint-server`
Expected: both succeed. If prettier reports formatting, run `make prettier-server` and re-lint.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/models/vocabItem.model
git commit -m "feat(db): add VocabItem model and enums"
```

---

## Task 2: VocabItem migration

**Files:**
- Create: `server/src/db/migrations/<timestamp>-create-vocab-items.js`

**Interfaces:**
- Consumes: the column set from Task 1 (names/types must match exactly); `users` table (FK target).
- Produces: the `vocabItems` table in dev + test DBs.

Note on tooling: `make generate-migration NAME=...` scaffolds via `dist` then copies to `src` — that `cp` also drags compiled `.js`/`.js.map` copies of the *existing* migrations into `src`. After scaffolding, **revert the touched existing migrations and delete any stray `.js.map` files**, keeping only the new migration (whose body you replace). Sequelize pluralizes `modelName: 'vocabItem'` to table `vocabItems`.

- [ ] **Step 1: Scaffold the migration file**

Run: `make generate-migration NAME=create-vocab-items`
Expected: a new file `server/src/db/migrations/<timestamp>-create-vocab-items.js` appears.

- [ ] **Step 2: Clean up scaffold pollution**

```bash
cd server/src/db/migrations
git checkout -- $(git diff --name-only . | grep -v create-vocab-items) 2>/dev/null || true
rm -f *.js.map
cd -
git status --short server/src/db/migrations/
```
Expected: only the new `<timestamp>-create-vocab-items.js` is untracked; no other migration shows as modified; no `.js.map` files.

- [ ] **Step 3: Replace the file body**

Set the generated file's contents to:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vocabItems', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        autoIncrement: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      targetLanguageCode: { type: Sequelize.STRING, allowNull: false },
      sourceText: { type: Sequelize.STRING, allowNull: false },
      term: { type: Sequelize.STRING, allowNull: false },
      termNormalized: { type: Sequelize.STRING, allowNull: false },
      itemType: { type: Sequelize.ENUM('word', 'phrase'), allowNull: false },
      partOfSpeech: { type: Sequelize.STRING, allowNull: true },
      translationSource: {
        type: Sequelize.ENUM('ai', 'user'),
        allowNull: false,
        defaultValue: 'ai',
      },
      familiarity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lastSeenAt: { type: Sequelize.DATE, allowNull: true },
      timesSeen: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      timesCorrect: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      timesIncorrect: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lastOutcome: { type: Sequelize.STRING, allowNull: true },
      nextDueAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('vocabItems', ['userId', 'targetLanguageCode', 'termNormalized'], {
      unique: true,
      name: 'vocab_items_user_lang_term_unique',
    });
    await queryInterface.addIndex('vocabItems', ['userId', 'familiarity']);
    await queryInterface.addIndex('vocabItems', ['userId', 'nextDueAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vocabItems');
    // Drop the ENUM types Postgres created for the enum columns.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_vocabItems_itemType";');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_vocabItems_translationSource";',
    );
  },
};
```

- [ ] **Step 4: Build and run migrations on dev + test DBs**

Run: `make build-server && make migrate-all`
Expected: migration runs with no error on both DBs; the `vocabItems` table exists with the FK and unique index.

- [ ] **Step 5: Verify reversibility (optional but recommended)**

Undo then redo on the test DB to confirm the `down` (incl. ENUM drops) is clean:
```bash
docker compose exec -T server sh -c "npx env-cmd -f .env-test ts-node -r tsconfig-paths/register ./node_modules/.bin/sequelize db:migrate:undo"
docker compose exec -T server sh -c "npm run migrate:test"
```
Expected: `reverting` then `migrating` with no "type already exists" error.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/migrations
git commit -m "feat(db): create vocabItems table"
```

---

## Task 3: Test data factory + model smoke test

**Files:**
- Modify: `server/src/test/testDataGenerator.ts`
- Create: `server/src/db/models/vocabItem.model/vocabItem.model.test.ts`

**Interfaces:**
- Consumes: `VocabItem`, `VocabItemType` from Task 1; `createUser` (existing).
- Produces: `createVocabItem(overrides?)` for later PRs' tests.

- [ ] **Step 1: Write the failing model test**

Create `server/src/db/models/vocabItem.model/vocabItem.model.test.ts`:

```ts
import { expect } from 'chai';
import VocabItem from './vocabItem.model';
import { createUser } from '../../../test/testDataGenerator';

describe('VocabItem model', () => {
  it('creates an item with sensible defaults', async () => {
    const user = await createUser();
    const item = await VocabItem.create({
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: "Where's the bathroom?",
      term: '¿Dónde está el baño?',
      termNormalized: 'donde esta el bano',
      itemType: 'phrase',
    });

    expect(item.id).to.be.a('string');
    expect(item.translationSource).to.equal('ai');
    expect(item.familiarity).to.equal(0);
    expect(item.timesSeen).to.equal(0);
  });

  it('enforces per-user uniqueness on (userId, targetLanguageCode, termNormalized)', async () => {
    const user = await createUser();
    const base = {
      userId: user.id,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      term: 'perro',
      termNormalized: 'perro',
      itemType: 'word' as const,
    };
    await VocabItem.create(base);
    let threw = false;
    try {
      await VocabItem.create(base);
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it('allows the same normalized term for different users', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const shape = (userId: string) => ({
      userId,
      targetLanguageCode: 'es',
      sourceText: 'dog',
      term: 'perro',
      termNormalized: 'perro',
      itemType: 'word' as const,
    });
    await VocabItem.create(shape(a.id));
    const second = await VocabItem.create(shape(b.id));
    expect(second.id).to.be.a('string');
  });
});
```

- [ ] **Step 2: Run the test to verify it executes (red/settling)**

Run: `make test-server-file GREP="VocabItem model"`
Expected: the suite runs against the new table. If it fails only because the factory import is missing, that's fine — the tests above use `VocabItem.create` directly. The intent is to confirm the model + table + unique constraint behave.

- [ ] **Step 3: Add the `createVocabItem` factory**

In `server/src/test/testDataGenerator.ts`, add the import with the other imports at the top:

```ts
import VocabItem, { VocabItemType } from '../db/models/vocabItem.model';
```

and add the factory near the others (after `createConversationSession`):

```ts
type VocabItemOverrides = Partial<{
  userId: string;
  targetLanguageCode: string;
  sourceText: string;
  term: string;
  termNormalized: string;
  itemType: VocabItemType;
}>;

export async function createVocabItem(overrides: VocabItemOverrides = {}) {
  const userId = overrides.userId ?? (await createUser()).id;
  const term = overrides.term ?? 'perro';
  return VocabItem.create({
    userId,
    targetLanguageCode: overrides.targetLanguageCode ?? 'es',
    sourceText: overrides.sourceText ?? 'dog',
    term,
    termNormalized: overrides.termNormalized ?? term.toLowerCase(),
    itemType: overrides.itemType ?? 'word',
  });
}
```

- [ ] **Step 4: Run the full suite**

Run: `make test-server`
Expected: PASS — the VocabItem model tests green; no other suites broken.

- [ ] **Step 5: Commit**

```bash
git add server/src/test/testDataGenerator.ts server/src/db/models/vocabItem.model/vocabItem.model.test.ts
git commit -m "test(db): VocabItem factory and model tests"
```

---

## Definition of Done (PR 2)

- [ ] `VocabItem` model + enums (`VOCAB_ITEM_TYPES`, `TRANSLATION_SOURCES`), user-owned via `userId` FK (`ON DELETE CASCADE`).
- [ ] `vocabItems` migration applied to dev + test DBs, with the per-user unique index and the two secondary indexes; `down` drops the ENUM types.
- [ ] `createVocabItem` factory + passing model tests (defaults, per-user uniqueness, cross-user allowed).
- [ ] `make build-server && make lint-server && make test-server` all green.
- [ ] `make prettier-all` run before pushing.
- [ ] Spec §6/§11 reflect this model (already updated in the design doc).

## Self-Review Notes

- Scope: this is storage only — the create/list/translate endpoints, DB-backed `VocabSource`, prompt injection, and mastery writeback are PR 3–6 (see spec §6 flow + §13). Intentionally absent here.
- Consistency: enum constants and every column name are identical across the model (Task 1), migration (Task 2), and factory/test (Task 3). Mirrors PR 1's `ConversationSession` shape (UUID PK, exported-const enums, FK to users with CASCADE, ENUM-drop in `down`).
- `bucket` is deliberately **not** a column — it is derived from `familiarity` (0–1 new, 2–3 learning, 4–5 known) at prompt/eval time and frozen into `ConversationSession.vocabSnapshot`.
- Mastery fields (`familiarity`, counters, `lastOutcome`, `nextDueAt`) exist but nothing writes to them in this PR; the writeback loop is PR 6.
