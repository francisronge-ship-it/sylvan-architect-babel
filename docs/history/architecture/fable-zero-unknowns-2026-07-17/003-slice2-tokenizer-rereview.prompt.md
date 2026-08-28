# Babel Slice 2 Blocking Re-Review

You are the independent blocking reviewer for Babel's second provider-free implementation slice.

Work read-only in:

`/Users/francisronge/Projects/Babel`

Do not edit, stage, commit, generate source files, call providers, use the network, spend money, deploy, push, merge, stash, reset, or clean. Preserve the dirty working tree exactly.

## Anchor

- Branch: `codex/babel-cross-platform`
- Expected HEAD: `ae447dbc76a2a56cae467fa44287970a90f498c3`
- Expected index: empty
- Slice 2 is intentionally unstaged and uncommitted.
- The checkout contains many unrelated Francis-owned tracked and untracked changes. They are protected and are not Slice 2.

## Exact Slice 2 Scope

Review these task-owned changes:

1. The tokenizer changes in:
   `/Users/francisronge/Projects/Babel/server/babelParser/surfaceTokens.js`
2. The new tests in:
   `/Users/francisronge/Projects/Babel/tests/inputGenerality.test.mjs`
3. Only these two task-owned hunks in:
   `/Users/francisronge/Projects/Babel/replay/replayCompiler.ts`
   - the import of `tokenizeSentenceSurfaceOrder`
   - `tokenizeReplaySentenceSurface` delegating to that shared tokenizer

All other current changes in `replay/replayCompiler.ts` predate Slice 2 and are Francis-owned. Do not attribute them to this slice. You may inspect the live file only to judge whether the two Slice 2 hunks integrate safely.

Generated proof evidence is under:

`/Users/francisronge/Projects/Babel/bench-baseline/slice2/`

The committed Slice 1 baseline/spec is under:

`/Users/francisronge/Projects/Babel/docs/implementation/baselines/`

## Intended Behavior

This slice should:

- normalize input to NFC;
- support scripts that do not use spaces;
- preserve authored word-like material;
- preserve maximal symbol, emoji, and private-use runs instead of silently deleting them;
- preserve Babel's intentional Latin possessive splitting;
- keep parser and Replay sentence tokenization aligned through one shared pure tokenizer;
- provide a deterministic fallback when `Intl.Segmenter` is unavailable;
- reject real token mismatches without inventing, dropping, or silently repairing linguistic material;
- preserve existing accepted fixture behavior outside the intended tokenizer correction.

## Claims To Verify Independently

The worker reports:

- focused tokenizer/input tests pass;
- `npm run verify:all` passes with 35/35 tests and parse-contract checks;
- build and offline audit pass;
- the provider-free network guard observed zero attempts;
- two semantic captures match;
- compared with the committed Slice 1 baseline, all non-source semantic fields are unchanged and only the intended tokenizer source hashes differ;
- the index is empty and no Slice 2 commit exists.

Do not accept these claims from prose. Recompute enough evidence to establish them yourself.

## Required Adversarial Review

Inspect the implementation and test at least:

- NFC-equivalent input;
- combining marks;
- RTL text;
- Japanese or another non-whitespace script;
- mixed scripts;
- curly and straight apostrophes and Latin possessives;
- punctuation around words;
- punctuation-only input;
- emoji with variation selectors;
- ZWJ emoji sequences;
- keycaps and regional-indicator flags;
- adjacent symbol runs;
- private-use glyphs;
- nonce forms;
- mixed word/emoji boundaries;
- behavior without `Intl.Segmenter`;
- parser/Replay parity;
- accepted final-stage matching and genuine mismatch rejection.

Look specifically for:

- silent token loss;
- accidental token joining or splitting;
- locale-dependent nondeterminism;
- malformed Unicode handling;
- fallback behavior materially contradicting the main path;
- regressions caused by importing the server tokenizer into Replay;
- tests that merely encode the implementation instead of the intended contract;
- false confidence in the generated baseline evidence;
- accidental staging, committing, or modification of protected work.

Use provider-free commands only. Do not invoke any live model or network path.

## Verdict

Return:

- `GREEN` only if Slice 2 is safe to commit exactly as reviewed, with no blocking correctness, data-fidelity, architecture, portability, or proof problem.
- `RED` if anything blocks the commit.

For `RED`, give severity-ordered findings with exact file and line references, the failing example, and the smallest correct fix. Distinguish blockers from optional improvements.

For `GREEN`, state what you independently ran or recomputed, identify the exact reviewed HEAD and dirty/index boundary, and list any genuinely non-blocking limitations.

Do not modify the repository.
