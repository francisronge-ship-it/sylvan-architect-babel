# Babel Local Artifact Transfer Manifest

Date: 2026-06-05

This file describes what ignored local artifacts are worth transferring to a new Mac/device.

Do not commit the artifact folders themselves.
Use this manifest to create a curated local zip only if those artifacts are needed.

## Current Local Artifact Folders

Observed on Windows:

```text
.codex-handoff: 0.5 MB
.local-docs: 0.1 MB
.local-tests: 2736.9 MB
test-results: 37678.9 MB
```

Total local artifacts are too large to move casually.
Do not zip all of `test-results` unless explicitly needed.

## Always Preserve Through Git

These have already been copied into tracked-safe paths:

```text
docs/design/babel-visual-relations-research.md
docs/design/mac-new-device-pickup-2026-06-05.md
docs/checkpoints/babel-full-thread-checkpoint-google-docs-2026-06-05.md
docs/checkpoints/babel-local-artifact-transfer-manifest-2026-06-05.md
```

## Good Local Zip Candidates

If creating a local transfer zip, include these small/high-value folders first:

```text
.codex-handoff/
.local-docs/
```

Then include selected render/test folders only if needed:

```text
.local-tests/provider-smoke-2026-05-23-fresh-cross-provider/
.local-tests/provider-smoke-2026-05-23-fresh-rumor-cp/
.local-tests/provider-effort-2026-06-03-gemini-low-mia-laughed-prompt-floor-removed/
.local-tests/provider-effort-2026-06-03-claude-low-mia-laughed/
.local-tests/provider-effort-2026-06-03-gpt-low-mia-laughed/
.local-tests/provider-scout-2026-05-29-gpt-one-high-pronunciation-anchor/
.local-tests/fresh-claude-parse-2026-05-19-contract-v1/
.local-tests/fresh-claude-parse-2026-05-20-stage-local-visibility-v2/
test-results/provider-route-audit-2026-05-12/
```

Include coursework artifacts only if the coursework comparison needs to continue:

```text
test-results/coursework-benchmark/
```

## Do Not Include

Do not include:

```text
node_modules/
dist/
.env.local
credentials
raw provider keys
browser caches
full test-results/ unless explicitly chosen
```

## Suggested Archive Name

```text
Babel-local-artifact-transfer-2026-06-05.zip
```

## Secret Handling

Secrets do not belong in this archive.

Preferred transfer:

1. password manager
2. recreate `.env.local` manually on the Mac
3. rotate keys if exposure is uncertain

Only use an encrypted archive for `.env.local` if there is no password-manager path.

