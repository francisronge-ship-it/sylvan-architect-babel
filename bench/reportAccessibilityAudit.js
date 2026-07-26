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
import {
  createReportPreviewReceipt,
  hashReportPreviewData
} from './reportPreview.js';

export const REPORT_ACCESSIBILITY_CHECK_IDS = Object.freeze([
  'colorblind-safe',
  'non-color-redundancy',
  'reduced-motion',
  'static-reproducibility'
]);

const PLAN_FIELDS = Object.freeze([
  'auditId',
  'checklistIdentity',
  'evidenceIdentity',
  'previewReceiptSha256',
  'provenance'
]);

const RECORD_FIELDS = Object.freeze([
  'artifactId',
  'artifactSha256',
  'checkId',
  'observationLabel',
  'auditorIdentity',
  'observedAt',
  'evidenceRef',
  'evidenceSha256',
  'findingArtifacts',
  'provenance'
]);

const FINDING_FIELDS = Object.freeze([
  'findingRef',
  'findingSha256'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  checklistIdentity: 'bm12-accessibility-and-static-reproducibility',
  evidenceIdentity: 'external-observations-no-publication-authorization'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const coordinate = (artifactId, checkId) => JSON.stringify([
  artifactId,
  checkId
]);

export const hashReportAccessibilityAuditData = (value) => (
  sha256CanonicalJson(
    copyJsonData(value, 'report-accessibility-audit hash input')
  )
);

const reconstructPreviewReceipt = (rawPreviewReceipt, reportReceipt) => {
  const previewReceipt = copyJsonData(
    rawPreviewReceipt,
    'report-accessibility-audit previewReceipt'
  );
  const reconstructed = createReportPreviewReceipt({
    plan: {
      previewId: previewReceipt.previewId,
      environmentIdentity: previewReceipt.environmentIdentity,
      publicationIdentity: previewReceipt.publicationIdentity,
      reportReceiptSha256: previewReceipt.reportReceiptSha256,
      artifactOrder: previewReceipt.artifactOrder,
      provenance: previewReceipt.provenance
    },
    reportReceipt,
    artifacts: previewReceipt.artifacts
  });
  if (
    hashReportPreviewData(reconstructed)
    !== hashReportPreviewData(previewReceipt)
  ) {
    throw new TypeError(
      'report-accessibility-audit previewReceipt must exactly reconstruct.'
    );
  }
  return previewReceipt;
};

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'report-accessibility-audit plan');
  assertExactFields(plan, PLAN_FIELDS, 'report-accessibility-audit plan');
  assertNonemptyText(plan.auditId, 'report-accessibility-audit plan.auditId');
  for (const [field, expected] of Object.entries(EXPECTED_IDENTITIES)) {
    if (plan[field] !== expected) {
      throw new TypeError(
        `report-accessibility-audit plan.${field} must be ${expected}.`
      );
    }
  }
  assertSha256(
    plan.previewReceiptSha256,
    'report-accessibility-audit plan.previewReceiptSha256'
  );
  assertJsonRecord(plan.provenance, 'report-accessibility-audit plan.provenance');
  return plan;
};

const normalizeFindingArtifacts = (rawFindings, path) => {
  if (!Array.isArray(rawFindings)) {
    throw new TypeError(`${path} must be an array.`);
  }
  const findings = rawFindings.map((rawFinding, index) => {
    const findingPath = `${path}[${index}]`;
    const finding = copyJsonData(rawFinding, findingPath);
    assertExactFields(finding, FINDING_FIELDS, findingPath);
    assertNonemptyText(finding.findingRef, `${findingPath}.findingRef`);
    assertSha256(finding.findingSha256, `${findingPath}.findingSha256`);
    return finding;
  });
  const refs = findings.map(({ findingRef }) => findingRef);
  if (new Set(refs).size !== refs.length) {
    throw new TypeError(`${path} finding refs must be unique.`);
  }
  return findings;
};

const normalizeRecords = (rawRecords, previewReceipt) => {
  if (!Array.isArray(rawRecords)) {
    throw new TypeError('report-accessibility-audit records must be an array.');
  }
  const artifactIds = new Set(previewReceipt.artifactOrder);
  const records = rawRecords.map((rawRecord, index) => {
    const path = `report-accessibility-audit records[${index}]`;
    const record = copyJsonData(rawRecord, path);
    assertExactFields(record, RECORD_FIELDS, path);
    for (const field of [
      'artifactId',
      'checkId',
      'observationLabel',
      'auditorIdentity',
      'observedAt',
      'evidenceRef'
    ]) {
      assertNonemptyText(record[field], `${path}.${field}`);
    }
    for (const field of ['artifactSha256', 'evidenceSha256']) {
      assertSha256(record[field], `${path}.${field}`);
    }
    if (!artifactIds.has(record.artifactId)) {
      throw new TypeError(`${path}.artifactId must name a preview artifact.`);
    }
    if (!REPORT_ACCESSIBILITY_CHECK_IDS.includes(record.checkId)) {
      throw new TypeError(`${path}.checkId must name a BM12 report check.`);
    }
    if (
      record.artifactSha256
      !== previewReceipt.artifactSha256[record.artifactId]
    ) {
      throw new TypeError(`${path} must bind the exact preview artifact SHA-256.`);
    }
    record.findingArtifacts = normalizeFindingArtifacts(
      record.findingArtifacts,
      `${path}.findingArtifacts`
    );
    assertJsonRecord(record.provenance, `${path}.provenance`);
    return record;
  });

  const recordByCoordinate = new Map();
  for (const record of records) {
    const key = coordinate(record.artifactId, record.checkId);
    if (recordByCoordinate.has(key)) {
      throw new TypeError(
        'report-accessibility-audit artifact/check coordinates must be unique.'
      );
    }
    recordByCoordinate.set(key, record);
  }
  const expectedCoordinates = previewReceipt.artifactOrder.flatMap(
    (artifactId) => REPORT_ACCESSIBILITY_CHECK_IDS.map(
      (checkId) => coordinate(artifactId, checkId)
    )
  );
  if (
    recordByCoordinate.size !== expectedCoordinates.length
    || expectedCoordinates.some((key) => !recordByCoordinate.has(key))
  ) {
    throw new TypeError(
      'report-accessibility-audit records must cover every artifact/check pair.'
    );
  }
  return expectedCoordinates.map((key) => recordByCoordinate.get(key));
};

export const createReportAccessibilityAuditReceipt = ({
  plan: rawPlan,
  reportReceipt,
  previewReceipt: rawPreviewReceipt,
  records: rawRecords
}) => {
  const plan = normalizePlan(rawPlan);
  const previewReceipt = reconstructPreviewReceipt(
    rawPreviewReceipt,
    reportReceipt
  );
  if (previewReceipt.receiptSha256 !== plan.previewReceiptSha256) {
    throw new TypeError(
      'report-accessibility-audit previewReceipt does not match the plan.'
    );
  }
  const records = normalizeRecords(rawRecords, previewReceipt);

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W15b-report-accessibility-evidence-inventory',
    auditId: plan.auditId,
    checklistIdentity: plan.checklistIdentity,
    evidenceIdentity: plan.evidenceIdentity,
    previewId: previewReceipt.previewId,
    reportDatasetId: previewReceipt.reportDatasetId,
    releaseId: previewReceipt.releaseId,
    previewReceiptSha256: previewReceipt.receiptSha256,
    checkIds: REPORT_ACCESSIBILITY_CHECK_IDS,
    observationCount: records.length,
    observationSha256: records.map((record) => ({
      artifactId: record.artifactId,
      checkId: record.checkId,
      sha256: hashReportAccessibilityAuditData(record)
    })),
    auditTreatment:
      'external-accessibility-evidence-no-pass-fail-or-publication-authorization',
    records,
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
