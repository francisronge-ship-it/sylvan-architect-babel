# Labeling, Pair-Merge, and Structural Metadata: Strict Source Audit

**Date:** 2026-07-30
**Status:** Source audit only. No Lab card is accepted or implemented by this
file.

## Qualification Rule

A source qualifies only when it shows:

1. a constituency or phrase-structure tree that Babel can represent, and
2. an additional visible mark or state that ordinary dominance and node labels
   do not already express.

Derivational prose, set notation, and an ordinary labeled tree do not establish
a Babel visual primitive.

## Label Provenance and Strengthening

![Label strengthening](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/label-strengthening-ginsburg-figure1.png)

Source: Jason Ginsburg (2016), *Modeling of Problems of Projection: A
Non-Countercyclic Approach*, Figure 1:
[paper](https://www.glossa-journal.org/article/4818/galley/12729/download/).

The source uses two different trees. An arrow between those diagrams ends at
the newly available label, and the resulting label is circled. It does not draw
a relation over one completed tree.

**Exact Babel representation:** no relation overlay. In one Replay state, the
mother is unlabeled or carries `?`. In the next state, the mother node's own
label becomes `read`, `PhiP`, or whatever label the authored derivation
supplies. The final tree contains the resolved category label and no extra
arrow.

**Result:** this is derivational tree state, not a new visual relation or Lab
card. A source head may explain why the state changed, but this figure does not
justify inventing a permanent source-to-label tether.

## Labeling by Remerge or Evacuation

![Labeling enabled by remerge](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/labeling-by-remerge-ginsburg-figure3.png)

Ginsburg's Figure 3 shows labeling changing over several derivational states.
Remerge moves an obstructing phrase, after which the remaining projection can
be labeled.

**Exact Babel representation:** the ordinary movement path is introduced when
remerge occurs. In the next Replay state, the affected mother node's category
changes from unresolved to resolved. The final frame retains the movement path
and the resolved category, but adds no separate labeling line.

**Result:** this is existing movement plus ordinary tree-state change, not a
new labeling relation.

## Label Failure

![Label failure](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/label-failure-oseki-figure16.png)

Source: Yohei Oseki (2015), *Eliminating Pair-Merge*, Figure 16:
[paper](https://www.lingref.com/cpp/wccfl/32/paper3181.pdf).

The source applies the Labeling Algorithm to a symmetric `{XP, YP}` structure.
Neither daughter can supply the label, so the mother remains `?`. The star
belongs to the `LA` operation printed between the two diagrams; it is not a
mark attached to either daughter.

**Exact Babel representation:** show the ordinary two-daughter tree with `?`
as its mother category in that Replay state. Draw no arrow, X, path, or plaque.

**Result:** label failure is also tree state, not a visual relation.

## Shared-Feature Labeling

![Shared-feature labeling](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/shared-feature-labeling-oseki-figure22.png)

Oseki's Figure 22 shows both daughters bearing `[+F]`; after Feature Sharing,
their mother is labeled `FP`.

**Exact Babel representation:** draw the already accepted Feature Sharing
vines between the two feature-bearing anchors and their one shared feature
token. In the next Replay state, change the mother node's own label from `?`
to the feature-derived category such as `FP`. Do not connect the shared-feature
plaque to the mother with another line.

**Result:** existing Feature Sharing plus tree-state change; no new primitive.

## Pair-Merge and Asymmetric Adjunction

![Minimalist Machine Pair Merge](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/pair-merge-minimalist-machine-arc.png)

Source: Sandiway Fong and Jason Ginsburg's University of Arizona
*Minimalist Machine* documentation:
[glossary](https://sandiway.arizona.edu/mpp/instructions/glossary.html#Merge).
The documentation explicitly contrasts ordinary binary branches for Set Merge
with an arc connecting an adjunct syntactic object to its Pair-Merge host.

The referenced image is now recovered and inspected. It shows ordinary
dominance branches above the structure and one separate shallow arc between
the Pair-Merged member and its host. The arc has no arrowhead.

![Pair-Merged nominal](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/pair-merge-ginsburg-figure4.png)

Jason Ginsburg's 2024 *Constraining Free Merge* supplies a lexical/nominal
context in which `a` or `the` is connected by the same shallow arc to the
`n + book` host:
[paper](https://bioling.psychopen.eu/index.php/bioling/article/download/14015/14015.pdf).
Langendoen independently describes Pair Merge as asymmetric adjunction on a
separate plane:
[paper](https://dingo.sbs.arizona.edu/~langendoen/merge.pdf).

**Exact Babel candidate:**

1. The open relation names an `adjunct` or `pairMember` anchor and a `host`
   anchor. Both can be heads or phrases.
2. Babel leaves both anchors and every dominance branch untouched.
3. The overlay draws one shallow, unheaded arc between the top-center edges of
   the two rendered anchor labels. The arc bows away from their terminals and
   stays clear of any mother branch above them.
4. The same geometry must work for phrase-level adjunction and lexical/head
   Pair Merge. It must not be hard-coded to D and NP.

**Result:** source-backed candidate for a distinct `PairMerge` arc. It is not
yet approved.

## Pair-Member Inaccessibility

![Pair-member invisibility](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/pair-member-invisibility-kls43-slide6.png)

Fong and Ginsburg's KLS43 presentation explicitly says that the first member
of the ordered pair becomes invisible to subsequent probing and feature
valuation, while the second remains visible:
[slides](https://ginsburg-lab.h.kyoto-u.ac.jp/WebPresentations/KLS43Pres-vers7.pdf).
The source still draws only the Pair-Merge arc. It does not dim, strike, box,
or otherwise restyle the inaccessible member. Jun Omune gives the same
theoretical consequence for phrase-level Pair Merge:
[paper](https://www.jstage.jst.go.jp/article/elsj/34/2/34_266/_pdf).

**Exact Babel representation:** the `PairMerge` relation preserves which
authored role is the inaccessible first member, and the Relation Inspector can
state that fact. The tree drawing remains the unheaded arc above. Babel must
not invent a second dimming or strike-through primitive from this source.

**Result:** source-backed semantics, but no independent drawing or card beyond
`PairMerge`.

## Adjunct Inaccessibility / Blocked Extraction

![Adjunct Condition](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/adjunct-condition-oseki-figure20.png)

Source: Yohei Oseki (2015), *Eliminating Pair-Merge*, Figure 20:
[paper](https://www.lingref.com/cpp/wccfl/32/paper3181.pdf).

This is not a Pair-Merge figure. Oseki analyzes the adjunct as a transferred
part of a two-peaked structure. The source makes that domain's attachment
dashed, labels the dependency `*extraction`, and draws a double-ended curved
diagnostic between the embedded DP and the intended landing site.

**Exact Babel candidate:**

1. The open relation names an extraction source, an intended landing anchor,
   and an inaccessible adjunct domain.
2. Babel leaves the authored tree intact, but the overlay demotes the
   source-authored attachment path of the transferred adjunct to the same
   dashed style shown in the source.
3. It draws one long curved diagnostic between the extraction source and
   landing site with endpoint heads at both ends, matching the plate. It is
   explicitly labeled as blocked; it is not a licensed movement trajectory.
4. A second Lab tree must demonstrate that the routing follows the authored
   adjunct domain and anchors rather than one fixed right-edge configuration.

A Yale thesis supplies a complete lexical tree with the operator moving from
inside a PP adjunct to Spec,CP:
[thesis](https://ling.yale.edu/media/273/download?inline=).
That comparison confirms the intended anchors but adds only ordinary movement
arrows, so it does not replace Oseki's distinctive blocked-extraction plate.

**Result:** source-backed candidate for a separate
`AdjunctInaccessibility`/`BlockedExtraction` relation. It is not Pair Merge and
is not yet approved.

## Idiom-Chunk Cointerpretation

![Idiom-chunk cointerpretation](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/idiom-chunk-cointerpretation-ahn-figure94.png)

Source: Byron Ahn, *Mapping OUT-Argument Structure*, Figure 94:
[paper](https://www.byronahn.com/pub/Ahn-Mapping-OUT-Argument-Structure.pdf).

The source underlines the exact terminal chunks that must be interpreted
together and places one bracket beside the complete interpretation domain. Its
second tree demonstrates that the chunks can be structurally separated.

An overlay is defined by its ownership, not by how far it sits from the tree.
Babel can place an independent SVG stroke just beneath a measured terminal
label without changing the authored word, category, or dominance structure.
The bracket can likewise be derived from an authored domain anchor and the
measured extent of that domain's rendered subtree.

**Exact Babel candidate:**

1. The open relation authors two or more chunk roles plus one interpretation
   domain. The chunk roles may name a terminal or a phrase whose visible
   terminal descendants form that chunk.
2. The renderer draws a restrained underline beneath each visible terminal in
   every named chunk. Adjacent terminals on one baseline may share one
   continuous stroke; staggered terminals receive separate aligned strokes.
   These strokes are overlay marks and do not alter the terminal glyphs.
3. The renderer draws one thin square bracket in the nearest collision-free
   side gutter of the authored domain. Its caps point inward and its vertical
   span follows the actual rendered domain, not the full canvas.
4. The underlines and bracket share one relation layer and appear together.
   No path or arrow connects the chunks, because the source does not draw one.

Figure 94a supplies the smaller internal-argument domain; Figure 94b supplies
the larger external-argument domain. A useful Lab proof therefore has to render
both configurations cleanly. A single hand-tuned tree would not establish that
the bracket routing generalizes.

**Result:** provisionally approved by Francis. It is a composed drawing of
terminal-anchor underlines and a domain-side bracket. Its Lab implementation
must include both source configurations; approval does not permit replacing the
source bracket with an invented connector or proving only one hand-tuned tree.

## Conflation Transfer

![Conflation](visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/conflation-hale-keyser-figure9.png)

Source: Kenneth Hale and Samuel Jay Keyser, *The Basic Elements of Argument
Structure*, Figure 9:
[paper](https://ling-phil.mit.edu/papers/hale/papers/hale012.pdf).

The phonological matrix `[turn]` appears on the upper head and the lower head
is represented by a trace. The authors explicitly say that the syntactic
effect is head adjunction and that conflation is a variant of Head Movement.
The figure adds no independent relation path.

The search was expanded to Harley's account and to later implementations.
Harley's *Getting Morphemes in Order* treats conflation as copying a
phonological feature matrix at Merge:
[chapter](https://whamit.mit.edu/wp-content/uploads/2016/12/Harley2013Getting_Morphemes_in_Order_Merger_Affixation_and_Head_Movement.pdf).
An open LSA proceedings article instead writes the phonological `π` features on
successive heads and describes them as shared upward:
[paper](https://journals.linguisticsociety.org/proceedings/index.php/PLSA/article/download/3714/3432/4795).
Neither source adds a dedicated transfer line to one completed tree.

**Exact Babel representation:** no new conflation path. Use the source-authored
phonological features or exponents on the relevant head anchors, then compose
the existing Head Movement and PF Realization drawings only when that analysis
actually authors them. Do not infer movement from the word `Conflation`.

**Result:** no independent conflation primitive found after the broader source
pass.

## Current Strict Outcome

Francis has provisionally approved **one new Babel visual-relation drawing**:
idiom-chunk cointerpretation. This pass additionally recovers two
source-backed candidates for review; it does not approve them.

The rest resolve as follows:

- label provenance, label failure, and label repair are category changes in
  the authored Replay tree, not relation overlays;
- head projection is already expressed by authored microsteps and ordinary
  tree state, so it receives no separate relation overlay;
- shared-feature labeling reuses Feature Sharing plus a category change;
- Pair Merge is a source-backed unheaded arc between member and host;
- Pair-member inaccessibility is semantics carried by that arc and receives no
  second drawing;
- Oseki's blocked adjunct extraction is a separate source-backed candidate,
  not a Pair-Merge inaccessibility mark;
- idiom-chunk cointerpretation is provisionally approved as underlined chunk
  anchors plus a domain bracket, with both source configurations required in
  the Lab;
- conflation has no independent source mark and composes existing authored
  head/PF states where applicable.
