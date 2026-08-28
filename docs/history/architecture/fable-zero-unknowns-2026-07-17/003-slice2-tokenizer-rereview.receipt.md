# Babel Slice 2 Fable Re-Review Receipt

- Verdict: `GREEN`
- Session: `427b652e-30ef-4c75-b6fa-51cc91531330`
- Visible Terminal window: `10355`
- Source transcript line: `1814`
- Verdict SHA-256: `daa7ca373cd6899b215384719762e0399bb58e5850c999d8ae26bdc306f61743`
- Reviewed branch: `codex/babel-cross-platform`
- Reviewed HEAD: `ae447dbc76a2a56cae467fa44287970a90f498c3`
- Reviewed index: empty
- Post-review short-status SHA-256: `c3a3180c7e45fdc4b2c1d5431514b9ab05a67b395df6e9bbd3d67e4f602908ed`

Fable independently verified:

- focused tokenizer tests: 5/5 pass;
- full provider-free tests: 35/35 pass;
- TypeScript and parse-contract checks pass;
- generated build, verification, audit, network-guard, and semantic-run evidence recomputes;
- Slice 2 differs from the committed Slice 1 semantic baseline only at the two intended tokenizer source hashes;
- parser and Replay tokenization remain aligned;
- no silent linguistic invention or repair was observed;
- adversarial Unicode, multilingual, emoji, symbol, private-use, normalization, possessive, and mismatch cases pass;
- the repository remained read-only, unstaged, and uncommitted during review.

Non-blocking limitations:

- The no-`Intl.Segmenter` fallback is intentionally weaker for CJK dictionary segmentation and ZWNJ-joined scripts; the enforced Node 24 runtime includes full ICU.
- ICU-version changes can alter dictionary segmentation, but baseline hashes expose the drift.
- Maximal adjacent symbol and emoji runs remain one token by design.

Slice 2 is safe to commit exactly as reviewed.
