# Visual Relations Final-Stretch Research

Date: 2026-08-04

Scope: close the remaining source-dependent relation decisions before the separate fallback pass. This note does not change the parser contract or implement Lab cards.

## Decisions

| Fixture | Decision | Lab consequence |
| --- | --- | --- |
| F35 Fusion | Not a visual relation | Remove it from the card backlog. Replay shows the two model-authored `workspaceForest` states without an extra overlay. |
| F37 many-to-many correspondence | Approved | Add one node-anchored PF correspondence plate outside the tree. |
| F38 subtree lexicalization | Approved | Add one phrasal spell-out card anchored to a phrase shell. |
| F57 Ellipsis Licensing | Approved second context | Add VPE as the generalization context for the existing family. |
| F67 copy versus repetition | Existing primitive plus no-mark regression | Do not add a new relation card. Test that copy uses authored Identity/lineage while repetition stays unmarked. |

The F07/F09/F15 fallback work remains explicitly excluded from this pass.

## F35 Fusion

Sources inspected: Inkie Chung, *Suppletive Verbs in Korean and the Fusion Operation* (2009), figure 12; O. Kandybowicz, *On Fusion and Multiple Copy Spell-Out* (2007), figure 29; and Halle and Marantz, *Distributed Morphology and the Pieces of Inflection* (1993). Every usable figure treats Fusion as a structural PF operation that replaces two terminals with one terminal.

- [Chung source PDF](https://babel.ucsc.edu/~hank/mrg.readings/Chung_2009.pdf)
- [Kandybowicz source PDF](https://babel.ucsc.edu/~hank/Kandybowicz.pdf)
- [Halle and Marantz source PDF](https://babel.ucsc.edu/~hank/mrg.readings/Halle%2BMarantz1993.pdf)
- Local figure: `visual-relations-assets/source-recovery-2026-08-04/final-stretch/f35-fusion-structural-transition-source.png`

What the source draws: a before-and-after structure. Separate `Neg` and `V` terminals become one fused terminal carrying both feature sets.

Exact Babel behavior:

1. The pre-Fusion stage contains two distinct authored sister terminals.
2. The post-Fusion stage contains one authored fused terminal.
3. Replay displays those two authored `workspaceForest` states in order.
4. The renderer draws no cross-stage connector, because that would duplicate the authored structural change and invent a source convention that the papers do not use.

Conclusion: F35 belongs to derivational tree state, not to the visual-relation card inventory. Fusion is still distinct from suppletion: Fusion changes the number of terminals; suppletion realizes an already-single terminal with a different exponent.

## F37 Many-to-Many Correspondence

Source: Yifan Yang, *Quantified Exponence Constraints* (2018), figures 7a and 11. Figure 7a supplies the many-feature-to-many-exponent correspondence network. Figure 11 places the same information inside a compact lexical-representation box and carries it through exponent selection to the surface representation.

- [Yang source PDF](https://journals.linguisticsociety.org/proceedings/index.php/amphonology/article/download/4245/3870)
- Local figure: `visual-relations-assets/source-recovery-2026-08-04/final-stretch/f37-many-to-many-pf-plate-source.png`

What the source draws: a boxed PF mapping from a root and morphosyntactic feature bundle to several exponents, followed by exponent-chosen and surface representations. It is not a syntax tree, and Babel should not pretend that it is one.

Exact Babel transfer:

1. Keep the complete authored syntax tree unchanged.
2. Anchor one compact PF plate beside the authored terminal or word node whose realization is being inspected.
3. Put the authored root and feature bundle at the top of the plate and the authored exponents beneath them.
4. Draw thin, undirected correspondence lines only for the authored feature-exponent pairs, following the first box in figure 11.
5. Do not draw the whole LR-to-ER-to-SR pipeline unless the derivation separately authors those stages.
6. Do not route the correspondence network through the syntax tree or create syntax nodes.

If the derivation instead authors an ordered Fusion-then-Fission process, Replay must show two relation frames. Babel must not collapse staged operations into a guessed atomic many-to-many map.

## F38 Connected Subtree Lexicalization

Source: Pavel Caha and Marina Pantcheva, *Tools in Nanosyntax* (GLOW 37), slide "Phrasal Spell-Out." The source places `=> exponent` directly on phrase shells such as `DatP`, `PP`, and `NP`.

- [Caha and Pantcheva source PDF](https://glowlinguistics.org/37/pdf/caha-pantcheva-toolsho.pdf)
- Local figure: `visual-relations-assets/source-recovery-2026-08-04/final-stretch/f38-phrasal-spellout-source.png`

Exact Babel transfer:

1. Preserve the complete model-authored tree.
2. Anchor the relation to the lexicalized phrase shell, not to one leaf.
3. Draw the compact source-style `=> exponent` label immediately outside that shell.
4. Do not box the subtree, add a trajectory, or infer the exponent from the visible leaves.

This differs from terminal PF Realization because the realization target is a connected phrase/subtree.

## F57 Ellipsis Licensing: VPE Context

Source: Lobke Aelbrecht, *The Syntactic Licensing of Ellipsis* (2010), figure 40. The figure places an ellipsis feature on Voice, links it to T with a dotted right-angle connector with filled endpoints, and marks the vP ellipsis domain.

- [Aelbrecht source PDF](https://www.ling.uni-potsdam.de/~thiersch/Ellipse3/albrecht_book.pdf)
- Local figure: `visual-relations-assets/source-recovery-2026-08-04/final-stretch/f57-vpe-licensing-source.png`

Exact Babel transfer:

1. Keep the complete authored T-AspP-VoiceP-vP tree.
2. Draw the source's plain `[CAT[T]]` label beside T and plain `[E[INFL[uT]]]` label beside Voice; do not substitute Babel's generic rounded `[E]` plaque. These exact strings must come from authored relation values, or the relation must anchor existing authored feature terminals. The renderer never invents them.
3. Strike through the authored `valuedFeature` substring inside the Voice feature after checking, as figure 40 does. If the feature is already a terminal in the tree, use that rendered terminal rather than duplicating it.
4. Join the two feature labels with the source's low dotted right-angle connector and filled circular endpoints.
5. Mark the authored silent vP with the source's separate tall curved slash, horizontal arrow, and `ellipsis` label rather than treating the checking elbow itself as the deletion mark.

This is a second context for the existing Ellipsis Licensing family, not a new ontology entry.

## F67 Copy Versus Repetition

Sources: Noam Chomsky et al., *Merge and the Strong Minimalist Thesis* (2023), examples 23-25; and Matilde Marcolli, Noam Chomsky, and Robert C. Berwick, *Mathematical Structure of Syntactic Merge* (2024 draft), pp. 80-82. The latter supplies actual tree diagrams: externally merged isomorphic objects are repetitions, while Internal Merge establishes identity and cancels the lower copy.

- [Chomsky et al. source PDF](https://www.its.caltech.edu/~matilde/ChomskyMergeStrongMinimalistThesisElements2023.pdf)
- [Marcolli, Chomsky, and Berwick source PDF](https://www.its.caltech.edu/~matilde/MergeMCB-MITPress-LI.pdf)
- Local tree figure: `visual-relations-assets/source-recovery-2026-08-04/final-stretch/f67-copy-cancellation-source-tree.png`

The controlled contrast is:

- `Many people praised many people`: the identical inscriptions are separate repetitions.
- `Many people were praised`: the identical inscriptions are one copy class.

Exact Babel consequence:

1. Build two complete, legal authored trees containing identical visible strings.
2. On the copy case, reuse the existing Identity/lineage display and show movement only if movement is authored.
3. On the repetition case, keep distinct node and lineage identities and draw no relation mark.
4. Add a regression assertion that equal labels alone never dispatch Identity, Coreference, or movement.

The stronger tree source confirms that this is not a new visual primitive. It is a renderer-dispatch regression: authored identity gets the existing copy treatment; independently authored repeated text gets nothing.

## Implementation Order

1. F38 phrasal spell-out.
2. F57 VPE second context.
3. F37 many-to-many PF plate.
4. F67 no-guess regression assertion, without a new relation card.

F35 is removed from the visual-relation implementation queue. Only after the approved cards and the no-guess regression are implemented and audited should the separate fallback design resume.
