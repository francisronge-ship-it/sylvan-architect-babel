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
  'analysisId',
  'matchingIdentity',
  'windowOrderIdentity',
  'windowOrderSourceRef',
  'gapIdentity',
  'wideningIdentity',
  'wideningMethodSourceRef',
  'interpretationIdentity',
  'recordSetSourceRef',
  'recordSetSha256',
  'provenance'
]);

const RECORD_FIELDS = Object.freeze([
  'comparisonId',
  'twinPairId',
  'providerIdentity',
  'fromConditionIdentity',
  'toConditionIdentity',
  'outcomeIdentity',
  'outcomeEvidenceRef',
  'outcomeEvidenceSha256',
  'anchorItemVersionId',
  'twinItemVersionId',
  'fromWindowId',
  'toWindowId',
  'fromAnchorRunId',
  'fromAnchorRunSha256',
  'fromAnchorValue',
  'fromTwinRunId',
  'fromTwinRunSha256',
  'fromTwinValue',
  'toAnchorRunId',
  'toAnchorRunSha256',
  'toAnchorValue',
  'toTwinRunId',
  'toTwinRunSha256',
  'toTwinValue',
  'exposureLedgerReceiptRef',
  'exposureLedgerReceiptSha256',
  'anchorExposureEventId',
  'twinNonExposureEvidenceRef',
  'twinNonExposureEvidenceSha256',
  'matchingEvidenceRef',
  'matchingEvidenceSha256'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  matchingIdentity: 'externally-matched-exposed-anchor-and-unexposed-twin',
  windowOrderIdentity: 'externally-declared-from-window-before-to-window',
  gapIdentity: 'signed-anchor-value-minus-twin-value',
  wideningIdentity: 'increasing-absolute-gap-magnitude',
  interpretationIdentity: 'widening-gap-is-evidence-never-proof'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const assertFiniteNumber = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number.`);
  }
};

export const hashTwinGapData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'twin-gap hash input'))
);

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'twin-gap plan');
  assertNonemptyText(plan.analysisId, 'twin-gap plan.analysisId');
  Object.entries(EXPECTED_IDENTITIES).forEach(([field, expected]) => {
    if (plan[field] !== expected) {
      throw new TypeError(`twin-gap plan.${field} must be ${expected}.`);
    }
  });
  for (const field of ['windowOrderSourceRef', 'wideningMethodSourceRef']) {
    assertNonemptyText(plan[field], `twin-gap plan.${field}`);
  }
  assertNonemptyText(
    plan.recordSetSourceRef,
    'twin-gap plan.recordSetSourceRef'
  );
  assertSha256(plan.recordSetSha256, 'twin-gap plan.recordSetSha256');
  assertJsonRecord(plan.provenance, 'twin-gap plan.provenance');
};

const normalizeRecords = (records) => {
  if (!Array.isArray(records)) {
    throw new TypeError('twin-gap records must be an array.');
  }
  const coordinates = [];
  const semanticCoordinates = [];
  const pairDefinitions = new Map();
  const pairIdsByDefinition = new Map();
  const normalized = records.map((record, index) => {
    const path = `twin-gap records[${index}]`;
    assertExactFields(record, RECORD_FIELDS, path);
    for (const field of [
      'comparisonId',
      'twinPairId',
      'providerIdentity',
      'fromConditionIdentity',
      'toConditionIdentity',
      'outcomeIdentity',
      'outcomeEvidenceRef',
      'anchorItemVersionId',
      'twinItemVersionId',
      'fromWindowId',
      'toWindowId',
      'fromAnchorRunId',
      'fromTwinRunId',
      'toAnchorRunId',
      'toTwinRunId',
      'exposureLedgerReceiptRef',
      'anchorExposureEventId',
      'twinNonExposureEvidenceRef',
      'matchingEvidenceRef'
    ]) {
      assertNonemptyText(record[field], `${path}.${field}`);
    }
    for (const field of [
      'fromAnchorRunSha256',
      'fromTwinRunSha256',
      'toAnchorRunSha256',
      'toTwinRunSha256',
      'outcomeEvidenceSha256',
      'exposureLedgerReceiptSha256',
      'twinNonExposureEvidenceSha256',
      'matchingEvidenceSha256'
    ]) {
      assertSha256(record[field], `${path}.${field}`);
    }
    for (const field of [
      'fromAnchorValue',
      'fromTwinValue',
      'toAnchorValue',
      'toTwinValue'
    ]) {
      assertFiniteNumber(record[field], `${path}.${field}`);
    }
    if (record.anchorItemVersionId === record.twinItemVersionId) {
      throw new TypeError(`${path} must name distinct anchor and twin item versions.`);
    }
    if (record.fromWindowId === record.toWindowId) {
      throw new TypeError(`${path} must compare distinct windows.`);
    }
    const runIds = [
      record.fromAnchorRunId,
      record.fromTwinRunId,
      record.toAnchorRunId,
      record.toTwinRunId
    ];
    if (new Set(runIds).size !== runIds.length) {
      throw new TypeError(`${path} must bind four distinct runs.`);
    }
    coordinates.push(JSON.stringify([
      record.comparisonId,
      record.twinPairId
    ]));
    semanticCoordinates.push(JSON.stringify([
      record.twinPairId,
      record.providerIdentity,
      record.fromConditionIdentity,
      record.toConditionIdentity,
      record.outcomeIdentity,
      record.fromWindowId,
      record.toWindowId
    ]));
    const pairDefinition = JSON.stringify([
      record.anchorItemVersionId,
      record.twinItemVersionId,
      record.matchingEvidenceRef,
      record.matchingEvidenceSha256
    ]);
    const previousDefinition = pairDefinitions.get(record.twinPairId);
    if (previousDefinition && previousDefinition !== pairDefinition) {
      throw new TypeError(
        `twin-gap twinPairId=${record.twinPairId} must retain one pair definition.`
      );
    }
    const previousPairId = pairIdsByDefinition.get(pairDefinition);
    if (previousPairId && previousPairId !== record.twinPairId) {
      throw new TypeError(
        'twin-gap pair definitions must use exactly one twinPairId.'
      );
    }
    pairDefinitions.set(record.twinPairId, pairDefinition);
    pairIdsByDefinition.set(pairDefinition, record.twinPairId);
    return copyJsonData(record, path);
  });
  if (new Set(coordinates).size !== coordinates.length) {
    throw new TypeError(
      'twin-gap records must use unique comparisonId/twinPairId coordinates.'
    );
  }
  if (new Set(semanticCoordinates).size !== semanticCoordinates.length) {
    throw new TypeError(
      'twin-gap records must not duplicate a pair/provider/condition/outcome/window comparison.'
    );
  }
  return normalized;
};

const deriveTwinGapRecord = (record) => {
  const fromSignedGap = record.fromAnchorValue - record.fromTwinValue;
  const toSignedGap = record.toAnchorValue - record.toTwinValue;
  const fromGapMagnitude = Math.abs(fromSignedGap);
  const toGapMagnitude = Math.abs(toSignedGap);
  const gapMagnitudeChange = toGapMagnitude - fromGapMagnitude;
  for (const [field, value] of Object.entries({
    fromSignedGap,
    toSignedGap,
    fromGapMagnitude,
    toGapMagnitude,
    gapMagnitudeChange
  })) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`twin-gap ${field} must remain finite.`);
    }
  }
  return {
    comparisonId: record.comparisonId,
    twinPairId: record.twinPairId,
    providerIdentity: record.providerIdentity,
    fromConditionIdentity: record.fromConditionIdentity,
    toConditionIdentity: record.toConditionIdentity,
    outcomeIdentity: record.outcomeIdentity,
    anchorItemVersionId: record.anchorItemVersionId,
    twinItemVersionId: record.twinItemVersionId,
    fromWindowId: record.fromWindowId,
    toWindowId: record.toWindowId,
    fromSignedGap,
    toSignedGap,
    fromGapMagnitude,
    toGapMagnitude,
    gapMagnitudeChange,
    evidenceLabel: gapMagnitudeChange > 0
      ? 'widening-evidence-not-proof'
      : 'not-widening',
    sourceRecordSha256: sha256CanonicalJson(record)
  };
};

export const createTwinGapReceipt = ({ plan, records }) => {
  const planCopy = copyJsonData(plan, 'twin-gap plan');
  validatePlan(planCopy);
  const normalizedRecords = normalizeRecords(records);
  if (sha256CanonicalJson(normalizedRecords) !== planCopy.recordSetSha256) {
    throw new TypeError(
      'twin-gap records do not match their declared SHA-256.'
    );
  }
  const pairComparisons = normalizedRecords.map(deriveTwinGapRecord);
  const body = {
    schemaVersion: 1,
    plan: planCopy,
    recordSetSha256: sha256CanonicalJson(normalizedRecords),
    comparisonCount: pairComparisons.length,
    wideningEvidenceCount: pairComparisons.filter(
      ({ evidenceLabel }) => evidenceLabel === 'widening-evidence-not-proof'
    ).length,
    pairComparisons
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
