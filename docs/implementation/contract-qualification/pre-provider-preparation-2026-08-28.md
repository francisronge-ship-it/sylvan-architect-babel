# Pre-provider qualification preparation

Date: 2026-08-28

Program 1 is ready for sentence selection and approved provider runs. No parse
provider was called during this preparation, no qualification sentence was
selected, and the current product routes and model controls were not changed.

## Contract baseline

[`pre-provider-contract.manifest.json`](pre-provider-contract.manifest.json)
binds the current audited contract and deterministic pipeline to commit
`8b5189b15ebbb0f3ef03784806d965452d0a2f16`. Its overall source digest is
`89356500f563595ed41caf62427952c8e1de0c5618660151e5930b13b73358ff`.
The qualification item set is deliberately recorded as `unselected`.

The historical incumbent manifest remains unchanged. This new manifest is the
post-audit, post-fix baseline for future qualification comparisons.

## Provider-free run path

The qualification runner now preserves, for every attempt:

- the exact raw output bytes, byte count, and SHA-256 digest;
- the exact requested sentence, framework, model identity, and native settings;
- JSON-repair diagnostics and normalized output when parsing succeeds;
- the typed failure class when parsing or validation fails;
- one deterministic Replay projection and review entry per returned analysis;
- a hash-bound attempt receipt and run receipt.

A successful deterministic pass is only `valid-pending-review`. The machinery
does not declare a parse linguistically correct.

The local review command reuses Babel's real renderer and creates a master page
with a click-through Replay viewer for every analysis. It starts one temporary
Vite process, captures analyses sequentially, and stops its Vite and headless
Chrome processes when finished.

The committed smoke plan uses `Mia laughed.` and `What did Mia see?` only as
existing fixture data for testing this plumbing. They are not qualification
items and have not been selected for the later model comparison.

## Research model candidates

The initial catalog contains exactly three candidates:

| Candidate | Provider model | Native qualification control | Status |
| --- | --- | --- | --- |
| GPT 5.6 Sol | `gpt-5.6-sol` | `reasoning.effort` | unqualified |
| Claude Opus 5 | `claude-opus-5` | `output_config.effort` | unqualified |
| Claude Fable 5 | `claude-fable-5` | `output_config.effort` | unqualified |

The catalog keeps provider-native controls and rejects unknown model IDs,
setting names, and setting values. It records Fable's retention constraint.
These candidates are not exposed in `/research` or used by live parse routes
until each route is technically qualified.

The catalog records the official documentation consulted on 2026-08-28:

- <https://platform.openai.com/docs/models>
- <https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4>

Gemini is not included. Additional candidates require an explicit model choice
and their own exact provider documentation.

## Reproduction

```sh
node scripts/captureContractFingerprint.mjs \
  --out docs/implementation/contract-qualification/pre-provider-contract.manifest.json \
  --label program-1-pre-provider-contract \
  --item-set-status unselected

npm run qualification:smoke -- \
  --out .artifacts/contract-qualification/pre-provider-8b5189b

npm run qualification:review -- \
  --run .artifacts/contract-qualification/pre-provider-8b5189b \
  --out review \
  --browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

The provider-free run receipt is
`0eaa76b9d92b08717eda07ca5f5e1af4846ea482ee5e8a27f87a055cdd0dd075`.
The visual review receipt is
`65b69a5a1e91ea104726ea7a45b5dedc4d3da11bef135a0004e4c761937d0ee4`.
Both record `providerCallsMade: false`.

## Next decision

Francis and the implementation agent must hand-pick the qualification sentences
together. Only after that set is reviewed and frozen should any provider batch
be proposed for approval.
