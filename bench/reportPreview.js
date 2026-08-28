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
import {
  createReportStarSchemaReceipt,
  REPORT_TABLE_NAMES
} from './reportStarSchema.js';

const PLAN_FIELDS = Object.freeze([
  'previewId',
  'environmentIdentity',
  'publicationIdentity',
  'reportReceiptSha256',
  'artifactOrder',
  'provenance'
]);

const ARTIFACT_FIELDS = Object.freeze([
  'artifactId',
  'artifactRole',
  'sourceTables',
  'reproducerRef',
  'reproducerSha256',
  'outputRef',
  'outputSha256',
  'provenance'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  environmentIdentity: 'development-data-preview-only',
  publicationIdentity: 'preview-does-not-authorize-publication'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

export const hashReportPreviewData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'report-preview hash input'))
);

const reconstructReportReceipt = (rawReceipt) => {
  const receipt = copyJsonData(rawReceipt, 'report-preview reportReceipt');
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
  if (sha256CanonicalJson(reconstructed) !== sha256CanonicalJson(receipt)) {
    throw new TypeError(
      'report-preview reportReceipt must exactly reconstruct from its tables.'
    );
  }
  return receipt;
};

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'report-preview plan');
  assertExactFields(plan, PLAN_FIELDS, 'report-preview plan');
  assertNonemptyText(plan.previewId, 'report-preview plan.previewId');
  for (const [field, expected] of Object.entries(EXPECTED_IDENTITIES)) {
    if (plan[field] !== expected) {
      throw new TypeError(`report-preview plan.${field} must be ${expected}.`);
    }
  }
  assertSha256(
    plan.reportReceiptSha256,
    'report-preview plan.reportReceiptSha256'
  );
  assertUniqueTextArray(
    plan.artifactOrder,
    'report-preview plan.artifactOrder',
    { allowEmpty: true }
  );
  assertJsonRecord(plan.provenance, 'report-preview plan.provenance');
  return plan;
};

const normalizeArtifacts = (rawArtifacts) => {
  if (!Array.isArray(rawArtifacts)) {
    throw new TypeError('report-preview artifacts must be an array.');
  }
  const artifacts = rawArtifacts.map((rawArtifact, index) => {
    const path = `report-preview artifacts[${index}]`;
    const artifact = copyJsonData(rawArtifact, path);
    assertExactFields(artifact, ARTIFACT_FIELDS, path);
    for (const field of [
      'artifactId',
      'artifactRole',
      'reproducerRef',
      'outputRef'
    ]) {
      assertNonemptyText(artifact[field], `${path}.${field}`);
    }
    for (const field of ['reproducerSha256', 'outputSha256']) {
      assertSha256(artifact[field], `${path}.${field}`);
    }
    assertUniqueTextArray(artifact.sourceTables, `${path}.sourceTables`);
    for (const tableName of artifact.sourceTables) {
      if (!REPORT_TABLE_NAMES.includes(tableName)) {
        throw new TypeError(
          `${path}.sourceTables must name only BM12 report tables.`
        );
      }
    }
    assertJsonRecord(artifact.provenance, `${path}.provenance`);
    return artifact;
  });

  const artifactIds = artifacts.map(({ artifactId }) => artifactId);
  if (new Set(artifactIds).size !== artifactIds.length) {
    throw new TypeError('report-preview artifact IDs must be unique.');
  }
  const substantiveDefinitions = artifacts.map(({
    artifactId: _artifactId,
    sourceTables,
    ...definition
  }) => hashReportPreviewData({
    ...definition,
    sourceTables: [...sourceTables].sort()
  }));
  if (new Set(substantiveDefinitions).size !== substantiveDefinitions.length) {
    throw new TypeError(
      'report-preview artifact substantive definitions must be unique.'
    );
  }
  return artifacts;
};

export const createReportPreviewReceipt = ({
  plan: rawPlan,
  reportReceipt: rawReportReceipt,
  artifacts: rawArtifacts
}) => {
  const plan = normalizePlan(rawPlan);
  const reportReceipt = reconstructReportReceipt(rawReportReceipt);
  if (reportReceipt.receiptSha256 !== plan.reportReceiptSha256) {
    throw new TypeError(
      'report-preview reportReceipt does not match plan.reportReceiptSha256.'
    );
  }

  const artifacts = normalizeArtifacts(rawArtifacts);
  const artifactIds = artifacts.map(({ artifactId }) => artifactId);
  if (!sameTextSet(artifactIds, plan.artifactOrder)) {
    throw new TypeError(
      'report-preview plan.artifactOrder must exactly cover artifact IDs.'
    );
  }
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.artifactId, artifact])
  );
  const orderedArtifacts = plan.artifactOrder.map(
    (artifactId) => artifactById.get(artifactId)
  );

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W15a-development-report-preview-manifest',
    previewId: plan.previewId,
    environmentIdentity: plan.environmentIdentity,
    publicationIdentity: plan.publicationIdentity,
    reportDatasetId: reportReceipt.reportDatasetId,
    releaseId: reportReceipt.releaseId,
    reportReceiptSha256: reportReceipt.receiptSha256,
    artifactOrder: plan.artifactOrder,
    artifactSha256: Object.fromEntries(orderedArtifacts.map((artifact) => [
      artifact.artifactId,
      hashReportPreviewData(artifact)
    ])),
    previewTreatment:
      'hash-bound-development-artifacts-no-view-selection-or-publication',
    artifacts: orderedArtifacts,
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
