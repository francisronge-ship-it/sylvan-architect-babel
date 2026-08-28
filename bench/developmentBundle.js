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
  assertTextChoice
} from './benchmarkValidation.js';
import { createBenchmarkStageReceipt } from './benchmarkStage.js';
import { BM13_D3_PRECONDITION_IDS } from './releaseBundle.js';
import {
  createReportStarSchemaReceipt,
  REPORT_TABLE_NAMES
} from './reportStarSchema.js';

export const BM13_D0_PRECONDITION_IDS = Object.freeze(
  BM13_D3_PRECONDITION_IDS.slice(0, 5)
);

const PLAN_FIELDS = Object.freeze([
  'bundleId',
  'releaseClass',
  'releaseId',
  'stageReceiptSha256',
  'reportReceiptSha256',
  'preconditionEvidenceSha256',
  'provenance'
]);

const PRECONDITION_FIELDS = Object.freeze([
  'preconditionId',
  'releaseId',
  'stageReceiptSha256',
  'status',
  'evidenceRef',
  'evidenceSha256',
  'authorityRef'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const canonicalJsonEqual = (left, right) => (
  JSON.stringify(canonicalizeJsonData(left))
  === JSON.stringify(canonicalizeJsonData(right))
);

export const hashDevelopmentBundleData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'development-bundle hash input'))
);

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'development-bundle plan');
  assertExactFields(plan, PLAN_FIELDS, 'development-bundle plan');
  assertNonemptyText(plan.bundleId, 'development-bundle plan.bundleId');
  assertTextChoice(
    plan.releaseClass,
    ['D0-development-grade'],
    'development-bundle plan.releaseClass'
  );
  assertNonemptyText(plan.releaseId, 'development-bundle plan.releaseId');
  for (const field of [
    'stageReceiptSha256',
    'reportReceiptSha256',
    'preconditionEvidenceSha256'
  ]) {
    assertSha256(plan[field], `development-bundle plan.${field}`);
  }
  assertJsonRecord(plan.provenance, 'development-bundle plan.provenance');
  return plan;
};

const reconstructStageReceipt = (rawReceipt) => {
  const receipt = copyJsonData(
    rawReceipt,
    'development-bundle stage receipt'
  );
  const reconstructed = createBenchmarkStageReceipt({
    plan: {
      stageRecordId: receipt.stageRecordId,
      stageId: receipt.stageId,
      stageIdentity: receipt.stageIdentity,
      claimBoundaryIdentity: receipt.claimBoundaryIdentity,
      evidenceIdentity: receipt.evidenceIdentity,
      evidenceSetSha256: receipt.evidenceSetSha256,
      provenance: receipt.provenance
    },
    evidence: receipt.evidence
  });
  if (!canonicalJsonEqual(reconstructed, receipt)) {
    throw new TypeError(
      'development-bundle stage receipt must exactly reconstruct.'
    );
  }
  if (receipt.stageId !== 'D0') {
    throw new TypeError('development-bundle stage receipt must be D0.');
  }
  return receipt;
};

const reconstructReportReceipt = (rawReceipt) => {
  const receipt = copyJsonData(
    rawReceipt,
    'development-bundle report receipt'
  );
  const reconstructed = createReportStarSchemaReceipt({
    plan: {
      reportDatasetId: receipt.reportDatasetId,
      schemaIdentity: receipt.schemaIdentity,
      rawDerivedIdentity: receipt.rawDerivedIdentity,
      publicationIdentity: receipt.publicationIdentity,
      tableSources: receipt.tableSources,
      provenance: receipt.provenance
    },
    tables: receipt.tables
  });
  if (!canonicalJsonEqual(reconstructed, receipt)) {
    throw new TypeError(
      'development-bundle report receipt must exactly reconstruct.'
    );
  }
  const populatedAdequacyTables = ['Judgment', 'Score', 'Correction']
    .filter((tableName) => receipt.tables[tableName].length !== 0);
  if (populatedAdequacyTables.length > 0) {
    throw new TypeError(
      `development-bundle report ${populatedAdequacyTables.join(', ')}`
      + ' must be empty at D0.'
    );
  }
  return receipt;
};

const normalizePreconditionEvidence = (rawEvidence, plan) => {
  if (!Array.isArray(rawEvidence)) {
    throw new TypeError(
      'development-bundle preconditionEvidence must be an array.'
    );
  }
  const evidenceById = new Map();
  for (const [index, rawRecord] of rawEvidence.entries()) {
    const path = `development-bundle preconditionEvidence[${index}]`;
    const record = copyJsonData(rawRecord, path);
    assertExactFields(record, PRECONDITION_FIELDS, path);
    for (const field of [
      'preconditionId',
      'releaseId',
      'evidenceRef',
      'authorityRef'
    ]) {
      assertNonemptyText(record[field], `${path}.${field}`);
    }
    assertSha256(record.stageReceiptSha256, `${path}.stageReceiptSha256`);
    assertTextChoice(record.status, ['satisfied'], `${path}.status`);
    assertSha256(record.evidenceSha256, `${path}.evidenceSha256`);
    if (!BM13_D0_PRECONDITION_IDS.includes(record.preconditionId)) {
      throw new TypeError(`${path}.preconditionId must name a BM13 D0 ID.`);
    }
    if (record.releaseId !== plan.releaseId) {
      throw new TypeError(`${path}.releaseId must match the bundle release.`);
    }
    if (record.stageReceiptSha256 !== plan.stageReceiptSha256) {
      throw new TypeError(
        `${path}.stageReceiptSha256 must match the D0 stage receipt.`
      );
    }
    if (evidenceById.has(record.preconditionId)) {
      throw new TypeError(
        'development-bundle precondition IDs must be unique.'
      );
    }
    evidenceById.set(record.preconditionId, record);
  }

  if (
    evidenceById.size !== BM13_D0_PRECONDITION_IDS.length
    || BM13_D0_PRECONDITION_IDS.some((id) => !evidenceById.has(id))
  ) {
    throw new TypeError(
      'development-bundle preconditions must contain exactly BM13 IDs 1–5.'
    );
  }
  const evidence = BM13_D0_PRECONDITION_IDS.map((id) => evidenceById.get(id));
  if (
    hashDevelopmentBundleData(evidence)
    !== plan.preconditionEvidenceSha256
  ) {
    throw new TypeError(
      'development-bundle precondition evidence does not match its source SHA-256.'
    );
  }
  return evidence;
};

export const createDevelopmentBundleReceipt = ({
  plan: rawPlan,
  stageReceipt: rawStageReceipt,
  reportReceipt: rawReportReceipt,
  preconditionEvidence: rawEvidence
}) => {
  const plan = normalizePlan(rawPlan);
  const stageReceipt = reconstructStageReceipt(rawStageReceipt);
  if (stageReceipt.receiptSha256 !== plan.stageReceiptSha256) {
    throw new TypeError(
      'development-bundle stage receipt does not match the plan.'
    );
  }
  const reportReceipt = reconstructReportReceipt(rawReportReceipt);
  if (reportReceipt.receiptSha256 !== plan.reportReceiptSha256) {
    throw new TypeError(
      'development-bundle report receipt does not match the plan.'
    );
  }
  if (reportReceipt.releaseId !== plan.releaseId) {
    throw new TypeError(
      'development-bundle releaseId must match the report receipt.'
    );
  }
  const preconditionEvidence = normalizePreconditionEvidence(
    rawEvidence,
    plan
  );

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W16b-d0-development-bundle',
    bundleId: plan.bundleId,
    releaseClass: plan.releaseClass,
    releaseId: plan.releaseId,
    stageReceiptSha256: stageReceipt.receiptSha256,
    reportReceiptSha256: reportReceipt.receiptSha256,
    preconditionEvidenceSha256: plan.preconditionEvidenceSha256,
    preconditionIds: BM13_D0_PRECONDITION_IDS,
    preconditionEvidence,
    tableNames: REPORT_TABLE_NAMES,
    stageReceipt,
    reportReceipt,
    bundleTreatment:
      'development-integrity-bundle-no-adequacy-claim-release-or-publication',
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
