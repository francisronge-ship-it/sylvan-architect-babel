# Large Authored Anchor Arrays — Lab Layout Policy (2026-08-06)

Status: implemented Lab-side. This is a deterministic layout policy for
unusually large authored anchor arrays. It is not an unknown-relation fallback
and it does not dispatch on relation names; the deferred fallback-dispatcher
work is untouched.

## What is implemented

- `LARGE_ANCHOR_ARRAY_THRESHOLD` (5) and `compileLargeAnchorSets` in
  `visual-relations-lab-adapter.ts`. Any relation instance with an anchor role
  whose array reaches the threshold compiles to an ordered anchor-set plan:
  relation-instance order within the stage, role order within the relation,
  and array order within the role are all preserved verbatim. Repeated
  instances of one relation in one stage each get their own set. Anchors
  resolve against their own stage's forest; an unresolved anchor stays in the
  plan marked unresolved and emits a contract diagnostic — its mark fails
  closed rather than guessing an endpoint.
- `allocateSpanLanes` and `planAnchorSetLayout` in
  `visual-relations-geometry.ts`. Pure functions: the renderer measures real
  node rectangles after layout and passes them in. Every resolved anchor with
  measurable geometry is placed; marks sharing a node stack in deterministic
  traversal order; role rails take lanes by deterministic first-fit interval
  allocation. Nothing is truncated, first-sampled, or overwritten, and the
  plan contains no arrowheads and no directional fields — an open relation
  with a big array gets organization, never an invented semantic connector.
- `renderAnchorSetRelation` in `visual-relations-current-lab.tsx` draws the
  plan as numbered participation badges plus role rails below the tree, with
  `localPx`-scaled sizes so marker and label sizes stay stable under zoom, in
  the same lens-gated layer discipline as every other overlay.
- Exemption registry (`ANCHOR_SET_EXEMPT_ROLES`, exact folded names only):
  `ParasiticGap`'s `primaryPath`/`secondaryPath` arrays are excluded because
  the sourced Phillips island composition already renders every node of both
  paths; the general plan stepping in as well would double-mark those nodes.

Tests: `tests/visualRelationsLabAdapter.test.mjs` covers a large chain family
(8-occurrence Identity, plus two same-stage instances), a large multi-parent
family (6-parent Multidominance), fail-closed unresolved anchors end to end
(compile → lens → planner), sub-threshold inactivity, the open-relation
no-connector guarantee, the Phillips exemption, lane determinism, and
same-node stacking.

## Remaining boundary (concrete)

- The anchor-set plan guarantees every anchor of a large array is *rendered*;
  it does not upgrade the singular semantic lens shapes. `single()` still
  degrades second and later instances of Control, Binding, Coreference,
  CaseAssignment, FeatureSharing, Intervention, QuantifierRaising, and
  Multidominance to first-instance-plus-diagnostic for their *semantic*
  drawings (audit cross-cutting §10). Rendering N semantic instances is a
  per-design geometry question (e.g. two QR paths need collision-managed scope
  trajectories) and belongs to the renderer-architecture pass, not to this
  policy.
- The policy is Lab-side only. Production's bridge still drops `values` and
  `priorAnchors` and draws no authored-relation overlays at all, so nothing
  here changes what production renders; adopting the plan in production is
  gated on the production contract work the audit already enumerates.
- The badge/rail presentation is a Babel-invented organizational device (like
  Notes), not a sourced convention. It deliberately carries no per-relation
  styling so it cannot be mistaken for a sourced semantic mark.
