> **SUPERSEDED — NON-NORMATIVE (2026-07-23).** This first-draft document is retained as history only. It contains known-rejected decisions and must not be used as a requirements source. The canonical packet is: `babel-corrected-canonical-architecture.md`, `babel-provider-grade-benchmark-architecture.md`, `babel-universal-visual-relations-architecture.md`, `babel-corrected-sol-implementation-program.md`, `babel-relations-values-exhaustive-coverage-proof.md`.

# Babel Canonical Architecture

Author: Claude Fable 5, acting as Babel's architectural decision-maker
Date: 2026-07-17
Anchor: `/Users/francisronge/Projects/Babel`, branch `codex/babel-cross-platform`, HEAD `006b803`, dirty working tree inspected as primary truth
Companion artifact: `babel-sol-implementation-program.md` (same directory)

This document makes every avoidable Babel architecture decision. It is one architecture, not a menu. Where a decision genuinely required data that does not exist, a bounded empirical gate is specified with exact inputs, metrics, and decision rules, and the architecture states which branch the gate resolves.

---

## 1. Executive Decision Summary

1. **Babel is one engine with four surfaces**: the deterministic Babel Engine (contract, validation, compilation, replay, rendering); the Babel Workbench (the single app for students and researchers — no product split, no learner/research modes); the Babel Benchmark (a separate deliverable in `bench/`); and the Babel Grove (the public derivational database/treebank, a separate repository). Benchmark and Grove are distinct projects that share only the engine and record formats.
2. **The four-field stage survives, with one rename and one minimal extension.** Contract v2 stages are `{statement, stageRecord, relations, workspaceForest}`. `visualRelations` is renamed `relations` because the object is an authored linguistic assertion consumed by the benchmark and the database, not a drawing instruction. Each relation item gains one optional open field, `values`, carrying authored non-node literals (feature-state transitions, PF exponents, rule equations). This closes the two proven evidence gaps without fake nodes, duplicated ledgers, or a closed schema.
3. **Successive complete workspaces are a sufficient derivation record.** The stage sequence is formally a prose-licensed state-sequence derivation in the sense of Collins & Stabler's formalization of Minimalist syntax (a derivation is a finite sequence of workspace states). No authored operation list or build order is added; Francis's exploratory build-order idea is rejected as duplicated bookkeeping.
4. **Reliability is solved at generation time, not repair time.** Provider-native schema-constrained output (transport shape only, prose fields free, reasoning unconstrained) structurally eliminates malformed JSON, wrong top-level shape, and mid-structure truncation. The second-model payload transcriber is deleted. The delimiter repairer survives only as a flagged mechanical mechanism expected to fire on non-schema routes. All remaining invalidity is fatal, typed, and reported specifically — never generically. No retries, no fallbacks, no partial derivations, no hidden repair.
5. **The compiler's linguistic heuristics are deleted.** Synthesized `__shell` trace nodes, null-to-`t` relabeling, movement-operation inference from prose and ID stems, head-landing collapsing, duplicate-root removal, and empty-leaf materialization all violate "Babel does not author linguistics." Rendering derives movement and identity exclusively from authored relations, anchors, `lineageId`, and `silent` — with a total-dispatch renderer that draws every authored relation, falling back to a conservative role-labelled form rather than dropping or inventing.
6. **The benchmark scores in three layers**: mechanical contract discipline (deterministic), theory-neutral derivational coherence (deterministic constraint checks), and analysis adequacy (constraint-checklist adjudication by human experts against documented analysis families — never a single gold tree). Leakage is controlled with a private held-out split, canary strings, post-cutoff refresh, and in-prompt conlang grammars. Stochastic reruns (k≥3) with dispersion reporting are mandatory for release claims.
7. **The Grove is a Redwoods-style dynamic treebank**: immutable authored records (raw text + normalized bundle + provenance + review record), views re-projected under newer engine versions, append-only correction via supersession, multiple accepted analyses per sentence by design, two-tier acceptance (mechanical, then reviewed), CC BY 4.0, versioned DOI releases, native JSON export plus ISO SynAF/TIGER-XML export of final trees only.
8. **UX keeps all four surfaces** — Canopy, Growth (Replay), Notes, Tree Bank — but binds them to one stage navigator. Notes becomes per-stage cards synchronized with Replay. A structured failure panel replaces generic errors. Benchmark and Grove workflows live outside the app.
9. **Provider policy**: user-selected route and effort are preserved exactly; the system instruction remains provider-neutral (it already is — `buildSystemInstruction` ignores its route parameter, and this becomes an invariant); no per-model linguistic patches ever.
10. **Eight empirical gates** (G1–G8) close the remaining unknowns; each is fully specified in §11.

---

## 2. Evidence Classification

Every load-bearing claim in this document is classified. Classes: **[FACT]** current repository fact verified in this run; **[FR]** Francis constraint from the context packet; **[HIST]** historical evidence, not assumed current; **[INF]** inference from evidence; **[DEC]** new Fable decision.

| # | Claim | Class |
| --- | --- | --- |
| E1 | The authored contract is exactly `{derivationStages}` or `{analyses:[{derivationStages}]}`, four fields per stage, enforced in `parseNormalization.js` (`enforceDerivationRouteContract`) and `derivationCompiler.js` (`normalizeDerivationStagesToDerivationFrames`). | FACT |
| E2 | The system instruction is ~150 lines with heavy rule accretion; `buildSystemInstruction` ignores `modelRoute` — the linguistic contract is already provider-neutral. | FACT |
| E3 | The payload transcriber exists only on the Gemini route (`parseRoutes.js:attemptPayloadTranscriber`; GPT/Claude routes throw directly). Recovery capability is therefore non-uniform across providers today. | FACT |
| E4 | `derivationCompiler.js` synthesizes syntax nodes (`${traceId}__shell`), rewrites null-like nodes to `t`/`t` word, collapses head-move landings, removes "consumed duplicate" workspace roots, and infers movement operations (A-Move/AbarMove/HeadMove) from role-name regexes, prose regexes (`/wh|a-bar|topicaliz|front/`), and node-ID stem matching. | FACT |
| E5 | `strictJson.js` performs balanced-delimiter repair, flagged `json_delimiter_damage_repaired`. | FACT |
| E6 | `stageRecord` is rejected if under 24 characters or 4 words (`isSubstantiveStageRecordText`). | FACT |
| E7 | Replay microsteps are deterministic bottom-up reveal of authored workspaces plus display transforms (preterminal materialization, casing, trace display); they are generated, not authored (`replayCompiler.ts:buildStructuralDerivationPlaybackSteps`, `buildPlaybackStepsFromDerivationFrames`). | FACT |
| E8 | The visual-relations inventory closes 154 relation clusters onto 33 grammars and 62 fixtures: 35 directly authorable, 2 Replay-derived, 25 quarantined; exactly two residual authored-evidence gaps are proven (relation-local feature values; PF exponent equations). | FACT |
| E9 | `generationRecord` provenance (prompt hashes, sent config, timing) exists and is bundle-level; the reproducibility boundary is documented in `docs/design/benchmark-provenance-conditions.md`. | FACT |
| E10 | Offline verification (`verify:all`), committed fixtures, and replay snapshots exist and were green at the July 10 Sol run close. | FACT (recency: re-anchor required, see P01) |
| E11 | Babel is neutral; genuine ambiguity returns multiple analyses; users select framework/model/effort; no partial derivations; only the model authors linguistics; open ontology; benchmark ≠ database; open source; quality over speed. | FR |
| E12 | May 2026: GPT-5.5 wrote a strong 8-stage derivation but placed stages in the wrong top-level container; the raw run failed normalization; a shape-only diagnostic repair rendered it. Gemini and Claude passed natively. | HIST |
| E13 | June 2026: all three frontier routes passed a tiny sentence at low effort after contract fixes; renderer bugs made valid model evidence look broken. | HIST |
| E14 | April 2026: smaller/local models compressed or failed the derivation-first contract; Qwen 3.5 397B passed transport but failed syntax (ternary branching, bare trace under InflP, chain IDs leaked into notes). Tested against an older, heavier contract with a ledger layer that no longer exists. | HIST |
| E15 | March 2026 runs (20-case, 100-case, 22 languages, 15 phenomena) were tree-first and are not evidence about current derivation-first reliability. | HIST |
| E16 | Format-restricted decoding can degrade reasoning ("Let Me Speak Freely?", arXiv 2408.02442); the standard mitigation is unconstrained reasoning followed by constrained formatting — which reasoning-model routes provide natively via thinking tokens. | INF (published research) |
| E17 | Redwoods/ERG established the dynamic-treebank precedent: store canonical analyses, project multiple views, disambiguate among candidate analyses via discriminants, re-annotate under grammar updates. | INF (published research) |
| E18 | ISO 24615 SynAF with the TIGER-XML serialization (ISO 24615-2:2018, confirmed 2023) is the current theory-independent interchange standard for syntactic annotation; no standard exists for exchanging staged derivations. | INF (published research) |
| E19 | Single-run benchmark reporting is now considered methodologically deficient for stochastic models; multi-run protocols with dispersion reporting are the emerging norm; provider nondeterminism persists even at fixed temperature and seed. | INF (published research) |
| E20 | Wug-style LLM testing exists for morphology (CMCL 2024; PLOS One 2025) but no published benchmark forces explicit derivational syntax over novel material — Babel's niche is real. | INF (published research) |
| E21 | Contamination controls in current practice: private held-out grading sets, canary strings, post-cutoff dynamic item generation, and paraphrase-resistance awareness. | INF (published research) |
| E22 | All architectural choices below not marked FACT/FR/HIST/INF. | DEC |

---

## 3. Ecosystem and Product Architecture

### 3.1 The four components

**Babel Engine** — the deterministic core: prompt contract, transport, validation, normalization, compilation, replay construction, rendering primitives. It lives where it lives today (`server/babelParser/`, `replay/`, `components/TreeVisualizer.tsx`, `types.ts`) and is verified provider-free (`verify:all`). Everything else consumes the engine's one canonical object, the normalized `ParseBundle`.

**Babel Workbench** — the app. One surface for students and researchers. **Decision: no product split.** The April 2026 idea of "Student Babel" vs "Research Babel" is rejected on evidence: the June run showed frontier routes at *low effort* handle small sentences quickly and cheaply under the current contract [E13], which means the existing user-selected effort dial already is the "lighter Babel"; a forked lighter contract would create a second benchmark object, a second prompt lineage, and a falsified simplification — all three prohibited by Francis's own constraints [E11]. Students and researchers see the same truth with progressive disclosure (§10).

**Babel Benchmark** — a separate deliverable in `bench/` inside the Babel repository (it shares the engine as a library and versions with it), consisting of: versioned task suites, a runner CLI, deterministic scorers, an adjudication workflow, and release artifacts. It is not an app mode and not a server feature.

**Babel Grove** — the public derivational database/treebank, a **separate repository** (`babel-grove`). It shares the engine's record formats and validation via an npm/file dependency, never server-side persistence in the app (AGENTS invariant: Tree Bank stays browser-local; no server parse persistence [FACT]).

### 3.2 Public promise, audience, and workflow of each component

| Component | Promise | Audience | Workflow |
| --- | --- | --- | --- |
| Engine | "Deterministic, provider-free verifiable. Validates and renders exactly what the model authored; invents nothing; fails specifically." | Developers, benchmark consumers | `npm run verify:all`; library import |
| Workbench | "You see what the model committed to. Pick framework, model, effort; get a complete derivation or a specific, honest failure." | Students; working syntacticians | type sentence → inspect Canopy/Growth/Notes → save to Tree Bank → export record |
| Benchmark | "Measures whether a model can author complete, framework-internal, internally consistent explicit derivations under recorded conditions. Scores discipline, coherence, and adequacy separately. Never claims a single true tree." | Model providers; NLP/linguistics researchers | run suite via CLI → deterministic layers scored → adjudication → versioned release |
| Grove | "An open, versioned, reviewed archive of model-authored derivations with full provenance. Multiple analyses coexist. It is data about analyses, not ground truth." | Syntacticians; corpus researchers; ML researchers | browse/query records → cite release DOI → submit records via PR |

### 3.3 Shared boundaries

- The **only** object that crosses component boundaries is the record triple: *(raw model text, normalized ParseBundle, generationRecord/provenance)*.
- The benchmark additionally owns suite definitions, scores, and adjudication records; the Grove additionally owns review records. Neither flows back into the engine.
- **Separation invariant:** Grove acceptance is never benchmark truth; benchmark items in the held-out split never enter the Grove; benchmark scoring never consults the Grove.

---

## 4. Canonical Derivation and Contract Architecture

### 4.1 Canonical vocabulary (normative definitions)

- **Analysis**: an ordered, complete list of derivation stages plus its derived views. One analysis = one committed theory of the sentence.
- **Ambiguity set**: the `analyses` envelope; present exactly when the model commits to ≥2 genuinely distinct structures. Ambiguity is structural (array length), never annotated: the dead `ambiguityNote` read in `normalizeParseBundle` is removed (it can never survive shape enforcement) [FACT → DEC].
- **Stage**: a *completed derivational state*: the workspace after the stage's stated commitments, with the prose that licenses it. Not a display frame, not an operation.
- **Workspace**: the forest of root syntax objects at a stage (`workspaceForest`).
- **Node**: an authored syntax object: `id` (derivational identity, stable while the object persists), `label`, `children`, optional `word`/`tokenIndex` (surface pronunciation anchor only), optional `silent`, optional `lineageId`.
- **Occurrence**: a node bearing an `id`. **Copy/chain**: the set of occurrences sharing a `lineageId`. Chain identity is *only* lineage — never ID-stem similarity, never display indices (display indices are renderer-derived, already corrected in the dirty tree [FACT]).
- **Silence**: occurrence-level `silent: true` with authored label, features, and subtree preserved. Silence is a pronunciation state, never a license to substitute an invented null or trace [FR, enforced by `tests/replaySilentSemantics.test.mjs`].
- **Relation** (v2 name; formerly `visualRelations` item): an authored non-branching assertion `{relation, anchors, values?}` — open relation name; `anchors` maps open role names to same-stage node IDs (or arrays); `values` (optional) maps open role names to authored literal strings for facts that are not nodes (§8.2).
- **Compiled view**: any deterministic projection of the authored stages: final tree, surface order, resolved relation records, Replay microsteps, Notes.

### 4.2 Is the four-field stage a full derivation? — Yes, and here is the standard it meets

The serious formal precedent for "what is a derivation" in Babel's current frameworks is Collins & Stabler, *A Formalization of Minimalist Syntax* (Syntax 19(1), 2016): a derivation is a **finite sequence of stages**, each stage a workspace (set of syntactic objects), with each transition licensed by an operation. Babel's `workspaceForest` sequence *is* that object. What Babel does differently, deliberately:

1. **Transitions are witnessed by state differences plus prose (`stageRecord`), not by an authored operation ledger.** The workspace delta between consecutive stages determines what changed; the stageRecord states why the new state is legitimate. An authored operation list would restate the same information in a second field — precisely the duplicated-ledger failure mode that was removed in the legacy cleanup and is prohibited [FR].
2. **No separately authored numeration/lexical array.** Items enter the public record when a stage makes them public. Collins & Stabler's lexical-array component is bookkeeping Babel replaces with the "no future-material parking" rule already in the contract [FACT]. This is a documented, intentional deviation, not an omission.
3. **A stage may contain several connected local operations** [FR]. Where within-stage operation *order* is itself an analytic commitment (rare: e.g., ordered probing), the existing contract rule already handles it: "Split stages that hide independent commitments." Order that matters must surface as stage granularity, not as new syntax.

**Decision D-STAGE-1: Keep exactly four authored stage fields.** `statement` (orientation headline), `stageRecord` (the public argument), `relations` (non-branching assertions), `workspaceForest` (the machine witness). Each has a distinct, non-overlapping job; removing any loses information; adding any duplicates one.

**Decision D-STAGE-2: Reject authored build order for `workspaceForest`.** Francis's exploratory idea is rejected. Evidence: (a) successive complete workspaces already determine the multiset delta; (b) within a stage, bottom-up containment order is deterministically recoverable and is what Replay already computes; (c) an ordering field would be a duplicated ledger and a new failure surface with no consumer that cannot already be served. Consequence: Replay's within-stage reveal order is presentation (see §7.4), and this is documented rather than hidden.

**Decision D-STAGE-3: The stage-count policy stays sentence-driven** (no floors, no atomization) [FR, already contract].

### 4.3 The smallest principled contract change: v2

Two changes, shipped together as one versioned contract event (one prompt-hash change, one benchmark condition change):

**D-CONTRACT-1: Rename `visualRelations` → `relations`.** The field is the benchmark and database object for non-branching linguistic assertions [E8]; "visual" both misdescribes it to consumers and invites models to treat it as decoration. The authoring guidance that made the old name useful ("author a relation when branching geometry does not already express the claim") is kept verbatim in the prompt — the *test* stays visual-geometric; the *object* is named for what it is.

**D-CONTRACT-2: Add optional `values` to relation items.** `{relation: string, anchors: Record<string, string|string[]>, values?: Record<string, string>}`.

- `anchors`: unchanged — every value must resolve to a same-stage expanded-workspace node ID. This remains the witness discipline.
- `values`: open role names to authored literal strings, for exactly the class of facts the inventory proved unanchorable [E8]: relation-local feature-state content (`{"probe_state_before": "uφ:__", "probe_state_after": "φ:3PL"}`), PF realization content (`{"root": "√LAUGH", "exponent": "-ed", "result": "laughed"}`), rule/equation text. Rules: values are authored linguistics (model-only); the renderer displays them only when authored (satisfying "exact values only when authored" [FR]); values must not restate node labels or anchors (prompt rule; deterministically *flagged* when a value string equals an anchored node's label, never rejected); values require no resolution and cannot reference node IDs as a back-door anchor (a value that exactly matches an existing node ID is flagged).

Why this is the smallest change: the alternatives were (a) fake anchor nodes — prohibited [FR]; (b) typed relation subschemas — a closed ontology [FR]; (c) allowing anchor values to be objects mixing node refs and literals — overloads the witness discipline and complicates validation for every relation to serve a minority. One optional open map adds zero burden to the 35 already-authorable relation families and exactly closes the two proven gaps plus the quarantined correspondence-map family (§8.3).

**D-CONTRACT-3: Everything else in the stage contract is retained as-is**: refId carryover semantics, lineage rules, silence rules, token-index rules, forward-derivation rules, anchor-witness rules. These encode five months of failure evidence and are the contract's substance.

**D-CONTRACT-4: Node metadata fields `case`, `assigner`, `caseEvidence`, `caseOvert` are retired from the authored surface.** They appear in `types.ts` but nowhere in the prompt contract [FACT — models cannot systematically author them]; they are legacy display affordances. They remain type-optional for fixture compatibility and are excluded from the v2 schema; any future case display comes from `relations` + `values` (a Case relation with authored values), which is the open-ontology way to say the same thing.

---

## 5. The Authorship / Canonicalization / Validation / Compilation / Elaboration / Rendering Boundary

This is the normative six-layer boundary. Every current behavior is assigned a layer and a verdict (retain / flag / delete) in §12.

**L0 — Model authorship (linguistics).** Stages, prose, nodes, IDs, lineage, silence, relations, values, the ambiguity envelope. Only the model writes these. Nothing downstream may add, remove, relabel, reattach, or reinterpret a syntax object or relation.

**L1 — Transport canonicalization (mechanical, meaning-preserving, always flagged).** Allowed: BOM/whitespace strip; strict JSON parse; balanced-delimiter repair *only if* the repaired text parses and the flag `json_delimiter_damage_repaired` is recorded [E5 — retained]; parsing of transport-stringified JSON values (a `workspaceForest` sent as a JSON string) with flags. Forbidden: field-synonym harvesting (the current `statement||summary||claim||note` and `anchors||participants||supportAnchors` fallbacks in `normalizeDerivationFrameChange` are deleted — v2 has exactly one name per field and the schema enforces it); prose mining; any second-model transcription (§6).

**L2 — Deterministic validation (fatal, typed, specific).** The complete fatal set: wrong top-level shape; missing/extra stage fields; empty `statement`; empty `stageRecord` (**the 24-character/4-word substance thresholds are deleted** — D-VAL-1: thin-but-real prose is a quality fact for the benchmark, not invalidity; rejecting usable output over an arbitrary length is exactly historical problem #10); malformed node objects; duplicate refId in one forest; unresolvable refId; same tokenIndex on two non-silent terminals in a stage; final stage's overt terminals not spelling the exact input tokens; unresolvable relation anchors; malformed `values`; a pronounced item marked silent. Every rejection carries: stage index, field path, rule ID, offending value excerpt. No repair at this layer, ever.

**L3 — Normalizing compilation (meaning-neutral projection).** Allowed: refId expansion; final-tree selection from the last stage whose single canonicalized root spells the input; surface-order derivation; relation resolution (anchor → node record with label, resolved/visible flags); lineage-class computation; display-index assignment; ID stabilization for rendering. Deleted (D-COMPILE-1, the compiler purge — full inventory in §12): every function that synthesizes or mutates syntax nodes or infers movement semantics. After the purge, L3 contains **zero** node creation and **zero** operation classification.

**L4 — Replay elaboration (presentation of authored states).** Deterministic bottom-up reveal microsteps within each authored stage; workspace-root ordering for layout; carried-relation display; trace/silence display formatting. Invariant (D-REPLAY-1): microsteps may sequence and style the reveal of authored nodes; they may never introduce a node the stage does not contain, never remove one, never change a label except by declared display notation (§7.4). Microsteps are explicitly *not* authored linguistic stages; the UI labels them as generated elaboration.

**L5 — Rendering.** D3 drawing of L3/L4 output. Dispatch of open relation names into finite visual grammars happens here and is total (§8.4).

---

## 6. Reliability Architecture

Goal restated precisely: Babel should essentially never fail for *system* reasons (malformed transport, contract misunderstanding of shape, brittle deterministic rejection of good output, renderer defects), while linguistic inadequacy and true generation failure remain visible, honest, and specific. No retries, no fallback models, no partial derivations, no silent semantic repair [FR].

### 6.1 Prevention: schema-constrained transport (D-REL-1)

All three provider routes adopt provider-native structured output constrained by a JSON Schema derived mechanically from the v2 contract:

- OpenAI: Structured Outputs (`response_format`/`text.format` with `json_schema`, strict).
- Gemini: `responseSchema` / structured output config.
- Anthropic: structured output via the current API's output-format/tool-schema mechanism.

The schema encodes **transport shape only**: the envelope alternation, the four stage fields in order, node object fields, relation item fields. `statement`, `stageRecord`, labels, IDs, relation names, role names, and values remain unconstrained strings — the open ontology is untouched and no linguistic choice is schema-biased. Reasoning quality is protected because on all three routes the reasoning happens in unconstrained thinking tokens before the constrained visible output — the exact "reason freely, then format" mitigation the format-restriction literature prescribes [E16].

Effect: malformed JSON, wrong top-level shape (the May GPT failure class [E12]), and mid-string truncation become structurally impossible on schema routes. What schemas cannot enforce — anchor resolution, token alignment, lineage coherence — remains L2's job, as it must.

Truncation: `max_output_tokens` is budgeted per sentence length; the finish reason is checked; a length-stop is a typed fatal failure ("generation truncated at N tokens"), never a parse attempt on a fragment.

Gate **G1** (§11) verifies per-provider that schema mode does not degrade linguistic content; the architecture default is schema-on, and G1 can only revert a specific provider route with evidence.

### 6.2 Removal: the payload transcriber is deleted (D-REL-2)

The guarded second-model transcriber (`attemptPayloadTranscriber`, `payloadFirewall.js` fingerprints, transcriber provenance fields) is removed entirely. Reasons, in order of force:

1. **Benchmark fairness is currently broken by it**: it exists only on the Gemini route [E3], so providers do not face the same recovery conditions. Extending it to all routes would deepen the problem it creates.
2. **It puts a second model inside an artifact attributed to the first.** The fingerprint firewall is strong for the parsed-payload path, but the pure-JSON-failure path relies on substring gates over raw text that cannot prove semantic identity of tree structure.
3. **Its failure classes are eliminated upstream** by D-REL-1. After schema transport, the transcriber's remaining coverage is approximately zero on provider routes.
4. Francis considers the mechanism ugly and conditionally removable [FR]; the condition (equal consistency without deterministic/model-mediated linguistic invention) is met by D-REL-1.

The delimiter repairer stays (L1, flagged) because it is mechanical, cannot invent linguistic tokens, and remains useful on the local route where schema enforcement may be unavailable. Any benchmark result carrying a repair flag is reported in the "transport-repaired" partition, never as a native pass (§9.6).

### 6.3 Honest failure reporting (D-REL-3)

Every failure is one of four typed classes, surfaced in the Workbench failure panel and in bench output:

1. **Provider/transport** (network, quota, auth, timeout) — outside "never fails" scope by definition [FR].
2. **Truncation** — with the token budget and finish reason.
3. **Contract invalidity** — with stage index, field path, rule ID, and excerpt (L2 typed errors). The raw model text is downloadable from the failure panel (already written to debug payloads server-side; the panel exposes it).
4. **No committed structure** — the derivation completed but no final stage spells the input; reported with the last stage's actual overt yield vs. the expected tokens.

The generic "Malformed parse result from model" experience is retired. A user or benchmark consumer can always answer: *what exactly was wrong, and what did the model actually say?*

### 6.4 Contract-side prevention: the prompt rewrite (D-REL-4)

The 150-line system instruction is rewritten into four layers with an explicit ownership rule — every rule must either state framework voice, derivational semantics, or a check; all shape rules that the schema now enforces are deleted (raw-JSON-only preamble, field-order and field-presence rules, "workspaceForest must be a JSON array" transport rules, top-level-placement rules). The semantic rules (forward derivation, occurrence identity, silence, licensing, anchor witnessing, stage granularity) are retained and deduplicated — they encode real observed failure modes and are the contract's actual content. Expected size: roughly half of current. This is a benchmark-condition change and ships inside the single v2 contract event with new hashes [E9].

### 6.5 What "never fails" means, precisely

After D-REL-1..4: a frontier model that understands the linguistic task cannot fail on JSON, shape, or field placement; cannot be rejected for prose length; cannot be rejected because deterministic code failed to recognize a label or relation name (open ontology + total dispatch); and cannot appear broken because of renderer defects without that being distinguishable (renderer failures are engine bugs testable against fixtures, and Growth/Canopy render from validated bundles only). The failures that remain are the ones Babel *wants* visible: the model's own linguistic and contract-semantic inadequacy.

---

## 7. Compilation, Replay, and Rendering Truthfulness

### 7.1 The compiler purge (D-COMPILE-1)

Deleted from `derivationCompiler.js` / `parseNormalization.js` (each violates L0 exclusivity; full file-level inventory in §12): `materializeImplicitPhrasalTraceShellsInDerivationFrames`, `materializeCommittedTraceShells`, `canonicalizeHeadTraceSourceInForest` (null→`t` rewriting), `collapseMalformedHeadMoveLandings`, `removeConsumedDuplicateWorkspaceRoots`, `promoteSentenceMatchingLeaves` and `materializeEmptyStructuralLeaves` (as applied to authored forests), `inferMovementOperationFromChange` and its A-Move/AbarMove/HeadMove classification, `normalizeMovementStemFromId` and all ID-stem chain guessing, `findHeadMoveHostNodeIdFromSurfaceCue` (quoted-prose surface mining), `inferMovementPairFromStateTransition`'s non-lineage branch, and `hasConcreteMovementSupport`'s prose regexes.

Retained in L3: refId expansion (`expandSameStageSubtreeRefs` — carrying authored structure forward is the contract's own semantics), lineage-class computation (`buildLineageWitnessIndexFromForest` — reading authored `lineageId` is not inference), committed-root selection by exact token spelling, and resolved-relation construction (`buildResolvedVisualRelationsFromDerivationFrames`) minus its trajectory-role classification (moves to L5 dispatch).

### 7.2 What replaces the heuristics

Movement and identity display derive from exactly three authored sources: (1) `relations` with their anchors; (2) lineage classes across consecutive stages (an occurrence pronounced in stage *n*, with a lineage-mate silent in stage *n+1*, is a displayable state transition — the two Replay-derived fixtures F39/F40 [E8]); (3) `silent` states. If the model authored none of these for a movement analysis, **Babel draws no arrow** — the trees still render, the stage prose still explains, and the absence is itself model evidence. This is the honest cost of the purge and it is correct: an arrow Babel infers is an arrow the model did not commit to.

Gate **G3** (§11) measures the visible delta of the purge across the fixture corpus and the research-capture corpus before the purge ships.

### 7.3 Derived `derivationSteps` are demoted (D-COMPILE-2)

The synthesized per-frame `derivationSteps` (with inferred `Checkpoint`/`StateChange`/`HeadMove` operations and the appended synthetic `SpellOut` step) stop carrying operation labels that sound authored. Replay consumes stages and relations directly; the steps object survives only as an internal replay-plan structure with neutral stage identifiers. No compiled view may print an operation name the model did not author.

### 7.4 Replay microsteps: defined status (D-REPLAY-1)

Microsteps are **presentational reveal of authored state** — Francis's "lexical steps" description is accurate for the reveal sequence and is adopted as their official definition. Permitted display transforms, each declared in the replay documentation: preterminal expansion for terminals authored as `{label, word}` (drawing the category over the surface word is notation, not new syntax — both facts are authored); silence muting; sentence-initial casing adjustment before fronting; trace display formatting with renderer-assigned indices. Prohibited and removed where present: any transform that manufactures `∅`/`t` leaves for silent authored structure (already corrected in the dirty tree and locked by `replaySilentSemantics.test.mjs` [FACT]); suppression of authored stageRecord content (the low-signal-text filter applies only to *generated* fallback text, never authored prose — enforced by test).

---

## 8. Relations and Deterministic Rendering (the Open-Ontology Resolution)

### 8.1 The resolution in one sentence

The ontology stays open at L0; the renderer is total at L5: **every authored relation renders, through a finite set of visual grammars, with a conservative role-labelled form as the guaranteed floor — dispatch chooses style, never truth, and the authored strings are always displayed verbatim.**

### 8.2 Dispatch design (D-RENDER-1)

Dispatch is a pure function of: anchor topology (role count, arity per role, whether witnesses are terminals/heads vs phrases, silence states, shared lineage among anchored nodes) plus keyword classes over the open relation and role names. Its output is one of the implemented grammars plus a `renderFamily`/`renderStatus` record (types already exist [FACT]). Guarantees: (a) totality — unknown names dispatch to the role-labelled hyperedge grammar (grammar 5 in the inventory's basis [E8]), rendering anchored nodes connected and labelled with the authored relation and role names; (b) fidelity — misdispatch can mis-style but cannot misstate, because all displayed text is authored; (c) evolvability — new grammars refine dispatch without contract change, which is exactly where the AGENTS invariant already places finite classification [FACT].

### 8.3 Disposition of the 25 quarantined studies (D-RENDER-2)

| Group | Fixtures | Disposition |
| --- | --- | --- |
| Relation-local values and correspondence maps | F17, F18, F34–F38, and the value-bearing parts of F56, F59 | **Promoted to authorable** by `values` (D-CONTRACT-2). These were the only genuine missing-evidence cases; the inventory's two "Residual Contract Candidates" are exactly these. |
| Whole-analysis judgment (nullary anchor) | F46 | **Stays out of contract.** Babel analyses are committed convergent derivations [FR: no partial derivations]; judgments about inputs belong in stageRecord prose and in benchmark adversarial-suite adjudication, not in an anchor-less relation that would break the witness discipline. Revisit only if G4/G5 show models spontaneously attempting authored judgments. |
| Signed-language, loci, tiers, prosodic intervals | F41–F45, F62 | **Far-future scope** [FR]. Remain quarantined lab studies. |
| Other-framework machinery (HPSG, TAG, FB-TAG, Interaction Grammar, Dynamic Syntax, RRG) | F48–F53, F54, F55, F60 | **Future-framework work.** Quarantined until those frameworks are added honestly as selectable frameworks with native representations; they must not be flattened into the current tree contract [FR]. |

Net: the current contract plus v2 `values` is sufficient for everything inside Babel's declared scope. No further contract extension is pending.

### 8.4 Production promotion order (D-RENDER-3)

Grammars land fixture-first, in this order: (1) role-labelled hyperedge fallback — the totality floor, first because it makes every other promotion safe; (2) occurrence/pronunciation-state class (lineage glow + silence states); (3) trajectory presets (exists; re-based on authored anchors/lineage only after the purge); (4) domain/region; (5) feature/value plaque and realization plate (requires v2 `values`); (6) coindexation/reference marks. Each promotion ships with its atomic fixtures from the 62-fixture ledger and replay snapshot tests. Everything else remains lab-only until a concrete need is demonstrated by Grove or benchmark data.

---

## 9. Benchmark Architecture

### 9.1 Identity

Name: **the Babel Benchmark for Explicit Derivation**. Object of measurement: the committed derivation bundle — can a model author a complete, framework-internal, internally consistent, adequately argued explicit derivation for a controlled input, under recorded conditions? This is disjoint from grammaticality-preference benchmarks (BLiMP/SyntaxGym/CoLA) and from parser-accuracy evaluation against gold trees; no published benchmark occupies this niche [E20].

### 9.2 The three scoring layers (D-BENCH-1)

**Layer A — Contract discipline (deterministic, engine-scored).** Native-pass rate; failure-class distribution (transport-repaired / truncated / contract-invalid / no-committed-structure); tokens, latency, cost. The May GPT case [E12] is the canonical Layer-A failure: excellent linguistics, failed discipline — the layers exist so that this distinction is a *reported fact* rather than a judgment call.

**Layer B — Derivational coherence (deterministic, theory-neutral).** Constraint checks computable from the bundle, each a violation count, all derived from the framework's *own* stated commitments, never from a preferred analysis: branching arity per framework; endocentricity; token alignment; lineage coherence (multiple pronounced lineage-mates in one stage without same-stage license; lineage classes that appear and vanish incoherently); anchor validity margins; forward-derivation violations that are mechanically detectable (a clausal root whose entire dominated spine first appears in the same stage it appears in — flagged, weight-limited, because full forward-ness is not mechanically decidable); spurious-ambiguity detection (structurally equivalent trees inside `analyses`). Layer B is the Qwen case's home [E14]: ternary CP, bare trace under InflP.

**Layer C — Analysis adequacy (adjudicated, constraint-based, never gold-tree).** Each benchmark item ships with an *item card*: input, language, framework(s), a phenomenon checklist ("the wh-dependency must be represented with a non-pronounced lower occurrence in whatever form the chosen analysis licenses"; "the passive subject must originate predicate-internally *if* the analysis is a movement analysis — a base-generation analysis must state its licensing"), and a documented set of acceptable analysis families with literature citations. Reviewers judge three things: instantiates a recognized family or a coherently argued novel analysis (novel ≠ wrong — neutrality [FR]); satisfies the checklist; stageRecord argumentation quality (3-point scale). Protocol: two independent expert reviews, adjudicator on disagreement, all review records published with the release. An LLM pre-screen may *flag* items for reviewer attention but has no scoring authority — a model judging models is a neutrality conflict. The precedent for scoring-without-one-gold is Redwoods' discriminant model [E17]: adequacy is membership in a documented space of candidate analyses, not distance from one tree.

### 9.3 Ambiguity and theory policy (D-BENCH-2)

- Results are always reported per (model, framework, effort) condition. No cross-framework aggregate, no "best framework."
- Ambiguous items: item cards list expected distinct analysis families. Default scoring accepts any single adequate analysis; a dedicated *enumeration sub-suite* explicitly instructs exhaustive enumeration and scores recall of families (this is the only place ambiguity coverage is scored, because the product contract deliberately does not force enumeration on every sentence [FACT: "return one analysis unless…"]).
- Spurious duplicate analyses are Layer-B violations.

### 9.4 Task suites (D-BENCH-3)

1. **Core phenomena suite**: stratified phenomenon × language matrix; the 15-phenomenon taxonomy from the March runs is carried forward as the seed taxonomy [E15], re-authored as derivation-first item cards (March items themselves are published/contaminatable and tree-first — reused as dev/demo only, never held-out).
2. **Multilingual scope**: 24 languages selected by typological strata, not resource availability: word order (SVO/SOV/VSO/V2/flexible), wh-strategy (movement/in-situ), pro-drop, case alignment (nom-acc/erg-abs/split), agreement richness, script. Fixed list: English, German, Dutch, French, Spanish, Portuguese, Italian, Russian, Polish, Hindi, Turkish, Japanese, Korean, Mandarin, Arabic, Hebrew, Swahili, Basque, Georgian, Finnish, Hungarian, Tagalog, Irish, Greek. Framework applicability per language is declared on the item card (both current frameworks claim cross-linguistic scope; where an analysis family is contested for a language, the card documents the families rather than pretending consensus).
3. **Novelty/wug suite**: §9.5.
4. **Enumeration (ambiguity) sub-suite**: ~20 classically ambiguous items per release.
5. **Consistency sub-suite**: a fixed 12-item subset run k=5; reports *analysis-family stability* (does the model commit to the same family across reruns?) and Layer-A/B variance. Instability across legitimate families is **reported, not penalized** (neutrality); within-run incoherence is already Layer B.
6. **Adversarial terminology sub-suite**: items where surface cues invite a memorized construction label that the actual structure contradicts (e.g., garden-path-adjacent frames, pseudo-passives, look-alike raising/control minimal pairs). Scored under B + C; designed to separate terminology recall from derivational competence.

### 9.5 Novelty and leakage architecture (D-BENCH-4)

Leakage-resistant families, applying current contamination practice [E20, E21]:

- **Nonce-lexeme items**: wug-style invented stems and inflections in controlled syntactic frames (the LLM wug precedent is morphology-only; Babel extends it to derivation: the model must build structure for words it cannot have memorized).
- **Template-generated novel sentences**: item *templates* are published; concrete lexicalizations for held-out runs are generated fresh per release from held-out seed vocabularies.
- **In-prompt conlang mini-grammars**: the item supplies an explicit small grammar specification (ordering, agreement, movement trigger) for an invented language and asks for the derivation of a target sentence *under that stated grammar*. Immune to memorization by construction; directly tests derivation-from-stated-rules. (This also answers historical question #9 about unusual inputs — the capability becomes a measured suite, and G4 first measures whether the current engine even accepts such inputs.)
- **Minimal mutations**: paired items differing in one structural trigger.
- **Controls**: a private held-out split (never published; run locally by Francis or via graded submission — the Microsoft MMLU-CF pattern); a canary GUID embedded in every published data file; per-release post-cutoff refresh of one third of held-out items; published/dev vs held-out results always reported separately, and divergence between them is itself a published contamination signal.

### 9.6 Conditions, reruns, and reproducibility (D-BENCH-5)

- Conditions per run: exact model ID, effort, schema mode, max tokens, prompt/template hashes, engine version — all already carried by `generationRecord` [E9]; bench archives raw text for every run of published items.
- Provider APIs are stochastic even at fixed settings [E19]; therefore: k=3 reruns minimum for every scored item, k=5 for the consistency sub-suite and headline numbers; report per-condition mean, min–max, and bootstrap 95% CI on Layer A/B rates; Layer C adjudicates each run's bundle independently for headline items and the best-of-k is *additionally* reported (labeled) because providers legitimately care about both typical and attainable quality.
- Repair partition: results split native / transport-repaired / failed [D-REL-2]; only native passes feed headline scores.
- A release = versioned tuple (suite vX, contract vY with hashes, engine vZ, condition matrix, all scores, dispersion, adjudication records, raw outputs for published items, claims document). Claims are always of the form "under contract vY and framework F, model M at effort E …" — never "M knows syntax."

### 9.7 What providers receive

Public: the dev split with item cards, the runner CLI (works against their own keys), the scoring code for Layers A/B, release reports. On request: held-out grading of submitted bundles. The benchmark never requires Babel's UI; it is a library + CLI + data contract.

---

## 10. Derivational Database / Treebank Architecture (the Grove)

### 10.1 Record model (D-GROVE-1)

The unit is the **Grove record**, an immutable JSON document:

```
{
  groveId, schemaVersion,
  sentence, language, framework,
  analysisIndex,                       // which analysis within the bundle
  raw: { modelText },                  // exact provider output
  bundle: { ...normalized ParseBundle analysis... },
  generationRecord, provenance, integrityFlags,
  engineVersion,                       // engine that produced the normalized bundle
  review: { tier, reviewers[], date, judgment, notes },   // tier 1|2, judgment: sound | sound-with-notes
  supersedes?: groveId,
  license, submittedBy, submittedAt
}
```

The **authored core is immutable** (raw text + generationRecord). Normalized bundles and all views are *re-projectable*: when the engine improves, records re-normalize under the new engine version with both versions' integrity results retained. This is the Redwoods dynamic-treebank model [E17] applied to model-authored derivations: store the canonical source, project views, re-annotate under upgrades — never mutate the source. A record whose raw text fails a newer engine's validation is not deleted; it is flagged `engine-vN-invalid` with the typed reason, which is itself research data.

### 10.2 Why this is richer than final-tree corpora

Penn-style treebanks store one final analysis per sentence; PDT stores layers; Redwoods stores full grammar derivations; UD stores dependencies. None stores *staged derivations with authored inter-stage relations, occurrence lineage, silence states, and the model's own argumentation*, and none stores systematic *analytic variation across analyzers* as a first-class dimension. The Grove's query dimensions — sentence × framework × model × effort × analysis family × stage structure — are its research contribution. Full derivations export only in the native JSON schema (no interchange standard carries derivations [E18], and this is documented rather than worked around); final trees additionally export to ISO SynAF 24615-2 / TIGER-XML (current, theory-independent, confirmed 2023 [E18]) and to labeled bracketing (exists). **CoNLL-U export is rejected**: constituency-to-dependency conversion is a lossy, theory-laden transform that would put deterministic code in the business of linguistic reinterpretation.

### 10.3 Acceptance and governance (D-GROVE-2)

- **Tier 1 (mechanical)**: record validates under a pinned engine version, Layer-B coherence checks pass under declared thresholds. Automatable; labels the record `machine-checked`.
- **Tier 2 (reviewed)**: a named human reviewer records a structured judgment (sound / sound-with-notes / rejected) with notes. Rejected records are not published (the Grove is an accepted-parse archive, not a dump — the benchmark, not the Grove, is where failures are data).
- Governance: Francis is the founding editor; the governance file defines how reviewers are added (editor invitation, public review history); every record carries reviewer identity. Disagreement between reviewers on later re-review produces a superseding record, not an edit.
- Corrections: append-only supersession chains (`supersedes`); deletion only for legal/privacy necessity, leaving a tombstone.
- Multiple analyses: coexistence is the point — per sentence, across models, frameworks, and time. No record is "the" analysis of a sentence.

### 10.4 Licensing, citation, access (D-GROVE-3)

- License: CC BY 4.0 for records, with a documented caveat on model-output copyright status and each provider's output-usage terms recorded per record's provider field. Code under the repository's open-source license.
- Citation: versioned releases with DOIs (Zenodo); records are stable-ID citable.
- Public/local boundary: the Grove is public. The Workbench Tree Bank remains browser-local personal storage [FACT invariant] and gains an "export Grove record" action; ingestion is PR-based file submission to the `babel-grove` repository — no server persistence enters the app, no accounts are required (consistent with Francis's no-accounts inclination without deciding hosting).
- Held-out benchmark items never enter the Grove; published-split benchmark bundles may, marked `benchmark-origin`.

---

## 11. Empirical Validation Program

Every remaining unknown is closed by one of eight gates. Each specifies inputs, metrics, and a decision rule; each unlocks a named architecture branch. Gates are cheap by design (quality outranks speed, but these are bounded scouting instruments, not releases).

**G1 — Schema-constrained transport A/B.** *Inputs*: 24 sentences (8 easy / 8 medium / 8 hard, drawn from prior research sentences), 3 providers × 2 frameworks × schema-on/off × k=2 → 576 runs at medium effort. *Metrics*: Layer-A failure classes; blinded pairwise linguistic-quality judgment (Francis or reviewer) on 24 sampled pairs per provider. *Decision rule*: for each provider, schema-on ships if (contract-failure rate does not increase) AND (quality is not judged worse in >30% of sampled pairs). *Resolves*: per-provider default in D-REL-1; the transcriber deletion (D-REL-2) proceeds regardless — its precondition is honest failure, not zero failure.

**G2 — Contract v2 reliability baseline.** *Inputs*: same 24 sentences under contract v1 and v2 (rename + values + rewritten prompt), 3 providers, high effort, k=3. *Metrics*: native-pass rate, Layer-B violation counts, relation-authoring rate, values-authoring rate (spontaneous), token cost. *Decision rule*: v2 ships if native-pass rate is within 5 points of v1 or better per provider; a worse result triggers prompt-layer diagnosis (one iteration permitted) before shipping. *Resolves*: D-CONTRACT-1/2 rollout confidence and whether further prompt simplification is needed.

**G3 — Compiler-purge render parity.** *Inputs*: every committed fixture bundle plus all archived research captures (May/June runs, `.artifacts` captures). *Metrics*: pixel/structure diff of Canopy and Growth renders pre/post purge; per-diff triage into (a) heuristic was inventing → correct to drop, (b) authored evidence exists but generic path missed it → renderer gap to fix before shipping. *Decision rule*: purge ships when category (b) is empty. *Resolves*: D-COMPILE-1 shipping order.

**G4 — Unusual-input generality probe.** *Inputs*: 18 items — 6 nonce-lexeme sentences, 4 emoji/symbol-token sentences, 4 conlang-with-in-prompt-grammar items, 4 code-mixed/rare-script items — one provider (strongest current route), high effort, k=2. *Metrics*: engine acceptance (does tokenization/validation handle the input at all), native-pass rate, qualitative derivation adequacy. *Decision rule*: engine-side rejections (tokenizer, validator) are bugs to fix (historical question #9 becomes "resolved by current code" or "fixed here"); model-side failures parameterize the novelty suite difficulty. *Resolves*: whether the wug suite (D-BENCH-4) needs contract or tokenizer accommodation.

**G5 — Novelty suite calibration.** *Inputs*: draft wug suite (30 items) run on 3 providers, k=3. *Metrics*: Layer A/B/C-lite scores; item discrimination (variance across providers). *Decision rule*: items with zero discrimination or systematic ambiguity in their checklists are revised; suite freezes at ≥25 discriminating items. *Resolves*: novelty suite v1 content.

**G6 — Multilingual breadth scouting.** *Inputs*: 24 languages × 2 items × 1 provider × k=2, medium effort. *Metrics*: native-pass and Layer-B rates per language; script/tokenization failures. *Decision rule*: languages with engine-side (not model-side) failures get engine fixes before suite authoring; the 24-language list is confirmed or substituted within the same stratum. *Resolves*: D-BENCH-3 language list feasibility.

**G7 — Stochastic stability protocol validation.** *Inputs*: consistency sub-suite (12 items), 3 providers, k=5, two efforts. *Metrics*: analysis-family stability, Layer-A/B variance, CI widths. *Decision rule*: if CI widths at k=3 are within 20% of k=5 widths for Layer-A/B rates, k=3 is confirmed as the general minimum; otherwise k rises to 5 globally. *Resolves*: D-BENCH-5's k.

**G8 — Latency/cost envelope.** *Inputs*: logged data from G1/G2/G6 (no new runs). *Metrics*: per-provider, per-effort latency and cost distributions. *Decision rule*: publishes the Workbench guidance table (which effort for which sentence class) and the benchmark's cost disclosure. *Resolves*: UX guidance copy and bench budget planning.

---

## 12. Migration From the Exact Current Codebase

### 12.1 Deletions

| Current code | Action | Authority |
| --- | --- | --- |
| `parseRoutes.js`: `attemptPayloadTranscriber`, `buildPayloadTranscriberSystemInstruction`, `buildPayloadTranscriberContents`, `attachPayloadTranscriberProvenance`, transcriber call sites | Delete | D-REL-2 |
| `payloadFirewall.js` (all fingerprint gates) | Delete with the transcriber | D-REL-2 |
| `routeConfig.js`: `PAYLOAD_TRANSCRIBER_*` constants | Delete | D-REL-2 |
| `types.ts` / provenance: `payloadTranscriber*` fields | Delete | D-REL-2 |
| `derivationCompiler.js`: node-synthesis and movement-inference set listed in §7.1 | Delete | D-COMPILE-1 |
| `derivationCompiler.js`: `isSubstantiveStageRecordText` length/word thresholds | Delete (keep non-empty check) | D-VAL-1 |
| `derivationCompiler.js`: field-synonym fallbacks (`summary/claim/note`, `participants/supportAnchors`, `kind/type/label` for relation) | Delete (schema guarantees exact names) | L1 rules |
| `parseNormalization.js`: `ambiguityNote` read | Delete (dead under shape enforcement) | §4.1 |
| Prompt: all shape/transport rules subsumed by schema | Delete | D-REL-4 |
| Node fields `case/assigner/caseEvidence/caseOvert` from authored surface | Retire | D-CONTRACT-4 |

### 12.2 Retentions

Strict JSON + flagged delimiter repair (`strictJson.js`); the four-field validation core; refId expansion; lineage indexing; committed-root selection by exact token spelling; `generationRecord`; offline fixtures and `verify:all`; Replay's bottom-up reveal engine and stage-record blocks; the silent-semantics guarantees in the dirty tree; Tree Bank; the provider routes and user effort selection; the AGENTS.md contract (amended where superseded below).

### 12.3 Rewrites and replacements

- System instruction → four-layer v2 prompt (D-REL-4).
- `visualRelations` → `relations` end-to-end (types, prompt, compiler, replay, tests, fixtures) with `values` support (D-CONTRACT-1/2).
- Error surface → typed L2 errors end-to-end into a Workbench failure panel (D-REL-3).
- Trajectory resolution → authored-anchor/lineage-only, with L5 total dispatch and the hyperedge fallback grammar (D-RENDER-1).
- Notes view → stage cards synchronized with Replay (D-UX-1, §13).
- `derivationSteps` → neutral internal replay plan (D-COMPILE-2).

### 12.4 Decisions superseding older plans and current implementation

- Fable plan 009 (relation render-family classifier) is superseded by D-RENDER-1 total dispatch (same direction, now with the totality floor and post-purge evidence rules).
- Plans 005/010/011 remain REJECTED/SUPERSEDED as recorded [FACT]; nothing here revives Vercel/production work [FR].
- The `plans/README.md` backlog items "committed benchmark runner" and "per-provider raw fixtures" are absorbed into the benchmark architecture (§9) and its Sol packages.
- The April "Student/Research Babel split" direction is formally closed (§3.1).
- The current implementation's recovery posture (transcriber + heuristics) is superseded by D-REL-1/2 + D-COMPILE-1.
- The March 100-case results remain historically valid publications but are declared non-evidence for current reliability [E15]; the benchmark rebuilds its suites derivation-first.

### 12.5 Historical problems: final classification

| # | Problem (packet §8) | Classification |
| --- | --- | --- |
| 1 | Malformed JSON / unacceptable shapes | Historical; residually current on non-schema paths; **resolved by architecture** (D-REL-1) pending G1 |
| 2 | Smaller models can't carry the contract | Historical evidence against older, heavier contract [E14]; **unmeasured** on current contract; not a design driver (frontier-first product), measurable via bench Layer A |
| 3 | Multi-minute derivations | Current fact of high-effort frontier routes; a *condition*, not a defect; user-selected effort is the control; G8 publishes the envelope |
| 4 | Contract misunderstanding | Partially current (May GPT shape case is schema-resolved; semantic misunderstanding remains) ; **measured** henceforth by Layer A/B; mitigated by D-REL-4 |
| 5 | Over-specific prompting biases analysis | Architecture decision: v2 prompt keeps framework voice + semantics only; open ontology preserved; no per-model patches (D-PROVIDER-1) |
| 6 | Notes too long/awkward | Current UX defect; **resolved by design** D-UX-1 |
| 7 | Prompt bloat | Current fact [E2]; **resolved by** D-REL-4 |
| 8 | Model-specific ad-hoc rules accumulate | Resolved in current code for the prompt (provider-neutral instruction [E2]); made an invariant (D-PROVIDER-1) |
| 9 | Unusual-input generality unknown | **Unmeasured**; closed by G4 |
| 10 | Deterministic rejection of useful output + generic failure | Current in specific forms (stageRecord thresholds, synonym gaps, generic errors); **resolved by** D-VAL-1, D-REL-3, open-ontology totality |

---

## 13. UX and Information Architecture

**D-UX-1.** One app, four surfaces, one derivational object:

- **Canopy** — the committed final tree; relation overlays toggleable; the right place to read a relation-heavy end state. Retained because Growth cannot serve calm final-structure inspection while animating.
- **Growth (Derivation Replay)** — the derivation: authored stages as chapters, generated reveal microsteps within them, visually distinguished ("stage" vs "step") so authored linguistics and presentation are never conflated (D-REPLAY-1's UI face).
- **Notes** — restructured into per-stage cards: `statement` as heading, `stageRecord` as body, that stage's `relations` (names + resolved witnesses + authored values) as chips; the bracketed-notation block stays at the end. Notes stops being a wall of prose without deleting anything authored.
- **Stage navigator** — the binding element: selecting a stage anywhere selects it everywhere (Growth seek, Notes scroll, Canopy relation-highlight when the relation's stage is selected). This is the concrete answer to "Replay overshadows Canopy": they stop competing because they are navigations of one object.
- **Tree Bank** — unchanged storage; gains export/import of Grove record files.
- **Failure panel** — typed failure class, specific rule, raw-output download (D-REL-3).
- **Selectors** — framework, model, effort stay exactly as user choices; the applied effort and model ID are displayed from the bundle.
- Benchmark and Grove have **no app surface**; they are CLI/repository deliverables. The Workbench link to them is documentation.

Students and researchers differ in *defaults*, not truth: default-collapsed relation chips and microstep detail for a first-time user; everything expandable. No falsified simplification exists anywhere in the UI.

---

## 14. Model/Provider Architecture

**D-PROVIDER-1.** The system instruction is provider-neutral and stays so; the vestigial `modelRoute` parameter of `buildSystemInstruction` is removed to make the invariant structural. Per-model behavior differences are handled only at the transport layer (schema syntax, token budgets, effort vocabulary) — never in linguistic instructions.

**D-PROVIDER-2.** Routes: `gemini`, `gpt`, `claude`, `local` as today; models env-pinned; the benchmark pins exact model IDs per release. Adding a route (Sol/Terra/Grok/local upgrades) requires only: transport adapter, schema support declaration, effort-vocabulary mapping, and a G1-style scouting run — no contract change.

**D-PROVIDER-3.** Effort remains user-selected per provider's own vocabulary; the existing downgrade mapping (`normalizeProviderReasoningEffort`) is kept and the *applied* value is surfaced. No cross-provider effort normalization is pretended; the benchmark reports effort as-selected per provider.

**D-PROVIDER-4.** No retries, no fallback models, no automatic route substitution, anywhere [FR]. Timeouts remain honest transport failures.

---

## 15. Internal Contradiction Audit

1. *Open ontology vs deterministic rendering* — resolved without closure: dispatch is finite, rendering is total, authored strings are always shown; misdispatch affects style only (§8). No contradiction remains.
2. *"Never fails" vs "no retries/fallbacks/repair"* — resolved by moving prevention to generation time (schema), keeping all remaining invalidity fatal-but-specific. The delimiter repairer is the single surviving repair; it is mechanical, flagged, and partitioned out of benchmark-native results. Consistent.
3. *`values` vs "no duplicated ledgers"* — `values` may only carry facts present nowhere else (their defining property); duplication is flagged, not invited. Consistent.
4. *`values` vs "no fake syntax nodes / exact values only when authored"* — values are authored, not synthesized; the renderer shows them only when present. Consistent.
5. *Neutrality vs Layer-C scoring* — Layer C scores membership in documented analysis families plus internal argument quality; it never ranks families; novel coherent analyses are admissible. Consistent with "Babel does not select the best analysis."
6. *Benchmark vs Grove separation* — held-out items never enter the Grove; Grove never feeds scoring; the shared record format is transport, not truth-flow. Consistent.
7. *No partial derivations vs honest failure* — a failed generation shows a failure report and raw text, never a rendered partial tree. Consistent.
8. *Deleting compiler heuristics vs student usability* — post-purge, un-authored movement simply has no arrow; trees, prose, and stages still render completely. The cost is honesty, not breakage; G3 verifies no authored evidence is dropped. Consistent.
9. *Schema constraint vs "closed prompting biases analysis"* — the schema constrains shape only; every linguistic string remains free. Consistent.
10. *Rename vs "four-field stage is strongly preferred"* — the four-field structure is kept exactly; one field is renamed to what it already is. The preference was for the structure's clarity, which the rename serves.
11. *One app vs student usefulness* — low-effort routes are the lightweight path [E13]; defaults differ, truth does not. Consistent.
12. *Microsteps vs "only the model authors linguistics"* — microsteps are declared and displayed as generated presentation; they add no nodes and no operation claims post D-COMPILE-2/D-REPLAY-1. Consistent.

## 16. Remaining Empirical Gates

G1–G8 (§11) are the complete list. No other decision in this document is contingent on data. The gates are scheduled inside the Sol program; none blocks Package 1.

## 17. External research anchors

- Collins & Stabler, *A Formalization of Minimalist Syntax*, Syntax 19(1) 2016 — derivations as stage/workspace sequences (§4.2).
- LinGO Redwoods dynamic treebank and discriminant annotation — [lingo.stanford.edu/redwoods](http://lingo.stanford.edu/redwoods/) (§9.2, §10.1).
- ISO 24615-2:2018 SynAF TIGER-XML serialization, confirmed 2023 — [iso.org/standard/62491.html](https://www.iso.org/standard/62491.html) (§10.2).
- Format restrictions and reasoning: *Let Me Speak Freely?* — [arxiv.org/abs/2408.02442](https://arxiv.org/pdf/2408.02442) (§6.1).
- LLM wug testing: CMCL 2024 — [aclanthology.org/2024.cmcl-1.15](https://aclanthology.org/2024.cmcl-1.15/); PLOS One 2025 community-size study — [journals.plos.org/plosone](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0343164) (§9.5).
- Contamination: static-to-dynamic survey — [arxiv.org/abs/2502.17521](https://arxiv.org/pdf/2502.17521); private benchmarking (TRUCE) — [arxiv.org/abs/2403.00393](https://arxiv.org/pdf/2403.00393) (§9.5).
- Variance-aware evaluation: ReasonBENCH — [researchgate.net/publication/398476054](https://www.researchgate.net/publication/398476054_ReasonBENCH_Benchmarking_the_InStability_of_LLM_Reasoning); inference-backend nondeterminism — [arxiv.org/html/2605.19537](https://arxiv.org/html/2605.19537) (§9.6).
