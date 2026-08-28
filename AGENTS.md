# Babel Repository Contract

## What Babel is

Babel is an AI-powered environment for generating and studying syntax. Frontier models author derivations for an input sentence; Babel validates those records, derives their final structures and Replay, and draws them as interactive D3 trees and relation graphics. It is both a syntax-learning tool and a research surface for examining the syntactic and broader language capabilities of current frontier models.

Use Node 24.x and ESM. Replay tests import `.ts` modules through Node's built-in type stripping.

## Glossary

- **Parse / analysis**: one complete model-generated analysis of an input.
- **Derivation stage**: one completed model-authored syntactic state.
- **Workspace forest**: every current syntax object at that stage; it may contain one tree or several separate workspaces.
- **Stage Record**: the model-authored explanation of what a derivation stage establishes.
- **Replay**: deterministic playback compiled from the authored derivation stages.
- **Replay step**: one displayed frame within Replay.
- **Structural micro-step**: a renderer-derived selection, projection, or merge step; models do not author these.
- **Relation moment**: the Replay step where one authored relation becomes active.
- **Canopy**: the clean final-tree view.
- **Relation tiers**: Tier 1 is an exact curated relation, Tier 2 structurally recovers known visual primitives, and Tier 3 is the neutral fallback.
- **Personal Tree Bank**: the user's browser-local saved work.

## Commands

- `npm run dev` — start the Vite development runtime.
- `npm start` — start the Express runtime and provider routes.
- `npm run build` — bundle the frontend; this does not typecheck and is not a completion gate.
- `npm run verify:all` — run typecheck plus the complete offline verification path. Use this as the default completion gate.

## Canonical ownership

- `server/babelParser/systemInstruction.js` and `server/babelParser/prompts.js` define the model-facing prompt contract.
- `server/babelParser/routeConfig.js`, `modelRuntime.js`, and `parseRoutes.js` own provider configuration and transport behavior.
- `server/babelParser/parseNormalization.js` and `derivationCompiler.js` own parser normalization and derived structures.
- `replay/` owns React-free replay construction and replay fixture projection. Its modules must remain importable in Node and must not import React or components.
- `components/TreeVisualizer.tsx` owns React/D3 rendering; keep pure replay construction out of this file.
- `types.ts` mirrors the browser-visible parse contract.
- `fixtures/` and `tests/` are the committed provider-free verification surface.

## Derivation contract

- `derivationStages` is the sole model-authored derivation source. Every stage has exactly `statement`, `stageRecord`, `relations`, and `workspaceForest`.
- Final trees, surface order, relation render plans, Replay steps, and stage explanations are derived from those stages. Do not reintroduce parallel authored ledgers, growth frames, commitment graphs, or compatibility aliases.
- Derivation stages are completed syntactic states, not display frames.
- `relations` uses an open ontology. Keep model-facing relation and anchor names open; finite classifications belong in derived renderer logic.

## Product boundaries

- Personal Tree Bank is browser-local. Server-side parse storage is separate product work and must not be introduced as a Tree Bank side effect.
- Provider endpoints and outgoing request payloads are contracts. Change them only when a task explicitly targets that contract, and verify every affected provider.
- Prompt, system-instruction, and route-config changes alter contract-test conditions. Treat them as contract changes and record their exact versions in generation provenance.

## Replay and renderer safety

- Treat `docs/design/visual-relations-renderer-closeout-2026-08-25.md` and `docs/design/visual-relations-tier2-shape-dispatch-spec.md` as behavior contracts. Reopen the renderer only for a reproducible defect; run focused tests and captures plus `npm run verify:all`.
- Replay derives its finer steps from differences between completed derivation stages.
- Ordinary structural micro-steps build forward: selection precedes projection, and a parent appears only when its children are available for merge. Do not reveal a parent or descendant before its own step.
- Moved material remains overt at its source until the movement moment. That moment atomically introduces the complete landing, lower silent copy or trace, trajectory, and any smallest new parent needed to attach the landing above an existing subtree.
- Separate authored relations receive separate moments in authored order. One relation containing multiple anchors remains one simultaneous moment.
- Relation marks appear only at their owning relation moment and then follow their defined persistence.
- Use one camera fit across the micro-steps derived from one authored stage. Existing syntax must not jitter or teleport. Invisible future-layout scaffolding may reserve space but must never become visible, subdivide a current branch, or change current syntax.
- Tier 1 and Tier 2 use the same primitives and pixels; Tier 3 remains neutral. Assign a tier per recovered claim. Tier 2 must not repair a malformed exact Tier-1 claim, but independent sibling claims may survive.
- Bind every mark to its owning claim and exact authored anchor. Keep inseparable pieces in one SVG coordinate group; never attach one by searching for the first similar mark or recompute their relative position from screen space during zoom. Zoom, pan, and fitting must preserve their internal spacing.
- Use the shared emerald neutral style and shared stage, hover, and lens emphasis. Do not add permanent relation-specific glow. Hover must not change geometry, stroke width, opacity, or layout.
- Do not change shared camera fitting, tree layout, or wrappers to repair one fixture. A shared change requires the same defect across representative desktop, mobile, Replay, and zoom cases.

## Verification and safety

- `test/` is gitignored; add executable tests under `tests/` as `*.test.mjs`.
- A diff in `fixtures/normalized/` or `fixtures/replay-snapshots/` is a behavior change. Review it; never accept blind regeneration.
- `.artifacts/` and `docs/research/data/` contain research harnesses, not default product gates. Do not add their provider or browser dependencies to the application unless a current task requires them.
