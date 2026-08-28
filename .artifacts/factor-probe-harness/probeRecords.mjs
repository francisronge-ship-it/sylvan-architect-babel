import {
  cloneFrozenJson,
  failPlanningConfig,
  requireExactFields,
  requireSafeId,
  requireText
} from './planningData.mjs';

const VERDICTS = Object.freeze([
  'left-preferred',
  'right-preferred',
  'tie'
]);

const ADJUDICATION_EVIDENCE = Object.freeze({
  'different-but-equal-analysis': 'analysisEquivalenceRef',
  'hold-insufficient-evidence': 'insufficiencyRef',
  'not-attributable-to-factor': [
    'incumbentDistributionRef',
    'nonIncreaseRef'
  ],
  'real-regression': 'defectRef'
});

const VERDICT_FIELDS = Object.freeze([
  'schemaVersion',
  'comparisonId',
  'pairId',
  'presentationOrder',
  'verdict',
  'rationale',
  'reviewerIdentity',
  'rubricRef',
  'blindingRecordRef'
]);

const ADJUDICATION_FIELDS = Object.freeze([
  'schemaVersion',
  'comparisonId',
  'pairId',
  'verdictRecordRef',
  'outcome',
  'evidence',
  'rationale',
  'adjudicatorIdentity',
  'protocolRef'
]);

export const validateBlindedVerdictRecord = (input) => {
  requireExactFields(input, VERDICT_FIELDS, '$');
  if (input.schemaVersion !== 1) failPlanningConfig('$.schemaVersion must be 1.');
  requireSafeId(input.comparisonId, '$.comparisonId');
  requireSafeId(input.pairId, '$.pairId');
  if (
    !Array.isArray(input.presentationOrder)
    || input.presentationOrder.length !== 2
    || input.presentationOrder.some((value) => typeof value !== 'string' || !value.trim())
    || new Set(input.presentationOrder).size !== 2
  ) {
    failPlanningConfig('$.presentationOrder must contain two distinct opaque artifact refs.');
  }
  if (!VERDICTS.includes(input.verdict)) {
    failPlanningConfig(`$.verdict must be one of: ${VERDICTS.join(', ')}.`);
  }
  requireText(input.rationale, '$.rationale');
  requireText(input.reviewerIdentity, '$.reviewerIdentity');
  requireText(input.rubricRef, '$.rubricRef');
  requireText(input.blindingRecordRef, '$.blindingRecordRef');
  return cloneFrozenJson(input);
};

export const validateLossAdjudicationRecord = (input) => {
  requireExactFields(input, ADJUDICATION_FIELDS, '$');
  if (input.schemaVersion !== 1) failPlanningConfig('$.schemaVersion must be 1.');
  requireSafeId(input.comparisonId, '$.comparisonId');
  requireSafeId(input.pairId, '$.pairId');
  requireText(input.verdictRecordRef, '$.verdictRecordRef');
  requireText(input.rationale, '$.rationale');
  requireText(input.adjudicatorIdentity, '$.adjudicatorIdentity');
  requireText(input.protocolRef, '$.protocolRef');
  if (!Object.hasOwn(ADJUDICATION_EVIDENCE, input.outcome)) {
    failPlanningConfig(
      `$.outcome must be one of: ${Object.keys(ADJUDICATION_EVIDENCE).join(', ')}.`
    );
  }
  const requiredEvidence = [ADJUDICATION_EVIDENCE[input.outcome]].flat();
  requireExactFields(input.evidence, requiredEvidence, '$.evidence');
  requiredEvidence.forEach((field) => requireText(input.evidence[field], `$.evidence.${field}`));
  return cloneFrozenJson(input);
};
