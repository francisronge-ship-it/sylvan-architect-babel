<div align="center">
  <img width="1200" alt="Sylvan Architect Babel interface" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sylvan Architect Babel

**Sylvan Architect Babel** is a structural syntax analysis tool that generates explicit, theory-driven syntax trees for natural language sentences.

Originally conceived as an English X-bar theory tree generator, the system operates at the level of **abstract grammatical structure**, allowing it to generalise across languages, scripts, and typological families without relying on language-specific rules or translation.

---

## Overview

Sylvan Architect Babel visualises syntactic structure as a **derivational process**, not a static result.

Instead of returning a single finished parse, the system exposes:
- the lexical items involved
- the bottom-up construction of structure
- the final hierarchical representation
- structural explanations and metrics derived from the tree

All views correspond to the **same analysis**, shown from different structural perspectives.

---

## 1. Arboretum Link (Input)

The **Arboretum Link** is the single input channel.

- Users enter a sentence (e.g. *“The farmer eats the pig”*)
- No language selection or preprocessing is required
- The sentence is treated as raw linguistic input

Submitting the sentence initiates a full syntactic derivation.

---

## 2. Catalog (Lexical Inventory)

The **Catalog** displays the lexical inventory used in the derivation.

It presents:
- Each lexical item as an individual unit
- The assigned syntactic category (e.g. D, N, V)
- The linear order in which items enter the derivation

The Catalog makes explicit the distinction between:
- **lexical items** (The, farmer, eats, the, pig)
- **derived structure** (phrases, projections, hierarchy)

This view corresponds to a **lexical array / derivational workspace**, independent of phrase structure.

---

## 3. Syntactic Growth Simulation (Bottom-Up Derivation)

The **Syntactic Growth Phase** is a **bottom-up animation** of structure building.

What this view shows:
- Lexical items being introduced
- Minimal projections forming
- Binary merge operations combining constituents
- Structure growing upward from lexical material

No clause-level structure is assumed in advance.

This animation corresponds to **derivational syntax**, making merge order and local constituency explicit before full hierarchical structure is formed.

---

## 4. Linguistic Arboretum (Full Tree)

The **Linguistic Arboretum** displays the completed hierarchical structure.

Here the system presents:
- Full clause structure (e.g. CP, InfP / TP, VP)
- Determiner Phrases (DP) instead of bare NPs
- Head–complement relations
- Null functional heads where required

This is the final, theory-committed representation:
- every node is explicit
- no surface-order shortcuts are used
- structure is inspectable at all levels

---

## 5. Structural Genealogy (Explanation)

The **Structural Genealogy** panel provides a written structural explanation of the analysis.

It accounts for:
- clause typing
- subject licensing
- functional projections
- verbal argument structure

This text explains **how the tree was built**, not what the sentence “means”.

---

## 6. Arboretum Metrics

The **Arboretum Metrics** panel exposes quantitative properties of the generated tree:

- **Syntactic depth** (number of hierarchical layers)
- **Node population** (total structural nodes)
- **Structural complexity** (density indicator)

All metrics are derived directly from the structure itself.

---

## 7. Modular Views

The interface allows switching between:
- Catalog (lexical inventory)
- Growth simulation (bottom-up derivation)
- Full tree (arboretum)
- Structural genealogy (notes)
- Metrics

Each view represents the **same underlying derivation**, not separate analyses.

---

## What this system is (and is not)

**Sylvan Architect Babel is:**
- a structural syntax visualiser
- a theory-driven grammar exploration tool
- a way to inspect hierarchical linguistic structure

**It is not:**
- a translation system
- a language detection tool
- a trained parser for specific languages

---
