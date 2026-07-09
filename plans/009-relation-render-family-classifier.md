# Plan 009: Classify open visualRelations into finite render families (design-doc increment 1)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- server/babelParser/parseNormalization.js types.ts visualRelationLinks.ts docs/design/babel-visual-relations-research.md`
> Written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). Read the design doc
> section quoted below before starting; it is the decided architecture.

## Status

- **Status**: DEFERRED — the open-ontology renderer direction remains valid, but it is outside the legacy parser cleanup.
- **Priority**: P2
- **Effort**: M (server classifier + tests; renderer families are follow-ups)
- **Risk**: MED (benchmark-neutrality constraints — read "Hard constraints")
- **Depends on**: plans/003-committed-verification-fixtures-and-test-runner.md;
  plans/006-benchmark-provenance-completeness.md recommended first (fixture
  churn); renderer follow-ups depend on plans/008.
- **Category**: direction
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

Babel's core design tension is decided and documented: the parse contract
keeps an **open** linguistic ontology (models author free-form `relation`
names with free-form anchor roles), while the renderer may classify those open
names into **finite visual families**. The design doc
(`docs/design/babel-visual-relations-research.md`, "Babel Implementation
Bridge", currently being extended in the dirty tree) states:

> The sources do not become a closed ontology. They become a renderer grammar.
> 1. The parser keeps writing open `visualRelations`. …
> 3. A relation compiler reads anchor topology and stage context.
> 4. The compiler emits a finite `relationRenderPlan`. …
> ### What We Should Build First
> 1. `resolveVisualRelations`: preserve open relation names but infer render
>    family from anchors and stage context.

Current reality: the resolver exists
(`parseNormalization.js:923-991`, `buildResolvedVisualRelationsFromDerivationFrames`)
but classifies everything as exactly two families:

```js
          renderFamily: hasTrajectoryShape ? 'trajectory' : 'unknown',
```

(line 983). Every non-movement relation a model authors — Agree, binding,
phase/domain, ellipsis, coindexation, scope — resolves its anchors and then
renders **nothing**. The ten-family vocabulary already exists in
`visualRelationLinks.ts:1-12`; the lab harness
(`docs/design/visual-relations-current-lab.tsx`, untracked) already sketches
role vocabularies for those families. The classifier is the missing bridge,
and it is server-side, testable, and contract-neutral.

This plan builds the classifier and exposes its verdicts in
`resolvedVisualRelations`. It does NOT change what models are asked to
produce, and it does NOT render the new families (renderer increments come
after plan 008).

## Hard constraints (benchmark neutrality — violating these is a failed plan)

1. **No contract change.** `systemInstruction.js` and `prompts.js` must not
   change. Models must not be told about render families. No `visualIntent`
   or family field is ever requested from or attributed to the model.
2. **The model's authored `relation` string is preserved verbatim** in
   `resolvedVisualRelations[].relation` (already true — keep it true).
3. **Classification is renderer-side metadata**, clearly marked as
   Babel-inferred: the new fields live beside `renderFamily` on the resolved
   record, never inside `derivationStages`.
4. **`unknown` is a legitimate verdict**, not a failure. A relation the
   classifier cannot confidently place stays `unknown` and renders nothing —
   exactly today's behavior.

## Current state

- `types.ts:128-131` defines `VisualRelationRenderFamily` as
  `'trajectory' | 'unknown' | OpenOntologyLabel` — **conflicting** with
  `visualRelationLinks.ts:1-12`, which defines the ten-family closed union
  (`trajectory | identity | dependency | feature | domain | silence | sharing |
  morphology | linearization | scope | unknown`). Two competing definitions of
  the same concept; this plan consolidates on the ten-family union.
- `parseNormalization.js:923-991` — the resolver. Inputs per relation: the
  open `relation` string, resolved `anchors` (array of
  `{ role, nodeId?, value?, label?, resolved, visibleInStage }` — see
  `types.ts:133-141`), the stage's frame (node index available via
  `buildFrameNodeById(frame)`), and `evidence` (stageRecord text).
- Existing role-matching machinery to reuse (do not reinvent):
  `VISUAL_RELATION_TRAJECTORY_SOURCE_ROLES` /
  `..._TARGET_ROLES` / `..._WITNESS_ROLES` and
  `isTrajectorySourceAnchorRole` / `isTrajectoryTargetAnchorRole` — defined
  above the resolver in the same file (grep for them).
- The renderer currently consumes only `renderFamily === 'trajectory'`
  relations (TreeVisualizer arrow pipeline); everything else is inert data.
  That stays true after this plan.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `npm test`               | all pass            |
| Fixtures  | `npm run fixtures:build` | deterministic snapshots |
| Contract  | `npm run verify:parse-contract` | pass         |
| Typecheck | `npm run typecheck`      | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `server/babelParser/relationFamilies.js` (create — the classifier, pure)
- `server/babelParser/parseNormalization.js` (resolver calls the classifier;
  ~10 lines changed at 974–987)
- `types.ts` (consolidate `VisualRelationRenderFamily` to the ten-family union)
- `visualRelationLinks.ts` (keep as the canonical union; re-export or align)
- `server/babelParser/relationFamilies.test.mjs` (create)
- `fixtures/raw/*.json` (add 1–2 fixtures exercising non-trajectory relations)
- `fixtures/normalized/*.json` (regenerate)

**Out of scope** (do NOT touch):
- `systemInstruction.js`, `prompts.js` (Hard constraint 1).
- `components/TreeVisualizer.tsx` rendering of new families — follow-up after
  plan 008 (record as backlog: start with `domain` regions and `identity`
  linking per the design doc's starter list).
- `derivationStages` payload shape.
- The Three.js overlay (`ThreeRelationOverlay` in the design doc) — later
  increment; three.js is not even a dependency yet.

## Git workflow

- Branch: `codex/babel-cross-platform`.
- Commits: classifier+tests; resolver wiring; type consolidation; fixtures.
- Do NOT push unless instructed.

## Steps

### Step 1: Build the pure classifier

Create `server/babelParser/relationFamilies.js` exporting
`classifyRelationRenderFamily({ relation, anchors, frameNodeById })` returning
`{ renderFamily, familyConfidence: 'name' | 'topology' | 'none' }`.

Classification order (first match wins), all matching on
`relation.toLowerCase()` with word-ish boundaries (use one shared
`hasNameCue(relation, cues)` helper that tests each cue as a substring on a
lowercased, punctuation-normalized copy):

1. `trajectory` — reuse the EXISTING `relationHasTrajectoryShape` outcome
   passed in by the caller (do not re-derive movement semantics); name cues
   only as fallback: `move`, `raising`, `fronting`, `inversion`, `extraposition`,
   `topicalization`, `wh-`, `head movement`, `lowering`.
2. `identity` — cues: `coindex`, `co-index`, `copy`, `chain`, `trace`,
   `reconstruction`, `same referent`, `coreference` when the anchors are ≥2
   node-resolved anchors; topology cue: ≥2 anchors whose nodes share a
   `lineageId` (look nodes up in `frameNodeById`, read `.lineageId`).
3. `dependency` — cues: `binding`, `bind`, `control`, `anaphor`, `antecedent`,
   `pro`, `licens`, `c-command`, `government`.
4. `feature` — cues: `agree`, `agreement`, `phi`, `feature`, `valuation`,
   `probe`, `goal`, `case assignment`, `checking`.
5. `domain` — cues: `phase`, `island`, `domain`, `spell-out domain`,
   `binding domain`, `locality`; topology cue: exactly one anchor whose node
   has children (a subtree region).
6. `silence` — cues: `ellipsis`, `deletion`, `elide`, `null`, `silent`, `gap`,
   `pf-deletion`, `unpronounced`.
7. `sharing` — cues: `multidominance`, `shared`, `across-the-board`, `atb`,
   `right node raising`.
8. `morphology` — cues: `affix`, `morpholog`, `head adjunction`, `m-merger`,
   `cliticiz`.
9. `linearization` — cues: `linear`, `spellout order`, `spell-out order`,
   `word order`, `pf order`.
10. `scope` — cues: `scope`, `qr`, `quantifier raising`, `lf`, `operator`,
    `variable binding` (note: check `variable binding` BEFORE rule 3's `bind`
    would catch it — implement scope's multiword cues at higher priority than
    single-word `bind`; simplest: run multiword cues across all families
    first, then single-word cues).
11. else `unknown`, `familyConfidence: 'none'`.

Keep the cue lists as exported const arrays (`FAMILY_NAME_CUES`) so tests and
future tuning touch data, not logic. ~150 lines total. No imports from other
babelParser modules (pure; `frameNodeById` is passed in).

**Verify**: `node --check server/babelParser/relationFamilies.js` → exit 0.

### Step 2: Wire into the resolver

In `parseNormalization.js`'s `buildResolvedVisualRelationsFromDerivationFrames`
(lines 923–991): import the classifier at top of file (static import — this
file is not factory-gated for static consts), and replace line 983:

```js
          renderFamily: hasTrajectoryShape ? 'trajectory' : 'unknown',
```

with:

```js
          renderFamily: hasTrajectoryShape
            ? 'trajectory'
            : classifyRelationRenderFamily({ relation, anchors, frameNodeById }).renderFamily,
          familyConfidence: hasTrajectoryShape
            ? 'topology'
            : classifyRelationRenderFamily({ relation, anchors, frameNodeById }).familyConfidence,
```

(Call once into a local, not twice — write it as a `const familyVerdict = ...`
above the push.) Preserve `renderable`/`renderStatus` semantics EXACTLY:
`renderable` remains trajectory-only until renderer support exists.

**Verify**: `npm test` passes; `npm run fixtures:build` then
`git diff fixtures/normalized/` shows only `renderFamily`/`familyConfidence`
value changes on non-trajectory relations (the mia-laughed fixture has none —
expect its diff empty until Step 4 adds fixtures).

### Step 3: Consolidate the type

In `types.ts`, replace the `VisualRelationRenderFamily` definition (lines
~128–131: `'trajectory' | 'unknown' | OpenOntologyLabel`) with an import/re-export
of the ten-family union from `visualRelationLinks.ts`, and add
`familyConfidence?: 'name' | 'topology' | 'none';` to
`ResolvedVisualRelationRecord`. Fix any typecheck fallout in consuming files
**by widening annotations only**.

**Verify**: `npm run typecheck` → exit 0; `npm run build` → exit 0.

### Step 4: Fixtures for non-trajectory families

Add `fixtures/raw/agreement-relation.xbar.json`: copy the mia-laughed fixture
and, in the final stage, add one visualRelation:

```json
{ "relation": "subject-verb agreement", "anchors": { "probe": "t_past", "goal": "np_mia" } }
```

with a stageRecord sentence mentioning the agreement relation (the contract
requires visualRelations to be grounded in stageRecord — extend the final
stageRecord with: "The finite tense head agrees with the noun phrase Mia in
person and number."). Run `npm run fixtures:build`; the normalized snapshot
must show that relation with `renderFamily: "feature"`,
`familyConfidence: "name"`, `renderable: false`.

If normalization rejects the payload, adjust only the fixture (anchors must
name node ids present in that stage's expanded workspace — `t_past` and
`np_mia` are; if the normalizer renames ids, read the error and use the ids
from the previous snapshot). Bound: 5 attempts, then STOP.

**Verify**: `npm run verify:parse-contract` passes;
`grep '"renderFamily": "feature"' fixtures/normalized/agreement-relation.xbar.json` → 1 hit.

### Step 5: Classifier unit tests

`server/babelParser/relationFamilies.test.mjs` (node:test): table-driven —
at minimum 2 relation names per family (from the cue lists) plus:
`"Agree (φ-features)"` → `feature`; `"quantifier raising to take scope"` →
`scope` (NOT `dependency`); `"binding of the reflexive by the subject"` →
`dependency`; an arbitrary novel name (`"prosodic phrasing seam"`) → `unknown`
with `familyConfidence: 'none'`; lineage-topology identity case (two anchors,
shared `lineageId`, no name cue) → `identity` with
`familyConfidence: 'topology'`.

**Verify**: `npm test` → all pass.

## Test plan

Steps 4–5. The classifier is pure and table-driven; the fixture proves
end-to-end delivery through the real normalizer into artifacts.

## Done criteria

- [ ] `grep -n "renderFamily: hasTrajectoryShape ? 'trajectory' : 'unknown'" server/babelParser/parseNormalization.js` → no match
- [ ] Ten-family union is the single `VisualRelationRenderFamily` definition
      (`grep -rn "OpenOntologyLabel" types.ts | grep -i renderfamily` → no match)
- [ ] Model-authored `relation` strings still appear verbatim in resolved
      records (fixture diff shows no relation-string changes)
- [ ] `systemInstruction.js` and `prompts.js` untouched (`git diff --stat` clean for both)
- [ ] `npm test`, `npm run typecheck`, `npm run verify:parse-contract`,
      `npm run build` all green
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Satisfying a step seems to require touching `systemInstruction.js`,
  `prompts.js`, or the `derivationStages` shape (neutrality violation).
- The resolver at `parseNormalization.js:923-991` has been moved/rewritten
  (dirty-tree work may land here) — re-locate by function name; if its input
  shape changed, report before adapting.
- Step 4 exceeds its 5-attempt bound.

## Maintenance notes

- Renderer increments (backlog order per design doc): `domain` translucent
  regions → `identity` lineage links → `feature` anchored bundles; each gated
  behind the relation-lens behavior in the design doc ("Relation Lens Rule" —
  Canopy stays clean; replay shows the active relation). Do these after plan
  008 so the code lands in `replay/`/renderer modules, not the 10k-line file.
- The cue tables WILL need tuning against real provider outputs; the
  provenance from plan 006 plus `familyConfidence` lets researchers measure
  classifier coverage (% unknown per provider) before trusting it.
- Keep `renderable` meaning "the current renderer will draw this" — do not
  flip it to true for families the renderer cannot draw yet; the app draws
  from it.
