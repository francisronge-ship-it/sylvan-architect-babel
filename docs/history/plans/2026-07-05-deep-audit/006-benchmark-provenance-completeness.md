# Plan 006: Make parse provenance benchmark-grade (timing, effort, generation config, contract hash, validation outcomes)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8997d92..HEAD -- server/babelParser/parseRoutes.js server/babelParser/parseNormalization.js server/babelParser/semanticValidation.js server/babelParser/systemInstruction.js server/babelParser/modelRuntime.js`
> This plan was written against a **dirty working tree** at commit `8997d92`
> (branch `codex/babel-cross-platform`, 2026-07-05). Compare the "Current
> state" excerpts before proceeding; on mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches normalization return shape — additive only)
- **Depends on**: plans/003-committed-verification-fixtures-and-test-runner.md (fixture snapshots will change; regenerate as part of this plan)
- **Category**: direction / research-infrastructure
- **Planned at**: commit `8997d92` (dirty tree), 2026-07-05

## Why this matters

Babel's stated mission (README "Project direction") is to become a public
benchmark for explicit syntactic derivation across frontier models. A
benchmark artifact must record *the conditions under which it was produced*.
Today's bundles do not:

1. **No timing.** `requestStartedAt` exists in every route
   (`parseRoutes.js:560, 794`) but elapsed milliseconds are never recorded.
   The only timing that exists lives in the local harness's private copies
   (`.artifacts/provider_effort_local_test.cjs:497-527` annotates `timingMs`
   into files under gitignored `.local-tests/`).
2. **No generation config.** Gemini requests send `temperature: 0.2`
   (`modelRuntime.js:415-442`), while the OpenAI and Anthropic request bodies
   **silently drop** the `temperature` parameter they accept
   (`modelRuntime.js:534-560` and `613-640` — destructured, never sent). Nobody
   reading a bundle can see that cross-provider comparisons ran under different
   sampling regimes. Reasoning effort is recorded only at bundle top level
   (`requestedReasoningEffort`), not in the per-analysis provenance that
   artifacts archive.
3. **No contract identity.** `provenance.promptVersion` is read from the env
   var `BABEL_PROMPT_VERSION` (`parseNormalization.js:1938`) which is not in
   `.env.example` and is set nowhere — so it is `undefined` in practice. The
   ~95-rule contract in `systemInstruction.js` can change without any artifact
   recording which contract produced it (archived gauntlets become
   un-reproducible silently).
4. **Validation outcomes vanish.** `runSemanticValidation` *always* softens
   failures to `console.warn` (`semanticValidation.js:505`:
   `const shouldWarnOnSemanticValidationFailure = () => true;`), and
   `auditNoteConsistency` softens unless `BABEL_STRICT_NOTE_VALIDATION=1`
   (line 506). The warnings never reach the bundle: two identical-looking
   artifacts can differ in whether chain-consistency checks passed, and no
   downstream consumer can tell. For a project whose thesis is *derivational
   accountability*, the accountability layer must not be console-only.

All four fixes are additive fields — no existing field changes meaning.

## Current state

- `server/babelParser/parseRoutes.js` — providers attach provenance via
  `attachPrimaryParseProvenance(analysis, generationMeta, extraProvenance)`
  (lines 252–276), which spreads token counts into `analysis.provenance` via
  `attachAggregateParseTokenCounts`. Routes already compute
  `reasoningEffort` (lines 561, 795) and have `requestStartedAt`.
- `server/babelParser/parseNormalization.js:1933-1976` — provenance object
  construction inside `normalizeParseResult`, including:

```js
    const provenance = {
      modelRoute,
      framework,
      timestamp: new Date().toISOString(),
      treeSource: 'derivationStages',
      promptVersion: normalizeOptionalStepText(process.env.BABEL_PROMPT_VERSION),
      parserVersion: normalizeOptionalStepText(process.env.BABEL_PARSER_VERSION || process.env.VERCEL_GIT_COMMIT_SHA),
      ...
```

- `server/babelParser/semanticValidation.js:505-542` — the softening wrappers:

```js
  const shouldWarnOnSemanticValidationFailure = () => true;
  const shouldStrictlyEnforceNoteConsistency = () => String(process.env.BABEL_STRICT_NOTE_VALIDATION || '').trim() === '1';

  const runSemanticValidation = (label, validator) => {
    try { validator(); } catch (error) {
      if (shouldWarnOnSemanticValidationFailure() && error instanceof ParseApiError && error.code === 'BAD_MODEL_RESPONSE') {
        ...console.warn(`[Babel semantic validation softened in production] ${warning}`);
        return;
      }
      throw error;
    }
  };
```

- Call sites of `runSemanticValidation` / `auditNoteConsistency`:
  `parseNormalization.js:1540` (`'chain-consistency'`) and `:1897`.
- `normalizeParseResult` is **synchronous** — a collector array threaded
  through options is race-free.
- `server/babelParser/systemInstruction.js` — exports `buildSystemInstruction`
  and `DERIVATION_STAGES_BASE_INSTRUCTION`; no hash today.
- Repo conventions: factory-injected helpers; options objects for optional
  behavior (`normalizeParseResult(..., options)` already carries
  `payloadIntegrityFlags` — follow that pattern).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm ci`                 | exit 0              |
| Tests     | `npm test`               | pass                |
| Fixtures  | `npm run fixtures:build` | exit 0, snapshots updated deterministically |
| Contract  | `npm run verify:parse-contract` | pass         |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `server/babelParser/systemInstruction.js` (add contract hash export)
- `server/babelParser/parseNormalization.js` (provenance fields + warning collector)
- `server/babelParser/semanticValidation.js` (collector support — behavior of
  soft/strict UNCHANGED)
- `server/babelParser/parseRoutes.js` (latency + effort + generation-config
  provenance)
- `server/babelParser/modelRuntime.js` (ONLY to return the as-sent generation
  config from the three `generate*Content` functions — do not change what is
  sent to providers)
- `.env.example` (document `BABEL_PROMPT_VERSION` as optional override)
- `fixtures/normalized/*.json` (regenerate — reviewed diff)
- `server/babelParser/provenanceCompleteness.test.mjs` (create)

**Out of scope** (do NOT touch):
- Making semantic validation strict (changing soft→hard) — that is a
  maintainer decision; this plan only makes outcomes *visible*.
- Sending `temperature` to OpenAI/Anthropic — reasoning-tier models commonly
  reject it; we record asymmetry, we do not "fix" it.
- `App.tsx` / frontend display of the new fields.
- Cost estimation (pricing tables) — stays in the harness; provenance carries
  tokens + timing from which cost is derivable.

## Git workflow

- Branch: `codex/babel-cross-platform`.
- Commits per step-group: contract hash; validation collector; route
  provenance; fixtures regen. Short imperative messages.
- Do NOT push unless instructed.

## Steps

### Step 1: Contract hash export

In `systemInstruction.js`, add at the bottom:

```js
import { createHash } from 'node:crypto';   // move to top of file

export const CONTRACT_HASH = createHash('sha256')
  .update(XBAR_INSTRUCTION)
  .update(MINIMALISM_INSTRUCTION)
  .update(DERIVATION_STAGES_BASE_INSTRUCTION)
  .digest('hex')
  .slice(0, 16);
```

(`XBAR_INSTRUCTION` / `MINIMALISM_INSTRUCTION` are module-level consts at lines
6 and 25 — hash them where they are defined; if they have been renamed, STOP.)

In `parseNormalization.js:1938`, change:

```js
      promptVersion: normalizeOptionalStepText(process.env.BABEL_PROMPT_VERSION),
```

to fall back to the hash:

```js
      promptVersion: normalizeOptionalStepText(process.env.BABEL_PROMPT_VERSION) || undefined,
      contractHash: CONTRACT_HASH,
```

`parseNormalization.js` receives helpers via factory injection — import
`CONTRACT_HASH` directly at the top of `parseNormalization.js` (a static
module constant does not need DI; keep the factory signature unchanged).

Document in `.env.example`:
`# BABEL_PROMPT_VERSION= (optional human-readable label; contractHash is always recorded automatically)`.

**Verify**: `node -e "import('./server/babelParser/systemInstruction.js').then(m => console.log(m.CONTRACT_HASH.length))"` → `16`.

### Step 2: Thread a validation-outcome collector

In `semanticValidation.js`, extend both wrappers to accept an optional
collector, preserving current console behavior:

```js
  const runSemanticValidation = (label, validator, collector) => {
    try { validator(); } catch (error) {
      if (...same condition...) {
        const warning = ...same...;
        if (warning) console.warn(`[Babel semantic validation softened in production] ${warning}`);
        if (Array.isArray(collector)) collector.push({ check: String(label || 'semantic'), severity: 'softened', message: warning });
        return;
      }
      throw error;
    }
  };
```

Same for `auditNoteConsistency(validator, collector)` with
`check: 'note-consistency'`.

In `parseNormalization.js` `normalizeParseResult`: create
`const validationOutcomes = [];` near the top (after `payloadIntegrityFlags`,
~line 1441); pass it as the new last arg at both call sites (lines ~1540 and
~1897); add to the provenance object:

```js
      semanticValidation: validationOutcomes.length > 0
        ? { status: 'softened-warnings', warnings: validationOutcomes }
        : { status: 'passed' },
```

**Verify**: `npm test` passes; then
`node -e "import('./server/babelParser.js').then(async m => { const fs = await import('node:fs'); const fx = JSON.parse(fs.readFileSync('fixtures/raw/mia-laughed.xbar.json','utf8')); const b = m.__test__.normalizeParseBundle(fx.payload, fx.framework, fx.sentence, fx.modelRoute, true, {}); console.log(b.analyses[0].provenance.semanticValidation.status, b.analyses[0].provenance.contractHash.length); })"`
→ `passed 16`.

### Step 3: Latency, effort, and generation config in route provenance

In `modelRuntime.js`, make each of `generateStructuredContent`,
`generateOpenAIStructuredContent`, `generateAnthropicStructuredContent` attach
the **as-sent** generation config to its return value (additive):

- Gemini (`generateStructuredContent` wraps the SDK call — wrap its result):
  `generationConfig: { temperature, maxOutputTokens, thinking: thinkingConfig?.thinkingLevel || null }`
- OpenAI: `generationConfig: { temperature: null, maxOutputTokens, reasoningEffort, background: Boolean(background) }`
  (`temperature: null` because the request body omits it — lines 552–560).
- Anthropic: `generationConfig: { temperature: null, maxOutputTokens, effort }`
  (body omits temperature — lines 631–638).

In `parseRoutes.js` `attachPrimaryParseProvenance` (lines 252–276): accept the
route context and add to the provenance spread:

```js
      ...(generationMeta?.generationConfig ? { generationConfig: generationMeta.generationConfig } : {}),
```

and extend `summarizeGeneration` (`modelRuntime.js:336-387`) to pass
`generation.generationConfig` through as `generationConfig` on its return.

Then, in each route where the final bundle is assembled
(`parseSentenceWithGemini` return ~line 760, `parseSentenceWithExternalProvider`
return ~line 923, local route ~line 515), compute
`const providerLatencyMs = Date.now() - requestStartedAt;` immediately after
the `withTimeout(...)` generation call resolves, and pass
`{ providerLatencyMs, reasoningEffort }` into the `extraProvenance` argument of
`attachPrimaryParseProvenance` (transcriber-recovery paths included — they
already call `attachPrimaryParseProvenance`; reuse the same extra object).

**Verify**: `npm test` passes;
`grep -n "providerLatencyMs" server/babelParser/parseRoutes.js | wc -l` ≥ 3.

### Step 4: Regenerate fixtures and strip new nondeterminism

`npm run fixtures:build`. The snapshot diff should show ONLY: `contractHash`,
`semanticValidation` (fixtures have no provider call, so no
latency/generationConfig fields appear in them). If `providerLatencyMs`
appears in fixture snapshots, something leaked route-level fields into
offline normalization — STOP.

**Verify**: `git diff fixtures/normalized/` shows only the two new field
groups; `npm run verify:parse-contract` passes; running `fixtures:build` twice
produces no further diff.

### Step 5: Tests

Create `server/babelParser/provenanceCompleteness.test.mjs` (node:test,
pattern: `normalizeParseBundle.test.mjs`):

- contractHash present, 16 hex chars, stable across two calls.
- semanticValidation.status === 'passed' for the clean fixture.
- A deliberately inconsistent payload (copy the fixture, add a `chains` entry
  whose `pronouncedCopy` id does not exist in the tree) yields
  `semanticValidation.status === 'softened-warnings'` with ≥1 warning **and
  still returns a bundle** (soft behavior preserved).
- `summarizeGeneration({ generationConfig: { temperature: null } })` passes the
  config through.

**Verify**: `npm test` → all pass.

## Test plan

Covered in Step 5. Live-provider verification (latency/generationConfig fields
on real gemini/gpt/claude parses) requires API keys — note in your report that
the maintainer should run
`npm run local:provider-effort -- --dry-run=false` (their existing harness)
once and inspect one bundle per provider for the new fields.

## Done criteria

- [ ] `npm test` green, including the new provenance suite
- [ ] Fixture snapshots regenerated; diff contains only `contractHash` and
      `semanticValidation` additions
- [ ] `npm run verify:parse-contract` and `npm run build` green
- [ ] No existing provenance field renamed or removed
      (`git diff server/babelParser/parseNormalization.js | grep "^-" | grep -v "^---"` shows no deleted provenance keys other than the `promptVersion` line edit)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The soft/strict semantics of `runSemanticValidation` would change (any path
  that previously returned a bundle now throws, or vice versa).
- Fixture regeneration produces diffs beyond the specified fields.
- `attachPrimaryParseProvenance`'s call sites don't match the line references
  (parseRoutes has drifted) — re-locate by grepping the function name; if the
  transcriber path no longer routes through it, report.

## Maintenance notes

- `CONTRACT_HASH` changes whenever anyone edits the system instruction — that
  is the point. The plan-003 fixtures include it, so contract edits will show
  up as fixture diffs in review. Archived research artifacts produced *before*
  this plan carry no hash; treat absence as "pre-hash era".
- Follow-up (recorded in plans/README backlog, not here): fold
  `semanticValidation.warnings` into the App's notes/diagnostics view so
  researchers see softened checks without opening JSON; consider
  `payloadIntegrityFlags`-style surfacing.
- Reviewer focus: Step 3's transcriber-recovery paths — easy to add latency to
  the happy path and miss the recovered path, silently biasing benchmark
  timing data toward clean parses.
