import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  BENCHMARK_STAGE_DEFINITIONS,
  BM13_D0_PRECONDITION_IDS,
  createBenchmarkStageReceipt,
  createDevelopmentBundleReceipt,
  createReportStarSchemaReceipt,
  hashBenchmarkStageData,
  hashBenchmarkStageEvidence,
  hashDevelopmentBundleData,
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
const digest = (text) => hashDevelopmentBundleData({ text });
const releaseId = 'proof-d0-release';
const stageEvidence = [{
  evidenceId: 'proof-stage-evidence',
  stageId: 'D0',
  evidenceRole: 'proof-external-role',
  evidenceRef: 'proof://stage/evidence',
  evidenceSha256: hashBenchmarkStageData({ text: 'proof-stage-evidence' }),
  authorityRef: 'proof://stage/authority',
  observedAt: 'proof-opaque-time',
  provenance: { proof: true }
}];
const stageReceipt = createBenchmarkStageReceipt({
  plan: {
    stageRecordId: 'proof-stage-record',
    stageId: 'D0',
    ...BENCHMARK_STAGE_DEFINITIONS.D0,
    evidenceIdentity:
      'external-stage-evidence-does-not-authorize-release-or-publication',
    evidenceSetSha256: hashBenchmarkStageEvidence(stageEvidence),
    provenance: { proof: true }
  },
  evidence: stageEvidence
});
const tables = {
  Release: [{
    id: releaseId,
    suiteVer: 'proof-suite',
    contractHashes: { parse: digest('proof-contract') },
    engineVer: 'proof-engine',
    window: 'proof-window',
    policyVer: 'proof-policy'
  }],
  Model: [],
  Condition: [],
  ItemVersion: [],
  Run: [],
  Judgment: [],
  Score: [],
  Correction: []
};
const reportReceipt = createReportStarSchemaReceipt({
  plan: {
    reportDatasetId: 'proof-d0-report',
    schemaIdentity: 'bm12-eight-table-star-schema',
    rawDerivedIdentity: 'raw-facts-and-externally-derived-scores-remain-distinct',
    publicationIdentity: 'dataset-generation-is-not-publication-authorization',
    tableSources: Object.fromEntries(REPORT_TABLE_NAMES.map((tableName) => [
      tableName,
      {
        sourceRef: `proof://tables/${tableName}`,
        sourceSha256: hashReportStarSchemaData(tables[tableName])
      }
    ])),
    provenance: { proof: true }
  },
  tables
});
const preconditionEvidence = BM13_D0_PRECONDITION_IDS.map(
  (preconditionId) => ({
    preconditionId,
    releaseId,
    stageReceiptSha256: stageReceipt.receiptSha256,
    status: 'satisfied',
    evidenceRef: `proof://preconditions/${preconditionId}`,
    evidenceSha256: digest(`proof-precondition:${preconditionId}`),
    authorityRef: `proof://authorities/${preconditionId}`
  })
);
const plan = {
  bundleId: 'proof-d0-bundle',
  releaseClass: 'D0-development-grade',
  releaseId,
  stageReceiptSha256: stageReceipt.receiptSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  preconditionEvidenceSha256:
    hashDevelopmentBundleData(preconditionEvidence),
  provenance: { proof: true }
};
const execute = () => createDevelopmentBundleReceipt({
  plan,
  stageReceipt,
  reportReceipt,
  preconditionEvidence
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('development-bundle proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `development-bundle proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureDevelopmentBundleProof.mjs',
  'bench/developmentBundle.js',
  'bench/index.js',
  'tests/benchmarkDevelopmentBundle.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W16b-d0-development-bundle',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  stageReceiptSha256: stageReceipt.receiptSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  preconditionEvidenceSha256: plan.preconditionEvidenceSha256,
  receiptSha256: first.receiptSha256,
  receipt: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  stageReceiptSha256: stageReceipt.receiptSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  preconditionEvidenceSha256: plan.preconditionEvidenceSha256,
  receiptSha256: first.receiptSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
