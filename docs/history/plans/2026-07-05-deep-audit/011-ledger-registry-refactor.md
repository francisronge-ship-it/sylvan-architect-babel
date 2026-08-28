# Plan 011: Replace the 28-ledger lockstep pattern with a table-driven registry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- server/babelParser/parseNormalization.js server/babelParser/analysisNormalization.js server/babelParser.js`
> Written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). This refactor is only
> safe with plan 003's fixture snapshots in place — confirm
> `fixtures/normalized/` exists and `npm test` is green before starting.

## Status

- **Status**: SUPERSEDED — the fixed 28-ledger architecture was removed rather than centralized in a registry.
- **Priority**: P3
- **Effort**: L
- **Risk**: MED (mechanical but wide; snapshot-guarded)
- **Depends on**: plans/003-committed-verification-fixtures-and-test-runner.md
  (hard), plans/006-benchmark-provenance-completeness.md (do 006 first —
  it edits the same provenance block; doing 011 first would force 006 to
  re-learn the new structure)
- **Category**: tech-debt
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

Babel normalizes 28 typed linguistic "ledgers" (featureLedger,
caseAssignments, argumentStructure, phaseLog, morphologyRealization,
selectionLedger, bindingLedger, clausalDependencies, agreementLedger,
predicateClassLedger, probeLedger, nullElementLedger, diagnosticLedger,
parameterLedger, informationStructureLedger, operatorScopeLedger,
voiceValencyLedger, linearizationLedger, localityLedger, predicationLedger,
particleLedger, evidentialityLedger, mirativityLedger, honorificityLedger,
switchReferenceLedger, logophoraLedger, eventStructureLedger, plus
commitmentGraph plumbing). Each kind is repeated by name at **seven+ lockstep
sites**:

1. its normalizer in `analysisNormalization.js` (28 near-identical ~25-line
   map/filter functions, ~1,300 lines total),
2. the factory export list (`analysisNormalization.js` return block),
3. the DI wiring in `server/babelParser.js` (lines ~247–289 and ~333–365),
4. `parseNormalization.js` "direct" normalization calls (lines 1567–1693),
5. the projected-vs-direct ternary block (lines 1704–1784),
6. `buildCommitmentGraphFromNormalizedLedgers` argument object (1785–1813),
7. `noteSupportIds` spreads (1823–1852),
   `validateNoteBindingsAgainstStructuredAnalysis` params (1897–1932),
   provenance `hasX` flags (1948–1973), and the returned analysis object
   (1991–2017).

Adding or renaming one ledger kind means ~10 coordinated edits across three
files — the classic missing-abstraction signature. The sites differ **only**
in `{ bundleKey, idField, idPrefix }` triples, which are already spelled out
in the code (e.g. `ensureStructuredEntryIds(..., 'agreementId', 'agreement')`).

Since the derivationStages contract now *projects* ledgers from frame-change
commitment facts (`parseNormalization.js:1694-1703` — top-level ledgers are
legacy-compat input), the set of kinds is expected to keep growing as new
linguistic phenomena get commitment-fact kinds. A registry makes that a
one-line change.

## Current state

Representative excerpt of the repetition (`parseNormalization.js:1704-1712`):

```js
    const featureLedger = useProjectedCommitmentLedgers
      ? ensureStructuredEntryIds(projectedCommitmentLedgers.featureLedger, 'entryId', 'feature')
      : directFeatureLedger;
    const caseAssignments = useProjectedCommitmentLedgers
      ? ensureStructuredEntryIds(projectedCommitmentLedgers.caseAssignments, 'assignmentId', 'case')
      : directCaseAssignments;
```

…and so on for all 28. The `(idField, idPrefix)` pairs for every kind are
readable directly from the `ensureStructuredEntryIds` calls at
`parseNormalization.js:1567-1693` — extract the table from there, not from
this plan (guards against drift).

Two kinds are special — copy their handling exactly:
- `phaseLog` and `morphologyRealization` are NOT wrapped in
  `ensureStructuredEntryIds` on the projected path (lines 1713–1718) and use
  `phaseId` / `realizationId` in `noteSupportIds` (lines 1826–1827).

`normalizeParseResult` is synchronous and returns a flat analysis object whose
ledger keys are part of the public bundle shape — **the output shape must not
change at all** (fixture snapshots enforce this).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests   | `npm test` | pass |
| Fixtures | `npm run fixtures:build && git diff --stat fixtures/` | **empty diff** (the whole point) |
| Contract | `npm run verify:parse-contract` | pass |
| Build   | `npm run build` | exit 0 |

## Scope

**In scope**:
- `server/babelParser/ledgerRegistry.js` (create — the table:
  `[{ key, idField, idPrefix, ensureIds: boolean }]` for all 28 kinds, plus
  small helpers `forEachLedger`, `mapLedgersToObject`)
- `server/babelParser/parseNormalization.js` (drive sites 4–7 from the registry
  with loops; keep variable names OUT of the loop where later code references
  them individually — see Step 2 note)
- `server/babelParser/analysisNormalization.js` (ONLY to export a
  `LEDGER_NORMALIZERS` map keyed by registry key; the 28 normalizer functions'
  bodies stay untouched)
- `server/babelParser.js` (wiring may shrink to passing the normalizer map)
- `server/babelParser/ledgerRegistry.test.mjs` (create)

**Out of scope** (do NOT touch):
- The 28 normalizer function bodies (their field-alias logic is
  linguistics-bearing; consolidating THEM is a possible future step, not this
  one).
- The bundle output shape, provenance flag names, or noteSupportIds contents.
- `semanticValidation.js` internals (its parameter list at the call site may
  be built from the registry object, but the validator's own signature stays).

## Git workflow

- Branch: `codex/babel-cross-platform`.
- Commit per step; messages like `Drive ledger normalization from registry`.
- Do NOT push unless instructed.

## Steps

### Step 1: Build the registry from the code itself

Create `ledgerRegistry.js`. Populate the table by reading the
`ensureStructuredEntryIds(normalizeXLedger(parsed.x, ...), '<idField>', '<idPrefix>')`
calls at `parseNormalization.js:1567-1693` — one entry per kind, in the same
order, with `ensureIds: false` for `phaseLog` and `morphologyRealization`.
Write the registry test first: it asserts 28 entries (adjust to the actual
count you extract — record it), unique keys, unique idPrefixes.

**Verify**: `npm test` → registry test passes.

### Step 2: Convert `parseNormalization.js` site-by-site

Replace the five blocks in this order, running
`npm run fixtures:build && git diff --stat fixtures/` (must stay EMPTY) after
each:

a. direct normalization block (1567–1693) → build a `directLedgers` object via
   loop over the registry (`LEDGER_NORMALIZERS[key](parsed[key], finalNodeIds, rawStepIds)`).
b. projected-vs-direct ternaries (1704–1784) → one loop producing a `ledgers`
   object.
c. `buildCommitmentGraphFromNormalizedLedgers({...})` (1785–1813) → pass
   `ledgers` (its parameter destructuring already matches the keys —
   verify by reading its signature in `analysisNormalization.js` before
   changing the call).
d. `noteSupportIds` (1823–1852) → loop using each entry's `idField`
   (`ledgers[key].map(e => normalizeOptionalStepText(e?.[idField]))`), keeping
   the non-ledger sources (commitmentGraph factIds) as-is.
e. provenance `hasX` flags (1948–1973) and the returned analysis spread
   (1991–2017) → loops that reproduce the EXACT same key names
   (`has${Key[0].toUpperCase()}${Key.slice(1)}` — confirm each generated name
   against the current source; `hasCommitmentGraph`/`hasCommitmentFacts`/
   `hasDerivationStages`/`hasResolvedVisualRelations` are NOT ledger flags and
   stay literal).

Note on (b)-(e): downstream code references some ledgers individually
(e.g. `clausalDependencies` in `validateNoteBindingsAgainstStructuredAnalysis`
call). Keep a destructuring line after the loop
(`const { featureLedger, caseAssignments, ... } = ledgers;`) generated ONCE,
so later references compile unchanged — shrink it only where nothing uses the
name.

**Verify** (after each sub-step): `npm test` green;
`npm run fixtures:build && git diff --stat fixtures/` → empty;
`npm run verify:parse-contract` → pass.

### Step 3: Shrink the DI wiring

In `analysisNormalization.js`, export `LEDGER_NORMALIZERS` (map from registry
key → the existing function). In `server/babelParser.js`, replace the 28-name
import/pass-through pairs with the single map where `parseNormalization`'s
factory accepts it. Keep individually-used non-ledger helpers
(`normalizeChains`, `normalizeCommitmentGraph`, `projectLedgersFromCommitmentGraph`,
`ensureStructuredEntryIds`, etc.) wired as they are.

**Verify**: `npm test` green; fixtures diff empty; `npm run build` exit 0.

### Step 4: Prove the win

Add one entry to the registry in a scratch commit (e.g. a fake
`reduplicationLedger` with a trivial normalizer), confirm the bundle exposes
it end-to-end with zero edits outside the registry+normalizer map, then
**revert that scratch commit**.

**Verify**: `git log --oneline -1` shows the revert; working tree clean of the
scratch kind (`grep -rn "reduplicationLedger" server/ | wc -l` → 0).

## Test plan

- Fixture snapshots are the primary harness: byte-identical bundles before and
  after (the empty-diff gate at every sub-step).
- `ledgerRegistry.test.mjs`: table integrity (count, uniqueness,
  ensureIds flags for the two special kinds).
- Existing suites keep passing.

## Done criteria

- [ ] `npm run fixtures:build` produces zero diff vs. pre-refactor snapshots
- [ ] `wc -l server/babelParser/parseNormalization.js` shrinks by ≥300 lines
- [ ] Adding a ledger kind requires edits in exactly 2 places (registry entry
      + normalizer map) — demonstrated by Step 4
- [ ] `npm test`, `npm run verify:parse-contract`, `npm run build` all green
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any fixture diff appears that you cannot trace to an ordering artifact of
  your loop (object key order changes ARE visible in JSON.stringify — preserve
  the original insertion order via the registry's array order; if a diff
  persists, stop).
- `buildCommitmentGraphFromNormalizedLedgers` or
  `validateNoteBindingsAgainstStructuredAnalysis` turn out to treat some
  ledger specially beyond the two documented exceptions.
- Plan 006 has not landed and its provenance edits would conflict — coordinate
  order rather than merging blind.

## Maintenance notes

- Future ledger kinds: add a registry row + a normalizer in the map. If a
  third "special" flag shows up (like the ensureIds exceptions), extend the
  registry schema rather than branching in the loops.
- The 28 normalizer bodies remain duplicated internally (~25 lines each with
  per-field alias lists); a second-stage consolidation into a declarative
  field-spec format is possible but touches linguistics-bearing alias choices
  — leave to a maintainer-reviewed pass.
- Reviewer focus: JSON key order in the returned analysis object (fixture diff
  catches it, but review the loop order anyway).
