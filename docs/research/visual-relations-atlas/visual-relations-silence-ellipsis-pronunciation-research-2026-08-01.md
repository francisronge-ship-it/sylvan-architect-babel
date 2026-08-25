# Silence, Ellipsis, Recoverability, and Pronunciation: Strict Source Audit

**Date:** 2026-08-01
**Status:** Source audit only. No Lab cards were added in this pass. The source
figures below establish which drawings can be transferred into Babel and which
theory names do not justify a separate renderer relation.

## Qualification Rule

A source qualifies only when it shows:

1. a constituency or phrase-structure tree that Babel can represent with its
   authored tree contract, and
2. a visible pronunciation, deletion, correspondence, or movement mark that
   ordinary dominance and node labels do not already express.

The source establishes the drawing convention. Babel may use a different
lexicalized tree, but must preserve the source's anchors, direction, ordering,
and pronunciation claim. Tree structure remains model-authored; the renderer
adds relation marks and occurrence states only.

A qualified relation does not need a unique primitive. Reusing movement,
coindexation, feature plaques, and silent-subtree states is preferred when the
source itself composes those devices.

## Existing Lab Coverage

The Lab already draws complete unpronounced structure for VP ellipsis, sluicing,
gapping, stripping, pseudogapping, fragments, and null-complement anaphora. It
also has an antecedent-to-site recoverability bridge. This pass does not replace
those cards. It asks which missing claims add a transferable drawing convention.

## Ellipsis Licensing

![Merchant C-E licensing an unpronounced TP](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/merchant-ellipsis-page-21.png)

Source: Jason Merchant, *Ellipsis*, examples 56-57, page 21:
[paper](https://home.uchicago.edu/~merchant/pubs/merchant.ellipsis.pdf).

Merchant's sluicing tree places `[E]` on the licensing C head and encloses the
complete TP complement in angle brackets. The lower wh trace remains inside
that unpronounced TP. The source therefore makes two distinct claims on one
ordinary tree: the head bears the ellipsis feature, and its complement is not
pronounced.

### Exact Babel Drawing

1. Anchor an `[E]` feature plaque to the actual C or T terminal named by the
   authored relation.
2. Apply the existing silent/ghost state to the complete authored complement
   subtree named as the ellipsis domain.
3. Preserve every trace, copy, and internal branch in that subtree. Silence
   changes pronunciation, not syntax.
4. Draw no licensor arrow. Merchant uses a feature on the head plus an
   angle-bracketed complement, not a path between them.

Replay may introduce the host and complement first and apply the nonpronounced
state in the ellipsis-licensing frame. The final frame retains `[E]` and the
silent complement.

**Classification:** source-backed composition of the existing feature-plaque
and silent-subtree primitives. It merits a Lab context, but not a new line
family.

**2026-08-24 implementation decision:** the dedicated `EllipsisLicensing`
registry identity, cards, and painter were retired. `[E]` is represented by
the ordinary feature-plaque primitive when authored; the unpronounced domain
is represented independently by `Ellipsis`. Tier 2 may recover either piece
from complete structural evidence without inferring the other.

## Remnant Escape in Pseudogapping

![Gengel pseudogapping remnant movement out of VP ellipsis](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/gengel-pseudogapping-page-02.png)

Source: Kirsten Gengel (2007), *The Role of Contrast in Deletion Processes*,
Figure 5, page 58:
[paper](https://repository.upenn.edu/bitstreams/9d6bfbc2-8e98-413b-bca8-ffc6396b375a/download).

The source draws the object remnant `Jane` above the VP deletion site, an
ordinary phrasal-movement arrow from the lower object trace to that landing
position, and struck-through material inside the VP. The remnant survives
because it moves outside the constituent whose pronunciation is deleted.

### Exact Babel Drawing

1. Use the ordinary phrasal-movement trajectory from the lower DP trace/copy
   to the landed DP phrase shell.
2. Keep the lower DP witness inside the authored deletion domain.
3. Apply the existing silent/ghost state to the complete VP that is deleted.
4. Leave the landed remnant fully pronounced outside that domain.
5. Persist both the movement trajectory and deletion state in the final frame.

The renderer must not invent a special pseudogapping arrow. The source's claim
is exactly ordinary phrasal movement composed with an ellipsis domain.

### Second Context: Gapping with Two Remnants

![Gengel gapping with two escaped remnants](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/gengel-gapping-page-67.png)

Gengel's Figure 23 supplies the distinct second context. `Heather` escapes to
the topic field and `a magazine` escapes to the focus field before the TP is
deleted. The final drawing therefore contains two ordinary phrasal trajectories
whose landed phrases remain outside one silent TP domain.

This is not a second lexical substitution of the pseudogapping tree. It changes
both the number of remnants and the size of the deletion domain: one object
escapes VP deletion in the first context; a subject and object independently
escape TP deletion in the second.

**Classification:** source-backed and generalized across two contexts. Reuse
ordinary phrasal movement plus the existing deletion-domain treatment; do not
invent a gapping-specific trajectory.

## Partial Copy Deletion and Multiple Pronunciation

![Meadows and Yan boxed VP copies and movement](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/meadows-yan-verb-doubling-page-6.png)

Source: Tom Meadows and Qiuhao Charles Yan (2025), *The Syntax and
Post-syntax of Verb Doubling in Mandarin Chinese*, Figures 17-20, pages
432-433:
[paper](https://www.lingref.com/cpp/wccfl/41/paper3774.pdf).

Figures 17 and 19 draw a full higher VP and a full lower VP copy connected by
movement, with rectangles identifying the two VP occurrences. Those figures
are ordinary phrasal movement plus copy enclosures.

![Thin strike through the lower DP in Figure 18](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/meadows-yan-partial-deletion-detail.png)

Figure 18 contains the transferable Partial Copy Deletion mark: a thin
horizontal strike through the lower `DP` category label. It is separate from
the diagonal VP-to-DP branch, which ends above the label. The lower V remains
pronounced so that it can host `de`. The dotted path is Local Dislocation, a
separate PF relation.

The strike is not drawn inside Figure 17's boxed movement tree. The source uses
two sequential figures: Figure 17 establishes VP movement and the two boxed
copies; Figure 18 switches to a reduced postsyntactic subtree and introduces
the DP strike and Local Dislocation. It never presents movement, both boxes,
and the strike together in one source plate.

There is no ghosting in the source. Figure 20 gives the separate lowering/PF-
movement path for `le`, but does not visibly repeat the DP strike. The paper
therefore supplies one explicit visual context for selective deletion, not two.

### Exact Babel Sequence

1. The movement frame uses ordinary phrasal movement and rectangles around the
   higher and lower VP copies, following Figure 17.
2. A later PF frame introduces the thin strike on the lower `DP`, following
   Figure 18. Babel preserves the complete authored DP subtree; the strike does
   not replace it with a bare category or generic trace.
3. Local Dislocation is another relation in that PF frame. The `le` lowering
   path belongs to the second analysis and remains a separate relation.
4. If Babel's final accumulated frame retains the earlier movement while also
   showing the later strike, that combination is licensed by Replay
   persistence. It is not copied from one source figure and must not be
   described as though the paper drew the combined state.

### Second Context: Resumptive D Survives Partial Copy Deletion

![Yip and Ahenkorah resumptive partial copy deletion](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/yip-ahenkorah-partial-copy-deletion-page-09.png)

Source: Ka-Fai Yip and Christian Ahenkorah (2022), UConn LingLunch handout,
*Non-agreeing resumptive pronouns and partial Copy Deletion*, examples 39-43:
[handout](https://kafai-yip.github.io/assets/docs/UConn_resumption_handout_20220426.pdf).

The Cantonese derivation gives four ordered states: baseline, object movement,
Partial Copy Deletion, and Vocabulary Insertion. In the lower DP copy, NP and
its lexical/root features are deleted while D survives; Vocabulary Insertion
then realizes that D as default pronoun `keoi`.

This differs structurally from the Mandarin context. The first card moves VP
and deletes its lower DP while retaining a pronounced lower V. The second moves
DP, deletes only lower NP, and retains lower D as a pronounced resumptive
exponent.

**Classification:** source-backed and generalized across two contexts. The
recipe is ordinary phrasal movement, a lower-copy enclosure, a selective strike
on the authored deleted subconstituent, and any separately authored PF
realization.

### Ordinary Chain Reduction Remains Composition

![Yuan high-copy and low-copy pronunciation schemata](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/yuan-chain-pronunciation-page-148.png)

Source: Natalie Yuan (2018), *Dimensions of Ergativity in Inuit*, examples
4 and 6, pages 147-148:
[dissertation](https://dspace.mit.edu/server/api/core/bitstreams/59717593-4eca-4984-8a2f-d11573c462d5/content).

When an entire occurrence is pronounced or silent, Babel already has every
needed mark: movement/identity identifies the chain, and occurrence state says
which copy is pronounced. Standard high-, low-, or intermediate-copy
pronunciation therefore does not receive a separate card. The new card is only
possible if a different source explicitly draws the mixed state inside one
copy.

## Ordered Gapping Remnant-Correlate Alignment Does Not Add a Drawing

![Kato and Matsubara gapping tree with ordered correlate-remnant indices](visual-relations-assets/source-recovery-2026-08-01/silence-ellipsis-pronunciation/kato-gapping-page-2.png)

Source: Yoshihide Kato and Shigeki Matsubara (2020), *Parsing Gapping
Constructions Based on Grammatical and Semantic Roles*, Figure 1, page 2748:
[paper](https://aclanthology.org/2020.emnlp-main.218.pdf).

The source marks the full-conjunct correlates with `-1` and `-2`, and the
gapped-conjunct remnants with matching `=1` and `=2`. Those are labels inside
the source tree. A second primary-source search found dependency-grammar
`remnant` arcs, but not a constituency-tree overlay that Babel could transfer
without changing the source formalism. The qualifying phrase-tree source still
contains no path, region, endpoint, or other drawing convention.

### Why It Does Not Transfer

The existing gapping card may still use ordinary coindexation when an authored
analysis supplies correspondence classes, but that is not a gapping-specific
visual relation and this source does not justify a new card.

**Decision:** no Ordered Gapping Alignment visual-relation card. Do not invent
arrows between the pairs.

## Null Anaphor Is Not a Separate Visual Relation

Source: Lauren Haynie (2008), *Null Complement Anaphora: Why Syntax Matters*:
[paper](https://www.linguistics.berkeley.edu/~syntax-circle/fall08/haynie.pdf).

Haynie reviews the deep-anaphor analysis in which the NCA site has no internal
syntax and is represented as a free variable. The visible syntactic witness is
therefore an authored silent complement/proform, not a recoverable hidden
subtree with its own geometry. If an authored analysis links that object to an
antecedent, Babel can reuse the existing anaphoric dependency.

**Decision:** no Null Anaphor card or renderer family. Use an authored silent
leaf plus an existing reference relation when the analysis supplies one.

## Strict, Sloppy, and Vehicle-Change Readings Are Not New Drawings

Strict/sloppy readings and vehicle change alter which occurrences are
coindexed or how a recovered expression is interpreted. The source search
found indices, feature bundles, strike-through inside semantic formulas, and
alternative readings, but no stable additional mark on a constituency tree.

Source check: Jason Merchant (2005), *Ellipsis*, section 2.2.1, defines vehicle
change through matching indices and contrasts between overt and unpronounced
expressions; he explicitly calls it a problem rather than a solution:
[handout](https://home.uchicago.edu/~merchant/pubs/berkeley.ellipsis.pdf).

**Decision:** use alternative lens states or authored relation values over the
existing recoverability and coindexation primitives. These are alternative
interpretations, not consecutive derivational stages. Do not invent a
strict/sloppy path or vehicle-change arrow. If the Lab later demonstrates the
contrast, it belongs as two lens states on one ellipsis card, not as a new
relation card.

## PF Pruning, Obliteration, and Zero Realization

PF pruning and whole-node Obliteration describe a before/after pronunciation
operation. The source search found before/after trees for structure removal and
trees whose E-marked terminals receive `∅`, but no pruning cut or Obliteration
path on a retained constituency tree. A changed tree is authored derivational
state, not a renderer overlay. Zero realization instead maps a structurally
present terminal to the exponent `∅`; it is not deletion of the syntax node.

Source check: Neil Banerjee (2020), *Ellipsis as Obliteration: Evidence from
Bengali Negative Allomorphy*, treats Obliteration as deletion of all features
from E-marked terminals before Vocabulary Insertion. Its comparison tree for
zero insertion shows `∅` at the terminal leaves; the Obliteration operation
does not introduce a reusable path or region mark:
[paper](https://journals.linguisticsociety.org/proceedings/index.php/PLSA/article/view/4692).

### Babel Classification

- PF pruning or Obliteration: use the existing PF before/after state and
  silent-node treatment.
- Zero exponent: use the existing PF Realization equation plate with exponent
  `∅` while leaving the authored terminal structurally present.
- Neither receives a new path, domain, or card solely because the operation
  has a distinct theoretical name.

## Minimum Source-Backed Completion Set

This pass leaves one concrete Lab task:

1. Ellipsis Licensing: `[E]` plaque plus silent complement.

Remnant Escape is now supported by pseudogapping and two-remnant gapping.
Partial Copy Deletion is now supported by Mandarin lower-DP deletion inside a
moved VP and Cantonese lower-NP deletion with surviving resumptive D. Both
compositions have passed the two-context gate.

Whole-copy pronunciation and ordinary Chain Reduction, ordered gapping
alignment, null anaphora, strict/sloppy identity, vehicle change, PF pruning,
Obliteration, and zero realization do not receive separate visual-relation
families. Their exact rendering routes are recorded above rather than left as
unexamined backlog.
