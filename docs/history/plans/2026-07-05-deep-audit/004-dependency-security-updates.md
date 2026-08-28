# Plan 004: Apply dependency security updates (1 critical, 4 high advisories)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- package.json package-lock.json`
> Then run `npm audit` and compare with the inventory below — if the advisory
> set is materially different (new criticals, or these already fixed), adapt:
> fix whatever `npm audit` currently reports using the same procedure, and
> record the delta in the README status row.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but running after 002/003 gives better regression cover)
- **Category**: security / dependencies
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

`npm audit` on the audited tree reports **13 vulnerabilities (1 low, 7
moderate, 4 high, 1 critical)**, all with non-breaking fixes available via
`npm audit fix`:

- **critical**: `protobufjs <=7.6.2` — arbitrary code execution / prototype
  injection advisories (GHSA-xq3m-2v4x-88gg and others). Transitive dependency
  of `@google/genai`, which runs on the **server request path** for every
  Gemini parse.
- **high**: `path-to-regexp 8.0.0–8.3.0` — ReDoS (GHSA-j3q9-mxjg-w52f,
  GHSA-27v5-c462-wpq7). Transitive of `express` 5 — server routing path.
- **high**: `vite <=6.4.2` — dev-server arbitrary file read via WebSocket
  (GHSA-p9ff-h696-f583) and path traversal (GHSA-4w7w-66w2-5vf9). Dev-only,
  **but** `.env.example:39-41` documents exposing the dev server through
  tunnels (`BABEL_DEV_ALLOWED_HOSTS=.trycloudflare.com`), which makes the dev
  server internet-reachable in a documented workflow — an arbitrary file read
  there can expose the local `.env` (provider API keys).
- **high**: `ws 8.0.0–8.20.1` (via playwright, dev-only) and `picomatch`
  (ReDoS) — lower reachability, same fix path.

The repo already has an `audit` script (`package.json:14`) and an `overrides`
block (`"rimraf": "6.1.3"`), so this maintenance path is established practice.

## Current state

- `package.json` (working tree) dependencies include `@google/genai ^1.42.0`,
  `express ^5.2.1`, `vite ^6.2.0`, `playwright ^1.61.0` (devDependency).
- `package-lock.json` is present and **already modified in the dirty working
  tree** — inspect `git diff package-lock.json --stat` before starting and do
  not discard those existing changes.
- No test suite may exist yet depending on plan order; minimum regression
  gates are `npm run build` and boot-checking the server.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Audit     | `npm audit`              | (before) 13 vulns; (after) 0 critical, 0 high |
| Fix       | `npm audit fix`          | exit 0, lockfile updated |
| Install check | `npm ci`             | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Server boot | `timeout 5 node server/index.js; test $? -eq 124 && echo BOOT_OK` | prints `BOOT_OK` (server stayed up 5s) |
| Typecheck (if 002 landed) | `npm run typecheck` | exit 0 |
| Tests (if 003 landed) | `npm test` | pass |

## Scope

**In scope**:
- `package.json` (only if `npm audit fix` needs an `overrides` entry or a
  devDependency bump; keep direct-dependency major versions unchanged)
- `package-lock.json`

**Out of scope** (do NOT touch):
- `npm audit fix --force` — never. If plain `npm audit fix` cannot clear a
  critical/high advisory, add a targeted `overrides` entry instead (pattern
  already exists: `"overrides": { "rimraf": "6.1.3" }`), and if that fails,
  STOP and report the specific package.
- Upgrading React, Vite, or Express across major versions.
- Any source file.

## Git workflow

- Branch: `codex/babel-cross-platform`.
- Single commit, message like `Apply npm audit security fixes`.
- Do NOT push unless instructed.

## Steps

### Step 1: Record the before-state

Run `npm audit 2>&1 | tail -3` and save the summary line into your report.

**Verify**: summary line captured (expected ~`13 vulnerabilities (1 low, 7 moderate, 4 high, 1 critical)`).

### Step 2: Apply fixes

Run `npm audit fix`.

**Verify**: `npm audit 2>&1 | tail -3` → `0 critical`; high count 0 (or only
advisories whose fix would be semver-major — see Step 3).

### Step 3: Clear any stragglers with overrides

For each remaining critical/high advisory, add a minimal `overrides` entry in
`package.json` pinning the patched version of the *vulnerable transitive
package* (not the direct dependency), then `npm install` to regenerate the
lock. Example shape (already present in the file):

```json
  "overrides": {
    "rimraf": "6.1.3"
  }
```

**Verify**: `npm audit 2>&1 | tail -3` → `0 critical`, `0 high` (moderates in
dev-only paths are acceptable; list them in the report).

### Step 4: Regression-check

Run in order: `npm ci` → `npm run build` →
`timeout 5 node server/index.js; test $? -eq 124 && echo BOOT_OK`
(and `npm run typecheck` / `npm test` if those scripts exist).

**Verify**: build exits 0; `BOOT_OK` printed; any existing test/typecheck
scripts green.

## Test plan

No new tests. The regression gates in Step 4 are the test plan; @google/genai
is exercised only against live APIs, so its post-bump behavior is validated by
the smoke boot plus (if available) the maintainer running one live parse —
note that residual risk in your report.

## Done criteria

- [ ] `npm audit` reports 0 critical and 0 high vulnerabilities
- [ ] `npm run build` exits 0
- [ ] Server boot check prints `BOOT_OK`
- [ ] `git diff --stat` touches only `package.json` / `package-lock.json`
- [ ] `plans/README.md` status row updated with before/after audit summary

## STOP conditions

Stop and report back (do not improvise) if:

- `npm audit fix` changes a direct dependency's **major** version.
- After fixes, `npm run build` fails or the server boot check fails.
- Clearing a critical/high would require `--force` or a major bump of
  `vite` / `express` / `@google/genai` — report the package and advisory
  instead; that is a maintainer decision.

## Maintenance notes

- Re-run `npm run audit` monthly or before each release; this repo ships a
  live server wired to paid provider keys, so server-path advisories
  (express/genai chains) matter more than dev-path ones.
- If the maintainer adopts CI later (see plans/README backlog), add
  `npm audit --omit=dev --audit-level=high` as a non-blocking job first.
