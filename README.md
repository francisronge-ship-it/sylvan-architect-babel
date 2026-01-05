# Sylvan Architect Babel

**Sylvan Architect Babel** is a syntax tree generator that produces explicit, theory-driven syntactic analyses of natural language sentences.

Originally conceived as an English X-bar theory tree generator, the system operates at the level of **abstract grammatical structure**, allowing it to generalise across languages, scripts, and typological families.

The project explores how enforcing strict category-level classification and structural constraints enables robust syntactic analysis beyond surface form or language-specific rules.

## How Sylvan Architect Babel works

Sylvan Architect Babel represents syntactic analysis as a living grammatical structure rather than a static diagram. A sentence is treated as a seed that grows into a full syntactic arbor under explicit theoretical constraints.

The interface is divided into four coordinated layers.

---

## Linguistic Arboretum (Tree View)

At the centre of the interface is the Linguistic Arboretum: a visual syntax tree rendered according to X-bar–style phrase structure.

Each node corresponds to a grammatical projection (CP, IP/InfP, VP, DP, NP, etc.).

- Heads, complements, and specifiers are explicitly represented  
- Null elements (e.g. null C, null Infl) are included where theoretically motivated  
- The root node reflects the highest projection required by the analysis  

The tree is not hard-coded. It is generated dynamically by committing to grammatical categories and structural relations inferred from the input sentence.

---

## Growth Simulation (Arboretum Growth)

Instead of appearing instantaneously, the tree can be grown.

The growth simulation visualises syntactic structure being assembled **bottom-up**, starting from lexical material and building upward into full clausal structure.

The animation proceeds as follows:

- Lexical items are first introduced and assigned grammatical categories  
- Heads project minimal phrases (N → NP, V → VP)  
- Complements are merged before specifiers  
- Functional structure (Inf/Infl, C) is introduced after lexical domains are established  
- The highest projection emerges last, completing the tree  

This animation is not cosmetic. It mirrors a derivational, compositional view of syntax in which structure is built incrementally through successive mergers.

The result is a tree that feels **grown rather than drawn**, making hierarchical relations and structural dependencies intuitively legible.

> The growth animation is a visualisation of structural composition, not a claim about real-time human sentence processing.

---

## Lexical Strip (Category Attribution)

Beneath the tree, the input sentence is decomposed into lexical units, each explicitly labelled with its grammatical category:

- Determiners (D)  
- Nouns (N)  
- Verbs (V)  
- etc.

This strip shows how surface tokens map into abstract categories before structure is built. It makes clear that the system does not start with words, but with category assignments.

---

## Structural Genealogy (Explanation Layer)

The Structural Genealogy panel provides a prose explanation of the analysis.

Rather than describing the sentence informally, this explanation states:

- What the root projection is and why  
- How tense and agreement are represented  
- Where arguments are licensed  
- Why particular phrases are complements or specifiers  
- How null elements are justified  

This layer exists to make the system auditable. Every tree is accompanied by an explicit theoretical rationale.

---

## Arboretum Metrics (Quantitative View)

Each analysis is summarised with structural metrics:

- **Syntactic depth** — number of hierarchical layers  
- **Node population** — total projections and terminals  
- **Structural complexity** — a coarse measure of density and embedding  

These metrics are not claims about cognitive load; they are descriptive tools for comparing structures across inputs and languages.
