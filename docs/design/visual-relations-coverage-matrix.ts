/**
 * Authoritative reconciliation of Sol's atomic fixture ledger, Fable's later
 * additive fixtures, and the live Visual Relations Lab.
 *
 * This is intentionally fixture-first. Relation names are open, cards are
 * examples, and renderer designs are reusable; none of those is a reliable
 * proxy for whether a specific adversarial topology has actually been tested.
 */

export type FixtureCoverageStatus =
  | 'covered'
  | 'partial'
  | 'fallback'
  | 'missing'
  | 'excluded';

export type FixtureCoverageTrack =
  | 'baseline-direct'
  | 'baseline-replay'
  | 'lab-ce2'
  | 'excluded'
  | 'fable-additive';

export type FixtureResearchNeed = 'none' | 'source-validation' | 'new-source';

export interface VisualRelationFixtureCoverage {
  id: string;
  grammar: string;
  topology: string;
  track: FixtureCoverageTrack;
  status: FixtureCoverageStatus;
  cardTitles: readonly string[];
  basis: string;
  researchNeed: FixtureResearchNeed;
  nextAction?: string;
}

const fixture = (
  entry: VisualRelationFixtureCoverage
): VisualRelationFixtureCoverage => entry;

export const VISUAL_RELATIONS_FIXTURE_COVERAGE: readonly VisualRelationFixtureCoverage[] = [
  fixture({
    id: 'F01', grammar: 'G01', topology: 'Same-root binary source-to-landing trajectory',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Phrasal Movement', 'Head Movement', 'Lowering', 'Lowering (embedded clause)'],
    basis: 'The Lab proves phrase-sized, head-sized, and downward trajectories with exact endpoint dispatch.'
  }),
  fixture({
    id: 'F02', grammar: 'G02', topology: 'Ordered four-occurrence chain',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Identity / Copy Chain (four occurrences)'],
    basis: 'The card derives four ordered positions from three successive-cyclic A-bar steps and retains every link in the final frame.'
  }),
  fixture({
    id: 'F03', grammar: 'G02+G08', topology: 'Two ordered paths sharing an occurrence with containment',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Identity / Copy Chain'],
    basis: 'The two A-bar steps share the intermediate CP-edge occurrence and retain their order.'
  }),
  fixture({
    id: 'F04', grammar: 'G03', topology: 'One origin to multiple gaps',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Parasitic Gap', 'Parasitic Gap (two adjunct gaps)'],
    basis: 'One pronounced filler is related to the ordinary gap and one or more parasitic positions.'
  }),
  fixture({
    id: 'F05', grammar: 'G03', topology: 'Multiple origins to one landing',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Across-the-Board Movement', 'Across-the-Board Movement (three conjuncts)'],
    basis: 'Two- and three-conjunct cards converge distinct lower copies on one pronounced landing.'
  }),
  fixture({
    id: 'F06', grammar: 'G04', topology: 'Relation endpoints under distinct workspace roots',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Sideward Movement', 'Sideward Movement (parasitic-gap derivation)'],
    basis: 'Replay begins with separate roots, then preserves the relation after external merger into one final tree.'
  }),
  fixture({
    id: 'F07', grammar: 'G05', topology: 'Novel open relation with arbitrary binary roles',
    track: 'baseline-direct', status: 'fallback', researchNeed: 'none', cardTitles: [],
    basis: 'Production implements the accepted topology-only fallback: an unregistered binary relation '
      + 'draws participation marks and the thin undirected two-scalar link, persisting from-stage-onward '
      + '(making an unknown authored claim disappear would itself invent semantics), with no names, '
      + 'ids, or values on the canvas. Verified by the fallback tests in tests/visualRelationRenderPlan.test.mjs '
      + 'and the neutral-mark regressions in tests/visualRelationFollowupRepair.test.mjs; no Lab card is appropriate.'
  }),
  fixture({
    id: 'F08', grammar: 'G05', topology: 'Three role-distinct node anchors',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Theta Roles / Argument Grid'],
    basis: 'Predicate, Agent, Theme, and Goal are preserved as distinct authored roles.'
  }),
  fixture({
    id: 'F09', grammar: 'G05', topology: 'Two sources by three targets hyperedge',
    track: 'baseline-direct', status: 'fallback', researchNeed: 'none', cardTitles: [],
    basis: 'Production renders an unregistered 2-by-3 relation as fallback participation marks only — '
      + 'ordered position marks per role array, with NO invented 2-by-3 hyperedge, connector network, or '
      + 'pairing frames (the circle/box pairing is licensed only for two equal-length arrays). Verified by '
      + 'the multi-array fallback tests in tests/visualRelationRenderPlan.test.mjs; no Lab card is appropriate.'
  }),
  fixture({
    id: 'F10', grammar: 'G06', topology: 'Probe, candidate goals, winner, and residue',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Intervention / Relativized Minimality', 'Intervention / Superiority'],
    basis: 'The licensed candidate and separately blocked candidate are shown against the closer intervener.'
  }),
  fixture({
    id: 'F11', grammar: 'G07', topology: 'Attempted path terminating at a blocker',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Intervention / Relativized Minimality', 'Blocked Extraction Diagnostic (temporal adjunct)'],
    basis: 'Both cards preserve an authored attempted dependency and mark its structural blocker.'
  }),
  fixture({
    id: 'F12', grammar: 'G08', topology: 'Path endpoints interacting with a constituent region',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Post-Transfer Access Failure', 'Improper Movement (CP origin)'],
    basis: 'The attempted path is computed against an authored inaccessible or forbidden region.'
  }),
  fixture({
    id: 'F13', grammar: 'G08', topology: 'Two paths crossing or nesting',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Roll-up Movement', 'Remnant Movement'],
    basis: 'Accumulated movement paths preserve their ordering and containment relationships.'
  }),
  fixture({
    id: 'F14', grammar: 'G09', topology: 'Three lineage-related occurrences with pronunciation states',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Identity / Copy Chain'],
    basis: 'The final, intermediate, and base occurrences share lineage while only one is pronounced.'
  }),
  fixture({
    id: 'F15', grammar: 'G10', topology: 'Equality, conflict, subset, and overlap reference styles',
    track: 'baseline-direct', status: 'fallback', researchNeed: 'none',
    cardTitles: ['Plain Coreference', 'Plain Coreference (across coordination)'],
    basis: 'Equality stays specialized through the named coreference cards. The unsupported set-algebra '
      + 'styles (conflict, subset, overlap) have no approved specialized marks and route through the '
      + 'production neutral fallback rather than invented specialized marks — unregistered names draw '
      + 'topology-only participation, verified by the fallback tests in tests/visualRelationRenderPlan.test.mjs.'
  }),
  fixture({
    id: 'F16', grammar: 'G05+G10', topology: 'Two antecedents summed into one dependent',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Split Antecedence'],
    basis: 'The sourced card preserves the dependent-to-antecedent direction with one hollow dependent origin and one directed terminal link to each antecedent.'
  }),
  fixture({
    id: 'F17', grammar: 'G11', topology: 'Per-anchor feature, value, and state rows',
    track: 'lab-ce2', status: 'covered', researchNeed: 'none',
    cardTitles: ['Agree / Feature Valuation', 'Agree / Expletive Associate', 'Case Assignment / Feature Collection'],
    basis: 'FeatureBundle and Case cards derive participant-specific plaque rows from authored values.'
  }),
  fixture({
    id: 'F18', grammar: 'G12', topology: 'Sources, context, target, and ordered rewrite rows',
    track: 'lab-ce2', status: 'covered', researchNeed: 'none',
    cardTitles: ['PF Realization', 'Local Dislocation / String-Vacuous Rebracketing', 'Cyclic Linearization / Order Conflict'],
    basis: 'The PF plates and order lanes preserve authored inputs, contexts, outputs, and stage order.'
  }),
  fixture({
    id: 'F19', grammar: 'G13', topology: 'Predicate with Agent, Theme, and Goal anchors',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Theta Roles / Argument Grid'],
    basis: 'The ditransitive theta card has all three role-named arguments.'
  }),
  fixture({
    id: 'F20', grammar: 'G14', topology: 'Unary node mark',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Focus Marking (subject focus)', 'Impoverishment'],
    basis: 'The Lab can mark one selected node or one selected feature link without changing tree structure.'
  }),
  fixture({
    id: 'F21', grammar: 'G14+G15', topology: 'Subtree state propagated to descendants',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Transfer / Spell-Out Domain', 'Ellipsis / Silent Structure'],
    basis: 'Transfer and ellipsis derive state over the complete anchored subtree.'
  }),
  fixture({
    id: 'F22', grammar: 'G15', topology: 'One constituent-defined region',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Phase Boundary', 'Transfer / Spell-Out Domain'],
    basis: 'Both region geometries derive from one authored constituent.'
  }),
  fixture({
    id: 'F23', grammar: 'G15', topology: 'Nested and disjoint regions',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Multiple Phase Boundaries', 'Phase Boundaries (nested and disjoint)'],
    basis: 'The stress card renders a vP nested in one CP and a separate disjoint CP using three independent Phase relations.'
  }),
  fixture({
    id: 'F24', grammar: 'G15', topology: 'Connected nonconstituent node set with detached control',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Idiom-Chunk Cointerpretation (object idiom)', 'Idiom-Chunk Cointerpretation (subject idiom)'],
    basis: 'The idiom cards select discontinuous chunk anchors while keeping the interpretation domain separate.'
  }),
  fixture({
    id: 'F25', grammar: 'G16', topology: 'Domain with accessible edge',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Phase Boundary'],
    basis: 'The phase arc and edge witness are independently authored and rendered.'
  }),
  fixture({
    id: 'F26', grammar: 'G07+G16', topology: 'Boundary array plus attempted path',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Bounding-Node Crossing (wh-island)', 'Bounding-Node Crossing (complex NP)', 'Post-Transfer Access Failure'],
    basis: 'The Lab handles multiple authored boundaries and one attempted dependency without category guessing.'
  }),
  fixture({
    id: 'F27', grammar: 'G16', topology: 'Syntax subtree projected to a contiguous yield span',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Idiom-Chunk Cointerpretation (object idiom)', 'Idiom-Chunk Cointerpretation (subject idiom)'],
    basis: 'The idiom interpretation bracket derives its span from the complete authored domain subtree.'
  }),
  fixture({
    id: 'F28', grammar: 'G17', topology: 'Asymmetric host and member pair',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Pair Merge (phrasal adjunct)', 'Pair Merge (lexical member)'],
    basis: 'The member-to-host arc is explicitly asymmetric while remaining an overlay.'
  }),
  fixture({
    id: 'F29', grammar: 'G17', topology: 'Host plus discontinuous member enclosure or brace',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Idiom-Chunk Cointerpretation (object idiom)', 'Idiom-Chunk Cointerpretation (subject idiom)'],
    basis: 'Underlined members and the separate interpretation bracket preserve discontinuous membership and domain.'
  }),
  fixture({
    id: 'F30', grammar: 'G18', topology: 'Three parents converging on one shared subtree',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Multidominance / Sharing', 'Multidominance / Shared Subject'],
    basis: 'The existing shared-node primitive accepts any authored parent array. Three parents change only cardinality, so the adapter test covers that stress case without duplicating the Lab card.'
  }),
  fixture({
    id: 'F31', grammar: 'G19', topology: 'Ordered sources feeding one target',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Cyclic Agree', 'Dependent Case (low)', 'Ordered Case Stacking'],
    basis: 'The sourced Case card replaces one open slot with its second value in a later frame while preserving the first value and movement chain.'
  }),
  fixture({
    id: 'F32', grammar: 'G20', topology: 'Conflicting ordered node sets',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Cyclic Linearization / Order Conflict'],
    basis: 'The card preserves two authored orders and marks their conflict without rewriting the tree.'
  }),
  fixture({
    id: 'F33', grammar: 'G21', topology: 'Before and after orders over adjacent terminals',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Local Dislocation / String-Vacuous Rebracketing'],
    basis: 'The PF lane shows the prior and current adjacency structures as authored.'
  }),
  fixture({
    id: 'F34', grammar: 'G22', topology: 'One-to-one correspondence map',
    track: 'lab-ce2', status: 'covered', researchNeed: 'none',
    cardTitles: ['PF Realization'],
    basis: 'Vocabulary Insertion rows already prove one abstract input to one surface exponent.'
  }),
  fixture({
    id: 'F35', grammar: 'G22', topology: 'Many-to-one Fusion map',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Chung (2009: fig. 12), Kandybowicz (2007: fig. 29), and Halle and Marantz (1993) all represent Fusion as a model-authored structural transition from two terminals to one. Replay already receives both workspaceForest states; the sources supply no independent overlay mark.'
  }),
  fixture({
    id: 'F36', grammar: 'G22', topology: 'One-to-many Fission map',
    track: 'lab-ce2', status: 'covered', researchNeed: 'none',
    cardTitles: ['Fission'],
    basis: 'One prior terminal is explicitly related to two current outputs with per-output content.'
  }),
  fixture({
    id: 'F37', grammar: 'G22', topology: 'Many-to-many correspondence map',
    track: 'lab-ce2', status: 'covered', researchNeed: 'none',
    cardTitles: ['Many-to-Many PF Correspondence'],
    basis: 'Yang (2018: figs. 7a, 11) supplies the boxed PF mapping copied by the Lab: one complete authored word tree anchors a compact plate containing only the authored feature-exponent correspondences.'
  }),
  fixture({
    id: 'F38', grammar: 'G22', topology: 'Connected syntax subtree lexicalized by one exponent',
    track: 'lab-ce2', status: 'covered', researchNeed: 'none',
    cardTitles: ['Phrasal Spell-Out'],
    basis: 'Caha and Pantcheva\'s source-style exponent label is anchored directly beside one complete lexicalized phrase shell without altering the authored tree.'
  }),
  fixture({
    id: 'F39', grammar: 'G23', topology: 'Persistent node ID changing state across stages',
    track: 'baseline-replay', status: 'covered', researchNeed: 'none',
    cardTitles: ['PF Realization', 'Impoverishment', 'Local Dislocation / String-Vacuous Rebracketing'],
    basis: 'Persistent witnesses carry changed authored values or ordering across adjacent stages.'
  }),
  fixture({
    id: 'F40', grammar: 'G23', topology: 'Node birth and death across stages',
    track: 'baseline-replay', status: 'covered', researchNeed: 'none',
    cardTitles: ['Fission'],
    basis: 'The prior input disappears while two output witnesses appear in the following stage.'
  }),
  fixture({
    id: 'F41', grammar: 'G24', topology: 'Syntax node to external spatial locus',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'External signed-language loci are outside Babel syntax-node scope.'
  }),
  fixture({
    id: 'F42', grammar: 'G24', topology: 'Directed external locus-to-locus vector',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'External spatial vectors are outside Babel syntax-node scope.'
  }),
  fixture({
    id: 'F43', grammar: 'G25', topology: 'Single tier interval',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Prosodic and articulatory timelines are outside Babel scope.'
  }),
  fixture({
    id: 'F44', grammar: 'G25', topology: 'Required and optional segmented dependency interval',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Tier intervals are outside Babel scope.'
  }),
  fixture({
    id: 'F45', grammar: 'G25', topology: 'Synchronized intervals across multiple tiers',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Multi-tier synchronization is outside Babel scope.'
  }),
  fixture({
    id: 'F46', grammar: 'G26', topology: 'Nullary whole-analysis judgment',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'The active relation contract requires syntax-node witnesses and does not author nullary analysis marks.'
  }),
  fixture({
    id: 'F47', grammar: 'G27', topology: 'Valid relation anchors with a marked conflict or failure target',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Anti-Locality (too short)', 'Improper Movement (CP origin)'],
    basis: 'Recognized failure cards preserve valid witnesses and source-specific failure marks.'
  }),
  fixture({
    id: 'F48', grammar: 'G28', topology: 'Nested HPSG AVM reentrancy and SLASH percolation',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'AVMs and framework-native feature paths are outside Babel scope.'
  }),
  fixture({
    id: 'F49', grammar: 'G29', topology: 'TAG substitution, root, foot, and adjunction ports',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'TAG composition ports are outside Babel syntax-tree relation scope.'
  }),
  fixture({
    id: 'F50', grammar: 'G30', topology: 'FB-TAG paired top and bottom feature ports',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Split framework-native feature structures are outside Babel scope.'
  }),
  fixture({
    id: 'F51', grammar: 'G31', topology: 'Immediate versus extensible dominance and precedence',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Underspecified dominance machinery is outside Babel scope.'
  }),
  fixture({
    id: 'F52', grammar: 'G32', topology: 'Complete non-isomorphic projection correspondence',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Autonomous non-isomorphic projections are outside Babel scope.'
  }),
  fixture({
    id: 'F53', grammar: 'G33', topology: 'Synchronized composition link across multiple trees',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Framework-native multi-tree composition is outside Babel scope.'
  }),
  fixture({
    id: 'F54', grammar: 'G11+G18+G23', topology: 'Polarity superposition, consumption, and result state',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Its reusable plaque and state pieces exist, but the framework-native polarity object does not.'
  }),
  fixture({
    id: 'F55', grammar: 'G04/G05+G14+G23', topology: 'Dynamic-Syntax pointer, requirement, unfixed node, and LINK transition',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Dynamic-Syntax pointer state and unfixed nodes are outside Babel scope.'
  }),
  fixture({
    id: 'F56', grammar: 'G12+G19+G22', topology: 'Extraction path with repeated conditioned realization',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'Internal trajectory and PF pieces exist, but the framework-native correspondence is excluded.'
  }),
  fixture({
    id: 'F57', grammar: 'G05+G11+G15', topology: 'Feature-bearing ellipsis licensor with silent domain',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Ellipsis / Silent Structure'],
    basis: 'The source analysis decomposes into Babel\'s ordinary feature plaque on the licensor and ordinary Ellipsis ghosting on an explicitly authored silent domain. No dedicated licensing relation or connector is required.'
  }),
  fixture({
    id: 'F58', grammar: 'G10+G20+G22', topology: 'Ordered many-to-many remnant and correlate alignment',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'The qualifying phrase-tree source supplies tree-internal correspondence labels, not a transferable visual relation.'
  }),
  fixture({
    id: 'F59', grammar: 'G05+G11+G12', topology: 'Coordinate feature fan-in, computed result, and fan-out',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'The complete coordinate-resolution structure depends on excluded framework-native objects.'
  }),
  fixture({
    id: 'F60', grammar: 'G05+G15+G32', topology: 'RRG operator sharing across equal-layer domains',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'The complete RRG projection correspondence is outside Babel scope.'
  }),
  fixture({
    id: 'F61', grammar: 'G09+G12+G23', topology: 'Persistent zero realization contrasted with deletion',
    track: 'baseline-direct', status: 'covered', researchNeed: 'none',
    cardTitles: ['Zero Realization (atomic pro)', 'Deletion (structured DP)'],
    basis: 'The paired cards contrast one persistent atomic terminal mapped to zero with a complete structured DP selected for deletion.'
  }),
  fixture({
    id: 'F62', grammar: 'G05+G10+G24+G25', topology: 'Shifted context, body locus, and signed tier composition',
    track: 'excluded', status: 'excluded', researchNeed: 'none', cardTitles: [],
    basis: 'External body loci and signed-language tiers are outside Babel scope.'
  }),
  fixture({
    id: 'F63', grammar: 'G01+G09', topology: 'ACD composition: covert QR path plus ellipsis inside the raised object',
    track: 'fable-additive', status: 'covered', researchNeed: 'none',
    cardTitles: ['QR / Covert Scope', 'Ellipsis / Silent Structure'],
    basis: 'The archived ACD fixture composes the existing covert QR path with a complete silent VP inside the raised quantifier; it adds no dedicated relation design.'
  }),
  fixture({
    id: 'F64', grammar: 'G02+G08', topology: 'Two nested remnant chains whose containment order matters',
    track: 'fable-additive', status: 'covered', researchNeed: 'none',
    cardTitles: ['Remnant Movement', 'Roll-up Movement', 'Smuggling'],
    basis: 'The current multi-stage cards preserve evacuation, nested containment, and accumulated movement order.'
  }),
  fixture({
    id: 'F65', grammar: 'G03+G07+G15', topology: 'Parasitic gap inside an island with authored violation status',
    track: 'fable-additive', status: 'covered', researchNeed: 'none',
    cardTitles: ['Parasitic Gap in a Subject Island (connected)', 'Parasitic Gap in a Subject Island (blocked)'],
    basis: 'The paired cards copy Phillips\'s primary-circle and secondary-square path convention and reserve the double slash for the authored blocked edge.'
  }),
  fixture({
    id: 'F67', grammar: 'G09+G10', topology: 'Identical strings contrasted as one copy class and as unrelated repetition',
    track: 'fable-additive', status: 'covered', researchNeed: 'none',
    cardTitles: ['Identity / Copy Chain', 'Plain Coreference'],
    basis: 'Chomsky et al. (2023: exx. 23-25) and Marcolli, Chomsky, and Berwick (2024: pp. 80-82) show that '
      + 'copy is derivational identity while repetition is merely isomorphic. Copy reuses Identity/lineage; '
      + 'repetition stays unmarked. The no-guess regression in tests/visualRelationFinalRepair.test.mjs proves '
      + 'identical surface strings are never merged into one chain without authored identity evidence.'
  })
];

export const VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID = new Map(
  VISUAL_RELATIONS_FIXTURE_COVERAGE.map((entry) => [entry.id, entry] as const)
);

export const summarizeVisualRelationsFixtureCoverage = () => {
  const statuses: Record<FixtureCoverageStatus, number> = {
    covered: 0,
    partial: 0,
    fallback: 0,
    missing: 0,
    excluded: 0
  };
  const tracks: Record<FixtureCoverageTrack, number> = {
    'baseline-direct': 0,
    'baseline-replay': 0,
    'lab-ce2': 0,
    excluded: 0,
    'fable-additive': 0
  };
  VISUAL_RELATIONS_FIXTURE_COVERAGE.forEach((entry) => {
    statuses[entry.status] += 1;
    tracks[entry.track] += 1;
  });
  return { total: VISUAL_RELATIONS_FIXTURE_COVERAGE.length, statuses, tracks };
};
