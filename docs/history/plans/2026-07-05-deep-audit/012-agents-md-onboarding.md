# Plan 012: Write AGENTS.md so agent executors stop rediscovering Babel's landmines

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `ls AGENTS.md CLAUDE.md 2>/dev/null` — if either
> exists, STOP (reconcile instead of overwrite).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but reference whichever of plans 001–011 have landed —
  check `plans/README.md` status column and include only commands that exist)
- **Category**: dx / docs
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

Babel is developed largely through AI coding agents (branch
`codex/babel-cross-platform`; `docs/checkpoints/` session checkpoints;
`docs/design/mac-new-device-pickup-2026-06-05.md` device-handoff notes), and
this plan set will be executed by another agent. There is no `AGENTS.md` or
`CLAUDE.md`. Every agent session therefore re-learns the same non-obvious,
mistake-inducing facts — several of which produced real problems found in the
2026-07-05 audit (types drift shipped a runtime crash; `test/` being
gitignored exiled the test suite; prompt edits are invisible to artifacts).

## Current state

- No `AGENTS.md`, `CLAUDE.md`, or `CONTRIBUTING.md` at repo root (audited).
- The facts to record are listed in Step 1 — they were all verified during the
  audit; re-verify any that plans 001–011 may have changed (e.g. verification
  commands exist only after plans 002/003).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm commands you document actually work | run each one | matches what you wrote |

## Scope

**In scope**: `AGENTS.md` (create, repo root).
**Out of scope**: any other file; do not add symlinks or a CLAUDE.md duplicate
(agents that look for CLAUDE.md also read AGENTS.md).

## Git workflow

- Branch: `codex/babel-cross-platform`; single commit (`Add AGENTS.md`).
- Do NOT push unless instructed.

## Steps

### Step 1: Write AGENTS.md with this outline (verify each fact against the tree before writing it)

1. **What Babel is** (3 sentences): derivational syntax engine — LLMs produce
   explicit `derivationStages` derivations; server normalizes/validates them;
   React app replays them. Research instrument + teaching tool + future
   benchmark; both halves matter.
2. **Architecture map** (one line each): `server/parseApi.js` (validation) →
   `server/babelParser.js` (DI wiring façade) → `server/babelParser/*`
   (contract in `systemInstruction.js`, providers in `modelRuntime.js`/
   `parseRoutes.js`, normalization in `parseNormalization.js` +
   `analysisNormalization.js` + `derivationCompiler.js`); three deploy
   surfaces sharing it (Express `server/index.js`, Vercel `api/parse.js`,
   Vite dev middleware in `vite.config.ts`); frontend `App.tsx` +
   `components/TreeVisualizer.tsx` (+ `replay/` if plan 008 landed);
   harnesses in `.artifacts/` writing to gitignored `.local-tests/`.
3. **Commands** (only ones that exist and pass when you write this): dev,
   build, start, typecheck, test, fixtures:build, verify:parse-contract,
   verify:all, audit, local:provider-effort.
4. **Landmines** (the section that pays rent):
   - `test/` is **gitignored** — never create tests under `test/`; colocate
     `*.test.mjs` next to sources.
   - Vite builds do NOT typecheck; run `npm run typecheck` (if plan 002
     landed) or `npx tsc --noEmit` before considering anything done.
   - `types.ts` mirrors the wire contract; if a field enters the server
     contract, add it to `types.ts` in the same change.
   - **Never edit `server/babelParser/systemInstruction.js` or
     `server/babelParser/prompts.js` casually**: they are the benchmark
     contract; changes alter model behavior and (post plan 006) change the
     recorded `contractHash`, and require regenerating `fixtures/normalized/`
     as a reviewed diff.
   - The parse ontology is deliberately **open** (free-form relation names,
     ledger content); do not add closed enums to the model-facing contract.
     Finite vocabularies belong on the renderer side
     (see `docs/design/babel-visual-relations-research.md`).
   - `fixtures/normalized/` diffs are contract-behavior changes — review,
     never blind-regenerate (if plan 003 landed).
   - Secrets live in `.env` (gitignored); `.env.example` documents keys; never
     print env values; importing `server/babelParser.js` auto-loads `.env`
     outside production.
   - Provider calls cost real money; `.artifacts/` harnesses are the sanctioned
     way to run them (see `.artifacts/README.md`); prefer `--dry-run` first.
5. **Conventions**: ESM everywhere; factory-injected helpers in
   `server/babelParser/`; error shape
   `{ error: { code, message } }` with `ParseApiError(code, message, status, details)`;
   commit messages are short imperative sentences (see `git log --oneline`).
6. **Where intent lives**: `README.md` (product + benchmark direction),
   `docs/design/babel-visual-relations-research.md` (visual-relations
   architecture decisions), `docs/checkpoints/` (session history),
   `plans/` (this audit's plan set + backlog).

Keep it under ~120 lines; link to files rather than duplicating their content.

**Verify**: every command listed in section 3 actually runs with the
documented result; every file path named exists (`ls` each).

### Step 2: Cross-check against landed plans

Read `plans/README.md` status; adjust tense (e.g. mention `contractHash` only
if plan 006 is DONE, else phrase as "planned — see plans/006").

**Verify**: no statement in AGENTS.md contradicts the plans index.

## Test plan

Not applicable (documentation). The verification is the fact-check in Step 1.

## Done criteria

- [ ] `AGENTS.md` exists at repo root, ≤ ~120 lines
- [ ] Every command it documents exits as described when run
- [ ] Every path it names exists
- [ ] `plans/README.md` status row updated

## STOP conditions

- An `AGENTS.md`/`CLAUDE.md` already exists (drift check).
- A fact from the outline is no longer true and you cannot determine the
  current truth from the repo — report the specific fact.

## Maintenance notes

- Update AGENTS.md whenever a plan changes commands or invariants (plans 002,
  003, 006 in particular). Staleness here is worse than absence — wrong
  instructions get followed by agents verbatim.
