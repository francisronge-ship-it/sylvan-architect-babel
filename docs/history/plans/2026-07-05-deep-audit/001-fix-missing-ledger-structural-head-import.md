# Plan 001: Fix the missing `humanizeLedgerStructuralHead` import in App.tsx

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- App.tsx replayLedgerDisplay.js`
> This plan was written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). The excerpts below are from
> the working tree, not HEAD. If the excerpts in "Current state" no longer match
> the live files, treat it as a STOP condition.

## Status

- **Status**: SUPERSEDED — the legacy ledger resolver and display-helper path were removed, so the missing import is no longer a live fix.
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

`App.tsx` line 745 calls `humanizeLedgerStructuralHead(raw)`, but that function
is never imported into `App.tsx`. The function exists and is exported from
`replayLedgerDisplay.js:62`. Because Vite strips types without typechecking,
this compiles and deploys fine — but at runtime, when that line executes, the
browser throws `ReferenceError: humanizeLedgerStructuralHead is not defined`,
which crashes the React render (the app has no error boundary, so the user gets
a blank screen).

The code path is reachable with real data: `resolveStructuralRef` runs while
rendering replay ledger attachments, and the crashing branch fires whenever a
structural ledger reference (e.g. a case assigner id like `t_past` from a
model-authored payload) does **not** resolve to a node in the final committed
tree but **does** yield a lexical hint from its id shape. Open-ontology
payloads from GPT/Claude routes make dangling ledger references realistic.

`npx tsc --noEmit` already reports this as
`App.tsx(745,22): error TS2304: Cannot find name 'humanizeLedgerStructuralHead'.`

## Current state

- `App.tsx` — the app shell; contains the ledger reference resolvers
  (`buildReadableNodeResolvers`, lines ~672–787).
- `replayLedgerDisplay.js` — display helpers for ledger ids; exports both
  functions involved.

Import block as it exists today (`App.tsx:6-10`):

```ts
import {
  stringifyLedgerAtom,
  normalizeLedgerDisplay,
  humanizeLedgerFallbackId
} from './replayLedgerDisplay';
```

Call site (`App.tsx:738-748`):

```ts
  const resolveStructuralRef = (reference?: string): string => {
    const raw = stringifyLedgerAtom(reference);
    if (!raw) return '';
    const node = getNodeByReference(raw);
    if (!node) {
      const lexicalHint = lexicalHintFromId(raw);
      if (lexicalHint) {
        const head = humanizeLedgerStructuralHead(raw);
        return head ? `${head} (${lexicalHint})` : lexicalHint;
      }
      return humanizeLedgerFallbackId(normalizeLedgerDisplay(raw, { preferInner: false }));
    }
```

Exporter (`replayLedgerDisplay.js:62`):

```js
export const humanizeLedgerStructuralHead = (value) => {
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm ci`                 | exit 0              |
| Typecheck (targeted) | `npx tsc --noEmit 2>&1 \| grep "App.tsx(745"` | no output |
| Build     | `npm run build`          | exit 0, `✓ built`   |

Note: `npx tsc --noEmit` as a whole currently FAILS with ~80 pre-existing
errors (see plan 002). Do not try to fix those here. Only verify that the
`App.tsx(745...)` error disappears.

## Scope

**In scope** (the only file you should modify):
- `App.tsx` (the import block at lines 6–10 only)

**Out of scope** (do NOT touch):
- `replayLedgerDisplay.js` — the export already exists and is correct.
- Any other type error reported by tsc — those belong to plan 002.
- The logic of `resolveStructuralRef` — do not "improve" it.

## Git workflow

- Branch: work directly on `codex/babel-cross-platform` (the active development
  branch per `docs/design/mac-new-device-pickup-2026-06-05.md`) unless the
  operator says otherwise.
- Commit message style: short imperative sentence, e.g. `Fix missing ledger structural head import`
  (matches history like `Clarify GPT label mismatch devlog note`).
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Add the missing import

In `App.tsx`, change the import block at lines 6–10 to:

```ts
import {
  stringifyLedgerAtom,
  normalizeLedgerDisplay,
  humanizeLedgerFallbackId,
  humanizeLedgerStructuralHead
} from './replayLedgerDisplay';
```

**Verify**: `npx tsc --noEmit 2>&1 | grep "App.tsx(745"` → no output (exit code
of grep will be 1 because nothing matched — that is success here).

### Step 2: Confirm the build still passes

**Verify**: `npm run build` → exits 0, prints `✓ built in ...`.

### Step 3: Confirm no other file changed

**Verify**: `git status --porcelain` → shows `App.tsx` modified (plus any files
that were already dirty before you started — compare against the pre-existing
dirty list in `plans/README.md`). No new modified files beyond `App.tsx`.

## Test plan

There is no committed test runner yet (plan 003 introduces one). For this
one-line fix, the machine verification above (targeted tsc error gone, build
green) is sufficient. If plan 003 has already landed when you execute this,
additionally run `npm run verify:fixtures` and confirm it still passes.

## Done criteria

- [ ] `npx tsc --noEmit 2>&1 | grep -c "App.tsx(745"` prints `0`
- [ ] `npm run build` exits 0
- [ ] `git diff App.tsx` shows exactly one changed hunk (the import block)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `App.tsx:745` no longer references `humanizeLedgerStructuralHead` (someone
  already fixed or removed it).
- `replayLedgerDisplay.js` no longer exports `humanizeLedgerStructuralHead`.
- Adding the import surfaces a *new* tsc error mentioning
  `humanizeLedgerStructuralHead` (signature drift).

## Maintenance notes

- Root cause class: Vite builds do not typecheck, so missing imports ship.
  Plan 002 makes `tsc --noEmit` green and adds a `typecheck` script; plan 003
  wires it into a verify-all gate. Reviewers should treat any future
  `TS2304 Cannot find name` in this repo as a shipped runtime crash, not noise.
- An error boundary around the replay/notes views would degrade this class of
  failure from blank-screen to a recoverable message; recorded as backlog in
  `plans/README.md`, not part of this plan.
