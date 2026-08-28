import { createHash } from 'node:crypto';

import { canonicalizeJsonData, copyJsonData, freezeJsonData } from './jsonData.js';
import { assertExactFields, assertNonemptyText } from './benchmarkValidation.js';
import {
  normalizeBinaryObservations,
  normalizePairedBinaryObservations
} from './statisticalObservations.js';

const PLAN_FIELDS = Object.freeze([
  'estimandId',
  'confidenceLevel',
  'intervalType',
  'clusterSpecification',
  'pointWeighting',
  'bootstrapMethod',
  'bootstrapVariant',
  'multiplierDistributionId',
  'multiplierScheduleSourceRef',
  'multiplierScheduleSha256',
  'lowerOrderIndex',
  'upperOrderIndex'
]);
const MULTIPLIER_FIELDS = Object.freeze(['clusterId', 'multiplier']);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const validatePlan = (plan, replicationCount) => {
  assertExactFields(plan, PLAN_FIELDS, 'wild cluster bootstrap plan');
  for (const field of [
    'estimandId',
    'clusterSpecification',
    'multiplierDistributionId',
    'multiplierScheduleSourceRef'
  ]) {
    assertNonemptyText(plan[field], `wild cluster bootstrap plan.${field}`);
  }
  if (!/^[a-f0-9]{64}$/.test(plan.multiplierScheduleSha256)) {
    throw new TypeError(
      'wild cluster bootstrap plan.multiplierScheduleSha256 must be a lowercase SHA-256.'
    );
  }
  if (
    typeof plan.confidenceLevel !== 'number'
    || !Number.isFinite(plan.confidenceLevel)
    || plan.confidenceLevel <= 0
    || plan.confidenceLevel >= 1
  ) {
    throw new TypeError(
      'wild cluster bootstrap plan.confidenceLevel must be between 0 and 1.'
    );
  }
  const requiredIdentities = {
    intervalType: 'percentile-order-statistics',
    pointWeighting: 'equal-observation',
    bootstrapMethod: 'wild-cluster-explicit-multipliers',
    bootstrapVariant: 'intercept-only-unrestricted-residual'
  };
  Object.entries(requiredIdentities).forEach(([field, required]) => {
    if (plan[field] !== required) {
      throw new TypeError(`wild cluster bootstrap plan.${field} must be ${required}.`);
    }
  });
  for (const field of ['lowerOrderIndex', 'upperOrderIndex']) {
    if (
      !Number.isSafeInteger(plan[field])
      || plan[field] < 0
      || plan[field] >= replicationCount
    ) {
      throw new TypeError(
        `wild cluster bootstrap plan.${field} must index the supplied multiplier schedule.`
      );
    }
  }
  if (plan.lowerOrderIndex > plan.upperOrderIndex) {
    throw new TypeError(
      'wild cluster bootstrap plan lowerOrderIndex must not exceed upperOrderIndex.'
    );
  }
};

const normalizeMultiplierSchedule = (schedule, clusterIds) => {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    throw new TypeError(
      'wild cluster bootstrap multiplierSchedule must be a non-empty array.'
    );
  }
  const expectedClusters = new Set(clusterIds);
  return schedule.map((replication, replicationIndex) => {
    if (!Array.isArray(replication) || replication.length !== clusterIds.length) {
      throw new TypeError(
        `wild cluster bootstrap multiplierSchedule[${replicationIndex}] must cover every cluster exactly once.`
      );
    }
    const seen = new Set();
    const normalized = replication.map((entry, entryIndex) => {
      const path = `wild cluster bootstrap multiplierSchedule[${replicationIndex}][${entryIndex}]`;
      assertExactFields(entry, MULTIPLIER_FIELDS, path);
      assertNonemptyText(entry.clusterId, `${path}.clusterId`);
      if (!expectedClusters.has(entry.clusterId) || seen.has(entry.clusterId)) {
        throw new TypeError(`${path}.clusterId must name one previously unused cluster.`);
      }
      if (typeof entry.multiplier !== 'number' || !Number.isFinite(entry.multiplier)) {
        throw new TypeError(`${path}.multiplier must be finite.`);
      }
      seen.add(entry.clusterId);
      return { clusterId: entry.clusterId, multiplier: entry.multiplier };
    });
    return normalized;
  });
};

const estimateWildClusterMean = ({
  method,
  plan,
  observations,
  multiplierSchedule
}) => {
  const clusterIds = [...new Set(observations.map(({ clusterId }) => clusterId))];
  const normalizedSchedule = normalizeMultiplierSchedule(
    multiplierSchedule,
    clusterIds
  );
  validatePlan(plan, normalizedSchedule.length);
  const multiplierScheduleSha256 = sha256CanonicalJson(normalizedSchedule);
  if (multiplierScheduleSha256 !== plan.multiplierScheduleSha256) {
    throw new TypeError(
      'wild cluster bootstrap multiplierSchedule does not match plan.multiplierScheduleSha256.'
    );
  }

  const pointEstimate = observations.reduce((sum, { value }) => sum + value, 0)
    / observations.length;
  const commonBody = {
    schemaVersion: 1,
    method,
    plan: copyJsonData(plan, 'wild cluster bootstrap plan'),
    observationsSha256: sha256CanonicalJson(observations),
    multiplierScheduleSha256,
    observationCount: observations.length,
    clusterCount: clusterIds.length,
    replicationCount: normalizedSchedule.length,
    pointEstimate
  };
  if (clusterIds.length < 2) {
    const body = {
      ...commonBody,
      status: 'insufficient-clusters',
      confidenceInterval: null,
      bootstrapEstimates: null
    };
    return freezeJsonData({
      ...body,
      receiptSha256: sha256CanonicalJson(body)
    });
  }
  const clusterScores = new Map(clusterIds.map((clusterId) => [clusterId, 0]));
  observations.forEach(({ clusterId, value }) => {
    clusterScores.set(
      clusterId,
      clusterScores.get(clusterId) + value - pointEstimate
    );
  });
  const bootstrapEstimates = normalizedSchedule.map((replication) => (
    pointEstimate + (
      replication.reduce(
        (sum, { clusterId, multiplier }) => (
          sum + (multiplier * clusterScores.get(clusterId))
        ),
        0
      ) / observations.length
    )
  ));
  if (bootstrapEstimates.some((estimate) => !Number.isFinite(estimate))) {
    throw new RangeError('wild cluster bootstrap produced a non-finite estimate.');
  }
  const orderedEstimates = [...bootstrapEstimates].sort((left, right) => left - right);
  const body = {
    ...commonBody,
    status: 'estimated',
    confidenceInterval: {
      low: orderedEstimates[plan.lowerOrderIndex],
      high: orderedEstimates[plan.upperOrderIndex]
    },
    bootstrapEstimates
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};

export const estimateWildClusterBootstrapProportion = ({
  plan,
  observations,
  multiplierSchedule
}) => estimateWildClusterMean({
  method: 'wild-cluster-bootstrap-proportion',
  plan,
  observations: normalizeBinaryObservations(
    observations,
    'wild cluster bootstrap observations'
  ),
  multiplierSchedule
});

export const estimatePairedWildClusterBootstrapDifference = ({
  plan,
  pairs,
  multiplierSchedule
}) => estimateWildClusterMean({
  method: 'paired-wild-cluster-bootstrap-difference',
  plan,
  observations: normalizePairedBinaryObservations(
    pairs,
    'paired wild cluster bootstrap observations'
  ),
  multiplierSchedule
});
