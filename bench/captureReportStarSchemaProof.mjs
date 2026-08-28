import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
const digest = (text) => hashReportStarSchemaData({ text });
const release = {
  id: 'proof-release',
  suiteVer: 'proof-suite',
  contractHashes: { parse: digest('contract') },
  engineVer: 'proof-engine',
  window: 'proof-opaque-window',
  policyVer: 'proof-policy'
};
const model = {
  registryId: 'proof-model',
  name: 'Proof External Model',
  lab: 'Proof External Lab',
  manifestRef: 'proof://manifest/model'
};
const condition = {
  id: 'proof-condition',
  releaseId: release.id,
  modelId: model.registryId,
  resolvedVersion: 'proof-resolved-version',
  aliasWindow: null,
  host: 'proof-host',
  tier: 'proof-tier',
  framework: 'proof-framework',
  sentParams: { proof: true },
  carrier: 'proof-carrier'
};
const itemVersion = {
  itemVersionId: 'proof-item-v1',
  itemId: 'proof-item',
  vN: 1,
  contentAxes: { proof: true },
  flags: [],
  statusHistory: [],
  dispositions: []
};
const run = {
  id: 'proof-run',
  conditionId: condition.id,
  itemVersionId: itemVersion.itemVersionId,
  outcomeClass: 'proof-outcome',
  subCause: null,
  partition: 'native',
  finishReason: 'proof-finish',
  tokens: {
    inUncached: 1,
    inCached: 0,
    out: 1,
    reasoning: 0
  },
  latencyMs: 1,
  costUSD: 0,
  rawHash: digest('raw'),
  bundleRef: 'proof://bundle/run'
};
const score = {
  estimandId: 'proof-estimand',
  conditionScope: [condition.id],
  value: 0.5,
  ciLow: 0.1,
  ciHigh: 0.9,
  method: 'proof-external-method',
  clusterSpec: { proof: true },
  multiplicityFamily: null
};
const tables = {
  Release: [release],
  Model: [model],
  Condition: [condition],
  ItemVersion: [itemVersion],
  Run: [run],
  Judgment: [{
    runId: run.id,
    reviewerId: 'proof-reviewer',
    dimension: 'proof-dimension',
    value: 'proof-value',
    rubricVer: 'proof-rubric',
    adjudicated: false,
    blindingRecord: { ref: 'proof://blinding/run' }
  }],
  Score: [score],
  Correction: []
};
const plan = {
  reportDatasetId: 'provider-free-proof',
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
};
const execute = () => createReportStarSchemaReceipt({ plan, tables });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('report-star-schema proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `report-star-schema proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureReportStarSchemaProof.mjs',
  'bench/index.js',
  'bench/reportStarSchema.js',
  'tests/benchmarkReportStarSchema.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13f-a-star-schema-report-generator',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  receiptSha256: first.receiptSha256,
  receipt: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  receiptSha256: first.receiptSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
