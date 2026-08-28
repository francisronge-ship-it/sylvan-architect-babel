import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createCorrectionLedgerReceipt,
  createItemAuditReceipt,
  createReportStarSchemaReceipt,
  hashCorrectionLedgerData,
  hashItemAuditData,
  hashReportStarSchemaData,
  REPORT_TABLE_NAMES
} from './index.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashCorrectionLedgerData({ text });
const releaseId = 'proof-correction-release';
const auditCycleId = 'proof-correction-cycle';
const item = {
  itemId: 'proof-item',
  itemVersionId: 'proof-item-v1',
  versionNumber: 1,
  itemArtifactRef: 'proof://items/v1',
  itemArtifactSha256: digest('item-v1'),
  statusHistoryRef: 'proof://status/item',
  statusHistorySha256: digest('status-item')
};
const finding = {
  findingId: 'proof-finding',
  taxonomyClass: 'key-error',
  evidenceRef: 'proof://finding',
  evidenceSha256: digest('finding')
};
const audit = {
  auditId: 'proof-audit',
  itemId: item.itemId,
  auditedItemVersionId: item.itemVersionId,
  auditorIdentity: 'proof-external-auditor',
  auditCompletedAt: 'proof-opaque-time',
  auditArtifactRef: 'proof://audit',
  auditArtifactSha256: digest('audit'),
  findings: [finding],
  disposition: 'revised',
  dispositionEvidenceRef: 'proof://disposition',
  dispositionEvidenceSha256: digest('disposition'),
  revision: {
    itemId: item.itemId,
    fromItemVersionId: item.itemVersionId,
    toItemVersionId: 'proof-item-v2',
    toVersionNumber: 2,
    revisedItemArtifactRef: 'proof://items/v2',
    revisedItemArtifactSha256: digest('item-v2'),
    affectedScoreSetRef: 'proof://affected-scores',
    affectedScoreSetSha256: digest('affected-scores'),
    dualVersionRepublicationPlanRef: 'proof://republication-plan',
    dualVersionRepublicationPlanSha256: digest('republication-plan')
  }
};
const itemAuditSource = {
  plan: {
    auditCycleId,
    auditScopeIdentity: 'externally-declared-complete-item-version-set',
    taxonomyIdentity:
      'key-error-underspecified-checklist-family-doc-gap-ambiguity-defect-contamination-evidence',
    dispositionIdentity:
      'externally-authored-verified-revised-or-documented-uncertain',
    revisionIdentity: 'next-version-plus-dual-version-score-republication',
    uncertainIdentity: 'exclude-from-claim-bearing-scores-until-resolved',
    itemSetSourceRef: 'proof://item-set',
    itemSetSha256: hashItemAuditData([item]),
    auditSetSourceRef: 'proof://audit-set',
    auditSetSha256: hashItemAuditData([audit]),
    targetItemVersionIds: [item.itemVersionId],
    provenance: { proof: true }
  },
  items: [item],
  audits: [audit]
};
const itemAuditReceipt = createItemAuditReceipt(itemAuditSource);
const scoreId = 'proof-score';
const reportTables = {
  Release: [{
    id: releaseId,
    suiteVer: 'proof-suite',
    contractHashes: { parse: digest('contract') },
    engineVer: 'proof-engine',
    window: 'proof-window',
    policyVer: 'proof-policy'
  }],
  Model: [{
    registryId: 'proof-model',
    name: 'Proof External Model',
    lab: 'Proof External Lab',
    manifestRef: 'proof://manifest/model'
  }],
  Condition: [{
    id: 'proof-condition',
    releaseId,
    modelId: 'proof-model',
    resolvedVersion: 'proof-resolved-version',
    aliasWindow: null,
    host: 'proof-host',
    tier: 'proof-tier',
    framework: 'proof-framework',
    sentParams: { proof: true },
    carrier: 'proof-carrier'
  }],
  ItemVersion: [1, 2].map((vN) => ({
    itemVersionId: `proof-item-v${vN}`,
    itemId: item.itemId,
    vN,
    contentAxes: { proof: true },
    flags: [],
    statusHistory: [{ version: vN }],
    dispositions: vN === 1 ? [] : [{ disposition: 'revised' }]
  })),
  Run: [],
  Judgment: [],
  Score: [{
    estimandId: scoreId,
    conditionScope: ['proof-condition'],
    value: 0.5,
    ciLow: 0.2,
    ciHigh: 0.8,
    method: 'proof-external-method',
    clusterSpec: { proof: true },
    multiplicityFamily: null
  }],
  Correction: [{
    itemId: item.itemId,
    fromV: 1,
    toV: 2,
    reason: 'proof-external-reason',
    taxonomyClass: finding.taxonomyClass,
    affectedScores: [scoreId]
  }]
};
const reportReceipt = createReportStarSchemaReceipt({
  plan: {
    reportDatasetId: 'proof-correction-report',
    schemaIdentity: 'bm12-eight-table-star-schema',
    rawDerivedIdentity:
      'raw-facts-and-externally-derived-scores-remain-distinct',
    publicationIdentity:
      'dataset-generation-is-not-publication-authorization',
    tableSources: Object.fromEntries(REPORT_TABLE_NAMES.map((tableName) => [
      tableName,
      {
        sourceRef: `proof://report/${tableName}`,
        sourceSha256: hashReportStarSchemaData(reportTables[tableName])
      }
    ])),
    provenance: { proof: true }
  },
  tables: reportTables
});
const records = [{
  republicationId: 'proof-republication',
  auditId: audit.auditId,
  itemId: item.itemId,
  fromItemVersionId: item.itemVersionId,
  fromVersionNumber: 1,
  toItemVersionId: audit.revision.toItemVersionId,
  toVersionNumber: audit.revision.toVersionNumber,
  correctionReason: reportTables.Correction[0].reason,
  taxonomyClass: finding.taxonomyClass,
  affectedScoreIds: [scoreId],
  affectedScoreSetRef: audit.revision.affectedScoreSetRef,
  affectedScoreSetSha256: audit.revision.affectedScoreSetSha256,
  dualVersionRepublicationPlanRef:
    audit.revision.dualVersionRepublicationPlanRef,
  dualVersionRepublicationPlanSha256:
    audit.revision.dualVersionRepublicationPlanSha256,
  scoreArtifacts: [{
    estimandId: scoreId,
    fromVersionRef: 'proof://scores/v1',
    fromVersionSha256: digest('scores-v1'),
    toVersionRef: 'proof://scores/v2',
    toVersionSha256: digest('scores-v2')
  }],
  authorityRef: 'proof://authority'
}];
const plan = {
  ledgerId: 'proof-correction-ledger',
  releaseId,
  auditCycleId,
  itemAuditReceiptSha256: itemAuditReceipt.receiptSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  republicationRecordSha256: hashCorrectionLedgerData(records),
  provenance: { proof: true }
};
const execute = () => createCorrectionLedgerReceipt({
  plan,
  itemAuditSource,
  reportReceipt,
  republicationRecords: records
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('correction-ledger proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `correction-ledger proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureCorrectionLedgerProof.mjs',
  'bench/correctionLedger.js',
  'bench/index.js',
  'tests/benchmarkCorrectionLedger.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W16c-correction-ledger',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  itemAuditReceiptSha256: itemAuditReceipt.receiptSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  republicationRecordSha256: plan.republicationRecordSha256,
  receiptSha256: first.receiptSha256,
  receipt: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  itemAuditReceiptSha256: itemAuditReceipt.receiptSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  republicationRecordSha256: plan.republicationRecordSha256,
  receiptSha256: first.receiptSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
