---
title: From Tree-First to Derivation-First
description: "Research Journal v1: why Babel was refactored, what the new architecture changed, and why smaller models now fall short of full Babel."
permalink: /research/from-tree-first-to-derivation-first/
archived: true
---

> **Archived Codex-generated research note.** Codex generated this page during an earlier phase of Babel. It preserves old project history and helps show how Babel progressed and evolved over time, but it does not represent Babel today or my current work and standards as its developer. [Browse the research archive](/sylvan-architect-babel/research/archive/).

<div class="paper-hero">
  <p class="paper-kicker">Research Journal v1</p>
  <h1 class="paper-title">From Tree-First to Derivation-First</h1>
  <p class="paper-subtitle">Why Babel had to be refactored, what the new architecture made possible, and why smaller models now fail the stronger standard.</p>
  <div class="paper-meta-grid">
    <div class="paper-meta-item">
      <span class="paper-meta-label">Date</span>
      <p>April 10, 2026</p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Status</span>
      <p>Published note. Ongoing work continues on the refactor and cost side.</p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Primary Case</span>
      <p>Portuguese wh-question: <em>Que pintura comprou Teresa?</em></p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Figure Assets</span>
      <a href="../assets/derivation-first-refactor-v1/">derivation-first-refactor-v1 asset folder</a>
    </div>
  </div>
</div>

## Abstract

I refactored Babel because the old tree-first architecture had become hard to justify. It could still produce impressive trees, but the derivation was not carrying enough of the syntactic burden. Growth could feel decorative, and Replay could trace over a structure that had already been decided elsewhere. Babel could animate a finished canopy, but it could not cleanly show a tree being base-generated and reaching surface order through a meaningful derivation. For a system built to externalize syntax, that was a serious limitation.

The refactor made Growth frames the structural source of truth, with Replay, Canopy, and Notes anchored to the same committed sequence. Babel became stronger and heavier at the same time. Smaller routes that survived the old tree-first harness now compress, distort, or fail under the new standard. Flash Lite no longer feels like full Babel at a smaller scale, and local or free models have struggled even more. Qwen 3.5 397B A17B completed the full Pro route and returned valid JSON, but its final tree violated binary branching, placed a bare trace directly under `InflP`, and leaked chain ids into human-facing notes. Full Babel was becoming a research instrument before it became a cheap public product.

The refactor is not finished. I still want to make Babel faster and cheaper without weakening it. I have not yet run full Gemini 3.1 Pro stress suites on the new architecture because those runs started to cost serious money. Provider reasoning trace, the growing ledger layer, longer prompts, and richer structured output are all likely contributing to that weight. I will keep testing. A split between a lighter student version and a stronger research version may be the most practical direction.

## 1. Why the Refactor Was Necessary

The old problem was simple enough once it became visible.

- Tree-first Babel treated the final tree as the main object.
- Growth was downstream.
- Replay could show movement inside a tree that was already structurally settled.
- That made the derivation look more meaningful than it really was.
- It also meant Babel did not have a clean way to show base generation first and surface order later, because Growth was being inferred from the finished canopy tree instead of being the source of truth itself.

This was an architectural problem, not only a UI problem. Once the tree becomes primary, the derivation starts to read like commentary on the tree rather than the syntax itself. Babel is supposed to force the model to commit both to the structure and to how it comes into existence.

The refactor changed that order of commitment.

- Growth frames became the main structural object.
- Canopy is now derived from committed growth.
- Replay is now driven by committed growth snapshots instead of inferred final-tree state.
- Notes are expected to describe the same committed derivation rather than floating free as prose.

That was the reason for the refactor. It was a correction of what Babel measures, not a visual cleanup.

## 2. What Changed in Practice

The easiest way to see the difference is a single clean Portuguese case.

**Figure 1. Clean Portuguese growth under the refactored architecture**

![Refactored Portuguese growth replay](../assets/derivation-first-refactor-v1/pro-pt-growth.gif)

The improved replay is secondary. The real change is that Replay now has to respect the derivation as a structural sequence.

- lexical selection happens before projection
- movement is tracked as movement
- replay steps are tied to committed growth states
- the final tree is no longer allowed to silently override the derivation

The old tree-first architecture could not show this honestly enough. Replay is now following the committed derivation instead of acting out a structure decided elsewhere.

**Figure 2. Final replay state after a real bottom-up derivation**

![Refactored Portuguese final replay state](../assets/derivation-first-refactor-v1/pro-pt-replay-final.png)

The same case now also yields a clean canopy and a notes view that belong to the same parse rather than orbiting around it loosely.

**Figure 3. Clean Portuguese canopy and notes**

| Canopy | Notes |
| --- | --- |
| ![Refactored Portuguese canopy](../assets/derivation-first-refactor-v1/pro-pt-canopy.png) | ![Refactored Portuguese notes](../assets/derivation-first-refactor-v1/pro-pt-notes.png) |

Canopy, Replay, and Notes now express one committed syntax object instead of orbiting a tree decided in advance.

## 3. What the Refactor Exposed

The refactor improved Babel, but it also raised the burden on the model quite sharply.

A smaller route or weaker model now has to do all of the following at once:

- return strict JSON with no wrapper text
- commit to one usable structure
- preserve derivational detail across growth frames
- keep movement explicit
- keep notes human-readable
- keep the final tree structurally disciplined

### 3.1 Flash Lite no longer feels like full Babel

Flash Lite still matters. It remains useful as a comparison route. But under the stronger derivation-first architecture, it no longer feels like the same system at a smaller scale. It feels more like a compressed route with a different ceiling.

**Figure 4. Portuguese growth comparison: Gemini Pro versus Flash Lite**

| Gemini 3.1 Pro | Gemini 3.1 Flash Lite |
| --- | --- |
| ![Refactored Portuguese growth replay](../assets/derivation-first-refactor-v1/pro-pt-growth.gif) | ![Flash Lite Portuguese growth](../assets/derivation-first-refactor-v1/flash-pt-growth.png) |

Flash Lite does not always crash; it tends to compress overt derivation. The old tree-first harness could hide that weakness, while the derivation-first harness makes it visible immediately.

### 3.2 Local and free models failed more directly

The local and free-model testing so far has been harsher.

- `gemma3:4b` answered, but the full Babel parse failed structural normalization.
- `qwen3:8b` was too slow on this machine for true Babel Pro.
- `moonshotai/kimi-k2.5` on free NVIDIA completed probes, but true Babel Pro either burned the budget in reasoning or timed out at the provider layer.
- `qwen/qwen3.5-397b-a17b` was the first non-Gemini provider to complete true Babel Pro cleanly enough for strict parsing, but it still failed the syntax benchmark.

Qwen is the most informative case because it draws a clear line between transport success and syntactic adequacy.

## 4. Qwen as a Stress Test

Qwen 3.5 397B A17B is the first non-Gemini route in this testing phase that cleared the full Pro transport path.

It succeeded on:

- strict JSON output
- one committed analysis object
- normalization
- full artifact rendering

Its Portuguese run also gives a concrete cost number for the current weight of Babel:

- first pass: `13,211` tokens
- notes pass: `5,199` tokens
- full parse total: `18,410` tokens

This is not a toy parse. It is the footprint of a heavy research instrument.

Even so, Qwen still failed the actual syntax standard.

**Figure 5. Qwen Portuguese canopy and growth**

| Canopy | Growth |
| --- | --- |
| ![Qwen Portuguese canopy](../assets/derivation-first-refactor-v1/qwen-pt-canopy.png) | ![Qwen Portuguese growth](../assets/derivation-first-refactor-v1/qwen-pt-growth.png) |

The failures were not renderer bugs. They were in the saved analysis itself.

- final `CP` had three children instead of binary branching
- final `InflP` had three children instead of binary branching
- a bare `t` appeared directly under `InflP`

So Qwen did not commit to the same X-bar analysis as Gemini. It returned something parseable, but not something benchmark-equivalent.

The notes were weaker too.

**Figure 6. Qwen notes**

![Qwen Portuguese notes](../assets/derivation-first-refactor-v1/qwen-pt-notes.png)

The notes leaked internal chain names such as `chain_wh` and `chain_subj` into human-facing prose. That is not the kind of prose Babel should present as finished notes. It shows the model still struggling to keep internal bookkeeping separate from the final explanatory layer.

So the Qwen result is mixed:

- It is a real success for Babel as a strict, provider-agnostic parser contract.
- It is a real failure for Qwen as a benchmark-quality Babel syntax model.

## 5. What This Means

The refactor improved Babel, but it did not finish the job.

The renderer problems were fixed, the parser was cleaned up, and the architecture now makes more syntactic sense than the old tree-first design. Full Babel also became expensive because it now asks much more of the model.

The model has to:

- commit to one explicit syntactic theory
- maintain a meaningful derivation
- preserve structural discipline
- narrate that same analysis coherently

This is part of why smaller models fall behind first.

No smaller or cheaper route tested so far has matched full Babel.

- Flash Lite still returns interesting structure, but it compresses the derivation too aggressively to stand in for the full system.
- Local models tested so far have failed either on speed, structural validity, or syntax quality.
- The strongest non-Gemini model tested so far completed the transport path but still failed the syntax benchmark.

Right now, full Babel may not be the right free public product.

There is an important limit on this evidence: I have not yet re-run large Gemini 3.1 Pro stress suites on the new architecture. Once Babel became derivation-first and started carrying richer structure, repeated benchmark runs became too expensive to treat as casual tests.

The extra weight comes from several places:

- Growth-first structure makes the syntax object itself larger.
- Provider reasoning trace adds more model-authored material.
- The ledger layer adds more explicit commitments.
- The notes layer still has to stay aligned with the same syntax object.

Those features are not necessarily mistakes. They are part of what made full Babel stronger and more expensive at the same time.

## 6. Next Direction

I will keep testing. The remaining engineering problem is efficiency: making Babel faster and cheaper without weakening it or slipping back into a tree-first architecture.

The most plausible next direction now looks like a split.

- **Student Babel**: lighter, cheaper, still explicit, but less derivationally extreme.
- **Research Babel**: the stronger full system, kept for serious syntax work and stronger models.

This split would preserve what the refactor achieved instead of forcing Babel backward.

The goal would be to protect the stronger version by admitting that it may now be a research instrument first, not to make Babel weaker everywhere.

## Conclusion

I still think the refactor was necessary. Tree-first Babel could produce impressive trees, but its derivation did not carry enough of the syntax to deserve being called the source of truth.

Derivation-first Babel is better and much heavier. That is the cost of asking for explicit syntactic commitment.

The current evidence points in a clear direction:

- the stronger architecture is worth keeping
- smaller models now fall below the standard more visibly
- a lighter student version may be necessary
- the stronger version should remain the real Babel

I do not see that as a defeat. It is a clearer picture of what Babel has turned into.
