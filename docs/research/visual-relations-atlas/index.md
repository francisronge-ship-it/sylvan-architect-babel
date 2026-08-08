---
title: "Drawing an Open-Ended Syntax: The Babel Relation Atlas"
description: "Research devlog on Babel's source-backed relation renderer, its open ontology, and how syntacticians can propose missing relation conventions."
---

<div class="paper-hero">
  <p class="paper-kicker">Research Devlog</p>
  <h1 class="paper-title">Drawing an Open-Ended Syntax</h1>
  <p class="paper-subtitle">The postmortem behind the Babel Relation Atlas: 102 live drawings, an open relation vocabulary, and a renderer that refuses to guess.</p>
  <div class="paper-meta-grid">
    <div class="paper-meta-item">
      <span class="paper-meta-label">Date</span>
      <p>August 8, 2026</p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Artifact</span>
      <p><a href="./atlas.html">Open the interactive Relation Atlas</a></p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Cards</span>
      <p>102 live renderer and Replay cases</p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Verification</span>
      <p>741 provider-free checks</p>
    </div>
  </div>
</div>

[![The Babel Relation Atlas, with its relation index and live renderer cards](./assets/relation-atlas-overview.png)](./atlas.html)

## The Problem Was Never Just Movement Arrows

A constituent tree records dominance. A syntactic analysis usually claims much more.

It may distinguish a pronounced occurrence from a silent copy, relate a controller to `PRO`, mark a binding domain, show an Agree probe and its goals, delimit a phase or transferred domain, retain structure under ellipsis, share one object across two predicates, compare PF and LF occurrences, or diagnose a dependency that cannot be formed. Those claims are not interchangeable, and drawing every one as a renamed movement arrow destroys the analysis the tree was meant to expose.

Babel therefore needed a relation renderer, not a movement-line feature.

The difficult part is that Babel's parser can author relation names that the frontend has never seen before. Linguistic analysis is open-ended; browser code is deterministic. A renderer cannot safely invent the meaning of an unfamiliar relation from its name, and a hard-coded enum of every relation would merely freeze today's coverage into tomorrow's ceiling.

## The Boundary We Settled On

Babel keeps the authored relation vocabulary open while keeping the drawing grammar finite and inspectable.

1. A derivation stage authors a relation name, syntax-node anchors, and optional values or prior-stage anchors.
2. Babel resolves those anchors against the actual tree. Missing or ambiguous positions fail closed instead of being retargeted to something convenient.
3. An exact registry selects a source-backed drawing for relations Babel knows.
4. An unknown relation receives only a topology-safe fallback: participation, grouping, and authored order. Babel does not infer an arrow, domain, licensing claim, or direction that was never authored.
5. The renderer derives geometry from the laid-out tree, and Replay controls when the relation enters, persists, or becomes the active focus.

This division matters. The model supplies the linguistic claim. Babel supplies safe presentation. Neither is allowed to impersonate the other.

## What The Atlas Records

The [interactive Relation Atlas](./atlas.html) mounts Babel's actual tree renderer and Replay compiler. It is not a gallery of hand-drawn SVGs.

Its 102 cards cover trajectories, copy identity, binding and control, agreement and feature relations, domains and locality, ellipsis and silent structure, multidominance and sharing, PF realization, scope and LF, theta roles, intervention, remnant and roll-up movement, parasitic gaps, sideward movement, Pair Merge, idiom chunks, and several multi-anchor stress cases.

Each card is a small executable claim:

- the syntax remains a real tree with real node anchors;
- the relation appears at the derivational moment that authors it;
- source-backed relations retain their distinct mark grammar;
- repeated or simultaneous relations remain separately inspectable;
- absent or ambiguous anchors produce diagnostics, not substitute geometry;
- every accepted visual design is tested in more than one structural context.

The atlas also preserves some negative conclusions. The earlier Sigma-to-Pol polarity study was retired from the accepted set because it represented a narrow analysis of polar response particles, not a general polarity or NPI-licensing relation. A source-backed drawing can be internally coherent and still be the wrong public abstraction.

## What Deterministic Code Cannot Promise

This atlas is broad, but it is not a declaration that syntax has 102 relations, or that Babel has finished the ontology.

Deterministic renderer code will always trail the full range of analyses used by syntacticians. That is acceptable if the boundary remains honest. A newly authored relation can survive in Babel before it has a curated drawing, and adding a new drawing does not require closing the model-facing vocabulary.

The goal is not to predict every future theory. The goal is to make new theories addable without letting unknown semantics turn into confident visual fiction.

## Proposing A Missing Relation

If you are a syntactician and the atlas is missing a relation or drawing convention you need, please [open a relation proposal](https://github.com/francisronge/sylvan-architect-babel/issues/new?title=Relation%20proposal%3A%20) or submit a pull request.

A useful proposal should include:

1. **The linguistic claim.** Name the relation and state what the drawing is evidence for.
2. **A primary source.** Link a paper, book, handout, or figure that actually uses the proposed notation.
3. **At least two structural contexts.** Show that the convention generalizes beyond one sentence or one node position.
4. **The required anchors.** Identify the syntax objects that participate and which roles are linguistically meaningful.
5. **Replay behavior.** Say when the relation is introduced, whether it persists, and whether multiple steps must remain visible.
6. **Why existing drawings are insufficient.** A new relation name does not automatically require a new visual primitive.

For a code contribution, add or update the relation cards and provider-free tests with the implementation. Do not hard-code node IDs, sentence-specific coordinates, or substring guesses about relation names. Geometry must come from resolved syntax anchors, and unresolved anchors must continue to fail closed.

The strongest contribution may be smaller than a new renderer. If an existing drawing family already expresses the sourced convention, an exact registry entry and its tests may be enough. New geometry is warranted only when the linguistic distinction is real, visually consequential, and source-backed.

- [Open a relation proposal](https://github.com/francisronge/sylvan-architect-babel/issues/new?title=Relation%20proposal%3A%20)
- [Browse open pull requests](https://github.com/francisronge/sylvan-architect-babel/pulls)
- [Explore the interactive Relation Atlas](./atlas.html)

## Closing Note

The Relation Atlas is the visible history of a renderer learning not to overclaim. It began with movement paths, accumulated increasingly difficult relation families, exposed where generic drawings erased real analyses, and ended with a stricter contract: open linguistic authorship, finite sourced marks, exact anchors, and explicit failure.

That is not the end of Babel's relation work forever. It is the point at which the system can accept the next missing relation without pretending we already knew what it would be.
