import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData,
  isPlainRecord
} from './jsonData.js';
import {
  assertExactFields,
  assertNonemptyText
} from './benchmarkValidation.js';
import { createBenchmarkRunPlan } from './runPlan.js';
import { validateRunSchedule } from './runSchedule.js';

const RECEIPT_FIELDS = Object.freeze([
  'schemaVersion',
  'runPlan',
  'transport',
  'rawOutputArtifact',
  'parse',
  'compile',
  'outcome',
  'receiptSha256'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertDigest = (value, path) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest.`);
  }
};

const validateRunReceipt = (receipt) => {
  assertExactFields(receipt, RECEIPT_FIELDS, 'run receipt');
  if (receipt.schemaVersion !== 1) {
    throw new TypeError('run receipt.schemaVersion must be 1.');
  }
  assertDigest(receipt.receiptSha256, 'run receipt.receiptSha256');
  const { receiptSha256, ...body } = receipt;
  if (sha256CanonicalJson(body) !== receiptSha256) {
    throw new TypeError('run receipt hash does not match its content.');
  }
  const runPlan = createBenchmarkRunPlan(receipt.runPlan);
  if (
    JSON.stringify(canonicalizeJsonData(runPlan))
    !== JSON.stringify(canonicalizeJsonData(receipt.runPlan))
  ) {
    throw new TypeError('run receipt runPlan does not match the canonical run plan.');
  }
  ['transport', 'parse', 'compile', 'outcome'].forEach((field) => {
    if (!isPlainRecord(receipt[field])) {
      throw new TypeError(`run receipt.${field} must be an object.`);
    }
  });
};

export const createRunArchive = ({ schedule, runId, runReceipt }) => {
  const validatedSchedule = validateRunSchedule(schedule);
  assertNonemptyText(runId, 'runId');
  const scheduleEntry = validatedSchedule.entries.find(
    (entry) => entry.runId === runId
  );
  if (!scheduleEntry) {
    throw new TypeError('runId must identify an entry in the verified run schedule.');
  }
  validateRunReceipt(runReceipt);
  const expected = {
    runId: scheduleEntry.runId,
    itemRef: scheduleEntry.itemRef,
    ...scheduleEntry.condition
  };
  const observed = {
    runId: runReceipt.runPlan.runId,
    itemRef: runReceipt.runPlan.itemRef,
    ...runReceipt.runPlan.condition
  };
  Object.entries(expected).forEach(([field, value]) => {
    if (observed[field] !== value) {
      throw new TypeError(`run receipt ${field} does not match its schedule entry.`);
    }
  });

  const body = {
    schemaVersion: 1,
    scheduleSha256: validatedSchedule.scheduleSha256,
    scheduleEntry: copyJsonData(scheduleEntry, 'schedule entry'),
    runReceipt: copyJsonData(runReceipt, 'run receipt')
  };
  return freezeJsonData({
    ...body,
    archiveSha256: sha256CanonicalJson(body)
  });
};
