# Babel Visual Relations Research

Date: 2026-04-26

Status: local-only research note. Do not commit.

Purpose: collect how syntacticians actually draw relations on and around trees, then translate that into a Babel visual-relations design that keeps the linguistic ontology open.

## Core Finding

Syntacticians do not draw one kind of relation.

They draw a primary constituent tree, then add overlays:

- movement lines
- traces, copies, gaps, and silent material
- coindexation
- feature labels and feature associations
- case/theta/Agree links
- boxed domains for islands or phases
- deletion/ellipsis marks
- shared-node or multi-mother structures for multidominance
- separate derivational levels, especially pre-movement vs post-movement
- surface strings or gloss lines when the tree alone is not enough

For Babel this means: `visualRelations` must not be "movement arrows with a new name." It must become a layered visual grammar for syntactic evidence.

The renderer can have finite visual primitives. The model-authored ontology must stay open.

## Source Plates

These are source screenshots/plates to inspect while designing. Some are hotlinked from public source pages so the local research doc does not copy image files into the repo.

### Head Movement: T-Lowering And V-Raising

Source: The Science of Syntax, "Head-movement".

![English T lowering from The Science of Syntax](https://opentext.ku.edu/app/uploads/quicklatex/quicklatex.com-921e20e2ce8b1787afb510c7e3051565_l3.png)

![French V raising from The Science of Syntax](https://opentext.ku.edu/app/uploads/quicklatex/quicklatex.com-7b26da758cc835a9422e508518589ba2_l3.png)

What matters:

- Head movement is often drawn with arrows between head positions.
- The arrow is a readability overlay.
- The trace/copy in the original head position is the structural witness.
- This is directly relevant to Babel: arrows may animate, but the tree must contain the lower silent witness.

Design implication:

- Head-to-head relations need a different line geometry from phrasal movement.
- Head movement should snap to head/preterminal nodes, not the phrase canopy.
- Lowering must be drawable downward. Not all movement is upward.

### Binding / C-Command / Coindexation

Source: The Science of Syntax, "Binding theory".

![Binding/c-command diagram from The Science of Syntax](https://opentext.ku.edu/app/uploads/quicklatex/quicklatex.com-14437a27b120c966f53d60baa075fbdb_l3.png)

What matters:

- Binding is often drawn through indices and structural domains, not movement arrows.
- The relation is interpretive and configurational.
- The visual proof is c-command plus local domain, not trajectory.

Design implication:

- Babel needs non-arrow relations.
- Binding/control/coreference should use identity halos, index badges, and domain shading.
- Clicking an antecedent should reveal bound dependents and the domain that licenses or blocks the dependency.

### TreeForm: Movement, Coreference, Feature Association

Source: Derrick and Archambault, "TreeForm: Explaining and exploring grammar through syntax trees".

Source figure page:
https://www.researchgate.net/figure/Syntax-tree-illustrating-movement-in-a-question-and-its-corresponding-answer-C-is-a_fig3_220675427

Source article:
https://www.researchgate.net/publication/220675427_TreeForm_Explaining_and_exploring_grammar_through_syntax_trees

What matters:

- TreeForm explicitly treats syntax trees as rooted trees plus extra syntactic features.
- It names the big three: movement lines, coreference, and feature association.
- It also supports case, feature, and theta-role material as draggable annotations.
- Its movement lines are Bezier curves with controllable handles.

Design implication:

- Babel should not build visual relations as a special-case "movementEvents" successor.
- Babel should build a relation overlay engine.
- Relations need independent geometry, styling, labels, hover states, and click behavior.

### LaTeX Practice: qtree, forest, TikZ Arrows

Sources:

- CTAN qtree:
  https://www.ctan.org/pkg/qtree
- CTAN forest:
  https://ctan.org/tex-archive/graphics/pgf/contrib/forest
- Overleaf, "Arrows for Syntax Diagrams with Forest":
  https://www.overleaf.com/latex/templates/arrows-for-syntax-diagrams-with-forest/xjyvcszgcspv
- CTAN tikz-qtree:
  https://www.ctan.org/pkg/tikz-qtree

What matters:

- Syntacticians often encode the tree in bracket notation, then draw relation arrows with explicit source/target node names.
- The forest/TikZ practice gives fine-grained control over exit angles, entry angles, line style, and overlap avoidance.
- The diagrammer often knows the relation first, then adjusts the curve so it does not obscure the tree.

Design implication:

- Babel should generate good default curves, but allow relation-line inspection and later manual adjustment.
- Anchor roles matter more than raw node IDs.
- Relation geometry should be recomputed from stable anchor coordinates, not stored as brittle absolute pixels.

### Parasitic Gap

Source: Wikimedia Commons, CC BY-SA 4.0, "Parasitic gap tree".

Source page:
https://commons.wikimedia.org/wiki/File:Parasitic_gap_tree.png

What matters:

- Parasitic gaps are not a simple source-to-one-target movement arrow.
- One operator can license a real gap and a parasitic gap.
- The visual relation is multi-anchor: one pronounced phrase, one ordinary gap, one parasitic gap, sometimes inside an island-like domain.

Design implication:

- `visualRelations` must allow more than two anchors.
- Anchors must have model-authored roles.
- The renderer must support fan-out, forked dependencies, and shared dependency labels.

### Phase / Domain Boundaries

Source: Gunes 2024 on PIC and prosodic phrasing:
https://www.mdpi.com/2226-471X/9/5/162

What matters:

- Phases are visual-domain objects, not only node-to-node relations.
- The crucial contrast is inside/outside a domain and edge/complement accessibility.
- Phase effects can also interact with PF/prosodic boundaries.

Design implication:

- Babel needs domain overlays: translucent boxes, edge bands, spell-out shading, and domain labels.
- A relation can target a domain, not only a node.
- Domain overlays must not clutter Canopy. They belong in Replay and in optional relation lenses.

### Postsyntactic Lowering / Local Dislocation

Source: Gong, "Postsyntactic Lowering and linear relations in Dagur noun phrases":
https://www.glossa-journal.org/article/id/5422/

What matters:

- Lowering and Local Dislocation are both displacement-like, but they differ in what they see.
- Lowering is sensitive to hierarchy before linearization.
- Local Dislocation is sensitive to linear adjacency after linearization.

Design implication:

- Babel needs a PF/morphology layer, separate from narrow-syntax movement.
- The same visible morpheme displacement can be a different relation depending on whether it is hierarchical or linear.
- The renderer should support tree-space relations and string-space relations.

### Ellipsis / Deletion

Sources:

- Merchant, "The Syntax of Sluicing":
  https://academic.oup.com/book/48626/chapter/422372911
- Cecchetto et al. on predicate ellipsis in LIS:
  https://www.sciencedirect.com/science/article/abs/pii/S0024384114002952

What matters:

- Ellipsis can involve unpronounced internal structure.
- The visible surface has silence; the analysis may contain a full hidden constituent.
- Ellipsis needs an antecedent/recoverability relation.

Design implication:

- Babel needs hidden-structure rendering.
- An ellipsis site should be shown as a muted collapsed subtree, a deletion veil, or a recoverable ghost, not as a movement trace.
- Clicking the ellipsis site should reveal the antecedent and optionally expand the silent structure.

### Multidominance / Right Node Raising

Sources:

- Bosveld-de Smet and de Vries, "Visualizing Non-subordination and Multidominance in Tree Diagrams":
  https://research.rug.nl/en/publications/visualizing-non-subordination-and-multidominance-in-tree-diagrams
- Philip, "What Divides, and What Unites, Right-Node Raising":
  https://direct.mit.edu/ling/article/54/4/685/107990/What-Divides-and-What-Unites-Right-Node-Raising

What matters:

- Some syntactic analyses require more than ordinary tree dominance.
- Right Node Raising can be analyzed with ellipsis, multidominance, or interaction between them.
- Multidominance is a graph problem, not just a tree overlay.

Design implication:

- Babel must eventually support DAG-like display.
- A shared constituent should not be faked as two independent copies unless the analysis says copy.
- Shared material needs a "same node, multiple parents" visual affordance or a shared-subtree portal.

## Exact Drawing Practices Found

### 1. Tree First, Overlay Second

The tree is the object. Relations decorate it.

Babel rule:

- Layout the tree first.
- Resolve relation anchors second.
- Draw overlays third.
- Keep overlays removable without changing the tree.

### 2. Movement Is Shown Twice

Syntacticians usually show movement with both:

- a structural witness: lower trace/copy/gap/silent copy
- a visual guide: arrow, movement line, or coindexation

The arrow is not enough.

Babel rule:

- If the tree has no witness, the relation is visually unresolved.
- Do not invent the witness.
- Do not show a confident movement arrow from a relation that the workspace does not anchor.

### 3. Arrows Are Readability, Not The Structure

The Science of Syntax explicitly treats movement arrows as reader help. The trace is the real structural object.

Babel rule:

- Movement arrows can animate and persist.
- The lower silent node must be styled as silent, not emerald.
- The relation line should never be the only evidence.

### 4. Subscripts And Shared Indices Are A General Relation Device

Subscripts are used for movement chains, binding, copies, feature association, and sometimes theta/case relations.

Babel rule:

- Visible indices should be optional in the UI.
- The system still needs internal relation IDs.
- Node IDs must never leak into prose or the normal UI.

### 5. Domains Are Drawn As Regions

Islands, phases, spell-out domains, binding domains, and prosodic domains are not arrow-like. They are areas.

Babel rule:

- Add region overlays: box, canopy tint, edge marker, locked complement shade.
- A visual relation may anchor to a domain.
- Domain overlays should be layer-controlled.

### 6. Silent Material Is A First-Class Visual Object

Syntax uses silence constantly: traces, PRO, pro, null heads, deleted VP, sluiced TP, null operators, implicit arguments.

Babel rule:

- Silence is not absence.
- Silent nodes need stable, muted rendering.
- Different silent kinds can differ by glyph, opacity, outline, or label, but they must not look pronounced.

### 7. Feature Relations Are Often Labels, Not Lines

Feature checking/valuation is commonly shown through feature labels near nodes: `[nom]`, `[uF]`, phi features, case features, or matching indices.

Babel rule:

- Feature relations need badges and before/after valuation states.
- A dashed probe-goal line is useful only when it clarifies search or locality.
- Feature valuation should not be forced into movement geometry.

### 8. Some Relations Are Multi-Anchor

Parasitic gaps, across-the-board movement, agreement with multiple goals, coordination sharing, and split antecedence require relation sets.

Babel rule:

- `visualRelations[].anchors` must support any number of anchors.
- Anchor roles are open model-authored labels.
- The renderer chooses a layout from anchor topology, not from a closed syntactic kind list.

### 9. Relation Curves Need Craft

LaTeX/forest practice names nodes and then draws curves with exit/entry angles. TreeForm uses Bezier curves and lets the user adjust control points.

Babel rule:

- Relation geometry is part of the product.
- Default arrows must avoid labels and branches.
- A future syntactician workspace should let users drag relation handles without changing the analysis.

### 10. Some Analyses Need More Than A Tree

PF lowering, local dislocation, linearization, prosody, ellipsis recoverability, and multidominance often need another visual plane.

Babel rule:

- The workspace should have layers:
  - tree layer
  - relation overlay layer
  - surface string layer
  - PF/morphology layer
  - domain layer
  - hidden-structure layer

This is still one workspace. Not modes.

## Visual Relation Archetypes For Babel

These are renderer archetypes, not prompt ontology. The model can write any `kind` and `subtype`. Babel maps anchor topology and relation intent to visual forms.

### A. Trajectory Relations

Use for:

- wh-movement
- A-movement
- head movement
- raising
- scrambling
- topicalization
- focus movement
- clitic climbing
- remnant movement
- roll-up movement
- lowering
- covert movement, if the stageRecord commits to LF

Visual form:

- curved arrow or path
- persistent after introduction
- source and landing highlighted on click
- source copy/trace muted
- pronounced copy emerald
- head movement uses tight head-to-head path
- phrasal movement uses phrase-to-position path
- lowering permits downward arrow
- roll-up/remnant uses nested sequential paths with prior moved material visibly inside the remnant

Critical rule:

- Movement must be tied to node anchors in `workspaceForest`.

### B. Identity / Copy / Chain Relations

Use for:

- copy chains
- reconstruction
- lower-copy interpretation
- coindexation
- repeated lineage
- resumption if modeled as identity-linked

Visual form:

- shared index badge
- thin glow around chain members
- optional chain rail in side inspector
- no arrow unless the stage says there is displacement

Critical rule:

- Identity is not automatically movement.

### C. Binding / Control / Coreference Relations

Use for:

- anaphor binding
- pronoun binding
- Condition C effects
- obligatory control
- non-obligatory control
- PRO controller relation
- logophoric dependencies

Visual form:

- dotted or curved relation line without arrowhead
- shared index badge
- domain shading for binding domain
- c-command path highlight when clicked
- PRO remains silent/muted

Critical rule:

- These are interpretive/configurational dependencies, not motion paths.

### D. Feature / Agreement / Licensing Relations

Use for:

- Agree
- Case valuation
- phi agreement
- EPP satisfaction
- wh/Q feature checking
- selectional licensing
- polarity licensing
- concord

Visual form:

- feature badges on nodes
- dashed probe-goal line if useful
- before/after state in replay
- relation inspector shows valuation path
- intervention blockers can be highlighted as local obstacles

Critical rule:

- Do not force feature relations into arrows unless the analysis also has movement.

### E. Domain / Locality Relations

Use for:

- phases
- phase edges
- islands
- spell-out domains
- binding domains
- intervention domains
- prosodic domains
- cyclic transfer

Visual form:

- translucent box/canopy around domain
- edge band on accessible material
- complement shade for inaccessible material
- domain label positioned outside the tree
- relation line can terminate at the edge, not inside the domain

Critical rule:

- Domains are visual regions, not node-to-node paths.

### F. Silence / Ellipsis / Deletion Relations

Use for:

- VP ellipsis
- sluicing
- gapping
- stripping
- pseudogapping
- null operator
- pro
- PRO
- deleted lower copies
- silent heads
- unpronounced complementizers

Visual form:

- muted ghost subtree
- collapsed "silent structure" capsule
- deletion veil or hatch
- antecedent bridge
- expandable hidden structure
- no emerald leaves unless pronounced

Critical rule:

- The UI must distinguish unpronounced structure from absent structure.

### G. Sharing / Multidominance Relations

Use for:

- right-node raising
- across-the-board dependencies
- multidominance
- shared arguments
- coordination sharing
- sideward movement outputs

Visual form:

- shared node with multiple incoming parent lines
- or one canonical shared node plus portals from conjuncts
- relation inspector shows every parent path
- if analysis chooses ellipsis instead, use ellipsis visuals instead

Critical rule:

- Do not render a shared node as duplicated copies unless the analysis says copy.

### H. PF / Morphology Relations

Use for:

- lowering
- local dislocation
- morphological merger
- fusion
- fission
- impoverishment
- suppletion
- readjustment
- vocabulary insertion
- clitic placement
- postsyntactic merger

Visual form:

- separate PF/morphology lane
- morpheme badges on terminals/heads
- hierarchy-sensitive lowering path in tree-space
- adjacency-sensitive local dislocation in surface-string space
- fusion: many feature nodes collapse into one exponent capsule
- fission: one feature bundle splits into multiple exponents
- suppletion/readjustment: replacement badge with before/after

Critical rule:

- PF operations must not be visually confused with narrow-syntax movement.

### I. Linearization / Surface-Order Relations

Use for:

- discontinuous constituency
- extraposition
- heavy shift
- surface scrambling
- clitic placement
- prosodic rephrasing
- final surface witness

Visual form:

- surface string rail below the tree
- token-to-leaf connectors on hover
- crossings can be shown as temporary relation curves
- final Canopy remains clean unless relation layer is active

Critical rule:

- Babel’s core promise is deep structure to surface order. The surface rail should make that explicit.

### J. Scope / LF Relations

Use for:

- QR
- covert wh
- scope reconstruction
- focus association
- operator-variable interpretation
- negative polarity licensing if modeled at LF

Visual form:

- translucent LF overlay
- dotted covert path
- scope bracket above domain
- operator-variable line distinct from overt movement

Critical rule:

- Covert relations must look covert. Do not animate them like overt tree movement unless the derivation stage says to.

## Proposed Babel Contract Direction

Keep the authored stage order:

1. `statement`
2. `stageRecord`
3. `visualRelations`
4. `workspaceForest`

Recommended `visualRelations` shape:

```json
{
  "kind": "model-authored open name",
  "subtype": "model-authored open refinement",
  "evidence": "short text from this stageRecord that licenses the relation",
  "anchors": [
    { "role": "model-authored role", "refId": "node_or_domain_ref" }
  ]
}
```

Do not add a fixed syntactic kind list to the prompt.

Do not ask the model to choose from movement/binding/ellipsis/etc.

Instead:

- The model names the relation freely.
- The model provides anchors.
- The model provides evidence from `stageRecord`.
- Babel renders using anchor topology and non-linguistic visual heuristics.

Example visual-routing logic:

- two node anchors with source/landing-like roles: trajectory candidate
- one pronounced anchor plus one or more silent gap anchors: dependency/chain candidate
- one node plus one domain: domain/locality candidate
- multiple anchors with same role class: multi-anchor dependency candidate
- feature-bearing anchors: feature relation candidate
- hidden/collapsed subtree anchor: ellipsis/silence candidate
- anchors in surface rail: PF/linearization candidate

This preserves open ontology because the renderer is interpreting geometry, not forcing theory categories.

## Interactive Workspace Design

### Canopy

Canopy remains the clean final tree.

Default:

- no arrows
- no warnings
- no visualRelation overlays
- pronounced leaves emerald
- silent material muted
- final tree readable as a professional syntax diagram

Optional:

- relation layer toggles can temporarily show overlays
- click a node to inspect relations

### Replay

Replay is where visual relations live.

Frame sequence:

1. bottom-up microsteps build the stage workspace
2. relation mesosteps introduce visualRelations once anchors exist
3. macro frame shows completed stage workspace and full `stageRecord`

Rules:

- relation lines persist after introduction
- movement appears in the frame where movement happens
- no teleporting
- no branch disappearance/rebuild when identity is continuous
- if a relation is not currently visible, it is hidden from the tree but visible in the replay inspector

### Relation Inspector

Click any relation:

- highlight all anchors
- show `kind`
- show `subtype`
- show model-authored anchor roles
- show exact stage number
- show the `stageRecord` evidence sentence
- show whether anchors are visible in this frame
- show silent/pronounced status of each anchor

No production warnings. This is inspection, not an error panel.

### Node Inspector

Click any node:

- show label/category
- show pronunciation state
- show stage of introduction
- show lineage/copy family
- show connected visual relations
- show surface token if pronounced
- show hidden/silent descendants if collapsed

### Layer Controls

These are layers, not modes:

- Trajectories
- Identity/copies
- Binding/control/coreference
- Features/Agree/licensing
- Domains/phases/islands
- Silence/ellipsis
- Sharing/multidominance
- PF/morphology
- Linearization/surface
- Scope/LF

The user can turn layers on/off without changing the derivation.

### Search / Treebank

For the future derivational database:

- search `kind`
- search `subtype`
- search `stageRecord`
- filter by anchor role
- filter by relation topology
- find all derivations with multi-anchor dependencies
- find all derivations with silent structures
- find all derivations with lowering-like geometry
- compare model outputs by relation richness and structural grounding

This is how Babel becomes a derivational treebank, not only a tree renderer.

## Design Decision: What Babel Must Not Do

Babel must not:

- collapse `visualRelations` into movement arrows
- use a fixed syntactic checklist in the prompt
- display relation IDs in prose or UI
- make unpronounced traces emerald
- invent relations from prose without anchors
- invent syntactic witnesses
- make Canopy visually busy by default
- treat PF lowering, Local Dislocation, QR, binding, and ellipsis as the same arrow
- treat finite renderer primitives as a finite theory of syntax

## Design Decision: What Babel Should Do Next

Build the visual-relations layer in this order:

1. Overlay architecture
   - independent from tree layout
   - relation geometry computed after node coordinates exist
   - persistent relation state across replay frames

2. Anchor resolver
   - resolve from current authored stage `workspaceForest` first
   - support node anchors, domain anchors, hidden anchors, and surface-token anchors
   - never let old `movementEvents` override model-authored anchors

3. Relation inspector
   - make every relation inspectable before adding many visual styles

4. Core visual forms
   - trajectory arrow
   - identity halo/index
   - feature badge/dashed probe-goal
   - domain box
   - ellipsis ghost/collapse
   - multi-anchor fan

5. Advanced visual forms
   - multidominance/shared node
   - PF/morphology lane
   - scope/LF overlay
   - surface string rail

6. Treebank metadata
   - save open `kind` and `subtype`
   - save renderer-inferred topology
   - save evidence span from `stageRecord`

## The Architecture In One Sentence

Babel should render syntax as a clean tree plus an inspectable, time-aware overlay system where each visual relation is anchored in the authored workspace and licensed by the authored derivational prose, while the model remains free to name and analyze phenomena without a closed ontology.
