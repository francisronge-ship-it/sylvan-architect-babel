# Babel Visual Relations Phase 1 Primitive Recovery

Status: Phase 1 live-lab recovery packet, not a production design spec.

Date: 2026-07-27

Checkout observed:
- Branch: `codex/babel-cross-platform`
- HEAD: `e9a70903ea3e64fab7ec409683a88381ebbf51d9`
- Dirty tree: large pre-existing tracked and untracked worktree; this packet is task-owned and does not normalize or absorb the rest.

Live inspection surface:
- HTML route: `http://127.0.0.1:8765/docs/design/babel-visual-relations-research.html`
- Full-page screenshot: `/private/tmp/babel-vr-phase1-full.png`
- Card-scale screenshots: `/private/tmp/babel-vr-phase1-cards/01-*.png` through `/private/tmp/babel-vr-phase1-cards/38-*.png`
- Contact sheets: `/private/tmp/babel-vr-phase1-contact-1.png` through `/private/tmp/babel-vr-phase1-contact-7.png`

This pass inspected the live rendered lab through Playwright at card scale and cross-read `docs/design/visual-relations-current-lab.tsx` and `docs/design/visual-relations-lab-adapter.ts`. It did not edit the lab, renderer, parser, prompt, contract, fixtures, or inventory.

## Active Lab Set

The current renderer lab contains 37 active cards and 1 inactive history card.

Active cards:
1. Phrasal Movement
2. Head Movement
3. Lowering
4. Lowering (embedded clause)
5. Identity / Copy Chain
6. Identity / Copy Chain (passive)
7. Control Dependency
8. Control Dependency (object control)
9. Binding / Principle A
10. Binding / C-command Failure
11. Plain Coreference
12. Plain Coreference (across coordination)
13. Agree / Feature Valuation
14. Agree / Expletive Associate
15. Bounding-Node Crossing (wh-island)
16. Bounding-Node Crossing (complex NP)
17. Phase Boundary
18. Multiple Phase Boundaries
19. Ellipsis / Silent Structure
20. Ellipsis / Sluicing
21. Multidominance / Sharing
22. Multidominance / Shared Subject
23. PF Realization
24. PF Realization (suppletion)
25. QR / Covert Scope
26. QR / Inverse Scope
27. QR / Clause-Bounded Scope
28. Operator / Variable Binding
29. Operator / Variable Binding (subject variable)
30. LF Reconstruction
31. Focus Marking (subject focus)
32. Focus Marking (object focus)
33. Focus Marking (embedded focus)
34. Theta Roles / Argument Grid
35. Theta Roles / Unaccusative
36. Intervention / Relativized Minimality
37. Intervention / Superiority

Inactive history:
- Sigma-to-Pol Polarity Response. Kept as a bounded historical plate from Pasquereau-style polar response analysis, not a general NPI or arbitrary negation drawing.

Important count boundary: this is a card inventory, not a relation-completion count. Several cards are stress variants of the same primitive.

## Recovered Candidate Primitives

### 1. Base tree geometry

Claim represented: constituent structure authored by the model: projection, dominance, sisterhood, complement/specifier/head geometry, and surface/pronunciation state.

Current use: every card.

Must not use it for: any relation whose point is not already visible in authored tree geometry. This primitive is the substrate, not an overlay answer.

Required authored evidence: `workspaceForest`, node labels, children, `word`/`tokenIndex`, `silent`, `lineageId`.

Replay behavior: staged by derivation frames; no extra relation overlay unless a relation names it.

### 2. Overt trajectory arrow

Claim represented: a licensed movement/path relation between an earlier/lower occurrence and a later/higher occurrence.

Current use: phrasal movement, head movement, lowering experiments, ordinary wh/operator paths where the relation is analyzed as movement.

Can use: `Move`, `InternalMerge`, `AbarMove`, `HeadMove`, `Raising` when analyzed as movement, `Scrambling`, object shift when analyzed as movement.

Must not use: identity/copy alone, coreference, binding, control, Agree, feature valuation, theta assignment, resumption, ordinary dependency, or generic "relation."

Required authored evidence: relation name, source/target occurrence anchors, trace/copy witness when applicable, lineage/pronunciation state.

Geometry variants already present: phrasal shell-to-shell, head-to-head, downward/lowering-style, multi-step successive-cyclic.

Replay behavior: introduced at the movement stage, persisted when the relation remains relevant.

### 3. Covert/dashed trajectory

Claim represented: non-surfacing LF path, diagnostic path, or blocked path depending on relation identity.

Current use: QR/LF scope paths and intervention diagnostics.

Can use: `QuantifierRaising`, covert scope movement, relation-specific blocked-path diagnostics when the authored relation says the path is not licensed.

Must not use: overt movement, ordinary binding, coreference, Agree, or any path whose semantic status is not authored.

Required authored evidence: path relation identity, current and/or LF occurrence anchors, whether path is licensed or blocked, scope/domain anchor when relevant.

Replay behavior: usually relation-frame overlay; may need before/after only when the covert relation is derived across stages.

### 4. Shared display index / coindex

Claim represented: sameness of reference, copy family, binding index, or interpreted dependency class, depending on relation identity.

Current use: binding, coreference, identity/copy, control, operator-variable binding.

Can use: coreference, binding, control, copy/chain identity, operator-variable configurations when a source convention supports an index.

Must not use: as proof of binding domain, movement, control, or c-command by itself. Index alone is only a shared label; the relation supplies the claim.

Required authored evidence: anchored occurrences and relation/lineage identity. Display indices should be generated renderer-side from anchors/lineage rather than authored as scalar pseudo-anchors.

Replay behavior: static on the relation frame; can persist across later frames as a visual lens.

### 5. Identity/copy forest glow

Claim represented: selected occurrences belong to one copy/identity lineage without adding a new path.

Current use: identity/copy chain and passive identity chain.

Can use: copy identity, chain identity, reconstruction only when the design calls for lineage emphasis rather than movement.

Must not use: movement licensing, coreference alone, binding, control, Agree, or any dependency where an arrow/path is the actual sourced convention.

Required authored evidence: multiple anchored occurrences and common lineage/copy relation.

Replay behavior: relation-lens emphasis, not a new derivational operation.

### 6. Dotted directed dependency plus domain box

Claim represented: a non-movement control dependency from controller to controlled silent subject, plus the embedded control domain.

Current use: subject control and object control.

Can use: control relations where a source licenses a directed dependency to a controlled silent subject/domain.

Must not use: binding, coreference, movement, Agree, generic semantic dependency, or arbitrary "influence."

Required authored evidence: controller anchor, controllee anchor, domain anchor; silence/pronunciation state for the controlled subject.

Replay behavior: relation-lens overlay on the control stage.

Live correction: the accepted control overlay is present and visually intact in the current Chrome lab view. The earlier controller-side index-crowding note was a stale/misread observation and should not be treated as a lab defect.

### 7. Binding domain ellipse / obstruction ellipse

Claim represented: the local c-command domain or the structural obstruction relevant to binding.

Current use: Principle A success and c-command failure.

Can use: binding/local-domain diagnostics where the selected domain is authored.

Must not use: plain coreference, control, phase, islands, or general domains merely because they are also regions.

Required authored evidence: binder, bound, domain/obstruction anchor(s), and relation identity.

Replay behavior: relation frame, usually static.

### 8. Feature plaque / valuation card

Claim represented: authored feature values or valuation state adjacent to the syntactic objects that bear them.

Current use: Agree / feature valuation and expletive-associate agreement.

Can use: Agree, Case, EPP, concord, feature valuation, feature licensing, feature bundle display when values are authored.

Must not use: as inferred linguistics if values do not exist in nodes, relation `values`, or Replay/stage text.

Required authored evidence: anchor(s) plus structured value rows or recoverable node labels/feature fields. Long bundles need wrapping/compact behavior.

Replay behavior: static on relation frame unless the relation's truth depends on before/after valuation, in which case the row can encode `__ -> value` in one frame if authored.

### 9. Bounding-node / locality cut

Claim represented: an authored bounding-node/Subjacency crossing, marked on the tree/path boundary crossing rather than as a decoration on the movement arrow.

Current use: wh-island and complex NP crossing cards.

Can use: bounding-node crossing, Subjacency-style locality violations when the crossed boundaries are authored.

Must not use: every island, every phase, or every failed movement; the relation must be this specific locality claim.

Required authored evidence: movement path plus boundary anchors crossed by that path.

Replay behavior: relation overlay once the relevant dependency and boundary anchors exist.

### 10. Phase arc

Claim represented: authored phase domain/edge marking.

Current use: one phase and multiple phase boundaries.

Can use: phase-domain marking where a phase and edge are authored.

Must not use: islands, binding domains, generic complement shading, Spell-Out/transfer/accessibility unless that claim is separately authored.

Required authored evidence: phase domain anchor and optionally edge anchor.

Replay behavior: static phase-domain overlay. Transfer/Spell-Out would be a separate authored state transition, not implied by the arc.

### 11. Ghost / muted subtree

Claim represented: unpronounced but structurally present material, especially recoverable ellipsis material.

Current use: VP ellipsis and sluicing.

Can use: ellipsis, sluicing, recoverable silent structure, deleted/unpronounced material when the tree contains the relevant authored structure.

Must not use: ordinary traces, authored nulls, silence in general without relation support, or reconstruction/deletion if the design distinguishes them.

Required authored evidence: site anchor, antecedent anchor if recoverability is claimed, silent/recoverable subtree or relation data supporting ghosting.

Replay behavior: usually introduced when the ellipsis/recoverability relation appears; can persist as muted structure.

### 12. Shared-node parent branches

Claim represented: one syntactic object shared by two parents/relations rather than copied twice.

Current use: multidominance object sharing and shared-subject coordination.

Can use: multidominance, sharing, Right Node Raising when analyzed as sharing, Across-the-Board only if the analysis truly uses sharing rather than parallel movement/copies.

Must not use: ordinary copy identity, coreference, ellipsis, or ATB if the authored analysis is movement/copy rather than a shared node.

Required authored evidence: shared node anchor and multiple parent anchors.

Replay behavior: static DAG-style relation overlay; may need transition if the shared structure is built across workspace frames.

### 13. PF realization / vocabulary plate

Claim represented: a compact mapping from abstract/current syntactic material to a pronounced exponent or surface token.

Current use: PF realization and suppletion.

Can use: Vocabulary Insertion, PF realization, contextual allomorphy, suppletion, Fusion/Fission only if rows actually state the relevant mapping.

Must not use: as a guessed explanation for a surface form if the mapping is nowhere authored.

Required authored evidence: target anchors plus authored `values` rows or recoverable stage before/after material.

Replay behavior: often inherently before/after: abstract object in one stage, realized object in a later stage, with the plate explaining the current relation.

### 14. LF scope domain and covert position

Claim represented: a scope domain and covert interpreted occurrence distinct from surface pronunciation.

Current use: QR / covert scope, inverse scope, clause-bounded scope.

Can use: QR and scope relations where the model authors LF occurrence/domain anchors.

Must not use: generic semantic interpretation, focus, binding, or operator-variable binding unless the relation explicitly uses LF scope positions.

Required authored evidence: pronounced occurrence, LF occurrence, scope domain.

Replay behavior: relation-frame overlay; before/after only if the LF occurrence appears across stages.

### 15. LF reconstruction strike/ghost/copy treatment

Claim represented: interpreted lower copy versus neglected/pronounced higher copy at LF.

Current use: LF Reconstruction.

Can use: reconstruction where the relation anchors both neglected and interpreted copies.

Must not use: ordinary movement or identity; it must say which copy is interpreted and which copy is neglected/preserved.

Required authored evidence: neglected/higher copy, interpreted/lower copy, binder or interpretive witness when relevant.

Replay behavior: relation-frame overlay; may require prior/current comparison if the relevant copy state is introduced over frames.

### 16. Focus branch prominence

Claim represented: focus/background prominence by strengthening one branch and weakening/dotting the sister branch.

Current use: subject, object, and embedded focus marking.

Can use: focus/prominence relations where the focused constituent, background sister, and local domain are authored.

Must not use: prosody-native tiers, topic/comment, association-with-focus particles, or semantic focus operators unless the relation explicitly licenses that meaning.

Required authored evidence: focus anchor, background anchor, domain anchor.

Replay behavior: static prominence overlay on the focus relation frame.

Source status note: the recovered source trail supports focus/prominence branch reversal in a specific information-structure/prosody context. The lab generalizes it for tree-internal focus marking; that generalization remains acceptable only as long as the docs describe the claim narrowly.

### 17. Theta grid / role labels

Claim represented: predicate-to-argument theta-role assignment as a compact grid plus anchored roles.

Current use: three-role predicate and unaccusative single-theme case.

Can use: theta assignment, argument-structure role mapping, primary predication if source research licenses the same device.

Must not use: Agree, Case, binding, movement, or semantic roles inferred from English glosses without authored role anchors.

Required authored evidence: predicate anchor plus role anchors and role labels.

Replay behavior: static on the theta-assignment relation frame.

Live note: current grid placement is better than earlier variants but should be treated as a lab prototype until source research and Francis acceptance settle its final placement rules.

### 18. Intervention blocked path plus X

Claim represented: a diagnostic relation that is blocked by an intervening closer candidate, not a licensed movement chain.

Current use: Relativized Minimality and superiority cards.

Can use: intervention, superiority, A-over-A-like competition, failed Agree/search only if source research supports blocked-path notation for that relation.

Must not use: ordinary movement, islands, or any successful dependency.

Required authored evidence: landing/probe, intervener, target, and whether any licensed movement path is separately authored.

Replay behavior: relation-frame diagnostic overlay; often composed with an independent ordinary movement arrow.

Live correction: Intervention is part of the current accepted lab set. Later source-library work should document the licensing of the dashed blocked path plus X, not reopen the accepted card by default.

### 19. Replay timing as a primitive constraint

Claim represented: when the relation becomes visible, whether it persists, and whether it needs before/after comparison.

Current use: all cards through replay frames.

Can use: every relation design.

Must not use: as a substitute for authored relation facts. Replay can show differences only when the model has authored the relevant stages.

Required authored evidence: stage order, current/prior workspace state, relation frame.

Replay behavior: static, introduced, persisted, focused, or before/after depending on the relation.

## Immediate Defects / Open Observations From Live Inspection

These are observations, not implementation instructions:

1. Control dependency is present and visually intact in the live Chrome lab view; no controller-side index crowding was confirmed.
2. Operator-variable binding currently uses the wh-chain convention plus visible terminal/operator indices derived from lineage. The LF claim is carried by the relation identity and indexed operator-variable pairing, not by a separate bespoke geometry.
3. Intervention is part of the current accepted lab set; later work should source-document the accepted dashed blocked path plus X, not relitigate it without new evidence.
4. PF realization is source-shaped as a compact plate, but the current lab still relies on authored value rows; a production SVGR entry must say exactly what authored values are required.
5. The inactive Sigma-to-Pol plate must remain inactive unless a future polarity-answer relation explicitly licenses the Pasquereau-style notation. It is not generic NPI.

## Phase 1 Boundary Before Remnant Movement

This packet recovers the current lab primitive vocabulary. It does not complete primitive-library source research. The next required work is Phase 2: source research for each candidate primitive, including exact figures, surrounding-text meaning, permitted relation families, forbidden relation families, required authored evidence, and legal composition.

Only after that source-backed primitive library is inspectable should the program start the next relation-design lane: remnant movement / roll-up movement / smuggling.

No production port should happen from this packet alone.
