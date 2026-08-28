# Reference, Control, and Predication Relations: Strict Source Audit

**Date:** 2026-07-30
**Status:** Source audit updated. This file records evidence, not implementation
acceptance. Dependency-tree candidates remain excluded from the Babel drawing
set.

## Qualification Rule

A source qualifies for Babel only when it shows:

1. a constituency or phrase-structure syntax tree that can be represented by
   Babel's `workspaceForest`, and
2. an additional visible relation mark on or around that tree that the ordinary
   dominance structure cannot author.

Dependency trees, f-structures, semantic structures, indices alone, and plain
constituency trees do not qualify. A relation used in one of those systems may
be linguistically relevant, but its drawing is not evidence for a Babel visual
primitive.

## Existing Control Primitive

![Control relation on a constituency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/control-agree-brodahl-fischer-hoyem-figure73.png)

This source draws an explicit controller-to-PRO relation over a
phrase-structure tree. Babel already has this control primitive.

**Result:** source-backed, but not new.

## Rejected: Split Antecedence Dependency Tree

![Rejected split-antecedence dependency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/split-antecedence-pdtc-2026-figure2.png)

Source: Mikulova et al. (2026), *Semantic-pragmatic Annotations in the Prague
Dependency Treebank*, Figure 2:
[paper](https://aclanthology.org/2026.findings-acl.1060.pdf).

The figure does show two reference links from one anaphor to two antecedents,
but it is a deep-syntactic dependency tree rather than a Babel-style
constituency tree.

**Result:** useful linguistic evidence, rejected as a Babel drawing source.
It cannot justify a Lab primitive by itself.

## Rejected: Split Control F-Structure

![Rejected split-control f-structure](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/split-control-beryozkin-francez-figure6.png)

This is an f-structure, not a phrase-structure tree overlay.

**Result:** rejected.

## Rejected: Depictive Dependency Trees

![Rejected subject-oriented depictive dependency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/depictive-secondary-predication-pdt-figure6-177.png)

![Rejected object-oriented depictive dependency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/depictive-object-pdt-figure6-179.png)

![Rejected predicative-complement dependency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/predicative-complement-pdt-figure6-166.png)

The Prague manual calls the extra edge a second dependency or dual dependency,
but all three figures are dependency trees. They do not show how the relation
is drawn over the constituency tree Babel renders.

**Result:** rejected as Babel drawing sources.

## Source-Backed Primary Predication Overlay

![Primary predication relation on a constituency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/primary-predication-brownlow-figure57.png)

Source: Oliver Brownlow (2011), *Towards a Unified Analysis of the Syntax and
Semantics of Get Constructions*, Figure 57:
[dissertation](https://www.qmul.ac.uk/sllf/media/sllf-new/department-of-linguistics/documents/27%29-QMOPAL-Brownlow.pdf).

The `vP` is an ordinary constituency tree. The dotted, double-headed
`Predication` bracket is additional geometry connecting the subject's feature
bundle to the predicating `v` head's matching feature bundle.

**Result:** this qualifies as a source-backed primary-predication relation
overlay. It does not establish split antecedence, split control, depictive
secondary predication, or resultative secondary predication.

## Depictive Secondary Predication

The inspected depictive figures were not selected as Babel drawing references.
The visually crowded candidate is retained in the source cache for audit
history, but it is not part of the accepted Lab basis and receives no card.

Two additional depictive sources were checked:

- Motut's *A Semantics for Object-Oriented Depictives* uses ordinary tree
  structure plus semantic composition, with no relation overlay.
- Demonte's *Rethinking Depictive Secondary Predicates* uses an ordinary
  two-peaked phrase structure and a `LINK` head, with no added relation path.

**Result:** no depictive card is accepted in this pass.

## Resultative Predication

![Dotted common-subject relations in a resultative constituency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/resultative-enfield-figure207.png)

Source: N. J. Enfield (2008), *Verbs and Multi-Verb Constructions in Lao*,
Figure 207:
[chapter](https://pure.mpg.de/pubman/item/item_61007/component/file_218038/Enfield_2008_Verbs%2Band%2Bmulti-verb%2Bconstruction%2Bin%2BLao.pdf).

This is an ordinary constituency tree plus two dotted U-shaped links from
`NP1` to `V1` and `V2`. Enfield explicitly says the dotted lines connect the
verbs with their common subject.

**Result:** this qualifies. It shows that the predication drawing must support
one predicand linked to multiple predicates. It does not supply
resultative-specific geometry: the added mark is the subject-predicate
relation.

## Split Control

![Split-control analysis whose arrows do not draw the split control relations](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/split-control-madigan-figure19.png)

Source: Sean Madigan (2008), *Obligatory Split Control into Exhortative
Complements in Korean*, Figure 19:
[paper](https://citeseerx.ist.psu.edu/document?doi=7cec930bccfccee235e9576d4af544ea76d0de5b&repid=rep1&type=pdf).

This is a phrase-structure tree, but its left arrow is movement of PRO from
`t_PRO` and its right arrow is spell-out of the exhortative head as `-ca`.
The prose says plural PRO enters two binding relations, with the speaker and
addressee; the figure does not draw those two relations.

**Result:** split control is linguistically established here, but no
split-controller drawing is. This source cannot justify automatically extending
Babel's existing control path to multiple controller anchors.

## Split Antecedence

![Asymmetric linking operator used in the split-antecedence discussion](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/split-antecedence-linking-figure169.png)

Source: *Making Sense of Tense*, Figure 169 and the immediately following
split-antecedence discussion:
[dissertation](https://www.collectionscanada.gc.ca/obj/s4/f2/dsk2/ftp02/NQ30384.pdf).

The source defines a real asymmetric operator: the arrow points from the
anaphor to its antecedent. It then applies linking theory to `John told Mary
they should leave`, but does not draw the two links on a constituency tree.
Safir later draws multiple dependency hooks under a sentence, also outside a
phrase-structure tree.

**Result:** the operator is source-backed, but a Babel-compatible
split-antecedence drawing is not. The dependency-tree figure above remains
non-qualifying.

### Accepted overlay translation, 2026-08-23

Francis approved a constrained translation from the Prague figure. Babel does
not import its dependency-tree structure or dark-blue palette. It keeps the
ordinary Babel constituency tree and transfers only the relation overlay: one
hollow square below the dependent and one directed curve from that square to
each authored antecedent. The larger arrowheads and terminal attachments keep
this reference relation distinct from Multiple Agree's shell-to-shell fan.

## Plain Constituency Trees: Not Visual Relations

### Plain PredP Analysis

![Plain PredP constituency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/primary-predication-jones-figure46.png)

The model can author the whole PredP as ordinary tree structure. No extra
relation mark exists. This tree does not qualify even though Brownlow's
separate predication overlay does.

### A Plain Resultative PredP Is Still Not A Relation

![Plain resultative constituency tree](visual-relations-assets/source-recovery-2026-07-30/reference-control-predication/resultative-ausensi-smith-yu-figure13.png)

This analysis is expressed by ordinary PredP structure, so this particular
figure supplies no extra relation mark. Enfield's separate resultative figure
does qualify because it adds dotted subject-predicate links.

## Partial Control And Reference Restrictions

Partial-control sources checked in this pass use inclusive indices such as
`i+`; no extra relation geometry was found.

The reference phenomena were also checked separately:

- I-within-I is formulated as index containment.
- Contraindexing and disjoint reference are formulated as index restrictions
  or non-covaluation conditions.
- Obviation is represented through morphology, indices, or pragmatic
  restrictions.
- Covaluation is defined semantically; overlap is represented through sets,
  cumulative indices, or linear linking notation.

Safir's *The Syntax of Anaphora* explicitly treats obviation as pragmatic
non-covaluation and notes that covaluation and dependency need not be encoded
in syntactic structures:
[OUP chapter](https://academic.oup.com/book/5552/chapter/148498780).
Jacobson's I-within-I analysis likewise derives the effect in a variable-free
semantics and categorial syntax rather than adding a relation overlay:
[paper](https://semanticsarchive.net/Archive/TBkNTMxM/Amsterdam9-Jacobson.pdf).

**Result:** no source-backed constituency-tree overlay was found for these
phenomena. That is a positive research result, not a guess: the sources encode
them by other means.

## Current Outcome

| Phenomenon | Strict source result |
|---|---|
| Ordinary control | Existing source-backed constituency-tree primitive |
| Split control | Linguistically established, but the two controller relations are not drawn |
| Split antecedence | Asymmetric linking operator exists, but no qualifying constituency-tree application was found |
| Primary predication | Source-backed dotted constituency-tree overlay |
| Depictive secondary predication | No accepted card in this pass |
| Resultative secondary predication | Source-backed multi-target dotted constituency-tree overlay; no resultative-specific mark |
| Partial control | Inclusive index notation only |
| Disjoint reference / contraindexing / I-within-I / obviation | Indices, morphology, semantics, or pragmatic restrictions; no qualifying overlay |
| Covaluation / overlap | Semantic/set relations or linear notation; no qualifying overlay |

## Minimum Justified Drawing Set

1. **Keep ordinary Control unchanged.** The split-control sources do not
   justify a multi-controller extension yet.
2. **One general Predication family is justified.** Brownlow supplies the
   one-to-one subject-predicate relation and Enfield supplies its one-to-many
   common-subject generalization. Babel therefore uses one dotted,
   non-movement path family rather than separate primary and resultative
   primitives. Depictives remain outside the accepted card set.
3. **Do not add a general Reference family from this pass.** Split antecedence
   has a real operator but no qualifying tree drawing; the other reference
   phenomena do not supply independent overlay geometry.
