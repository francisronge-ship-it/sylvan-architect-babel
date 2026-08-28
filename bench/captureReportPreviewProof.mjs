import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createReportPreviewReceipt,
  hashReportPreviewData
} from './reportPreview.js';
import {
  createReportStarSchemaReceipt,
  hashReportStarSchemaData,
  REPORT_TABLE_NAMES
} from './reportStarSchema.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashReportPreviewData({ text });
const tables = {
  Release: [{
    id: 'proof-preview-release',
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
    reportDatasetId: 'proof-preview-report',
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
const artifacts = [{
  artifactId: 'proof-preview-artifact',
  artifactRole: 'proof-external-role',
  sourceTables: ['Release'],
  reproducerRef: 'proof://reproducer',
  reproducerSha256: digest('proof-reproducer'),
  outputRef: 'proof://output',
  outputSha256: digest('proof-output'),
  provenance: { proof: true }
}];
const plan = {
  previewId: 'proof-preview',
  environmentIdentity: 'development-data-preview-only',
  publicationIdentity: 'preview-does-not-authorize-publication',
  reportReceiptSha256: reportReceipt.receiptSha256,
  artifactOrder: artifacts.map(({ artifactId }) => artifactId),
  provenance: { proof: true }
};
const execute = () => createReportPreviewReceipt({
  plan,
  reportReceipt,
  artifacts
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('report-preview proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `report-preview proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureReportPreviewProof.mjs',
  'bench/index.js',
  'bench/reportPreview.js',
  'tests/benchmarkReportPreview.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W15a-development-report-preview-manifest',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  receiptSha256: first.receiptSha256,
  receipt: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  reportReceiptSha256: reportReceipt.receiptSha256,
  receiptSha256: first.receiptSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
