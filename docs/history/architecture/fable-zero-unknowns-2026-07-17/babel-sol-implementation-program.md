> **SUPERSEDED — NON-NORMATIVE (2026-07-23).** This first-draft document is retained as history only. It contains known-rejected decisions and must not be used as a requirements source. The canonical packet is: `babel-corrected-canonical-architecture.md`, `babel-provider-grade-benchmark-architecture.md`, `babel-universal-visual-relations-architecture.md`, `babel-corrected-sol-implementation-program.md`, `babel-relations-values-exhaustive-coverage-proof.md`.

# Babel Sol Implementation Program

Author: Claude Fable 5
Date: 2026-07-17
Source of authority: `babel-canonical-architecture.md` (same directory; decision IDs D-* and gates G1–G8 refer to it)
Target executor: GPT-5.6 Sol, with zero context from the authoring session
Repository: `/Users/francisronge/Projects/Babel`, branch `codex/babel-cross-platform`

## Standing rules for every package

- Read the canonical architecture document fully before Package 1. It is the only policy source; do not invent product policy; do not reopen decided questions.
- Preserve all unrelated tracked and untracked work; stage and commit only package-owned paths or hunks (AGENTS.md rule). The working tree is dirty and Francis-owned.
- `npm run verify:all` green is the default completion gate for every package unless the package states a stricter proof.
- A diff in `fixtures/normalized/` or `fixtures/replay-snapshots/` is a behavior change: justify each hunk against the owning decision ID or stop.
- Never print or commit secrets. Never call paid providers except in packages explicitly marked "empirical execution" and only after Francis starts them.
- No Vercel/production work anywhere in this program.
- If any instruction here conflicts with the live code in a way the drift check below catches, stop and report rather than improvise.
- Drift check before every package: confirm HEAD ancestry includes `006b803`, confirm the files listed under "owns" exist with roughly the described content, and confirm `npm run verify:all` is green before starting.

Package status legend for the approvals column: **auto** = Sol may start when dependencies are done; **Francis** = requires explicit Francis go-ahead first; **empirical** = requires a gate result first (the gate and its decision rule are fully specified in the architecture §11).

Dependency graph (packages may otherwise interleave):

```
P01 → P02 → P03 → P04(G1) → (defaults set)
              └──→ P05
P01 → P06(Francis) → P07(G2) → P08(G3 inside) → P09 → P10 → P11
P06 → P12
P06 → P13 → P17
P06 → P14 → P15(G4,G5,G6 inside) → P16(G7,G8 inside)
```

---

## P01 — Re-anchor verification and render baseline

- **Objective:** Establish a fresh, trusted green baseline of the exact current tree, and capture render baselines the later parity gate (G3) will diff against.
- **Why it exists:** The packet forbids trusting the previously reported checks as current; every later package's acceptance depends on a known-good starting point.
- **Owns (current):** No source files. Read-only over the whole repository; writes only under a new `bench-baseline/` directory in the repo root **gitignored** (add one line to `.gitignore`).
- **New files:** `bench-baseline/` (gitignored) containing: `verify-all.log`, `build.log`, `audit.log`, per-fixture Canopy/Growth capture PNGs or serialized replay-step JSON dumps (use `npm run fixtures:replay` output plus a Node script that serializes `buildPlaybackStepsFromDerivationFrames` results per normalized fixture to JSON — JSON dumps are sufficient; browser screenshots are not required).
- **Retain:** Everything.
- **Delete:** Nothing.
- **Migrations:** None.
- **Dependencies:** None.
- **Instructions (bounded):** (1) `npm ci`; (2) run `npm run verify:all`, `npm run build`, `npm run audit`, saving logs; (3) write `scripts/dumpReplayBaseline.mjs` (temporary, may live in `bench-baseline/`, not committed) that, for every file in `fixtures/normalized/`, imports the replay compiler in Node and writes the full playback-step array and resolved-relation records to `bench-baseline/replay/<fixture>.json`; (4) record the git status snapshot to `bench-baseline/tree-state.txt`.
- **Tests/fixtures:** None added; existing suites must pass.
- **Acceptance proof:** All three logs green (typecheck, 18+ tests, both parse-contract fixtures, 0 vulnerabilities or an explicit list); baseline JSON exists for every normalized fixture.
- **Stop conditions:** `verify:all` not green on the untouched tree → stop, report exact failures, do not fix anything outside the report.
- **Must not change:** Any tracked or untracked file except the one `.gitignore` line.
- **Approval:** auto.

## P02 — Typed validation errors and the failure panel

- **Objective:** Implement reliability decision D-REL-3: every parse failure becomes one of four typed classes (provider/transport, truncation, contract-invalid, no-committed-structure) carrying stage index, field path, rule ID, and excerpt; the Workbench shows a structured failure panel with raw-output download.
- **Why it exists:** Historical problem #10 (useful output rejected with generic failure) is a current defect; specific failure is the foundation the rest of the reliability architecture reports through.
- **Owns (current):** `server/babelParser/parseNormalization.js`, `server/babelParser/derivationCompiler.js` (error-raising sites only), `server/babelParser/parseRoutes.js` (error mapping only), `server/parseApi.js` (response shape), `App.tsx` (error display region), `types.ts` (error shape type).
- **New files:** `server/babelParser/validationErrors.js` (rule registry: rule ID, human message template, class); `components/FailurePanel.tsx`.
- **Retain:** All current validation *conditions* (what is checked) exactly as-is in this package — only the error *reporting* changes here. The existing `debugPayloadPath` write-outs remain.
- **Delete:** Generic catch-all messages ("Malformed parse result from model", "No valid analyses returned by model") as user-facing terminal strings — they become rule-ID-bearing typed errors. Do not delete any check.
- **Migrations:** Extend `ParseApiError.details` with `{failureClass, ruleId, stageIndex?, fieldPath?, excerpt?}`; API error JSON passes it through; no contract change to model-facing surfaces.
- **Dependencies:** P01.
- **Instructions:** (1) Create the rule registry; assign a stable ID to every distinct throw site in normalization/compilation (enumerate them by grepping `ParseApiError` and the null-return integrity flags that lead to `BAD_MODEL_RESPONSE`); (2) thread stage index and field path into throws inside `normalizeDerivationStagesToDerivationFrames` and `normalizeParseResult` (the integrity-flag strings like `stage_record_missing_or_thin:d3` already carry stage identity — convert these silently-dropping paths into *recorded reasons attached to the final thrown error* so the user learns why stage d3 was rejected instead of a downstream "no committed structure"); (3) build `FailurePanel` rendering class, rule, stage, excerpt, and a "download raw model output" button. Raw-text delivery design: include `rawTextBase64` in the error response body itself when under 2 MB — no endpoint, no storage, no server-side persistence (AGENTS.md forbids server parse persistence as a side effect); (4) wire into `App.tsx` error state.
- **Tests/fixtures:** New `tests/validationErrors.test.mjs`: for ≥8 representative invalid payloads (wrong shape, missing field, thin stage record, bad refId, duplicate tokenIndex, unresolved anchor, truncated-marker, no-committed-structure), assert failure class, rule ID, and stage index. Existing tests must pass unchanged.
- **Acceptance proof:** `verify:all` green; manual dev-run screenshot-level check that a deliberately broken payload produces the panel (use the dev bundle-injection hooks in `App.tsx`).
- **Stop conditions:** If threading stage identity requires changing what is *accepted* (not just reported), stop — acceptance changes belong to P06/P08.
- **Must not change:** Any validation semantics; prompt files; fixtures.
- **Approval:** auto.

## P03 — Schema-constrained transport (flag-gated) and the G1 harness

- **Objective:** Implement D-REL-1: per-provider JSON-schema-constrained output derived mechanically from the contract, behind env flag `BABEL_SCHEMA_TRANSPORT` (default off until P04), plus finish-reason truncation detection as a typed failure, plus the G1 A/B harness.
- **Why it exists:** Prevention-at-generation is the architecture's replacement for repair machinery; the transcriber deletion (P05) and the reliability promise both stand on it.
- **Owns (current):** `server/babelParser/modelRuntime.js` (request builders `buildGeminiGenerationRequest`, `buildOpenAIRequestBody`, `buildAnthropicRequestBody`, and generation functions), `server/babelParser/routeConfig.js` (new env flag), `server/babelParser/parseRoutes.js` (pass-through), `docs/design/benchmark-provenance-conditions.md` (record schema mode in `sentGenerationConfig`).
- **New files:** `server/babelParser/contractSchema.js` — exports `buildAuthoredPayloadJsonSchema(contractVersion)` returning the JSON Schema for the envelope alternation, four stage fields in order, node object (id/label/children/word/tokenIndex/silent/lineageId/refId alternation), and relation items. All prose/name/value strings unconstrained. `.artifacts/g1_schema_ab_harness.cjs` — the G1 runner per architecture §11 (sentence list, condition matrix, output archive layout, Layer-A classifier reuse).
- **Retain:** Current request shapes when the flag is off (byte-identical requests — this is a benchmark condition; verify by comparing `sentRequest` snapshots).
- **Delete:** Nothing yet.
- **Migrations:** `generationRecord.sentGenerationConfig` gains `schemaTransport: true|false` and, when true, a `schemaSha256`. Update `tests/generationRecord.test.mjs` accordingly.
- **Dependencies:** P02 (truncation must surface as a typed class).
- **Instructions:** (1) Write the schema builder from the *current* v1 contract (rename comes later; the builder takes a version argument so P06 only adds a branch); (2) wire per provider using each API's current official structured-output mechanism — check the live provider docs at implementation time for exact field names; Gemini `responseSchema`, OpenAI Structured Outputs strict schema, Anthropic's current structured/output-format mechanism; if a provider's mechanism cannot express the envelope alternation (`derivationStages` XOR `analyses`), express it as `anyOf` where supported, else fall back to the superset object plus L2 shape validation and record `schemaTransport: 'partial'`; (3) detect length/token-limit finish reasons on all routes and throw the typed truncation failure before any JSON parse attempt; (4) build the G1 harness: 24 sentences (take the 3 published research sentences plus 21 drawn from `.artifacts` gauntlet lists, stratified easy/medium/hard), conditions per §11-G1, writes one JSON record per run (raw text, failure class, bundle-or-null, tokens, timing) under `.artifacts/g1-results/` (gitignored).
- **Tests/fixtures:** `tests/contractSchema.test.mjs`: schema accepts every committed raw fixture payload and rejects five canonical malformed shapes (validate with a small JSON-schema validator dev-dependency, or hand-rolled structural checks — do not add a heavy dependency; `ajv` as devDependency is acceptable). Snapshot test that flag-off request bodies are unchanged.
- **Acceptance proof:** `verify:all` green; flag-off byte-identical request snapshot; schema validates all committed raw fixtures.
- **Stop conditions:** Provider mechanism requires changing prompt text to function (e.g., mandatory tool-call phrasing) → stop and report; prompt is P06's property.
- **Must not change:** Prompt files; default behavior with flag off.
- **Approval:** auto.

## P04 — Gate G1 execution and per-provider schema defaults

- **Objective:** Execute G1 per architecture §11; set `BABEL_SCHEMA_TRANSPORT` default per provider from its decision rule; record the result durably.
- **Why it exists:** The only evidence-dependent branch in the reliability architecture is per-provider schema default.
- **Owns:** `.artifacts/g1_schema_ab_harness.cjs` execution; `routeConfig.js` defaults; new `docs/design/schema-transport-decision-2026.md` recording the numbers and the decision.
- **New files:** The decision doc.
- **Retain/Delete:** Per the G1 decision rule only.
- **Migrations:** None.
- **Dependencies:** P03. **Requires Francis to launch (paid provider calls) and to perform the 24-pair blinded quality judgment per provider.**
- **Instructions:** Run the matrix (576 calls, ~$-bounded: estimate and report cost to Francis before launch); compute per-provider contract-failure rates; assemble the blinded pairs (schema-on vs schema-off bundles for the same sentence, order-shuffled, provider-labeled only by letter) for Francis's judgment; apply the decision rule mechanically; flip defaults; write the doc.
- **Tests/fixtures:** None beyond harness self-checks.
- **Acceptance proof:** Decision doc exists with raw rates, judgment tallies, the rule applied verbatim, and the resulting defaults; `verify:all` green.
- **Stop conditions:** Any provider errors >20% of calls for transport reasons unrelated to schema → pause, report, rerun window with Francis.
- **Must not change:** The decision rule.
- **Approval:** empirical + Francis (launch and judgment).

## P05 — Delete the payload transcriber and firewall

- **Objective:** Implement D-REL-2: remove the second-model transcriber, the payload fingerprint firewall, and all transcriber provenance.
- **Why it exists:** Benchmark fairness (Gemini-only recovery today), attribution integrity, and Francis's conditional removal preference — the condition is met once schema transport exists and failures are honestly reported.
- **Owns (current):** `server/babelParser/parseRoutes.js`, `server/babelParser/payloadFirewall.js`, `server/babelParser/routeConfig.js` (`PAYLOAD_TRANSCRIBER_*`), `types.ts` (`payloadTranscriber*` provenance fields), `docs/design/benchmark-provenance-conditions.md` (remove the transcriber-identifiability paragraph, note the removal date), any tests referencing these.
- **New files:** None.
- **Retain:** `strictJson.js` delimiter repair with its flag (architecture keeps it as the single mechanical L1 repair); the primary-route debug payload writes; the Gemini route's error paths now mirroring the GPT/Claude structure (typed json-parse / normalization failures from P02).
- **Delete:** `attemptPayloadTranscriber`, `buildPayloadTranscriberSystemInstruction`, `buildPayloadTranscriberContents`, `attachPayloadTranscriberProvenance`, both call sites in `parseSentenceWithGemini`, `payloadFirewall.js` entirely, `PAYLOAD_TRANSCRIBER_MODEL/_MAX_OUTPUT_TOKENS/_TIMEOUT_MS/_TEMPERATURE`, provenance fields, and the `payload_transcribed_*` integrity-flag vocabulary.
- **Migrations:** `Provenance` type shrinks; Tree Bank entries containing old provenance fields must still load (normalizeTreeBankEntry tolerates unknown fields — verify, don't strip stored data).
- **Dependencies:** P03 (capability exists). Does not wait for P04: the architecture's precondition is honest failure, not zero failure.
- **Instructions:** Mechanical removal; ensure the Gemini route's failure paths now produce the same typed errors as the external-provider path; run the full suite.
- **Tests/fixtures:** Update `tests/parseApi.test.mjs`/`parserContract.test.mjs` if they reference transcriber fields; add one test asserting a Gemini-route normalization failure surfaces the typed error with no recovery attempt.
- **Acceptance proof:** `grep -ri "transcriber\|payloadFirewall" server/ types.ts` returns nothing; `verify:all` green.
- **Stop conditions:** Any test depends on transcriber behavior for an unrelated assertion → refactor the test minimally, do not preserve the behavior.
- **Must not change:** `strictJson.js`; prompt files.
- **Approval:** auto.

## P06 — Contract v2: rename, `values`, prompt rewrite

- **Objective:** Implement D-CONTRACT-1/2/4 and D-REL-4 as one versioned contract event: `visualRelations` → `relations`; optional `values: Record<string,string>` on relation items; retire case-metadata from the authored surface; rewrite the system instruction into the four-layer form with schema-subsumed shape rules deleted; update schema builder, types, compiler, replay, fixtures, AGENTS.md.
- **Why it exists:** Closes the two proven evidence gaps, corrects the field's category error, and halves prompt accretion — the only contract change the architecture authorizes.
- **Owns (current):** `server/babelParser/systemInstruction.js`, `server/babelParser/prompts.js`, `server/babelParser/contractSchema.js`, `types.ts`, `server/babelParser/derivationCompiler.js` (field-name reads, `normalizeDerivationStageVisualRelations` → accepts `values`), `server/babelParser/parseNormalization.js`, `replay/replayCompiler.ts` (field reads: `getFrameVisualRelations`, adapter), `components/TreeVisualizer.tsx` (display of values), `App.tsx`, `AGENTS.md` (invariant wording), `fixtures/raw/*`, `fixtures/normalized/*`, `fixtures/replay-snapshots/*`, all tests, `README.md` §10.
- **New files:** `docs/design/contract-v2.md` — normative field semantics including the three `values` rules (authored-only; no anchor back-door — value equal to an existing node ID is flagged `value_matches_node_id`; duplication of a node label is flagged `value_duplicates_label`; flags never reject).
- **Retain:** Every semantic rule of the current instruction (forward derivation, occurrence identity, silence, licensing, anchors, granularity), deduplicated; the exact envelope alternation; four fields in the same order; the `stageRecord` non-empty requirement. **The 24-character/4-word substance thresholds are deleted in this package** (they are contract semantics, so they belong to the contract event), per D-VAL-1.
- **Delete:** From the prompt: `RAW_JSON_ONLY_INSTRUCTION`, field-order/presence/top-level-placement rules, "workspaceForest must be a JSON array" transport rules (schema owns these; keep a one-line shape reminder for non-schema local routes); from code: field-synonym fallbacks (`summary/claim/note`, `participants/supportAnchors`, `kind/type/label`), the dead `ambiguityNote` read, `case/assigner/caseEvidence/caseOvert` from the schema and prompt surface (types keep them optional).
- **Migrations:** Raw fixtures re-authored with `relations` (hand-edit the committed raw fixtures — they are hand-maintained test payloads, not provider captures; where a fixture *is* a provider capture, keep a v1-reading shim in the fixture builder that maps `visualRelations`→`relations` at fixture-build time only, flagged `fixture_v1_upgraded`, never in the live parse path); normalized fixtures and replay snapshots regenerate; Tree Bank reader accepts stored v1 bundles read-only (map on load, tagged). Prompt/template/schema hashes change — this is the deliberate benchmark-condition break; record it in `docs/design/contract-v2.md`.
- **Dependencies:** P01; P03 (schema builder exists to update). Best after P05 to avoid rewriting transcriber strings.
- **Instructions:** (1) Types first; (2) contract schema v2 branch; (3) prompt rewrite to the four-layer structure — target ≤80 lines, every retained rule traceable to a v1 rule or a decision ID, listed in a mapping table inside `contract-v2.md`; (4) compiler/normalization field rename + `values` validation (shape: object of string→string; flags per rules); (5) replay/renderer read-path rename; render authored `values` in Notes chips minimally (full plaque grammar is P11); (6) fixtures and snapshots; (7) AGENTS.md invariant lines updated (`relations` wording, transcriber removal, schema transport note).
- **Tests/fixtures:** Extend `parserContract.test.mjs` for `values` (accepted, flagged-duplication, flagged-node-id cases, rejected non-string); rename sweeps in all tests; one new raw+normalized fixture pair exercising `values` (Agree-style and PF-style examples from the inventory's residual table).
- **Acceptance proof:** `verify:all` green; `grep -rn "visualRelations" server/ replay/ components/ App.tsx types.ts tests/` returns only the Tree-Bank v1 read shim and historical docs; prompt line count and mapping table in `contract-v2.md`.
- **Stop conditions:** Any semantic rule cannot be preserved without a shape rule the schema can't express → stop, document, ask Francis.
- **Must not change:** Stage field count/order; envelope alternation; any linguistic semantics beyond `values`' addition.
- **Approval:** **Francis** (contract change; he must sign off on the rename, `values`, and the rewritten prompt text before merge).

## P07 — Gate G2 execution: v2 reliability baseline

- **Objective:** Execute G2 (§11): v1 vs v2 native-pass and coherence comparison; one permitted prompt-iteration loop; durable decision doc.
- **Why it exists:** The contract event must not silently regress provider reliability.
- **Owns:** New `.artifacts/g2_contract_v2_baseline.cjs`; `docs/design/contract-v2.md` (results appendix).
- **Dependencies:** P06. **Francis launches (paid calls).**
- **Instructions/metrics/decision rule:** Exactly §11-G2. Archive all raw outputs under `.artifacts/g2-results/` (gitignored).
- **Acceptance proof:** Results appendix with rates per provider and the rule applied; if the iteration loop was used, both prompt versions' hashes recorded.
- **Stop conditions:** v2 fails the rule after one iteration → stop; escalate to Francis with the failure taxonomy (do not iterate further unilaterally).
- **Approval:** empirical + Francis (launch).

## P08 — Compiler purge with G3 parity harness

- **Objective:** Implement D-COMPILE-1: delete every node-synthesizing and movement-inferring heuristic from L3; replace trajectory sourcing with authored anchors + lineage only; prove parity via G3 before merge.
- **Why it exists:** Deterministic code currently authors linguistics (fake `__shell` nodes, null→`t` rewrites, operation classification) in violation of the core constraint.
- **Owns (current):** `server/babelParser/derivationCompiler.js`, `server/babelParser/parseNormalization.js`, `server/babelParser/derivationHelpers.js` and `server/babelParser.js` (they define/wire `promoteSentenceMatchingLeaves`, `materializeEmptyStructuralLeaves`, `collapseOvertHeadLandingChains` — the helpers injected at the top of `derivationCompiler.js`), `replay/replayCompiler.ts` (its mirror inference `inferReplayDerivationMovementOperation`, `resolveDerivationMovementTransitions` non-lineage branches, `materializeMissingTraceLeavesFromRelationLinks`, `deriveTraceShellLabelFromMovementLink`, `materializeTraceShellsFromRelationLinks`), fixtures/snapshots.
- **New files:** `bench-baseline/` G3 comparison script (extend P01's dump script to diff pre/post JSON dumps and classify diffs).
- **Retain:** `expandSameStageSubtreeRefs`; `buildLineageWitnessIndexFromForest` and `inferMovementPairFromLineageTransition` (lineage reading is authored evidence — keep, but it may only *display* a transition, never emit an operation name; strip its scoring preferences that encode head/phrasal linguistics down to structural facts); committed-root selection; resolved-relation construction preserving authored names; `assignDerivationStepIds`.
- **Delete:** Per architecture §7.1's list, in both compiler and replay mirrors: `materializeImplicitPhrasalTraceShellsInDerivationFrames`, `materializeCommittedTraceShells`, `collapseMalformedHeadMoveLandings`, `removeConsumedDuplicateWorkspaceRoots`, null→`t` rewrites, `inferMovementOperationFromChange`'s A-Move/AbarMove/HeadMove taxonomy and prose regexes, `normalizeMovementStemFromId`/stem matching, `findHeadMoveHostNodeIdFromSurfaceCue`, `inferMovementPairFromStateTransition`'s non-lineage structural-guess branch, `promoteSentenceMatchingLeaves`/`materializeEmptyStructuralLeaves` on authored forests. Implement D-COMPILE-2: `derivationSteps` operations become neutral (`stage`), synthetic `SpellOut` step loses its authored-sounding recipe (keep a neutral final-state step for replay's scrubber).
- **Migrations:** Fixture/snapshot regeneration with per-hunk justification; `DerivationStep.operation` values in snapshots change to neutral identifiers.
- **Dependencies:** P06 (fixtures already on v2, one churn); P01 baseline.
- **Instructions:** (1) Extend the dump/diff harness; (2) delete in dependency order (compiler first, replay mirrors second); (3) run G3: diff every fixture and archived research capture, triage each diff as (a) heuristic-was-inventing → accept, log; (b) authored-evidence-missed → fix the generic lineage/anchor path before proceeding; (4) regenerate fixtures/snapshots; (5) write the triage table into a `docs/design/compiler-purge-2026.md`.
- **Tests/fixtures:** New `tests/noSynthesizedNodes.test.mjs`: for every normalized fixture, assert the node-ID set of every compiled view ⊆ authored node-ID set of the corresponding stages (no `__shell`, no invented leaves); assert no compiled view contains an operation label absent from authored relation names.
- **Acceptance proof:** G3 category (b) empty; triage doc complete; `verify:all` green; the no-synthesized-nodes test passes.
- **Stop conditions:** A category-(b) fix would require re-adding inference → stop; that render gap ships as "no arrow" per architecture §7.2, documented, unless Francis overrides.
- **Must not change:** Validation acceptance conditions (what parses as valid); prompt.
- **Approval:** auto (after P06/P07).

## P09 — Replay elaboration boundary (D-REPLAY-1)

- **Objective:** Make the microstep invariant structural: microsteps reveal authored nodes only; declared display notations are enumerated in code and docs; authored prose is never suppressed.
- **Why it exists:** Replay is the user-visible derivational experience; its generated/authored boundary must be enforced, not customary.
- **Owns (current):** `replay/replayCompiler.ts` (`materializeReplayPreterminals`, `materializeNullBearingLeaves`, `materializeCanopyPreterminals`, `LOW_SIGNAL_REPLAY_TEXT_RE` usage sites, casing transforms, `stripSemanticPayloadFromMicrostep`), `components/TreeVisualizer.tsx` (stage vs microstep labeling), `docs/design/` new page.
- **New files:** `docs/design/replay-elaboration-boundary.md` — the declared display-notation list (preterminal expansion, silence muting, pre-fronting casing, trace index display) and the prohibition list.
- **Retain:** Bottom-up reveal engine; workspace-root ordering; carried relations; the silent-semantics behavior locked by `tests/replaySilentSemantics.test.mjs`.
- **Delete:** Any remaining path that manufactures `∅`/`t` for authored silent structure (should be gone post-P08 — verify); application of the low-signal filter to authored `statement`/`stageRecord` text (restrict to generated fallback strings only).
- **Migrations:** Snapshot regeneration only if the low-signal restriction changes outputs; justify hunks.
- **Dependencies:** P08.
- **Instructions:** Audit every `materialize*`/format transform against the declared list; add a UI affordance distinguishing authored stages from generated steps in the Growth timeline (label chips "Stage n" vs "step"); extend the silent-semantics test with two cases from the declared list's edge conditions.
- **Tests/fixtures:** Extend `replaySilentSemantics.test.mjs`; add assertion that every authored `stageRecord` string appears verbatim in some replay detail block for its stage.
- **Acceptance proof:** `verify:all` green; doc lists match code (grep-verifiable transform inventory).
- **Stop conditions:** A transform is neither deletable nor declarable (changes meaning) → stop and report.
- **Must not change:** Authored bundle content; validation.
- **Approval:** auto.

## P10 — Total-dispatch renderer with hyperedge fallback

- **Objective:** Implement D-RENDER-1: a pure dispatch function over anchor topology + name keyword classes, guaranteed total, with the conservative role-labelled hyperedge grammar as the floor; every authored relation renders in Growth and Canopy overlays.
- **Why it exists:** Resolves the open-ontology/deterministic-renderer tension; supersedes archived plan 009.
- **Owns (current):** `replay/replayCompiler.ts` (relation-link building, `renderFamily`/`renderStatus` assignment), `components/TreeVisualizer.tsx` (drawing), `types.ts` (`VisualRelationRenderFamily` extension).
- **New files:** `replay/relationDispatch.ts` (pure, Node-importable, no React — AGENTS rule); `components/relationGrammars/` (hyperedge renderer first).
- **Retain:** Existing trajectory drawing (re-based on P08's authored-only sourcing); resolved-record verbatim authored strings.
- **Delete:** Silent dropping of non-trajectory relations from rendering (`renderable: false` relations must now render via fallback; the status vocabulary gains `fallback-hyperedge`).
- **Migrations:** Snapshot updates (new links present); justify.
- **Dependencies:** P08, P09.
- **Instructions:** (1) Extract current trajectory role-classification into `relationDispatch.ts` as one dispatch case among several; (2) implement the hyperedge grammar: anchored nodes connected to a small relation label node (rendered, not part of the tree data — a pure SVG overlay, never inserted into the syntax data structure), roles as edge labels, authored `values` listed under the label; (3) dispatch table order: trajectory shapes → occurrence class (P11) → hyperedge floor; (4) unknown names and unknown role sets must demonstrably hit the floor.
- **Tests/fixtures:** `tests/relationDispatch.test.mjs`: totality property — a generated corpus of 200 randomized relation items (random names, role names, arities over fixture trees) all dispatch to a grammar and none throws or drops; fixture-based snapshots for known families.
- **Acceptance proof:** Totality test green; a fixture with an invented relation name visibly renders in the dev app; `verify:all` green.
- **Stop conditions:** Dispatch requires interpreting a relation name to choose *content* (not style) → stop; that is L0 territory.
- **Must not change:** Authored strings; syntax data structures (overlay-only rendering).
- **Approval:** auto.

## P11 — Grammar promotions (fixture-driven, ordered)

- **Objective:** Implement D-RENDER-3's promotion order after the floor exists: (a) occurrence/pronunciation-state class; (b) domain/region; (c) feature-value plaque + realization plate consuming authored `values`; (d) coindexation/reference marks.
- **Why it exists:** Moves accepted lab visual language into production honestly, one grammar per evidence-complete step.
- **Owns (current):** `components/relationGrammars/`, `replay/relationDispatch.ts`, `docs/design/visual-relations-exhaustive-inventory.md` (status column updates only), lab adapter tests.
- **New files:** One renderer module + fixtures per grammar; atomic fixtures ported from the 62-ledger IDs (F14, F22–F27, F17→now authorable, F18, F15).
- **Retain:** The lab (`docs/design/visual-relations-*`) as evidence, untouched except status columns.
- **Delete:** Nothing.
- **Migrations:** Snapshots per grammar landing.
- **Dependencies:** P10; (c) requires P06.
- **Instructions:** Land grammars strictly in order, each as a separately verifiable commit: dispatch case, renderer, ≥2 atomic fixtures, snapshot tests. Sub-stage (c) renders `values` rows verbatim in the plaque; no derived feature parsing.
- **Tests/fixtures:** Per grammar as above; the P10 totality test must stay green after every dispatch-table change.
- **Acceptance proof:** Each grammar's fixtures render deterministically in snapshots; inventory status updated `LAB`→production for landed rows.
- **Stop conditions:** A grammar needs evidence the contract can't author → it stays quarantined; do not extend the contract (that decision is closed).
- **Must not change:** Contract; quarantined-study status of the far-future/other-framework groups.
- **Approval:** auto.

## P12 — Notes cards and the stage navigator

- **Objective:** Implement D-UX-1: Notes as per-stage cards (statement heading, stageRecord body, relation chips with values); a stage navigator that synchronizes Growth, Notes, and Canopy relation highlighting; failure panel already present from P02.
- **Why it exists:** Resolves the Notes-length and Replay-vs-Canopy tensions by binding surfaces to one object instead of deleting surfaces.
- **Owns (current):** `App.tsx` (tabs, state), `components/` (new `StageNavigator.tsx`, `NotesView` extraction from App if inline), `derivationNotes.js`, `components/TreeVisualizer.tsx` (accept external stage selection).
- **New files:** `components/StageNavigator.tsx`, `components/NotesStageCard.tsx`.
- **Retain:** Bracketed-notation block and copy actions; Tree Bank behavior; all three tabs; abstraction toggle; dev hooks (`__BABEL_DEV_*`).
- **Delete:** The flat concatenated Notes rendering.
- **Migrations:** None (presentation only).
- **Dependencies:** P06 (relation naming), P10 (chips reflect dispatch status).
- **Instructions:** Lift a single `selectedStageIndex` state; Growth seeks to the stage's first step; Notes scrolls/highlights its card; Canopy highlights relations whose stage matches; keep keyboard navigation; first-run defaults collapse chips and microstep detail (progressive disclosure).
- **Tests/fixtures:** Component-level render test via the existing dev-bundle path is sufficient; no snapshot infra for React exists — add none; verify via `npm run build` and manual dev checklist recorded in the PR/commit message.
- **Acceptance proof:** `verify:all` + `build` green; manual checklist (stage click syncs all three views; long-derivation fixture reads as cards).
- **Stop conditions:** Synchronization requires replay-compiler changes beyond exposing stage→step index mapping → coordinate with P09 owner boundaries, do not fork logic into components.
- **Must not change:** Authored content display fidelity; replay compiler ownership boundary (AGENTS).
- **Approval:** auto.

## P13 — Tree Bank Grove-record export/import

- **Objective:** Implement the Workbench end of D-GROVE-1: export the current parse (per analysis) as a Grove record file; import/view a record file read-only.
- **Why it exists:** The Grove's ingestion path is file/PR-based; the Workbench must produce the record without server persistence.
- **Owns (current):** `App.tsx` (Tree Bank panel actions), `treeBankSnapshot.js`, `types.ts` (GroveRecord type).
- **New files:** `groveRecord.ts` (build/validate/serialize; engine-versioned; raw text included when the session has it — provider responses must start carrying raw text to the client for this: extend the parse API response with `rawModelTextBase64` gated by response size ≤2 MB, reusing P02's mechanism; document that Tree Bank entries saved before this package lack raw text and export with `raw: null` flagged).
- **Retain:** IndexedDB storage model; no accounts; no server persistence.
- **Delete:** Nothing.
- **Migrations:** Tree Bank schema version bump storing raw text henceforth (entry normalizer already tolerant).
- **Dependencies:** P06 (v2 records only).
- **Instructions:** Record shape exactly per architecture §10.1 minus review fields (submitter-side records carry `review: null`); JSON file download/upload; validation on import with typed errors (reuse P02 registry).
- **Tests/fixtures:** `tests/groveRecord.test.mjs`: round-trip build→serialize→validate for a fixture bundle; rejection cases.
- **Acceptance proof:** Export from dev app of a fixture bundle validates; `verify:all` green.
- **Stop conditions:** Raw-text transport exceeds the size gate for real parses routinely → report; do not add server storage.
- **Must not change:** AGENTS Tree Bank invariants.
- **Approval:** auto.

## P14 — Benchmark runner and deterministic scorers (`bench/`)

- **Objective:** Build the benchmark skeleton per architecture §9: suite/item-card format, runner CLI over the provider routes, raw-output archiver, Layer-A classifier, Layer-B coherence checkers, rerun protocol (k, dispersion, bootstrap CI), result-report generator with the native/repaired/failed partition.
- **Why it exists:** Promotes the benchmark from `.artifacts` scripts to the public deliverable; everything in §9 that is deterministic lands here.
- **Owns (current):** New `bench/` directory only; `package.json` scripts (`bench:run`, `bench:score`); reuses engine modules by import — no engine changes.
- **New files:** `bench/README.md` (methodology, from architecture §9 verbatim where normative), `bench/itemCard.schema.json`, `bench/runner.mjs`, `bench/scoreLayerA.mjs`, `bench/scoreLayerB.mjs` (checks: branching arity per framework, endocentricity per the framework's own label discipline as *counts not judgments*, token alignment, lineage coherence, spurious-ambiguity structural-equivalence, flagged forward-derivation heuristic clearly labeled heuristic), `bench/report.mjs`, `bench/suites/dev-seed/` (6 hand-authored item cards to prove the format).
- **Retain:** `generationRecord` as the condition record; `.artifacts` harnesses untouched (research history).
- **Delete:** Nothing.
- **Migrations:** None.
- **Dependencies:** P06 (v2), P05 (no transcriber partition ambiguity).
- **Instructions:** Layer-B checkers must be pure functions over bundles with rule IDs and per-item counts; no network in scorers; runner supports `--k`, `--conditions`, `--suite`, archives every raw response with hashes; the report partitions native/transport-repaired/failed and computes mean/min–max/bootstrap-CI per condition. LLM-judge integration is **out of scope** (architecture allows only a pre-screen later; do not build it).
- **Tests/fixtures:** `tests/benchScorers.test.mjs` over fixture bundles with known violation counts; CI stays provider-free (runner tested against a stub generate function).
- **Acceptance proof:** Dev-seed suite runs end-to-end against the stub; scorer tests green; `verify:all` green.
- **Stop conditions:** A Layer-B check requires preferring one analysis family → drop it to Layer C's checklist domain; report.
- **Must not change:** Engine behavior; provider request shapes.
- **Approval:** auto (suite *content* beyond dev-seed is P15 with Francis sign-off).

## P15 — Suite authoring, novelty generators, gates G4–G6

- **Objective:** Author benchmark v1 content: core phenomena × 24-language matrix item cards; the novelty suite (nonce, templates with held-out lexicalization, in-prompt conlang, minimal mutations); enumeration and adversarial sub-suites; canary strings; the held-out split process; then execute G4 (unusual-input probe), G5 (novelty calibration), G6 (multilingual scouting) per §11.
- **Why it exists:** Content is the benchmark; the gates size and de-risk it before any release.
- **Owns:** `bench/suites/**`, `bench/generators/` (template lexicalizer with seed-vocabulary files; conlang item builder), `bench/HELD-OUT.md` (process doc: held-out items live outside the repo in Francis's private location; only hashes committed).
- **New files:** As above.
- **Retain:** March taxonomy as seed structure; March sentences only in dev split, marked contaminated-by-publication.
- **Delete:** Nothing.
- **Migrations:** None.
- **Dependencies:** P14; G4 additionally needs only P03.
- **Instructions:** Item cards must each carry the phenomenon checklist and cited analysis families (Layer C's basis) — where Sol lacks confidence in a family citation, mark the card `families: draft` for Francis/linguist review rather than inventing; generators must be deterministic given a seed; embed the canary GUID in every published data file; run G4/G5/G6 exactly per §11 with Francis launching paid calls; apply their decision rules; freeze suite v1.
- **Tests/fixtures:** Generator determinism tests; card-schema validation over all suites.
- **Acceptance proof:** Suite v1 frozen with counts per sub-suite; gate decision docs (`bench/gates/g4.md`, `g5.md`, `g6.md`) with rules applied; card lint green.
- **Stop conditions:** G4 reveals engine-side input rejections → fix in a scoped engine patch (tokenizer/validator) with fixtures, or report if the fix would touch contract semantics.
- **Must not change:** Contract; scoring code semantics (P14's).
- **Approval:** **Francis** for suite content sign-off and all paid gate launches; card authoring itself is auto.

## P16 — Reproducibility protocol, gates G7–G8, release tooling

- **Objective:** Execute G7 (k-validation) and G8 (latency/cost envelope from logged data); build the release bundler (versioned tuple: suite, contract hashes, engine version, conditions, scores, dispersion, adjudication records, raw outputs, claims doc template with the mandated claim phrasing).
- **Why it exists:** Release integrity is the benchmark's credibility; k and the cost envelope are the last data-dependent parameters.
- **Owns:** `bench/release.mjs`, `bench/CLAIMS-TEMPLATE.md`, gate docs.
- **Dependencies:** P15. **Francis launches G7 runs.**
- **Instructions/decision rules:** Exactly §11-G7/G8; release bundler refuses to build if any scored item lacks k runs or any condition lacks `generationRecord` hashes.
- **Acceptance proof:** A dry-run release from dev-seed + stub data builds; G7/G8 docs with rules applied.
- **Stop conditions:** CI-width rule ambiguous on real data → default to k=5 (the conservative branch) and record it.
- **Approval:** empirical + Francis (launch).

## P17 — Grove repository scaffold

- **Objective:** Create `babel-grove` (separate repository): record schema (architecture §10.1), validation CLI (imports the engine), governance doc (editor model, reviewer addition, supersession, tombstones), licensing (CC BY 4.0 + provider-terms note), PR-based ingestion checklist, exporters (native JSON canonical; ISO SynAF 24615-2/TIGER-XML for final trees; labeled bracketing), release/DOI process doc.
- **Why it exists:** The database is a distinct deliverable; the scaffold makes acceptance and provenance real before content accumulates.
- **Owns:** The new repository only; plus one link line in Babel's `README.md`.
- **New files:** `babel-grove/{README.md, GOVERNANCE.md, LICENSE, schema/groveRecord.schema.json, tools/validate.mjs, tools/export-tigerxml.mjs, records/}`.
- **Retain/Delete:** n/a (greenfield).
- **Migrations:** None; first records come from P13 exports of Francis-reviewed parses.
- **Dependencies:** P13; P06.
- **Instructions:** TIGER-XML exporter covers final trees only (document that derivations export natively only — no standard exists); validation CLI runs Tier-1 acceptance (engine validation + Layer-B checks at pinned engine version) and stamps `machine-checked`; Tier-2 review is a signed field in the record edited via PR; held-out benchmark items are named as prohibited content in GOVERNANCE.md; CoNLL-U export is explicitly listed as rejected with the architecture's reasoning.
- **Tests/fixtures:** Validator round-trip on P13 sample records; TIGER-XML output validated against the ISO 24615-2 schema (obtain the public schema; if unavailable without purchase, validate against the published tiger2 schema and document the substitution).
- **Acceptance proof:** One sample record ingested end-to-end (validate → machine-checked → exported all three formats).
- **Stop conditions:** Licensing question beyond the documented caveat arises → Francis.
- **Must not change:** Babel app (no server persistence, no Grove UI).
- **Approval:** **Francis** for governance/licensing text sign-off; scaffolding itself auto.

---

## Program-level acceptance

The program is complete when: P01–P17 accepted; `verify:all` green on the final tree; the architecture's §12.1 deletion table grep-verified empty; gates G1–G8 each have a decision document with its rule applied; benchmark suite v1 frozen; one Grove record ingested end-to-end. Nothing in this program contains a deferred product decision: every "Francis" marker is an approval/launch step over fully specified content, and every "empirical" marker has a decision rule that resolves mechanically.
