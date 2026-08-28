# Plan 002: Make `tsc --noEmit` pass and add a `typecheck` script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- types.ts visualRelationLinks.ts App.tsx components/TreeVisualizer.tsx tsconfig.json package.json`
> This plan was written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). Re-run
> `npx tsc --noEmit` first; if the error inventory differs wildly from the one
> below (±10 errors is fine; a different *shape* of errors is not), STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW–MED
- **Depends on**: plans/001-fix-missing-ledger-structural-head-import.md
- **Category**: tests / dx
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

The repository has TypeScript and a `tsconfig.json`, but no `typecheck` script,
no CI, and `npx tsc --noEmit` currently fails with ~117 error lines across
`components/TreeVisualizer.tsx` (38), `docs/design/visual-relations-current-lab.tsx`
(37), `visualRelationLinks.ts` (10), and `App.tsx` (4, one fixed by plan 001).
Vite builds strip types without checking them, so none of this blocks deploys —
which is exactly how the plan-001 runtime crash shipped.

Worse, the central `SyntaxNode` type in `types.ts` is missing `silent` and
`tokenIndex` — fields that the **parse contract itself** mandates
(`server/babelParser/systemInstruction.js` requires terminals to carry
`word`/`tokenIndex` and a stage-local `silent` flag) and that
`TreeVisualizer.tsx` reads/writes in dozens of places. The client types lie
about the wire format, so the type system cannot protect the renderer, the
replay compiler, or any future refactor (plans 008, 009, 011 all assume a
green typecheck as their safety net).

## Current state

Error inventory (from `npx tsc --noEmit` on the audited tree), by cause:

1. **`SyntaxNode` missing fields** — `types.ts:1-13` currently reads:

```ts
export interface SyntaxNode {
  label: string;
  children?: SyntaxNode[];
  word?: string;
  surfaceSpan?: [number, number];
  id?: string; // Optional ID for D3 indexing
  aliasIds?: string[];
  lineageId?: string;
  case?: string;
  assigner?: string;
  caseEvidence?: string;
  caseOvertt?: boolean;   // NOTE: verify exact spelling in file; audit read `caseOvert`
}
```

(The audited file has `caseOvert?: boolean;` — confirm when you open it.)

Errors caused: all the `Property 'silent' does not exist on type 'SyntaxNode'`,
`'tokenIndex' does not exist in type 'SyntaxNode'` errors in
`components/TreeVisualizer.tsx` (lines 644, 655, 656, 678, 687, 694, 708, 723,
3786, 3793, 4111, 4119, 4212, 4372, …) and most of the 37 errors in
`docs/design/visual-relations-current-lab.tsx`.

2. **Duplicate interface members** — `visualRelationLinks.ts:22-48` declares
`relationIndex`, `sourceNodeId`, `targetNodeId`, `witnessNodeId`,
`trajectoryKind` twice in `ResolvedVisualRelation` (once at lines 23–33, again
at lines 43–47 under a "compatibility aliases" comment). Ten TS2300 errors.

3. **Unsafe-but-guarded casts** — `App.tsx:330`:

```ts
return Array.isArray((candidate as ParseBundle).analyses) ? candidate as ParseBundle : null;
```

TS2352 twice (the cast from `Record<string, unknown>`). The line already
runtime-guards with `Array.isArray`, so the correct minimal fix is casting via
`unknown`.

4. **`ParseBundle` missing `sentence`** — `App.tsx:1325` reads
`bundle.sentence` when restoring dev/captured bundles; captured artifact
wrappers do carry a sentence. `types.ts:633-640` `ParseBundle` has no
`sentence` field.

5. **Local frame-step object widening** — `components/TreeVisualizer.tsx:409-438`
reads `serializationStatus`, `diagnostics`, `spelloutDomain`, `spelloutOrder`,
`featureChecking`, `microOperations`, `trigger` off a value typed as
`{ stageRecord: string; derivationStageVisualRelations: DerivationStageVisualRelation[]; }`.
The value comes from a looser runtime shape; the local type annotation is too
narrow.

6. **Inference gaps** — `components/TreeVisualizer.tsx:806, 838, 851`:
`Set<unknown>` where `Set<string>` is required, `.children` on `unknown`.

7. **SVG selection typings** — ~17 errors of the form
`Type '{}' is missing ... from type 'SVGGraphicsElement'` (d3 selection generic
defaults).

8. **Replay-plan step kind mismatch** — one error where
`DerivationReplayPlanStep` (from the JSDoc'd `derivationReplayPlan.js`) has
`kind: "relation" | "micro" | "macro"` but a narrower `kind: "relation"` object
type is expected.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm ci`                 | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no output   |
| Error census | `npx tsc --noEmit 2>&1 \| cut -d'(' -f1 \| sort \| uniq -c \| sort -rn` | (during work) shrinking counts |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `types.ts`
- `visualRelationLinks.ts`
- `App.tsx` (only the specific cast/type sites listed above)
- `components/TreeVisualizer.tsx` (only type annotations/casts — ZERO behavior changes)
- `docs/design/visual-relations-current-lab.tsx` (type-only fixes, or exclusion — see Step 6)
- `tsconfig.json` (only if Step 6 chooses exclusion)
- `package.json` (add the `typecheck` script)

**Out of scope** (do NOT touch):
- Any `server/` file — server is plain JS, unaffected.
- `derivationReplayPlan.js` logic — you may only adjust the *type annotation*
  at the consuming site in `TreeVisualizer.tsx`.
- Enabling `"strict": true` in tsconfig — tempting, but it would explode the
  error count; record it as follow-up, don't do it.
- Runtime behavior anywhere. This is a types-only plan. If a fix seems to
  require changing runtime code, STOP.

## Git workflow

- Branch: `codex/babel-cross-platform` (active dev branch).
- One commit per step or one commit for the whole plan; message style: short
  imperative, e.g. `Make typecheck pass and add typecheck script`.
- Do NOT push unless instructed.

## Steps

### Step 1: Extend `SyntaxNode` with contract fields

In `types.ts`, add to `SyntaxNode` (keep existing fields untouched):

```ts
  silent?: boolean;
  tokenIndex?: number;
```

These names come from the parse contract in
`server/babelParser/systemInstruction.js` ("Use \"word\" and \"tokenIndex\" only
on a non-silent terminal…", "set \"silent\": true"). Do not add other fields
unless a remaining tsc error explicitly names them on `SyntaxNode`; if one does
(e.g. `refId`), add it as optional with a one-line comment citing the error.

**Verify**: `npx tsc --noEmit 2>&1 | grep -c "silent.*does not exist\|'silent' does not exist"` → `0`.

### Step 2: Remove the duplicate members in `ResolvedVisualRelation`

In `visualRelationLinks.ts`, delete lines 38–47 (the "Compatibility aliases"
JSDoc comment block **and** the five duplicated members below it):
`relationIndex`, `sourceNodeId`, `targetNodeId`, `witnessNodeId`,
`trajectoryKind` at lines 43–47. The identical members already exist at lines
23–33.

**Verify**: `npx tsc --noEmit 2>&1 | grep -c "visualRelationLinks"` → `0`.

### Step 3: Fix the App.tsx sites

- `App.tsx:330`: change both casts to go through `unknown`:
  `(candidate as unknown as ParseBundle)`.
- `types.ts` `ParseBundle`: add `sentence?: string;` with a comment
  `// present on captured/dev bundle wrappers, not on live /api/parse responses`.

**Verify**: `npx tsc --noEmit 2>&1 | grep -c "App.tsx"` → `0`.

### Step 4: Fix TreeVisualizer type-only errors

Work through the remaining `components/TreeVisualizer.tsx` errors in cause
order (run the error census between fixes):

- Widen the local frame-step type at ~line 409 to include the optional fields
  read there (`serializationStatus?: string; diagnostics?: string[];
  spelloutDomain?: string; spelloutOrder?: string[]; featureChecking?:
  FeatureCheckEvent[]; microOperations?: DerivationStep['operation'][];
  trigger?: string;`) — match the actual property reads at lines 409–438.
- Annotate the `Set` constructions at lines ~806/838 as `new Set<string>(...)`
  and type the tree-walk parameters at ~851 (`(node: SyntaxNode)`).
- For SVG selection errors, prefer explicit d3 generics
  (`d3.select<SVGSVGElement, unknown>(...)`, `selection.select<SVGGElement>(...)`)
  over `as any`. Use `as unknown as X` only where a generic cannot express it;
  never add `@ts-ignore`.
- For the replay-plan `kind` mismatch, widen the consuming annotation to accept
  `DerivationReplayPlanStep['kind']` rather than narrowing the literal.

**Verify**: `npx tsc --noEmit 2>&1 | grep -c "components/TreeVisualizer"` → `0`.

### Step 5: Confirm zero behavior change

**Verify**: `git diff components/TreeVisualizer.tsx App.tsx | grep "^-" | grep -v "^---"`
— read every removed line; each must be re-added in equivalent form with only
type syntax changed. Then `npm run build` → exit 0.

### Step 6: Deal with the design-lab file

Re-run the census. `docs/design/visual-relations-current-lab.tsx` errors should
have dropped substantially after Step 1 (most were `silent`/`tokenIndex`).
Decision rule:

- If ≤ 8 errors remain in that file and they are type-only (annotations, a
  `key` prop on a props type, casts): fix them in place the same way as Step 4.
- If more remain or any would require behavior edits: add
  `"exclude": ["docs", "dist", "node_modules"]` to `tsconfig.json` instead, and
  record in the plan-README status note that the design lab is excluded from
  typechecking (follow-up debt).

**Verify**: `npx tsc --noEmit` → exit 0, no output.

### Step 7: Add the typecheck script

In `package.json` `scripts`, add:

```json
    "typecheck": "tsc --noEmit",
```

**Verify**: `npm run typecheck` → exit 0.

## Test plan

No test runner exists yet (plan 003). The verification is the typecheck itself
plus `npm run build`. After plan 003 lands, `npm run typecheck` becomes part of
`verify:all`; nothing to do here for that.

## Done criteria

- [ ] `npm run typecheck` exits 0 with no output
- [ ] `npm run build` exits 0
- [ ] `git diff` contains no runtime-semantic changes in `App.tsx` /
      `components/TreeVisualizer.tsx` (type annotations, generics, casts only)
- [ ] No `@ts-ignore` or `@ts-expect-error` added anywhere
      (`grep -rn "ts-ignore\|ts-expect-error" *.ts *.tsx components/ | wc -l` → 0)
- [ ] `plans/README.md` status row updated (note the Step 6 decision taken)

## STOP conditions

Stop and report back (do not improvise) if:

- Making an error disappear seems to require changing runtime logic (moving a
  line, changing a condition, renaming a runtime property).
- After Step 1, new errors *appear* in `server/`-adjacent or previously-clean
  files (would mean `allowJs` is now checking JS — it should not with
  `checkJs` absent; investigate = stop).
- The remaining TreeVisualizer errors exceed ~50 after Steps 1–3 (inventory
  drifted; the plan's premises are stale).

## Maintenance notes

- Future contract fields that appear on wire nodes (e.g. features bundles for
  the plan-009 relation families) must be added to `SyntaxNode`/`DerivationStage`
  in `types.ts` at the same time they enter the server contract — this plan
  makes drift visible, plan 012's AGENTS.md should state the rule.
- `"strict": true` (and `noUncheckedIndexedAccess`) remain off; enabling them is
  a good follow-up once plan 008 shrinks TreeVisualizer.
- Reviewer focus: any hunk in Step 4 that touches a line *without* a type
  annotation on it — that's where an accidental behavior change would hide.
