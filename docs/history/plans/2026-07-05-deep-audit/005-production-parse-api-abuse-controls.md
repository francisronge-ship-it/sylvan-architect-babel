# Plan 005: Add abuse controls to the Vercel parse endpoint and fix the token-gate contradiction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- api/parse.js server/index.js .env.example vercel.json services/parseService.ts`
> This plan was written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). If `api/parse.js` already
> contains rate limiting, STOP (someone fixed it).

## Status

- **Status**: REJECTED — Babel's stale Vercel production surface is being withdrawn; this Vercel-era endpoint implementation should not land.
- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the production request path)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

The production deployment (Vercel, per `vercel.json` and the live app at
sylvanarchitectbabel.com) serves `/api/parse` through `api/parse.js`, which has
**no rate limiting of any kind** — no per-minute limit, no daily quota, no
in-flight cap. Each request can hold a paid frontier-model call for up to 120
seconds (`vercel.json: "maxDuration": 120`) against the owner's Gemini, OpenAI,
or Anthropic keys.

The two defenses it does have are weaker than they look:

1. **Origin check** (`api/parse.js:84-91`): the `Origin` header is
   attacker-controlled for any non-browser client; a script can set
   `Origin: https://sylvanarchitectbabel.com` and pass.
2. **Token gate** (`api/parse.js:74-81`): `.env.example:35-38` says
   `BABEL_PARSE_API_TOKEN` is "*** REQUIRED in production / Vercel ***", but
   the web client **never sends** `x-babel-api-token`
   (`services/parseService.ts:45-51` sends only `Content-Type`), so enabling
   the token in production would 401 the public site. The guidance and the
   client contradict each other; in practice the token must be OFF, meaning
   production runs on the spoofable origin check alone.

By contrast, the Express server (`server/index.js:187-241`) has a per-minute
limiter, a per-IP daily quota, and an in-flight cap — the protections exist in
the repo but not on the deployed path.

Result: a trivial script can burn the owner's provider budget at whatever
concurrency Vercel allows. This plan ports the Express protections into a
shared module used by the serverless handler, and fixes the documentation
contradiction.

**Honest limitation to preserve in code comments and docs**: in-memory
counters on serverless are per-instance — a distributed attacker can exceed
them by fanning across instances. They still stop the cheap single-source
abuse case. Platform-level rate limiting (Vercel WAF rules) is the real
backstop and can only be configured in the Vercel dashboard — record that as
an operator action in your report; it cannot be done from this repo.

## Current state

- `api/parse.js` — Vercel serverless handler. Full flow today: method check →
  token gate (if env set) → origin check (default ON:
  `requireOriginCheck = parseBooleanEnv(process.env.BABEL_REQUIRE_ORIGIN, true)`,
  line 19) → 16kb body guard → `parseFromBody(req.body)`.
- `server/index.js` — Express server with the protections to port:
  - `enforceDailyIpQuota` (lines 79–101): per-IP day-bucketed Map with
    prune-at-20k.
  - `parseLimiter` via `express-rate-limit` (lines 187–193): 30/min default.
  - in-flight cap (lines 218–224): `maxInFlightParses` default 8, returns 503
    `SERVER_BUSY`.
  - env knobs (lines 58–60): `BABEL_PARSE_RATE_LIMIT_PER_MINUTE` (30),
    `BABEL_PARSE_DAILY_LIMIT_PER_IP` (1200), `BABEL_MAX_IN_FLIGHT_PARSES` (8).
- `services/parseService.ts:45-51` — client fetch, sends no token header.
- `.env.example:35-38` — the contradictory "REQUIRED in production" token text.
- Error-shape convention (match it exactly):
  `{ error: { code: 'RATE_LIMITED', message: '...' } }` with 429;
  `RATE_LIMITED_DAILY` 429; `SERVER_BUSY` 503 (see `server/index.js:86-88,192,219-221`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm ci`                 | exit 0              |
| Tests     | `npm test` (exists only if plan 003 landed) | pass |
| Build     | `npm run build`          | exit 0              |
| Express boot | `timeout 5 node server/index.js; test $? -eq 124 && echo BOOT_OK` | `BOOT_OK` |

## Scope

**In scope**:
- `server/parseGuards.js` (create — shared guard logic, framework-free)
- `api/parse.js` (use the guards)
- `server/index.js` (replace its inline daily-quota/in-flight logic with the
  shared module — keep `express-rate-limit` as-is for the per-minute limiter)
- `.env.example` (fix the token-gate text)
- `server/parseGuards.test.mjs` (create, if plan 003's test runner exists)

**Out of scope** (do NOT touch):
- `vite.config.ts` dev middleware — dev-only, already has its own limiter.
- `services/parseService.ts` — do NOT wire the token into the public client;
  a token shipped to the browser is public by definition.
- `server/parseApi.js` validation logic.
- Vercel dashboard/WAF configuration (operator action; put it in your report).

## Git workflow

- Branch: `codex/babel-cross-platform`.
- Commits: guards module + tests, then handler adoption, then docs. Message
  style: short imperative.
- Do NOT push unless instructed.

## Steps

### Step 1: Create `server/parseGuards.js`

Export a factory `createParseGuards({ perMinuteLimit, dailyLimitPerIp, maxInFlight })`
returning `{ checkRate(ip, now), checkDailyQuota(ip, now), beginParse(), endParse() }`
— pure in-memory logic lifted from `server/index.js`:

- `checkRate`: fixed 60s window per IP (port the Map pattern from
  `vite.config.ts:127-146`, which already implements exactly this shape);
  returns `{ ok: true }` or `{ ok: false, status: 429, code: 'RATE_LIMITED', message: 'Too many parse requests. Please retry shortly.' }`.
- `checkDailyQuota`: port `enforceDailyIpQuota` from `server/index.js:79-101`
  verbatim (day-bucket key `${ip}|${dayBucket}`, prune when size > 20000);
  same `{ ok }` result shape with `RATE_LIMITED_DAILY`.
- `beginParse`/`endParse`: the in-flight counter from `server/index.js:218-240`
  (`SERVER_BUSY`, 503). `endParse` must never drop below 0.
- Read nothing from `process.env` inside the module; the caller passes limits.
  Reuse the same defaults (30 / 1200 / 8) at the call sites via the existing
  `toPositiveInt(process.env.BABEL_PARSE_RATE_LIMIT_PER_MINUTE, 30)` pattern
  (`server/index.js:49-60`).

**Verify**: `node -e "import('./server/parseGuards.js').then(m => { const g = m.createParseGuards({ perMinuteLimit: 2, dailyLimitPerIp: 3, maxInFlight: 1 }); console.log(g.checkRate('a', Date.now()).ok, g.checkRate('a', Date.now()).ok, g.checkRate('a', Date.now()).ok); })"`
→ prints `true true false`.

### Step 2: Adopt the guards in `api/parse.js`

After the existing origin check and before the body guard, add (module-level
singleton guards; per-instance state is expected on serverless — add the
one-line comment about that limitation):

- `checkRate` → on failure respond with its status/code/message in the
  established error shape.
- `checkDailyQuota` → same.
- Wrap the `parseFromBody` call in `beginParse()`/`try{...}finally{ endParse() }`,
  responding 503 `SERVER_BUSY` when `beginParse` refuses.

Keep header order and all existing behavior otherwise identical.

**Verify**: `node --check api/parse.js` → exit 0 (syntax). If plan 003's
runner exists, the Step 5 tests below are the real verification.

### Step 3: Deduplicate `server/index.js`

Replace the inline `dailyUsageByIp` Map + `enforceDailyIpQuota` + in-flight
counter (lines 61–101, 218–240) with the shared module (keep `express-rate-limit`
for per-minute — it is more capable than the ported fixed window). The Express
middleware wrappers stay; only their state/logic moves.

**Verify**: `timeout 5 node server/index.js; test $? -eq 124 && echo BOOT_OK` → `BOOT_OK`.

### Step 4: Fix the `.env.example` contradiction

Replace lines 35–38's "*** REQUIRED in production / Vercel ***" block with
accurate guidance:

```
# API token gate for /api/parse — for PRIVATE deployments and harness access only.
# The public web client does not send this header; enabling it on a public
# deployment will lock out the site. Public deployments rely on origin checks,
# in-process rate/quota limits, and platform-level (Vercel WAF) rules.
# If set, clients must send header: x-babel-api-token: <token>
# Generate one:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# BABEL_PARSE_API_TOKEN=
```

**Verify**: `grep -c "REQUIRED in production" .env.example` → `0`.

### Step 5: Tests (if plan 003 landed)

Create `server/parseGuards.test.mjs` with node:test covering: rate window
(N allowed, N+1 refused, refreshed after window), daily quota (limit hit →
`RATE_LIMITED_DAILY`), in-flight (`beginParse` refusal at cap, release via
`endParse`), prune behavior (size cap respected). Model structure on
`server/babelParser/normalizeParseBundle.test.mjs`.

**Verify**: `npm test` → all pass.

## Test plan

- Unit: Step 5 (guards logic — deterministic, no network).
- Manual/operator (report, don't automate): after deploy, `curl` the live
  endpoint >30 times/min with a forged Origin and confirm 429s.

## Done criteria

- [ ] `api/parse.js` enforces per-minute, daily, and in-flight limits with the
      repo's established error JSON shape
- [ ] `server/index.js` and `api/parse.js` share `server/parseGuards.js`
      (no duplicated quota Map: `grep -c "dailyUsageByIp" server/index.js` → 0)
- [ ] `.env.example` no longer claims the token is required for public production
- [ ] `npm run build` exits 0; Express boot check prints `BOOT_OK`
- [ ] Tests pass (if runner exists)
- [ ] Report includes the operator note: configure Vercel WAF/rate rules as the
      cross-instance backstop
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `api/parse.js` on your tree already imports rate limiting or differs
  materially from the excerpt behavior (drift).
- You find evidence the production deployment does NOT use `api/parse.js`
  (e.g. a `middleware.ts` or different `vercel.json` appears).
- The fix seems to require changing `services/parseService.ts` — that means
  you are about to ship the token to the browser; stop.

## Maintenance notes

- These are per-instance guards. The durable fix for distributed abuse is
  platform-level (Vercel WAF / firewall rules) or a shared store
  (Upstash/Redis) — deliberately out of scope to keep this dependency-free;
  revisit if abuse is observed in provider billing.
- If a future plan adds authenticated researcher API access, the token gate
  path is already here — issue per-researcher tokens rather than weakening the
  origin default.
- Reviewer focus: the `finally { endParse() }` placement in `api/parse.js` —
  a missed release permanently wedges the instance at the in-flight cap.
