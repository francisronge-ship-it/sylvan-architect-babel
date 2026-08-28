# Plan 003: Commit offline parse fixtures, wire verify scripts to them, add a node:test runner

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- scripts/verifyParseContract.mjs server/babelParser.js package.json .gitignore`
> This plan was written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). If
> `scripts/verifyParseContract.mjs` no longer has the `DEFAULT_INPUTS` shown
> below, or `server/babelParser.js` no longer exports `__test__`, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-make-typecheck-pass-and-add-script.md (for the `typecheck` script referenced in `verify:all`; you may execute this plan first and leave `typecheck` out of `verify:all` until 002 lands — record which you did)
- **Category**: tests
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

On a fresh clone, this repository has **no working verification command**:

- `npm run verify:parse-contract` crashes with ENOENT: its default input is
  `.local-tests/fresh-claude-parse-2026-05-18/response.json`
  (`scripts/verifyParseContract.mjs:4-6`), and `.local-tests/` is gitignored
  and machine-local.
- `npm run verify:replay` reports only "missing render-summary.json" for six
  `test-results/provider-route-audit-2026-05-12/...` directories
  (`scripts/verifyReplayRegression.mjs:5-12`) that are likewise gitignored and
  absent.
- The directory `test/` is **globally gitignored** (`.gitignore` line `test/`),
  so the historical test suite (`test/geminiParser.consistency.test.mjs`,
  visible in git churn) was exiled from the repo. Zero committed tests exist.
- There is no CI.

Meanwhile the server exposes a purpose-built offline test surface:
`server/babelParser.js:400-433` exports `__test__` with
`normalizeParseBundle`, `tokenizeSentenceSurfaceOrder`, and ~40 other
functions — nothing committed consumes it.

This plan creates committed, deterministic fixtures that exercise the **real**
normalization pipeline offline (no API keys, no network), points
`verify:parse-contract` at them, and introduces `node --test` (built into the
repo's Node 24, zero new dependencies) so later plans (007, 008, 011) can ship
tests. This is the prerequisite for every risky refactor in this plan set.

**Feasibility was verified during the audit**: the exact fixture payload in
Step 1 below was run through the real
`__test__.normalizeParseBundle(payload, 'xbar', 'Mia laughed.', 'gemini', true, {...})`
on 2026-07-05 and produced: 1 analysis, `rootLabel: "TP"`,
`surfaceOrder: ["Mia","laughed"]`, 4 noteBindings, 4 derivationStages,
integrity flag `derivation_stages_compiled_to_derivation_frames`.

## Current state

- `scripts/verifyParseContract.mjs` — offline contract checker (stage fields,
  visualRelations anchor resolution). Lines 4–6:

```js
const DEFAULT_INPUTS = [
  '.local-tests/fresh-claude-parse-2026-05-18/response.json'
];
```

- `server/babelParser.js:400` — `export const __test__ = { normalizeParseBundle, ... }`.
- `package.json` scripts today: `dev`, `build`, `preview`, `start`,
  `local:provider-effort`, `verify:replay`, `verify:parse-contract`, `audit`.
- `.gitignore` contains the line `test/` (do not fight it; place tests
  elsewhere as specified below) and `.local-tests/`, `test-results/`.
- Repo convention: ESM everywhere (`"type": "module"`), scripts in `scripts/`
  as `.mjs`.
- IMPORTANT environment note: importing `server/babelParser.js` triggers
  `server/babelParser/routeConfig.js`'s `loadLocalEnv()`, which reads `.env` /
  `.env.local` into `process.env` when `NODE_ENV !== 'production'`. It does not
  need any key to be present — normalization is pure. Never print
  `process.env` in fixture tooling.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `npm ci`                         | exit 0              |
| Build fixtures | `node scripts/buildParseFixtures.mjs` | writes `fixtures/normalized/*.json`, exit 0 |
| Contract check | `npm run verify:parse-contract` | "Parse contract verification passed." for each fixture |
| Unit tests | `npm test`                      | all pass            |
| Typecheck (if 002 landed) | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `fixtures/raw/*.json` (create — hand-authored model-shaped payloads)
- `fixtures/normalized/*.json` (create — generated snapshots, committed)
- `fixtures/README.md` (create)
- `scripts/buildParseFixtures.mjs` (create)
- `scripts/verifyParseContract.mjs` (change `DEFAULT_INPUTS` only)
- `server/babelParser/normalizeParseBundle.test.mjs` (create)
- `package.json` (add `test`, `fixtures:build`, `verify:all` scripts)

**Out of scope** (do NOT touch):
- `scripts/verifyReplayRegression.mjs` — it validates Playwright render
  captures that cannot be produced offline; making replay regression offline
  is plan 008's outcome. Leave it exactly as is.
- Any file under `server/babelParser/` other than the new `.test.mjs` file.
- `.gitignore` — `fixtures/` is not ignored by any existing pattern; verify
  with `git check-ignore -v fixtures/raw/mia-laughed.xbar.json || echo OK`
  (expect OK). If a pattern DOES ignore it, STOP (do not edit .gitignore
  without reporting).

## Git workflow

- Branch: `codex/babel-cross-platform`.
- Suggested commits: one for fixtures+builder, one for verify wiring, one for
  the test runner. Message style: short imperative (`Add committed parse fixtures`).
- Do NOT push unless instructed.

## Steps

### Step 1: Create the first raw fixture

Create `fixtures/raw/mia-laughed.xbar.json` with **exactly** this content
(verified against the real normalizer during the audit):

```json
{
  "sentence": "Mia laughed.",
  "framework": "xbar",
  "modelRoute": "gemini",
  "payload": {
    "derivationStages": [
      {
        "statement": "The noun Mia enters the derivation.",
        "stageRecord": "Lexical selection introduces the proper noun Mia, which projects a noun phrase that will serve as the external argument of the predicate.",
        "visualRelations": [],
        "workspaceForest": [
          {
            "id": "np_mia",
            "label": "NP",
            "children": [
              { "id": "n_mia", "label": "N", "children": [ { "id": "leaf_mia", "label": "Mia", "word": "Mia", "tokenIndex": 0, "children": [] } ] }
            ]
          }
        ]
      },
      {
        "statement": "The intransitive verb laughed projects a verb phrase.",
        "stageRecord": "The unergative verb laughed is selected and projects a verb phrase; its single theta role is assigned to the external argument position, which the noun phrase Mia will occupy.",
        "visualRelations": [],
        "workspaceForest": [
          { "refId": "np_mia" },
          {
            "id": "vp_laughed",
            "label": "VP",
            "children": [
              { "id": "vbar_laughed", "label": "V'", "children": [ { "id": "v_laughed", "label": "V", "children": [ { "id": "leaf_laughed", "label": "laughed", "word": "laughed", "tokenIndex": 1, "children": [] } ] } ] }
            ]
          }
        ]
      },
      {
        "statement": "Tense combines with the verb phrase.",
        "stageRecord": "A finite past tense head selects the verb phrase as its complement, projecting the inflectional layer that licenses the subject position of the clause.",
        "visualRelations": [],
        "workspaceForest": [
          { "refId": "np_mia" },
          {
            "id": "tbar_1",
            "label": "T'",
            "children": [
              { "id": "t_past", "label": "T", "children": [ { "id": "leaf_t", "label": "∅", "children": [] } ] },
              { "refId": "vp_laughed" }
            ]
          }
        ]
      },
      {
        "statement": "The subject occupies the specifier of TP and the clause converges.",
        "stageRecord": "The noun phrase Mia merges as the specifier of the tense projection, satisfying the clause-level subject requirement; the derivation converges with the surface order Mia laughed.",
        "visualRelations": [],
        "workspaceForest": [
          {
            "id": "tp_root",
            "label": "TP",
            "children": [ { "refId": "np_mia" }, { "refId": "tbar_1" } ]
          }
        ]
      }
    ]
  }
}
```

**Verify**: `node -e "JSON.parse(require('node:fs').readFileSync('fixtures/raw/mia-laughed.xbar.json','utf8')); console.log('valid json')"` → `valid json`.

### Step 2: Create the fixture builder

Create `scripts/buildParseFixtures.mjs`:

- Reads every `fixtures/raw/*.json` file (shape: `{ sentence, framework,
  modelRoute, payload }`).
- Imports `{ __test__ } from '../server/babelParser.js'` and calls
  `__test__.normalizeParseBundle(payload, framework, sentence, modelRoute, true, { payloadIntegrityFlags: [] })`.
- **Strips nondeterminism before writing**: delete
  `analysis.provenance.timestamp` from every analysis (it is
  `new Date().toISOString()` — see `server/babelParser/parseNormalization.js:1936`).
  Write the result with `JSON.stringify(bundle, null, 2) + '\n'` to
  `fixtures/normalized/<basename>.json`.
- Exits nonzero with the error message if any fixture fails normalization.

Model the file layout and arg handling on `scripts/verifyParseContract.mjs`
(same header style, `node:fs`/`node:path` imports, no external deps).

**Verify**: `node scripts/buildParseFixtures.mjs` → prints the written path(s),
exit 0. Then run it twice and diff:
`node scripts/buildParseFixtures.mjs && git diff --stat fixtures/normalized/` →
no changes on the second run (deterministic). If the second run produces a
diff, find the remaining nondeterministic field (search the diff), strip it in
the builder the same way as `timestamp`, and note it in `fixtures/README.md`.

### Step 3: Add a second fixture with movement (recommended, but bounded)

Author `fixtures/raw/what-did-mia-see.xbar.json` for "What did Mia see?" with a
wh-movement derivation: base-generate the object `what` inside VP with
`tokenIndex 0`... **CAUTION**: token indexes must reflect the *final surface
order* (`0:What | 1:did | 2:Mia | 3:see`), and earlier stages may introduce the
object without `word`/`tokenIndex` (the contract allows abstract earlier
occurrences), with the final stage pronouncing `What` at index 0 and carrying a
silent lower occurrence linked by `lineageId`, plus one `visualRelations` entry
whose anchors reference node ids present in that same stage's expanded
workspace.

Iterate with `node scripts/buildParseFixtures.mjs` until it normalizes.
**Bound: if it still fails after 5 authoring attempts, drop this fixture,
keep only Step 1's, and record in `fixtures/README.md` that a movement fixture
is wanted (blocked on hand-authoring difficulty).** The single simple fixture
is already enough for the plan's purpose.

**Verify**: `node scripts/buildParseFixtures.mjs` → exit 0.

### Step 4: Point verify:parse-contract at committed fixtures

In `scripts/verifyParseContract.mjs`, replace lines 4–6:

```js
const DEFAULT_INPUTS = [
  '.local-tests/fresh-claude-parse-2026-05-18/response.json'
];
```

with a glob of the committed normalized fixtures:

```js
import { globSync } from 'node:fs';   // Node 24 supports fs.globSync
const DEFAULT_INPUTS = globSync('fixtures/normalized/*.json').sort();
```

(If `globSync` is unavailable in the installed Node, use
`fs.readdirSync('fixtures/normalized').filter(f => f.endsWith('.json')).map(f => 'fixtures/normalized/' + f).sort()`.)
Keep the CLI-args override behavior (`process.argv.slice(2)`) untouched so
researchers can still point it at local captures.

**Verify**: `npm run verify:parse-contract` → prints each fixture path and
`Parse contract verification passed.`; exit 0. (A `warning: only N derivationStages`
line for a small fixture is acceptable; `error:` lines are not.)

### Step 5: Add the node:test suite

Create `server/babelParser/normalizeParseBundle.test.mjs` (colocated file —
the gitignore ignores `test/` **directories**, not `*.test.mjs` files; confirm
with `git check-ignore -v server/babelParser/normalizeParseBundle.test.mjs || echo OK`):

- Use `import { test } from 'node:test';` and `import assert from 'node:assert/strict';`
- Test 1: for each `fixtures/raw/*.json`, `normalizeParseBundle` succeeds and
  deep-equals the committed `fixtures/normalized/*.json` after deleting
  `provenance.timestamp` from the fresh result (same stripping as the builder).
- Test 2: `normalizeParseBundle({}, 'xbar', 'Mia laughed.', 'gemini', true, {})`
  throws (assert it throws; match message containing `derivationStages` or
  code `BAD_MODEL_RESPONSE` via `error.code`).
- Test 3: `__test__.tokenizeSentenceSurfaceOrder('Mia laughed.')` deep-equals
  `['Mia','laughed']`.

Add to `package.json` scripts:

```json
    "test": "node --test",
    "fixtures:build": "node scripts/buildParseFixtures.mjs",
    "verify:all": "npm run typecheck && npm test && npm run verify:parse-contract"
```

(If plan 002 has not landed, use `"verify:all": "npm test && npm run verify:parse-contract"` and note it in the README status row.)

**Verify**: `npm test` → all tests pass, includes at least 3 tests. Then
`npm run verify:all` → exit 0.

### Step 6: Write fixtures/README.md

Document: what raw fixtures are (hand-authored model-shaped payloads following
`server/babelParser/systemInstruction.js`), how normalized snapshots are
produced (`npm run fixtures:build`), the determinism rule (strip
`provenance.timestamp`; list any other stripped fields), and the update
protocol: **a diff in `fixtures/normalized/` is a contract-behavior change and
must be reviewed as such, never regenerated blindly.**

**Verify**: file exists; `npm run verify:all` still green.

## Test plan

The plan *is* the test plan: Step 5's suite is the repo's first committed test
suite. Cases covered: fixture round-trip (happy path), empty-payload rejection
(error path), tokenizer sanity. Pattern for future tests: this file.

## Done criteria

- [ ] Fresh-clone simulation: `git stash -u && npm ci && npm run verify:parse-contract && npm test && git stash pop` all green
      (run only if your working tree state allows a safe stash; otherwise verify the three commands directly)
- [ ] `npm run verify:all` exits 0
- [ ] `fixtures/raw/` and `fixtures/normalized/` are tracked
      (`git ls-files fixtures/ | wc -l` ≥ 3)
- [ ] Running `npm run fixtures:build` twice produces no git diff
- [ ] `plans/README.md` status row updated (note Step 3 outcome and 002-dependency choice)

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 fixture — verbatim — fails normalization (the normalizer changed
  since 2026-07-05; the audit's ground truth is stale).
- `git check-ignore` shows `fixtures/` or the colocated `.test.mjs` file is
  ignored by an existing pattern.
- Importing `server/babelParser.js` in the builder/test throws at import time
  (routeConfig env validation — e.g. an invalid `GEMINI_THINKING_LEVEL` in the
  local `.env`; report, don't edit `.env`).
- Step 3 exceeds its 5-attempt bound (drop the fixture per instructions — that
  is NOT a stop, just record it — but STOP if even the simple fixture breaks).

## Maintenance notes

- Plans 007, 008, 011 assume `npm test` (node:test) exists and that fixture
  snapshots in `fixtures/normalized/` are the characterization baseline for
  normalizer changes — regenerating them is a reviewed act.
- When the parse contract changes (systemInstruction.js), fixtures may
  legitimately need regeneration; the plan-006 contract hash will make such
  changes visible in provenance.
- Future work (recorded, not in scope): a captured live-model fixture per
  provider (gemini/gpt/claude raw outputs) committed under `fixtures/raw/` to
  test provider-shape tolerance beyond hand-authored payloads.
