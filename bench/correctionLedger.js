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
import {
  createItemAuditReceipt,
  ITEM_AUDIT_TAXONOMY
} from './itemAudit.js';
import {
  createReportStarSchemaReceipt
} from './reportStarSchema.js';

const PLAN_FIELDS = Object.freeze([
  'ledgerId',
  'releaseId',
  'auditCycleId',
  'itemAuditReceiptSha256',
  'reportReceiptSha256',
  'republicationRecordSha256',
  'provenance'
]);

const AUDIT_SOURCE_FIELDS = Object.freeze([
  'plan',
  'items',
  'audits'
]);

const REPUBLICATION_FIELDS = Object.freeze([
  'republicationId',
  'auditId',
  'itemId',
  'fromItemVersionId',
  'fromVersionNumber',
  'toItemVersionId',
  'toVersionNumber',
  'correctionReason',
  'taxonomyClass',
  'affectedScoreIds',
  'affectedScoreSetRef',
  'affectedScoreSetSha256',
  'dualVersionRepublicationPlanRef',
  'dualVersionRepublicationPlanSha256',
  'scoreArtifacts',
  'authorityRef'
]);

const SCORE_ARTIFACT_FIELDS = Object.freeze([
  'estimandId',
  'fromVersionRef',
  'fromVersionSha256',
  'toVersionRef',
  'toVersionSha256'
]);

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

const canonicalJsonEqual = (left, right) => (
  JSON.stringify(canonicalizeJsonData(left))
  === JSON.stringify(canonicalizeJsonData(right))
);

const transitionCoordinate = ({
  itemId,
  fromVersionNumber,
  toVersionNumber
}) => JSON.stringify([itemId, fromVersionNumber, toVersionNumber]);

export const hashCorrectionLedgerData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'correction-ledger hash input'))
);

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'correction-ledger plan');
  assertExactFields(plan, PLAN_FIELDS, 'correction-ledger plan');
  for (const field of ['ledgerId', 'releaseId', 'auditCycleId']) {
    assertNonemptyText(plan[field], `correction-ledger plan.${field}`);
  }
  for (const field of [
    'itemAuditReceiptSha256',
    'reportReceiptSha256',
    'republicationRecordSha256'
  ]) {
    assertSha256(plan[field], `correction-ledger plan.${field}`);
  }
  assertJsonRecord(plan.provenance, 'correction-ledger plan.provenance');
  return plan;
};

const reconstructItemAuditReceipt = (rawSource, plan) => {
  const source = copyJsonData(
    rawSource,
    'correction-ledger itemAuditSource'
  );
  assertExactFields(
    source,
    AUDIT_SOURCE_FIELDS,
    'correction-ledger itemAuditSource'
  );
  const receipt = createItemAuditReceipt(source);
  if (receipt.receiptSha256 !== plan.itemAuditReceiptSha256) {
    throw new TypeError(
      'correction-ledger item audit receipt does not match the plan.'
    );
  }
  if (receipt.plan.auditCycleId !== plan.auditCycleId) {
    throw new TypeError(
      'correction-ledger auditCycleId must match the item audit receipt.'
    );
  }
  return receipt;
};

const reconstructReportReceipt = (rawReceipt, plan) => {
  const receipt = copyJsonData(
    rawReceipt,
    'correction-ledger report receipt'
  );
  const rebuilt = createReportStarSchemaReceipt({
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
  if (!canonicalJsonEqual(rebuilt, receipt)) {
    throw new TypeError(
      'correction-ledger report receipt must exactly reconstruct.'
    );
  }
  if (receipt.receiptSha256 !== plan.reportReceiptSha256) {
    throw new TypeError(
      'correction-ledger report receipt does not match the plan.'
    );
  }
  if (receipt.releaseId !== plan.releaseId) {
    throw new TypeError(
      'correction-ledger releaseId must match the report receipt.'
    );
  }
  return receipt;
};

const normalizeScoreArtifacts = (rawArtifacts, affectedScoreIds, path) => {
  if (!Array.isArray(rawArtifacts)) {
    throw new TypeError(`${path} must be an array.`);
  }
  const artifacts = rawArtifacts.map((rawArtifact, index) => {
    const artifactPath = `${path}[${index}]`;
    const artifact = copyJsonData(rawArtifact, artifactPath);
    assertExactFields(artifact, SCORE_ARTIFACT_FIELDS, artifactPath);
    for (const field of [
      'estimandId',
      'fromVersionRef',
      'toVersionRef'
    ]) {
      assertNonemptyText(artifact[field], `${artifactPath}.${field}`);
    }
    for (const field of ['fromVersionSha256', 'toVersionSha256']) {
      assertSha256(artifact[field], `${artifactPath}.${field}`);
    }
    if (artifact.fromVersionRef === artifact.toVersionRef) {
      throw new TypeError(
        `${artifactPath} must name distinct from-version and to-version artifacts.`
      );
    }
    return artifact;
  });
  const artifactScoreIds = artifacts.map(({ estimandId }) => estimandId);
  if (
    new Set(artifactScoreIds).size !== artifactScoreIds.length
    || artifactScoreIds.length !== affectedScoreIds.length
    || affectedScoreIds.some((estimandId) => (
      !artifactScoreIds.includes(estimandId)
    ))
  ) {
    throw new TypeError(
      `${path} must exactly cover affectedScoreIds.`
    );
  }
  const artifactsByScoreId = new Map(artifacts.map((artifact) => [
    artifact.estimandId,
    artifact
  ]));
  return affectedScoreIds.map((estimandId) => (
    artifactsByScoreId.get(estimandId)
  ));
};

const normalizeRepublicationRecords = (rawRecords) => {
  if (!Array.isArray(rawRecords)) {
    throw new TypeError(
      'correction-ledger republicationRecords must be an array.'
    );
  }
  const records = rawRecords.map((rawRecord, index) => {
    const path = `correction-ledger republicationRecords[${index}]`;
    const record = copyJsonData(rawRecord, path);
    assertExactFields(record, REPUBLICATION_FIELDS, path);
    for (const field of [
      'republicationId',
      'auditId',
      'itemId',
      'fromItemVersionId',
      'toItemVersionId',
      'correctionReason',
      'affectedScoreSetRef',
      'dualVersionRepublicationPlanRef',
      'authorityRef'
    ]) {
      assertNonemptyText(record[field], `${path}.${field}`);
    }
    for (const field of ['fromVersionNumber', 'toVersionNumber']) {
      assertPositiveInteger(record[field], `${path}.${field}`);
    }
    if (record.toVersionNumber !== record.fromVersionNumber + 1) {
      throw new TypeError(`${path} must identify consecutive item versions.`);
    }
    assertTextChoice(
      record.taxonomyClass,
      ITEM_AUDIT_TAXONOMY,
      `${path}.taxonomyClass`
    );
    assertUniqueTextArray(
      record.affectedScoreIds,
      `${path}.affectedScoreIds`,
      { allowEmpty: true }
    );
    for (const field of [
      'affectedScoreSetSha256',
      'dualVersionRepublicationPlanSha256'
    ]) {
      assertSha256(record[field], `${path}.${field}`);
    }
    return {
      ...record,
      scoreArtifacts: normalizeScoreArtifacts(
        record.scoreArtifacts,
        record.affectedScoreIds,
        `${path}.scoreArtifacts`
      )
    };
  });
  for (const [label, values] of [
    ['republication IDs', records.map(({ republicationId }) => (
      republicationId
    ))],
    ['audit IDs', records.map(({ auditId }) => auditId)],
    ['transition coordinates', records.map(transitionCoordinate)]
  ]) {
    if (new Set(values).size !== values.length) {
      throw new TypeError(`correction-ledger ${label} must be unique.`);
    }
  }
  return records;
};

const assertRecordMatchesAudit = (record, auditResult) => {
  const transition = auditResult.versionTransition;
  if (
    record.auditId !== auditResult.auditId
    || record.itemId !== auditResult.itemId
    || record.fromItemVersionId !== transition.fromItemVersionId
    || record.fromVersionNumber !== auditResult.auditedVersionNumber
    || record.toItemVersionId !== transition.toItemVersionId
    || record.toVersionNumber !== transition.toVersionNumber
  ) {
    throw new TypeError(
      'correction-ledger republication record must match its revised audit transition.'
    );
  }
  if (
    record.affectedScoreSetRef !== transition.affectedScoreSetRef
    || record.affectedScoreSetSha256 !== transition.affectedScoreSetSha256
    || record.dualVersionRepublicationPlanRef
      !== transition.dualVersionRepublicationPlanRef
    || record.dualVersionRepublicationPlanSha256
      !== transition.dualVersionRepublicationPlanSha256
  ) {
    throw new TypeError(
      'correction-ledger republication record must preserve the audit artifacts.'
    );
  }
  if (!auditResult.findings.some(({ taxonomyClass }) => (
    taxonomyClass === record.taxonomyClass
  ))) {
    throw new TypeError(
      'correction-ledger taxonomyClass must name a finding from the revised audit.'
    );
  }
};

const assertRecordMatchesReport = ({
  record,
  correction,
  reportItemsById
}) => {
  if (!correction) {
    throw new TypeError(
      'correction-ledger revised audit must have a report Correction row.'
    );
  }
  if (
    correction.reason !== record.correctionReason
    || correction.taxonomyClass !== record.taxonomyClass
    || !sameTextSet(correction.affectedScores, record.affectedScoreIds)
  ) {
    throw new TypeError(
      'correction-ledger report Correction must match republication evidence.'
    );
  }
  const fromItem = reportItemsById.get(record.fromItemVersionId);
  const toItem = reportItemsById.get(record.toItemVersionId);
  if (
    fromItem?.itemId !== record.itemId
    || fromItem?.vN !== record.fromVersionNumber
    || toItem?.itemId !== record.itemId
    || toItem?.vN !== record.toVersionNumber
  ) {
    throw new TypeError(
      'correction-ledger report item-version IDs must match their item/version coordinates.'
    );
  }
};

export const createCorrectionLedgerReceipt = ({
  plan: rawPlan,
  itemAuditSource: rawItemAuditSource,
  reportReceipt: rawReportReceipt,
  republicationRecords: rawRecords
}) => {
  const plan = normalizePlan(rawPlan);
  const itemAuditReceipt = reconstructItemAuditReceipt(
    rawItemAuditSource,
    plan
  );
  const reportReceipt = reconstructReportReceipt(rawReportReceipt, plan);
  const records = normalizeRepublicationRecords(rawRecords);
  const revisedAudits = itemAuditReceipt.itemAuditResults.filter(
    ({ disposition }) => disposition === 'revised'
  );
  const recordsByAuditId = new Map(records.map((record) => [
    record.auditId,
    record
  ]));
  const correctionsByTransition = new Map(
    reportReceipt.tables.Correction.map((correction) => [
      transitionCoordinate({
        itemId: correction.itemId,
        fromVersionNumber: correction.fromV,
        toVersionNumber: correction.toV
      }),
      correction
    ])
  );
  const reportItemsById = new Map(
    reportReceipt.tables.ItemVersion.map((item) => [
      item.itemVersionId,
      item
    ])
  );
  if (
    revisedAudits.length !== records.length
    || revisedAudits.some(({ auditId }) => !recordsByAuditId.has(auditId))
  ) {
    throw new TypeError(
      'correction-ledger records must exactly cover revised audits.'
    );
  }
  const orderedRecords = revisedAudits.map((auditResult) => {
    const record = recordsByAuditId.get(auditResult.auditId);
    assertRecordMatchesAudit(record, auditResult);
    assertRecordMatchesReport({
      record,
      correction: correctionsByTransition.get(transitionCoordinate(record)),
      reportItemsById
    });
    return record;
  });
  if (
    reportReceipt.tables.Correction.length !== orderedRecords.length
  ) {
    throw new TypeError(
      'correction-ledger report Corrections must exactly cover revised audits.'
    );
  }
  if (
    hashCorrectionLedgerData(orderedRecords)
    !== plan.republicationRecordSha256
  ) {
    throw new TypeError(
      'correction-ledger records do not match their source SHA-256.'
    );
  }

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W16c-correction-ledger',
    ledgerId: plan.ledgerId,
    releaseId: plan.releaseId,
    auditCycleId: plan.auditCycleId,
    itemAuditReceiptSha256: itemAuditReceipt.receiptSha256,
    reportReceiptSha256: reportReceipt.receiptSha256,
    republicationRecordSha256: plan.republicationRecordSha256,
    correctionCount: orderedRecords.length,
    correctionEntries: orderedRecords,
    itemAuditReceipt,
    reportReceipt,
    ledgerTreatment:
      'validated-correction-and-dual-version-artifact-inventory-no-republication-release-or-publication-action',
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
