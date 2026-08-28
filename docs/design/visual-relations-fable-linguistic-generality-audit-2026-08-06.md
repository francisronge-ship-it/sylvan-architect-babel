# Visual Relations: Linguistic Correctness and Generality Audit

Date: 2026-08-06
Auditor: Fable (final pre-architecture audit)
Scope: every active Lab card in `docs/design/visual-relations-current-lab.tsx` (102 active cards + 1 compliant inactive card), the accepted fallback prototypes, the lab adapter and geometry modules, the coverage matrix, all dated research notes, and the production renderer boundary (`components/TreeVisualizer.tsx`, `replay/replayCompiler.ts`). Audit only; nothing was modified.

Method: each card's authored stages, relations, and trees were read directly; adapter dispatch was traced in `visual-relations-lab-adapter.ts`; source claims were verified against the cached figures in `visual-relations-assets/` by inspecting the images themselves, not captions or prose. Where a claimed source is not in the cache and not documented in a dated dossier, the card is classified G regardless of how confident its status string sounds. All 595 Lab tests pass; that establishes the mechanical baseline (anchor resolution, trace legality, single pronunciation per chain) and nothing more — several defects below live in exactly the space the tests do not check.

---

## Executive Verdict

**The Lab is not ready for production stitching.** The core is real: 48 of 102 active cards are confirmed correct and general against inspected primary-source figures, the geometry module's fail-closed rules are genuinely load-bearing, and the movement-witness machinery is the right production pattern. But the audit found 14 linguistically wrong cards, 4 source-unfaithful cards, and 10 cards whose claimed sources cannot be verified from the repository — including two entire "covered" fixture families whose source plates are simply not cached. The coverage matrix asserts "covered"/"sourced" for at least four fixtures (F16, F31, F58, F65) that the research record either never sourced or explicitly declined to source. Separately, the production bridge cannot carry roughly fifteen accepted designs at all (`values`/`priorAnchors` are dropped), and production's movement dispatch violates the Lab's own exact-name law by substring regex, which would draw movement arrows for authored non-movement relations. No card should be stitched until the C/D defects are fixed, the G sources are cached or the cards demoted, and the three production-boundary defects are resolved.

### Count by category (102 active cards)

| Category | Count |
| --- | --- |
| A — confirmed correct/general | 48 |
| B — correct but under-generalized | 26 |
| C — linguistically wrong | 14 |
| D — source-unfaithful | 4 |
| E — redundant/no distinct overlay | 0 |
| F — contract-illegal (standalone) | 0 (one F-grade *component*: an extra-contract `ghost` node field, filed under its card's B) |
| G — unresolved, evidence insufficient | 10 |

The inactive Sigma-to-Pol card is compliant history (correctly excluded, drawing matches Pasquereau ex. 59) and is not counted. The six fallback prototypes are audited separately below (5×A, 1×A−, dispatcher B) — but note they are all self-labeled NOT ACCEPTED while the coverage matrix defers F07/F09/F15 closure to them.

---

## C — Linguistically wrong (fix before any stitching)

1. **Identity / Copy Chain** (flagship card). Two distinct chains — the *did* head chain and the *which book* phrasal chain — are both authored with the literal trace word `t_1` (`t_identity_did_trace` vs `d_book_edge_trace`/`n_book_edge_trace` etc.). The renderer defers to authored indices, so two unrelated chains display the same subscript: a false identity assertion in the flagship identity card. Fix is trivial (`t_2` for one chain); the deeper defect is that nothing prevents authored index collisions (see cross-cutting §3).
2. **Remnant Movement** (with D flavor). The fronted VP (`vp_rt_high`) deliberately omits the scrambling trace inside it, on the stated rationale that "a trace at a landing would say the phrase both arrived and did not." That confuses a trace *of* the fronted VP with the trace *inside* it. On the den Besten & Webelhuth/Müller analysis the card names, the fronted constituent is `[VP t₁ … gelegt]` — the internal gap is the entire analytical point of "remnant." As authored, the two VP occurrences are non-isomorphic, undermining chain identity, and a test suite rule enforces the wrong choice ("every remnant trace sits in the vacated structure, none at a landing"). No source plate is cached to defend the deviation.
3. **Bounding-Node Crossing (wh-island).** The authored boundaries are matrix TP + the *whether*-CP. Under the Subjacency notation the card explicitly invokes (verified against `source-recovery-2026-07-26/island-subjacency-cas-lx522-slide24.jpg`, which cuts at the two IPs and states "IP is a bounding node in English"), CP is not an English bounding node; the correct crossed pair in `domainTree` is embedded TP + matrix TP. The renderer machinery is category-neutral and correct; the authored analysis is wrong, and the companion complex-NP card's "TP and CP" framing inherits the error.
4. **Ellipsis / Sluicing.** The sluice CP is headless (`cp_sluice` directly dominates the *why* AdvP and the silent TP — no C, no null C, no C′), the only structurally incomplete projection in its family. And there is no wh-connectivity: the Lab's own adopted Merchant plate (verified, `silence-ellipsis-pronunciation/merchant-ellipsis` p.21, exx. 55/56b) puts the remnant's trace *inside* the unpronounced TP; here the silent TP is just "Mia [past] left" with no origin position or operator relation for *why*. Base-generated *why*-sluices exist in the literature, but no such source is cited or cached.
5. **Multidominance / Shared Subject.** The shared DP sits in Spec,TP; *neither* authored VP "parent" dominates it. Drawing both bare VPs as mothers asserts dominance no analysis proposes (parallel-merge subject sharing shares a vP-internal position and remerges — requiring copies the card does not author), yields a three-mother object, and would geometrically attach the subject as sister-of-V. The first Multidominance card's topology is the only legal shape; this card must be corrected or retired.
6. **Full Gapping Correlate Alignment** (with D). Tree malformed: in both conjuncts `VP → [V, V′[DP, AdvP]]` leaves a headless V′ with its head adjoined above its own projection, and the coordination is subjectless. Overlay invented: the only qualifying source (`kato-gapping-page-2.png`, verified) shows index labels only — no curves, no rail; the 2026-08-01 note explicitly ruled "do not invent arrows between the pairs," and inventory §12 records NO SEPARATE VISUAL RELATION. The card contradicts the project's own recorded decision, and coverage F58's "source-matched lower correspondence rail" is unsupported by any cached figure.
7. **Cyclic Agree.** Geometry is faithful to Keine & Dash p.680, but the source states second-cycle Agree arises *only if first-cycle Agree fails*. The card's cycle 1 succeeds on an accessible DP (`outcome: 'first-cycle search'`, no authored failure), yet cycle 2 fires anyway — the demonstration derivation contradicts the cited analysis's licensing condition. Fix at authoring level (author cycle-1 failure/inaccessibility).
8. **Cyclic Agree (embedded clause).** Inherits defect 7 verbatim.
9. **Intervention / Relativized Minimality.** Three independent defects: (i) hard tree bug — the silent copies of the *which student* chain author the N word **'book'** (`intervention-ea-n` lineage: pronounced member 'student', silent members 'book'), so the rendered copies read "which book" and collide with the real object *the book*; (ii) the Spec,vP→Spec,TP step is authored `AbarMove` though it is A-movement — exactly the false-record naming the registry's own `amove` comment forbids; (iii) the blocked target is a plain definite DP with no feature-class parity with the intervener, so the authored configuration is not a well-formed RM competition. The dashed-X mark is additionally unsourced (see G).
10. **Ordered Case Stacking.** The 2026-07-30 record found no qualifying case-stacking overlay convention and prohibited a generic stack relation, yet the card's status text asserts "the source supplies two ordered CASE slots" — no source is named or cached (G component), and coverage F31 calls it "sourced." Independent tree defects: a KP directly dominating TP (null K taking a clause complement) is unattested as authored, and the chain's occurrences are structurally mismatched — the high position is a bare NP (*Mina*, no D), the low position a bare D (*t*, no NP) — violating the complete-lower-witness rule and binding one lineage across N and D.
11. **PF Realization (suppletion).** The single row `√GO + T[past] → went` anchored to the root terminal alone asserts a two-terminals-to-one-exponent mapping while `T[past]` remains a separate, unrealized, non-silent leaf. By the Lab's own F35 line ("Fusion changes the number of terminals; suppletion realizes an already-single terminal"), this is portmanteau/Fusion, not suppletion. The Embick–Noyer convention for suppletion is conditioned allomorphy with an explicit context (`√GO → went / __ T[past]` plus `T[past] → ∅`), and the plate grammar has no context field — the inventory itself still marks contextual allomorphy/suppletion MISSING. Card and inventory contradict each other.
12. **Theta Roles / Argument Grid.** The overlay is correct and general (verified `theta-grid-cas-lx522-slide33.jpg`), but the tree is incoherent: `vp_arguments_theta` is a VP dominating only [DP][PP] with **no V head** — a headless projection.
13. **Theta Roles / Unaccusative.** One-role grid arity is proven, but the card is titled *Unaccusative* while the Theme is base-generated in Spec,TP with no VP-internal origin and no A-chain — the structure unaccusativity denies. Retitle or author the chain.
14. **Sideward Movement** (with G component). Cited Barnickel fig. 155 is cached nowhere and the card self-describes as "candidate." The trees are independently incoherent: `vp_additional_sw` is a VP containing two DPs and no verb (*krault* sits in C with no chain), and the primary conjunct has no VP at all.

## D — Source-unfaithful

1. **Binding / C-command Failure.** No cached source draws Condition-A failure as a highlighted intervening NP; the correction dossier lists "binding failure" as an explicitly open decision, and the excluded F46 judgment fixture means the ungrammaticality is carried nowhere authorable. The card also inverts the `domain` role's semantics (obstruction rather than licensing domain), and the licensed-vs-failed contrast rides on an implicit heuristic (`showBinderIndex: domainNodes.includes(bound)`), not an authored outcome. Author `values.outcome` with a real plate, or move to inactive history.
2. **Pair Merge (lexical member).** Verified `pair-merge-ginsburg-figure4.png`: the source draws D with *no dominance branch and no DP mother* — the nominal host alone projects. The card's tree makes D and NP daughters of a **DP** mother, i.e. the pair *member* projects, contradicting both the source structure and the relation's own asymmetry claim.
3. **LF Reconstruction** and **LF Reconstruction (predicate AP)** (D-minor, both). Strike direction is now correct (verified against Poole & Keine ex. 2: struck = neglected, bold = interpreted), but the adapter draws a dashed QR-styled path between the copies. The source draws *no connector* — copies are linked by subscript — and the 07-26 dossier explicitly warns reconstruction "does not require a separate reconstruction trajectory." The sourced device (shared index) is the one thing not drawn. The trees themselves are excellent and genuinely different; only the connector is wrong.

## F-grade component (contract legality)

- **Partial Copy Deletion (Resumptive D)** (card otherwise B; linguistically the strongest card in its family, verified against Yip & Ahenkorah (39)–(41)): the deletion/realization trees author `ghost: true`, a field that does not exist on `SyntaxNode` in `types.ts` — an extra-contract flag smuggled into authored trees. Also `lineageId`s appear only from stage 3 onward, so authored chain identity is stage-inconsistent. The contract checker should reject unknown authored node fields.

## G — Unresolved: claimed evidence is not in the repository

These cards assert source conventions the cache cannot substantiate. Either cache the figure and document it in a dated dossier, or demote the card/design.

1. **Parasitic Gap in a Subject Island (connected)** and **(blocked)** — the claimed Phillips primary-circle/secondary-square/double-slash convention is cached nowhere; nothing to verify circles, squares, or slash against. The blocked card additionally calls its CP a "finite relative clause" when the authored structure is a complement clause (no operator/gap), which would make the pg unbindable on a true relative reading. Coverage F65 "covered" is therefore unsupported.
2. **Split Antecedence** — the claimed "Dillon and Johnson" source exists nowhere in the repo except the card's own status string. The 07-30 dossier's verified figure 169 is an anaphor→antecedent linking arrow *not on a tree*, with no ⊕ notation, and that dossier concluded "do not add a general Reference family from this pass." The tree is also malformed (headless V′ over [DP][PP]). Coverage F16 "sourced" is unsupported.
3. **Cooper Storage** — contract-legal and well-staged, but no cached figure, no dossier, and the inventory row still reads MISSING; the card's "following the source figure" claim is locally unverifiable.
4. **Negative Concord / Accord** — no cached figure or dossier; the "dashed directed elbow" sits in direct tension with the no-arrows-for-features rule and only an actual plate can license it.
5. **Strong-NPI Licensing** — theory-specific ExhP/OnlyP sketch; no cached source; inventory row MISSING.
6. **F-Projection** — node-anchored (no prosodic-tier violation), but no cached source backs the upward propagation arrows; inventory MISSING.
7. **Focus Marking (subject / object / embedded)** — low-risk G ×3: coherent, and the three cards genuinely prove anchor-driven generality, but the licensing figure (Assmann et al. 2023 ex. 49, metrical reversal) is **not cached**; the only cached figure (ex. 44) shows a different convention (blue node highlighting). The 07-26 dossier documents ex. 49 precisely, so the risk is low — but the audit standard (verify the image) cannot be met until ex. 49 is cached.

Also G-components inside cards counted elsewhere: the dashed-X blocked-path mark on both Intervention cards (unsourced; the phase1 note itself flags it), the Belletti carrier-stroke convention on Smuggling, the sideward cross-workspace arc (the Nunes/Oded source draws *no* arrow — by the project's own admission standard, which rejected Haida & Repp for exactly this, the arc is an invented convention needing either a plate or an explicit declared-invented status), and the Ordered Case Stacking source claim.

## B — Correct but under-generalized (26 cards, actionable subset)

Full list: Lowering ×2; Roll-up Movement; Smuggling; Parasitic Gap (two adjunct gaps); Sideward (parasitic-gap derivation); Control Dependency; Binding / Principle A; Operator/Variable Binding ×2; Intervention / Superiority; Bounding-Node Crossing (complex NP); Multiple Phase Boundaries; Right Roof ×2; Phase Boundaries (nested and disjoint); Ellipsis Licensing (VPE); Partial Copy Deletion ×2; Argument Sharing (resultative); Deletion (structured DP); Phrasal Spell-Out; Many-to-Many PF Correspondence; Local Dislocation; QR / Inverse Scope; Antecedent-Contained Deletion.

The defects that matter most:

- **Lowering ×2**: arrow-only with no displacement witness (the Glossa source draws before/after states); `lineageId 'past-affix'` shared between the T affix and its V host marks two lexical items as one derivational object (boundary-11 misuse); syntactic vs postsyntactic lowering untyped though the inventory requires the distinction; phrasal-lowering reclassification is a `/P$/` label regex, not topology.
- **Roll-up**: vacated phrases compacted to a single silent leaf with no head — violating the structurally-complete-witness standard the chain cards uphold, with no Shlonsky figure cached to license the compaction.
- **Operator/Variable Binding ×2**: a directed path is drawn though only binding is authored (implicit movement license), and the terminal-endpoint preset is hard-restricted to bare-D operators — a phrase-sized operator has no correct rendering path. The second context varies only the variable's position.
- **QR / Inverse Scope**: the card is right, but the shared rule routes QuantifierRaising through `single()` twice — a legal tree authoring *two* QR relations (a real two-quantifier LF) silently renders only the first. The rule, not the card, fails the materially-different-tree test.
- **Antecedent-Contained Deletion**: QR and ellipsis are authored in one stage, so Replay cannot introduce the steps in sequence — a boundary-8 violation for a multi-step relation. (Cross-check from another auditor: the relative clause lacks an operator chain binding the object gap.)
- **Right Roof ×2**: the relative clause is smuggled in as a hyphenated pseudo-terminal (`who-was-responsible`) — the source's triangle means abbreviated real structure; Babel's tree asserts a nonexistent word. Babel needs a legal abbreviation affordance or full structure.
- **Ellipsis Licensing (VPE)**: the Aelbrecht source's vP contains the subject trace; the card base-generates the subject in Spec,TP, silently dropping a structural witness the source draws.
- **Argument Sharing (resultative)**: Hiraiwa & Bodomo fig. 19 has Foc *lá* dominating both verbal domains; the card hoists the left VP above FocP to engineer the surface order instead of authoring the head movement the source presupposes.
- **Bounding-Node Crossing (complex NP)**: boundaries are genuine (NP+TP), but the single-swoop dependency also crosses matrix TP unmarked — the crossing set is under-reported.
- **Phrasal Spell-Out**: in every source panel the inner NP carries its own complementary `⇒` mark; the card's single `-nak` label over the whole DatP (including *Mira*) over-claims the lexicalized span. Single unfrozen context, correctly unfrozen.
- **Many-to-Many PF / Local Dislocation**: the adapter *parses* value microformats (`=>` pairs; numeric group sizes with no sum check) despite its own verbatim-values doctrine; Local Dislocation also skips the source's K-to-Poss Lowering step, getting surface order from a tokenIndex permutation instead of the derivation the source depends on.
- **Deletion (structured DP)**: coherent as an F61 contrast fixture, but a synthetic construction — must not be read as accepted linguistic coverage.

## A — Confirmed correct/general (48 cards)

Verified against inspected figures, with genuine generality witnesses (materially different second configurations, anchor-driven dispatch):

Phrasal Movement; Head Movement; Identity (four occurrences); Identity (passive); Parasitic Gap; ATB ×2 (Torr fig. 3.31 verified — the card's sentence is Torr's own (92)); Control (object control); Plain Coreference ×2; Predication ×2 (Brownlow fig. 57, Enfield fig. 207 verified); Agree ×2 (incl. Expletive Associate, Deal fig. (3) — Deal's arrow deliberately translated to plaque per documented policy); Multiple Agree ×2 (Nevins ex. 61 verified, including the asymmetric routing); Feature Sharing ×2 (Keine (18)); Case Assignment ×2 (Norris (37)); Dependent Case ×2 (Poole pp. 8–9, including per-frame replacement semantics); Phase Boundary; Transfer/Spell-Out + Post-Transfer Access (Fong Defs. 1–2 exact); Anti-Locality ×2 (Newman's bar-tip verified); Improper Movement ×2 (Poole (51)/(52), region and hosts fully authored); Pair Merge (phrasal); Blocked Extraction ×2 (Oseki fig. 20); Idiom Chunks ×2 (Ahn 94a/b exact); Ellipsis/Silent Structure; Ellipsis Licensing (Merchant 56b exact); Pseudogapping + Gapping (Gengel verified, correct frame order and persistence); Multidominance/Sharing (within the recorded DAG-affordance decision); Argument Sharing (serial) (Hiraiwa–Bodomo fig. 19); Zero Realization; PF Realization; Fission (verbatim source match incl. `priorAnchors` birth/death); Impoverishment (delinking figure exact); Cyclic Linearization ×2 (Fox–Pesetsky Scenarios 1–2 exact); QR (covert) + QR (clause-bounded).

Caveats recorded on A cards (not blocking, worth fixing in passing): the Agree plaque's `Case: NOM` bookkeeping row is not in the cited plate; Multiple Agree's English-host disclaimer lives only in a code comment; the Phase card's Sara-in-Spec,vP surface string is not a legal EPP clause (fine for the Lab, not exportable as an authoring pattern); the PF trees use a surface token as a node label (`laughed`); the serial-predicates oval overlap is stretched mark geometry, not a constituent hull, and must be documented as such.

## Fallback prototypes (P1A–P1F)

Verdicts: p1a–p1e **A**, p1f **A−** (backward cue is boolean-only; prior-witness reveal under-specified), dispatcher **B**. Neutrality is real and test-enforced: pure topology dispatch (rename-invariant), zero arrowheads, no relation-name printing, no ghost nodes, values geometry-invariant, marks appear only from the authored stage. Contract legality verified for all six fixtures.

Two problems to resolve before stitching:

1. **Status contradiction.** Everything self-labels NOT ACCEPTED and sits outside the registry and coverage counts — yet the coverage matrix *defers* F07, F09, and F15's set-algebra remainder to "the final fallback pass." The closure plan depends on artifacts the record calls disposable.
2. **Scale rules exhaust.** The frame vocabulary runs out at two arrays (a third array collides with the first's frames/numerals), and mixed scalar+array shapes fall to closure, dropping a pairing two scalars *did* author. F09's 2×3 hyperedge lands in the closure row — defensible, but the matrix must then say F09 renders as participation marks only, not a drawn hyperedge.

The `.tsx` harness (MutationObserver, DOM scraping, simulated clicks, text regex) is acceptable for a disposable Lab card and disqualifying as a production pattern.

## Production renderer boundary (verified firsthand)

1. **Confirmed:** production renders trajectory-compatible relations only; non-trajectory relations surface as Replay text blocks; none of the ~40 Lab lens drawings has a production counterpart.
2. **Sharpest risk:** `isMoveLikeOperation` (`replay/replayCompiler.ts` ≈4422) dispatches by lowercased **substring regex** (`/move|lower|front|shift|clitic|affix|focaliz|…/`) over open names, after an exact-name allowlist. An authored non-movement `CliticCluster`, `AffixRealization`, or `FocusShift` would be drawn as a movement arrow between its first two anchors. This directly violates the Lab adapter's stated law (case/whitespace folding only, "no regex, no substring matching").
3. **Fail-closed witness rule absent in production:** when `witnessNodeId` is not authored, `resolveArrowAnchorNode` guesses (any trace-like leaf, else any overt leaf, else the shell) — precisely the silent-wrong-endpoint behavior the Lab's `resolveTraceWitness` exists to prevent.
4. **Bridge drops authored fields — confirmed:** `toRendererStages` passes `{relation, anchors}` only; the production contract and replay compiler never see `values` or `priorAnchors`. Consequence: every design whose payload lives there — Agree/FeatureBundle plaques, VocabularyInsertion rows, Fission, Impoverishment, Local Dislocation, Cyclic Linearization, all `outcome`/`label` diagnostics (Anti-Locality, Right Roof, Blocked Extraction, parasitic-island), Ellipsis Licensing features — is **unstitchable** until the production contract adopts both fields. That is a contract change under AGENTS.md review discipline.
5. **Authoring boundary:** the renderer never mutates authored trees, but replay materializes synthetic display leaves (`::__leaf`, `replayLayoutOnly`) and a *reserved synthetic head-landing leaf* for head-like relations. Display-only today; one refactor away from a boundary-9 violation if `::__` ids ever leak into anchors or exports.

## Registry/record corrections required

The coverage matrix cannot currently be trusted as evidence of source fidelity:

- **F16** (Split Antecedence): "sourced card" — the record's own dossier declined to source a Reference family; the claimed figure is uncached.
- **F31** (Ordered Case Stacking): "sourced" — the 07-30 audit found no qualifying convention and prohibited the relation.
- **F58** (Full Gapping): "source-matched lower correspondence rail" — the source shows labels only; the 08-01 note explicitly forbade inventing the curves.
- **F65** (Parasitic gap in island): "covered" — the Phillips plate is not in the cache.
- **F67** remains `missing` (the copy-vs-repetition no-guess regression is not implemented) and **F07/F09** remain `missing` by design — with F09 needing an explicit "marks only" statement.
- Every registry `basis` claim should carry a provenance pointer to the dated dossier and cached asset that licenses it; four claims outran the record, so the rest cannot be assumed sound without the pointer.

## Cross-cutting renderer requirements (for the later architecture)

**Dispatch and naming**
1. Exact-name dispatch everywhere, production included. Replace `isMoveLikeOperation`'s substring regex with the folded exact-match registry; unregistered names route to the neutral fallback, never to a movement arrow.
2. Directed marks are licensed per exact relation name, each backed by a cached plate (Nevins, Keine–Dash, Poole, Norris). Binary Agree/FeatureBundle stay arrow-free plaques. Open probe-goal-shaped relations never inherit arrows.
3. Endpoint treatment (head vs phrase shell) must derive from authored anchor topology, not from label-suffix regexes (`/P$/`, `/(?:P|')$/`) and not from the relation name alone — the operator-variable preset already breaks for phrase-sized operators.

**Authored payloads**
4. Carry `values` and `priorAnchors` across the production bridge, typed and verbatim. Then either declare per-relation value schemas or forbid microformats — today `=>` pairs, numeric group sizes, and hierarchy+`delinkAfter` are all silently parsed despite the verbatim doctrine.
5. Reject unknown authored node fields (`ghost: true`), and define semantics for pronounced leaves without `tokenIndex` at intermediate stages.
6. Violations/outcomes are always authored (`values.outcome`, `values.label`), never inferred from anchor containment; failure iconography is per-source (bar-tip, midpoint ✗, region-edge ✗, starred double-headed curve) keyed off relation name + authored outcome — never a generic X. Fail closed on internally inconsistent authoring (group sizes that don't sum; `licensed` over contradictory orders).

**Identity and chains**
7. Reserve `lineageId` for derivational identity only. It is currently overloaded across at least six families (controller–PRO, binder–anaphor, coreference pairs, ellipsis antecedent–ghost, affix–host, parasitic-gap display index). Referential/recoverability coindexation belongs in the relation; the object-control card proves relation-derived indices suffice.
8. One authority for chain indices, with a machine check: leaves sharing a `lineageId` must carry consistent lexical material (catches the Intervention 'book' bug), chain occurrences must be structurally parallel (catches the case-stacking D/NP mismatch), and authored literal indices must not collide across chains (catches the Identity card).
9. One copy-isomorphism convention: full structural copies, gap-stripped landing copies, and single-leaf compaction currently coexist across the chain, remnant, and roll-up cards; boundary 9 needs an explicit ruling on landing-internal carried material.

**Rendering semantics**
10. Production must render N instances per relation. The Lab's `single()` shapes silently degrade Control, Binding, Coreference, CaseAssignment, FeatureSharing, Intervention, and QR to first-instance-plus-diagnostic; real inverse-scope LFs require two QRs. Likewise `lens.coindex` is last-writer-wins across families — indices must accumulate.
11. Persistence is a per-design property owned by the compiled replay plan (Poole steps replace; Keine–Dash cycles accumulate; movement persists) — not a global replay rule, and never derived by scraping rendered text.
12. Two silence semantics need visually distinct treatment: PF-silent (ellipsis) vs LF-neglected (pronounced but uninterpreted) are currently ghosted identically. Reconstruction links copies by shared index, not by any path.
13. Multi-step compositions get one frame per relation step (ACD currently authors QR and ellipsis in one stage).
14. Keep the fail-closed geometry semantics as production behavior: single-dependency binding for boundary cuts, no bottom-edge exits, no coincident crossings, witness-required trajectories. Port `resolveTraceWitness` to production and delete endpoint guessing.
15. Quarantine synthetic display structure (`::__` leaves, the reserved head-landing leaf) from anchor resolution, relation endpoints, and exports.
16. First-class overlay API: per-node geometry (label rect, subtree span), current stage index, and stage-scoped persistence exposed to overlay renderers — no DOM scraping, no simulated clicks.
17. Tree QA gates for authored fixtures and future model output: headedness (no headless VP/V′/CP), no surface tokens as node labels, no hyphenated pseudo-terminals (provide a legal abbreviation affordance instead), and a single ruling on the recurring in-situ-subject/EPP-less TP pattern.
18. Multidominance legality gate: at least one authored parent must dominate the shared node; refuse the overlay when the shared node c-commands its claimed parents. Sharing-domain ovals are marks, not constituent hulls, and the contract must say so.
19. Card-visible disclaimers for non-English patterns on English hosts (Multiple Agree), and the "declared notation" mechanism (Σ) documented per relation.

## What must happen before renderer architecture is trustworthy

1. Fix the 14 C cards (most are authoring-level fixes; Remnant Movement requires reversing a test-enforced design decision and should be decided by Francis).
2. Resolve the 4 D cards (two are one-line connector/domain-semantics fixes; Binding-failure and Pair-Merge-lexical need a decision).
3. For each G item: cache the plate and write the dossier entry, or demote the card/design (the Focus trio likely just needs the ex. 49 crop cached; Cooper Storage, Accord, Strong-NPI, F-Projection, and the Phillips island pair need genuine recovery work or demotion to unfrozen/inactive).
4. Correct the coverage matrix (F16, F31, F58, F65, F09-wording) and add provenance pointers.
5. Decide the fallback prototypes' status: they are the closure plan for F07/F09/F15 and cannot stay "NOT ACCEPTED" while carrying that weight.
6. Adopt `values`/`priorAnchors` in the production contract, replace the substring dispatch, and port witness fail-closure — these three are prerequisites for stitching anything beyond bare trajectories.

The A core plus the geometry and witness machinery is a sound foundation. The system is not ready, and the gap is precisely enumerable: it is the list above.
