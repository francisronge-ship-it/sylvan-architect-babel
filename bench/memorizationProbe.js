import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertUniqueTextArray,
  sameTextSet
} from './benchmarkValidation.js';

const PLAN_FIELDS = Object.freeze([
  'analysisId',
  'comparisonIdentity',
  'probeSpendIdentity',
  'observationOrderIdentity',
  'interpretationIdentity',
  'extractionMethodRef',
  'extractionMethodSha256',
  'probeSetSourceRef',
  'probeSetSha256',
  'observationSetSourceRef',
  'observationSetSha256',
  'orderedObservationIds',
  'provenance'
]);

const PROBE_FIELDS = Object.freeze([
  'probeId',
  'itemVersionId',
  'inputArtifactRef',
  'inputArtifactSha256',
  'expectedContinuationArtifactRef',
  'expectedContinuationSha256',
  'expectedContinuationBase64'
]);

const OBSERVATION_FIELDS = Object.freeze([
  'observationId',
  'probeId',
  'executionId',
  'providerIdentity',
  'conditionIdentity',
  'windowIdentity',
  'occurredAt',
  'exposureLedgerReceiptRef',
  'exposureLedgerReceiptSha256',
  'exposureEventId',
  'inputArtifactRef',
  'inputArtifactSha256',
  'expectedContinuationArtifactRef',
  'expectedContinuationSha256',
  'observedContinuationArtifactRef',
  'observedContinuationSha256',
  'observedContinuationBase64'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  comparisonIdentity: 'exact-byte-equality-over-externally-extracted-continuation-windows',
  probeSpendIdentity: 'first-declared-use-spends-probe',
  observationOrderIdentity: 'externally-declared-complete-observation-order-only',
  interpretationIdentity: 'verbatim-match-is-observation-not-memorization-proof'
});

const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const decodeCanonicalBase64 = (value, path, { allowEmpty = true } = {}) => {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new TypeError(
      `${path} must be ${allowEmpty ? 'a' : 'a non-empty'} canonical base64 string.`
    );
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) {
    throw new TypeError(`${path} must be canonical base64.`);
  }
  return decoded;
};

export const hashMemorizationProbeData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'memorization-probe hash input'))
);

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'memorization-probe plan');
  assertNonemptyText(plan.analysisId, 'memorization-probe plan.analysisId');
  Object.entries(EXPECTED_IDENTITIES).forEach(([field, expected]) => {
    if (plan[field] !== expected) {
      throw new TypeError(
        `memorization-probe plan.${field} must be ${expected}.`
      );
    }
  });
  for (const field of [
    'extractionMethodRef',
    'probeSetSourceRef',
    'observationSetSourceRef'
  ]) {
    assertNonemptyText(plan[field], `memorization-probe plan.${field}`);
  }
  for (const field of [
    'extractionMethodSha256',
    'probeSetSha256',
    'observationSetSha256'
  ]) {
    assertSha256(plan[field], `memorization-probe plan.${field}`);
  }
  assertUniqueTextArray(
    plan.orderedObservationIds,
    'memorization-probe plan.orderedObservationIds',
    { allowEmpty: true }
  );
  assertJsonRecord(plan.provenance, 'memorization-probe plan.provenance');
};

const normalizeProbes = (probes) => {
  if (!Array.isArray(probes)) {
    throw new TypeError('memorization probes must be an array.');
  }
  const probeIds = [];
  const idsByDefinition = new Map();
  const normalized = probes.map((probe, index) => {
    const path = `memorization probes[${index}]`;
    assertExactFields(probe, PROBE_FIELDS, path);
    for (const field of [
      'probeId',
      'itemVersionId',
      'inputArtifactRef',
      'expectedContinuationArtifactRef'
    ]) {
      assertNonemptyText(probe[field], `${path}.${field}`);
    }
    for (const field of [
      'inputArtifactSha256',
      'expectedContinuationSha256'
    ]) {
      assertSha256(probe[field], `${path}.${field}`);
    }
    const expectedBytes = decodeCanonicalBase64(
      probe.expectedContinuationBase64,
      `${path}.expectedContinuationBase64`,
      { allowEmpty: false }
    );
    if (sha256Bytes(expectedBytes) !== probe.expectedContinuationSha256) {
      throw new TypeError(
        `${path}.expectedContinuationBase64 does not match expectedContinuationSha256.`
      );
    }
    const definition = JSON.stringify([
      probe.itemVersionId,
      probe.inputArtifactRef,
      probe.inputArtifactSha256,
      probe.expectedContinuationArtifactRef,
      probe.expectedContinuationSha256
    ]);
    const existingId = idsByDefinition.get(definition);
    if (existingId && existingId !== probe.probeId) {
      throw new TypeError(
        'memorization probe definitions must use exactly one probeId.'
      );
    }
    idsByDefinition.set(definition, probe.probeId);
    probeIds.push(probe.probeId);
    return copyJsonData(probe, path);
  });
  if (new Set(probeIds).size !== probeIds.length) {
    throw new TypeError('memorization probes must use unique probeId values.');
  }
  return normalized;
};

const normalizeObservations = (observations, probesById) => {
  if (!Array.isArray(observations)) {
    throw new TypeError('memorization-probe observations must be an array.');
  }
  const observationIds = [];
  const semanticCoordinates = [];
  const normalized = observations.map((observation, index) => {
    const path = `memorization-probe observations[${index}]`;
    assertExactFields(observation, OBSERVATION_FIELDS, path);
    for (const field of [
      'observationId',
      'probeId',
      'executionId',
      'providerIdentity',
      'conditionIdentity',
      'windowIdentity',
      'occurredAt',
      'exposureLedgerReceiptRef',
      'exposureEventId',
      'inputArtifactRef',
      'expectedContinuationArtifactRef',
      'observedContinuationArtifactRef'
    ]) {
      assertNonemptyText(observation[field], `${path}.${field}`);
    }
    for (const field of [
      'exposureLedgerReceiptSha256',
      'inputArtifactSha256',
      'expectedContinuationSha256',
      'observedContinuationSha256'
    ]) {
      assertSha256(observation[field], `${path}.${field}`);
    }
    const probe = probesById.get(observation.probeId);
    if (!probe) {
      throw new TypeError(`${path}.probeId must name a declared probe.`);
    }
    for (const field of [
      'inputArtifactRef',
      'inputArtifactSha256',
      'expectedContinuationArtifactRef',
      'expectedContinuationSha256'
    ]) {
      if (observation[field] !== probe[field]) {
        throw new TypeError(`${path}.${field} must match its probe definition.`);
      }
    }
    const observedBytes = decodeCanonicalBase64(
      observation.observedContinuationBase64,
      `${path}.observedContinuationBase64`
    );
    if (sha256Bytes(observedBytes) !== observation.observedContinuationSha256) {
      throw new TypeError(
        `${path}.observedContinuationBase64 does not match observedContinuationSha256.`
      );
    }
    observationIds.push(observation.observationId);
    semanticCoordinates.push(JSON.stringify([
      probe.itemVersionId,
      probe.inputArtifactRef,
      probe.inputArtifactSha256,
      probe.expectedContinuationArtifactRef,
      probe.expectedContinuationSha256,
      observation.providerIdentity,
      observation.conditionIdentity,
      observation.windowIdentity,
      observation.exposureLedgerReceiptRef,
      observation.exposureLedgerReceiptSha256,
      observation.observedContinuationArtifactRef,
      observation.observedContinuationSha256
    ]));
    return copyJsonData(observation, path);
  });
  if (new Set(observationIds).size !== observationIds.length) {
    throw new TypeError(
      'memorization-probe observations must use unique observationId values.'
    );
  }
  if (new Set(semanticCoordinates).size !== semanticCoordinates.length) {
    throw new TypeError(
      'memorization-probe observations must not relabel duplicate evidence.'
    );
  }
  return normalized;
};

const deriveObservationEvidence = (observation, probe) => {
  const expectedBytes = Buffer.from(probe.expectedContinuationBase64, 'base64');
  const observedBytes = Buffer.from(
    observation.observedContinuationBase64,
    'base64'
  );
  const exactVerbatimMatch = expectedBytes.equals(observedBytes);
  return {
    observationId: observation.observationId,
    probeId: observation.probeId,
    executionId: observation.executionId,
    providerIdentity: observation.providerIdentity,
    conditionIdentity: observation.conditionIdentity,
    windowIdentity: observation.windowIdentity,
    occurredAt: observation.occurredAt,
    exposureLedgerReceiptRef: observation.exposureLedgerReceiptRef,
    exposureLedgerReceiptSha256: observation.exposureLedgerReceiptSha256,
    exposureEventId: observation.exposureEventId,
    inputArtifactRef: observation.inputArtifactRef,
    inputArtifactSha256: observation.inputArtifactSha256,
    expectedContinuationArtifactRef:
      observation.expectedContinuationArtifactRef,
    expectedContinuationSha256: observation.expectedContinuationSha256,
    observedContinuationArtifactRef:
      observation.observedContinuationArtifactRef,
    observedContinuationSha256: observation.observedContinuationSha256,
    expectedContinuationByteLength: expectedBytes.length,
    observedContinuationByteLength: observedBytes.length,
    exactVerbatimMatch,
    evidenceLabel: exactVerbatimMatch
      ? 'exact-verbatim-continuation-match-observed'
      : 'no-exact-verbatim-continuation-match-observed',
    sourceObservationSha256: sha256CanonicalJson(observation)
  };
};

export const createMemorizationProbeReceipt = ({
  plan,
  probes,
  observations
}) => {
  const planCopy = copyJsonData(plan, 'memorization-probe plan');
  validatePlan(planCopy);
  const normalizedProbes = normalizeProbes(probes);
  const probesById = new Map(normalizedProbes.map((probe) => [
    probe.probeId,
    probe
  ]));
  const normalizedObservations = normalizeObservations(
    observations,
    probesById
  );
  if (sha256CanonicalJson(normalizedProbes) !== planCopy.probeSetSha256) {
    throw new TypeError(
      'memorization probes do not match their declared SHA-256.'
    );
  }
  if (
    sha256CanonicalJson(normalizedObservations)
    !== planCopy.observationSetSha256
  ) {
    throw new TypeError(
      'memorization-probe observations do not match their declared SHA-256.'
    );
  }
  const observationIds = normalizedObservations.map(
    ({ observationId }) => observationId
  );
  if (!sameTextSet(planCopy.orderedObservationIds, observationIds)) {
    throw new TypeError(
      'memorization-probe orderedObservationIds must exactly cover observations.'
    );
  }
  const observationsById = new Map(normalizedObservations.map((observation) => [
    observation.observationId,
    observation
  ]));
  const orderedObservations = planCopy.orderedObservationIds.map(
    (observationId) => observationsById.get(observationId)
  );
  const firstUseByProbeId = new Map();
  for (const observation of orderedObservations) {
    if (!firstUseByProbeId.has(observation.probeId)) {
      firstUseByProbeId.set(observation.probeId, observation);
    }
  }
  const observationEvidence = orderedObservations.map((observation) => (
    deriveObservationEvidence(observation, probesById.get(observation.probeId))
  ));
  const probeLifecycle = normalizedProbes.map((probe) => {
    const firstUse = firstUseByProbeId.get(probe.probeId);
    return {
      probeId: probe.probeId,
      itemVersionId: probe.itemVersionId,
      lifecycleStatus: firstUse
        ? 'spent-exposed-by-declared-first-use'
        : 'unspent-in-declared-observation-set',
      firstUse: firstUse ? {
        observationId: firstUse.observationId,
        providerIdentity: firstUse.providerIdentity,
        occurredAt: firstUse.occurredAt,
        exposureEventId: firstUse.exposureEventId,
        exposureLedgerReceiptRef: firstUse.exposureLedgerReceiptRef,
        exposureLedgerReceiptSha256: firstUse.exposureLedgerReceiptSha256
      } : null
    };
  });
  const body = {
    schemaVersion: 1,
    plan: planCopy,
    probeSetSha256: sha256CanonicalJson(normalizedProbes),
    observationSetSha256: sha256CanonicalJson(normalizedObservations),
    probeCount: normalizedProbes.length,
    observationCount: observationEvidence.length,
    exactVerbatimMatchCount: observationEvidence.filter(
      ({ exactVerbatimMatch }) => exactVerbatimMatch
    ).length,
    probeLifecycle,
    observationEvidence
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
