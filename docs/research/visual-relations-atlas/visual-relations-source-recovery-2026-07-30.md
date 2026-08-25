# Babel Visual-Relations Source Recovery

Date: 2026-07-30

Status: source correction for three existing Lab designs plus source evidence
for two multi-anchor generalization contexts. This note does not introduce a
new visual primitive.

The 2026-07-28 audit confused a bad cached plate with the absence of a source.
The theta grid, phase arc, and PF realization plate all have inspectable
precedents.

## Theta Grid

![Theta grid mapping a predicate to Agent, Theme, and Goal arguments](visual-relations-assets/source-recovery-2026-07-30/theta-grid-cas-lx522-slide33.jpg)

- Source: *CAS LX 522 Syntax I, Week 5b: Theta Theory*, slide 33.
- Source page: https://www.slideserve.com/rmilliner/cas-lx-522-syntax-i-powerpoint-ppt-presentation
- Visible convention: the predicate `give` heads a compact theta grid whose
  Agent, Theme, and Goal rows map to the indices on its three arguments.
- Babel translation: keep the compact predicate/role/index plaque and place the
  same indices at the anchored arguments. The plaque styling and placement are
  Babel's; the grid-plus-index relation is sourced.
- Scope limit: the number and names of rows come from the authored theta roles.
  The renderer must not assume every predicate has three roles.

## Phase Arc

![A phase domain drawn as an arc over a syntax tree](visual-relations-assets/source-recovery-2026-07-30/phase-arc-gao-2016.png)

- Source: Zhiyan Gao, "How to draw an arc on a syntax tree with LaTeX" (2016).
- Source page: https://gaozhiyan.wordpress.com/2016/12/06/how-to-draw-an-arc/
- Visible convention: a solid arc labels a DP phase and a second dashed arc
  marks spell-out over the relevant tree domain.
- Babel translation: draw the authored phase projection as an arc derived from
  its laid-out subtree, with the authored edge as a separate anchored position.
- Scope limit: an arc marks the named domain. It does not by itself assert
  islandhood, transfer, accessibility, or movement.

## PF Realization

![Vocabulary Insertion equations mapping abstract morphosyntax to exponents](visual-relations-assets/source-recovery-2026-07-30/pf-vocabulary-insertion-embick-noyer-2004.png)

- Source: David Embick and Rolf Noyer, *Distributed Morphology and the
  Syntax/Morphology Interface* (2004 draft), page 7.
- Primary PDF: https://dingo.sbs.arizona.edu/~hharley/courses/PDF/EmbickNoyerDM.pdf
- Visible convention: Vocabulary Insertion is written as a compact mapping
  between an abstract morphosyntactic terminal and a phonological exponent,
  including `z <-> [pl]` and context-sensitive allomorphy rules.
- Babel translation: render each authored `VocabularyInsertion` step as one
  input-to-output row. Ordered rows may compose into the final pronounced form.
- Scope limit: the renderer presents authored mappings. It must not infer an
  exponent, rule ordering, or morphological analysis from the surface word.

## Corrected Verdict

| Existing Lab design | Source-backed content | Babel-specific content |
| --- | --- | --- |
| Theta grid | predicate/role/index grid and argument indices | typography, color, and placement |
| Phase arc | arc over a named syntactic domain | color, animation, and subtree fitting |
| PF realization plate | abstract terminal-to-exponent equation rows | card layout and ordered-row animation |

None of these designs is unsourced. Their finite renderer marks remain Babel
translations of the cited conventions rather than copies of the source images.

## Multiple Parasitic Gaps

![Published example with one real gap and two nested parasitic gaps](visual-relations-assets/source-recovery-2026-07-30/multiple-parasitic-gaps-ishii-page8.png)

- Source: Brian Agbayani and Toru Ishii, "Syntactic and Prosodic
  Topicalization in Japanese" (2023), example (14), page 406.
- Primary PDF:
  https://www.isc.meiji.ac.jp/~tishii/downloadable%20papers/Syntactic%20and%20Prosodic%20Topicalization.pdf
- Visible convention: one overtly displaced manuscript has one real gap and
  two separately marked `PG` positions in nested domains.
- Babel translation: `ParasiticGap` accepts `parasiticGaps` as an array and
  gives every anchored parasitic position the shared index. There is still one
  ordinary movement trajectory, from the real lower trace to the filler.
- Scope limit: the Lab's English tree is a topology stress translation, not a
  claim that it reproduces the source's Japanese sentence or analysis.

## Sideward Movement Followed By Wh-Movement

![Nunes sideward-movement derivation reproduced in Oded 2011](visual-relations-assets/source-recovery-2026-07-30/sideward-nunes-which-paper-page75.png)

- Source: Ilknur Oded, *Recalculating Adjunct Control* (2011), page 75,
  reproducing Nunes (2004:100), examples (35)-(36).
- Source PDF:
  https://drum.lib.umd.edu/server/api/core/bitstreams/f9d738c0-31c7-49d5-8333-1f8ca7e47ad6/content
- Visible derivation: `which paper` occurs first in an independently built
  adjunct, is copied into the matrix object position while the two phrase
  markers remain separate, and later appears in Spec,CP after the workspaces
  merge.
- Babel translation: the first path uses the cross-workspace sideward curve;
  the later path uses ordinary phrasal wh-movement. The final frame retains
  both paths because both movement relations remain part of the derivation.
- Scope limit: sideward movement and ordinary wh-movement are two ordered
  relations. They must not be collapsed into one generic curve.
