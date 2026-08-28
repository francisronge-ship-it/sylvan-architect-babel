# Visual Relations — Production Architecture (2026-08-07)

Status: describes verified production behavior after the renderer repair
pass (2026-08-07). Every rule below is enforced by the focused suites
(`tests/visualRelationRenderPlan.test.mjs`, `…MarkShapes…`,
`…ProductionCoverage…`, `…MovementArrows…`, `…ProductionRepair…`,
`tests/relationDispatch.test.mjs`, `tests/replaySilentSemantics.test.mjs`)
and by `npm run verify:all`. The Lab
(docs/design/visual-relations-current-lab.tsx and friends) stays a research
fixture surface; nothing below imports Lab React components or Lab fixture
trees into production.

## Ownership

- `types.ts` — the browser-visible authored contract.
  `DerivationStageVisualRelation` carries `relation`, `anchors`, and now the
  optional `priorAnchors` and `values` blocks, verbatim.
- `server/babelParser/derivationCompiler.js` — validates authored relations.
  Accepts the two new optional blocks with strict typing; still rejects any
  other extra field.
- `replay/relationDispatch/` — the exact-identity registry and dispatcher
  (pre-existing). `productionRegistry.js` is now populated (version 1) with
  the accepted identities and role signatures. Identity matching is exact
  with declared case/whitespace folding only — no regex, no substrings.
- `replay/relations/` — NEW React-free semantic compilation package:
  - `movementIdentities.ts` — the exact folded identity set that replaces the
    substring move-like regex.
  - `renderFamilies.ts` — registry-entry → finite render family mapping,
    per-family persistence metadata, full-array ownership, and the explicit
    exclusion list. Every relation identity used by an active accepted Lab
    card is production-wired; the only exclusion is inactive history, with
    its reason, and the coverage gate test enforces exactly this.
  - `fallbackTopology.ts` — the accepted topology-only fallback dispatcher,
    promoted verbatim from the accepted Lab design.
  - `largeAnchorSets.ts` — the accepted large-anchor-array policy
    (threshold 5, exact exemption registry, fail-closed diagnostics).
  - `overlayGeometry.ts` — pure geometry: deterministic span-lane allocation
    and anchor-set badge/rail layout from measured positions.
  - `renderPlanCompiler.ts` — compiles `DerivationStage[]` into the typed
    `VisualRelationRenderPlan`: per-stage frames of plan items with
    appearance/persistence, composition conflict detection, fallback rows,
    and large-array sets.
  - `geometryBinding.ts` — pure binding of a plan frame to positioned
    primitives, given a node-position lookup supplied by the renderer.
- `replay/replayCompiler.ts` — keeps Replay construction. Its movement
  classification now consults `movementIdentities.ts` (exact only), and its
  arrow endpoints obey the fail-closed law: an authored/derived witness or
  the anchored node itself, never a guessed descendant or ancestor.
- `components/TreeVisualizer.tsx` — geometry source of truth and plan
  consumer. It lays out the tree, exposes node positions to the pure
  binder, and draws the returned primitives in its zoomed group. It owns no
  ontology, infers nothing from strings, and does not scrape its own DOM for
  overlay geometry.

## Data flow

model output → derivationCompiler validation (verbatim `relation`, `anchors`,
optional `priorAnchors`, `values`) → `DerivationStage[]` → two consumers:

1. Replay steps: replayCompiler as before, now with exact movement identity
   and lawful arrow endpoints.
2. Render plan: `compileVisualRelationRenderPlan(stages)` — resolves anchors
   against each relation's own stage forest (priorAnchors against the
   immediately preceding stage only), dispatches by exact identity through
   the production registry, compiles wired families to semantic plan items,
   routes unregistered names to the fallback dispatcher, adds large-array
   anchor sets, and orders/deduplicates via the composition rules.

TreeVisualizer computes the plan once per stages input, and per frame feeds
`bindVisualRelationPlanFrame(frame, positionFor)` with its real post-layout
node positions; the returned primitives draw in the shared zoom/pan group
with screen-stable marker sizing (counter-scaled markers, non-scaling
strokes).

## Invariants

- The authored ontology stays open. Classification is derived and
  renderer-owned; authored names, role names, values, and order are
  preserved verbatim in the plan and its provenance.
- Exact folded-name dispatch only. An unlisted name never matches anything,
  partially or otherwise.
- Fail closed: an unresolved required role or witness produces a diagnostic
  and no mark. No substitute trace, leaf, or shell is ever chosen for a
  missing endpoint.
- Geometry is always derived from the renderer's real post-layout node
  positions; the plan itself contains node ids and shapes, never pixels.
- One movement authority. When the compiled plan contains trajectory items
  for a derivation, TreeVisualizer draws movement exclusively from the plan's
  bound trajectory primitives; the legacy replay-arrow path renders only when
  the plan owns no trajectories (lossless compatibility for pre-plan data).
- Authored witness kind is authoritative. Display indexing is additive only
  (`formatAuthoredWitnessSurface` in `replay/replayCompiler.ts`): an
  authored trace surface (`t`, `t₁`, `t1`) may gain or normalize its
  subscript index; authored `∅` stays `∅`; silent lexical copies stay
  lexical; overt copies stay overt. Nothing converts one witness kind into
  another (`forceTraceForSilentCopy` and null→trace conversion are deleted).
  Ghosting is keyed to authored pronunciation state (`silent: true`), never
  to a subtree's membership in a relation.
- Replay-step timing. Every renderable authored relation instance gets its
  own Replay relation moment — including non-movement and unregistered
  relations (trajectory placement gating applies only to relations whose
  plan step authored explicit source/target endpoints), and including
  relations authored on a stage with no structural change (a relations-only
  stage routes through the step finalizer with zero structural steps, and
  its relation moments anchor to the frame's committed visible state — a
  relation moment never changes which material is structurally visible).
  On the canvas,
  `visiblePlanFrameItems(plan, frameIndex, playedRelationIndices)` reveals a
  stage's marks by EXACT played identity: each relation Replay step carries
  its authored `{stageIndex, relationIndex}` (`replayRelationIdentity`), and
  placement may reorder relation moments around structural construction, so
  a count of played moments is never used as an identity. Structural
  microsteps show none of the stage's new marks, and the committed
  (non-animated) view shows them all. A coalesced mark reveals when any of
  its contributing authored instances has played.
- The Replay relation lens. During a relation moment the played relation's
  marks (matched by exact authored identity, including coalesced
  contributors) render prominent while every other visible mark stays
  present but quiet — uniformly across all bound primitive types, each of
  which draws inside its own host group carrying `data-vr-emphasis`.
  Emphasis changes nothing about linguistic claims or persistence, and
  authored-silence ghosting is never double-dimmed by the quiet state.
- Vanished anchors fail closed. A persistent mark materializes into a later
  frame only while every authored anchor that resolved at its authoring
  stage still exists in that frame's forest. When an anchored node is gone
  the mark is not drawn there — never retargeted through `lineageId` or a
  nearby node — its earlier Replay history keeps the correct mark, and a
  structured `anchor-vanished` plan diagnostic records the stage, relation,
  and missing anchors without exposing backend ids on the canvas.
- Chain identity, claimed only as strongly as authored data proves it.
  Primary identity is shared authored `lineageId`: a lineage-keyed chain
  keeps its index as its occurrence list grows or is reordered. Without a
  shared lineage the key is the family tag plus the *sorted* participant
  set: stable under harmless anchor-array reordering, but a no-lineage
  chain that grows is a new participant set — the compiler cannot prove it
  is the same chain and does not pretend to. Unrelated no-lineage chains
  are never merged. Display numerals are allocated in first-encounter order
  within one compilation: identity keys are stable, but reordering
  relations or stages can change which chain receives which numeral.
- Extra open roles never veto a specialized mark. A registered relation with
  all required roles resolved compiles its specialized core even when the
  model authors additional unknown roles; those extra resolved participants
  keep neutral topology-only fallback marks, with a `signature-incomplete`
  diagnostic. Only a missing or invalid *required* role fails the
  specialized form closed — and even then every resolved anchor stays
  inspectable through the neutral presentation.
- No invented linguistic claims. Outcome-like values (`licensed`,
  `blocked`, feature/case labels, polarity marks, `[E]` annotations, …)
  render only when the model authored them with a recognized value; a
  missing or unrecognized value renders the neutral geometry with no
  judgment tip and a `value-unrecognized` diagnostic. Least-claiming wins:
  when a rule cannot be justified by the authored data, the renderer draws
  less, never more.
- PF composition is grouped only by provable authored ownership: a
  vocabulary-insertion row joins a PF package plaque only when its terminal
  is among *exactly one* package's authored anchors (PFRealization's roles
  are its open target roles per the registry contract). A terminal shared
  by several packages is ambiguous authored data — the row keeps its own
  standalone plate and an `ambiguous-package-ownership` diagnostic is
  emitted; nothing is ever assigned first-win. Unassigned insertions keep
  their own plates; unresolved ones fail closed with diagnostics.
- Companion composition keeps companion provenance. The accepted Case
  picture (solid CaseAssignment path plus the quieter dotted collection
  curves of same-stage Agree relations probing the bearer) draws each
  collection curve as the companion Agree instance's own mark: it carries
  that Agree's `relationRef` and persistence, so Replay reveals it at that
  Agree's own relation moment, never at the CaseAssignment moment.
- No invented plaques. A feature plaque exists to show authored value rows;
  an instance with no authored values draws no plaque (its resolved
  participants keep the neutral topology-only presentation instead), and a
  plaque is never titled from a role name. CyclicAgree's cycle numeral is
  likewise authored-only: a relation's position in the stage list is never
  rendered as a cycle number.

## Appearance and persistence (Replay)

- A relation instance first appears at its authored stage index; nothing
  leaks backward. Multiple authored steps of one relation remain distinct
  Replay frames; persistence only controls which already-introduced marks
  stay visible in later frames.
- Registered relation persistence is exact per-design metadata:
  `from-stage-onward` for movement paths and other structurally persistent
  results, `stage-only` for transient lenses, and
  `replace-previous-instance` for declared replacement families. The plan
  materializes an item into every frame its persistence licenses.
- Replacement requires a provable thread. A later instance replaces an
  earlier one only when the compiler can prove both states belong to the
  same authored relation thread: a declared replacement scope role (Cooper
  storage per-scope ledgers), an identical authored participant set (a
  DependentCase restatement over the same probe/goal), or authored
  `priorAnchors` naming exactly the earlier instance's participants (a
  grown CyclicLinearization domain continuing its own thread). Independent
  instances of the same relation name — different participants, no
  authored continuity — always coexist; nothing family-global ever
  replaces across unrelated participants.
- An UNREGISTERED fallback persists from its authored stage onward. Retaining
  the authored claim is neutral; making it disappear would invent transience.
  A fallback can become stage-only only after its exact relation is registered
  with a source-backed transient design.
- Large-anchor badges/rails are additive organization for their parent
  relation instance and inherit that compiled instance's persistence; they
  never own an independent persistence policy.
- `priorAnchors` resolve only against the immediately preceding authored
  stage and contribute the accepted backward cue; they never invent tree
  nodes.

## Composition

- One stage may hold many relations; every instance compiles (no `single()`
  first-instance sampling, no last-writer-wins).
- Deterministic ordering: fixed per-kind layer order, then stage index, then
  authored relation index, then role/array order.
- Marks sharing a node stack deterministically; path-like items receive
  deterministic lanes from `allocateSpanLanes`.
- No semantic suppression. Babel never decides two authored claims are
  incompatible merely because they share a visual channel. Within a frame,
  two items paint once ONLY when they are the same COMPLETE semantic claim:
  the coalesce key is the canonical serialization of the whole item — render
  family, kind, every anchor and antecedent, labels, values, outcomes,
  ghost/member sets, the backward cue — minus provenance bookkeeping and the
  appearance stage. Sharing a route or a site is never identity: coincident
  geometry from different families, ellipsis claims at one site with
  different antecedents, and same-route paths with different labels or
  outcomes all survive as distinct marks for collision routing. Genuinely
  identical claims (including a persisted claim and its identical later
  restatement) paint once with every contributing instance retained in
  `coalescedRefs` — internal bookkeeping only, never exposed as UI. There is
  no `conflicting-claim` diagnostic and no fail-closed "later mark loses"
  rule.
- Geometry-aware collision routing. The binder binds every routable curve
  at its base route, then routes over *measured* geometry: only curves
  whose sampled routes actually come within clearance of each other (same
  style or not) take within-cluster ordinals and fan apart; far-apart
  curves keep their base geometry untouched. Plates are obstacles — a curve
  crossing one deepens its route when a clearance route exists within the
  try budget, and otherwise keeps its least-obstructive route flagged
  `routing: 'constrained'` instead of being suppressed. Domain regions are
  containment semantics, not occluders (a path may lawfully live inside its
  own domain), so paths are not routed out of them. Coincident trajectories
  fan by per-route ordinals; same-node badges and same-anchor plates stack
  deterministically; fallback connectors take `allocateSpanLanes` lanes.
  This is measured-overlap routing, not a complete general-purpose collision
  planner: curve-vs-curve, curve-vs-plate, plate-vs-plate, and path-label
  collisions are handled from measured display-scale footprints.

## Fallback trigger

Fallback activates exactly when registry lookup finds no entry for the
authored name. The accepted topology-only table then applies: participation
instance marks; an undirected link only for two scalars; an undirected fan
only for one scalar plus one array; ordered position marks for arrays;
circle/box frames only for two array groups; closure marks when topology
licenses no connector; the backward cue for `priorAnchors`. The canvas never
prints relation names, role names, node ids, or values, and values change no
fallback geometry. A relation with no resolved current anchors draws no
connector.

## Large anchor arrays

The accepted policy applies unchanged in production: any role array of 5 or
more ids compiles to an ordered anchor set (stage, instance, role, array
order preserved) unless a source-backed exact registry exemption owns that
role's full-array rendering. `FULL_ARRAY_OWNED_ROLES` is verified against
actual element-by-element rendering, with a per-entry justification comment;
plaque-anchored families (Cooper Storage ledgers, PF fission/local
dislocation/cyclic linearization) do NOT own their arrays and receive the
  organizational rails alongside their plaques. Every resolved participant
  renders as a numbered badge with organizational role rails; when an unknown
  fallback already numbers the same array witnesses, the large-array layer
  reuses those badges and adds only the rail. Deterministic lanes and
same-node stacking; no truncation, sampling, overwrite, invented direction,
or semantic connector. Unresolved entries stay diagnostics. The rail is
additive organization: registered semantic marks for the same instance still
render.

## Old fallback rules — keep / modify / reject reconciliation (2026-08-07)

The historical fallback plan re-audited against the current contract; each
rule kept only on its own current justification:

- **keep** — exact-name dispatch, no substring guessing: open authored
  ontology makes any partial match an invented claim.
- **keep** — no relation names, role names, backend ids, or values printed
  on the canvas: backend identifiers are not linguistics; provenance lives
  in the plan, not the drawing.
- **keep** — topology/order only for unknown geometry: with no registered
  semantics, arity and order are the only authored facts a drawing can use.
- **keep** — one scalar → participation mark: minimal faithful evidence of
  the authored participant.
- **keep** — two scalars → thin undirected link: the authored instance
  relates exactly these two; the link claims relatedness, no direction.
- **keep** — one scalar + one array → undirected fan: same justification,
  one-to-many arity.
- **keep** — one array → ordered position marks: array order is authored
  data; the marks show it without inventing a connector.
- **keep** — two equal-length arrays → positional circle/box pairing, no
  invented connector: positional correspondence is the only authored
  structure.
- **keep** — ambiguous topology → marks only: when the shape is not
  provable, draw participation, nothing else.
- **keep** — `priorAnchors` is a previous-stage cue only, never a
  ghost/replacement instruction *in the fallback*: unknown semantics cannot
  license ghosting. (**modify** for registered replace-previous-instance
  families: authored `priorAnchors` naming exactly an earlier instance's
  participants now also proves thread continuity for replacement — that is
  authored continuity evidence, not a fallback rule.)
- **modify** — unknown fallback persists from introduction onward. The old
  stage-only rule guessed transience from missing semantic knowledge; the
  neutral behavior is to retain the authored claim until an exact registered
  design explicitly says otherwise.
- **keep** — large-array threshold 5, additive, no truncation: accepted
  policy, verified against live production ownership.
- **modify** — "multiple large arrays remain legible without collisions":
  kept as a goal, now backed by the measured routing pass plus rail lanes
  rather than assumed; legibility of arbitrary trees is verified by tests
  for distinct rail lanes and by browser QA, not guaranteed a priori.
- **reject** — global per-style binder ordinals as the collision story:
  they shifted unrelated far-apart paths and missed cross-style overlap;
  replaced by measured-overlap routing.
- **reject** — first-anchor chain fallback identity (`tag:ids[0]`): anchor
  order is not identity evidence; replaced by the sorted participant set.
- **reject** — any default/inferred semantic value (cycle numbers from list
  position, role-name plaque titles, outcome defaults): a renderer position
  or role name is never a linguistic claim.

## Flagged decisions (least-claiming resolutions)

Where historical plans and the current contract disagreed, the
least-claiming faithful rendering was chosen:

- Unknown-relation Replay moments: an unregistered authored relation gets a
  Replay relation step (the model authored it; hiding it loses authored
  content) but its canvas mark stays the neutral topology-only fallback —
  the step surfaces the claim without interpreting it. The two committed
  replay snapshots were re-baselined for this: they had frozen the defect
  in which authored relations (`wh-movement`, `auxiliary-head-movement`,
  `bespoke-open-agreement`) lost their relation moments entirely.
- Ellipsis regions vs ghosting: `ellipsis-site` items carry both
  `ghostNodeIds` (authored-silent material only — ghosting never restyles
  overt material) and `siteSubtreeNodeIds` (the whole authored domain, used
  for domain-region marks like the licensing slash). A domain with no
  authored-silent material still shows its region mark but ghosts nothing.
- Outcome defaults: where a family previously assumed a judgment (e.g.
  anti-locality defaulting to blocked), the mark now renders with no
  judgment unless the model authored a recognized outcome.
- Valueless Agree: the accepted fixtures author `Agree` with only
  probe/goal and put feature rows on separate `FeatureBundle` relations, so
  a valueless Agree has no source-backed standalone specialized mark. It
  renders as the neutral topology-only presentation (participation marks
  and the thin undirected link between its two authored participants)
  rather than an empty plaque or an invented directed connector. The
  undirected link claims only that the two authored participants stand in
  the authored relation — strictly less than the authored content — and is
  flagged here as the chosen least-claiming behavior.
- CyclicLinearization growth: a later linearization over a grown domain
  replaces its predecessor only when the model authored `priorAnchors`
  naming the predecessor's participants; without that continuity evidence
  both states persist side by side rather than guessing they are one
  thread.
