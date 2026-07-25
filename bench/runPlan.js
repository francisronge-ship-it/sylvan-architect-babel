import {
  copyJsonData,
  freezeJsonData,
  isPlainRecord
} from './jsonData.js';

const RUN_PLAN_FIELDS = Object.freeze([
  'runId',
  'itemRef',
  'condition',
  'factorAssignments',
  'requestConfig',
  'provenance'
]);

const CONDITION_IDENTITY_FIELDS = Object.freeze([
  'conditionId',
  'providerIdentity',
  'modelIdentity',
  'reasoningIdentity',
  'carrierIdentity',
  'frameworkIdentity',
  'partitionIdentity'
]);

const assertNonemptyText = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
};

export const createBenchmarkRunPlan = (input) => {
  if (!isPlainRecord(input)) throw new TypeError('run plan must be an object.');
  const unexpected = Object.keys(input).filter((field) => !RUN_PLAN_FIELDS.includes(field));
  const missing = RUN_PLAN_FIELDS.filter((field) => !Object.hasOwn(input, field));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new TypeError(
      `run plan fields must be exact; missing=[${missing.join(',')}], extra=[${unexpected.join(',')}].`
    );
  }

  assertNonemptyText(input.runId, 'runId');
  assertNonemptyText(input.itemRef, 'itemRef');
  if (!isPlainRecord(input.condition)) throw new TypeError('condition must be an object.');
  CONDITION_IDENTITY_FIELDS.forEach((field) => {
    assertNonemptyText(input.condition[field], `condition.${field}`);
  });
  if (!isPlainRecord(input.factorAssignments)) {
    throw new TypeError('factorAssignments must be an object.');
  }
  if (!isPlainRecord(input.requestConfig)) {
    throw new TypeError('requestConfig must be an object.');
  }
  if (!isPlainRecord(input.provenance)) {
    throw new TypeError('provenance must be an object.');
  }

  return freezeJsonData(copyJsonData(input));
};
