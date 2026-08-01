# Voice Tutor — PR 3: Modes + Prompt Builder + VocabSource — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure server-side brain of the tutor: the shared **mode module** (each mode emits *both* the tutor instructions and the evaluation rubric), the **prompt builder** that assembles the full tutor prompt, the **DB-backed `VocabSource`** that selects a session's words from the learner's `vocabItems`, and a **dev seed** so the voice loop is demoable before the authoring UI exists (PR 7).

**Architecture:** Provider-agnostic and side-effect-light. One module per mode under `lib/voice/modes/` owns the familiarity→quiz-style rules and defines what "success" means, emitting a tutor-instruction fragment and an evaluation-rubric fragment from the same place so they can't drift. The prompt builder composes core rules + language policy + speech style + the mode fragment + the vocab list into one string (what ElevenLabs will later receive as a prompt override — the ElevenLabs-specific wrapping lands in PR 4). `VocabSource` reads the learner's own rows and picks a session set by familiarity; `bucket` is derived here, never stored. Everything in this PR is unit-testable with `createVocabItem` / `createUser` and no external HTTP.

**Tech Stack:** Node 22, TypeScript, Express 5 (not touched here), Sequelize 6 + Postgres, Mocha/Chai.

**Full design spec:** `docs/superpowers/specs/2026-07-31-ai-voice-conversation-tutor-design.md` (§4 modes, §5 prompt, §6 vocabulary, §7 evaluation types, §16 roadmap).

## Global Constraints

- All new files are TypeScript. Lib modules follow the repo pattern: `lib/<area>/<name>.ts` + co-located `<name>.test.ts` + an `index.ts` of named re-exports.
- Reuse `VoiceMode` / `VOICE_MODES` from `db/models/conversationSession.model` — do not redefine the mode enum.
- Reuse `VocabItem` (Sequelize model) from `db/models/vocabItem.model` for DB reads; the **seam type** returned by `VocabSource` is a plain object (defined here), not the Sequelize instance.
- `bucket` is derived from `familiarity`, never persisted.
- Config via the `Config` class if needed (session size may be a constant here; no new env var required).
- Every commit must build (`make build-server`), lint clean (`make lint-server`), pass tests (`make test-server`); run `make prettier-all` before pushing.
- **Scope fence:** no ElevenLabs calls, no session endpoint, no webhook, no evaluator LLM call, no client. The rubric text produced here is *consumed* by the evaluator in PR 5; we only generate strings in this PR.

---

## File Structure

- `server/src/lib/voice/types.ts` — seam types: `VocabItem`, `FamiliarityBucket`, `VoiceModeDefinition`, `ModeInstructionInput`, `ModeRubricInput`, `SessionVocab`.
- `server/src/lib/voice/familiarity.ts` — `bucketFor(familiarity)`.
- `server/src/lib/voice/modes/quiz.mode.ts` — quiz mode definition.
- `server/src/lib/voice/modes/weave.mode.ts` — weave mode definition.
- `server/src/lib/voice/modes/index.ts` — `getModeDefinition(mode)` registry.
- `server/src/lib/voice/prompt/promptBuilder.ts` — `buildTutorPrompt(input)`, `PROMPT_VERSION`.
- `server/src/lib/voice/vocab/vocabSource.ts` — `getSessionVocab(input)`, `SESSION_WORD_COUNT`.
- `server/src/lib/voice/index.ts` — named re-exports.
- `server/src/scripts/seedVocab.ts` — dev-only seed of a few Spanish `vocabItems` for a user.
- Co-located `*.test.ts` for `familiarity`, each mode, `promptBuilder`, `vocabSource`.

---

## Task 1: Shared types + familiarity bucketing

**Files:**
- Create: `server/src/lib/voice/types.ts`
- Create: `server/src/lib/voice/familiarity.ts`
- Test: `server/src/lib/voice/familiarity.test.ts`

**Interfaces:**
- Consumes: `VoiceMode` from `../../db/models/conversationSession.model`.
- Produces: `VocabItem`, `FamiliarityBucket`, `SessionVocab`, `VoiceModeDefinition`, `ModeInstructionInput`, `ModeRubricInput`, `bucketFor`.

- [ ] **Step 1: Write the types**

Create `server/src/lib/voice/types.ts`:

```ts
import { VoiceMode } from '../../db/models/conversationSession.model';

export type FamiliarityBucket = 'new' | 'learning' | 'known';

// The seam object VocabSource returns (NOT the Sequelize instance).
export interface VocabItem {
  id: string;
  sourceText: string; // English the learner typed
  term: string; // target-language phrase — the learning object
  itemType: 'word' | 'phrase';
  partOfSpeech?: string | null;
  familiarity: number; // 0-5
}

// A vocab item with its derived bucket, as snapshotted onto the session.
export interface SessionVocabItem extends VocabItem {
  bucket: FamiliarityBucket;
}

export interface ModeInstructionInput {
  targetLanguage: string;
  vocab: SessionVocabItem[];
  speech: { slower: boolean };
}

export interface ModeRubricInput {
  targetLanguage: string;
  vocab: SessionVocabItem[];
}

export interface VoiceModeDefinition {
  mode: VoiceMode;
  buildTutorInstructions(input: ModeInstructionInput): string;
  buildEvaluationRubric(input: ModeRubricInput): string;
  expectedObservationTypes: Array<'describe_to_name' | 'name_to_define' | 'contextual_use'>;
}
```

- [ ] **Step 2: Write the failing familiarity test**

Create `server/src/lib/voice/familiarity.test.ts`:

```ts
import { assert } from 'chai';
import { bucketFor } from './familiarity';

describe('Voice familiarity', function () {
  it('buckets 0-1 as new', function () {
    assert.equal(bucketFor(0), 'new');
    assert.equal(bucketFor(1), 'new');
  });

  it('buckets 2-3 as learning', function () {
    assert.equal(bucketFor(2), 'learning');
    assert.equal(bucketFor(3), 'learning');
  });

  it('buckets 4-5 as known', function () {
    assert.equal(bucketFor(4), 'known');
    assert.equal(bucketFor(5), 'known');
  });

  it('clamps out-of-range values', function () {
    assert.equal(bucketFor(-1), 'new');
    assert.equal(bucketFor(99), 'known');
  });
});
```

- [ ] **Step 3: Run it, verify it fails**

Run: `make test-server`
Expected: FAIL — `bucketFor` not found.

- [ ] **Step 4: Implement**

Create `server/src/lib/voice/familiarity.ts`:

```ts
import { FamiliarityBucket } from './types';

export function bucketFor(familiarity: number): FamiliarityBucket {
  if (familiarity <= 1) return 'new';
  if (familiarity <= 3) return 'learning';
  return 'known';
}
```

- [ ] **Step 5: Verify green + build + lint**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/voice/types.ts server/src/lib/voice/familiarity.ts server/src/lib/voice/familiarity.test.ts
git commit -m "feat(voice): shared voice types + familiarity bucketing"
```

---

## Task 2: Mode definitions (quiz + weave) + registry

**Files:**
- Create: `server/src/lib/voice/modes/quiz.mode.ts`
- Create: `server/src/lib/voice/modes/weave.mode.ts`
- Create: `server/src/lib/voice/modes/index.ts`
- Test: `server/src/lib/voice/modes/modes.test.ts`

**Interfaces:**
- Consumes: `VoiceModeDefinition`, `ModeInstructionInput`, `ModeRubricInput`, `SessionVocabItem` from `../types`.
- Produces: `getModeDefinition(mode: VoiceMode): VoiceModeDefinition`; `quizMode`, `weaveMode`.

Note on prompt text: the strings below are a solid first draft. They are covered by behavioral tests (they must mention the target words and the right per-bucket behavior), not exact-string tests, so they can be tuned later without breaking tests.

- [ ] **Step 1: Write the failing modes test**

Create `server/src/lib/voice/modes/modes.test.ts`:

```ts
import { assert } from 'chai';
import { getModeDefinition, quizMode, weaveMode } from './index';
import { SessionVocabItem } from '../types';

const vocab: SessionVocabItem[] = [
  { id: '1', sourceText: 'the dog', term: 'el perro', itemType: 'word', familiarity: 0, bucket: 'new' },
  { id: '2', sourceText: 'to run', term: 'correr', itemType: 'word', familiarity: 3, bucket: 'learning' },
  { id: '3', sourceText: "where is the bathroom?", term: '¿dónde está el baño?', itemType: 'phrase', familiarity: 5, bucket: 'known' },
];

describe('Voice modes', function () {
  describe('getModeDefinition', function () {
    it('returns the quiz definition', function () {
      assert.equal(getModeDefinition('quiz').mode, 'quiz');
    });
    it('returns the weave definition', function () {
      assert.equal(getModeDefinition('weave').mode, 'weave');
    });
    it('throws on unknown mode', function () {
      assert.throws(() => getModeDefinition('nope' as 'quiz'));
    });
  });

  describe('quiz tutor instructions', function () {
    const text = quizMode.buildTutorInstructions({ targetLanguage: 'es', vocab, speech: { slower: false } });
    it('includes every target term', function () {
      vocab.forEach((v) => assert.include(text, v.term));
    });
    it('describes per-bucket behavior', function () {
      assert.match(text, /new/i);
      assert.match(text, /known/i);
    });
  });

  describe('quiz evaluation rubric', function () {
    const rubric = quizMode.buildEvaluationRubric({ targetLanguage: 'es', vocab });
    it('lists the outcome vocabulary the evaluator must use', function () {
      ['mastered', 'understood', 'partially_understood', 'missed', 'not_observed'].forEach((o) =>
        assert.include(rubric, o),
      );
    });
  });

  describe('weave tutor instructions', function () {
    it('asks for natural conversation and includes the terms', function () {
      const text = weaveMode.buildTutorInstructions({ targetLanguage: 'es', vocab, speech: { slower: true } });
      assert.match(text, /conversation/i);
      vocab.forEach((v) => assert.include(text, v.term));
    });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `make test-server`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the quiz mode**

Create `server/src/lib/voice/modes/quiz.mode.ts`:

```ts
import { ModeInstructionInput, ModeRubricInput, SessionVocabItem, VoiceModeDefinition } from '../types';

function renderWordList(vocab: SessionVocabItem[]): string {
  return vocab
    .map((v) => `- "${v.term}" (${v.sourceText}) [${v.itemType}, level: ${v.bucket}]`)
    .join('\n');
}

export const quizMode: VoiceModeDefinition = {
  mode: 'quiz',
  expectedObservationTypes: ['describe_to_name', 'name_to_define'],

  buildTutorInstructions({ vocab, speech }: ModeInstructionInput): string {
    return [
      'You are a warm, patient Spanish tutor running a short vocabulary quiz. Speak in Spanish.',
      'Quiz the learner on the words below, ONE at a time, and adapt to each word’s level:',
      '- level "new": do not quiz cold. Introduce the word, say it clearly, give a simple example, then ask a gentle recognition question (describe it in Spanish and let them name it).',
      '- level "learning": quiz them. Vary between describing the word in Spanish for them to name, and saying the word for them to define or use in a sentence.',
      '- level "known": challenge them. Say the word and ask them to define it or use it in a Spanish sentence.',
      'Give brief, encouraging feedback after each answer. Keep it conversational, not a rigid drill.',
      speech.slower ? 'Speak slowly and clearly, pausing between phrases.' : '',
      '',
      'Words for this session:',
      renderWordList(vocab),
    ]
      .filter(Boolean)
      .join('\n');
  },

  buildEvaluationRubric({ vocab }: ModeRubricInput): string {
    return [
      'You are grading a Spanish vocabulary quiz from its transcript.',
      'For EACH target word, decide one outcome:',
      '- "mastered": answered correctly and confidently at a challenging level.',
      '- "understood": answered correctly.',
      '- "partially_understood": partially correct, hesitant, or needed a hint.',
      '- "missed": asked but wrong or no usable answer.',
      '- "not_observed": the word was never actually tested (e.g., the call ended first).',
      'Base the decision ONLY on the transcript. Cite the transcript turn indexes you used.',
      '',
      'Target words:',
      renderWordList(vocab),
    ].join('\n');
  },
};
```

- [ ] **Step 4: Implement the weave mode**

Create `server/src/lib/voice/modes/weave.mode.ts`:

```ts
import { ModeInstructionInput, ModeRubricInput, SessionVocabItem, VoiceModeDefinition } from '../types';

function renderWordList(vocab: SessionVocabItem[]): string {
  return vocab
    .map((v) => `- "${v.term}" (${v.sourceText}) [${v.itemType}]`)
    .join('\n');
}

export const weaveMode: VoiceModeDefinition = {
  mode: 'weave',
  expectedObservationTypes: ['contextual_use'],

  buildTutorInstructions({ vocab, speech }: ModeInstructionInput): string {
    return [
      'You are a warm, friendly Spanish conversation partner. Speak in Spanish.',
      'Have a natural, flowing conversation with the learner. Work the words below into the conversation naturally — steer topics so they fit — but do NOT quiz mechanically.',
      'As you go, pay attention to whether the learner understands each target word when it comes up.',
      speech.slower ? 'Speak slowly and clearly, pausing between phrases.' : '',
      '',
      'Words to work in:',
      renderWordList(vocab),
    ]
      .filter(Boolean)
      .join('\n');
  },

  buildEvaluationRubric({ vocab }: ModeRubricInput): string {
    return [
      'You are assessing, from a Spanish conversation transcript, whether the learner understood each target word IN CONTEXT.',
      'For EACH target word, decide one outcome:',
      '- "mastered": used or responded to the word fluently and correctly.',
      '- "understood": clearly understood it when it came up.',
      '- "partially_understood": unclear or hesitant understanding.',
      '- "missed": misunderstood it, or responded as if they did not know it.',
      '- "not_observed": the word never came up in the conversation.',
      'Base the decision ONLY on the transcript. Cite the transcript turn indexes you used.',
      '',
      'Target words:',
      renderWordList(vocab),
    ].join('\n');
  },
};
```

- [ ] **Step 5: Implement the registry**

Create `server/src/lib/voice/modes/index.ts`:

```ts
import { VoiceMode } from '../../../db/models/conversationSession.model';
import { VoiceModeDefinition } from '../types';
import { quizMode } from './quiz.mode';
import { weaveMode } from './weave.mode';

const REGISTRY: Record<string, VoiceModeDefinition> = {
  quiz: quizMode,
  weave: weaveMode,
};

export { quizMode, weaveMode };

export function getModeDefinition(mode: VoiceMode): VoiceModeDefinition {
  const def = REGISTRY[mode];
  if (!def) throw new Error(`Unknown voice mode: ${mode}`);
  return def;
}
```

- [ ] **Step 6: Verify green + build + lint**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/lib/voice/modes
git commit -m "feat(voice): quiz + weave mode definitions (tutor instructions + eval rubric)"
```

---

## Task 3: Prompt builder

**Files:**
- Create: `server/src/lib/voice/prompt/promptBuilder.ts`
- Test: `server/src/lib/voice/prompt/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `getModeDefinition` (Task 2), `bucketFor` (Task 1), `VocabItem` / `SessionVocabItem` (types).
- Produces: `buildTutorPrompt(input): { prompt: string; firstMessage: string; promptVersion: string; sessionVocab: SessionVocabItem[] }`, `PROMPT_VERSION`.

The builder computes each word's `bucket` (via `bucketFor`), assembles core rules + language policy + speech style + the mode's tutor instructions, and returns the full prompt plus the derived `sessionVocab` (for snapshotting in PR 4) and a `promptVersion`.

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/voice/prompt/promptBuilder.test.ts`:

```ts
import { assert } from 'chai';
import { buildTutorPrompt, PROMPT_VERSION } from './promptBuilder';
import { VocabItem } from '../types';

const vocab: VocabItem[] = [
  { id: '1', sourceText: 'the dog', term: 'el perro', itemType: 'word', familiarity: 0 },
  { id: '2', sourceText: 'to run', term: 'correr', itemType: 'word', familiarity: 5 },
];

describe('buildTutorPrompt', function () {
  it('assembles a prompt containing the mode instructions and every term', function () {
    const { prompt } = buildTutorPrompt({ mode: 'quiz', targetLanguage: 'es', vocab, speech: { slower: false } });
    assert.match(prompt, /Spanish/i);
    vocab.forEach((v) => assert.include(prompt, v.term));
  });

  it('derives and exposes buckets on sessionVocab', function () {
    const { sessionVocab } = buildTutorPrompt({ mode: 'quiz', targetLanguage: 'es', vocab, speech: { slower: false } });
    assert.equal(sessionVocab.find((v) => v.id === '1')?.bucket, 'new');
    assert.equal(sessionVocab.find((v) => v.id === '2')?.bucket, 'known');
  });

  it('adds a slower-speech instruction when requested', function () {
    const withSlow = buildTutorPrompt({ mode: 'weave', targetLanguage: 'es', vocab, speech: { slower: true } }).prompt;
    const without = buildTutorPrompt({ mode: 'weave', targetLanguage: 'es', vocab, speech: { slower: false } }).prompt;
    assert.match(withSlow, /slowly/i);
    assert.notMatch(without, /slowly/i);
  });

  it('stamps a prompt version', function () {
    const { promptVersion } = buildTutorPrompt({ mode: 'quiz', targetLanguage: 'es', vocab, speech: { slower: false } });
    assert.equal(promptVersion, PROMPT_VERSION);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `make test-server`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/lib/voice/prompt/promptBuilder.ts`:

```ts
import { VoiceMode } from '../../../db/models/conversationSession.model';
import { bucketFor } from '../familiarity';
import { getModeDefinition } from '../modes';
import { SessionVocabItem, VocabItem } from '../types';

export const PROMPT_VERSION = 'voice-prompt-v1';

interface BuildTutorPromptInput {
  mode: VoiceMode;
  targetLanguage: string;
  vocab: VocabItem[];
  speech: { slower: boolean };
}

interface BuildTutorPromptResult {
  prompt: string;
  firstMessage: string;
  promptVersion: string;
  sessionVocab: SessionVocabItem[];
}

function coreRules(): string {
  return [
    'You are a friendly, encouraging language tutor in a live spoken conversation.',
    'Keep turns short and natural. Never break character or mention that you are an AI.',
  ].join('\n');
}

function languagePolicy(targetLanguage: string): string {
  if (targetLanguage === 'es') {
    return 'Speak in Spanish. Keep vocabulary and grammar appropriate for a learner; simplify if they struggle.';
  }
  return `Speak in the target language (${targetLanguage}). Simplify if the learner struggles.`;
}

export function buildTutorPrompt(input: BuildTutorPromptInput): BuildTutorPromptResult {
  const sessionVocab: SessionVocabItem[] = input.vocab.map((v) => ({
    ...v,
    bucket: bucketFor(v.familiarity),
  }));

  const mode = getModeDefinition(input.mode);
  const modeInstructions = mode.buildTutorInstructions({
    targetLanguage: input.targetLanguage,
    vocab: sessionVocab,
    speech: input.speech,
  });

  const prompt = [coreRules(), languagePolicy(input.targetLanguage), '', modeInstructions].join('\n');

  const firstMessage =
    input.targetLanguage === 'es' ? '¡Hola! ¿Listo para practicar?' : 'Hi! Ready to practice?';

  return { prompt, firstMessage, promptVersion: PROMPT_VERSION, sessionVocab };
}
```

- [ ] **Step 4: Verify green + build + lint**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/voice/prompt
git commit -m "feat(voice): tutor prompt builder (core + language + mode + vocab)"
```

---

## Task 4: DB-backed VocabSource

**Files:**
- Create: `server/src/lib/voice/vocab/vocabSource.ts`
- Test: `server/src/lib/voice/vocab/vocabSource.test.ts`

**Interfaces:**
- Consumes: `VocabItem` model from `../../../db/models/vocabItem.model`; `VocabItem` seam type from `../types`.
- Produces: `getSessionVocab(input: { userId: string; targetLanguage: string }): Promise<VocabItem[]>`, `SESSION_WORD_COUNT`.

Selection policy (v1, simple + reproducible): among the learner's rows for that language, prefer words that are **due or never seen**, then **lower familiarity**, then **least recently seen**; take up to `SESSION_WORD_COUNT`. Return the seam `VocabItem` shape (not Sequelize instances). `bucket` is NOT added here — the prompt builder derives it.

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/voice/vocab/vocabSource.test.ts`:

```ts
import { assert } from 'chai';
import { getSessionVocab, SESSION_WORD_COUNT } from './vocabSource';
import { createUser, createVocabItem } from '../../../test/testDataGenerator';

describe('getSessionVocab', function () {
  it('returns only the given user’s items for the language', async function () {
    const user = await createUser();
    const other = await createUser();
    await createVocabItem({ userId: user.id, term: 'perro', targetLanguageCode: 'es' });
    await createVocabItem({ userId: other.id, term: 'gato', targetLanguageCode: 'es' });

    const result = await getSessionVocab({ userId: user.id, targetLanguage: 'es' });
    assert.equal(result.length, 1);
    assert.equal(result[0].term, 'perro');
  });

  it('caps the session at SESSION_WORD_COUNT', async function () {
    const user = await createUser();
    for (let i = 0; i < SESSION_WORD_COUNT + 3; i++) {
      await createVocabItem({ userId: user.id, term: `palabra-${i}`, targetLanguageCode: 'es' });
    }
    const result = await getSessionVocab({ userId: user.id, targetLanguage: 'es' });
    assert.equal(result.length, SESSION_WORD_COUNT);
  });

  it('returns the seam shape with familiarity', async function () {
    const user = await createUser();
    await createVocabItem({ userId: user.id, term: 'correr', sourceText: 'to run', targetLanguageCode: 'es' });
    const [item] = await getSessionVocab({ userId: user.id, targetLanguage: 'es' });
    assert.hasAllKeys(item, ['id', 'sourceText', 'term', 'itemType', 'partOfSpeech', 'familiarity']);
    assert.isNumber(item.familiarity);
  });
});
```

(Confirm `createVocabItem` accepts `userId`, `term`, `sourceText`, `targetLanguageCode` overrides — it does per PR 2. If a required field like `sourceText`/`itemType` has no default in the factory, pass it in the test.)

- [ ] **Step 2: Run it, verify it fails**

Run: `make test-server`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/lib/voice/vocab/vocabSource.ts`:

```ts
import VocabItemModel from '../../../db/models/vocabItem.model';
import { VocabItem } from '../types';

export const SESSION_WORD_COUNT = 6;

export async function getSessionVocab(input: {
  userId: string;
  targetLanguage: string;
}): Promise<VocabItem[]> {
  const rows = await VocabItemModel.findAll({
    where: { userId: input.userId, targetLanguageCode: input.targetLanguage },
    order: [
      ['nextDueAt', 'ASC NULLS FIRST'],
      ['familiarity', 'ASC'],
      ['lastSeenAt', 'ASC NULLS FIRST'],
    ],
    limit: SESSION_WORD_COUNT,
  });

  return rows.map((r) => ({
    id: r.id,
    sourceText: r.sourceText,
    term: r.term,
    itemType: r.itemType,
    partOfSpeech: r.partOfSpeech ?? null,
    familiarity: r.familiarity,
  }));
}
```

If Sequelize rejects the literal `'ASC NULLS FIRST'` string ordering, replace those order entries with a `sequelize.literal('"nextDueAt" ASC NULLS FIRST')` / `'"lastSeenAt" ASC NULLS FIRST'` import from the model's `sequelize`. Adjust and re-run the tests.

- [ ] **Step 4: Verify green + build + lint**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/voice/vocab
git commit -m "feat(voice): DB-backed VocabSource session selection"
```

---

## Task 5: Voice lib barrel + dev seed script

**Files:**
- Create: `server/src/lib/voice/index.ts`
- Create: `server/src/scripts/seedVocab.ts`

**Interfaces:**
- Consumes: everything above; `VocabItem` model; `User` model.
- Produces: `lib/voice` named exports; a runnable dev seed.

- [ ] **Step 1: Write the barrel**

Create `server/src/lib/voice/index.ts`:

```ts
export * from './types';
export { bucketFor } from './familiarity';
export { getModeDefinition, quizMode, weaveMode } from './modes';
export { buildTutorPrompt, PROMPT_VERSION } from './prompt/promptBuilder';
export { getSessionVocab, SESSION_WORD_COUNT } from './vocab/vocabSource';
```

- [ ] **Step 2: Write the dev seed script**

Create `server/src/scripts/seedVocab.ts`. It seeds a handful of Spanish items for the user whose email is passed as an argument (dev use only), idempotently. This lets us exercise the voice loop in PR 4-6 before the authoring UI (PR 7) exists.

```ts
import User from '../db/models/user.model';
import VocabItem from '../db/models/vocabItem.model';

const SEED: Array<{ sourceText: string; term: string; itemType: 'word' | 'phrase' }> = [
  { sourceText: 'the dog', term: 'el perro', itemType: 'word' },
  { sourceText: 'to run', term: 'correr', itemType: 'word' },
  { sourceText: 'the house', term: 'la casa', itemType: 'word' },
  { sourceText: 'to eat', term: 'comer', itemType: 'word' },
  { sourceText: 'where is the bathroom?', term: '¿dónde está el baño?', itemType: 'phrase' },
  { sourceText: 'good morning', term: 'buenos días', itemType: 'phrase' },
];

function normalize(term: string): string {
  return term.trim().toLowerCase();
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node dist/scripts/seedVocab.js <userEmail>');
    process.exit(1);
  }
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  for (const s of SEED) {
    await VocabItem.findOrCreate({
      where: { userId: user.id, targetLanguageCode: 'es', termNormalized: normalize(s.term) },
      defaults: {
        userId: user.id,
        targetLanguageCode: 'es',
        sourceText: s.sourceText,
        term: s.term,
        termNormalized: normalize(s.term),
        itemType: s.itemType,
        translationSource: 'ai',
      },
    });
  }
  console.log(`Seeded ${SEED.length} Spanish vocab items for ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Build + lint + test**

Run: `make build-server && make lint-server && make test-server`
Expected: PASS (no test regressions; the barrel and script compile).

- [ ] **Step 4: Smoke-test the seed (optional, manual)**

With the stack up (`make launch-detached`) and a known dev user email, run the compiled script inside the server container (see other `dist/scripts/*` invocations for the exact `docker compose exec` form). Expected: "Seeded 6 Spanish vocab items…", and `getSessionVocab` returns them. Then `make terminate`.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/voice/index.ts server/src/scripts/seedVocab.ts
git commit -m "feat(voice): lib barrel + dev vocab seed script"
```

---

## Definition of Done (PR 3)

- [ ] `bucketFor` + shared voice types.
- [ ] `quiz` + `weave` mode definitions, each emitting tutor instructions **and** eval rubric, behind `getModeDefinition`.
- [ ] `buildTutorPrompt` assembles core + language + speech + mode + vocab and derives buckets; stamps `PROMPT_VERSION`.
- [ ] `getSessionVocab` selects a per-user session set (capped, ordered), returns the seam shape.
- [ ] `lib/voice` barrel + dev seed script.
- [ ] `make build-server && make lint-server && make test-server` green; `make prettier-all` run.

## Self-Review Notes

- Spec coverage: implements §4 (mode module emits both instruction + rubric), §5 (server-owned prompt assembly), §6 (VocabSource reads the learner's rows, bucket derived not stored). The ElevenLabs override *wrapping* and `session.instructions` rendering are intentionally deferred to PR 4 (provider) — this PR produces the provider-agnostic prompt string.
- Type consistency: `SessionVocabItem` (with `bucket`) is produced by `buildTutorPrompt` and consumed by the mode `build*` methods; `VocabItem` (no bucket) is what `VocabSource` returns and what `buildTutorPrompt` accepts. Names match across tasks.
- Prompt strings are behavior-tested (contains terms / per-bucket language / slower flag), not exact-string-tested, so they can be tuned during voice testing without breaking the suite.
- Carry-in from PR 2: user-authored vocab text is `TEXT`; validated length bounds belong to the PR 7 create/translate endpoint, not here.
