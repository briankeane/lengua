# AI Voice Conversation Tutor — Design

**Date:** 2026-07-31
**Branch:** `briankeane/ai-voice-conversation-tutor`
**Status:** Approved design, pending implementation plan

## 1. Goal

Let a learner have a real-time **spoken** conversation with an AI voice tutor. Two
modes:

- **quiz** — the tutor quizzes the learner on a set of vocabulary words.
- **weave** — the tutor works those vocabulary words naturally into a conversation.

Target language for v1 is **Spanish**. Priority is a natural voice with
low-latency conversational feel in the target language. A secondary
nice-to-have is the ability to ask the voice to speak slower.

The first provider is **ElevenLabs Conversational AI** (best voice quality per
the provider research). It is built behind a **pluggable provider abstraction**
so OpenAI Realtime and Google Gemini Live can be added later without reworking
the feature.

## 2. Scope

### In scope (v1)

- Web client only (React 18 + Vite), designed so a future React Native client
  reuses the same server seam.
- ElevenLabs Conversational AI provider, end to end.
- Both `quiz` and `weave` modes (they share everything but a `mode` string).
- "Speak slower" support.
- A single provider abstraction (server + client seams) with ElevenLabs as the
  only concrete adapter.
- Post-call transcript + scoring persistence via webhook.
- Cost/abuse controls listed in §9.

### Out of scope (deliberately deferred)

- **No mobile/React Native implementation** this build (portable design only).
- **No vocab data model.** Vocabulary enters through a stubbed `VocabSource`
  seam backed by a static Spanish word list. Real per-user vocabulary is a later
  project and must not change the prompt or session code.
- **No OpenAI Realtime / Gemini adapters** yet (interfaces must accommodate them).
- **No realtime server-side transcript** ingestion, no WebSocket proxy.
- **No `ConversationTurn` table** — transcript stored as JSONB on the session.
- Subscription quotas, monthly minute budgets, admin kill-switch, per-word
  learning analytics.

## 3. Architecture: two thin seams, no audio proxy

The heavy real-time audio connection runs **browser ↔ ElevenLabs directly** via
the `@elevenlabs/react` SDK over WebRTC. Our server never proxies audio. This
avoids building any WebSocket/SSE infrastructure.

The provider abstraction is two small interfaces:

### Server seam — `VoiceSessionProvider`

```ts
interface VoiceSessionProvider {
  createSession(intent: VoiceSessionIntent): Promise<VoiceSessionStart>;
}

interface VoiceSessionIntent {
  userId: string;
  mode: 'quiz' | 'weave';
  targetLanguage: 'es';
  vocab: VocabItem[];        // resolved server-side from VocabSource
  speech: { slower: boolean };
}

interface VoiceSessionStart {
  provider: 'elevenlabs';
  conversationToken: string;        // short-lived, provider-minted
  providerConversationId: string;
  // Provider-specific init passed straight to the client SDK (e.g. the assembled
  // prompt override + first message). Opaque to the common core.
  clientInit: Record<string, unknown>;
}
```

For ElevenLabs, `createSession` requests a **WebRTC conversation token** from
`POST /v1/convai/conversation/token` (this is the WebRTC path; the signed
WebSocket URL is a different mechanism we are not using).

### Client seam — `VoiceSession`

The honest common surface is session lifecycle only. We do **not** standardize
`onAudio`, interruption semantics, turn detection, or transcript streaming —
ElevenLabs / OpenAI Realtime / Gemini diverge too much there, and forcing a
common shape now is an over-build.

```ts
interface VoiceSession {
  start(start: VoiceSessionStart): Promise<{ providerConversationId: string }>;
  end(): Promise<void>;
  setMuted(muted: boolean): void;
  sendContext(text: string): void;                      // optional mid-call text nudge
  onStatus(cb: (s: 'connecting' | 'connected' | 'ended' | 'error') => void): void;
  onMessage(cb: (m: VoiceMessage) => void): void;       // displayed transcript lines
}
```

## 4. Prompt system

The client sends **intent, never prompt text**. The **server owns the entire
prompt**. A shared `PromptSpec` is assembled from a common core plus mode,
language, vocab, and speech deltas; per-provider adapters render that one spec
into each provider's format.

```
PromptSpec =
    coreRules
  + modeRules[mode]
  + languagePolicy(targetLanguage)
  + vocabInjection(vocab)
  + speechStyle({ slower })
```

```ts
ElevenLabsPromptAdapter.render(spec) // → full prompt string for override
OpenAIRealtimePromptAdapter.render(spec) // → session.instructions (later)
```

### ElevenLabs prompt strategy: full override (decision)

The ElevenLabs agent is a near-empty shell. At each conversation start, the
client passes our fully-assembled prompt via `overrides.agent.prompt` (plus
first message and language). The **single source of truth is the server code**;
each provider adapter appends its own deltas. This is the direct expression of
"one common prompt, extended per service," and keeps ElevenLabs and a future
OpenAI adapter in lockstep (OpenAI's `session.instructions` receives the same
rendered spec).

Consequences:

- Prompt overrides must be **explicitly enabled** on the ElevenLabs agent (a
  one-time IaC setting — off by default).
- The assembled prompt travels through the browser to ElevenLabs at session
  start (visible in devtools). Acceptable: a tutor prompt is not sensitive.

## 5. Vocabulary: the prompt-injection contract

No vocab schema in v1. Vocabulary enters through one seam:

```ts
interface VocabItem { term: string; translation: string; example?: string }

interface VocabSource {
  getSessionVocab(intent: { userId: string; targetLanguage: 'es' }): Promise<VocabItem[]>;
}
```

**v1 implementation:** a static Spanish list (a small const / JSON in the repo).
Later swapped for real per-user data with no change to the prompt or session
code.

Mode rendering into the prompt:

- **quiz:** "Quiz the learner on these words, one at a time: `term (translation)`…"
- **weave:** "Work these words naturally into the conversation: `term (translation)`…"

The words chosen for a session are snapshotted onto `ConversationSession.vocabSnapshot`
(JSONB) for scoring/audit.

## 6. End-to-end ElevenLabs flow

```
1. Client POST /v1/voice/sessions  { mode, targetLanguage, speech.slower }  (JWT auth)
2. Server: auth → rate-limit → enforce one-active-session-per-user
3. Server: VocabSource.getSessionVocab → build PromptSpec → render override
4. Server: create ConversationSession (status=pending, vocabSnapshot, promptVersion,
   providerConfigSnapshot)
5. Server: POST ElevenLabs /v1/convai/conversation/token for the configured agent_id
6. Server: store providerConversationId; return VoiceSessionStart to client
7. Client: @elevenlabs/react starts session with conversationToken + clientInit
8. User talks directly to ElevenLabs over WebRTC (no server audio proxy)
9. Client shows local status/messages; on end notifies server best-effort
10. ElevenLabs post-call webhook → POST /v1/webhooks/elevenlabs
11. Server: HMAC-verify → join on providerConversationId → persist transcript + scoring
    (idempotent on providerConversationId)
```

## 7. Infrastructure-as-code (ElevenLabs)

App deploys must **not** mutate third-party product config. Agent provisioning is
an explicit, separate step.

- Commit `server/config/voice/elevenlabs-agent.json` — the agent definition
  (prompt-override enabled, allowed overrides, language, post-call webhook with
  HMAC).
- `server/scripts/sync-elevenlabs-agent.ts` — run in CI or manually:
  - if `ELEVENLABS_CONVAI_AGENT_ID` set → `PATCH /v1/convai/agents/{id}` to match
    the committed config;
  - if not set → `POST /v1/convai/agents/create`, print the new `agent_id` to
    store as an env var.
- The only ever-manual dashboard step is initial account + API key creation.

### Env vars (via `server/src/config/envVars.ts` + `Config`, Render env group)

| Var | Kind | Notes |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | secret | Render env group; never sent to client |
| `ELEVENLABS_CONVAI_AGENT_ID` | config, per env | from the sync script |
| `ELEVENLABS_WEBHOOK_SECRET` | secret | HMAC verification |
| `VOICE_PROVIDER` | config | `elevenlabs` for v1 |
| `VOICE_MAX_SESSION_SECONDS` | config | server-enforced cap (e.g. 300) |

Providers read keys from `Config`, never `process.env` directly (matches the
existing `auth.lib.ts` pattern).

## 8. Data model (one table)

**`ConversationSession`**

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | pk |
| userId | uuid | fk → users |
| provider | string | `elevenlabs` |
| providerConversationId | string, unique, nullable | set once minted |
| mode | enum | `quiz` \| `weave` (model enum constant) |
| targetLanguageCode | string | `es` |
| status | enum | `pending` \| `active` \| `completed` \| `failed` \| `expired` |
| vocabSnapshot | JSONB | words used this session |
| promptVersion | string | which prompt build produced the session |
| providerConfigSnapshot | JSONB | agent/config used, for audit/debug |
| transcript | JSONB, nullable | from webhook |
| scoring | JSONB, nullable | from webhook |
| durationSeconds | int, nullable | |
| costCents | int, nullable | |
| startedAt / endedAt | timestamps | |

`status` and `mode` follow the project's model-enum pattern (constants exported
from the model file, used for validation).

## 9. Security & cost controls

**v1 (not optional):**

- JWT-authenticated mint endpoint (`authenticateAccessToken`).
- Per-user mint rate limit.
- One active voice session per user.
- Server-enforced max session duration (`VOICE_MAX_SESSION_SECONDS`) plus a
  client timer.
- Webhook HMAC verification + idempotent processing on `providerConversationId`.
- Never return the API key, agent admin config, or provider secrets to the
  client.
- Store `vocabSnapshot` and `providerConfigSnapshot` for audit/debug.

**Later:** subscription quotas, per-day/month minute budgets, abuse detection,
admin kill-switch, audio-retention controls, per-word analytics.

## 10. Testing strategy

- **Server lib** (TDD, one function at a time): prompt assembly (`PromptSpec` →
  rendered override for each mode + slower flag), `VocabSource` static impl,
  `ElevenLabsSessionProvider.createSession` (nock the token endpoint), webhook
  HMAC verify + idempotent persistence.
- **Server API** (Supertest): `POST /v1/voice/sessions` (auth, rate-limit,
  one-active-session, happy path with nocked provider), `POST
  /v1/webhooks/elevenlabs` (valid/invalid HMAC, duplicate delivery).
- **Client** (Vitest + Testing Library): `VoiceSession` ElevenLabs adapter with
  the SDK mocked (status transitions, message callbacks), the voice UI page.
- External HTTP mocked with **nock**; SDK/objects with **Sinon**.

## 11. Component diagram

```
React UI
  └─ VoiceTutorService
       └─ ElevenLabsVoiceSessionAdapter ──(WebRTC, @elevenlabs/react)──► ElevenLabs

React UI
  └─ apiClient (Bearer JWT)
       └─ POST /v1/voice/sessions
            └─ authenticateAccessToken
                 └─ VoiceSessionService
                      ├─ PromptBuilder (PromptSpec → override)
                      ├─ VocabSource (static list, v1)
                      ├─ ElevenLabsSessionProvider ──► ElevenLabs /v1/convai/conversation/token
                      └─ ConversationSession (Sequelize)

ElevenLabs post-call webhook
  └─ POST /v1/webhooks/elevenlabs
       └─ HMAC verify → join on providerConversationId → persist transcript/scoring
```

## 12. Future work / open questions

- OpenAI Realtime and Gemini Live adapters (server `VoiceSessionProvider` +
  client `VoiceSession` impls; reuse the same `PromptSpec`).
- Real per-user vocabulary behind `VocabSource`.
- React Native client reusing the server seam.
- Scoring rubric: what "scoring" JSONB actually contains (defined when the quiz
  UX is designed).
- Confirm exact ElevenLabs override/dynamic-variable field names and webhook
  payload shape against current ElevenLabs docs at implementation time.
