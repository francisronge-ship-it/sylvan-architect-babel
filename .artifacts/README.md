# Babel Harnesses

This folder contains a lot of historical sweep and capture scripts.

Current trusted harnesses:

- `provider_effort_local_test.cjs`
  Current provider-effort research harness. Runs one direct call each for Gemini, GPT, and Claude by default; saves provider JSON output, normalized bundle, render capture, replay GIF, Canopy/Notes screenshots, token usage, timing, and estimated cost under `.local-tests/`.
- `gemini_novel5_sweep.cjs`
  Quick Gemini API warm-up through the local app on `http://127.0.0.1:5177`.
- `capture_flavor_mixed10.cjs`
  UI warm-up covering Canopy, Derivation Replay, and Notes on the local app.
- `direct_consistency_world_sweep.cjs`
  Broader direct consistency sweep using the current Babel parser; now self-loads local env.
- `api_consistency_multilang.cjs`
  API-based visual-relation/stage-record consistency smoke through the local app.
- `random20_dual_showcase.cjs`
  Paired Gemini vs GPT showcase capture on the local app.
- `live_consistency_gauntlet.cjs`
  Direct Gemini gauntlet helper; self-loads local env.
- `direct_consistency_gauntlet.cjs`
  Focused direct gauntlet helper; now self-loads local env.
- `novel_gauntlet_20.cjs`
  Direct 20-case gauntlet helper; now self-loads local env.

Current topology:

- Live UI/API harnesses should default to `http://127.0.0.1:5177`
- Direct Gemini harnesses should self-load `.env.local` or `.env` before importing the current parser
- Browser harnesses require Playwright. Set `BABEL_CHROME_BIN` only when using a specific local Chrome/Chromium executable.
- Provider-effort research should use the small one-call-per-provider harness, not a broad gauntlet.

Historical, stale, costly, or one-off harnesses live outside the current harness surface. The old 100-tree dual-route gauntlet is historical evidence for published research, not a current runnable default; its local-only working copy belongs under `.local-tests/legacy-harnesses/`.
