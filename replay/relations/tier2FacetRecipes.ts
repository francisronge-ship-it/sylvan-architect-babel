/**
 * Complete Tier-2 facet recipes.
 *
 * These recipes consume canonical role and value concepts after exact synonym
 * lookup. They do not inspect relation names and do not dispatch anything by
 * themselves. Task 6 will connect this evaluator to exclusive Tier dispatch.
 */
import type { SyntaxNode } from '../../types.ts';
import {
  resolveOutcomeLiteral,
  type OutcomeConcept
} from './outcomeResolver.ts';
import { normalizeTier2Synonym } from './tier2Synonyms.ts';

export const TIER2_VISUAL_PRIMITIVE_NAMES = [
  'Movement curve',
  'Orthogonal movement',
  'Cross-workspace crest',
  'Carrier arrow',
  'Path states',
  'Gap label',
  'Coindex',
  'Lens emphasis',
  'Forest light',
  'Rectangular domain',
  'Control connector',
  'Elliptic domain',
  'Predication connector',
  'Path-node rings',
  'Copy fork',
  'Barrier cut',
  'Ghosting',
  'Correspondence curves',
  'Correspondence index',
  'Strike',
  'Constituent enclosure',
  'Gradient enclosure',
  'Branch overlay',
  'Shared branch',
  'Crossed domain ovals',
  'Label box',
  'Underline',
  'Domain bracket',
  'Plaque shell',
  'Feature vine',
  'Cycle badge',
  'Feature connectors',
  'Dependent-case elbow',
  'Accord connector',
  'Boxed index',
  'Phase arc',
  'Transfer arcs',
  'Overlay annotation',
  'Edge outline',
  'Access path',
  'Verdict glyph',
  'Verdict label',
  'Candidate rail',
  'Blocking cross',
  'Licensed check',
  'Intervention path',
  'Blocked extraction curve',
  'Prominence branches',
  'Projection hop',
  'Feature annotation',
  'Accent annotation',
  'Nested association curves',
  'Feature notation',
  'Ledger frame',
  'Covert path',
  'Scope domain',
  'Ranked scope hulls',
  'Variable-binding path',
  'Role grid',
  'PF plate frame',
  'PF plate rows',
  'Rewrite arrow',
  'Correspondence map',
  'Bundle shell',
  'Delinking mark',
  'State lanes',
  'Comparison column layout',
  'Anchor badge',
  'Anchor rail'
] as const;

export type Tier2VisualPrimitiveName = typeof TIER2_VISUAL_PRIMITIVE_NAMES[number];

export const TIER2_FACET_IDS = [
  'movement.path',
  'movement.carrier',
  'gap.notation',
  'identity.occurrences',
  'presentation.lens',
  'control.dependency',
  'binding.dependency',
  'predication.dependency',
  'parasitic-gap.paths',
  'parasitic-gap.copy',
  'locality.boundary',
  'ellipsis.site',
  'correspondence.alignment',
  'deletion.site',
  'constituent.occurrence',
  'constituent.region',
  'pair-merge',
  'multidominance',
  'argument-sharing',
  'idiom.chunks',
  'plaque.structured',
  'feature-sharing',
  'agreement.cycle',
  'feature.dependency',
  'dependent-case',
  'accord',
  'phase.domain',
  'transfer.domain',
  'domain.annotation',
  'phase.edge',
  'transfer.access',
  'judgment.verdict',
  'landing-candidates',
  'judgment.blocked',
  'judgment.licensed',
  'intervention',
  'blocked-extraction',
  'focus.prominence',
  'focus.projection',
  'strong-npi',
  'storage.ledger',
  'scope.movement',
  'operator-binding',
  'theta-grid',
  'pf.structured',
  'pf.rewrite',
  'pf.correspondence',
  'pf.fission',
  'pf.impoverishment',
  'pf.local-dislocation',
  'pf.linearization',
  'organization.large-anchor-set'
] as const;

export type Tier2FacetId = typeof TIER2_FACET_IDS[number];
export type Tier2FacetKind = 'claim' | 'presentation-companion' | 'organizational-companion';
export type Tier2AnchorSource = 'current' | 'prior' | 'either';
export type Tier2TransitionKind =
  | 'movement'
  | 'pronunciation'
  | 'deletion'
  | 'rewrite'
  | 'fission'
  | 'rebracketing';

export type Tier2FacetPersistence =
  | { kind: 'while-witnesses-resolve' }
  | { kind: 'while-active' }
  | { kind: 'inherit-parent' };

export type Tier2FacetReplacement =
  | {
      kind: 'authored-prior-continuity';
      priorStage: 'immediate';
      requireCompleteResolution: true;
    }
  | { kind: 'none' }
  | { kind: 'inherit-parent' };

export type Tier2OutputPersistence = 'inherit-facet' | 'while-active';

export type Tier2FacetOutputIdentityPolicy =
  | { kind: 'complete-facet-evidence'; includeAuthoredMoment: true }
  | { kind: 'inherit-parent' };

export type Tier2AnchorRequirement = {
  role: string;
  source: Tier2AnchorSource;
  min: number;
  max?: number;
  optional?: boolean;
};

export type Tier2ValueRequirement = {
  value: string;
  min: number;
  max?: number;
  optional?: boolean;
};

export type Tier2StructuralCheck =
  | { kind: 'distinct'; roles: readonly string[] }
  | { kind: 'contains'; containerRole: string; memberRole: string }
  | { kind: 'contains-authored-silent'; role: string }
  | { kind: 'authored-trace-or-gap'; role: string }
  | { kind: 'shared-lineage'; roles: readonly string[] }
  | { kind: 'paired-cardinality'; roles: readonly [string, string] }
  | { kind: 'multiple-parents'; role: string; minParents: number }
  | { kind: 'shared-native-parent'; roles: readonly [string, string] }
  | { kind: 'siblings-within-domain'; leftRole: string; rightRole: string; domainRole: string }
  | { kind: 'native-parent-branch'; role: string }
  | { kind: 'value-token'; value: string; tokens: readonly string[]; match?: 'any' | 'all' }
  | { kind: 'accepted-outcome' }
  | { kind: 'active-lens' }
  | { kind: 'parent-facet-complete' }
  | { kind: 'large-array'; role: string; min: number };

export type Tier2OutputGate =
  | { kind: 'always' }
  | { kind: 'accepted-outcome' }
  | { kind: 'value-present'; value: string }
  | { kind: 'active-lens' }
  | { kind: 'movement-geometry'; variant: 'curve' | 'orthogonal' | 'cross-workspace' };

export type Tier2FacetOutput = {
  piece: Tier2VisualPrimitiveName;
  gate: Tier2OutputGate;
  persistence: Tier2OutputPersistence;
};

export type Tier2TransitionRule = {
  kind: Tier2TransitionKind;
  evidence:
    | 'overt-movement-stage-difference'
    | 'covert-movement-stage-difference'
    | 'pronunciation-stage-difference'
    | 'deletion-stage-difference'
    | 'rewrite-stage-difference'
    | 'fission-stage-difference'
    | 'rebracketing-stage-difference';
};

export type Tier2FacetRecipe = {
  id: Tier2FacetId;
  kind: Tier2FacetKind;
  persistence: Tier2FacetPersistence;
  replacement: Tier2FacetReplacement;
  anchors: readonly Tier2AnchorRequirement[];
  /** At least one role in each group must satisfy its declared requirement. */
  requireAnyRoleGroups: readonly (readonly string[])[];
  values: readonly Tier2ValueRequirement[];
  acceptedOutcomeConcepts: readonly OutcomeConcept[];
  checks: readonly Tier2StructuralCheck[];
  outputs: readonly Tier2FacetOutput[];
  outputIdentity: Tier2FacetOutputIdentityPolicy;
  transitionRules: readonly Tier2TransitionRule[];
};

export type Tier2AuthoredEvidenceEntry = {
  key: string;
  concepts: readonly string[];
  items: readonly string[];
};

export type Tier2FacetEvidence = {
  currentAnchors: Readonly<Record<string, readonly string[]>>;
  priorAnchors?: Readonly<Record<string, readonly string[]>>;
  values: Readonly<Record<string, readonly string[]>>;
  authoredCurrentAnchors?: readonly Tier2AuthoredEvidenceEntry[];
  authoredPriorAnchors?: readonly Tier2AuthoredEvidenceEntry[];
  authoredValues?: readonly Tier2AuthoredEvidenceEntry[];
  currentForest: readonly SyntaxNode[];
  priorForest?: readonly SyntaxNode[];
  activeLens?: boolean;
  parentFacetComplete?: boolean;
};

export type Tier2FacetEvaluation = {
  complete: boolean;
  failures: string[];
  outcomeConcept: OutcomeConcept | null;
  outputs: Tier2VisualPrimitiveName[];
  earnedTransitions: Tier2TransitionKind[];
  consumedEvidence: Array<{
    field: 'anchors' | 'priorAnchors' | 'values';
    key: string;
  }>;
};

const POSITIVE_OUTCOMES = [
  'licensed', 'successful', 'allowed', 'accepted', 'valid'
] as const satisfies readonly OutcomeConcept[];

const LOCAL_NEGATIVE_OUTCOMES = [
  'blocked', 'failed', 'illicit', 'rejected', 'unlicensed', 'impossible', 'violation'
] as const satisfies readonly OutcomeConcept[];

const LOCAL_OUTCOMES = [
  ...POSITIVE_OUTCOMES,
  ...LOCAL_NEGATIVE_OUTCOMES
] as const satisfies readonly OutcomeConcept[];

const current = (role: string, min = 1, max?: number): Tier2AnchorRequirement => ({
  role, source: 'current', min, ...(max === undefined ? {} : { max })
});
const optionalCurrent = (role: string, min = 1, max?: number): Tier2AnchorRequirement => ({
  ...current(role, min, max), optional: true
});
const prior = (role: string, min = 1, max?: number): Tier2AnchorRequirement => ({
  role, source: 'prior', min, ...(max === undefined ? {} : { max })
});
const either = (role: string, min = 1, max?: number): Tier2AnchorRequirement => ({
  role, source: 'either', min, ...(max === undefined ? {} : { max })
});
const value = (name: string, min = 1, max?: number): Tier2ValueRequirement => ({
  value: name, min, ...(max === undefined ? {} : { max })
});
const optionalValue = (name: string, min = 1, max?: number): Tier2ValueRequirement => ({
  ...value(name, min, max), optional: true
});
const output = (
  piece: Tier2VisualPrimitiveName,
  gate: Tier2OutputGate = { kind: 'always' },
  persistence: Tier2OutputPersistence = 'inherit-facet'
): Tier2FacetOutput => ({
  piece, gate, persistence
});

const defaultPersistenceFor = (kind: Tier2FacetKind): Tier2FacetPersistence => {
  if (kind === 'presentation-companion') return { kind: 'while-active' };
  if (kind === 'organizational-companion') return { kind: 'inherit-parent' };
  return { kind: 'while-witnesses-resolve' };
};

const defaultReplacementFor = (kind: Tier2FacetKind): Tier2FacetReplacement => {
  if (kind === 'presentation-companion') return { kind: 'none' };
  if (kind === 'organizational-companion') return { kind: 'inherit-parent' };
  return {
    kind: 'authored-prior-continuity',
    priorStage: 'immediate',
    requireCompleteResolution: true
  };
};

const defaultOutputIdentityFor = (kind: Tier2FacetKind): Tier2FacetOutputIdentityPolicy => (
  kind === 'claim'
    ? { kind: 'complete-facet-evidence', includeAuthoredMoment: true }
    : { kind: 'inherit-parent' }
);

const recipe = (
  id: Tier2FacetId,
  config: Omit<
    Tier2FacetRecipe,
    | 'id'
    | 'kind'
    | 'persistence'
    | 'replacement'
    | 'requireAnyRoleGroups'
    | 'acceptedOutcomeConcepts'
    | 'checks'
    | 'outputIdentity'
    | 'transitionRules'
  >
  & Partial<Pick<
    Tier2FacetRecipe,
    | 'kind'
    | 'persistence'
    | 'replacement'
    | 'requireAnyRoleGroups'
    | 'acceptedOutcomeConcepts'
    | 'checks'
    | 'outputIdentity'
    | 'transitionRules'
  >>
): Tier2FacetRecipe => {
  const kind = config.kind ?? 'claim';
  return {
    id,
    kind,
    persistence: config.persistence ?? defaultPersistenceFor(kind),
    replacement: config.replacement ?? defaultReplacementFor(kind),
    anchors: config.anchors,
    requireAnyRoleGroups: config.requireAnyRoleGroups ?? [],
    values: config.values,
    acceptedOutcomeConcepts: config.acceptedOutcomeConcepts ?? [],
    checks: config.checks ?? [],
    outputs: config.outputs,
    outputIdentity: config.outputIdentity ?? defaultOutputIdentityFor(kind),
    transitionRules: config.transitionRules ?? []
  };
};

export const TIER2_FACET_RECIPES: readonly Tier2FacetRecipe[] = [
  recipe('movement.path', {
    anchors: [current('movement.source', 1, 1), current('movement.witness', 1, 1), current('movement.landing', 1, 1)],
    values: [optionalValue('outcome', 1, 1), optionalValue('movement.route', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_OUTCOMES,
    checks: [
      { kind: 'distinct', roles: ['movement.source', 'movement.landing'] },
      { kind: 'contains', containerRole: 'movement.source', memberRole: 'movement.witness' },
      { kind: 'shared-lineage', roles: ['movement.source', 'movement.landing'] }
    ],
    outputs: [
      output('Movement curve', { kind: 'movement-geometry', variant: 'curve' }),
      output('Orthogonal movement', { kind: 'movement-geometry', variant: 'orthogonal' }),
      output('Cross-workspace crest', { kind: 'movement-geometry', variant: 'cross-workspace' }),
      output('Path states', { kind: 'accepted-outcome' })
    ],
    transitionRules: [{ kind: 'movement', evidence: 'overt-movement-stage-difference' }]
  }),
  recipe('movement.carrier', {
    anchors: [
      current('movement.source', 1, 1),
      current('movement.witness', 1, 1),
      current('movement.landing', 1, 1),
      current('movement.carrier', 1, 1)
    ],
    values: [],
    checks: [
      { kind: 'contains', containerRole: 'movement.source', memberRole: 'movement.witness' },
      { kind: 'shared-lineage', roles: ['movement.source', 'movement.landing'] }
    ],
    outputs: [output('Carrier arrow')],
    transitionRules: [{ kind: 'movement', evidence: 'overt-movement-stage-difference' }]
  }),
  recipe('gap.notation', {
    anchors: [current('gap', 1)],
    values: [optionalValue('index'), optionalValue('label')],
    checks: [{ kind: 'authored-trace-or-gap', role: 'gap' }],
    outputs: [output('Gap label')]
  }),
  recipe('identity.occurrences', {
    anchors: [current('occurrences', 2)],
    values: [optionalValue('index', 1, 1)],
    outputs: [
      output('Coindex'),
      output('Forest light')
    ]
  }),
  recipe('presentation.lens', {
    kind: 'presentation-companion',
    anchors: [current('facet.anchors', 1)],
    values: [],
    checks: [{ kind: 'parent-facet-complete' }, { kind: 'active-lens' }],
    outputs: [output('Lens emphasis', { kind: 'active-lens' })]
  }),
  recipe('control.dependency', {
    anchors: [current('controller', 1, 1), current('controllee', 1, 1), current('domain', 1, 1)],
    values: [],
    checks: [{ kind: 'contains', containerRole: 'domain', memberRole: 'controllee' }],
    outputs: [output('Rectangular domain'), output('Control connector')]
  }),
  recipe('binding.dependency', {
    anchors: [current('binder', 1, 1), current('dependent', 1, 1), current('domain', 1, 1)],
    values: [optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_OUTCOMES,
    checks: [{ kind: 'contains', containerRole: 'domain', memberRole: 'dependent' }],
    outputs: [output('Elliptic domain')]
  }),
  recipe('predication.dependency', {
    anchors: [current('predicand', 1, 1), current('predicate', 1)],
    values: [],
    checks: [{ kind: 'distinct', roles: ['predicand', 'predicate'] }],
    outputs: [output('Predication connector')]
  }),
  recipe('parasitic-gap.paths', {
    anchors: [current('primary.path', 2), current('secondary.path', 2)],
    values: [],
    outputs: [output('Path-node rings')]
  }),
  recipe('parasitic-gap.copy', {
    anchors: [current('filler', 1, 1), current('ordinary.gap', 1, 1), current('parasitic.gap', 1)],
    values: [],
    checks: [
      { kind: 'distinct', roles: ['filler', 'ordinary.gap', 'parasitic.gap'] },
      { kind: 'authored-trace-or-gap', role: 'ordinary.gap' },
      { kind: 'authored-trace-or-gap', role: 'parasitic.gap' }
    ],
    outputs: [output('Copy fork')]
  }),
  recipe('locality.boundary', {
    anchors: [current('domain', 1, 1), current('boundary', 1)],
    values: [optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_NEGATIVE_OUTCOMES,
    checks: [{ kind: 'contains', containerRole: 'domain', memberRole: 'boundary' }],
    outputs: [output('Barrier cut')]
  }),
  recipe('ellipsis.site', {
    anchors: [current('ellipsis.site', 1, 1)],
    values: [],
    checks: [{ kind: 'contains-authored-silent', role: 'ellipsis.site' }],
    outputs: [output('Ghosting')],
    transitionRules: [{ kind: 'deletion', evidence: 'deletion-stage-difference' }]
  }),
  recipe('correspondence.alignment', {
    anchors: [current('correspondence.source', 1), current('correspondence.target', 1)],
    values: [optionalValue('index')],
    checks: [{ kind: 'paired-cardinality', roles: ['correspondence.source', 'correspondence.target'] }],
    outputs: [output('Correspondence curves'), output('Correspondence index')]
  }),
  recipe('deletion.site', {
    anchors: [current('deleted.material', 1, 1)],
    values: [],
    outputs: [output('Strike')],
    transitionRules: [{ kind: 'deletion', evidence: 'deletion-stage-difference' }]
  }),
  recipe('constituent.occurrence', {
    anchors: [current('constituent', 1, 1)],
    values: [],
    outputs: [output('Constituent enclosure')]
  }),
  recipe('constituent.region', {
    anchors: [current('movement.carrier', 1, 1)],
    values: [],
    outputs: [output('Gradient enclosure')]
  }),
  recipe('pair-merge', {
    anchors: [current('host', 1, 1), current('pair.member', 1, 1)],
    values: [],
    checks: [
      { kind: 'distinct', roles: ['host', 'pair.member'] },
      { kind: 'shared-native-parent', roles: ['host', 'pair.member'] }
    ],
    outputs: [output('Branch overlay')]
  }),
  recipe('multidominance', {
    anchors: [current('parents', 2), current('shared', 1, 1)],
    values: [],
    checks: [{ kind: 'multiple-parents', role: 'shared', minParents: 2 }],
    outputs: [output('Shared branch')]
  }),
  recipe('argument-sharing', {
    anchors: [current('predicate.domains', 2), current('shared.argument', 1, 1)],
    values: [optionalValue('role.label', 1, 1)],
    outputs: [output('Crossed domain ovals'), output('Label box', { kind: 'value-present', value: 'role.label' })]
  }),
  recipe('idiom.chunks', {
    anchors: [current('chunks', 2), current('interpretation.domain', 1, 1)],
    values: [],
    checks: [{ kind: 'contains', containerRole: 'interpretation.domain', memberRole: 'chunks' }],
    outputs: [output('Underline'), output('Domain bracket')]
  }),
  recipe('plaque.structured', {
    anchors: [current('plaque.anchor', 1)],
    values: [value('plaque.rows', 1)],
    outputs: [output('Plaque shell')]
  }),
  recipe('feature-sharing', {
    anchors: [current('feature.bearers', 2)],
    values: [value('feature.rows', 1)],
    outputs: [output('Feature vine')]
  }),
  recipe('agreement.cycle', {
    anchors: [current('probe', 1, 1), current('goal', 1)],
    values: [value('cycle', 1, 1)],
    outputs: [output('Cycle badge')]
  }),
  recipe('feature.dependency', {
    anchors: [current('feature.source', 1, 1), current('feature.target', 1)],
    values: [optionalValue('feature.rows'), optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: [...POSITIVE_OUTCOMES, 'blocked', 'failed', 'rejected', 'unlicensed', 'impossible', 'violation'],
    outputs: [output('Feature connectors')]
  }),
  recipe('dependent-case', {
    anchors: [current('probe', 1, 1), current('goal', 1, 1)],
    values: [value('feature.rows', 1)],
    checks: [{ kind: 'value-token', value: 'feature.rows', tokens: ['dependent', 'case'], match: 'all' }],
    outputs: [output('Dependent-case elbow')]
  }),
  recipe('accord', {
    anchors: [current('feature.source', 1, 1), current('goal', 1, 1)],
    values: [value('feature.rows', 1), value('index', 1, 1)],
    checks: [{ kind: 'value-token', value: 'feature.rows', tokens: ['pol', 'polarity'] }],
    outputs: [output('Accord connector'), output('Boxed index')]
  }),
  recipe('phase.domain', {
    anchors: [current('phase', 1, 1)],
    values: [],
    outputs: [output('Phase arc')]
  }),
  recipe('transfer.domain', {
    anchors: [current('phase', 1, 1), current('phase.edge', 1, 1), current('transfer.domain', 1, 1)],
    values: [],
    checks: [
      { kind: 'contains', containerRole: 'phase', memberRole: 'phase.edge' },
      { kind: 'contains', containerRole: 'phase', memberRole: 'transfer.domain' }
    ],
    outputs: [output('Transfer arcs')]
  }),
  recipe('domain.annotation', {
    anchors: [current('domain', 1, 1)],
    values: [value('label', 1, 1)],
    outputs: [output('Overlay annotation')]
  }),
  recipe('phase.edge', {
    anchors: [current('phase.edge', 1, 1)],
    values: [],
    outputs: [output('Edge outline')]
  }),
  recipe('transfer.access', {
    anchors: [current('access.source', 1, 1), current('access.target', 1, 1), current('transfer.domain', 1, 1)],
    values: [optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_NEGATIVE_OUTCOMES,
    checks: [{ kind: 'contains', containerRole: 'transfer.domain', memberRole: 'access.target' }],
    outputs: [output('Access path')]
  }),
  recipe('judgment.verdict', {
    anchors: [current('analysis.anchor', 1, 1)],
    values: [value('verdict', 1, 1), optionalValue('label', 1, 1)],
    outputs: [
      output('Verdict glyph'),
      output('Verdict label', { kind: 'value-present', value: 'label' })
    ]
  }),
  recipe('landing-candidates', {
    anchors: [current('movement.witness', 1, 1), optionalCurrent('licensed.hosts', 1), optionalCurrent('rejected.hosts', 1)],
    requireAnyRoleGroups: [['licensed.hosts', 'rejected.hosts']],
    values: [optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_OUTCOMES,
    outputs: [output('Candidate rail')]
  }),
  recipe('judgment.blocked', {
    anchors: [current('judged.anchor', 1, 1)],
    values: [value('outcome', 1, 1)],
    acceptedOutcomeConcepts: ['blocked'],
    checks: [{ kind: 'accepted-outcome' }],
    outputs: [output('Blocking cross', { kind: 'accepted-outcome' })]
  }),
  recipe('judgment.licensed', {
    anchors: [current('judged.anchor', 1, 1)],
    values: [value('outcome', 1, 1)],
    acceptedOutcomeConcepts: POSITIVE_OUTCOMES,
    checks: [{ kind: 'accepted-outcome' }],
    outputs: [output('Licensed check', { kind: 'accepted-outcome' })]
  }),
  recipe('intervention', {
    anchors: [current('intervention.target', 1, 1), current('intervention.landing', 1, 1), current('intervener', 1, 1)],
    values: [optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_NEGATIVE_OUTCOMES,
    checks: [{ kind: 'distinct', roles: ['intervention.target', 'intervention.landing', 'intervener'] }],
    outputs: [output('Intervention path')]
  }),
  recipe('blocked-extraction', {
    anchors: [current('extraction.source', 1, 1), current('extraction.target', 1, 1), current('adjunct.domain', 1, 1)],
    values: [optionalValue('outcome', 1, 1)],
    acceptedOutcomeConcepts: LOCAL_NEGATIVE_OUTCOMES,
    checks: [
      { kind: 'contains', containerRole: 'adjunct.domain', memberRole: 'extraction.source' },
      { kind: 'native-parent-branch', role: 'adjunct.domain' }
    ],
    outputs: [
      output('Blocked extraction curve'),
      output('Branch overlay')
    ]
  }),
  recipe('focus.prominence', {
    anchors: [current('focus', 1, 1), current('background', 1, 1), current('domain', 1, 1)],
    values: [],
    checks: [{ kind: 'siblings-within-domain', leftRole: 'focus', rightRole: 'background', domainRole: 'domain' }],
    outputs: [output('Prominence branches')]
  }),
  recipe('focus.projection', {
    anchors: [current('accent.bearer', 1, 1), current('projection.nodes', 2)],
    values: [optionalValue('feature.label', 1, 1), optionalValue('accent.label', 1, 1)],
    outputs: [
      output('Projection hop'),
      output('Feature annotation', { kind: 'value-present', value: 'feature.label' }),
      output('Accent annotation', { kind: 'value-present', value: 'accent.label' })
    ]
  }),
  recipe('strong-npi', {
    anchors: [current('licensor', 1, 1), current('licensee', 1, 1)],
    values: [optionalValue('feature.label', 1, 1)],
    outputs: [output('Nested association curves'), output('Feature notation', { kind: 'value-present', value: 'feature.label' })]
  }),
  recipe('storage.ledger', {
    anchors: [current('scope', 1, 1)],
    values: [value('plaque.rows', 1)],
    outputs: [output('Ledger frame')]
  }),
  recipe('scope.movement', {
    anchors: [current('scope.source', 1, 1), current('scope.landing', 1, 1), current('scope.domain', 1, 1)],
    values: [],
    checks: [{ kind: 'shared-lineage', roles: ['scope.source', 'scope.landing'] }],
    outputs: [output('Covert path'), output('Scope domain')],
    transitionRules: [{ kind: 'movement', evidence: 'covert-movement-stage-difference' }]
  }),
  recipe('operator-binding', {
    anchors: [current('operator', 1, 1), current('variable', 1, 1), current('scope.domain', 1, 1)],
    values: [optionalValue('index', 1, 1)],
    checks: [{ kind: 'contains', containerRole: 'scope.domain', memberRole: 'variable' }],
    outputs: [
      output('Ranked scope hulls'),
      output('Variable-binding path')
    ]
  }),
  recipe('theta-grid', {
    anchors: [current('predicate', 1, 1), current('theta.arguments', 2)],
    values: [value('role.label', 2)],
    outputs: [output('Role grid')]
  }),
  recipe('pf.structured', {
    anchors: [current('rewrite.output', 1)],
    values: [value('pf.rows', 1)],
    outputs: [output('PF plate frame'), output('PF plate rows')],
    transitionRules: [{ kind: 'pronunciation', evidence: 'pronunciation-stage-difference' }]
  }),
  recipe('pf.rewrite', {
    anchors: [either('rewrite.input', 1, 1), current('rewrite.output', 1, 1)],
    values: [value('rewrite.rows', 1)],
    outputs: [output('Rewrite arrow')],
    transitionRules: [
      { kind: 'pronunciation', evidence: 'pronunciation-stage-difference' },
      { kind: 'rewrite', evidence: 'rewrite-stage-difference' }
    ]
  }),
  recipe('pf.correspondence', {
    anchors: [current('correspondence.sources', 1), current('correspondence.targets', 1)],
    values: [value('correspondence.rows', 1)],
    outputs: [output('Correspondence map')]
  }),
  recipe('pf.fission', {
    anchors: [prior('rewrite.input', 1, 1), current('rewrite.outputs', 2)],
    values: [value('feature.rows', 1)],
    outputs: [output('Bundle shell')],
    transitionRules: [{ kind: 'fission', evidence: 'fission-stage-difference' }]
  }),
  recipe('pf.impoverishment', {
    anchors: [current('terminal', 1, 1), current('feature.hierarchy', 2)],
    values: [value('delink.position', 1, 1)],
    outputs: [output('Delinking mark')],
    transitionRules: [{ kind: 'rewrite', evidence: 'rewrite-stage-difference' }]
  }),
  recipe('pf.local-dislocation', {
    anchors: [current('sequence', 2)],
    values: [value('order.rows', 2)],
    outputs: [output('State lanes')],
    transitionRules: [{ kind: 'rebracketing', evidence: 'rebracketing-stage-difference' }]
  }),
  recipe('pf.linearization', {
    anchors: [current('order', 1)],
    values: [value('order.rows', 2)],
    outputs: [output('Comparison column layout')]
  }),
  recipe('organization.large-anchor-set', {
    kind: 'organizational-companion',
    anchors: [current('large.anchor.array', 5)],
    values: [],
    checks: [
      { kind: 'parent-facet-complete' },
      { kind: 'large-array', role: 'large.anchor.array', min: 5 }
    ],
    outputs: [output('Anchor badge'), output('Anchor rail')]
  })
];

export const TIER2_FACET_RECIPE_BY_ID = new Map(
  TIER2_FACET_RECIPES.map((entry) => [entry.id, entry])
);

export const TIER2_FACET_ACCEPTED_OUTCOME_CONCEPTS = Object.freeze(
  Object.fromEntries(
    TIER2_FACET_RECIPES
      .filter((entry) => entry.values.some((requirement) => requirement.value === 'outcome'))
      .map((entry) => [entry.id, entry.acceptedOutcomeConcepts])
  ) as Record<string, readonly OutcomeConcept[]>
);

type TreeIndex = {
  nodes: Map<string, SyntaxNode[]>;
  parentIds: Map<string, Set<string>>;
  workspaceIds: Map<string, Set<string>>;
};

const buildTreeIndex = (forest: readonly SyntaxNode[] | undefined): TreeIndex => {
  const index: TreeIndex = {
    nodes: new Map(),
    parentIds: new Map(),
    workspaceIds: new Map()
  };

  const visit = (node: SyntaxNode, parentId: string | null, workspaceId: string) => {
    const id = String(node.id || '').trim();
    if (id) {
      const nodes = index.nodes.get(id) ?? [];
      nodes.push(node);
      index.nodes.set(id, nodes);
      const workspaces = index.workspaceIds.get(id) ?? new Set<string>();
      workspaces.add(workspaceId);
      index.workspaceIds.set(id, workspaces);
      if (parentId) {
        const parents = index.parentIds.get(id) ?? new Set<string>();
        parents.add(parentId);
        index.parentIds.set(id, parents);
      }
    }
    (Array.isArray(node.children) ? node.children : []).forEach((child) => visit(child, id || parentId, workspaceId));
  };

  (Array.isArray(forest) ? forest : []).forEach((root, rootIndex) => {
    const workspaceId = String(root.id || '').trim() || `workspace:${rootIndex}`;
    visit(root, null, workspaceId);
  });
  return index;
};

const anchorIds = (
  evidence: Tier2FacetEvidence,
  role: string,
  source: Tier2AnchorSource = 'current'
): string[] => {
  const currentIds = [...(evidence.currentAnchors[role] ?? [])].map(String).filter(Boolean);
  const priorIds = [...(evidence.priorAnchors?.[role] ?? [])].map(String).filter(Boolean);
  if (source === 'current') return currentIds;
  if (source === 'prior') return priorIds;
  return [...new Set([...currentIds, ...priorIds])];
};

const valueLiterals = (evidence: Tier2FacetEvidence, valueName: string): string[] =>
  [...(evidence.values[valueName] ?? [])].map(String).filter((literal) => literal.trim().length > 0);

const normalizedLiteralTokens = (literals: readonly string[]): Set<string> => new Set(
  literals.flatMap((literal) => (
    String(literal)
      .normalize('NFKC')
      .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, '$1 $2')
      .toLocaleLowerCase('en-US')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ))
);

const findNodes = (index: TreeIndex, ids: readonly string[]): SyntaxNode[] =>
  ids.flatMap((id) => index.nodes.get(id) ?? []);

const descendantIds = (node: SyntaxNode): Set<string> => {
  const ids = new Set<string>();
  const visit = (currentNode: SyntaxNode) => {
    const id = String(currentNode.id || '').trim();
    if (id) ids.add(id);
    (Array.isArray(currentNode.children) ? currentNode.children : []).forEach(visit);
  };
  visit(node);
  return ids;
};

const nodeContainsAny = (
  index: TreeIndex,
  containerIds: readonly string[],
  memberIds: readonly string[]
): boolean => memberIds.every((memberId) => containerIds.some((containerId) =>
  (index.nodes.get(containerId) ?? []).some((node) => descendantIds(node).has(memberId))
));

const subtreeNodes = (node: SyntaxNode): SyntaxNode[] => {
  const nodes: SyntaxNode[] = [];
  const visit = (currentNode: SyntaxNode) => {
    nodes.push(currentNode);
    (Array.isArray(currentNode.children) ? currentNode.children : []).forEach(visit);
  };
  visit(node);
  return nodes;
};

const subtreeLineages = (node: SyntaxNode): Set<string> => new Set(
  subtreeNodes(node).map((member) => String(member.lineageId || '').trim()).filter(Boolean)
);

const sharesLineage = (index: TreeIndex, roleIdGroups: readonly string[][]): boolean => {
  const lineageGroups = roleIdGroups.map((ids) => new Set(
    findNodes(index, ids).flatMap((node) => [...subtreeLineages(node)])
  ));
  if (lineageGroups.some((group) => group.size === 0)) return false;
  return [...lineageGroups[0]].some((lineage) => lineageGroups.slice(1).every((group) => group.has(lineage)));
};

const hasAuthoredSilent = (index: TreeIndex, ids: readonly string[]): boolean =>
  findNodes(index, ids).some((node) => subtreeNodes(node).some((member) => member.silent === true));

const TRACE_SURFACE = /^(?:t(?:[\d₀-₉ᵢⱼₖₗₘₙₒₚ\u2080-\u2089_]+)?|trace|gap)$/iu;

const isAuthoredTraceOrGap = (index: TreeIndex, ids: readonly string[]): boolean =>
  ids.every((id) => (index.nodes.get(id) ?? []).some((node) => subtreeNodes(node).some((member) => {
    const surface = String(member.word || member.label || '').trim();
    return Boolean(surface) && TRACE_SURFACE.test(surface);
  })));

const roleRequirementIds = (
  evidence: Tier2FacetEvidence,
  requirement: Tier2AnchorRequirement
): string[] => anchorIds(evidence, requirement.role, requirement.source);

const requirementSatisfied = (
  evidence: Tier2FacetEvidence,
  requirement: Tier2AnchorRequirement,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  const ids = roleRequirementIds(evidence, requirement);
  if (requirement.optional && ids.length === 0) return true;
  if (ids.length < requirement.min) return false;
  if (requirement.max !== undefined && ids.length > requirement.max) return false;
  return ids.every((id) => {
    if (requirement.source === 'current') return currentIndex.nodes.has(id);
    if (requirement.source === 'prior') return priorIndex.nodes.has(id);
    return currentIndex.nodes.has(id) || priorIndex.nodes.has(id);
  });
};

const outcomeFor = (recipeEntry: Tier2FacetRecipe, evidence: Tier2FacetEvidence): OutcomeConcept | null => {
  const literal = valueLiterals(evidence, 'outcome')[0];
  if (!literal) return null;
  const concept = resolveOutcomeLiteral(literal)?.concept ?? null;
  return concept && recipeEntry.acceptedOutcomeConcepts.includes(concept) ? concept : null;
};

const evaluateStructuralCheck = (
  check: Tier2StructuralCheck,
  recipeEntry: Tier2FacetRecipe,
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  outcomeConcept: OutcomeConcept | null
): boolean => {
  const ids = (role: string) => anchorIds(evidence, role, 'current');
  switch (check.kind) {
    case 'distinct': {
      const all = check.roles.flatMap(ids);
      return all.length === new Set(all).size;
    }
    case 'contains':
      return nodeContainsAny(currentIndex, ids(check.containerRole), ids(check.memberRole));
    case 'contains-authored-silent':
      return hasAuthoredSilent(currentIndex, ids(check.role));
    case 'authored-trace-or-gap':
      return isAuthoredTraceOrGap(currentIndex, ids(check.role));
    case 'shared-lineage':
      return sharesLineage(currentIndex, check.roles.map(ids));
    case 'paired-cardinality':
      return ids(check.roles[0]).length === ids(check.roles[1]).length;
    case 'multiple-parents':
      return ids(check.role).every((id) => (currentIndex.parentIds.get(id)?.size ?? 0) >= check.minParents);
    case 'shared-native-parent': {
      const leftParents = new Set(ids(check.roles[0]).flatMap((id) => [...(currentIndex.parentIds.get(id) ?? [])]));
      return ids(check.roles[1]).some((id) =>
        [...(currentIndex.parentIds.get(id) ?? [])].some((parentId) => leftParents.has(parentId)));
    }
    case 'siblings-within-domain': {
      const leftParents = new Set(ids(check.leftRole).flatMap((id) => [...(currentIndex.parentIds.get(id) ?? [])]));
      const rightParents = new Set(ids(check.rightRole).flatMap((id) => [...(currentIndex.parentIds.get(id) ?? [])]));
      const commonParents = [...leftParents].filter((parentId) => rightParents.has(parentId));
      return commonParents.length > 0 && nodeContainsAny(currentIndex, ids(check.domainRole), commonParents);
    }
    case 'native-parent-branch':
      return ids(check.role).every((id) => (currentIndex.parentIds.get(id)?.size ?? 0) > 0);
    case 'value-token': {
      const authoredTokenSets = valueLiterals(evidence, check.value)
        .map((literal) => normalizedLiteralTokens([literal]));
      return authoredTokenSets.some((authoredTokens) => (
        check.match === 'all'
          ? check.tokens.every((token) => authoredTokens.has(token))
          : check.tokens.some((token) => authoredTokens.has(token))
      ));
    }
    case 'accepted-outcome':
      return outcomeConcept !== null && recipeEntry.acceptedOutcomeConcepts.includes(outcomeConcept);
    case 'active-lens':
      return evidence.activeLens === true;
    case 'parent-facet-complete':
      return evidence.parentFacetComplete === true;
    case 'large-array':
      return ids(check.role).length >= check.min;
  }
};

const terminalSurfaces = (node: SyntaxNode): string[] => subtreeNodes(node)
  .filter((member) => !Array.isArray(member.children) || member.children.length === 0)
  .map((member) => String(member.word || '').trim());

const nodeShape = (node: SyntaxNode): string => {
  const children = Array.isArray(node.children) ? node.children : [];
  return `${node.label}[${children.map(nodeShape).join(',')}]`;
};

const previousMatch = (node: SyntaxNode, priorIndex: TreeIndex): SyntaxNode | null => {
  const id = String(node.id || '').trim();
  const idMatches = id ? priorIndex.nodes.get(id) ?? [] : [];
  if (idMatches.length === 1) return idMatches[0];
  if (idMatches.length > 1) return null;
  const lineage = String(node.lineageId || '').trim();
  if (!lineage) return null;
  const lineageMatches = [...priorIndex.nodes.values()].flat().filter((candidate) => (
    String(candidate.lineageId || '').trim() === lineage
  ));
  return lineageMatches.length === 1 ? lineageMatches[0] : null;
};

const sharedRoleLineages = (
  currentIndex: TreeIndex,
  leftIds: readonly string[],
  rightIds: readonly string[]
): Set<string> => {
  const left = new Set(findNodes(currentIndex, leftIds).flatMap((node) => [...subtreeLineages(node)]));
  const right = new Set(findNodes(currentIndex, rightIds).flatMap((node) => [...subtreeLineages(node)]));
  return new Set([...left].filter((lineage) => right.has(lineage)));
};

const lineageOccurrenceCount = (index: TreeIndex, lineage: string): number =>
  [...index.nodes.values()].flat().filter((node) => String(node.lineageId || '').trim() === lineage).length;

const sharedLineageOccurrenceIncreased = (
  currentIndex: TreeIndex,
  priorIndex: TreeIndex,
  leftIds: readonly string[],
  rightIds: readonly string[]
): boolean => [...sharedRoleLineages(currentIndex, leftIds, rightIds)].some((lineage) => (
  lineageOccurrenceCount(currentIndex, lineage) > lineageOccurrenceCount(priorIndex, lineage)
));

const landingAlreadyOccupiedSamePosition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex,
  landingRole: string
): boolean => anchorIds(evidence, landingRole).some((id) => (
  priorIndex.nodes.has(id)
  && parentSignature(priorIndex, [id]) === parentSignature(currentIndex, [id])
  && [...(priorIndex.workspaceIds.get(id) ?? [])].sort().join('\u0000')
    === [...(currentIndex.workspaceIds.get(id) ?? [])].sort().join('\u0000')
));

const sourceBecameLowerOccurrence = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex,
  sourceRole: string
): boolean => findNodes(currentIndex, anchorIds(evidence, sourceRole)).some((node) => (
  subtreeNodes(node).some((member) => {
    const children = Array.isArray(member.children) ? member.children : [];
    const surface = String(member.word || member.label || '').trim();
    const isLowerTerminal = children.length === 0
      && (member.silent === true || TRACE_SURFACE.test(surface));
    if (!isLowerTerminal) return false;
    const before = previousMatch(member, priorIndex);
    if (!before) return false;
    const beforeChildren = Array.isArray(before.children) ? before.children : [];
    return beforeChildren.length === 0
      && before.silent !== true
      && Boolean(String(before.word || '').trim());
  })
));

const overtMovementTransition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  if (!evidence.priorForest) return false;
  const sourceIds = anchorIds(evidence, 'movement.source');
  const landingIds = anchorIds(evidence, 'movement.landing');
  if (!sharesLineage(currentIndex, [sourceIds, landingIds])) return false;
  if (!sharedLineageOccurrenceIncreased(currentIndex, priorIndex, sourceIds, landingIds)) return false;
  if (landingAlreadyOccupiedSamePosition(evidence, currentIndex, priorIndex, 'movement.landing')) return false;
  return sourceBecameLowerOccurrence(evidence, currentIndex, priorIndex, 'movement.source');
};

const covertMovementTransition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => Boolean(
  evidence.priorForest
  && sharesLineage(currentIndex, [anchorIds(evidence, 'scope.source'), anchorIds(evidence, 'scope.landing')])
  && sharedLineageOccurrenceIncreased(
    currentIndex,
    priorIndex,
    anchorIds(evidence, 'scope.source'),
    anchorIds(evidence, 'scope.landing')
  )
  && !landingAlreadyOccupiedSamePosition(evidence, currentIndex, priorIndex, 'scope.landing')
  && findNodes(currentIndex, anchorIds(evidence, 'scope.source')).some((node) => previousMatch(node, priorIndex) !== null)
);

const pronunciationTransition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  if (!evidence.priorForest) return false;
  const candidates = [
    ...findNodes(currentIndex, anchorIds(evidence, 'plaque.anchor')),
    ...findNodes(currentIndex, anchorIds(evidence, 'rewrite.output'))
  ];
  return candidates.some((node) => {
    const before = previousMatch(node, priorIndex);
    return Boolean(
      before
      && nodeShape(before as SyntaxNode) === nodeShape(node)
      && terminalSurfaces(before as SyntaxNode).join('\u0000') !== terminalSurfaces(node).join('\u0000')
    );
  });
};

const deletionTransition = (
  recipeEntry: Tier2FacetRecipe,
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  if (!evidence.priorForest) return false;
  const role = recipeEntry.id === 'ellipsis.site' ? 'ellipsis.site' : 'deleted.material';
  return findNodes(currentIndex, anchorIds(evidence, role)).some((node) => (
    subtreeNodes(node).some((member) => {
      const children = Array.isArray(member.children) ? member.children : [];
      if (children.length > 0 || member.silent !== true) return false;
      const before = previousMatch(member, priorIndex);
      if (!before) return false;
      const beforeChildren = Array.isArray(before.children) ? before.children : [];
      return beforeChildren.length === 0
        && before.silent !== true
        && Boolean(String(before.word || '').trim());
    })
  ));
};

const rewriteTransition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  if (!evidence.priorForest) return false;
  const currentNodes = [
    ...findNodes(currentIndex, anchorIds(evidence, 'rewrite.output')),
    ...findNodes(currentIndex, anchorIds(evidence, 'terminal'))
  ];
  if (currentNodes.some((node) => {
    const before = previousMatch(node, priorIndex);
    return Boolean(before && terminalSurfaces(before as SyntaxNode).join('\u0000') !== terminalSurfaces(node).join('\u0000'));
  })) return true;
  const priorInputIds = anchorIds(evidence, 'rewrite.input', 'prior');
  const currentOutputIds = anchorIds(evidence, 'rewrite.output');
  return priorInputIds.length > 0
    && priorInputIds.every((id) => priorIndex.nodes.has(id))
    && priorInputIds.every((id) => !currentIndex.nodes.has(id))
    && currentOutputIds.length > 0
    && currentOutputIds.every((id) => currentIndex.nodes.has(id))
    && currentOutputIds.every((id) => !priorIndex.nodes.has(id));
};

const fissionTransition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  const inputs = anchorIds(evidence, 'rewrite.input', 'prior');
  const outputs = anchorIds(evidence, 'rewrite.outputs');
  return Boolean(
    evidence.priorForest
    && inputs.length === 1
    && outputs.length >= 2
    && priorIndex.nodes.has(inputs[0])
    && outputs.every((id) => currentIndex.nodes.has(id))
    && !currentIndex.nodes.has(inputs[0])
  );
};

const terminalOrder = (forest: readonly SyntaxNode[] | undefined): string[] => {
  const order: string[] = [];
  const visit = (node: SyntaxNode) => {
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length === 0) {
      const word = String(node.word || '').trim();
      if (word) order.push(word);
      return;
    }
    children.forEach(visit);
  };
  (Array.isArray(forest) ? forest : []).forEach(visit);
  return order;
};

const parentSignature = (index: TreeIndex, ids: readonly string[]): string => ids
  .map((id) => `${id}:${[...(index.parentIds.get(id) ?? [])].sort().join(',')}`)
  .join('|');

const rebracketingTransition = (
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  if (!evidence.priorForest) return false;
  const ids = anchorIds(evidence, 'sequence');
  return ids.length >= 2
    && terminalOrder(evidence.priorForest).join('\u0000') === terminalOrder(evidence.currentForest).join('\u0000')
    && parentSignature(priorIndex, ids) !== parentSignature(currentIndex, ids);
};

const transitionEarned = (
  rule: Tier2TransitionRule,
  recipeEntry: Tier2FacetRecipe,
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  priorIndex: TreeIndex
): boolean => {
  switch (rule.evidence) {
    case 'overt-movement-stage-difference':
      return overtMovementTransition(evidence, currentIndex, priorIndex);
    case 'covert-movement-stage-difference':
      return covertMovementTransition(evidence, currentIndex, priorIndex);
    case 'pronunciation-stage-difference':
      return pronunciationTransition(evidence, currentIndex, priorIndex);
    case 'deletion-stage-difference':
      return deletionTransition(recipeEntry, evidence, currentIndex, priorIndex);
    case 'rewrite-stage-difference':
      return rewriteTransition(evidence, currentIndex, priorIndex);
    case 'fission-stage-difference':
      return fissionTransition(evidence, currentIndex, priorIndex);
    case 'rebracketing-stage-difference':
      return rebracketingTransition(evidence, currentIndex, priorIndex);
  }
};

const outputGatePasses = (
  gate: Tier2OutputGate,
  recipeEntry: Tier2FacetRecipe,
  evidence: Tier2FacetEvidence,
  currentIndex: TreeIndex,
  outcomeConcept: OutcomeConcept | null
): boolean => {
  switch (gate.kind) {
    case 'always':
      return true;
    case 'accepted-outcome':
      return outcomeConcept !== null && recipeEntry.acceptedOutcomeConcepts.includes(outcomeConcept);
    case 'value-present':
      return valueLiterals(evidence, gate.value).length > 0;
    case 'active-lens':
      return evidence.activeLens === true;
    case 'movement-geometry': {
      const sourceIds = anchorIds(evidence, 'movement.source');
      const landingIds = anchorIds(evidence, 'movement.landing');
      const sourceWorkspaces = new Set(sourceIds.flatMap((id) => [...(currentIndex.workspaceIds.get(id) ?? [])]));
      const landingWorkspaces = new Set(landingIds.flatMap((id) => [...(currentIndex.workspaceIds.get(id) ?? [])]));
      const crossWorkspace = [...sourceWorkspaces].every((workspace) => !landingWorkspaces.has(workspace));
      if (gate.variant === 'cross-workspace') return crossWorkspace;
      if (crossWorkspace) return false;
      const routeValues = valueLiterals(evidence, 'movement.route').map(normalizeTier2Synonym);
      const route = routeValues.includes('orthogonal') ? 'orthogonal' : 'curve';
      return gate.variant === route;
    }
  }
};

export const evaluateTier2FacetRecipe = (
  recipeEntry: Tier2FacetRecipe,
  evidence: Tier2FacetEvidence
): Tier2FacetEvaluation => {
  const currentIndex = buildTreeIndex(evidence.currentForest);
  const priorIndex = buildTreeIndex(evidence.priorForest);
  const failures: string[] = [];

  recipeEntry.anchors.forEach((requirement) => {
    if (!requirementSatisfied(evidence, requirement, currentIndex, priorIndex)) {
      failures.push(`anchor:${requirement.source}:${requirement.role}`);
    }
  });

  recipeEntry.requireAnyRoleGroups.forEach((roles) => {
    const satisfied = roles.some((role) => {
      const requirement = recipeEntry.anchors.find((entry) => entry.role === role);
      return Boolean(requirement && requirementSatisfied(evidence, requirement, currentIndex, priorIndex)
        && roleRequirementIds(evidence, requirement).length > 0);
    });
    if (!satisfied) failures.push(`anchor-any:${roles.join('|')}`);
  });

  recipeEntry.values.forEach((requirement) => {
    const literals = valueLiterals(evidence, requirement.value);
    if (requirement.optional && literals.length === 0) return;
    if (literals.length < requirement.min || (requirement.max !== undefined && literals.length > requirement.max)) {
      failures.push(`value:${requirement.value}`);
    }
  });

  const outcomeConcept = outcomeFor(recipeEntry, evidence);
  recipeEntry.checks.forEach((check) => {
    if (!evaluateStructuralCheck(check, recipeEntry, evidence, currentIndex, outcomeConcept)) {
      failures.push(`check:${check.kind}`);
    }
  });

  const complete = failures.length === 0;
  const consumedEvidence = complete
    ? [
        ...recipeEntry.anchors.flatMap((requirement) => {
          const entries = requirement.source === 'current'
            ? [
                { field: 'anchors' as const, entries: evidence.authoredCurrentAnchors ?? [] },
                /* Same-role prior anchors are replacement evidence for this claim. */
                { field: 'priorAnchors' as const, entries: evidence.authoredPriorAnchors ?? [] }
              ]
            : requirement.source === 'prior'
              ? [{ field: 'priorAnchors' as const, entries: evidence.authoredPriorAnchors ?? [] }]
              : [
                  { field: 'anchors' as const, entries: evidence.authoredCurrentAnchors ?? [] },
                  { field: 'priorAnchors' as const, entries: evidence.authoredPriorAnchors ?? [] }
                ];
          return entries.flatMap(({ field, entries: authoredEntries }) =>
            authoredEntries
              .filter(({ concepts, items }) => (
                concepts.includes(requirement.role) && items.length > 0
              ))
              .map(({ key }) => ({ field, key })));
        }),
        ...recipeEntry.values.flatMap((requirement) => (
          (evidence.authoredValues ?? [])
            .filter(({ concepts, items }) => (
              concepts.includes(requirement.value) && items.length > 0
            ))
            .map(({ key }) => ({ field: 'values' as const, key }))
        ))
      ].filter((entry, index, entries) => entries.findIndex((candidate) => (
        candidate.field === entry.field && candidate.key === entry.key
      )) === index)
    : [];
  return {
    complete,
    failures,
    outcomeConcept,
    outputs: complete
      ? recipeEntry.outputs
          .filter((entry) => outputGatePasses(entry.gate, recipeEntry, evidence, currentIndex, outcomeConcept))
          .map((entry) => entry.piece)
      : [],
    earnedTransitions: complete
      ? recipeEntry.transitionRules
          .filter((rule) => transitionEarned(rule, recipeEntry, evidence, currentIndex, priorIndex))
          .map((rule) => rule.kind)
      : [],
    consumedEvidence
  };
};

export type Tier2FacetOutputIdentity = {
  piece: Tier2VisualPrimitiveName;
  key: string;
};

export type Tier2FacetOutputIdentityInput = {
  recipe: Tier2FacetRecipe;
  evaluation: Tier2FacetEvaluation;
  evidence: Tier2FacetEvidence;
  authoredStageIndex: number;
  parentFacetIdentities?: readonly string[];
};

const canonicalizeIdentity = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeIdentity);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((canonical, key) => {
        canonical[key] = canonicalizeIdentity((value as Record<string, unknown>)[key]);
        return canonical;
      }, {});
  }
  return value;
};

const identityWitnesses = (
  index: TreeIndex,
  ids: readonly string[]
): Array<{
  id: string;
  lineages: string[];
  workspaces: string[];
}> => ids.map((id) => ({
  id,
  lineages: [...new Set((index.nodes.get(id) ?? [])
    .map((node) => String(node.lineageId || '').trim())
    .filter(Boolean))].sort(),
  workspaces: [...(index.workspaceIds.get(id) ?? [])].sort()
}));

const appendIdentityItems = (
  target: Record<string, string[]>,
  key: string,
  items: readonly string[]
) => {
  const existing = target[key] ?? [];
  items.forEach((item) => {
    if (!existing.includes(item)) existing.push(item);
  });
  target[key] = existing;
};

const identityRoleBlock = (
  recipeEntry: Tier2FacetRecipe,
  anchors: Readonly<Record<string, readonly string[]>> | undefined,
  authoredEntries: readonly Tier2AuthoredEvidenceEntry[] | undefined,
  index: TreeIndex
): Record<string, ReturnType<typeof identityWitnesses>> => {
  if (!authoredEntries) {
    return Object.fromEntries(
      Object.entries(anchors ?? {})
        .map(([role, ids]) => [role, identityWitnesses(index, [...ids])])
        .filter(([, witnesses]) => witnesses.length > 0)
    );
  }

  const recipeRoles = new Set(recipeEntry.anchors.map(({ role }) => role));
  const normalized: Record<string, string[]> = {};
  authoredEntries.forEach(({ key, concepts, items }) => {
    const matchingRoles = concepts.filter((concept) => recipeRoles.has(concept));
    const identityRoles = matchingRoles.length > 0
      ? matchingRoles
      : (recipeEntry.kind === 'claim' ? [`literal:${key}`] : []);
    identityRoles.forEach((role) => appendIdentityItems(normalized, role, items));
  });
  return Object.fromEntries(
    Object.entries(normalized)
      .map(([role, ids]) => [role, identityWitnesses(index, ids)])
      .filter(([, witnesses]) => witnesses.length > 0)
  );
};

const identityValueBlock = (
  recipeEntry: Tier2FacetRecipe,
  evidence: Tier2FacetEvidence
): Record<string, string[]> => {
  if (!evidence.authoredValues) {
    return Object.fromEntries(
      Object.entries(evidence.values)
        .map(([valueName, literals]) => [valueName, [...literals]])
        .filter(([, literals]) => literals.length > 0)
    );
  }

  const recipeValues = new Set(recipeEntry.values.map(({ value }) => value));
  const normalized: Record<string, string[]> = {};
  evidence.authoredValues.forEach(({ key, concepts, items }) => {
    const matchingValues = concepts.filter((concept) => recipeValues.has(concept));
    const identityValues = matchingValues.length > 0
      ? matchingValues
      : (recipeEntry.kind === 'claim' ? [`literal:${key}`] : []);
    identityValues.forEach((value) => appendIdentityItems(normalized, value, items));
  });
  return normalized;
};

export const buildTier2FacetIdentity = ({
  recipe: recipeEntry,
  evaluation,
  evidence,
  authoredStageIndex,
  parentFacetIdentities
}: Tier2FacetOutputIdentityInput): string | null => {
  if (!evaluation.complete) return null;
  if (recipeEntry.outputIdentity.kind === 'inherit-parent') {
    const parents = [...new Set((parentFacetIdentities ?? [])
      .map((identity) => String(identity || '').trim())
      .filter(Boolean))].sort();
    if (parents.length === 0) return null;
    const currentIndex = buildTreeIndex(evidence.currentForest);
    const priorIndex = buildTreeIndex(evidence.priorForest);
    return JSON.stringify(canonicalizeIdentity({
      facet: recipeEntry.id,
      parents,
      authoredMoment: authoredStageIndex,
      currentAnchors: identityRoleBlock(
        recipeEntry,
        evidence.currentAnchors,
        evidence.authoredCurrentAnchors,
        currentIndex
      ),
      priorAnchors: identityRoleBlock(
        recipeEntry,
        evidence.priorAnchors,
        evidence.authoredPriorAnchors,
        priorIndex
      ),
      values: identityValueBlock(recipeEntry, evidence),
      outcome: evaluation.outcomeConcept,
      transitions: evaluation.earnedTransitions
    }));
  }

  const currentIndex = buildTreeIndex(evidence.currentForest);
  const priorIndex = buildTreeIndex(evidence.priorForest);
  return JSON.stringify(canonicalizeIdentity({
    facet: recipeEntry.id,
    authoredMoment: authoredStageIndex,
    currentAnchors: identityRoleBlock(
      recipeEntry,
      evidence.currentAnchors,
      evidence.authoredCurrentAnchors,
      currentIndex
    ),
    priorAnchors: identityRoleBlock(
      recipeEntry,
      evidence.priorAnchors,
      evidence.authoredPriorAnchors,
      priorIndex
    ),
    values: identityValueBlock(recipeEntry, evidence),
    outcome: evaluation.outcomeConcept,
    transitions: evaluation.earnedTransitions
  }));
};

export const buildTier2FacetOutputIdentities = (
  input: Tier2FacetOutputIdentityInput
): Tier2FacetOutputIdentity[] => {
  const facetIdentity = buildTier2FacetIdentity(input);
  if (!facetIdentity) return [];
  return input.evaluation.outputs.map((piece) => ({
    piece,
    key: JSON.stringify(canonicalizeIdentity({ facetIdentity, piece }))
  }));
};
