# Agreement, Features, Case, and Licensing: Strict Source Audit

**Date:** 2026-07-30
**Status:** Source audit only. No Lab card is accepted or implemented by this
file.

## Qualification Rule

A source qualifies only when it shows:

1. a constituency or phrase-structure tree that Babel can represent with its
   authored tree contract, and
2. an additional visible relation mark that ordinary dominance and node labels
   do not already express.

Plain feature-bearing trees, prose descriptions, dependency structures, and
detached feature diagrams do not establish a Babel visual primitive.

## Multiple Agree

### Successful Multiple Agree

![Successful Multiple Agree](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/multiple-agree-success-nevins-page-966.png)

Source: Andrew Nevins (2011), *Multiple Agree with Clitics: Person
Complementarity vs. Omnivorous Number*, Figure 61:
[paper](https://faculty.georgetown.edu/rtk8/Nevins%202011%20multiple%20agree%20with%20clitics%20NLLT%20final%20version.pdf).

One T probe sends two curved, directed Agree paths to two distinct DP goals.
Both paths exist in the same representation. The higher goal takes a short
inward curve; the lower goal takes a large curve outside the left edge of the
tree. This is not a symmetric fan.

### Failed Multiple Agree

![Failed Multiple Agree](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/multiple-agree-failure-nevins-page-964.png)

The same paper's Figure 55 uses the same two-path geometry for an illicit
Person Case Constraint configuration. The failure is marked by a star on the
whole tree, not by an invented X on either path.

**Result:** `MultipleAgree` qualifies as a one-probe-to-many-goals fan-out.
Success and failure use the same relation geometry; grammaticality is a
separate state of the authored analysis.

## Cyclic Agree

![First- and second-cycle Agree](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/cyclic-agree-keine-dash-page-680.png)

Source: Stefan Keine and Bhamati Dash (2023), *Movement and Cyclic Agree*,
Figure 1:
[paper](https://link.springer.com/content/pdf/10.1007/s11049-022-09538-1.pdf).

The first cycle searches the probe's complement. The second cycle becomes
available only after the specifier is merged and expands the probe's search
space. The source numbers the two curved, directed paths in separate diagrams.
Babel introduces them in separate replay relation frames, then keeps both
numbers visible on the final inspection frame so the front card does not show
cycle 2 without its preceding cycle 1.

**Result:** `CyclicAgree` qualifies as an ordered Agree trajectory. It is not
simultaneous Multiple Agree. Babel must preserve the cycle order and should not
show cycle 2 before its goal exists.

## Feature Sharing

![Case-feature sharing](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/feature-sharing-keine-page-13.png)

Source: Stefan Keine, *Phi-Feature Sharing*, Figure 18:
[paper](https://stefankeine.com/papers/feature-sharing.pdf).

The source places empty feature brackets under four heads and connects those
positions by undirected association lines to one shared Case feature. The
brackets are part of the source's feature notation, not a requirement that
Babel copy its schematic tree. In the Lab, an ordinary lexicalized Babel DP
therefore supplies the terminal anchors, the lines begin just below those
terminals, and one green Babel plaque carries the shared feature. The feature
still has one representational identity; it is not copied into four plaques.

**Result:** `FeatureSharing` qualifies as an undirected many-to-one fan-in to
one shared feature token. It is not Multidominance because the shared object is
a feature, not a subtree. It is not ordinary Agree because there is no
probe-to-goal direction.

## Case Assignment and Feature Collection

![Case assignment and feature collection](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/case-and-feature-collection-norris-page-18.png)

Source: Mark Norris, *Agreement in the Nominal Domain*, Figure 37:
[manuscript](https://babel.ucsc.edu/~hank/mrg.readings/norris.concord.qp.pdf).

The source explicitly distinguishes two relations. Babel preserves that
geometry while retaining its own green feature-plaque styling:

- the solid, directed path from P to the `DAT` row in K's compact bracket is
  Case assignment;
- the dotted paths connecting the bracket's `PL` and `MASC` rows to their
  sources are Agree/feature collection.

**Result:** a generic `CaseAssignment` dependency qualifies. Its target is the
Case feature borne by the nominal, not the phrase shell. Feature collection
can reuse an Agree dependency plus feature plaques; this figure does not draw
the later PF feature-copying fan-out described in the prose.

## Dependent Case

### Low Dependent Case

![Low dependent Case](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/dependent-case-low-poole-page-8.png)

### High Dependent Case

![High dependent Case](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/dependent-case-high-poole-page-9.png)

Source: Ethan Poole (2024), *Dependent-Case Assignment Could Be Agree*,
Figures 10 and 11:
[paper](https://www.glossa-journal.org/article/9894/galley/23778/download/).

Each derivation has two ordered relations:

1. one caseless DP values the first probe and unlocks the dependent-Case probe;
2. the newly active probe assigns dependent Case to the other DP.

The low and high configurations reverse which argument unlocks the probe and
which receives dependent Case. The source draws one elbow connector per step,
with filled circular endpoints and the two feature states adjacent to their
syntactic anchors. Earlier elbows do not accumulate into the next diagram.

**Result:** `DependentCase` qualifies as an ordered two-step relation composed
from feature-state change and Case/Agree dependencies. It is not a static
three-anchor bracket and not one simultaneous hyperedge.

## Expletive-Associate Licensing

![Expletive-associate Agree](visual-relations-assets/source-recovery-2026-07-30/agreement-case-licensing/expletive-associate-deal-page-287.png)

Source: Amy Rose Deal (2009), *The Origin and Content of Expletives*,
Figure 3:
[paper](https://linguistics.berkeley.edu/~ardeal/papers/Deal-there2.pdf).

The tree has `there` in Spec,TP, satisfying the structural requirement, while
T separately agrees with the associate DP `a train`. The source does not draw
a three-way relation connecting T, `there`, and the associate.

**Result:** Babel's existing expletive-associate card has the correct topology:
the expletive occupies the subject position and carries no invented plaque,
while the T probe relates to the associate. No new EPP hyperedge is justified.

## Rejected as New Geometry

### Generic EPP

The inspected EPP handout encodes satisfaction through occupancy of Spec,TP,
an `[EPP]` feature, or ordinary movement. Its expletive examples are bracketed
strings rather than constituency-tree overlays.

**Result:** EPP is a feature/derivational condition, not a separate visual path.

### Domain Broadcast and PF Feature Copying

Norris describes copying the feature bundle from K to inserted AGR nodes
throughout a nominal domain, but the inspected source does not draw that
fan-out on a constituency tree.

**Result:** no independent broadcast card from this source. Do not turn prose
into unsourced geometry.

### Case Stacking, Inheritance, Absorption, and Resistance

The inspected sources express these through multiple Case values, feature
movement, deletion, or ordinary tree structure. No additional tree-overlay
convention passed the qualification rule in this pass.

**Result:** compose feature plaques, state changes, ordinary movement, and
Case dependencies when the authored analysis requires them. Do not add one
generic "Case stack" relation.

### Failed or Partial Agree

Nevins supplies a real failed Multiple Agree context, but no source inspected
here establishes a separate generic failed-Agree geometry. A failed relation
must retain the geometry of the attempted Agree relation and carry its
authored failure state.

## Minimum Source-Backed Drawing Set

1. **Multiple Agree:** one probe, multiple simultaneous directed goals.
2. **Cyclic Agree:** ordered, numbered search cycles.
3. **Feature Sharing:** multiple bearers converge on one undirected shared
   feature token.
4. **Case Assignment:** directed assigner-to-Case-feature dependency.
5. **Dependent Case:** ordered unlock-then-assign sequence, demonstrated in
   both low and high configurations.

Binary Agree and expletive-associate licensing reuse the existing Agree
family. Generic EPP, domain broadcast, Case stacking, and generic failed Agree
do not receive new primitives from this pass.
