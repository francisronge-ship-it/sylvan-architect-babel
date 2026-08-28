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
  'queueSnapshotId',
  'growthIdentity',
  'orderingIdentity',
  'reviewEvidenceIdentity',
  'activationIdentity',
  'priorEntrySetSourceRef',
  'priorEntrySetSha256',
  'currentEntrySetSourceRef',
  'currentEntrySetSha256',
  'priorOrderedIntakeIds',
  'currentOrderedIntakeIds',
  'provenance'
]);

const ENTRY_FIELDS = Object.freeze([
  'intakeId',
  'itemId',
  'itemVersionId',
  'versionNumber',
  'itemArtifactRef',
  'itemArtifactSha256',
  'submissionArtifactRef',
  'submissionArtifactSha256',
  'submittedByIdentity',
  'submittedAt',
  'reviewRecordRef',
  'reviewRecordSha256',
  'reviewAuthorityIdentity',
  'reviewCompletedAt'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  growthIdentity: 'append-only-reviewed-intake-with-record-stable-prior-prefix',
  orderingIdentity: 'externally-declared-complete-intake-order-only',
  reviewEvidenceIdentity: 'externally-supplied-review-record-evidence-only',
  activationIdentity: 'no-release-or-activation-authorization'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const assertPositiveInteger = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${path} must be a positive safe integer.`);
  }
};

const encodeItemVersionCoordinate = (itemId, versionNumber) => (
  JSON.stringify([itemId, versionNumber])
);

export const hashRollingIntakeData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'rolling-intake hash input'))
);

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'rolling-intake plan');
  assertNonemptyText(
    plan.queueSnapshotId,
    'rolling-intake plan.queueSnapshotId'
  );
  Object.entries(EXPECTED_IDENTITIES).forEach(([field, expected]) => {
    if (plan[field] !== expected) {
      throw new TypeError(`rolling-intake plan.${field} must be ${expected}.`);
    }
  });
  for (const field of [
    'priorEntrySetSourceRef',
    'currentEntrySetSourceRef'
  ]) {
    assertNonemptyText(plan[field], `rolling-intake plan.${field}`);
  }
  for (const field of [
    'priorEntrySetSha256',
    'currentEntrySetSha256'
  ]) {
    assertSha256(plan[field], `rolling-intake plan.${field}`);
  }
  assertUniqueTextArray(
    plan.priorOrderedIntakeIds,
    'rolling-intake plan.priorOrderedIntakeIds',
    { allowEmpty: true }
  );
  assertUniqueTextArray(
    plan.currentOrderedIntakeIds,
    'rolling-intake plan.currentOrderedIntakeIds',
    { allowEmpty: true }
  );
  assertJsonRecord(plan.provenance, 'rolling-intake plan.provenance');
};

const normalizeEntries = (entries, path) => {
  if (!Array.isArray(entries)) {
    throw new TypeError(`${path} must be an array.`);
  }
  const intakeIds = [];
  const itemVersionIds = [];
  const itemVersionCoordinates = [];
  const itemArtifactSha256s = [];
  const normalized = entries.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertExactFields(entry, ENTRY_FIELDS, entryPath);
    for (const field of [
      'intakeId',
      'itemId',
      'itemVersionId',
      'itemArtifactRef',
      'submissionArtifactRef',
      'submittedByIdentity',
      'submittedAt',
      'reviewRecordRef',
      'reviewAuthorityIdentity',
      'reviewCompletedAt'
    ]) {
      assertNonemptyText(entry[field], `${entryPath}.${field}`);
    }
    assertPositiveInteger(entry.versionNumber, `${entryPath}.versionNumber`);
    for (const field of [
      'itemArtifactSha256',
      'submissionArtifactSha256',
      'reviewRecordSha256'
    ]) {
      assertSha256(entry[field], `${entryPath}.${field}`);
    }
    intakeIds.push(entry.intakeId);
    itemVersionIds.push(entry.itemVersionId);
    itemArtifactSha256s.push(entry.itemArtifactSha256);
    itemVersionCoordinates.push(encodeItemVersionCoordinate(
      entry.itemId,
      entry.versionNumber
    ));
    return copyJsonData(entry, entryPath);
  });
  if (new Set(intakeIds).size !== intakeIds.length) {
    throw new TypeError(`${path} must use unique intakeId values.`);
  }
  if (new Set(itemVersionIds).size !== itemVersionIds.length) {
    throw new TypeError(`${path} must use unique itemVersionId values.`);
  }
  if (new Set(itemArtifactSha256s).size !== itemArtifactSha256s.length) {
    throw new TypeError(
      `${path} must use one item version identity per exact item artifact.`
    );
  }
  if (
    new Set(itemVersionCoordinates).size
    !== itemVersionCoordinates.length
  ) {
    throw new TypeError(
      `${path} must use unique itemId/versionNumber coordinates.`
    );
  }
  return normalized;
};

const assertSourceBinding = (entries, expectedSha256, path) => {
  if (hashRollingIntakeData(entries) !== expectedSha256) {
    throw new TypeError(`${path} does not match its declared SHA-256.`);
  }
};

const assertOrder = (orderedIds, entries, path) => {
  if (!sameTextSet(
    orderedIds,
    entries.map(({ intakeId }) => intakeId)
  )) {
    throw new TypeError(`${path} must exactly cover its entry set.`);
  }
};

const assertAppendOnly = ({
  priorEntries,
  currentEntries,
  priorOrderedIntakeIds,
  currentOrderedIntakeIds
}) => {
  if (
    priorOrderedIntakeIds.some(
      (intakeId, index) => currentOrderedIntakeIds[index] !== intakeId
    )
  ) {
    throw new TypeError(
      'rolling intake must preserve the complete prior order as a prefix.'
    );
  }
  const currentById = new Map(
    currentEntries.map((entry) => [entry.intakeId, entry])
  );
  for (const priorEntry of priorEntries) {
    const currentEntry = currentById.get(priorEntry.intakeId);
    if (
      !currentEntry
      || sha256CanonicalJson(currentEntry) !== sha256CanonicalJson(priorEntry)
    ) {
      throw new TypeError(
        'rolling intake must preserve every prior candidate record exactly.'
      );
    }
  }
};

export const createRollingIntakeReceipt = ({
  plan: rawPlan,
  priorEntries: rawPriorEntries,
  currentEntries: rawCurrentEntries
}) => {
  const plan = copyJsonData(rawPlan, 'rolling-intake plan');
  validatePlan(plan);
  const priorEntries = normalizeEntries(
    rawPriorEntries,
    'rolling-intake priorEntries'
  );
  const currentEntries = normalizeEntries(
    rawCurrentEntries,
    'rolling-intake currentEntries'
  );
  assertSourceBinding(
    priorEntries,
    plan.priorEntrySetSha256,
    'rolling-intake priorEntries'
  );
  assertSourceBinding(
    currentEntries,
    plan.currentEntrySetSha256,
    'rolling-intake currentEntries'
  );
  assertOrder(
    plan.priorOrderedIntakeIds,
    priorEntries,
    'rolling-intake plan.priorOrderedIntakeIds'
  );
  assertOrder(
    plan.currentOrderedIntakeIds,
    currentEntries,
    'rolling-intake plan.currentOrderedIntakeIds'
  );
  assertAppendOnly({
    priorEntries,
    currentEntries,
    priorOrderedIntakeIds: plan.priorOrderedIntakeIds,
    currentOrderedIntakeIds: plan.currentOrderedIntakeIds
  });
  const currentById = new Map(
    currentEntries.map((entry) => [entry.intakeId, entry])
  );
  const priorIds = new Set(plan.priorOrderedIntakeIds);
  const orderedEntries = plan.currentOrderedIntakeIds.map(
    (intakeId) => currentById.get(intakeId)
  );
  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W13e-f-rolling-reviewed-intake',
    queueSnapshotId: plan.queueSnapshotId,
    growthIdentity: plan.growthIdentity,
    orderingIdentity: plan.orderingIdentity,
    reviewEvidenceIdentity: plan.reviewEvidenceIdentity,
    activationIdentity: plan.activationIdentity,
    priorEntrySetSourceRef: plan.priorEntrySetSourceRef,
    priorEntrySetSha256: plan.priorEntrySetSha256,
    currentEntrySetSourceRef: plan.currentEntrySetSourceRef,
    currentEntrySetSha256: plan.currentEntrySetSha256,
    priorEntryCount: priorEntries.length,
    currentEntryCount: currentEntries.length,
    addedEntryCount: currentEntries.length - priorEntries.length,
    addedIntakeIds: plan.currentOrderedIntakeIds.filter(
      (intakeId) => !priorIds.has(intakeId)
    ),
    queueTreatment:
      'external-review-record-evidence-no-release-or-activation-authorization',
    orderedEntries,
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
