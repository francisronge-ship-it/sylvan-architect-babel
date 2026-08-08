---
title: Explicit Syntax Under Forced Commitment
description: "Mini Paper v1: A paired 20-case Babel benchmark of Gemini 3.1 Pro and Gemini 3.1 Flash Lite."
archived: true
---

> **Archived Codex-generated research note.** Codex generated this page during an earlier phase of Babel. It preserves old project history and helps show how Babel progressed and evolved over time, but it does not represent Babel today or my current work and standards as its developer. [Browse the research archive](/sylvan-architect-babel/research/archive/).

<div class="paper-hero">
  <p class="paper-kicker">Mini Paper v1</p>
  <h1 class="paper-title">Explicit Syntax Under Forced Commitment</h1>
  <p class="paper-subtitle">A paired 20-case Sylvan Architect Babel benchmark comparing Gemini 3.1 Pro and Gemini 3.1 Flash Lite across multilingual X-bar and Minimalist analyses.</p>
  <div class="paper-meta-grid">
    <div class="paper-meta-item">
      <span class="paper-meta-label">Date</span>
      <p>March 11, 2026</p>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Primary Report</span>
      <a href="../data/random20-v1-report.json">random20-v1-report.json</a>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Capture Script</span>
      <a href="../data/random20_dual_showcase.cjs">random20_dual_showcase.cjs</a>
    </div>
    <div class="paper-meta-item">
      <span class="paper-meta-label">Figure Assets</span>
      <a href="../assets/random20-v1/">random20-v1 asset folder</a>
    </div>
  </div>
</div>

## Abstract

This paper reports a small syntax benchmark run inside Sylvan Architect Babel. Babel does not evaluate models only through sentence preferences or minimal-pair judgments. It asks each model for one syntactic analysis: a tree, a movement history, a replayable derivation, and a prose explanation. Using a seeded paired batch collected on March 11, 2026, I compare Gemini 3.1 Pro and Gemini 3.1 Flash Lite on the same 10 multilingual sentence types, with 5 X-bar cases and 5 Minimalist cases per route.

Both routes returned usable trees, but they often exposed different analyses of the same sentence. Pro was much slower and more derivationally explicit, especially in Minimalist cases. Flash Lite was far faster and usually more conservative, often compressing a multi-step derivation into fewer visible commitments. The difference is clearest in Hungarian focus inversion, French embedding, and English long-distance wh-movement. Babel makes those choices inspectable instead of leaving them hidden behind a sentence score.

## 1. Introduction

Most established syntax benchmarks for language models ask whether a model prefers one sentence over another. Classic examples include targeted syntactic evaluation, minimal-pair acceptability tasks, and controlled suites such as [Marvin and Linzen 2018](https://aclanthology.org/D18-1151/), [BLiMP](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00321/96452/BLiMP-The-Benchmark-of-Linguistic-Minimal-Pairs), [SyntaxGym](https://aclanthology.org/2020.acl-demos.10/), and the multilingual extension [MultiBLiMP 1.0](https://arxiv.org/abs/2504.02768). These are powerful benchmarks, but they remain string-first. They tell us whether a model scores one sentence above another, not what structure the model would commit to if forced to explain its choice.

Babel evaluates a different object. Instead of only ranking strings, the model must produce:

1. one committed analysis rather than multiple alternatives;
2. an overt tree with visible category structure;
3. explicit movement events;
4. a replay sequence showing derivational growth;
5. Notes that describe the same analysis visible in the tree and replay.

This tests explicit syntactic commitment rather than latent preference. The question is not only "does the model know the dependency?" but also "what tree does it think licenses the dependency, how many movements does it encode, and can it tell the same story in prose?"

## 2. Materials and Methods

### 2.1 Batch design

The experiment used the seeded paired sweep in [random20_dual_showcase.cjs](../data/random20_dual_showcase.cjs). The script samples:

- 5 sentences from a multilingual X-bar pool;
- 5 sentences from a multilingual Minimalist pool;
- then runs the same 10 cases through both `pro` and `flash-lite`.

The fixed rerun used seed `1773234618245`. The resulting report is [random20-v1-report.json](../data/random20-v1-report.json).

### 2.2 Sentence set

The paired cases were:

| Framework | Language | Phenomenon | Sentence |
| --- | --- | --- | --- |
| X-bar | Romanian | passive | `A fost inchisa usa de vant.` |
| X-bar | English | relative clause | `The editor that Naomi interviewed laughed.` |
| X-bar | German | yes-no question | `Hat Maria den Brief gelesen?` |
| X-bar | Portuguese | wh-question | `Que pintura comprou Teresa?` |
| X-bar | French | embedded clause | `Marie a dit que Paul partirait.` |
| Minimalism | Japanese (romanized) | simple transitive | `Naoki-ga keeki-o tabeta.` |
| Minimalism | Romanian | wh-question | `Ce profesor a laudat Andrei?` |
| Minimalism | Hindi (romanized) | yes-no question | `Kya Anu ne chai banayi?` |
| Minimalism | Hungarian | focus inversion | `Melyik konyvet vette meg Anna?` |
| Minimalism | English | long-distance wh | `Which article do you think Clara said Mateo published?` |

The design is not exhaustive. It is intentionally mixed: some cases are clause-typing or inversion problems, some are head-movement problems, some are long-distance dependency problems, and some are control cases where the interesting outcome is restraint rather than movement.

### 2.3 Data collected

For each run, the script stores:

- the returned JSON analysis bundle;
- a Canopy screenshot;
- a final Growth replay screenshot;
- a Notes screenshot;
- elapsed time, derivation step count, movement event count, and route metadata.

In this paper I use three classes of evidence:

1. quantitative metadata from the report;
2. direct reading of the returned analysis JSON;
3. qualitative analysis of the captured screenshots.

### 2.4 Comparison strategy

The goal was not to decide which route produced the one true syntactic theory. Instead, the comparison asks:

- How much derivational structure does each route expose?
- How often do the routes choose the same kind of movement story?
- Where does one route compress structure that the other route makes explicit?
- Where does the model's prose track the visible derivation, and where does it lag behind it?

I therefore treat the batch as a study of explicit syntactic reasoning, not as an accuracy leaderboard.

## 3. Results

### 3.1 Batch-level outcome

The seeded rerun produced the full paired set: 10 analyses for Gemini 3.1 Pro and 10 for Gemini 3.1 Flash Lite.

### 3.2 Route-level summary

**Table 1. Overall route comparison**

| Route | Cases | Avg. elapsed time | Avg. derivation steps | Avg. movement events | Cases with movement | Avg. Notes length |
| --- | --- | --- | --- | --- | --- | --- |
| Gemini 3.1 Pro | 10 | 97.5 s | 28.7 | 2.6 | 8 | 82.3 words |
| Gemini 3.1 Flash Lite | 10 | 10.1 s | 18.8 | 0.7 | 6 | 62.9 words |

Three things stand out immediately.

First, Pro is dramatically slower. On this batch, it took about ten times as long on average. Second, the extra time is not wasted on verbosity alone; it shows up as longer derivations and more overt movement commitments. Third, the Notes gap is real but not enormous. The main difference between the routes is not just essay length. It is derivational density.

### 3.3 Framework split

**Table 2. Route-by-framework comparison**

| Route + framework | Avg. steps | Avg. movement events | Cases with movement | Avg. Notes length | Avg. elapsed time |
| --- | --- | --- | --- | --- | --- |
| Pro X-bar | 29.4 | 1.6 | 3/5 | 70.8 words | 79.1 s |
| Pro Minimalism | 28.0 | 3.6 | 5/5 | 93.8 words | 116.0 s |
| Flash Lite X-bar | 22.4 | 0.8 | 3/5 | 71.2 words | 10.3 s |
| Flash Lite Minimalism | 15.2 | 0.6 | 3/5 | 54.6 words | 9.9 s |

Pro's largest lead appears in Minimalism. It exposes much more of the derivation, while Flash Lite compresses Minimalist outputs aggressively. Pro is therefore more informative on this batch when the sentence invites cartography, successive cyclicity, or multiple head movements.

### 3.4 Pairwise divergence

Across the 10 paired sentence types:

- the routes agreed on whether movement was present in `6/10` pairs;
- they matched the exact number of movement events in only `2/10` pairs;
- Pro used more movement events in `7/10` pairs;
- Flash Lite used more movement events in `1/10` pair;
- the remaining `2/10` pairs tied.

The routes are not just two verbosity settings on the same analysis engine. They often choose different derivations of the same sentence.

## 4. Screenshot-Based Case Studies

This section treats the screenshots as primary evidence. The goal is not aesthetic commentary. It is to read the visible syntactic commitments as one would read figures in a linguistics paper.

### 4.1 Hungarian focus inversion

**Figure 1. Hungarian Minimalist growth comparison**

| Pro | Flash Lite |
| --- | --- |
| ![Pro Hungarian growth](../assets/random20-v1/pro-hu-growth.png) | ![Flash Lite Hungarian growth](../assets/random20-v1/flash-hu-growth.png) |

The Hungarian pair shows the largest theoretical split in the batch. In the Pro figure, the tree commits to a cartographic left periphery:

- `FocP` dominates the clause;
- `vette` is overtly realized as a `Foc` head;
- `meg` is stranded below in a `Prt/Pred` region;
- the lower copy of the head movement is visibly separated from the landing site;
- the wh-DP sits in the left periphery rather than merely at the top of a generic CP shell.

This is recognizably in the É. Kiss tradition: verb movement into focus, a stranded preverb, and an overt distinction between the landing head and the lower verbal region.

Flash Lite tells a much smaller story. Its growth figure flattens the configuration into `CP/TP`, retains the fronted wh-DP, and keeps `vette` in `T`, with no overt `FocP`, no stranded-particle architecture, and no cartographic middle field. The sentence is still interpreted, but the analysis is less theoretically ambitious.

**Figure 2. Hungarian Notes comparison**

| Pro | Flash Lite |
| --- | --- |
| ![Pro Hungarian notes](../assets/random20-v1/pro-hu-notes.png) | ![Flash Lite Hungarian notes](../assets/random20-v1/flash-hu-notes.png) |

The Notes confirm the visual difference. Pro invokes the Hungarian focus tradition and names V-to-Foc movement. Flash Lite describes a reduced `CP/TP` derivation.

### 4.2 Portuguese wh-question

**Figure 3. Portuguese X-bar growth comparison**

| Pro | Flash Lite |
| --- | --- |
| ![Pro Portuguese growth](../assets/random20-v1/pro-pt-growth.png) | ![Flash Lite Portuguese growth](../assets/random20-v1/flash-pt-growth.png) |

The Portuguese pair is useful because both routes largely agree on the macro-analysis. Both figures support:

- a fronted wh-DP;
- head movement of the finite verb;
- a postverbal subject.

The difference is in granularity. Pro records `4` movement events and visibly stages the derivation through multiple lower copies. Flash Lite records `2` movement events and presents a more economical version of the same general story.

A minimal-pair evaluation might show that both models recognize Portuguese wh-inversion. Babel also shows that one represents it as a fuller derivational chain and the other as a shorter structural path.

### 4.3 French embedded clause

**Figure 4. French X-bar growth comparison**

| Pro | Flash Lite |
| --- | --- |
| ![Pro French growth](../assets/random20-v1/pro-fr-growth.png) | ![Flash Lite French growth](../assets/random20-v1/flash-fr-growth.png) |

Here the routes choose different derivations.

Pro encodes:

- raising of the matrix subject;
- raising of the embedded subject;
- V-to-Infl head movement for `partirait`.

Flash Lite encodes none of these and instead offers a flatter CP plus InflP decomposition. Neither output is unusable, but they make sharply different commitments about the same sentence.

This is a particularly strong example of why Babel should not be reduced to a visualization tool. It is an instrument for comparing overt analyses. A conventional benchmark could show that both routes handle embedded clauses. Babel shows that they do not mean the same thing by "handle."

### 4.4 English long-distance wh

**Figure 5. English long-distance wh growth comparison**

| Pro | Flash Lite |
| --- | --- |
| ![Pro English long-distance growth](../assets/random20-v1/pro-en-longwh-growth.png) | ![Flash Lite English long-distance growth](../assets/random20-v1/flash-en-longwh-growth.png) |

This is the hardest sentence in the batch, and it gives the sharpest contrast.

Pro encodes:

- `7` movement events;
- `51` derivation steps;
- successive-cyclic movement of the wh-DP through intermediate clause edges;
- T-to-C movement for `do`;
- subject movements in the embedded clauses.

Flash Lite gives a far more compact representation with a single overt wh-movement event and a shorter derivation. The contrast is striking in the screenshot: Pro draws a visibly layered clause spine with multiple traces and landings, while Flash Lite collapses the long-distance dependency into a single overt dependency plus support from the surface tree.

This is Pro's most explicitly derivational analysis in the batch. Flash Lite captures the visible dependency, while Pro also makes the intermediate structure available for inspection.

### 4.5 Conservative cases matter too

Not every valuable result in a syntax benchmark is a complex movement derivation. Romanian passive and the English relative clause serve as useful control cases.

In Romanian passive, both routes chose comparatively restrained analyses. In the English relative clause, both routes converged on a recognizable relative dependency but differed in how much surrounding structure they elaborated. These cases show that Pro does not add complexity everywhere. The route differences are selective.

## 5. Discussion

### 5.1 Pro's pattern

On this batch, Gemini 3.1 Pro behaved like the better model for syntax research inside Babel.

Its distinctive properties were:

- more overt derivational structure;
- more movement events;
- more interesting Minimalist analyses;
- greater willingness to represent intermediate positions rather than only final configurations.

The Hungarian and long-distance English cases show the difference most clearly. Pro's outputs are not only larger; they expose more of the chosen syntactic analysis.

### 5.2 Flash Lite's pattern

Flash Lite followed a different pattern.

Its characteristic profile was:

- much lower latency;
- shorter derivations;
- fewer overt movement commitments;
- a tendency to compress complex dependencies into smaller visible analyses.

That makes Flash Lite attractive for product contexts where responsiveness matters and where a smaller, stable explicit structure may be preferable to a long derivational story. But it also means Lite is less informative when the goal is to study the model's preferred syntactic theory in detail.

### 5.3 Why explicit output helps

Babel makes several comparisons possible once the model has to return a tree and movement history:

- different theories of the same sentence become directly comparable;
- left-peripheral and clause-internal structure become visible rather than implicit;
- Notes can be evaluated against the actual derivation rather than treated as free commentary.

Babel does not replace BLiMP-style minimal-pair evaluation. It adds a way to test whether the model can sustain one visible syntactic analysis.

### 5.4 A reverse case

The German yes-no question prevents a simple "Pro is richer, so Pro is better" reading. Flash Lite chose overt V-to-C movement while Pro did not. Without expert adjudication against a gold treebank, this does not tell us that either route "won German." It tells us that the routes made different theoretical choices and that Babel exposed them.

## 6. Relation to the Broader Benchmark Landscape

The present batch sits in the same research neighborhood as targeted syntactic evaluation, BLiMP, SyntaxGym, and multilingual minimal-pair benchmarking, but it studies a different representational level.

Compared with those benchmarks, Babel adds:

1. **Tree commitment:** the model must expose its phrase structure;
2. **Derivational commitment:** the model must expose movement rather than imply it;
3. **Cross-modal alignment:** tree, replay, and prose can be inspected as parts of one analysis.

That allows evaluation of phenomena that traditional benchmarks usually leave implicit:

- how much intermediate structure a model posits;
- whether long-distance dependencies are compressed or staged cyclically;
- whether Notes rise to the level of the tree or collapse into shallow paraphrase;
- whether two models that both "know" a dependency actually choose the same analysis.

For syntax research on LLMs, those are useful additional observations.

## 7. Limitations

This is a mini paper, not a final benchmark paper.

Its limits are straightforward:

- only 10 paired sentence types;
- random sampling from curated phenomenon pools rather than a balanced corpus;
- no external gold-tree adjudication;
- theory-laden prompts that shape the hypothesis space;
- one platform-specific interface for visualization and replay.

The main substantive limitations are scale and adjudication rather than a single catastrophic failure mode inside this batch. A larger run will be needed before strong claims can be made about route-level preferences across language families.

## 8. Conclusion

This batch shows that Babel can benchmark explicit syntactic commitment as well as display trees.

On the paired March 11, 2026 rerun:

- Pro was slower but much more derivationally explicit;
- Flash Lite was faster and more conservative;
- the gap was strongest in Minimalist cases;
- several paired sentences revealed genuinely different syntactic analyses rather than mere stylistic paraphrases.

Requiring a tree, movement history, and prose analysis changes what can be compared. The output is no longer only a judgment about string preference; it is an overt syntactic analysis.

The next step is a larger gauntlet, ideally 100 paired trees, followed by an error taxonomy and a small expert-adjudicated subset. That would show whether the pattern reported here survives at a larger scale.

## Appendix A. Per-case movement summary

| Case | Pro movement events | Flash Lite movement events | Main contrast |
| --- | --- | --- | --- |
| Romanian passive | 0 | 0 | Both routes remain restrained. |
| English relative clause | 1 | 1 | Same core dependency, different level of elaboration. |
| German yes-no question | 0 | 1 | Lite chooses overt V-to-C where Pro stays flatter. |
| Portuguese wh-question | 4 | 2 | Same macro-analysis, different derivational granularity. |
| French embedded clause | 3 | 0 | Pro stages subject/head movement; Lite compresses. |
| Japanese simple transitive | 3 | 0 | Pro derives a richer clause spine; Lite keeps SOV simpler. |
| Romanian wh-question | 3 | 1 | Pro exposes auxiliary/participle structure more clearly. |
| Hindi yes-no question | 3 | 0 | Pro treats the clause as actively derivational; Lite does not. |
| Hungarian focus inversion | 2 | 1 | Pro gives the most theory-rich cartographic analysis in the batch. |
| English long-distance wh | 7 | 1 | Pro stages full cyclic dependency; Lite compresses to the visible top dependency. |

## References

- Marvin, Rebecca, and Tal Linzen. 2018. [Targeted Syntactic Evaluation of Language Models](https://aclanthology.org/D18-1151/).
- Warstadt, Alex, Amanpreet Singh, and Samuel R. Bowman. 2020. [BLiMP: The Benchmark of Linguistic Minimal Pairs](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00321/96452/BLiMP-The-Benchmark-of-Linguistic-Minimal-Pairs).
- Gauthier, Jon, et al. 2020. [SyntaxGym: An Online Platform for Targeted Evaluation of Language Models](https://aclanthology.org/2020.acl-demos.10/).
- Cianflone, Andrea, et al. 2025. [MultiBLiMP 1.0: A Massively Multilingual Benchmark of Linguistic Minimal Pairs](https://arxiv.org/abs/2504.02768).
- Local artifact. 2026. [Babel paired random20 report](../data/random20-v1-report.json).
