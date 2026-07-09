# Plan 010: Make parse-corpus logging deliverable on Vercel (replace the untraceable dynamic import)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- server/parseApi.js server/parseLogStore.js package.json`
> Compare the excerpt below; on mismatch, STOP.

## Status

- **Status**: SUPERSEDED — the old Supabase/Postgres parse logging path was removed instead of made deliverable on Vercel.
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003 (test runner) recommended
- **Category**: bug / observability (investigate + fix)
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

Parse-corpus logging (`BABEL_PARSE_LOG_DATABASE_URL` → Postgres, documented in
`.env.example:51-53`) is loaded like this in `server/parseApi.js:12-24`:

```js
const importAtRuntime = new Function('specifier', 'return import(specifier);');

const maybeRecordParseEvent = async ({ sentence, framework, modelRoute, result }) => {
  try {
    const { recordParseEvent } = await importAtRuntime('./parseLogStore.js');
    await recordParseEvent({ sentence, framework, modelRoute, result });
  } catch (error) {
    const code = String(error?.code || '').trim();
    if (code === 'ERR_MODULE_NOT_FOUND') return;
    if (String(error?.message || '').includes("Cannot find package 'postgres'")) return;
    throw error;
  }
};
```

The `new Function` wrapper hides the import from static analysis. That was
presumably to tolerate a missing `postgres` package — but `postgres` **is** a
regular dependency (`package.json:27`), so the indirection buys nothing
locally, and on Vercel it plausibly breaks logging entirely: Vercel's
file tracing (nft) bundles only statically discoverable imports, so
`server/parseLogStore.js` (and possibly `postgres`) may be excluded from the
serverless bundle → `ERR_MODULE_NOT_FOUND` at runtime → the catch swallows it
→ **the research corpus silently never records**, with zero signals.
(Audit note 2026-07-05: local resolution was tested and works — the failure
mode is specific to bundled serverless deploys and is MED-confidence until
verified in Step 1.)

Two additional problems while here: (a) the logging call is **awaited in the
request path** (`server/parseApi.js:88`) — with `connect_timeout: 20`
(`parseLogStore.js:16`), a down database adds up to ~20s to user-facing parse
responses; (b) a failure like a schema error would `throw` out of
`maybeRecordParseEvent` and fail the whole parse response even though the
parse succeeded (only import-shaped errors are swallowed; runtime DB errors
are caught inside `recordParseEvent`, but `ensureParseLogSchema` rejections
surface through it — actually `recordParseEvent` catches all its own errors
and returns false; the remaining throw path is import-shaped only. Verify in
Step 3 and do not change semantics beyond what's specified.)

## Current state

- `server/parseApi.js:12-24` — as excerpted above; called at line 88:
  `await maybeRecordParseEvent({ sentence, framework, modelRoute, result });`
- `server/parseLogStore.js` — `recordParseEvent` returns `false` when
  `BABEL_PARSE_LOG_DATABASE_URL` is unset (line 59) and catches its own DB
  errors (lines 85–89). It creates its table lazily.
- `postgres` is a production dependency.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests   | `npm test` | pass |
| Syntax  | `node --check server/parseApi.js` | exit 0 |
| Behavior probe | `node -e "import('./server/parseApi.js').then(async m => { const r = await m.parseFromBodyWithProviders({ sentence: 'Mia laughed.', framework: 'xbar', modelRoute: 'gemini' }, { gemini: async () => ({ analyses: [{}], ambiguityDetected: false }) }); console.log('ok', Array.isArray(r.analyses)); })"` | `ok true` |

## Scope

**In scope**:
- `server/parseApi.js` (the `maybeRecordParseEvent` block only)
- `server/parseApi.test.mjs` (create)

**Out of scope** (do NOT touch):
- `server/parseLogStore.js` (its lazy-connection/self-catching design is fine)
- `vercel.json` (`includeFiles` workarounds are unnecessary once the import is
  statically visible)
- The response shape or validation logic in `parseApi.js`.

## Git workflow

- Branch: `codex/babel-cross-platform`; single commit
  (`Make parse logging statically traceable and non-blocking`).
- Do NOT push unless instructed.

## Steps

### Step 1: Replace the dynamic-import indirection

Rewrite the block in `server/parseApi.js` to gate on the env var and use a
literal dynamic import (statically traceable by bundlers, still lazy so
`postgres` never loads when logging is off):

```js
const maybeRecordParseEvent = async ({ sentence, framework, modelRoute, result }) => {
  if (!String(process.env.BABEL_PARSE_LOG_DATABASE_URL || '').trim()) return;
  try {
    const { recordParseEvent } = await import('./parseLogStore.js');
    await recordParseEvent({ sentence, framework, modelRoute, result });
  } catch (error) {
    console.error(`[parse-log] delivery failed: ${String(error?.message || error)}`);
  }
};
```

Delete the `importAtRuntime` `new Function` line entirely. Note the semantics
change is deliberate and safe: logging failures now log-and-continue instead
of failing the parse response (a parse that succeeded should never 500 because
telemetry hiccuped).

**Verify**: `node --check server/parseApi.js` → exit 0; the behavior probe
command above → `ok true` (with the env var unset, the import never runs).

### Step 2: Take it out of the response's critical path

At the call site (line ~88), keep ordering but don't let telemetry block the
response longer than necessary: change

```js
  await maybeRecordParseEvent({ sentence, framework, modelRoute, result });
  return result;
```

to race it against a short cap (serverless-safe — still awaited, so the
platform won't kill the write mid-flight in the common case, but a down DB
costs ≤2.5s, not 20s):

```js
  await Promise.race([
    maybeRecordParseEvent({ sentence, framework, modelRoute, result }),
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]);
  return result;
```

Add a one-line comment: telemetry gets ≤2.5s of the request; a slow write may
be abandoned by the platform after response return — acceptable for corpus
logging.

**Verify**: behavior probe still prints `ok true` and completes in <3s.

### Step 3: Tests

`server/parseApi.test.mjs` (node:test), using
`parseFromBodyWithProviders(body, providers)` (exported at
`server/parseApi.js:78`) with stub providers:

1. Happy path with env unset → resolves, no postgres import (assert by timing
   <1s and result shape).
2. With `process.env.BABEL_PARSE_LOG_DATABASE_URL` set to a syntactically
   valid but unreachable URL (`postgresql://user:pass@127.0.0.1:1/db`) →
   still resolves `ok` within ~3s (Step 2 cap) — set and restore the env var
   inside the test.
3. `validateParseBody` rejections still intact: empty sentence → throws
   `INVALID_REQUEST` (guards against accidental edits to the file).

**Verify**: `npm test` → all pass.

### Step 4: Deployment verification note

You cannot verify Vercel bundling locally. Add to your report: after the next
deploy with `BABEL_PARSE_LOG_DATABASE_URL` set, the maintainer should run one
live parse and check (a) Vercel function logs contain no `[parse-log]` error,
(b) the `parse_events` table gained a row.

## Test plan

Step 3. No live DB or provider needed.

## Done criteria

- [ ] `grep -c "new Function" server/parseApi.js` → 0
- [ ] `npm test` green including 3 new tests
- [ ] Behavior probe passes with and without the env var set
- [ ] `plans/README.md` status row updated (include the Step 4 operator note)

## STOP conditions

Stop and report back (do not improvise) if:

- `maybeRecordParseEvent` or its call site has materially changed (drift).
- Test 2 hangs >10s (the race isn't working — do not ship a hanging telemetry
  path).

## Maintenance notes

- If the corpus becomes load-bearing for research, replace log-and-continue
  with a dead-letter file under `.artifacts/` so failed events are recoverable;
  deliberately out of scope now.
- The 2.5s cap trades completeness for latency; if Vercel logs show frequent
  `[parse-log]` abandonment, raise the cap or move logging to a queue.
