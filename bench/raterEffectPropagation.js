import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText
} from './benchmarkValidation.js';

const PLAN_FIELDS = Object.freeze([
  'propagationId',
  'scoreIdentity',
  'raterEffectIdentity',
  'baseScoreRaterEffectTreatmentIdentity',
  'baseScoreRaterEffectTreatmentSourceRef',
  'combinationIdentity',
  'drawPairingIdentity',
  'jointDrawConstructionIdentity',
  'jointDrawConstructionSourceRef',
  'pointSummaryIdentity',
  'scaleCompatibilityIdentity',
  'scaleCompatibilitySourceRef',
  'confidenceLevel',
  'confidenceLevelSourceRef',
  'intervalType',
  'scoreDrawsSourceRef',
  'scoreDrawsSha256',
  'raterEffectDrawsSourceRef',
  'raterEffectDrawsSha256',
  'lowerOrderIndex',
  'upperOrderIndex',
  'provenance'
]);
const SCORE_DRAW_FIELDS = Object.freeze(['drawId', 'value']);
const RATER_EFFECT_DRAW_FIELDS = Object.freeze(['drawId', 'signedEffect']);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

export const hashRaterEffectPropagationData = (value) => {
  const normalized = copyJsonData(value, 'rater-effect propagation hash input');
  return sha256CanonicalJson(normalized);
};

const validatePlan = (plan, drawCount) => {
  assertExactFields(plan, PLAN_FIELDS, 'rater-effect propagation plan');
  for (const field of [
    'propagationId',
    'scoreIdentity',
    'raterEffectIdentity',
    'baseScoreRaterEffectTreatmentIdentity',
    'baseScoreRaterEffectTreatmentSourceRef',
    'jointDrawConstructionIdentity',
    'jointDrawConstructionSourceRef',
    'scaleCompatibilityIdentity',
    'scaleCompatibilitySourceRef',
    'confidenceLevelSourceRef',
    'scoreDrawsSourceRef',
    'raterEffectDrawsSourceRef'
  ]) {
    assertNonemptyText(plan[field], `rater-effect propagation plan.${field}`);
  }
  const requiredIdentities = {
    baseScoreRaterEffectTreatmentIdentity: 'rater-effect-excluded',
    combinationIdentity: 'paired-additive-signed-rater-effect-draws',
    drawPairingIdentity: 'exact-draw-id',
    jointDrawConstructionIdentity: 'joint-score-rater-effect-draws',
    pointSummaryIdentity: 'equal-draw-arithmetic-mean',
    scaleCompatibilityIdentity: 'common-additive-scale',
    intervalType: 'percentile-order-statistics'
  };
  Object.entries(requiredIdentities).forEach(([field, required]) => {
    if (plan[field] !== required) {
      throw new TypeError(
        `rater-effect propagation plan.${field} must be ${required}.`
      );
    }
  });
  if (
    typeof plan.confidenceLevel !== 'number'
    || !Number.isFinite(plan.confidenceLevel)
    || plan.confidenceLevel <= 0
    || plan.confidenceLevel >= 1
  ) {
    throw new TypeError(
      'rater-effect propagation plan.confidenceLevel must be between 0 and 1.'
    );
  }
  assertSha256(
    plan.scoreDrawsSha256,
    'rater-effect propagation plan.scoreDrawsSha256'
  );
  assertSha256(
    plan.raterEffectDrawsSha256,
    'rater-effect propagation plan.raterEffectDrawsSha256'
  );
  for (const field of ['lowerOrderIndex', 'upperOrderIndex']) {
    if (
      !Number.isSafeInteger(plan[field])
      || plan[field] < 0
      || plan[field] >= drawCount
    ) {
      throw new TypeError(
        `rater-effect propagation plan.${field} must index the supplied draws.`
      );
    }
  }
  if (plan.lowerOrderIndex > plan.upperOrderIndex) {
    throw new TypeError(
      'rater-effect propagation plan lowerOrderIndex must not exceed upperOrderIndex.'
    );
  }
  assertJsonRecord(plan.provenance, 'rater-effect propagation plan.provenance');
};

const normalizeDraws = (draws, fields, valueField, path) => {
  if (!Array.isArray(draws) || draws.length === 0) {
    throw new TypeError(`${path} must be a non-empty array.`);
  }
  const drawIds = [];
  const normalized = draws.map((draw, index) => {
    const drawPath = `${path}[${index}]`;
    assertExactFields(draw, fields, drawPath);
    assertNonemptyText(draw.drawId, `${drawPath}.drawId`);
    if (typeof draw[valueField] !== 'number' || !Number.isFinite(draw[valueField])) {
      throw new TypeError(`${drawPath}.${valueField} must be finite.`);
    }
    drawIds.push(draw.drawId);
    return {
      drawId: draw.drawId,
      [valueField]: draw[valueField]
    };
  });
  if (new Set(drawIds).size !== drawIds.length) {
    throw new TypeError(`${path} must use unique drawId values.`);
  }
  return normalized;
};

const summarize = (values, plan) => {
  const ordered = [...values].sort((left, right) => left - right);
  const mean = values.reduce(
    (sum, value) => sum + (value / values.length),
    0
  );
  if (!Number.isFinite(mean)) {
    throw new RangeError('rater-effect propagation summary produced a non-finite mean.');
  }
  return {
    mean,
    confidenceInterval: {
      low: ordered[plan.lowerOrderIndex],
      high: ordered[plan.upperOrderIndex]
    }
  };
};

export const propagateRaterEffects = ({
  plan,
  scoreDraws,
  raterEffectDraws
}) => {
  const planCopy = copyJsonData(plan, 'rater-effect propagation plan');
  const normalizedScores = normalizeDraws(
    scoreDraws,
    SCORE_DRAW_FIELDS,
    'value',
    'rater-effect propagation scoreDraws'
  );
  const normalizedEffects = normalizeDraws(
    raterEffectDraws,
    RATER_EFFECT_DRAW_FIELDS,
    'signedEffect',
    'rater-effect propagation raterEffectDraws'
  );
  validatePlan(planCopy, normalizedScores.length);
  const scoreDrawsSha256 = sha256CanonicalJson(normalizedScores);
  const raterEffectDrawsSha256 = sha256CanonicalJson(normalizedEffects);
  if (scoreDrawsSha256 !== planCopy.scoreDrawsSha256) {
    throw new TypeError(
      'rater-effect propagation scoreDraws do not match plan.scoreDrawsSha256.'
    );
  }
  if (raterEffectDrawsSha256 !== planCopy.raterEffectDrawsSha256) {
    throw new TypeError(
      'rater-effect propagation raterEffectDraws do not match plan.raterEffectDrawsSha256.'
    );
  }

  const effectsByDrawId = new Map(
    normalizedEffects.map((draw) => [draw.drawId, draw.signedEffect])
  );
  if (
    normalizedScores.length !== normalizedEffects.length
    || normalizedScores.some(({ drawId }) => !effectsByDrawId.has(drawId))
  ) {
    throw new TypeError(
      'rater-effect propagation draws must have exactly matching drawId sets.'
    );
  }
  const pairedDraws = normalizedScores.map(({ drawId, value }) => {
    const signedRaterEffect = effectsByDrawId.get(drawId);
    const propagatedValue = value + signedRaterEffect;
    if (!Number.isFinite(propagatedValue)) {
      throw new RangeError(
        `rater-effect propagation draw ${drawId} produced a non-finite value.`
      );
    }
    return {
      drawId,
      scoreValue: value,
      signedRaterEffect,
      propagatedValue
    };
  });
  const baseValues = pairedDraws.map(({ scoreValue }) => scoreValue);
  const effectValues = pairedDraws.map(({ signedRaterEffect }) => signedRaterEffect);
  const propagatedValues = pairedDraws.map(({ propagatedValue }) => propagatedValue);
  const body = {
    schemaVersion: 1,
    method: 'paired-rater-effect-propagation',
    plan: planCopy,
    scoreDrawsSha256,
    raterEffectDrawsSha256,
    drawCount: pairedDraws.length,
    pairedDraws,
    baseScore: summarize(baseValues, planCopy),
    raterEffect: summarize(effectValues, planCopy),
    propagatedScore: summarize(propagatedValues, planCopy)
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
