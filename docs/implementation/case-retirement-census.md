# Legacy Case Metadata Retirement Census

## Decision and boundary

Francis's deletion decision is settled. This census verifies the implementation
reach before retiring the four legacy `SyntaxNode` properties:
`case`, `assigner`, `caseEvidence`, and `caseOvert`.

Opening repository boundary:

- branch: `codex/babel-cross-platform`
- HEAD: `9846c0b46361e7def0a5f55c6fc63957747d4ef5`
- ahead/behind: `16/0`
- index: empty
- full short-status SHA-256:
  `0a7b4df5804c6e18791513932de0f1bc6d9d4aaa1102d43b9f2c1a3ff602eddf`

The sweep used exact-field searches for all four names, broader searches for
`Case`/`case assignment`, the complete tracked and untracked tree, and Git
history. It also followed the browser-local Tree Bank read/write path, replay
construction, rendering, Miles-format export, provider normalization, fixtures,
and tests.

## Classified reach

| Surface | Classification | Evidence | Retirement action |
| --- | --- | --- | --- |
| `types.ts` `SyntaxNode` declarations | live canonical type, obsolete | The only current type declaration of the four fields; no typed consumer reads them. | Delete all four properties. |
| `server/babelParser/syntaxTree.js` | live parser write-through, obsolete | The only production property reads and writes: four input reads followed by four writes to normalized nodes. | Delete the write-through. Unknown legacy input keys are ignored; authored labels, words, ids, silence, lineage, children, spans, and token indices remain unchanged. |
| `server/babelParser/derivationCompiler.js` stage clone | live generic carrier, unexpected but non-semantic | The compiler deep-cloned authored `workspaceForest` objects without inspecting their keys, so legacy metadata survived in stage workspaces even after the final-tree write-through was deleted. The focused test exposed this path. | Keep the stage clone/expansion path intact, then strip only the four retired keys from the cloned forest. |
| `legacyCaseMetadata.js` | bounded retirement/compatibility policy | Parser stage clones and historical Tree Bank bundles need the same exact-key deletion without field-name drift or duplicated recursive walkers. | Centralize the four-key syntax-node deletion. The helper mutates only already-cloned data and never interprets linguistic values. |
| Current model-facing prompt/schema | canonical contract | No occurrence of any of the four field names in the current prompt, system instruction, request schemas, or route configuration. | No change. This slice is model-invisible. |
| Raw and normalized provider-free fixtures | tests/fixtures | No syntax node carries an exact legacy metadata key in current `fixtures/` or pre-existing `tests/`. Authored relation roles remain outside this check. | No fixture rewrite. Add a focused synthetic legacy-input test. |
| Browser Tree Bank write | persisted-save path | `createTreeBankBundleSnapshot` deep-clones current artifacts before IndexedDB storage. A historical bundle opened and saved again could otherwise carry unknown legacy node keys forward. | Strip only the four legacy node keys from final trees and stage workspaces before persistence. |
| Browser Tree Bank read | historical-load compatibility | IndexedDB v1 stores whole parse bundles. Case metadata was live from commit `37005da` until this retirement, so historical entries can contain the four keys. | Clone and strip the four keys at load time. Do not mutate or rewrite the archived IndexedDB record. |
| Tree Bank entry normalization/open | historical-load consumer | `normalizeTreeBankEntry` is the sole IndexedDB reader; `handleOpenTreeBankEntry` clones its already-normalized bundle. | Route the bundle through the load compatibility function before validation and display. |
| Development preview bundle | import-only tooling | `devBundle` and `__BABEL_DEV_SET_ANALYSIS__` bypass Tree Bank and are not persisted historical-save readers. | No compatibility shim. |
| Miles labeled-bracketing export | export | `serializeMilesNode` reads only label, word, and children. | No change. |
| Replay compiler and renderer | live consumers | No property read for any legacy field. Generic object cloning could carry unknown keys, but rendering never interprets them. | No semantic or rendering change. Tree Bank load removes the keys before historical records enter this path. |
| `CASE ASSIGNMENT` replay detail title | authored linguistic content | `replay/replayCompiler.ts` schedules an authored detail block by its literal title. It is not a `SyntaxNode.case` metadata read. | Preserve exactly. |
| Authored relation names/roles mentioning Case or `assigner` | authored linguistic content | Open relation ontology permits Case commitments, and an anchor role may literally be named `assigner`. | Preserve exactly. Case analysis belongs in authored stage prose/relations, not retired node metadata. |
| Research prose and reports | historical/research content | Human-language mentions of Case describe analyses and benchmark cases. | Preserve. |
| Visual-relations lab `{ case, caseOvert }` data | Francis-owned research-lab surface | Present only in the current dirty/untracked lab, outside canonical product gates. | Preserve every byte; not part of this retirement diff. |
| Stale `plans/` declarations | historical planning | Plans quote the old type surface but are not executable or canonical. | Preserve as historical context. |
| Historical parser test | historical test | Commit `37005da` introduced a now-removed `test/` assertion that Case fields survived normalization. | Superseded by the retirement and new compatibility tests. |
| Server/database persistence | absent | Repository invariant forbids parse persistence as a parser side effect; no live server record path consumes these fields. | No migration. |

## Historical-load rule

The compatibility boundary is deliberately one-way:

1. Archived Tree Bank bytes remain untouched.
2. A cloned in-memory view drops only the four legacy node metadata keys.
3. All authored syntax, stage prose, relation names, relation roles, surface
   tokens, and generation provenance remain byte-for-byte decoded values.
4. Any later save uses the current canonical view and cannot write the retired
   keys back into live Tree Bank data.

This is reader tolerance, not a compatibility alias: the current parser and
`SyntaxNode` type do not expose Case metadata. The same exact-key policy removes
generic stage-clone carry-through while leaving the existing expansion path
unchanged, as required by W8's unexpected-consumer rule.

## CE-1 and operation-synonym boundary

The frozen program assigns operation/field synonym cleanup to CE-1/W6, not to
the Case-retirement W8 package. This slice therefore does not change operation
names, relation names, prompt wording, or alias handling. In particular,
`CASE ASSIGNMENT` remains authored replay content rather than a metadata alias.

## Acceptance proof

The focused suite must prove:

- legacy provider node keys are ignored without changing authored syntax;
- an old Tree Bank record loads and re-saves without any retired key;
- the archived source object/serialized bytes remain unchanged;
- authored Case prose and Case relations survive the migration;
- current fixture syntax nodes remain free of legacy metadata without forbidding
  authored relation roles such as `assigner`;
- `npm run verify:all` passes provider-free.

## Provider-free proof receipt

Generated output remains ignored at
`bench-baseline/slice6-case-retirement/`; it is evidence, not a commit surface.

- focused retirement tests: 3/3 passed;
- `npm run build`: exit 0, log SHA-256
  `27bf9ec6f6e1d071a3c1dc32bc808de8579cf860798798bf4ab4a09598f4150f`;
- `npm run verify:all`: exit 0, 69/69 tests, log SHA-256
  `5bc4fc6774486ec278a96d06057625b59cadeddb5f518b74b24dc74ef6875d20`;
- `npm audit --offline --json`: exit 0, log SHA-256
  `2ab27d5e777ffad62e77357cc001899971c2d7907db925d3ad063d4fe6e6314e`;
- deny-by-default guard: active; all 13 declared surfaces blocked by
  self-test; zero runtime network attempts;
- two fresh guarded semantic workers:
  `eb91c9e2f38a0c0a2e005d6c9a658518ff481c95566ba86c4d1342be8f69430f`
  for both runs;
- generated proof JSON SHA-256:
  `947d3924eb540bf83f2e063a1421b74cf6b133348da9aff75fd251c0a25c76f4`.

## Thermo-nuclear code-quality review

Final verdict: **GREEN**.

The first strict pass found one blocker in the proof rather than production:
the fixture census recursively inspected every object key, which would have
misclassified a legitimate open-ontology relation role named `assigner` as
retired node metadata. The test now traverses only canonical syntax-node roots;
the old-save test separately proves that the authored `assigner` relation role
survives.

The review also removed an unnecessary single-element forest wrapper in the
shared compatibility helper. No duplicate production walkers remain. The new
shared module is 31 lines; the focused test and census remain below 200 lines.
`App.tsx` was already above 1,000 lines before this slice; the task adds only
the five load-boundary lines required to normalize historical IndexedDB
bundles and does not introduce another branch or persistence abstraction.
There is no file-size threshold crossing, scattered feature check, cast-heavy
contract, or wrong-layer renderer/provider logic.
