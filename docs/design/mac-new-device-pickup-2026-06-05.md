# Babel Mac / New Device Pickup

Date: 2026-06-05

This file exists so Babel can be resumed on a Mac or new machine without relying on this Windows-only thread state.

## Source Of Truth

- Repository: `https://github.com/francisronge/sylvan-architect-babel.git`
- Current Windows branch: `codex/babel-cross-platform`
- Current Windows root: `C:\Users\franc\Codex Imported Workspaces Full\Babel\sylvan-architect-babel`
- Expected Mac root: `/Users/francisronge/Documents/Babel/sylvan-architect-babel`

Before changing devices, commit and push the intended source changes from `codex/babel-cross-platform`.

Do not rely on ignored local folders to survive a device switch.

## Important Tracked Design File

The visual-relations research spec must travel with the repo:

- `docs/design/babel-visual-relations-research.md`

That file was copied from the ignored local source:

- `.local-docs/babel-visual-relations-research.md`

The ignored `.local-docs` copy is useful locally, but GitHub will not carry it.

## Mac Setup

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

If the repo already exists on the Mac:

```bash
cd /Users/francisronge/Documents/Babel/sylvan-architect-babel
git fetch origin
git checkout codex/babel-cross-platform
git pull --ff-only origin codex/babel-cross-platform
npm ci
npm run build
```

Run the local app:

```bash
npm run dev
```

Run the server when parse routes are needed:

```bash
npm start
```

## What Not To Commit

Do not commit:

- `.env.local`
- credentials
- `node_modules`
- `dist`
- build output
- coverage
- logs
- `.local-tests`
- `test-results`
- `.local-docs`
- `.codex-handoff`
- generated contact sheets unless explicitly needed for a report

## Current Babel Rules To Preserve

- The derivational record is the source of truth.
- Replay must be bottom-up.
- Renderer must not invent syntax.
- `visualRelations` are overlays grounded in `stageRecord` and `workspaceForest`.
- Canopy is the final replay tree without arrows or relation overlays.
- Prompt/provider/API runs require explicit user approval.
- Do not add retries or fallbacks as a provider solution.
- Do not touch prompt/system-instruction files without exact proposed wording and approval.

## Files To Read First In A New Thread

Read these in order:

1. `C:\Users\franc\.codex\project-context\projects\babel\handoff.md` on Windows, or the synced project-context equivalent on Mac.
2. `docs/design/mac-new-device-pickup-2026-06-05.md`
3. `docs/design/babel-visual-relations-research.md`
4. `server/babelParser/systemInstruction.js`
5. `server/babelParser/prompts.js`
6. `components/TreeVisualizer.tsx`
7. `derivationReplayPlan.js`
8. `visualRelationLinks.ts`

On Mac, replace the Windows project-context path with the current local project-context path if needed.

## New Thread Launch Prompt

Paste this into a new Codex thread:

```text
Read project context for Babel.
Work in /Users/francisronge/Documents/Babel/sylvan-architect-babel.
Checkout branch codex/babel-cross-platform.
Read docs/design/mac-new-device-pickup-2026-06-05.md.
Read docs/design/babel-visual-relations-research.md.

Do not run provider/API parses without explicit approval.
Do not edit prompt/system-instruction files without exact proposed wording and approval.
Do not commit unless explicitly asked.

Preserve Babel's core rule: the derivational record is the source of truth, replay is bottom-up, visualRelations are grounded overlays, and the renderer must not invent syntax.
```

## Quick Verification After Pickup

```bash
git status --short --branch
npm run build
```

If the dev server is needed:

```bash
npm run dev
```

