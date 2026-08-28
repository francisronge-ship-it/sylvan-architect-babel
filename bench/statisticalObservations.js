import { assertExactFields, assertNonemptyText } from './benchmarkValidation.js';

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

const validateBinary = (value, path) => {
  if (value !== 0 && value !== 1) {
    throw new TypeError(`${path} must be exactly 0 or 1.`);
  }
};

export const normalizeBinaryObservations = (observations, pathPrefix) => {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new TypeError(`${pathPrefix} must be a non-empty array.`);
  }
  const observationIds = [];
  const normalized = observations.map((observation, index) => {
    const path = `${pathPrefix}[${index}]`;
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
    throw new TypeError(`${pathPrefix} must have unique observationId values.`);
  }
  return normalized;
};

export const normalizePairedBinaryObservations = (pairs, pathPrefix) => {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new TypeError(`${pathPrefix} must be a non-empty array.`);
  }
  const pairIds = [];
  const normalized = pairs.map((pair, index) => {
    const path = `${pathPrefix}[${index}]`;
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
    throw new TypeError(`${pathPrefix} must have unique pairId values.`);
  }
  return normalized;
};
