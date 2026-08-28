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
import { validateFrozenReleaseManifest } from './releaseManifest.js';
import {
  createReportStarSchemaReceipt,
  REPORT_TABLE_NAMES
} from './reportStarSchema.js';

export const BM13_D3_PRECONDITION_IDS = Object.freeze([
  'engine-certification',
  'factor-arms-and-ce1-ce2-versioning',
  'recovery-and-transcriber-decisions-executed',
  'compiler-purge-proof',
  'provider-free-validation-and-statistics-infrastructure',
  's0-s1-s2-measurement-carrier-and-memorization-completion',
  'd1-d2-board-and-calibration',
  'reporting-model-and-site-design-gates',
  'raw-output-publication-legal-clearance',
  'frozen-release-manifest-and-selected-model-admission-probes'
]);

const PLAN_FIELDS = Object.freeze([
  'bundleId',
  'releaseClass',
  'releaseId',
  'manifestSha256',
  'reportReceiptSha256',
  'preconditionEvidenceSha256',
  'provenance'
]);

const PRECONDITION_FIELDS = Object.freeze([
  'preconditionId',
  'releaseId',
  'manifestSha256',
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

export const hashReleaseBundleData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'release-bundle hash input'))
);

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'release-bundle plan');
  assertExactFields(plan, PLAN_FIELDS, 'release-bundle plan');
  assertNonemptyText(plan.bundleId, 'release-bundle plan.bundleId');
  assertTextChoice(
    plan.releaseClass,
    ['first-D3-release'],
    'release-bundle plan.releaseClass'
  );
  assertNonemptyText(plan.releaseId, 'release-bundle plan.releaseId');
  for (const field of [
    'manifestSha256',
    'reportReceiptSha256',
    'preconditionEvidenceSha256'
  ]) {
    assertSha256(plan[field], `release-bundle plan.${field}`);
  }
  assertJsonRecord(plan.provenance, 'release-bundle plan.provenance');
  return plan;
};

const normalizePreconditionEvidence = ({
  rawEvidence,
  plan
}) => {
  if (!Array.isArray(rawEvidence)) {
    throw new TypeError('release-bundle preconditionEvidence must be an array.');
  }
  const evidence = rawEvidence.map((rawRecord, index) => {
    const path = `release-bundle preconditionEvidence[${index}]`;
    const record = copyJsonData(rawRecord, path);
    assertExactFields(record, PRECONDITION_FIELDS, path);
    assertNonemptyText(record.preconditionId, `${path}.preconditionId`);
    assertNonemptyText(record.releaseId, `${path}.releaseId`);
    assertSha256(record.manifestSha256, `${path}.manifestSha256`);
    assertTextChoice(record.status, ['satisfied'], `${path}.status`);
    assertNonemptyText(record.evidenceRef, `${path}.evidenceRef`);
    assertSha256(record.evidenceSha256, `${path}.evidenceSha256`);
    assertNonemptyText(record.authorityRef, `${path}.authorityRef`);
    if (record.releaseId !== plan.releaseId) {
      throw new TypeError(`${path}.releaseId must match the bundle release.`);
    }
    if (record.manifestSha256 !== plan.manifestSha256) {
      throw new TypeError(`${path}.manifestSha256 must match the frozen manifest.`);
    }
    return record;
  });

  const ids = evidence.map(({ preconditionId }) => preconditionId);
  assertUniqueTextArray(ids, 'release-bundle precondition IDs');
  if (!sameTextSet(ids, BM13_D3_PRECONDITION_IDS)) {
    throw new TypeError(
      'release-bundle preconditions must contain exactly the ten BM13 D3 IDs.'
    );
  }
  if (hashReleaseBundleData(evidence) !== plan.preconditionEvidenceSha256) {
    throw new TypeError(
      'release-bundle precondition evidence does not match its source SHA-256.'
    );
  }
  return evidence;
};

const reconstructReportReceipt = (rawReceipt) => {
  const receipt = copyJsonData(rawReceipt, 'release-bundle report receipt');
  assertJsonRecord(receipt, 'release-bundle report receipt');
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
      'release-bundle report receipt does not reconstruct from its source tables.'
    );
  }
  return rebuilt;
};

const assertReleaseTupleMatches = ({
  plan,
  manifest,
  reportReceipt
}) => {
  const release = reportReceipt.tables.Release[0];
  if (
    plan.releaseId !== manifest.releaseId
    || plan.releaseId !== reportReceipt.releaseId
  ) {
    throw new TypeError(
      'release-bundle releaseId must match the manifest and report receipt.'
    );
  }
  const tuplePairs = [
    ['suiteVersion', 'suiteVer'],
    ['engineVersion', 'engineVer'],
    ['runWindow', 'window'],
    ['policyVersion', 'policyVer']
  ];
  for (const [manifestField, releaseField] of tuplePairs) {
    if (manifest[manifestField] !== release[releaseField]) {
      throw new TypeError(
        `release-bundle ${manifestField} must match report Release.${releaseField}.`
      );
    }
  }
  if (!canonicalJsonEqual(manifest.contractHashes, release.contractHashes)) {
    throw new TypeError(
      'release-bundle contractHashes must match the report Release.'
    );
  }
  const manifestModelIds = manifest.selections.map(({ registryId }) => registryId);
  const reportModelIds = reportReceipt.tables.Model.map(({ registryId }) => registryId);
  if (!sameTextSet(manifestModelIds, reportModelIds)) {
    throw new TypeError(
      'release-bundle report Models must exactly match manifest selections.'
    );
  }
};

export const createReleaseBundleReceipt = ({
  plan: rawPlan,
  frozenManifest: rawManifest,
  reportReceipt: rawReportReceipt,
  preconditionEvidence: rawEvidence
}) => {
  const plan = normalizePlan(rawPlan);
  const frozenManifest = validateFrozenReleaseManifest(rawManifest);
  if (frozenManifest.manifestSha256 !== plan.manifestSha256) {
    throw new TypeError(
      'release-bundle frozen manifest does not match plan.manifestSha256.'
    );
  }
  const reportReceipt = reconstructReportReceipt(rawReportReceipt);
  if (reportReceipt.receiptSha256 !== plan.reportReceiptSha256) {
    throw new TypeError(
      'release-bundle report receipt does not match plan.reportReceiptSha256.'
    );
  }
  const preconditionEvidence = normalizePreconditionEvidence({
    rawEvidence,
    plan
  });
  assertReleaseTupleMatches({
    plan,
    manifest: frozenManifest,
    reportReceipt
  });

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W13f-b-bm13-release-bundler',
    bundleId: plan.bundleId,
    releaseClass: plan.releaseClass,
    releaseId: plan.releaseId,
    manifestSha256: plan.manifestSha256,
    reportReceiptSha256: plan.reportReceiptSha256,
    preconditionEvidenceSha256: plan.preconditionEvidenceSha256,
    preconditionIds: BM13_D3_PRECONDITION_IDS,
    preconditionEvidence,
    releaseTuple: {
      suiteVersion: frozenManifest.suiteVersion,
      contractHashes: frozenManifest.contractHashes,
      engineVersion: frozenManifest.engineVersion,
      runWindow: frozenManifest.runWindow,
      policyVersion: frozenManifest.policyVersion
    },
    tableNames: REPORT_TABLE_NAMES,
    frozenManifest,
    reportReceipt,
    bundleTreatment:
      'validated-evidence-inventory-not-release-or-publication-authorization',
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
