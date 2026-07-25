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
  assertTextChoice,
  assertUniqueTextArray,
  sameTextSet
} from './benchmarkValidation.js';
import { validateConditionMatrix } from './conditionMatrix.js';

const DESIGN_FIELDS = Object.freeze([
  'designRef',
  'designSha256',
  'partition',
  'conditionIds',
  'itemReruns',
  'provenance'
]);

const SCHEDULE_FIELDS = Object.freeze([
  'schemaVersion',
  'design',
  'manifestSha256',
  'conditionsSha256',
  'entries',
  'scheduleSha256'
]);

const SCHEDULE_ENTRY_FIELDS = Object.freeze([
  'schemaVersion',
  'designSha256',
  'conditionsSha256',
  'condition',
  'itemRef',
  'rerunIndex',
  'runId'
]);

const RUN_CONDITION_FIELDS = Object.freeze([
  'conditionId',
  'providerIdentity',
  'modelIdentity',
  'reasoningIdentity',
  'carrierIdentity',
  'frameworkIdentity',
  'partitionIdentity'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertDigest = (value, path) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest.`);
  }
};

const validateDesign = (design) => {
  assertExactFields(design, DESIGN_FIELDS, 'run design');
  assertNonemptyText(design.designRef, 'run design.designRef');
  assertDigest(design.designSha256, 'run design.designSha256');
  assertTextChoice(
    design.partition,
    ['native', 'recovered', 'variant'],
    'run design.partition'
  );
  assertUniqueTextArray(design.conditionIds, 'run design.conditionIds');
  assertJsonRecord(design.provenance, 'run design.provenance');
  if (!Array.isArray(design.itemReruns) || design.itemReruns.length === 0) {
    throw new TypeError('run design.itemReruns must be a non-empty array.');
  }
  design.itemReruns.forEach((item, index) => {
    const path = `run design.itemReruns[${index}]`;
    assertExactFields(item, ['itemRef', 'reruns'], path);
    assertNonemptyText(item.itemRef, `${path}.itemRef`);
    if (!Number.isSafeInteger(item.reruns) || item.reruns < 1) {
      throw new TypeError(`${path}.reruns must be a positive safe integer.`);
    }
  });
  const itemRefs = design.itemReruns.map((item) => item.itemRef);
  if (new Set(itemRefs).size !== itemRefs.length) {
    throw new TypeError('run design.itemReruns must have unique itemRef values.');
  }
};

const createRunId = (identity) => `run:${sha256CanonicalJson(identity)}`;

const createRunCondition = (condition, partitionIdentity) => freezeJsonData({
  conditionId: condition.conditionId,
  providerIdentity: condition.providerIdentity,
  modelIdentity: condition.modelIdentity,
  reasoningIdentity: condition.nativeTier,
  carrierIdentity: condition.carrierIdentity,
  frameworkIdentity: condition.frameworkIdentity,
  partitionIdentity
});

const buildEntries = ({ design, conditionsSha256, conditionById }) => (
  design.conditionIds.flatMap((conditionId) => (
    design.itemReruns.flatMap(({ itemRef, reruns }) => (
      Array.from({ length: reruns }, (_unused, index) => {
        const condition = conditionById.get(conditionId);
        const identity = {
          designSha256: design.designSha256,
          conditionsSha256,
          condition,
          itemRef,
          rerunIndex: index + 1
        };
        return freezeJsonData({
          schemaVersion: 1,
          ...identity,
          runId: createRunId(identity)
        });
      })
    ))
  ))
);

const validateScheduleCondition = (condition, path) => {
  assertExactFields(condition, RUN_CONDITION_FIELDS, path);
  RUN_CONDITION_FIELDS.forEach((field) => {
    assertNonemptyText(condition[field], `${path}.${field}`);
  });
  assertTextChoice(
    condition.partitionIdentity,
    ['native', 'recovered', 'variant'],
    `${path}.partitionIdentity`
  );
};

const validateScheduleEntry = (entry, index) => {
  const path = `run schedule.entries[${index}]`;
  assertExactFields(entry, SCHEDULE_ENTRY_FIELDS, path);
  if (entry.schemaVersion !== 1) {
    throw new TypeError(`${path}.schemaVersion must be 1.`);
  }
  assertDigest(entry.designSha256, `${path}.designSha256`);
  assertDigest(entry.conditionsSha256, `${path}.conditionsSha256`);
  validateScheduleCondition(entry.condition, `${path}.condition`);
  ['itemRef', 'runId'].forEach((field) => {
    assertNonemptyText(entry[field], `${path}.${field}`);
  });
  if (!Number.isSafeInteger(entry.rerunIndex) || entry.rerunIndex < 1) {
    throw new TypeError(`${path}.rerunIndex must be a positive safe integer.`);
  }
  const { schemaVersion: _schemaVersion, runId, ...identity } = entry;
  if (createRunId(identity) !== runId) {
    throw new TypeError(`${path}.runId does not match its schedule identity.`);
  }
};

export const buildRunSchedule = ({ frozenManifest, conditionMatrix, design }) => {
  const matrix = validateConditionMatrix({ frozenManifest, conditionMatrix });
  validateDesign(design);
  if (!sameTextSet(
    design.conditionIds,
    matrix.conditions.map((condition) => condition.conditionId)
  )) {
    throw new TypeError(
      'run design.conditionIds must exactly cover the supplied condition matrix.'
    );
  }
  const entries = buildEntries({
    design,
    conditionsSha256: matrix.matrixSha256,
    conditionById: new Map(matrix.conditions.map((condition) => [
      condition.conditionId,
      createRunCondition(condition, design.partition)
    ]))
  });
  const body = {
    schemaVersion: 1,
    design: copyJsonData(design, 'run design'),
    manifestSha256: matrix.manifestSha256,
    conditionsSha256: matrix.matrixSha256,
    entries
  };
  return freezeJsonData({
    ...body,
    scheduleSha256: sha256CanonicalJson(body)
  });
};

export const validateRunSchedule = (schedule) => {
  assertExactFields(schedule, SCHEDULE_FIELDS, 'run schedule');
  if (schedule.schemaVersion !== 1) {
    throw new TypeError('run schedule.schemaVersion must be 1.');
  }
  assertDigest(schedule.manifestSha256, 'run schedule.manifestSha256');
  assertDigest(schedule.conditionsSha256, 'run schedule.conditionsSha256');
  assertDigest(schedule.scheduleSha256, 'run schedule.scheduleSha256');
  validateDesign(schedule.design);
  if (!Array.isArray(schedule.entries) || schedule.entries.length === 0) {
    throw new TypeError('run schedule.entries must be a non-empty array.');
  }
  schedule.entries.forEach(validateScheduleEntry);
  const runIds = schedule.entries.map((entry) => entry.runId);
  if (new Set(runIds).size !== runIds.length) {
    throw new TypeError('run schedule.entries must have unique runId values.');
  }
  const conditionById = new Map();
  schedule.entries.forEach((entry) => {
    const conditionId = entry.condition.conditionId;
    const existing = conditionById.get(conditionId);
    if (
      existing
      && JSON.stringify(canonicalizeJsonData(existing))
        !== JSON.stringify(canonicalizeJsonData(entry.condition))
    ) {
      throw new TypeError(
        `run schedule conditionId=${conditionId} has conflicting identities.`
      );
    }
    conditionById.set(conditionId, entry.condition);
  });
  if (!sameTextSet(schedule.design.conditionIds, [...conditionById.keys()])) {
    throw new TypeError(
      'run schedule entries must cover exactly the designed condition IDs.'
    );
  }
  const expectedEntries = buildEntries({
    design: schedule.design,
    conditionsSha256: schedule.conditionsSha256,
    conditionById
  });
  if (
    JSON.stringify(canonicalizeJsonData(expectedEntries))
    !== JSON.stringify(canonicalizeJsonData(schedule.entries))
  ) {
    throw new TypeError('run schedule entries do not match its external design.');
  }
  const { scheduleSha256, ...body } = schedule;
  if (sha256CanonicalJson(body) !== scheduleSha256) {
    throw new TypeError('run schedule hash does not match its content.');
  }
  return freezeJsonData(copyJsonData(schedule, 'run schedule'));
};
