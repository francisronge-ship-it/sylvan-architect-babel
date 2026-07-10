# Babel Repository Contract

Use Node 24.x and ESM. Replay tests import `.ts` modules through Node's built-in type stripping.

## Commands

- `npm ci` — install the committed dependency graph.
- `npm run dev` — start the Vite development runtime.
- `npm start` — start the Express runtime.
- `npm run build` — build the frontend; this does not typecheck.
- `npm run typecheck` — run the repository-wide TypeScript check.
- `npm test` — run the provider-free Node test suite in `tests/`.
- `npm run verify:parse-contract` — verify committed normalized parse fixtures.
- `npm run verify:offline` — run tests and parse-contract verification without provider keys.
- `npm run verify:all` — run typecheck plus the complete offline verification path. Use this as the default completion gate.
- `npm run fixtures:build` — regenerate normalized parse fixtures from committed raw fixtures.
- `npm run fixtures:replay` — regenerate deterministic replay projections from normalized fixtures.
- `npm run audit` — audit the installed npm dependency graph.

## Canonical ownership

- `server/babelParser/systemInstruction.js` and `server/babelParser/prompts.js` define the model-facing prompt contract.
- `server/babelParser/routeConfig.js`, `modelRuntime.js`, and `parseRoutes.js` own provider configuration and transport behavior.
- `server/babelParser/parseNormalization.js` and `derivationCompiler.js` own parser normalization and derived structures.
- `replay/` owns React-free replay construction and replay fixture projection.
- `components/TreeVisualizer.tsx` owns React/D3 rendering; keep pure replay construction out of this file.
- `types.ts` mirrors the browser-visible parse contract.
- `fixtures/` and `tests/` are the committed provider-free verification surface.

## Invariants

- `derivationStages` is the sole model-authored derivation source. Every stage has exactly `statement`, `stageRecord`, `visualRelations`, and `workspaceForest`.
- Final trees, surface order, resolved visual relations, replay steps, and Notes are derived from those stages. Do not reintroduce parallel authored ledgers, growth frames, commitment graphs, or compatibility aliases.
- `visualRelations` uses an open ontology. Keep model-facing relation and anchor names open; finite classifications belong in derived renderer logic.
- Notes are the ordered non-empty `derivationStages[].stageRecord` values.
- Tree Bank is browser-local and stores only current parse artifacts and approved bundle metadata. Do not add server parse persistence or logging as a side effect.
- Keep provider request shapes and routes stable unless a scoped behavior change is explicitly intended and verified.
- Prompt, system-instruction, and route-config changes alter benchmark conditions. Review them as contract changes and keep generation provenance truthful.
- Replay compiler modules must remain importable in Node and must not import React or components.

## Verification and safety

- Default verification must not require credentials, network access, browser automation, or paid provider calls.
- Never print or commit environment values, API keys, authorization headers, or local credential contents. Document names and safe placeholders only in `.env.example`.
- `test/` is gitignored; add executable tests under `tests/` as `*.test.mjs`.
- A diff in `fixtures/normalized/` or `fixtures/replay-snapshots/` is a behavior change. Review it; never accept blind regeneration.
- `.artifacts/` and `docs/research/data/` contain research harnesses, not default product gates. Do not add their provider or browser dependencies to the application unless a current task requires them.
- Preserve unrelated tracked and untracked work. Stage and commit only task-owned paths or hunks.
