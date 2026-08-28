# Babel Slice 1 Correction Re-review

Continue in this exact existing Babel Fable session. Perform a rigorous, read-only blocking review of the corrected Slice 1 baseline implementation in:

`/Users/francisronge/Projects/Babel`

Do not edit files. Do not call providers or use the network. Do not broaden into Slice 2 or unresolved product/benchmark decisions.

## Repository Boundary

- Branch: `codex/babel-cross-platform`
- HEAD must remain: `42fb68fe24f568c2faa20d9a9f16c90c4a69aa97`
- Index must remain empty.
- Commit `42fb68f` remains an unaccepted intermediate checkpoint.
- The correction is intentionally unstaged and uncommitted.
- The checkout contains substantial Francis-owned dirty work. Review only the task-owned Slice 1 correction and do not treat unrelated dirty paths as part of it.

Task-owned correction surfaces:

- `.gitignore` (`/bench-baseline/` addition only)
- deletion of `docs/implementation/baselines/2026-07-23-provider-free.json`
- `docs/implementation/baselines/provider-free-baseline-spec.md`
- `docs/implementation/baselines/provider-free-baseline.semantic.json`
- `scripts/captureProviderFreeBaseline.mjs`
- `scripts/providerFreeNetworkGuard.cjs`
- ignored generated evidence under `bench-baseline/`

Previous verdict:

`/Users/francisronge/.codex/marry-the-sun-runs/babel/20260723T153158Z/fable/001-review-existing.verdict.md`

## Required Re-review

Re-test whether the correction actually closes all eight prior requirements:

1. Verification receipts come from commands that really executed and are bound to hashed logs.
2. Named probes isolate their named rule, while the unresolved-refId masking behavior is separately and honestly labeled.
3. Provider-free execution is enforced by a network guard rather than asserted by a literal counter.
4. Artifact placement follows W0: committed tool/spec/stable semantic receipt; volatile generated evidence only under ignored `bench-baseline/`; no Francis path/status leakage.
5. Raw fixture bytes are hashed.
6. All six planning packet artifacts are hashed: five normative files plus the supporting dossier.
7. The semantic/volatile partition is explicit, and separate full captures prove deterministic byte-identical semantic output.
8. The Node runtime floor or TypeScript-import coupling is explicit and enforced.

Also independently inspect for correction-induced correctness, security, reproducibility, evidence-integrity, maintainability, or dirty-boundary defects.

## Reported Proof To Verify, Not Assume

- Build, `verify:all`, and offline audit executed successfully with hashed logs.
- `verify:all` includes typecheck, 30/30 tests, and both parse-contract fixtures.
- Thirteen network surfaces self-tested; runtime network attempts were zero.
- A forced socket attempt exited `86`; unguarded internal capture was refused.
- Two fresh semantic workers matched.
- A separate full rerun produced the same semantic hash and byte-identical durable receipt.
- Five normative packet hashes plus the dossier hash are recorded.
- Raw, normalized, and Replay fixture bytes are recorded.
- Both normalized/render-plan parity results remain true.
- Unresolved-anchor acceptance remains recorded.
- The four-field authored contract remains exactly `statement`, `stageRecord`, `visualRelations`, `workspaceForest`.
- Non-task dirty status was preserved.

## Verdict Contract

Return:

- `GREEN` only if Slice 1 is safe to commit and proceed beyond this gate, with no blocking finding.
- Otherwise `RED`, followed by every blocking finding in severity order with exact file/line references, a simple explanation, and the required fix.

Do not approve later slices. This verdict concerns only whether the corrected Slice 1 may be committed.
