# Save Vocab Item Endpoint — Design

**Date:** 2026-08-01
**Status:** Approved (Codex architecture check complete)

## Summary

Add an authenticated endpoint that lets the iOS client **save a translated word or
phrase** to the user's vocab list for later review. The client translates locally and
sends the finished translation; the server only persists it as a `VocabItem`. No AI
translation happens on the server.

There is no separate `Phrase` or `Translation` table — a saved translation is a
`VocabItem` row: `sourceText` (the user's language) paired with `targetText` (the
target language).

This feature also **trims the `VocabItem` model** of columns that are not acted on
anywhere. The table has no data yet, so this is a clean schema change.

## Scope

Shipped as separate commits within one PR:

1. **Model reshape** — rename + drop columns on `VocabItem` (one migration).
2. **`POST /v1/vocab-items`** — create/save a vocab item, idempotent on duplicates.

Out of scope: listing/reading/updating/deleting vocab items, SRS scheduling, any AI
translation on the server, word-vs-phrase distinction.

## Part 1 — Model reshape

One new forward migration (not an edit of the merged `20260731194616-create-vocab-items.js`;
teammates/CI may have already run it, so schema changes must move forward):

| Change | Detail |
| ------ | ------ |
| **rename** | `term` → `targetText` |
| **rename** | `termNormalized` → `targetTextNormalized` |
| **drop**   | `translationSource` column + Postgres type `enum_vocabItems_translationSource` |
| **drop**   | `itemType` column + Postgres type `enum_vocabItems_itemType` |
| **drop**   | `partOfSpeech` column |

Migration ordering: rename the two columns, remove the three columns, then `DROP TYPE`
the two enum types (drop the columns before their enum types, or Postgres refuses).
The unique index still functions after the rename (Postgres tracks columns by identity);
optionally rename it `vocab_items_user_lang_term_unique` → `vocab_items_user_lang_targettext_unique`
for clarity. `down` reverses everything (re-add enum columns with prior defaults, rename back).

**Model / barrel / test / factory updates:**
- `vocabItem.model.ts`: delete `VOCAB_ITEM_TYPES`, `VocabItemType`, `TRANSLATION_SOURCES`,
  `TranslationSource`; rename `term`/`termNormalized` field declarations and column defs to
  `targetText`/`targetTextNormalized`; remove `itemType`, `translationSource`,
  `partOfSpeech` declarations and column defs; update `termNormalized` → `targetTextNormalized`
  in the `indexes` array.
- `index.ts` barrel: drop the removed named exports.
- `vocabItem.model.test.ts`: update to the new column set.
- `test/testDataGenerator.ts` `createVocabItem` factory: rename `term`/`termNormalized`
  overrides to `targetText`/`targetTextNormalized`; drop the `itemType` override.

### Final `VocabItem` columns after reshape

`id`, `userId`, `targetLanguageCode`, `sourceText`, `targetText`, `targetTextNormalized`,
`familiarity`, `lastSeenAt`, `timesSeen`, `timesCorrect`, `timesIncorrect`, `lastOutcome`,
`nextDueAt`, `createdAt`, `updatedAt`.

## Part 2 — `POST /v1/vocab-items`

### Auth

JWT required via the `authenticate` middleware in `security.ts`. `userId` is taken from
the token — **never** from the request body. A `userId` present in the body is ignored.

### Request body

| Field                | Type   | Required | Notes                                        |
| -------------------- | ------ | -------- | -------------------------------------------- |
| `targetLanguageCode` | string | yes      | non-empty, ≤ 20 chars, e.g. `"es"`           |
| `sourceText`         | string | yes      | non-empty, ≤ 512 chars; user's language      |
| `targetText`         | string | yes      | non-empty, ≤ 512 chars; target language      |

Length caps keep `targetTextNormalized` under Postgres' btree unique-index row-size
limit and prevent an unbounded `targetLanguageCode` from overflowing its varchar column;
exceeding a cap returns `400`.

Three required fields, nothing optional. **Server-owned (client must NOT send):** `id`,
`userId`, `targetTextNormalized`, and all SRS/stats fields (`familiarity`, `lastSeenAt`,
`timesSeen`, `timesCorrect`, `timesIncorrect`, `lastOutcome`, `nextDueAt`), plus
`createdAt`/`updatedAt`.

### Normalization & duplicates

- `targetTextNormalized = targetText.trim().normalize('NFC').toLowerCase()` — computed
  server-side. `NFC` first so composed vs decomposed accents don't slip past uniqueness;
  accents are **preserved** (`perró` ≠ `perro`); case and surrounding whitespace are not
  (`"Perro"` collides with `"perro"`). `toLowerCase()` is JS Unicode lowercase, not
  locale-aware folding — acceptable for v1. Known limitation: for Turkish/Azeri the
  dotted/dotless `I` casing differs from locale-aware folding, so `"IŞIK"` and `"ışık"`
  can dedupe to distinct rows. No crash or data loss; revisit if those languages are
  supported.
- `targetLanguageCode` is canonicalized to lowercase before storing/matching, so `"ES"`
  and `"es"` are the same language.
- Duplicate detection uses the unique index
  `(userId, targetLanguageCode, targetTextNormalized)`.
- **Uniqueness does not include `sourceText`.** Two source phrases that translate to the
  same `targetText` in the same language collide (`"dog" → "perro"` and `"hound" → "perro"`
  are one row). Intended: the list is keyed on the target-language term being learned. The
  first-saved `sourceText` wins; a later duplicate save returns the existing row unchanged.
- **Required-string validation:** `targetLanguageCode`, `sourceText`, `targetText` must be
  non-empty after trimming — reject `""` / `"   "` with `400` (presence-only checks are not
  enough, or `targetTextNormalized` could become `""`).

### Responses

| Status            | When                                                             | Body                      |
| ----------------- | --------------------------------------------------------------- | ------------------------- |
| `201 Created`     | New item saved                                                  | full `VocabItem` JSON     |
| `200 OK`          | Matching item already exists; returned **unchanged** (no upsert) | existing `VocabItem` JSON |
| `400 Bad Request` | Missing/empty field                                             | standard error shape      |
| `401 Unauthorized`| Missing/invalid token                                           | standard error shape      |

The client treats `200` and `201` identically ("saved"). The existing row is never
overwritten on a duplicate save.

### Response body shape (200 & 201)

```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "targetLanguageCode": "es",
  "sourceText": "the dog",
  "targetText": "el perro",
  "targetTextNormalized": "el perro",
  "familiarity": 0,
  "lastSeenAt": null,
  "timesSeen": 0,
  "timesCorrect": 0,
  "timesIncorrect": 0,
  "lastOutcome": null,
  "nextDueAt": null,
  "createdAt": "2026-08-01T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z"
}
```

## Implementation shape

- **lib** — `server/src/lib/vocabItem/` (`index.ts`, `vocabItem.lib.ts`,
  `vocabItem.lib.test.ts`). `saveVocabItem({ userId, targetLanguageCode, sourceText,
  targetText })`:
  1. canonicalize `targetLanguageCode` (lowercase) and compute `targetTextNormalized`,
  2. look up existing by `(userId, targetLanguageCode, targetTextNormalized)`; if found
     return `{ item, created: false }`,
  3. else `VocabItem.create(...)` inside `try/catch` — on
     `Sequelize.UniqueConstraintError` (concurrent insert won the race), re-fetch by the
     unique tuple and return `{ item, created: false }`; otherwise return
     `{ item, created: true }`. Race handling lives in the lib (persistence contract),
     not the controller.
- **api** — `server/src/api/vocabItem/` (`index.ts`, `vocabItem.api.ts`,
  `vocabItem.api.test.ts`, `vocabItem.api.docs.yaml`). Controller maps
  `created` → `201`/`200`. Mount `/v1/vocab-items` in `api/routes.ts`.
- **validation** — `checkBodyFor(['targetLanguageCode', 'sourceText', 'targetText'])`
  plus non-empty-after-trim checks on all three (extend the validation middleware if it
  only checks presence). `userId` in the body is ignored.

## Testing (TDD)

Follow the CLAUDE.md endpoint procedure — lib tests first, then integration:

**lib (`vocabItem.lib.test.ts`):**
- creates a new item and returns `{ created: true }`
- returns the existing item with `{ created: false }` on a duplicate `(userId, lang,
  targetTextNormalized)`; does not create a second row or overwrite `sourceText`
- computes `targetTextNormalized` (trim + NFC + lowercase, accents preserved); `perró` ≠ `perro`
- canonicalizes `targetLanguageCode` (`"ES"` matches `"es"`)
- treats different `targetLanguageCode` as non-duplicate
- `UniqueConstraintError` path: stub `VocabItem.create` to throw it, assert the lib
  re-fetches and returns `{ created: false }`

**api (`vocabItem.api.test.ts`, Supertest):**
- `201` on new save with correct body
- `200` on duplicate save, returns the existing row unchanged
- `400` on missing required field
- `400` on empty/whitespace-only `targetLanguageCode`, `sourceText`, or `targetText`
- `401` when unauthenticated
- `userId` in the body is ignored; the item is owned by the token's user
