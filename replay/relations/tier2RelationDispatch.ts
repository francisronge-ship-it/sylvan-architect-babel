/**
 * Claim-level renderer-tier dispatch for one authored relation envelope.
 *
 * A raw model relation is evidence, not the unit of tier ownership. Babel
 * extracts independent claims first, then gives each claim exactly one owner:
 * Tier 1 for a valid registered primary, Tier 2 for a complete structural
 * facet, or Tier 3 for an unrecoverable primary. Tier 2 never repairs the
 * generic twin of a malformed registered primary.
 */
import type {
  DerivationStageRelation,
  SyntaxNode
} from '../../types.ts';
import {
  dispatchRelation,
  findRelationRegistryEntry,
  productionRelationRegistry
} from '../relationDispatch/index.js';
import { resolveOutcomeLiteral } from './outcomeResolver.ts';
import {
  TIER2_FACET_RECIPES,
  buildTier2FacetIdentity,
  buildTier2FacetOutputIdentities,
  evaluateTier2FacetRecipe,
  type Tier2AuthoredEvidenceEntry,
  type Tier2FacetEvidence,
  type Tier2FacetEvaluation,
  type Tier2FacetOutputIdentity,
  type Tier2FacetRecipe
} from './tier2FacetRecipes.ts';
import {
  buildTier2SynonymIndex,
  lookupTier2SynonymCandidates,
  normalizeTier2Synonym,
  type Tier2SynonymIndex,
  type Tier2SynonymScope
} from './tier2Synonyms.ts';

type Tier1Dispatch = ReturnType<typeof dispatchRelation>;

export type Tier2ResolvedFacet = {
  recipe: Tier2FacetRecipe;
  evaluation: Tier2FacetEvaluation;
  facetIdentity: string;
  outputIdentities: Tier2FacetOutputIdentity[];
  parentFacetIds: string[];
};

type Tier2EvaluatedFacet = Pick<Tier2ResolvedFacet, 'recipe' | 'evaluation'>;

export type Tier2CollisionDiagnostic = {
  kind: 'ambiguous-facets' | 'more-specific-facet';
  collision: string;
  facets: string[];
  winner?: string;
};

type ClaimDispatchBase = {
  relationInstance: { stageIndex: number; relationIndex: number };
  authoredRelationName: string;
  tier1Dispatch: Tier1Dispatch;
};

export type RecoveredEvidenceReference = {
  field: 'anchors' | 'priorAnchors' | 'values';
  key: string;
};

export type Tier1RecoveredClaim = {
  tier: 1;
  kind: 'registered-primary';
  canonicalClaimIdentity: string;
  registryEntryId: string;
  consumedEvidence: RecoveredEvidenceReference[];
};

export type Tier2RecoveredClaim = {
  tier: 2;
  kind: 'structural-facet';
  canonicalClaimIdentity: string;
  facet: Tier2ResolvedFacet;
  consumedEvidence: RecoveredEvidenceReference[];
};

export type Tier3RecoveredClaim = {
  tier: 3;
  kind: 'fallback-primary' | 'fallback-residual';
  canonicalClaimIdentity: string;
  reason:
    | 'registered-signature-incomplete'
    | 'no-complete-tier2-facet'
    | 'unconsumed-envelope-evidence';
  consumedEvidence: RecoveredEvidenceReference[];
};

export type RecoveredClaim =
  | Tier1RecoveredClaim
  | Tier2RecoveredClaim
  | Tier3RecoveredClaim;

export type RelationClaimDispatch = ClaimDispatchBase & {
  primaryClaim: Tier1RecoveredClaim | Tier3RecoveredClaim | null;
  claims: RecoveredClaim[];
  facets: Tier2ResolvedFacet[];
  diagnostics: Tier2CollisionDiagnostic[];
  /** The primary evidence after independent claim evidence is removed. */
  primaryRelation: DerivationStageRelation;
};

export type ExclusiveRelationDispatchInput = {
  relation: DerivationStageRelation;
  stageIndex: number;
  relationIndex: number;
  currentForest: readonly SyntaxNode[];
  priorForest?: readonly SyntaxNode[];
  activeLens?: boolean;
  registry?: typeof productionRelationRegistry;
  synonymIndex?: Tier2SynonymIndex;
};

export type RelationClaimDispatchEntry = {
  relation: DerivationStageRelation;
  dispatch: RelationClaimDispatch;
};

export type ExclusiveRelationBatchDispatchInput = Omit<
  ExclusiveRelationDispatchInput,
  'relation' | 'relationIndex'
> & {
  relations: readonly DerivationStageRelation[];
};

const DEFAULT_SYNONYM_INDEX = buildTier2SynonymIndex();

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
};

const primaryClaimIdentity = (
  relation: DerivationStageRelation,
  registryEntryId?: string,
  kind: Tier1RecoveredClaim['kind'] | Tier3RecoveredClaim['kind'] = 'registered-primary'
): string => JSON.stringify(canonicalize({
  kind,
  identity: registryEntryId ?? normalizeTier2Synonym(relation.relation),
  anchors: relation.anchors ?? {},
  priorAnchors: relation.priorAnchors ?? null,
  values: relation.values ?? null
}));

const authoredEvidenceReferences = (
  relation: DerivationStageRelation
): RecoveredEvidenceReference[] => (
  (['anchors', 'priorAnchors', 'values'] as const).flatMap((field) =>
    Object.keys(relation[field] ?? {}).map((key) => ({
      field,
      key: normalizeTier2Synonym(key)
    })))
);

const removeConsumedEvidence = (
  relation: DerivationStageRelation,
  consumedEvidence: readonly RecoveredEvidenceReference[]
): DerivationStageRelation => {
  const consumed = new Set(consumedEvidence.map(
    ({ field, key }) => `${field}:\u0000${key}`
  ));
  const retain = (
    field: RecoveredEvidenceReference['field'],
    block: Record<string, string | string[]> | undefined
  ): Record<string, string | string[]> => Object.fromEntries(
    Object.entries(block ?? {}).filter(([key]) => (
      !consumed.has(`${field}:\u0000${normalizeTier2Synonym(key)}`)
    ))
  );
  const anchors = retain('anchors', relation.anchors);
  const priorAnchors = retain('priorAnchors', relation.priorAnchors);
  const values = retain('values', relation.values);
  return {
    relation: relation.relation,
    anchors,
    ...(Object.keys(priorAnchors).length > 0 ? { priorAnchors } : {}),
    ...(Object.keys(values).length > 0 ? { values } : {})
  };
};

const authoredItems = (value: string | string[]): string[] => (
  (Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
);

const appendUnique = (
  target: Record<string, string[]>,
  concept: string,
  items: readonly string[]
) => {
  const existing = target[concept] ?? [];
  items.forEach((item) => {
    if (!existing.includes(item)) existing.push(item);
  });
  target[concept] = existing;
};

const normalizeBlock = (
  block: Record<string, string | string[]> | undefined,
  scope: Tier2SynonymScope,
  synonymIndex: Tier2SynonymIndex
): {
  concepts: Record<string, string[]>;
  authored: Tier2AuthoredEvidenceEntry[];
} => {
  const normalized: Record<string, string[]> = {};
  const authored: Tier2AuthoredEvidenceEntry[] = [];
  Object.entries(block ?? {}).forEach(([authoredKey, value]) => {
    const items = authoredItems(value);
    const concepts = lookupTier2SynonymCandidates(synonymIndex, scope, authoredKey);
    const activeConcepts: string[] = [];
    concepts.forEach((concept) => {
      const conceptItems = scope === 'value' && concept === 'outcome'
        ? items.filter((item) => resolveOutcomeLiteral(item)?.concept)
        : scope === 'value' && concept === 'verdict'
          ? items.filter((item) => !resolveOutcomeLiteral(item)?.concept)
          : items;
      if (conceptItems.length === 0) return;
      activeConcepts.push(concept);
      appendUnique(normalized, concept, conceptItems);
    });
    authored.push({
      key: normalizeTier2Synonym(authoredKey),
      concepts: activeConcepts,
      items: [...items]
    });
  });
  return { concepts: normalized, authored };
};

export const buildTier2FacetEvidence = ({
  relation,
  currentForest,
  priorForest,
  activeLens,
  synonymIndex = DEFAULT_SYNONYM_INDEX
}: Omit<ExclusiveRelationDispatchInput, 'stageIndex' | 'relationIndex' | 'registry'>): Tier2FacetEvidence => {
  const currentAnchors = normalizeBlock(relation.anchors, 'role', synonymIndex);
  const priorAnchors = normalizeBlock(relation.priorAnchors, 'role', synonymIndex);
  const values = normalizeBlock(relation.values, 'value', synonymIndex);
  return {
    currentAnchors: currentAnchors.concepts,
    authoredCurrentAnchors: currentAnchors.authored,
    ...(relation.priorAnchors
      ? {
          priorAnchors: priorAnchors.concepts,
          authoredPriorAnchors: priorAnchors.authored
        }
      : {}),
    values: values.concepts,
    authoredValues: values.authored,
    currentForest,
    ...(priorForest ? { priorForest } : {}),
    ...(activeLens === undefined ? {} : { activeLens })
  };
};

const evaluateClaims = (evidence: Tier2FacetEvidence): Tier2EvaluatedFacet[] => (
  TIER2_FACET_RECIPES
    .filter((recipe) => recipe.kind === 'claim')
    .map((recipe) => ({ recipe, evaluation: evaluateTier2FacetRecipe(recipe, evidence) }))
    .filter(({ evaluation }) => evaluation.complete)
);

const resolveClaimCollisions = (
  completeClaims: readonly Tier2EvaluatedFacet[]
): { selected: Tier2EvaluatedFacet[]; diagnostics: Tier2CollisionDiagnostic[] } => {
  const initial = new Map<string, Tier2EvaluatedFacet>(
    completeClaims.map((facet) => [facet.recipe.id, facet])
  );
  const selected = new Map<string, Tier2EvaluatedFacet>(initial);
  const diagnostics: Tier2CollisionDiagnostic[] = [];

  const failClosed = (collision: string, facetIds: readonly string[]) => {
    const tied = facetIds.filter((id) => initial.has(id));
    if (tied.length < 2) return;
    tied.forEach((id) => selected.delete(id));
    diagnostics.push({ kind: 'ambiguous-facets', collision, facets: [...tied] });
  };

  const prefer = (collision: string, winner: string, loser: string) => {
    if (!selected.has(winner) || !selected.has(loser)) return;
    selected.delete(loser);
    diagnostics.push({
      kind: 'more-specific-facet',
      collision,
      facets: [winner, loser],
      winner
    });
  };

  /* Case and polarity evidence distinguish the specialized feature marks. */
  failClosed('specialized-feature-reading', ['dependent-case', 'accord']);
  prefer('dependent-case-or-generic-feature', 'dependent-case', 'feature.dependency');
  prefer('accord-or-generic-feature', 'accord', 'feature.dependency');

  /* These ties have no structural discriminator in the current evidence. */
  failClosed('constituent-enclosure-reading', [
    'constituent.occurrence',
    'constituent.region'
  ]);
  /* Strict evidence supersets and outcome-specific marks own their channel. */
  prefer('carrier-or-ordinary-movement', 'movement.carrier', 'movement.path');

  return {
    selected: TIER2_FACET_RECIPES
      .map((recipe) => selected.get(recipe.id))
      .filter((facet): facet is Tier2EvaluatedFacet => Boolean(facet)),
    diagnostics
  };
};

const evaluateCompanions = (
  evidence: Tier2FacetEvidence,
  parentFacetComplete: boolean
): Tier2EvaluatedFacet[] => (
  TIER2_FACET_RECIPES
    .filter((recipe) => recipe.kind !== 'claim')
    .map((recipe) => ({
      recipe,
      evaluation: evaluateTier2FacetRecipe(recipe, {
        ...evidence,
        parentFacetComplete
      })
    }))
    .filter(({ evaluation }) => evaluation.complete)
);

const attachFacetIdentities = (
  facets: readonly Tier2EvaluatedFacet[],
  evidence: Tier2FacetEvidence,
  authoredStageIndex: number,
  parentFacets: readonly Tier2ResolvedFacet[] = []
): Tier2ResolvedFacet[] => {
  const parentFacetIds = parentFacets.map(({ recipe }) => recipe.id).sort();
  const parentFacetIdentities = parentFacets.map(({ facetIdentity }) => facetIdentity).sort();
  return facets.flatMap(({ recipe, evaluation }) => {
    const consumed = new Set(evaluation.consumedEvidence.map(
      ({ field, key }) => `${field}:\u0000${key}`
    ));
    const facetEvidence: Tier2FacetEvidence = {
      ...evidence,
      authoredCurrentAnchors: (evidence.authoredCurrentAnchors ?? []).filter(({ key }) =>
        consumed.has(`anchors:\u0000${key}`)),
      authoredPriorAnchors: (evidence.authoredPriorAnchors ?? []).filter(({ key }) =>
        consumed.has(`priorAnchors:\u0000${key}`)),
      authoredValues: (evidence.authoredValues ?? []).filter(({ key }) =>
        consumed.has(`values:\u0000${key}`))
    };
    const identityInput = {
      recipe,
      evaluation,
      evidence: facetEvidence,
      authoredStageIndex,
      ...(parentFacetIdentities.length > 0 ? { parentFacetIdentities } : {})
    };
    const facetIdentity = buildTier2FacetIdentity(identityInput);
    if (!facetIdentity) return [];
    return [{
      recipe,
      evaluation,
      facetIdentity,
      outputIdentities: buildTier2FacetOutputIdentities(identityInput),
      parentFacetIds: [...parentFacetIds]
    }];
  });
};

export const dispatchRelationClaims = (
  input: ExclusiveRelationDispatchInput
): RelationClaimDispatch => {
  const {
    relation,
    stageIndex,
    relationIndex,
    currentForest,
    priorForest,
    activeLens,
    registry = productionRelationRegistry,
    synonymIndex = DEFAULT_SYNONYM_INDEX
  } = input;
  const authoredTier1Dispatch = dispatchRelation({
    registry,
    relation,
    stageIndex,
    relationIndex
  }) as Tier1Dispatch;
  const evidence = buildTier2FacetEvidence({
    relation,
    currentForest,
    priorForest,
    activeLens,
    synonymIndex
  });
  const registryEntry = findRelationRegistryEntry(registry, relation.relation);
  const declaredPrimaryAnchorKeys = new Set<string>(registryEntry
    ? [
        ...Object.keys(registryEntry.signature.anchors.required),
        ...Object.keys(registryEntry.signature.anchors.optional)
      ].map(normalizeTier2Synonym)
    : []);
  const declaredPrimaryAnchorConcepts = new Set<string>(registryEntry
    ? [
        ...Object.keys(registryEntry.signature.anchors.required),
        ...Object.keys(registryEntry.signature.anchors.optional)
      ].flatMap((role) => lookupTier2SynonymCandidates(synonymIndex, 'role', role))
    : []);
  const primaryAcceptsAdditionalAnchors = registryEntry?.signature.anchors.allowAdditional === true;
  const eligibleClaims = registryEntry
    ? evaluateClaims(evidence).filter(({ evaluation }) => {
        if (primaryAcceptsAdditionalAnchors) return false;
        const currentAnchorEvidence = evaluation.consumedEvidence.filter(
          ({ field }) => field === 'anchors'
        );
        return currentAnchorEvidence.length > 0 && currentAnchorEvidence.every(
          ({ key }) => (
            !declaredPrimaryAnchorKeys.has(key)
            && lookupTier2SynonymCandidates(synonymIndex, 'role', key).every(
              (concept) => !declaredPrimaryAnchorConcepts.has(concept)
            )
          )
        );
      })
    : evaluateClaims(evidence);
  const { selected, diagnostics } = resolveClaimCollisions(eligibleClaims);
  const tier2ClaimFacets = attachFacetIdentities(selected, evidence, stageIndex);
  const companions = attachFacetIdentities(
    evaluateCompanions(evidence, tier2ClaimFacets.length > 0),
    evidence,
    stageIndex,
    tier2ClaimFacets
  );
  const facets = [...tier2ClaimFacets, ...companions];
  const independentlyConsumedEvidence = facets.flatMap(
    ({ evaluation }) => evaluation.consumedEvidence
  );
  const primaryRelation = removeConsumedEvidence(relation, independentlyConsumedEvidence);
  const tier1Dispatch = registryEntry
    ? dispatchRelation({
        registry,
        relation: primaryRelation,
        stageIndex,
        relationIndex
      }) as Tier1Dispatch
    : authoredTier1Dispatch;
  const base = {
    relationInstance: { stageIndex, relationIndex },
    authoredRelationName: String(relation.relation),
    tier1Dispatch,
    primaryRelation,
    facets,
    diagnostics
  };
  const tier2Claims: Tier2RecoveredClaim[] = tier2ClaimFacets.map((facet) => ({
    tier: 2,
    kind: 'structural-facet',
    canonicalClaimIdentity: facet.facetIdentity,
    facet,
    consumedEvidence: [...facet.evaluation.consumedEvidence]
  }));

  if (registryEntry && tier1Dispatch.outcome === 'resolved') {
    const primaryClaim: Tier1RecoveredClaim = {
      tier: 1,
      kind: 'registered-primary',
      canonicalClaimIdentity: primaryClaimIdentity(
        primaryRelation,
        registryEntry.id,
        'registered-primary'
      ),
      registryEntryId: registryEntry.id,
      consumedEvidence: authoredEvidenceReferences(primaryRelation)
    };
    return {
      ...base,
      primaryClaim,
      claims: [primaryClaim, ...tier2Claims]
    };
  }

  if (registryEntry) {
    const primaryClaim: Tier3RecoveredClaim = {
      tier: 3,
      kind: 'fallback-primary',
      canonicalClaimIdentity: primaryClaimIdentity(
        primaryRelation,
        registryEntry.id,
        'fallback-primary'
      ),
      reason: 'registered-signature-incomplete',
      consumedEvidence: authoredEvidenceReferences(primaryRelation)
    };
    return {
      ...base,
      primaryClaim,
      claims: [primaryClaim, ...tier2Claims]
    };
  }

  if (tier2Claims.length > 0) {
    const residualEvidence = authoredEvidenceReferences(primaryRelation);
    if (residualEvidence.length > 0) {
      const primaryClaim: Tier3RecoveredClaim = {
        tier: 3,
        kind: 'fallback-residual',
        canonicalClaimIdentity: primaryClaimIdentity(
          primaryRelation,
          undefined,
          'fallback-residual'
        ),
        reason: 'unconsumed-envelope-evidence',
        consumedEvidence: residualEvidence
      };
      return {
        ...base,
        primaryClaim,
        claims: [...tier2Claims, primaryClaim]
      };
    }
    return {
      ...base,
      primaryClaim: null,
      claims: tier2Claims
    };
  }

  const primaryClaim: Tier3RecoveredClaim = {
    tier: 3,
    kind: 'fallback-primary',
    canonicalClaimIdentity: primaryClaimIdentity(
      primaryRelation,
      undefined,
      'fallback-primary'
    ),
    reason: 'no-complete-tier2-facet',
    consumedEvidence: authoredEvidenceReferences(primaryRelation)
  };
  return {
    ...base,
    primaryClaim,
    claims: [primaryClaim]
  };
};

/**
 * Dispatch every authored relation independently. Visual coalescing happens
 * only after complete facet outputs exist; it never changes relation count,
 * tier selection, diagnostics, or Replay ownership.
 */
export const dispatchRelationClaimBatch = (
  input: ExclusiveRelationBatchDispatchInput
): RelationClaimDispatchEntry[] => {
  const {
    relations,
    stageIndex,
    currentForest,
    priorForest,
    activeLens,
    registry,
    synonymIndex
  } = input;
  return relations.map((relation, relationIndex) => ({
    relation,
    dispatch: dispatchRelationClaims({
      relation,
      stageIndex,
      relationIndex,
      currentForest,
      ...(priorForest ? { priorForest } : {}),
      ...(activeLens === undefined ? {} : { activeLens }),
      ...(registry ? { registry } : {}),
      ...(synonymIndex ? { synonymIndex } : {})
    })
  }));
};
