# Domains, Phases, Locality, and Constraint Interaction: Strict Source Audit

**Date:** 2026-07-31
**Status:** Reviewed. Transfer/PIC, Anti-Locality, and Improper Movement use the
accepted source mappings below; Freezing remains intentionally without a
separate overlay. On 2026-08-16, Right Roof was retired as a standalone Babel
relation and card. The Gor figures remain movement research, while any authored
rightward dependency is rendered by ordinary `AbarMove`.

## Qualification Rule

A source qualifies only when it shows:

1. a constituency or phrase-structure tree that Babel can represent with its
   authored tree contract, and
2. an additional visible relation mark that ordinary dominance, node labels,
   indices, or traces do not already express.

The source establishes the relation convention. Babel may use a different
lexicalized tree, but it must preserve the source's anchors, direction,
ordering, and success or failure claim. Tree structure remains model-authored;
the relation renderer adds overlays only.

A qualified relation does **not** need a unique primitive. It may compose
existing paths, arcs, regions, endpoint styles, and failure marks when that
source-backed composition expresses a distinct structural claim. Reuse is the
default; geometry must not be invented merely to make a relation look new.

## Existing Lab Coverage

The Lab already has source-backed drawings for:

- phase domains and multiple phase domains;
- bounding-node crossings in wh-island and complex-NP contexts;
- intervention and Superiority;
- blocked adjunct extraction.

Those cards do not need replacement. This pass asks which remaining relations
have a source-backed transferable drawing convention, including conventions
that deliberately reuse those existing marks.

## Transfer, Spell-Out, and the Phase Impenetrability Condition

![Phase components and an inaccessible Spell-Out domain](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/phase-transfer-pic-fong-page4.png)

Source: Suzana Fong (2025), *Long Distance Agreement: How Phases Constrain
Operations and How to Get Out of Them*, LING 4110/6110 handout 3a, page 4:
[handout](https://sznfng.github.io/files/agree_course/Selected_topics_in_syntactic_theory_4110_6110_Winter_2025_handout%203a.pdf).

The source distinguishes three objects on one phase tree:

- an outer arc marks the phase projection;
- a box marks the accessible phase edge;
- a subordinate dashed arc marks the Spell-Out domain inside the phase.

Its second tree adds a dependency from outside the phase to material inside the
Spell-Out domain and crosses that dependency out. The inaccessible region, not
the whole phase, blocks the operation.

### Exact Babel Drawing

1. Draw the source's tilted solid arc over, but clear of, the authored phase
   label and label that arc `Phase`.
2. Draw the source's tilted dashed arc around the authored complement/transfer
   domain and label it `SOD`.
3. Give the authored edge a roomy outline and place `Phase edge` beside it. Do
   not copy the source's generic `Spec` text into Babel: the authored DP already
   identifies the edge position. The outline remains an overlay; it adds no
   syntax node.
4. When the authored analysis contains a post-Transfer access attempt, copy the
   source's dashed orthogonal path: a filled ball at the outside source, an
   arrowhead at the target inside SOD, and an X at the midpoint of the bottom
   horizontal segment.

Replay needs separate relation frames: phase introduced, complement
transferred, and optional access failure. The final inspection frame retains
the phase arc, transfer-domain arc, and failure path if the failure occurred.

**Result:** Transfer/PIC merits a relation card. It reuses the existing domain
arc, edge mark, dependency path, and X; the source-backed distinction is the
nested, dashed transfer-domain state inside the larger phase domain.

## Anti-Locality

![Complement-to-specifier and specifier-to-specifier anti-locality](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/anti-locality-newman-page16.png)

![Too-short and licensed movement paths](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/anti-locality-newman-page18.png)

Source: Elise Newman, *Middles and Anti-locality: A Generalized Approach*,
pages 16 and 18:
[slides](https://esnewman.github.io/elisenewman/EliseNewmanGenerals.pdf).

The source draws the same kind of movement relation in two structural
environments. A movement path is too short when it crosses too little
structure; adding an intervening projection makes the otherwise comparable
path long enough. The rejected paths are red and dashed, while the licensed
comparison is solid.

### Exact Babel Drawing

- Reuse the ordinary phrasal-movement trajectory. It begins at the lower
  trace/copy and targets the landing phrase shell.
- Render a too-local attempt with the source's dashed quiet path. Replace its
  arrowhead with one short line perpendicular to and centred directly on the
  path endpoint, and add no X.
- Render the licensed comparison as the ordinary solid phrasal trajectory.
- Use two contexts so the viewer can compare a path without an intervening
  projection against a path with one.

**Result:** Anti-locality merits a relation card, but not a new primitive. Its
claim is encoded by path length plus the existing success/failure trajectory
states.

## Tucking-In Is Not a Separate Visual Relation

![First wh-movement: wen moves to the outer Spec-CP](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/tucking-in-hamilton-step1-page67.png)

![Second wh-movement: goqwei tucks into the inner Spec-CP below wen](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/tucking-in-hamilton-step2-page68.png)

Primary source: Michael David Hamilton (2015), *The Syntax of Mi'gmaq: A
Configurational Account*, Figures 17-18, pages 67-68:
[McGill record](https://escholarship.mcgill.ca/concern/theses/cj82kb16g),
[thesis PDF](https://www.collectionscanada.gc.ca/obj/thesescanada/vol2/QMM/TC-QMM-135584.pdf).

Figure 17 is the first derivational state. The structurally higher subject
wh-phrase `wen` moves first to Spec-CP, leaving the object wh-phrase `goqwei`
in its base position. Figure 18 is the next state: `goqwei` moves to a newly
created inner Spec-CP below `wen`. The final ordering therefore preserves
subject-before-object even though the second movement occurs later.

The earlier Bashutski diagrams compare nested and crossing paths, while the
Hamilton figures make the derivational order explicit. Neither source provides
a distinct drawing convention: both use ordinary phrasal movement.

### Babel Classification

If a derivation authors tucking-in, Replay can show its two ordinary phrasal
movements in order. The inner and outer CP specifiers belong to the authored
tree states, and path crossing is merely a geometric consequence of their real
anchors. None of this requires a tucking-in mark, style, endpoint, or overlay.

**Result:** do not create a Tucking-In Lab card or renderer relation. It is a
syntactic analysis expressed by two ordinary phrasal-movement relations plus
the stage trees.

## Head Movement Constraint

![Long head movement across an intervening head](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/head-movement-constraint-matushansky-page90.png)

Source: Ora Matushansky (2006), *Head Movement in Linguistic Theory*, Figure
20a, page 90:
[paper](https://babel.ucsc.edu/~hank/mrg.readings/Matushansky_06.pdf).

The source draws a lower head moving across a closer intervening head and
labels that topology a Relativized Minimality violation. Its surrounding
discussion treats long head movement as a possible exception, so the figure
does not by itself establish that every such path is rejected.

### Exact Babel Drawing

- Reuse the existing head-movement trajectory, with both endpoints on terminal
  head leaves rather than phrase shells.
- Mark the skipped authored head as the intervener when the authored relation
  names that intervention.
- Let the authored analysis determine whether the path succeeds or receives
  the existing failed-intervention treatment; do not infer failure from the
  geometry alone.

**Result:** this is a useful head-movement stress fixture for the existing
intervention primitive. It does not justify another arrow family or an
automatic failure state.

## Improper Movement

![Forbidden lower landings for CP and TP movement](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/improper-movement-poole-page371.png)

Source: Ethan Poole (2023), *Improper Case*, Figures 51-52, page 371:
[article](https://link.springer.com/article/10.1007/s11049-022-09541-6).

The source supplies two matched trees. Movement beginning in CP cannot land in
a lower TP or vP position; movement beginning in TP cannot land in vP. Each
tree visibly combines a higher licensed trajectory with lower candidate
trajectories that terminate in a shaded forbidden band and receive X marks.

### Exact Babel Drawing

1. Copy the source's shared bottom rail from the lower trace/copy.
2. From that rail, draw straight candidate trajectories upward to the centre
   beneath each authored landing phrase. Arrowheads point upward at the phrase
   shells; separate path fragments or sideways targets are not allowed.
3. Shade the authored forbidden landing domain with the accepted smuggling-box
   treatment. The renderer does not infer the region from category names.
4. Put an X where each rejected vertical candidate crosses the lower edge of
   that region. Licensed higher candidates continue above it without an X.
5. Use both source configurations as the generalization test: one CP-origin
   tree and one TP-origin tree.

**Result:** Improper movement merits a relation card. Its distinctive claim is
the combination of ordinary movement trajectories with an authored lower
landing ban; it needs no new primitive.

## Freezing

![Licensed and illicit movement orders for freezing](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/freezing-biskup-page102.png)

Source: Petr Biskup (2017), *Labeling and Other Syntactic Operations*, Figure
22a-b, page 102:
[paper](https://home.uni-leipzig.de/muellerg/igra2/publikationen/Biskup2017b.pdf).

The source contrasts two movement orders. In the licensed order, beta moves
out of alpha first and alpha moves afterwards. In the illicit order, alpha
moves first and beta subsequently attempts to extract from the already moved
alpha. The relation is therefore derivational history, not a special shape on
one static tree.

### Babel Decision

The source gives Freezing no distinctive drawing. Both panels contain ordinary
movement arrows; only their derivational order changes. Numbering those paths or
adding a special failed arrow would create a visual convention the source does
not establish.

**Result:** no separate Freezing card or renderer relation. Babel may replay an
authored derivation in which extraction precedes or follows movement, and
ordinary movement paths may persist across those frames, but Freezing itself is
not a visual overlay.

## Right Roof and Upward Boundedness

![Licensed rightward movement within the embedded CP roof](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/right-roof-gor-page74.png)

![Illicit rightward movement beyond the embedded CP roof](visual-relations-assets/source-recovery-2026-07-31/domains-phases-locality/right-roof-gor-page75.png)

Source: Vera Gor (2020), *Experimental Investigations of Principle C at the
Syntax-Pragmatics Interface*, Figures 3.2-3.3, pages 74-75:
[dissertation](https://web.archive.org/web/20240601155342id_/https://ling.rutgers.edu/images/dissertations/gor_dissertation_20202.pdf).

The matched source trees place a compact rectangle around the `CP` node label
for the embedded CP that minimally contains the lower DP trace. They do not box
or shade the whole subtree. In the licensed tree, the rightward DP movement
path lands inside that CP. In the rejected tree, the same kind of path lands
outside the identified CP and receives an X.

### Exact Babel Drawing

1. Draw the extraposed DP with the ordinary phrasal trajectory, from the lower
   DP trace/copy to the landing DP shell.
2. Put a compact outline around the authored minimal cyclic `CP` node label,
   exactly as the source does. Do not add a phase arc, shaded region, or box
   around the subtree.
3. Keep the licensed local path solid, with its landing DP dominated by that
   CP, and copy the source's check mark at the middle of the path.
4. Render the illicit longer path with the existing quiet failure style and
   copy the source's X at the corresponding midpoint.
5. Keep the source's matched local and nonlocal contexts as the generalization
   test; do not tune the path to one sentence.

**Superseded result (2026-08-16):** Right Roof does not merit a separate
relation card. The source-backed syntactic claim available to Babel is ordinary
phrasal movement; the outlined CP and verdict marks are diagram annotations,
not an independently authored relation.

## Relations That Reuse Existing Geometry

### Specific Islands and Weak/Strong Island Contrasts

Subject islands, adjunct islands, complex-NP islands, coordinate-structure
constraints, and wh-islands differ in which authored domain or boundary blocks
which dependency. The Lab already has domain marks, boundary cuts, blocked
paths, adjunct-extraction failure, and an across-the-board exception. The
inspected weak/strong-island sources supplied contrasts and judgments, but not
an additional overlay beyond the domain and dependency marks already used for
individual island analyses. `Weak` and `strong` classify which dependency
types succeed in a domain; they are not themselves shapes.

**Result:** add matched stress contexts when useful. Do not create one icon or
shape per island name. A weak/strong comparison should reuse the same
dependency primitive and show different source-backed outcomes in two authored
environments.

### Superiority, A-over-A, and Candidate Competition

Superiority is already represented by the intervention card. A-over-A and
candidate competition are structural well-formedness conditions when they
only select among possible derivations; they do not add a visible relation to
the tree. Richards's A-over-A comparison, for example, shows the nested goals
and closer candidate in the tree but does not draw an extra path convention:
[source](https://web.mit.edu/norvin/www/papers/Tagalogextraction.pdf), Figure
30b, page 21.

**Result:** no new primitive.

### Criterial Freezing and Strict Cycle

General freezing now has a complete source-backed card above. The separately
inspected criterial-freezing and Strict-Cycle sources use ordinary movement
chains or bracketed derivations without an additional relation convention.

**Result:** do not create separate criterial or Strict-Cycle primitives. Use
the general freezing card when the authored claim is prior movement followed
by blocked extraction; otherwise retain the source's ordinary movement paths.

### Connectedness

The inspected connectedness analyses track paths between an antecedent and
multiple empty categories. That topology overlaps Babel's existing
multi-anchor parasitic-gap and path-highlighting treatments.

**Result:** Connectedness is an analysis of the same parasitic-gap dependency,
not another visible relation in the reviewed sources. Keep it as authored
evidence on the parasitic-gap card unless a source establishes a different
drawing convention.

### Proper Government, ECP, and Gamma Marking

The sources inspected mark traces with unary `+gamma` or `-gamma` annotations
and otherwise use ordinary dependencies. Those annotations can be authored on
the relevant leaf; they are not an overlay by themselves.

**Result:** no separate visual relation.

## Pass Outcome

### New Card Candidates

1. **Transfer/PIC:** existing phase arc plus a nested transfer-domain arc;
   optional blocked-access path.
2. **Anti-locality:** existing phrasal trajectory in too-short failure and
   licensed comparison states.
3. **Improper movement:** ordinary phrasal paths plus an authored forbidden
   landing region and rejected-candidate X marks.
4. **Right Roof (retired as a separate relation):** ordinary rightward phrasal
   movement through `AbarMove`; no roof or verdict overlay.

The three active locality designs deliberately reuse existing primitives. Their
card-level claims are the source-backed compositions: nested transfer state,
too-short comparison, and forbidden landing region. Upward boundedness remains
research context for ordinary movement rather than a separate renderer claim.

### Existing Cards or Stress Contexts

- **Head Movement Constraint:** use the existing head-movement and intervention
  treatment with a skipped head; this is a stress fixture, not a new relation.
- **Specific islands and weak/strong contrasts:** reuse the existing domain,
  boundary, and failed-dependency cards in matched contexts.
- **Superiority:** already covered by Intervention.
- **Connectedness:** already covered by the multi-anchor parasitic-gap
  dependency.

### No Separate Visual Relation

- **Tucking-in:** two ordinary phrasal movements plus authored stage trees.
- **A-over-A and candidate competition:** structural selection among
  derivations, with no additional overlay.
- **Freezing, criterial freezing, and Strict Cycle:** ordinary movement order in
  Replay; the reviewed sources establish no separate overlay.
- **Proper Government, ECP, and gamma marking:** unary annotations on authored
  leaves, not renderer overlays.

The source figures and Babel mappings in the four implemented candidates were
reviewed on 2026-07-31. Relations classified above as stress contexts or as
having no separate visual relation remain outside the new-card set.
