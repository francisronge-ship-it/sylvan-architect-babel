import { createRelationRegistry } from './relationRegistry.js';

/**
 * The versioned production registry: every relation identity used by an
 * active accepted Lab card, with its real accepted role schema (version 2;
 * version 0 was born empty, version 1 carried the representative wiring).
 *
 * Identity matching is exact with declared case/whitespace folding only.
 * Render families and persistence live in
 * `replay/relations/renderFamilies.ts`, keyed by entry id, so this
 * registry stays renderer-neutral.
 *
 * The `wh-movement`, `auxiliary-head-movement`, and `phrasal-movement`
 * identities are declared observed identities from committed model-output
 * fixtures — declarations, not patterns.
 *
 * Signature philosophy: roles are exact where the accepted design fixes
 * them; `allowAdditional` is used only for designs whose accepted contract
 * is genuinely open-rolled (FeatureBundle's single open participant role,
 * IdiomChunkCointerpretation's open chunk roles, ThetaAssignment's open
 * theta-role names, Identity's occurrence roles, PFRealization's open target
 * roles). `values` and `priorAnchors` are verbatim authored payload and stay
 * open everywhere.
 */

const scalar = { minItems: 1, maxItems: 1 };
const array = { minItems: 1, maxItems: null };

/** Authored payload blocks are open and verbatim; the registry never closes them. */
const OPEN_BLOCK = { allowAdditional: true };

/** The endpoint role vocabulary trajectory relations author. */
const TRAJECTORY_ANCHOR_ROLES = {
  optional: {
    lowerCopy: scalar,
    source: scalar,
    from: scalar,
    variable: scalar,
    realGap: scalar,
    'lower-occurrence': scalar,
    pronouncedCopy: scalar,
    higherCopy: scalar,
    target: scalar,
    operator: scalar,
    filler: scalar,
    landing: scalar,
    to: scalar,
    'landing-site': scalar,
    traceWitness: scalar,
    lowerWitness: scalar
  }
};

const entry = (id, identities, anchors, extra = {}) => ({
  id,
  version: '1',
  identities: identities.map((name) => ({ name, normalization: 'case-whitespace' })),
  signature: {
    anchors,
    priorAnchors: OPEN_BLOCK,
    values: OPEN_BLOCK
  },
  marks: [{
    id: `${id}.mark`,
    licenses: [{ field: 'relation' }]
  }],
  ...extra
});

const trajectoryEntry = (id, identities) => entry(id, identities, TRAJECTORY_ANCHOR_ROLES);

export const productionRelationRegistry = createRelationRegistry({
  registryId: 'babel.semantic-visual-grammar',
  version: '2',
  entries: [
    /* ------------------------------------------------- trajectories */
    trajectoryEntry('trajectory.phrasal', [
      'AbarMove', 'wh-movement', 'phrasal-movement'
    ]),
    trajectoryEntry('trajectory.a-movement', ['AMove']),
    trajectoryEntry('trajectory.scrambling', ['Scrambling']),
    trajectoryEntry('trajectory.head', ['HeadMove', 'auxiliary-head-movement']),
    trajectoryEntry('trajectory.lowering', ['Lowering']),
    trajectoryEntry('trajectory.operator-variable', ['OperatorVariableBinding']),
    trajectoryEntry('trajectory.remnant', ['RemnantMovement']),
    trajectoryEntry('trajectory.roll-up', ['RollUpMovement']),
    entry('trajectory.smuggling', ['Smuggling'], {
      optional: {
        lowerCopy: scalar, source: scalar,
        traceWitness: scalar, lowerWitness: scalar,
        pronouncedCopy: scalar, higherCopy: scalar, target: scalar, landing: scalar,
        passenger: scalar, intervener: scalar
      }
    }),
    entry('trajectory.across-the-board', ['AcrossTheBoardMovement'], {
      required: { sources: array, traceWitnesses: array },
      optional: { pronouncedCopy: scalar, target: scalar, landing: scalar }
    }),
    trajectoryEntry('trajectory.sideward', ['SidewardMovement']),

    /* ----------------------------------------- identity and reference */
    entry('identity.occurrences', ['Identity'], { allowAdditional: true }),
    entry('coreference.coindex', ['Coreference'], { allowAdditional: true }),
    entry('control.dependency', ['Control'], {
      required: { controller: scalar, controllee: scalar, domain: scalar }
    }),
    entry('predication.paths', ['Predication'], {
      required: { predicand: scalar },
      optional: { predicate: scalar, predicates: array }
    }),
    entry('binding.domain', ['Binding'], {
      required: { binder: scalar, bound: scalar, domain: scalar }
    }),
    entry('split-antecedence.indices', ['SplitAntecedence'], {
      required: { antecedents: array, dependent: scalar }
    }),
    entry('parasitic-gap.composition', ['ParasiticGap'], {
      optional: {
        filler: scalar, operator: scalar,
        realGap: scalar, gap: scalar,
        traceWitness: scalar,
        parasiticGap: scalar, parasiticGaps: array,
        primaryPath: array, secondaryPath: array,
        blockedEdge: scalar
      }
    }),

    /* --------------------------------------------- structure building */
    entry('pair-merge.arc', ['PairMerge'], {
      required: { host: scalar },
      optional: { pairMember: scalar, adjunct: scalar }
    }),
    entry('multidominance.shared-node', ['Multidominance'], {
      required: { parents: array, shared: scalar }
    }),
    entry('argument-sharing.domains', ['ArgumentSharing'], {
      required: { domains: array, shared: scalar }
    }),
    entry('idiom-chunks.domain', ['IdiomChunkCointerpretation'], { allowAdditional: true }),

    /* -------------------------------------------- agreement and Case */
    entry('agree.plaque', ['Agree'], {
      required: { probe: scalar, goal: scalar }
    }),
    entry('feature-bundle.plaque', ['FeatureBundle'], { allowAdditional: true }),
    entry('multiple-agree.fanout', ['MultipleAgree'], {
      required: { probe: scalar },
      optional: { goals: array, goal: scalar }
    }),
    entry('cyclic-agree.paths', ['CyclicAgree'], {
      required: { probe: scalar },
      optional: { goal: scalar, searchDomain: scalar }
    }),
    entry('feature-sharing.vines', ['FeatureSharing'], {
      required: { bearers: array }
    }),
    entry('case-assignment.path', ['CaseAssignment'], {
      required: { assigner: scalar, bearer: scalar }
    }),
    entry('dependent-case.elbow', ['DependentCase'], {
      required: { probe: scalar, goal: scalar }
    }),
    entry('accord.link', ['Accord'], {
      required: { source: scalar, goal: scalar },
      allowAdditional: true
    }),

    /* -------------------------------------------- locality and phases */
    entry('bounding-node.cuts', ['BoundingNodeCrossing'], {
      required: { domain: scalar, boundary: array }
    }),
    entry('phase.arc', ['Phase'], {
      required: { phase: scalar },
      optional: { edge: scalar }
    }),
    entry('transfer.domain', ['TransferDomain'], {
      required: { phase: scalar, edge: scalar },
      optional: { spellOutDomain: scalar, complement: scalar }
    }),
    entry('transfer.blocked-access', ['PostTransferAccess'], {
      required: { source: scalar, target: scalar },
      optional: { spellOutDomain: scalar, domain: scalar }
    }),
    entry('anti-locality.paths', ['AntiLocality'], {
      required: { source: scalar, traceWitness: scalar, landing: scalar },
      optional: { facilitator: scalar, lowerCopy: scalar, pronouncedCopy: scalar }
    }),
    entry('improper-movement.landing', ['ImproperMovement'], {
      required: { source: scalar, traceWitness: scalar, licensedLanding: scalar },
      optional: {
        licensedLandingHosts: array,
        rejectedLandingHosts: array,
        forbiddenRegion: array
      }
    }),
    entry('right-roof.boundary', ['RightRoof'], {
      required: { roof: scalar, source: scalar, traceWitness: scalar, landing: scalar }
    }),
    entry('blocked-extraction.diagnostic', ['BlockedExtraction', 'AdjunctInaccessibility'], {
      optional: {
        source: scalar, extractionSource: scalar,
        target: scalar, landingSite: scalar,
        adjunctDomain: scalar, domain: scalar
      }
    }),
    entry('intervention.blocked-path', ['Intervention'], {
      required: { intervener: scalar, target: scalar },
      optional: { landing: scalar, probe: scalar }
    }),

    /* --------------------------------------------------- silence */
    entry('ellipsis.recoverability', ['EllipsisRecoverability'], {
      required: { site: scalar },
      optional: { antecedent: scalar }
    }),
    entry('ellipsis.licensing', ['EllipsisLicensing'], {
      required: { licensor: scalar, domain: scalar },
      optional: {
        checker: scalar,
        checkerFeature: scalar, checkerFeatureNode: scalar,
        licensorFeature: scalar, licensorFeatureNode: scalar
      }
    }),
    entry('ellipsis.deletion', ['EllipsisDeletion'], {
      optional: { domain: scalar, site: scalar }
    }),
    entry('copy.multiple-pronunciation', ['MultiplePronunciation'], {
      optional: { higherCopy: scalar, lowerCopy: scalar, occurrences: array }
    }),
    entry('copy.partial-deletion', ['PartialCopyDeletion'], {
      required: { lowerCopy: scalar },
      optional: { deletedSubconstituent: scalar, deleted: scalar }
    }),

    /* ------------------------------------------------ PF and morphology */
    entry('pf.realization', ['PFRealization'], { allowAdditional: true }),
    entry('pf.vocabulary-insertion', ['VocabularyInsertion'], {
      optional: { terminal: scalar, target: scalar, input: scalar, output: scalar },
      allowAdditional: true
    }),
    entry('pf.phrasal-spellout', ['PhrasalSpellOut'], {
      optional: { phrase: scalar, domain: scalar, exponent: scalar }
    }),
    entry('pf.correspondence', ['ManyToManyCorrespondence'], {
      optional: { word: scalar, terminal: scalar, sources: array, exponents: array, correspondence: array }
    }),
    entry('pf.fission', ['Fission'], {
      required: { outputs: array },
      optional: { input: scalar }
    }),
    entry('pf.impoverishment', ['Impoverishment'], {
      required: { terminal: scalar },
      optional: { featureHierarchy: array, delinkAfter: scalar }
    }),
    entry('pf.local-dislocation', ['LocalDislocation'], {
      required: { sequence: array }
    }),
    entry('pf.cyclic-linearization', ['CyclicLinearization'], {
      required: { order: array },
      optional: { edgePosition: scalar, conflictWitness: scalar }
    }),

    /* ----------------------------------------------------- LF and scope */
    entry('qr.covert', ['QuantifierRaising'], {
      optional: {
        pronouncedQP: scalar, source: scalar,
        lfQP: scalar, target: scalar,
        scopeDomain: scalar, domain: scalar
      }
    }),
    entry('lf.reconstruction', ['LFReconstruction'], {
      required: { neglectedCopy: scalar, interpretedCopy: scalar },
      optional: { binder: scalar }
    }),
    entry('cooper-storage.ledger', ['CooperStorage'], {
      optional: { scope: scalar, quantifier: scalar, quantifiers: array, category: scalar, qstore: array, retrieved: array },
      allowAdditional: true
    }),
    entry('accord.strong-npi', ['StrongNPILicensing'], {
      required: { exhaustifier: scalar, npi: scalar, focusOperator: scalar, focusAssociate: scalar }
    }),

    /* -------------------------------------------- information structure */
    entry('focus.prominence', ['FocusMarking'], {
      required: { focus: scalar, background: scalar, domain: scalar }
    }),
    entry('focus.f-projection', ['FProjection'], {
      required: { accentBearer: scalar, projections: array }
    }),
    entry('theta.grid', ['ThetaAssignment'], {
      required: { predicate: scalar },
      allowAdditional: true
    }),
    entry('gapping.alignment', ['GappingAlignment'], {
      required: { antecedent: scalar, gap: scalar, correlates: array, remnants: array }
    })
  ]
});
