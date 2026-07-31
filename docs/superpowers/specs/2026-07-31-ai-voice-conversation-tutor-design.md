# AI Voice Conversation Tutor — Design

**Date:** 2026-07-31
**Branch:** `briankeane/ai-voice-conversation-tutor`
**Status:** Approved design (v2 — two modes + per-word evaluation), pending implementation plan

## 1. Goal

Let a learner have a real-time **spoken** conversation with an AI voice tutor in
the target language (**Spanish** for v1), then get a **per-word report** on how
they did. Two modes:

- **quiz** — the tutor quizzes the learner on a set of vocabulary words directly.
  Per word, it uses one of two question styles, chosen by how well the learner
  already knows that word:
  - *describe→name* — the tutor describes a word in Spanish; the learner names it.
  - *name→define* — the tutor says the word; the learner defines/uses it in Spanish.
- **weave** — the tutor holds a natural conversation that works the words in,
  while judging whether the learner understood each word in context.

The `mode` value is an **extensible enum** — more modes can be added later.

Priority is a natural voice with low-latency conversational feel in the target
language. A secondary nice-to-have is asking the voice to speak slower.

The first voice provider is **ElevenLabs Conversational AI** (best voice quality
per provider research), built behind a **pluggable provider abstraction** so
OpenAI Realtime and Google Gemini Live can be added later. Per-word scoring is
**provider-agnostic** (server-side), so it is identical across future providers.

## 2. Scope

### In scope (v1)

- Web client only (React 18 + Vite), designed so a future React Native client
  reuses the same server seam.
- ElevenLabs Conversational AI provider, end to end.
- Both `quiz` and `weave` modes, sharing a common mode-definition module.
- Familiarity-driven question-style selection in `quiz` mode.
- "Speak slower" support.
- **Server-side per-word evaluation** (an `Evaluator` seam) run **asynchronously
  via the existing BullMQ worker** after the call, producing a structured report.
  This adds one new server dependency: an **Anthropic Claude** client.
- A **report endpoint** the client polls, plus the report UI.
- Cost/abuse controls in §11 (voice minutes **and** evaluation LLM calls).

### Out of scope (deliberately deferred)

- **No mobile/React Native implementation** this build (portable design only).
- **No vocab data model and no per-user mastery loop.** Vocabulary enters through
  a stubbed `VocabSource` returning a static Spanish list; each item carries a
  static `familiarity` 0–5. Real per-user vocabulary and updating mastery from
  results are later projects and must not change the prompt/session/evaluation
  code.
- **No OpenAI Realtime / Gemini adapters** yet (interfaces must accommodate them).
- **No realtime server-side transcript** ingestion, no WebSocket/SSE.
- **No per-word relational table** — the report is stored as JSONB on the session.
- Live in-call structured feedback (the tutor still gives natural *spoken*
  feedback; structured scoring is post-call only).
- Subscription quotas, monthly minute budgets, admin kill-switch, per-word
  learning analytics.

## 3. Architecture: two thin seams, no audio proxy

The heavy real-time audio connection runs **browser ↔ ElevenLabs directly** via
the `@elevenlabs/react` SDK over WebRTC. Our server never proxies audio, so there
is no WebSocket/SSE infrastructure to build.

### Server seam — `VoiceSessionProvider`

```ts
interface VoiceSessionProvider {
  createSession(intent: VoiceSessionIntent): Promise<VoiceSessionStart>;
}

interface VoiceSessionIntent {
  userId: string;
  mode: VoiceMode;
  targetLanguage: 'es';
  vocab: VocabItem[];        // resolved server-side from VocabSource, incl. familiarity
  speech: { slower: boolean };
}

interface VoiceSessionStart {
  provider: 'elevenlabs';
  conversationToken: string;         // short-lived, provider-minted (WebRTC token)
  providerConversationId: string;
  clientInit: Record<string, unknown>; // provider-specific init (assembled prompt override, first message)
}
```

For ElevenLabs, `createSession` requests a **WebRTC conversation token** from
`POST /v1/convai/conversation/token` (not the signed WebSocket URL).

### Client seam — `VoiceSession`

Common surface is session lifecycle only. We deliberately do **not** standardize
`onAudio`, interruption semantics, turn detection, or transcript streaming across
providers.

```ts
interface VoiceSession {
  start(start: VoiceSessionStart): Promise<{ providerConversationId: string }>;
  end(): Promise<void>;
  setMuted(muted: boolean): void;
  sendContext(text: string): void;
  onStatus(cb: (s: 'connecting' | 'connected' | 'ended' | 'error') => void): void;
  onMessage(cb: (m: VoiceMessage) => void): void;
}
```

## 4. Modes: one shared module drives prompt *and* evaluation

The same mode definition must produce both the tutor's instructions and the
evaluator's rubric, so "what the tutor does" and "what counts as success" cannot
drift apart. Each mode lives in one module:

```
server/src/lib/voice/modes/
  index.ts          // registry: VoiceMode -> VoiceModeDefinition
  quiz.mode.ts
  weave.mode.ts
```

```ts
type VoiceMode = 'quiz' | 'weave' | (string & {}); // extensible

interface VoiceModeDefinition {
  mode: VoiceMode;
  buildTutorInstructions(input: ModeInstructionInput): string; // → PromptSpec fragment
  buildEvaluationRubric(input: ModeRubricInput): string;       // → Evaluator prompt fragment
  expectedObservationTypes: Array<'describe_to_name' | 'name_to_define' | 'contextual_use'>;
}
```

The mode module owns: familiarity-bucket rules, quiz-style selection, what counts
as success vs partial credit, and whether `not_observed` is acceptable. Provider
adapters only format mode output into provider session config; the evaluator only
applies the rubric to a transcript. **The client is never aware of these rules.**

### Familiarity buckets (used by both prompt and evaluation)

`familiarity` is an integer 0–5, bucketed:

- **0–1 → `new`** — don't quiz cold; introduce/teach; use the easier recognition
  style (`describe_to_name`).
- **2–3 → `learning`** — quiz; mix both styles.
- **4–5 → `known`** — harder style (`name_to_define` in Spanish); confidence check.

## 5. Prompt system

Client sends **intent, never prompt text**. The **server owns the whole prompt**:
a shared `PromptSpec` assembled from core rules + the active mode's tutor
instructions + language policy + vocab injection (with buckets) + speech style.
Per-provider adapters render that one spec.

```
PromptSpec = coreRules
           + modeDefinition.buildTutorInstructions({ vocab, buckets, speech })
           + languagePolicy(targetLanguage)
           + speechStyle({ slower })
```

### ElevenLabs prompt strategy: full override (decision)

The ElevenLabs agent is a near-empty shell; at conversation start the client
passes our fully-assembled prompt via `overrides.agent.prompt` (plus first
message, language). **Single source of truth is the server code.** Consequences:
prompt overrides must be explicitly enabled on the agent (a one-time IaC setting),
and the assembled prompt travels through the browser to ElevenLabs (visible in
devtools — acceptable for a tutor prompt).

## 6. Vocabulary: the prompt-injection contract

No vocab schema in v1. Vocabulary enters through one seam:

```ts
interface VocabItem {
  id: string;
  term: string;
  translation?: string;
  partOfSpeech?: string;
  familiarity: number; // 0-5, static in v1
}

interface VocabSource {
  getSessionVocab(input: { userId: string; targetLanguage: 'es' }): Promise<VocabItem[]>;
}
```

**v1 implementation:** a static Spanish list (a const/JSON in the repo). Later
swapped for real per-user data with no change to prompt, session, or evaluation
code. The words chosen (with `familiarity` and computed `bucket`) are snapshotted
onto `ConversationSession.vocabSnapshot`.

## 7. Evaluation: server-side, async, provider-agnostic

After the call, one LLM pass turns the transcript into a per-word report. It runs
**in the BullMQ worker** (not inline), because it is slow, paid, and retryable.

### The `Evaluator` seam (no provider concepts leak in)

```ts
type FamiliarityBucket = 'new' | 'learning' | 'known';

interface TranscriptTurn {
  speaker: 'agent' | 'user';
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
}

interface EvaluationInput {
  sessionId: string;
  mode: VoiceMode;
  targetLanguage: string;
  vocab: VocabItem[];
  transcript: TranscriptTurn[];
  evaluatorVersion: string;
}

type WordOutcome =
  | 'mastered' | 'understood' | 'partially_understood' | 'missed' | 'not_observed';

interface WordReport {
  vocabItemId: string;
  term: string;
  familiarityAtStart: number;
  bucket: FamiliarityBucket;
  outcome: WordOutcome;
  score: number; // 0-1
  evidence: {
    promptStyle?: 'describe_to_name' | 'name_to_define' | 'contextual_use';
    agentPrompt?: string;
    userResponse?: string;
    transcriptTurnIndexes: number[];
  };
  feedback: { userFacing: string; nextPracticeHint?: string };
}

interface SessionReportSummary {
  totalWords: number;
  masteredCount: number;
  understoodCount: number;
  partialCount: number;
  missedCount: number;
  notObservedCount: number;
  overallScore: number; // 0-1
}

interface EvaluationResult { words: WordReport[]; summary: SessionReportSummary }

interface Evaluator { evaluate(input: EvaluationInput): Promise<EvaluationResult> }
```

`not_observed` is **mandatory**: in `weave` some words may never come up, and any
call can end early. Pretending every word was tested would corrupt future mastery
tracking.

**v1 implementation:** `AnthropicEvaluator` — a single non-streaming Claude call
whose prompt embeds the mode's `buildEvaluationRubric(...)`, the vocab snapshot,
and the normalized transcript, and which must return JSON matching
`EvaluationResult`. The worker **validates the JSON against a runtime schema**
before persisting.

### Async execution (BullMQ)

```
Webhook handler:
  verify HMAC → find ConversationSession by providerConversationId
  persist raw provider payload + normalized transcript, set webhookReceivedAt
  compute transcriptHash; set evaluationStatus = 'pending'
  enqueue jobId = voice-eval:{sessionId}:{evaluatorVersion}:{transcriptHash}
  if enqueue fails AFTER the DB write → return non-200 so ElevenLabs retries
  else return 200

Worker (attempts: 3, exponential backoff):
  load session; if already 'ready' for same evaluatorVersion+transcriptHash → no-op
  run Evaluator; validate JSON
  write scoring + summary; set evaluationStatus = 'ready', evaluationCompletedAt
  on final failure → evaluationStatus = 'failed' + redacted evaluationErrorCode/Message
```

Idempotency key is `sessionId + evaluatorVersion + transcriptHash`, which makes
duplicate webhooks and duplicate jobs safe. A sweeper for sessions stuck in
`waiting_transcript`/`pending` is a later cron/admin script.

## 8. Report delivery (polling, no sockets)

```
GET /v1/voice/sessions/:id/report   (JWT auth, owner only)
```

```ts
type ReportStatus = 'waiting_transcript' | 'pending' | 'ready' | 'failed' | 'expired';

interface ReportResponse {
  status: ReportStatus;
  words?: WordReport[];
  summary?: SessionReportSummary;
  errorCode?: 'WEBHOOK_TIMEOUT' | 'EVALUATION_FAILED' | 'CALL_NOT_COMPLETED';
  retryAfterMs?: number;
}
```

Client polling schedule: **1s, 2s, 3s, 5s, then every 10s; stop after ~2 min**
and show "still processing." If the call ended client-side but the webhook has not
arrived, the endpoint returns `waiting_transcript`. After the timeout the session
is marked `expired` internally, but a **late webhook can still evaluate and flip
it to `ready`**.

## 9. End-to-end flow

```
1.  Client POST /v1/voice/sessions { mode, targetLanguage, speech.slower }  (JWT)
2.  Server: auth → rate-limit → enforce one-active-session-per-user
3.  Server: VocabSource.getSessionVocab → familiarity 0-5 per word
4.  Server: bucket words (new/learning/known)
5.  Server: build PromptSpec via the mode definition → render ElevenLabs override
6.  Server: create ConversationSession(status=active, evaluationStatus=not_started, vocabSnapshot)
7.  Server: POST ElevenLabs /v1/convai/conversation/token; store providerConversationId
8.  Server: return VoiceSessionStart
9.  Client: @elevenlabs/react connects directly (WebRTC); user converses
10. Client: ends call, notifies server best-effort → clientEndedAt, evaluationStatus=waiting_transcript
11. ElevenLabs post-call webhook → POST /v1/webhooks/elevenlabs
12. Server: HMAC-verify → store raw + normalized transcript → evaluationStatus=pending → enqueue job
13. Worker: idempotent check → Evaluator (Anthropic) → validate JSON → write scoring → evaluationStatus=ready
14. Client: polls GET /v1/voice/sessions/:id/report until ready/failed/expired → shows per-word report
```

## 10. Infrastructure-as-code (ElevenLabs)

App deploys must **not** mutate third-party product config. Agent provisioning is
an explicit, separate step.

- Commit `server/config/voice/elevenlabs-agent.json` — the agent definition
  (prompt-override enabled, allowed overrides, language, post-call webhook + HMAC).
- `server/scripts/sync-elevenlabs-agent.ts` — run in CI or manually: `PATCH` the
  agent if `ELEVENLABS_CONVAI_AGENT_ID` is set, else `POST` create and print the
  new id to store as an env var.
- Only ever-manual dashboard step is initial account + API key creation.

### Env vars (via `server/src/config/envVars.ts` + `Config`, Render env group)

| Var | Kind | Notes |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | secret | never sent to client |
| `ELEVENLABS_CONVAI_AGENT_ID` | config, per env | from the sync script |
| `ELEVENLABS_WEBHOOK_SECRET` | secret | HMAC verification |
| `VOICE_PROVIDER` | config | `elevenlabs` for v1 |
| `VOICE_MAX_SESSION_SECONDS` | config | server-enforced cap (e.g. 300) |
| `ANTHROPIC_API_KEY` | secret | evaluation LLM |
| `EVALUATOR_MODEL` | config | e.g. a current Claude model id |
| `VOICE_MAX_EVALUATIONS_PER_DAY` | config | per-user evaluation cost cap |
| `REDIS_URL` | config | already present; **required** for the eval queue/worker |

Providers/evaluator read keys from `Config`, never `process.env` directly.

### Deployment / infra (new — Redis is not yet provisioned)

The repo's BullMQ code is Redis-*optional* (`server/src/queue/index.ts` returns
`null` and logs "Skipping Redis setup" when `REDIS_URL` is unset), and the current
`render.yaml` provisions **only** Postgres + web + worker — **there is no Redis
instance**, so the deployed worker is a no-op today. This feature requires it, so
the blueprint work is:

1. Add a **`type: keyvalue`** service to `render.yaml` (e.g. `lengua-kv`, ohio),
   with **`maxmemoryPolicy: noeviction`** (BullMQ requires no eviction).
2. Wire `REDIS_URL` into the `web` and `worker` services via
   `fromService: { name: lengua-kv, type: keyvalue, property: connectionString }`
   (or the `lengua-production` env group).
3. Local dev: uncomment the Redis service in `docker-compose.yaml` and set
   `REDIS_URL=redis://redis:6379`.
4. Code: ensure the ioredis connection uses `maxRetriesPerRequest: null` (BullMQ
   requirement) in `server/src/queue/index.ts`.

## 11. Data model (one table)

**`ConversationSession`** — core + evaluation fields:

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | pk |
| userId | uuid | fk → users |
| provider | string | `elevenlabs` |
| providerConversationId | string, unique, nullable | set once minted |
| mode | enum | `quiz` \| `weave` (extensible; model-enum pattern) |
| targetLanguageCode | string | `es` |
| status | enum | `active` \| `completed` \| `failed` \| `expired` |
| vocabSnapshot | JSONB | `{ id, term, translation?, partOfSpeech?, familiarity, bucket }[]` |
| promptVersion | string | prompt build id |
| providerConfigSnapshot | JSONB | agent/config used |
| evaluationStatus | enum | `not_started` \| `waiting_transcript` \| `pending` \| `ready` \| `failed` \| `expired` |
| rawProviderTranscript | JSONB, nullable | as received from provider |
| normalizedTranscript | JSONB, nullable | `TranscriptTurn[]` |
| scoring | JSONB, nullable | `EvaluationResult` |
| evaluatorProvider | string, nullable | `anthropic` |
| evaluatorModel | string, nullable | |
| evaluatorVersion | string, nullable | rubric/prompt version |
| transcriptHash | string, nullable | idempotency |
| evaluationAttemptCount | int, default 0 | |
| evaluationErrorCode | string, nullable | redacted |
| evaluationErrorMessage | string, nullable | short, redacted |
| webhookReceivedAt | Date, nullable | |
| clientEndedAt | Date, nullable | |
| evaluationStartedAt / evaluationCompletedAt | Date, nullable | |
| durationSeconds / costCents | int, nullable | |
| startedAt / endedAt | timestamps | |

`mode`, `status`, and `evaluationStatus` follow the project's model-enum pattern
(constants exported from the model file, used for validation). We do **not** store
raw LLM chain-of-thought or large evaluator diagnostics.

## 12. Security & cost controls

**v1 (not optional):**

- JWT-authed mint endpoint; report endpoint is owner-only.
- Per-user mint rate limit; one active voice session per user.
- Server-enforced max session duration (`VOICE_MAX_SESSION_SECONDS`) + client timer.
- Webhook HMAC verification; idempotent across duplicate webhooks **and** duplicate
  BullMQ jobs (idempotency key `sessionId+evaluatorVersion+transcriptHash`).
- **Evaluation cost cap** per user (`VOICE_MAX_EVALUATIONS_PER_DAY`); BullMQ
  `attempts` bounded so retries can't run the LLM unboundedly.
- Malformed evaluator JSON → schema-validate, retry, then `failed` (never persist
  garbage scoring).
- Never return API keys, agent admin config, or provider secrets to the client.

**Later:** subscription quotas, monthly minute budgets, abuse detection, admin
kill-switch, audio-retention controls, per-word analytics, a stuck-session sweeper.

## 13. Testing strategy

- **Server lib** (TDD, one function at a time): mode modules (tutor instructions +
  rubric for each mode/bucket), `VocabSource` static impl + bucketing, prompt
  assembly → override, `ElevenLabsSessionProvider.createSession` (nock token
  endpoint), webhook HMAC verify + normalization + idempotent enqueue,
  `AnthropicEvaluator` (nock Anthropic; happy path + malformed JSON), the worker
  job (idempotent no-op, success, retry→failed).
- **Server API** (Supertest): `POST /v1/voice/sessions` (auth, rate-limit,
  one-active-session, nocked provider), `POST /v1/webhooks/elevenlabs`
  (valid/invalid HMAC, duplicate delivery, missing session), `GET
  /v1/voice/sessions/:id/report` (owner-only; each status; not-found).
- **Client** (Vitest + Testing Library): `VoiceSession` ElevenLabs adapter (SDK
  mocked), the call UI, and the report screen with its polling/backoff and
  waiting/ready/failed/expired states.
- External HTTP mocked with **nock**; SDK/objects with **Sinon**.

## 14. Component diagram

```
React UI
  ├─ VoiceTutorService
  │    └─ ElevenLabsVoiceSessionAdapter ──(WebRTC, @elevenlabs/react)──► ElevenLabs
  └─ apiClient (Bearer JWT)
       ├─ POST /v1/voice/sessions ─► VoiceSessionService
       │      ├─ modes/ (shared mode definition)  ├─ VocabSource (static)
       │      ├─ PromptBuilder (→ override)        ├─ ElevenLabsSessionProvider ─► /v1/convai/conversation/token
       │      └─ ConversationSession (Sequelize)
       └─ GET /v1/voice/sessions/:id/report ─► reads ConversationSession.scoring

ElevenLabs post-call webhook
  └─ POST /v1/webhooks/elevenlabs ─► HMAC verify → store transcript → enqueue BullMQ job

BullMQ worker (server/src/worker.ts)
  └─ voice-eval job ─► Evaluator (AnthropicEvaluator) ─► validate JSON ─► write scoring/summary
```

## 15. Future work / open questions

- OpenAI Realtime and Gemini Live adapters (reuse `PromptSpec` + `Evaluator`).
- Real per-user vocabulary + mastery updates from `WordReport` behind `VocabSource`.
- React Native client reusing the server seam.
- Stuck-session sweeper (cron) for `waiting_transcript`/`pending`.
- Confirm exact ElevenLabs override/token/webhook payload field names and the
  current Anthropic model id against live docs at implementation time.
