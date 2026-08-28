# Plan 007: Cancel orphaned OpenAI background responses on timeout/abort

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- server/babelParser/modelRuntime.js`
> Compare the "Current state" excerpts; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-committed-verification-fixtures-and-test-runner.md (node:test runner)
- **Category**: bug / cost
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

The GPT route defaults to background Responses-API jobs
(`OPENAI_BACKGROUND_RESPONSES` defaults on — `routeConfig.js:55`) with
`store: true`. The route wraps the whole generate call in `withTimeout`
(`parseRoutes.js:807-824`), whose abort cancels the local **polling loop** —
but nothing cancels the **remote job**. Every timed-out or aborted GPT parse
leaves a background job running (and stored) on OpenAI's account, billing
reasoning tokens at `xhigh` effort (the default,
`routeConfig.js:50-54`) for output nobody will read. On Vercel the function is
killed at 120s (`vercel.json`) while the provider budget allows up to 900s
(`routeConfig.js:160`) — so long GPT parses in production are *systematically*
abandoned mid-flight, each leaving an orphan.

OpenAI's Responses API supports `POST /v1/responses/{response_id}/cancel` for
background responses. One fire-and-forget cancel call on the abort path stops
the burn.

## Current state

`server/babelParser/modelRuntime.js`:

- `withTimeout` (lines 58–81): races the run against a timer; on timeout calls
  `controller.abort()` and rejects. The abort signal flows into the fetches.
- `delayWithAbort` (453–464): poll sleep that rejects on abort.
- `waitForOpenAIResponseCompletion` (503–523): polls
  `GET /v1/responses/{id}` until a terminal status; loop exits by rejection
  when the signal aborts (the fetch/delay reject) — **no cancel is issued**.
- `generateOpenAIStructuredContent` (534–611): creates the response with
  `...(background ? { background: true, store: true } : {})` (line 558), then
  polls. Errors propagate up; no `finally`/cancel.
- Repo error-shape convention: provider fetch errors get
  `error.status = response.status; error.responseBody = payload.text;`
  (see lines 565–570) — match it if you surface cancel failures (you should
  not; cancel is best-effort).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm ci`                 | exit 0              |
| Tests     | `npm test`               | all pass            |
| Syntax    | `node --check server/babelParser/modelRuntime.js` | exit 0 |

## Scope

**In scope**:
- `server/babelParser/modelRuntime.js` (the OpenAI functions only)
- `server/babelParser/modelRuntime.test.mjs` (create)

**Out of scope** (do NOT touch):
- `withTimeout` itself — its contract is shared by all providers.
- The Anthropic/Gemini/local paths (streaming/non-background; nothing to cancel).
- `store: true` — turning off storage changes retrieval semantics for
  background polling; leave it.
- Retry logic of any kind.

## Git workflow

- Branch: `codex/babel-cross-platform`; single commit, e.g.
  `Cancel orphaned OpenAI background responses on abort`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add a best-effort cancel helper

In `modelRuntime.js`, next to `fetchOpenAIResponseJson` (~line 468), add:

```js
const cancelOpenAIBackgroundResponse = async ({ apiKey, responseId }) => {
  if (!responseId) return false;
  try {
    const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch {
    return false;
  }
};
```

No abort signal on this call (it must survive the aborted context), no throw.

**Verify**: `node --check server/babelParser/modelRuntime.js` → exit 0.

### Step 2: Invoke it on the background failure path

In `generateOpenAIStructuredContent`, capture the response id as soon as the
create call parses (`const backgroundResponseId = background ? String(payload.json?.id || '').trim() : '';`
after line 570's error check), then wrap the polling phase:

```js
  if (background) {
    try {
      const completedPayload = await waitForOpenAIResponseCompletion({ ... });
      payload.text = completedPayload.text;
      payload.json = completedPayload.json;
    } catch (error) {
      void cancelOpenAIBackgroundResponse({ apiKey, responseId: backgroundResponseId });
      throw error;
    }
  }
```

Note `void` — fire-and-forget; do not await it in the throw path (the caller's
timeout already fired; adding latency there delays the user's error response).
Add one comment line stating that: the cancel is best-effort and unawaited by
design.

**Verify**: `node --check server/babelParser/modelRuntime.js` → exit 0.

### Step 3: Unit tests with a stubbed fetch

Create `server/babelParser/modelRuntime.test.mjs` (node:test; global `fetch`
is stubbable via `globalThis.fetch = ...` in each test, restored in `finally`):

1. **Cancel fired on poll abort**: stub fetch so the create POST returns
   `{ id: 'resp_1', status: 'queued' }`, the first poll GET rejects with an
   `AbortError`-like error; assert the stub later receives a POST to
   `/v1/responses/resp_1/cancel`. Drive
   `generateOpenAIStructuredContent({ apiKey: 'k', model: 'm', contents: 'x', systemInstruction: 's', background: true, pollIntervalMs: 1, abortSignal: controller.signal })`
   and `controller.abort()` after the create resolves; assert it rejects AND
   cancel was called (use a small `await new Promise(r => setTimeout(r, 10))`
   before asserting the unawaited cancel).
2. **No cancel on success**: stub create → `{ id: 'resp_2', status: 'completed', output_text: '{}' , usage: {} }`;
   assert resolve and zero cancel calls.
3. **Cancel never throws**: stub cancel endpoint to reject; assert test 1's
   flow still rejects with the original error (not the cancel error).

**Verify**: `npm test` → all pass, including 3 new tests.

## Test plan

Covered in Step 3 — deterministic, no network (stubbed `fetch`). Note in your
report: the maintainer can confirm live behavior by aborting one
`npm run local:provider-effort` GPT run and checking the OpenAI dashboard for
the job status moving to `cancelled`.

## Done criteria

- [ ] `grep -n "responses/.*cancel" server/babelParser/modelRuntime.js` → 1 hit
- [ ] `npm test` green including the 3 new tests
- [ ] `node --check server/babelParser/modelRuntime.js` exit 0
- [ ] No changes outside the two in-scope files (`git status --porcelain`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `generateOpenAIStructuredContent` no longer has the background branch shown
  in "Current state" (drift).
- Stubbing `globalThis.fetch` proves impossible because the module captured a
  fetch reference at import time (it does not, as audited — calls are direct
  `fetch(...)`; if that changed, report).

## Maintenance notes

- If a future plan adds client-driven request cancellation (an AbortController
  in `App.tsx`'s `handleParse`, currently absent — see plans/README backlog),
  this same cancel path handles it for free: the abort reaches `withTimeout`'s
  signal and this hook fires.
- Related hardening recorded in the backlog, not here: `getErrorMeta`
  (`modelRuntime.js:22-32`) calls `JSON.stringify(error)` unguarded — a
  circular provider error would throw inside error classification; wrap in
  try/catch when someone touches this file for other reasons.
