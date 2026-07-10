# Babel Harnesses

This folder contains a lot of historical sweep and capture scripts.

Current trusted harnesses:

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
- Direct Gemini harnesses should self-load `.env.local` and call `parseSentenceWithGemini`

Historical, stale, or one-off harnesses have been moved under `quarantine/legacy-harnesses/`.
