import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertNonemptyText
} from './benchmarkValidation.js';

const PLAN_FIELDS = Object.freeze([
  'estimandId',
  'confidenceLevel',
  'criticalValue',
  'criticalValueSourceRef',
  'intervalType',
  'clusterSpecification',
  'pointWeighting',
  'varianceEstimator'
]);

const PROPORTION_FIELDS = Object.freeze([
  'observationId',
  'clusterId',
  'outcome'
]);

const PAIR_FIELDS = Object.freeze([
  'pairId',
  'clusterId',
  'left',
  'right'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'estimator plan');
  assertNonemptyText(plan.estimandId, 'estimator plan.estimandId');
  assertNonemptyText(
    plan.criticalValueSourceRef,
    'estimator plan.criticalValueSourceRef'
  );
  assertNonemptyText(
    plan.clusterSpecification,
    'estimator plan.clusterSpecification'
  );
  if (plan.intervalType !== 'two-sided-symmetric') {
    throw new TypeError(
      'estimator plan.intervalType must be two-sided-symmetric.'
    );
  }
  if (plan.pointWeighting !== 'equal-observation') {
    throw new TypeError(
      'estimator plan.pointWeighting must be equal-observation.'
    );
  }
  if (plan.varianceEstimator !== 'cr1-cluster-sandwich') {
    throw new TypeError(
      'estimator plan.varianceEstimator must be cr1-cluster-sandwich.'
    );
  }
  if (
    typeof plan.confidenceLevel !== 'number'
    || !Number.isFinite(plan.confidenceLevel)
    || plan.confidenceLevel <= 0
    || plan.confidenceLevel >= 1
  ) {
    throw new TypeError('estimator plan.confidenceLevel must be between 0 and 1.');
  }
  if (
    typeof plan.criticalValue !== 'number'
    || !Number.isFinite(plan.criticalValue)
    || plan.criticalValue <= 0
  ) {
    throw new TypeError('estimator plan.criticalValue must be positive and finite.');
  }
};

const validateBinary = (value, path) => {
  if (value !== 0 && value !== 1) {
    throw new TypeError(`${path} must be exactly 0 or 1.`);
  }
};

const estimateClusteredMean = ({ method, plan, observations }) => {
  const values = observations.map((observation) => observation.value);
  const observationCount = values.length;
  const pointEstimate = values.reduce((sum, value) => sum + value, 0)
    / observationCount;
  const clusterScores = new Map();
  observations.forEach(({ clusterId, value }) => {
    clusterScores.set(
      clusterId,
      (clusterScores.get(clusterId) ?? 0) + value - pointEstimate
    );
  });
  const clusterCount = clusterScores.size;
  let standardError = null;
  let confidenceInterval = null;
  if (clusterCount >= 2) {
    const squaredScoreSum = [...clusterScores.values()].reduce(
      (sum, score) => sum + (score * score),
      0
    );
    const variance = (clusterCount / (clusterCount - 1))
      * squaredScoreSum
      / (observationCount * observationCount);
    standardError = Math.sqrt(variance);
    confidenceInterval = {
      low: pointEstimate - (plan.criticalValue * standardError),
      high: pointEstimate + (plan.criticalValue * standardError)
    };
    if (
      !Number.isFinite(confidenceInterval.low)
      || !Number.isFinite(confidenceInterval.high)
    ) {
      throw new RangeError('estimator plan produces a non-finite interval.');
    }
  }
  const body = {
    schemaVersion: 1,
    method,
    plan: copyJsonData(plan, 'estimator plan'),
    observationsSha256: sha256CanonicalJson(observations),
    status: clusterCount >= 2 ? 'estimated' : 'insufficient-clusters',
    observationCount,
    clusterCount,
    pointEstimate,
    standardError,
    confidenceInterval
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};

export const estimateClusteredProportion = ({ plan, observations }) => {
  validatePlan(plan);
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new TypeError('proportion observations must be a non-empty array.');
  }
  const observationIds = [];
  const normalized = observations.map((observation, index) => {
    const path = `proportion observations[${index}]`;
    assertExactFields(observation, PROPORTION_FIELDS, path);
    assertNonemptyText(observation.observationId, `${path}.observationId`);
    assertNonemptyText(observation.clusterId, `${path}.clusterId`);
    validateBinary(observation.outcome, `${path}.outcome`);
    observationIds.push(observation.observationId);
    return {
      observationId: observation.observationId,
      clusterId: observation.clusterId,
      value: observation.outcome
    };
  });
  if (new Set(observationIds).size !== observationIds.length) {
    throw new TypeError('proportion observations must have unique observationId values.');
  }
  return estimateClusteredMean({
    method: 'clustered-proportion',
    plan,
    observations: normalized
  });
};

export const estimatePairedClusteredDifference = ({ plan, pairs }) => {
  validatePlan(plan);
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new TypeError('paired observations must be a non-empty array.');
  }
  const pairIds = [];
  const normalized = pairs.map((pair, index) => {
    const path = `paired observations[${index}]`;
    assertExactFields(pair, PAIR_FIELDS, path);
    assertNonemptyText(pair.pairId, `${path}.pairId`);
    assertNonemptyText(pair.clusterId, `${path}.clusterId`);
    validateBinary(pair.left, `${path}.left`);
    validateBinary(pair.right, `${path}.right`);
    pairIds.push(pair.pairId);
    return {
      pairId: pair.pairId,
      clusterId: pair.clusterId,
      value: pair.left - pair.right
    };
  });
  if (new Set(pairIds).size !== pairIds.length) {
    throw new TypeError('paired observations must have unique pairId values.');
  }
  return estimateClusteredMean({
    method: 'paired-clustered-difference',
    plan,
    observations: normalized
  });
};
