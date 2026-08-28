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

export const BENCHMARK_STAGE_DEFINITIONS = Object.freeze({
  D0: Object.freeze({
    stageIdentity: 'development-contract-validation',
    claimBoundaryIdentity:
      'validity-and-typed-failure-outcomes-only-no-linguistic-adequacy-claims'
  }),
  D1: Object.freeze({
    stageIdentity: 'expert-recruitment',
    claimBoundaryIdentity: 'no-adjudicated-release-claims'
  }),
  D2: Object.freeze({
    stageIdentity: 'expert-calibration',
    claimBoundaryIdentity:
      'descriptive-calibration-only-no-adjudicated-release-claims'
  }),
  D3: Object.freeze({
    stageIdentity: 'adjudicated-release',
    claimBoundaryIdentity:
      'claim-scope-requires-separate-bm13-release-bundle'
  })
});

const PLAN_FIELDS = Object.freeze([
  'stageRecordId',
  'stageId',
  'stageIdentity',
  'claimBoundaryIdentity',
  'evidenceIdentity',
  'evidenceSetSha256',
  'provenance'
]);

const EVIDENCE_FIELDS = Object.freeze([
  'evidenceId',
  'stageId',
  'evidenceRole',
  'evidenceRef',
  'evidenceSha256',
  'authorityRef',
  'observedAt',
  'provenance'
]);

const EVIDENCE_IDENTITY =
  'external-stage-evidence-does-not-authorize-release-or-publication';

const compareEvidenceIds = (left, right) => {
  if (left.evidenceId < right.evidenceId) return -1;
  if (left.evidenceId > right.evidenceId) return 1;
  return 0;
};

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

export const hashBenchmarkStageData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'benchmark-stage hash input'))
);

export const hashBenchmarkStageEvidence = (rawEvidence) => {
  const evidence = copyJsonData(
    rawEvidence,
    'benchmark-stage evidence hash input'
  );
  if (!Array.isArray(evidence)) {
    throw new TypeError(
      'benchmark-stage evidence hash input must be an array.'
    );
  }
  evidence.forEach((record, index) => {
    const path = `benchmark-stage evidence hash input[${index}]`;
    assertJsonRecord(record, path);
    assertNonemptyText(record.evidenceId, `${path}.evidenceId`);
  });
  return hashBenchmarkStageData(
    [...evidence].sort(compareEvidenceIds)
  );
};

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'benchmark-stage plan');
  assertExactFields(plan, PLAN_FIELDS, 'benchmark-stage plan');
  assertNonemptyText(plan.stageRecordId, 'benchmark-stage plan.stageRecordId');
  assertNonemptyText(plan.stageId, 'benchmark-stage plan.stageId');
  if (!Object.hasOwn(BENCHMARK_STAGE_DEFINITIONS, plan.stageId)) {
    throw new TypeError('benchmark-stage plan.stageId must be one of D0,D1,D2,D3.');
  }
  const definition = BENCHMARK_STAGE_DEFINITIONS[plan.stageId];
  for (const field of ['stageIdentity', 'claimBoundaryIdentity']) {
    if (plan[field] !== definition[field]) {
      throw new TypeError(
        `benchmark-stage plan.${field} must match ${plan.stageId}.`
      );
    }
  }
  if (plan.evidenceIdentity !== EVIDENCE_IDENTITY) {
    throw new TypeError(
      `benchmark-stage plan.evidenceIdentity must be ${EVIDENCE_IDENTITY}.`
    );
  }
  assertSha256(
    plan.evidenceSetSha256,
    'benchmark-stage plan.evidenceSetSha256'
  );
  assertJsonRecord(plan.provenance, 'benchmark-stage plan.provenance');
  return plan;
};

const normalizeEvidence = (rawEvidence, plan) => {
  if (!Array.isArray(rawEvidence) || rawEvidence.length === 0) {
    throw new TypeError(
      'benchmark-stage evidence must be a non-empty array.'
    );
  }
  const evidence = rawEvidence.map((rawRecord, index) => {
    const path = `benchmark-stage evidence[${index}]`;
    const record = copyJsonData(rawRecord, path);
    assertExactFields(record, EVIDENCE_FIELDS, path);
    for (const field of [
      'evidenceId',
      'stageId',
      'evidenceRole',
      'evidenceRef',
      'authorityRef',
      'observedAt'
    ]) {
      assertNonemptyText(record[field], `${path}.${field}`);
    }
    assertSha256(record.evidenceSha256, `${path}.evidenceSha256`);
    assertJsonRecord(record.provenance, `${path}.provenance`);
    if (record.stageId !== plan.stageId) {
      throw new TypeError(`${path}.stageId must match the plan stage.`);
    }
    return record;
  });

  const evidenceIds = evidence.map(({ evidenceId }) => evidenceId);
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new TypeError('benchmark-stage evidence IDs must be unique.');
  }
  const substantiveDefinitions = evidence.map(({
    evidenceId: _evidenceId,
    ...definition
  }) => hashBenchmarkStageData(definition));
  if (new Set(substantiveDefinitions).size !== substantiveDefinitions.length) {
    throw new TypeError(
      'benchmark-stage evidence substantive definitions must be unique.'
    );
  }

  const orderedEvidence = [...evidence].sort(compareEvidenceIds);
  if (
    hashBenchmarkStageEvidence(orderedEvidence)
    !== plan.evidenceSetSha256
  ) {
    throw new TypeError(
      'benchmark-stage evidence does not match its source SHA-256.'
    );
  }
  return orderedEvidence;
};

export const createBenchmarkStageReceipt = ({
  plan: rawPlan,
  evidence: rawEvidence
}) => {
  const plan = normalizePlan(rawPlan);
  const evidence = normalizeEvidence(rawEvidence, plan);
  const definition = BENCHMARK_STAGE_DEFINITIONS[plan.stageId];

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W16a-benchmark-stage-evidence-label',
    stageRecordId: plan.stageRecordId,
    stageId: plan.stageId,
    stageIdentity: definition.stageIdentity,
    claimBoundaryIdentity: definition.claimBoundaryIdentity,
    evidenceIdentity: plan.evidenceIdentity,
    evidenceSetSha256: plan.evidenceSetSha256,
    evidenceCount: evidence.length,
    evidence,
    stageTreatment:
      'externally-evidenced-label-no-readiness-release-or-publication-inference',
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
