# Save Vocab Item Endpoint — Design

**Date:** 2026-08-01
**Status:** Approved (pending Codex architecture check)

## Summary

Add an authenticated endpoint that lets the iOS client **save a translated word or
phrase** to the user's vocab list for later review. The client translates locally and
sends the finished translation; the server only persists it as a `VocabItem`.

There is no separate `Phrase` or `Translation` table — a "phrase" is a `VocabItem` with
`itemType: 'phrase'`, and the "translation" is the `sourceText` ↔ `term` pair on that
row. This endpoint is the first vocab lib/api module and follows the existing
`auth`/`user` module patterns.

This feature also **removes the `translationSource` column** from `VocabItem`. The
AI-vs-user provenance distinction is not acted on anywhere, so the column is dead weight.
Ownership is already captured by `userId`.

## Scope

Two parts, shipped as separate commits within one PR:

1. **Remove `translationSource`** from the `VocabItem` model (new drop migration + model +
   barrel + tests).
2. **`POST /v1/vocab-items`** — create/save a vocab item, idempotent on duplicates.

Out of scope: listing/reading/updating/deleting vocab items, SRS scheduling, any AI
translation on the server, word-vs-phrase-specific behavior (both are handled uniformly).

## Part 1 — Remove `translationSource`

- **New migration** removes the `translationSource` column and drops the Postgres enum
  type `enum_vocabItems_translationSource`. `down` re-adds the column
  (`ENUM('ai','user')`, `allowNull: false`, `defaultValue: 'ai'`) and the enum type.
  - Rationale for a new migration rather than editing `20260731194616-create-vocab-items.js`:
    that migration is already merged (PR #14); editing an already-run migration would not
    drop the column for teammates/CI who already ran it.
- **`vocabItem.model.ts`**: delete `TRANSLATION_SOURCES`, `TranslationSource`, the
  `translationSource` field declaration, and its column definition.
- **`index.ts` barrel**: drop the removed named exports.
- **Model test**: remove assertions referencing `translationSource`.
- **Factory** (`test/testDataGenerator.ts`): no change — it never set `translationSource`.

## Part 2 — `POST /v1/vocab-items`

### Auth

JWT required via the `authenticate` middleware in `security.ts`. `userId` is taken from
the token — **never** from the request body. A `userId` present in the body is ignored.

### Request body

| Field                | Type                   | Required | Notes                               |
| -------------------- | ---------------------- | -------- | ----------------------------------- |
| `targetLanguageCode` | string                 | yes      | e.g. `"es"`                         |
| `sourceText`         | string                 | yes      | user's language, e.g. `"the dog"`   |
| `term`               | string                 | yes      | target language, e.g. `"el perro"`  |
| `itemType`           | `"word" \| "phrase"`   | yes      | enum-validated (`VOCAB_ITEM_TYPES`) |
| `partOfSpeech`       | string \| null         | no       | optional                            |

**Server-owned (client must NOT send):** `id`, `userId`, `termNormalized`, and all
SRS/stats fields (`familiarity`, `lastSeenAt`, `timesSeen`, `timesCorrect`,
`timesIncorrect`, `lastOutcome`, `nextDueAt`), plus `createdAt`/`updatedAt`. These come
from model defaults.

### Normalization & duplicates

- `termNormalized = term.trim().normalize('NFC').toLowerCase()` — computed server-side.
  `NFC` first so a composed and a decomposed `é` don't slip past uniqueness; accents are
  **preserved** (`perró` ≠ `perro`); case and surrounding whitespace are not (`"Perro"`
  collides with `"perro"`). `toLowerCase()` is JS Unicode lowercase, not locale-aware
  folding — acceptable for v1.
- `targetLanguageCode` is canonicalized to lowercase before storing/matching, so `"ES"`
  and `"es"` are the same language (prevents duplicate leakage through the unique key).
- Duplicate detection uses the existing unique index
  `(userId, targetLanguageCode, termNormalized)`.
- **Uniqueness does not include `sourceText`.** Two different source phrases that
  translate to the same `term` in the same language collide (e.g. `"dog" → "perro"` and
  `"hound" → "perro"` are one row). This is intended: the vocab list is keyed on the
  target-language term the user is learning. The first-saved `sourceText` wins; a later
  duplicate save returns the existing row unchanged (does not overwrite `sourceText`).
- **Required-string validation:** `term`, `sourceText`, and `targetLanguageCode` must be
  non-empty after trimming — reject `""` / `"   "` with `400` (presence-only checks are
  not enough, or `termNormalized` could become `""`).
- `partOfSpeech`: missing or empty string coerces to `null`.

### Responses

| Status            | When                                                             | Body                     |
| ----------------- | --------------------------------------------------------------- | ------------------------ |
| `201 Created`     | New item saved                                                  | full `VocabItem` JSON    |
| `200 OK`          | Matching item already exists; returned **unchanged** (no upsert) | existing `VocabItem` JSON |
| `400 Bad Request` | Missing/invalid field                                           | standard error shape     |
| `401 Unauthorized`| Missing/invalid token                                           | standard error shape     |

The client treats `200` and `201` identically ("saved"). The existing row is never
overwritten on a duplicate save.

### Response body shape (200 & 201)

```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "targetLanguageCode": "es",
  "sourceText": "the dog",
  "term": "el perro",
  "termNormalized": "el perro",
  "itemType": "phrase",
  "partOfSpeech": null,
  "familiarity": 0,
  "lastSeenAt": null,
  "timesSeen": 0,
  "timesCorrect": 0,
  "timesIncorrect": 0,
  "lastOutcome": null,
  "nextDueAt": null,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Implementation shape

- **lib** — `server/src/lib/vocabItem/` (`index.ts`, `vocabItem.lib.ts`,
  `vocabItem.lib.test.ts`). `saveVocabItem({ userId, targetLanguageCode, sourceText,
  term, itemType, partOfSpeech })`:
  1. canonicalize `targetLanguageCode` (lowercase) and compute `termNormalized`,
  2. look up existing by `(userId, targetLanguageCode, termNormalized)`; if found return
     `{ item, created: false }`,
  3. else `VocabItem.create(...)` inside a `try/catch` — on
     `Sequelize.UniqueConstraintError` (the race: a concurrent insert won), re-fetch by
     the unique tuple and return `{ item, created: false }`; otherwise return
     `{ item, created: true }`. Race handling lives in the lib (persistence contract),
     not the controller.
- **api** — `server/src/api/vocabItem/` (`index.ts`, `vocabItem.api.ts`,
  `vocabItem.api.test.ts`, `vocabItem.api.docs.yaml`). Controller maps
  `created` → `201`/`200`. Mount `/v1/vocab-items` in `api/routes.ts`.
- **validation** — `checkBodyFor(['targetLanguageCode', 'sourceText', 'term',
  'itemType'])` + `checkBodyEnum('itemType', VOCAB_ITEM_TYPES)` + non-empty-after-trim
  checks on `term`/`sourceText`/`targetLanguageCode` (extend validation middleware if it
  only checks presence). `userId` in the body is ignored; other server-owned fields
  (`familiarity`, etc.) are ignored for v1.

## Testing (TDD)

Follow the CLAUDE.md endpoint procedure — lib tests first, then integration:

**lib (`vocabItem.lib.test.ts`):**
- creates a new item and returns `{ created: true }`
- returns the existing item with `{ created: false }` on a duplicate `(userId, lang,
  termNormalized)` and does not create a second row / does not overwrite `sourceText`
- computes `termNormalized` (trim + NFC + lowercase, accents preserved); `perró` ≠ `perro`
- canonicalizes `targetLanguageCode` (`"ES"` matches `"es"`)
- treats different `targetLanguageCode` as non-duplicate
- `UniqueConstraintError` path: stub `VocabItem.create` to throw it, assert the lib
  re-fetches and returns `{ created: false }`

**api (`vocabItem.api.test.ts`, Supertest):**
- `201` on new save with correct body
- `200` on duplicate save, returns the existing row unchanged
- `400` on missing required field / invalid `itemType`
- `400` on empty/whitespace-only `term`, `sourceText`, or `targetLanguageCode`
- `401` when unauthenticated
- `userId` in the body is ignored; the item is owned by the token's user

## Concurrency note

Two simultaneous saves of the same new term could both pass the existence check and race
to insert, with the second insert violating the unique index. **Handled in v1** (not
deferred): `saveVocabItem` catches `Sequelize.UniqueConstraintError`, re-fetches by the
unique tuple, and returns `{ item, created: false }` → `200`. The unique index is the
source of truth for correctness; the check-then-create is just an optimization to avoid
the throw on the common path.

## Migration note

Drop the **column first, then the enum type** (`enum_vocabItems_itemType` is unaffected;
only `enum_vocabItems_translationSource` is dropped). Dropping the enum type before the
column, or while anything still references it, will fail on Postgres.
```