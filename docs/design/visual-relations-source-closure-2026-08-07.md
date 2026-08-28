# Visual Relations Source Closure

Date: 2026-08-07
Status: local-only research ruling. Do not commit.

This closes the three source questions left after the Fable linguistic audit.
These are renderer/fixture rulings, not additions to the authored parse contract.

## Roll-up movement copy depth

Primary source: Ur Shlonsky (2004), *The form of Semitic noun phrases*,
Figure 39 and pp. 1482-1483.

- Paper: <https://faculty.georgetown.edu/rtk8/Shlonsky%202004%20form%20of%20Semitic%20noun%20phrases%20Lingua.pdf>
- Cached figure: `visual-relations-assets/source-recovery-2026-08-06/fable-audit/shlonsky-2004-roll-up-figure39.png`

Shlonsky explicitly describes the derivation as consecutive applications of
phrasal movement. The complement targeted at each step pied-pipes the material
acquired on the preceding step: the snowball grows as it moves. Figure 39
draws the movement paths and deliberately leaves lower copies implicit.

Copy-theory support: DelBusso's dissertation states that, in successive
roll-up movement, a lower copy of the moved projection remains and that the
moved XP and its trace have the same projection status.

- Dissertation: <https://ling.rutgers.edu/images/dissertations/DelbussoDissertation.pdf>

**Babel ruling:** every vacated roll-up position is a complete, headed silent
copy of the phrase moved at that step. Do not replace an XP with a bare trace
leaf. Preserve the head/complement structure carried by that phrase, but do not
invent a landing position or relation that the derivation never used. Each
successive roll-up operation is its own Replay relation frame; earlier movement
paths persist into the final frame.

The repaired Lab card follows this ruling: NP, then the containing AP, then the
larger AP move in order, and their lower witnesses remain headed phrases.

## Lexical Pair Merge

Primary source: Ginsburg (2024), *Constraining Free Merge*, Figure 4.

- Paper: <https://bioling.psychopen.eu/index.php/bioling/article/download/14015/14015.pdf>
- Cached figure: `visual-relations-assets/source-recovery-2026-07-30/labeling-pair-merge-structural-metadata/pair-merge-ginsburg-figure4.png`

The source says that D is Pair-Merged with NP, that the NP host remains the
projecting category, and that the relation is shown by a dotted, unheaded arc.
The D member does not project a DP.

**Babel ruling:** the complete authored example may use an NP mother so the
single-tree contract remains satisfied, but it must not introduce a DP mother
for the pair. Babel transfers the source's dotted, unheaded pairing mark onto
the complete native fork: both branches from the shared NP mother to D and the
NP host are highlighted. This distinguishes Pair Merge from a Phase domain cap
and reuses the same branch-overlay primitive that blocked extraction applies to
one adjunct branch. The lexical and phrasal cases remain one Pair Merge design.

The current Lab fixture already uses an NP mother and therefore satisfies the
best contract-preserving transfer of the source convention.

## Binding failure

Primary source family: Hagstrom, CAS LX 522 *Syntax I*, Principle A and binding
domain slides; c-command geometry from *The Science of Syntax*.

- Hagstrom deck: <https://ling-blogs.bu.edu/lx522f12/files/2012/09/lx522f12-08-ccmd.pdf>
- Cached deck plate: `visual-relations-assets/source-recovery-2026-08-06/fable-audit/hagstrom-2012-principle-a-binding-domains.png`
- C-command source: <https://opentext.ku.edu/syntax/chapter/binding-theory/>
- Cached c-command plate: `visual-relations-assets/binding-c-command.png`

The binding source supports coindices, a failed configuration, and domain
marking. The c-command source shows the relevant geometry: a constituent
c-commands its sister and everything dominated by that sister. Neither source
licenses a novel obstruction glyph or a movement path.

**Babel ruling:** use the same coindex and c-commanded-region primitive as the
licensed Binding card. For the possessive-subject failure, the intended binder's
c-commanded sister remains inside the subject DP while the anaphor is outside
that region. The authored relation records `values.outcome: "failed"`. Do not
invent an obstruction shape, infer a different relation, or draw movement.

The repaired Lab card follows this ruling. Binding failure is a sourced
composition of existing marks, not a missing standalone primitive.
