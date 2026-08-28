# Babel Full Thread Checkpoint For Google Docs

Date: 2026-06-05

Purpose: this is a paste-ready checkpoint for Google Docs and for any future Codex thread. It preserves the current Babel state, the renderer stabilization context, the prompt/model-output research, the visualRelations research file, the Mac/new-device pickup plan, and the safe GitHub/artifact/secrets strategy.

This document is intentionally long. It is meant to reduce dependence on one giant Codex thread.

## 1. Project Identity

Babel is a syntactic derivation environment.

It is not only a parser.
It is not only a tree renderer.
Its central product object is the derivation: the sequence of local syntactic decisions by which a sentence comes into being.

A good Babel result must let the user inspect:

- the final tree
- the growth/replay path
- the structural reason for each projection
- movement/copy/trace history
- silent material
- visual relations
- exact surface order
- model-authored derivational prose grounded in tree witnesses

The key idea is: syntax should be visible as growth, not merely reported as a final answer.

## 2. Current Branch And Repository

Repository:

```text
https://github.com/francisronge/sylvan-architect-babel.git
```

Current Windows root:

```text
C:\Users\franc\Codex Imported Workspaces Full\Babel\sylvan-architect-babel
```

Expected Mac root:

```text
/Users/francisronge/Documents/Babel/sylvan-architect-babel
```

Current branch:

```text
codex/babel-cross-platform
```

Current state before this checkpoint:

- dirty worktree
- large parser rename/move from `server/geminiParser` to `server/babelParser`
- renderer stabilization work in `components/TreeVisualizer.tsx`
- replay planning work in `derivationReplayPlan.js`
- provider/service move from `services/geminiService.ts` to `services/parseService.ts`
- new docs under `docs/design/`
- local-only ignored artifacts under `.local-tests`, `test-results`, `.codex-handoff`, and `.local-docs`

Do not assume the Mac `main` branch is current. The Windows branch `codex/babel-cross-platform` is the checkpoint branch.

## 3. Non-Negotiable Babel Rules

These rules are project constraints, not stylistic preferences.

### Derivation And Replay

- The derivational record is the source of truth.
- Replay must be bottom-up.
- Replay must preserve derivational time.
- Select, project, and merge must be recoverable from the authored structure.
- Visual relation frames occur only after their anchors exist.
- Macro frames show the completed stage workspace and full stage record.

### Renderer

- Renderer must not invent syntax.
- Renderer must not invent labels.
- Renderer must not invent movement.
- Renderer must not invent placeholders.
- No disappearing subtrees.
- No no-op frames.
- No teleportation.
- No collapsed select/project/merge steps.
- No bare `t` as a category or preterminal.
- No renderer-made `DP -> PRO PRO`.
- Canopy must equal the final replay tree minus arrows and visual relation overlays.

### Prompt And Provider

- Do not run provider/API parses without explicit user approval.
- Do not add provider retries as the solution.
- Do not add fallbacks as the solution.
- Do not use parser salvage as a linguistic solution.
- Do not touch prompt/system-instruction files without exact proposed wording and approval.
- Keep ontology open. Do not hardcode a closed list of syntactic relation types.

### Git And Local State

- Do not commit `.env.local`, credentials, `node_modules`, build outputs, or large local artifacts.
- Keep source/docs in GitHub.
- Transfer ignored artifacts separately only when needed.

## 4. What Happened In This Thread

The thread began with renderer stabilization.

The initial handoff was:

```text
.codex-handoff/thread-transfer-2026-05-21-renderer-contract/NEW_THREAD_SPEC.md
.codex-handoff/thread-transfer-2026-05-21-renderer-contract/ARTIFACT_INDEX.md
```

The user required comparison against:

- Fresh Claude 5/19 v34
- Fresh Claude 5/20 v20
- Gemini provider v199
- GPT provider v199
- Claude provider v199

The priority was to fix replay renderer problems first and not touch prompt code yet.

The recurring renderer failures included:

- bad PRO/placeholder behavior
- `DP -> PRO PRO`
- John rendered as a preterminal for null
- `DP -> John -> null` spines
- tree stretching and shifting during projection
- lower branches disappearing for one frame
- movement traces teleporting to the right
- rightward movement geometry introduced by renderer heuristics
- unary T/vP branch warping
- selected/projected terminals base-generating too close to each other and then jumping
- nulls being selected in the wrong place
- final frames duplicating whole trees
- arrows disappearing or pointing to the wrong copy
- phrasal movement traces collapsing to one trace when the moved phrase had D and N material
- one-token DPs incorrectly leaving multiple trace leaves

The user repeatedly emphasized:

- a microstep is one action
- visualRelations do not introduce syntax
- tree construction must be bottom-up
- terminals should be visually generated in future merge positions, not clustered and then teleported
- movement happens when a relation frame shows it
- a trace appears only after something has moved out of a position
- phrasal movement moves the phrase, not just one leaf
- one-token proper-name movement should target token/head witness differently from complex DP movement

The renderer eventually reached a good state on the hard recent parses. The user said the latest renderer looked beautiful/perfect after final fixes.

## 5. Renderer Fix Direction That Worked

The successful direction was not a one-off tree patch.

The stable direction was:

- feed replay cleaner planned derivation steps
- keep Canopy separate from replay overlays
- preserve bottom-up microstep order
- use visualRelations as relation frames after anchors exist
- preserve arrows where movement chains should remain visible
- attach phrasal movement arrows to phrase shells
- attach one-token DP movement arrows to the actual trace/token witness where appropriate
- prevent silent material, traces, and nulls from being used as arbitrary placeholders
- avoid tree-diff-only movement inference

One critical bad path was disabled:

```text
inferStageLocalCopyTransitions inferred a Leo transition from tree diff,
then attachImplicitCopyTransitionRelationLinks converted an ordinary generated step into a relation frame.
```

That violated the rule that Babel must not create movement if the model did not author the relation. Future agents must not reintroduce tree-diff-only movement inference.

## 6. Prompt And Model-Output Research In This Thread

After the renderer stabilized enough, attention moved to model-output failures.

Problems observed in model outputs included:

- lower copies marked silent too early
- base occurrences represented as traces/nulls before movement
- duplicate wh DPs
- GPT returning wrong top-level shape
- GPT preserving `word` fields on silent lower copies
- phrase/projection nodes mislabeled with head labels
- generic filler stages such as `Standard processing applied`
- compact sentences being padded to a numerical floor
- model-authored whole structures appearing in stages without enough recoverable derivational order

Prompt pressure that was identified as dangerous included:

- “lower copies are silent” without lifecycle context
- stage wording that made the model think it had to author replay microsteps
- product jargon like “Pro” in model-facing text
- over-specified visualRelations mechanics
- head-movement-specific prompt pressure
- closed or semi-closed ontology wording around movement/copies/traces
- a hard minimum number of derivation stages that pushed small sentences into fake filler stages

Prompt changes already made in the current source branch include:

- stage count should be set by sentence complexity
- repeated unchanged workspaces with generic stage records are not valid derivation stages
- compact sentences may have compact derivations if they remain forward and converged
- non-terminal node labels must label the node itself, not the head that determines the projection

Important wording idea added:

```text
For non-terminal syntax nodes, "label" names the category displayed for that authored node itself. If a phrase/projection node dominates a head, label the phrase/projection node with the phrase/projection category and label the head child with the head category. Do not put a head label on a phrase/projection node merely because that head determines the projection.
```

## 7. Reasoning Effort / Provider Probe Context

The thread explored provider reasoning effort.

The user wanted provider settings to be fair across a benchmark.

Observed:

- GPT `xhigh` was too slow for normal Babel parse use.
- High was also expensive/slow.
- Low effort on simple `Mia laughed.` was tested.
- Gemini low initially returned problematic shape/filler with `Standard processing applied`.
- Prompt was adjusted to remove the numerical floor pressure.
- The simple `Mia laughed.` low-effort devlog was created and published.

Important provider UI idea:

Provider pill controls should influence visible reasoning-effort pills.

Provider-specific effort options:

- Gemini: Minimal, Low, Medium, High
- GPT: Low, Medium, High, XHigh
- Claude: Low, Medium, High, XHigh, Max

This was implemented visually as a reasoning pill next to model/provider pills.

Current UI taste notes:

- Low should not be emerald.
- High should be one color, not black/yellow.
- Max should be stronger red, not pink.
- Pills should use the same frontend code/fonts as other app pills.

## 8. Recent Devlogs / Public Research Pages

Recent public docs/research work included:

```text
docs/research/frontier-provider-high-thesis-2026-05/index.md
docs/research/provider-reasoning-effort-mia-laughed-2026-06-03/index.md
```

The Mia low-effort devlog must include real linguistic analysis, not only JSON/render audit. The user explicitly rejected a non-linguistic explanation about DP/D labels as irrelevant for the devlog body.

The public GitHub Pages link used for Mia low-effort was:

```text
https://francisronge.github.io/sylvan-architect-babel/research/provider-reasoning-effort-mia-laughed-2026-06-03/
```

## 9. The Real visualRelations Research File

The real large research file was found here:

```text
.local-docs/babel-visual-relations-research.md
```

It was created on:

```text
2026-04-26 22:47:20
```

It was last modified on:

```text
2026-04-26 22:48:27
```

It is 23,559 bytes.

It is ignored by Git because `.local-docs/` is ignored.

To preserve it for a Mac/new-device checkout, it has now been copied to:

```text
docs/design/babel-visual-relations-research.md
```

The copied file has the same byte size:

```text
OriginalBytes: 23559
CopiedBytes: 23559
SameSize: true
```

This tracked-safe copy must be committed and pushed.

## 10. What The visualRelations Research File Contains

The file title is:

```text
Babel Visual Relations Research
```

It includes source plates and design analysis for:

- head movement
- T-lowering
- V-raising
- binding
- c-command
- coindexation
- TreeForm relation conventions
- LaTeX/qtree/forest/TikZ arrow practice
- parasitic gaps
- phase/domain boundaries
- postsyntactic lowering
- local dislocation
- ellipsis/deletion
- multidominance
- right node raising

It defines visual relation archetypes:

- trajectory relations
- identity/copy/chain relations
- binding/control/coreference relations
- feature/agreement/licensing relations
- domain/locality relations
- silence/ellipsis/deletion relations
- sharing/multidominance relations
- PF/morphology relations
- linearization/surface-order relations
- scope/LF relations

It also proposes interactive workspace design:

- Canopy
- Replay
- Relation Inspector
- Node Inspector
- Layer Controls
- Search / Treebank

This is the important frontend design document for future visualRelations UI work.

## 11. Wrong Recovery File Created In This Thread

A compact recovered spec was mistakenly created:

```text
.codex-handoff/recovered-visualrelations-frontend-ui-spec-2026-06-04.md
```

That file is not the original massive research pass.
It is safe to ignore or delete later.

The correct file is:

```text
docs/design/babel-visual-relations-research.md
```

## 12. New-Device Pickup File Created

A tracked pickup guide was created:

```text
docs/design/mac-new-device-pickup-2026-06-05.md
```

It contains:

- repo URL
- branch name
- Mac setup commands
- run/build commands
- what not to commit
- current Babel rules to preserve
- files to read first
- new-thread launch prompt
- quick verification commands

This file should be committed and pushed.

## 13. Mac / New Device Setup

If the repo does not exist on the Mac:

```bash
mkdir -p /Users/francisronge/Documents/Babel
cd /Users/francisronge/Documents/Babel
git clone https://github.com/francisronge/sylvan-architect-babel.git
cd sylvan-architect-babel
git fetch origin
git checkout codex/babel-cross-platform
npm ci
npm run build
```

If the repo already exists:

```bash
cd /Users/francisronge/Documents/Babel/sylvan-architect-babel
git fetch origin
git checkout codex/babel-cross-platform
git pull --ff-only origin codex/babel-cross-platform
npm ci
npm run build
```

Run UI:

```bash
npm run dev
```

Run parse server:

```bash
npm start
```

## 14. What Should Go To GitHub

GitHub should carry source and durable docs.

Commit and push:

- `App.tsx`
- `components/TreeVisualizer.tsx`
- `derivationReplayPlan.js`
- `visualRelationLinks.ts`
- `types.ts`
- `server/parseApi.js`
- `server/babelParser.js`
- `server/babelParser/`
- deletion of old `server/geminiParser*`
- `services/parseService.ts`
- deletion of old `services/geminiService.ts`
- `package.json`
- `.env.example`
- `.gitignore`
- `README.md`
- `docs/research/...`
- `docs/design/babel-visual-relations-research.md`
- `docs/design/mac-new-device-pickup-2026-06-05.md`
- this checkpoint file

Do not commit:

- `.env.local`
- `node_modules`
- `dist`
- logs
- `.local-tests`
- `test-results`
- `.local-docs`
- `.codex-handoff`
- contact sheets unless explicitly needed in a report
- provider raw artifacts unless a specific public research page needs them

## 15. Local Artifact Sizes And Transfer Policy

Local ignored artifacts currently include large folders.

Observed sizes:

```text
.codex-handoff: 0.5 MB
.local-docs: 0.1 MB
.local-tests: 2736.9 MB
test-results: 37678.9 MB
```

Do not put all of `test-results` in Git.
Do not blindly zip all of `test-results` unless the user really wants a very large local archive.

Recommended artifact transfer:

- make one small curated zip first
- include `.codex-handoff`
- include `.local-docs`
- include only the most important `.local-tests` render folders
- include only the most important `test-results` folders
- do not include secrets

Candidate important local artifacts:

- `.local-tests/provider-smoke-2026-05-23-fresh-cross-provider`
- `.local-tests/provider-smoke-2026-05-23-fresh-rumor-cp`
- `.local-tests/provider-effort-2026-06-03-gemini-low-mia-laughed-prompt-floor-removed`
- `.local-tests/provider-effort-2026-06-03-claude-low-mia-laughed`
- `.local-tests/provider-effort-2026-06-03-gpt-low-mia-laughed`
- `.local-tests/provider-scout-2026-05-29-gpt-one-high-pronunciation-anchor`
- `.local-tests/fresh-claude-parse-2026-05-19-contract-v1`
- `.local-tests/fresh-claude-parse-2026-05-20-stage-local-visibility-v2`
- `test-results/provider-route-audit-2026-05-12`
- `test-results/coursework-benchmark` if coursework comparison still matters

Use size checks before zipping large folders.

## 16. Best Way To Transfer Secrets

Do not put secrets in Git.
Do not put secrets in a normal artifact zip.
Do not paste secrets into a Codex thread.
Do not paste secrets into Google Docs.

Best options, in order:

1. Use a password manager.
   - 1Password, Bitwarden, iCloud Keychain, or similar.
   - Store each provider key as a named secret.
   - On the new Mac, recreate `.env.local` manually from the password manager.

2. Use GitHub Actions/Repository secrets only if the secret is needed for CI/deploy.
   - This is not the same as local development secrets.
   - Do not use GitHub secrets just to transfer local `.env.local`.

3. Use an encrypted archive only if a password manager is not available.
   - Create an encrypted zip/7z containing only `.env.local`.
   - Use a strong password.
   - Transfer the password through a different channel.
   - Delete the archive after importing on the new device.

4. Manual recreation.
   - Open provider dashboards.
   - Create fresh API keys.
   - Put them in `.env.local` on the Mac.
   - Revoke old keys if there is any doubt.

Recommended for Babel:

- use a password manager
- manually recreate `.env.local`
- rotate old provider keys if any key may have been exposed

## 17. Current Source Move / Parser Rename

The current branch appears to have moved parser code:

Old deleted path:

```text
server/geminiParser/
server/geminiParser.js
services/geminiService.ts
```

New path:

```text
server/babelParser/
server/babelParser.js
services/parseService.ts
```

This is likely intentional current source state.
Future agents should not restore `server/geminiParser` unless explicitly asked.

Before committing, run:

```bash
npm run build
```

If available and relevant, also run:

```bash
npm run verify:replay
npm run verify:parse-contract
```

## 18. Current Known Git Status Shape

Current branch:

```text
codex/babel-cross-platform...origin/codex/babel-cross-platform
```

Modified tracked files include:

- `.env.example`
- `.gitignore`
- `App.tsx`
- `README.md`
- `components/TreeVisualizer.tsx`
- `derivationReplayPlan.js`
- `docs/research/frontier-provider-wh-question-2026-05/index.md`
- `package.json`
- `server/parseApi.js`
- `types.ts`
- `visualRelationLinks.ts`

Deleted tracked files include the old `server/geminiParser` tree and `services/geminiService.ts`.

Untracked source/docs include:

- `docs/design/`
- `docs/checkpoints/`
- `scripts/`
- `server/babelParser.js`
- `server/babelParser/`
- `services/parseService.ts`

Untracked local artifacts include contact sheets:

- `contact-sheet-01.html`
- `contact-sheet-01.png`
- `contact-sheet-02.html`
- `contact-sheet-02.png`
- `contact-sheet-03.html`
- `contact-sheet-03.png`
- `contact-sheet-04.html`
- `contact-sheet-04.png`
- `contact-sheets.json`

Contact sheets should not be committed unless explicitly needed.

## 19. New Thread Launch Prompt

Use this prompt on a new device/thread:

```text
Read project context for Babel.
Work in /Users/francisronge/Documents/Babel/sylvan-architect-babel.
Checkout branch codex/babel-cross-platform.

Read these files first:
- docs/checkpoints/babel-full-thread-checkpoint-google-docs-2026-06-05.md
- docs/design/mac-new-device-pickup-2026-06-05.md
- docs/design/babel-visual-relations-research.md

Do not run provider/API parses without explicit approval.
Do not edit prompt/system-instruction files without exact proposed wording and approval.
Do not commit unless explicitly asked.

Preserve Babel's core rule: the derivational record is the source of truth, replay is bottom-up, visualRelations are grounded overlays, and the renderer must not invent syntax.

First task: inspect git status, run npm run build, then tell me exactly what is ready, what is dirty, and what should be tested next.
```

## 20. What To Do Next From This Checkpoint

Recommended sequence:

1. Commit and push current source/docs branch, excluding ignored artifacts and contact sheets.
2. Confirm GitHub contains:
   - `docs/design/babel-visual-relations-research.md`
   - `docs/design/mac-new-device-pickup-2026-06-05.md`
   - this checkpoint file
3. Create a small curated artifact zip if the user wants local render evidence on the Mac.
4. Transfer secrets through a password manager, not Git.
5. On Mac, clone/pull branch and run:

```bash
npm ci
npm run build
```

6. Open the app and verify current UI.
7. Continue Babel stabilization or visualRelations frontend design using the tracked research spec.

## 21. Emotional / Collaboration Context

This thread was intense because Babel is extremely important to the user.

The user’s core frustration was not only bugs. It was loss of trust when:

- renderer fixes appeared to overfit one tree
- new parses regressed
- broad filesystem searches hurt the PC
- wrong Phoenix artifacts were conflated
- explanations were too vague
- the model/renderer boundary was misclassified

Future agents must be precise:

- say what is renderer failure
- say what is model-output failure
- say what is prompt pressure
- say what is artifact/tooling failure
- do not hand-wave
- do not run broad searches
- do not make the PC do huge work unless necessary

When the user asks for a file or exact wording, give the file or exact wording.
When the user asks for a deep audit, actually inspect files and cite exact lines/behaviors.

## 22. The Current Checkpoint Goal

The current goal is not to solve every remaining Babel problem in this document.

The current goal is:

- make the current source state portable
- preserve the visualRelations research spec
- preserve the thread context
- make the next Mac/new-device pickup easy
- avoid losing local-only material
- avoid leaking secrets
- push safe source/docs to GitHub when verified

The clean end state is:

- source/docs committed and pushed
- local artifact transfer plan written
- `.env.local` intentionally not committed
- project context updated with this checkpoint
- Google Docs paste file available

