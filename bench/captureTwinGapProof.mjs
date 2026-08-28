import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createTwinGapReceipt,
  hashTwinGapData
} from './twinGap.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashTwinGapData({ text });
const records = [{
  comparisonId: 'proof-comparison',
  twinPairId: 'proof-pair',
  providerIdentity: 'proof-provider',
  fromConditionIdentity: 'proof-condition-a',
  toConditionIdentity: 'proof-condition-b',
  outcomeIdentity: 'proof-outcome',
  outcomeEvidenceRef: 'proof://outcomes',
  outcomeEvidenceSha256: digest('proof-outcomes'),
  anchorItemVersionId: 'proof-anchor-v1',
  twinItemVersionId: 'proof-twin-v1',
  fromWindowId: 'proof-window-a',
  toWindowId: 'proof-window-b',
  fromAnchorRunId: 'proof-from-anchor',
  fromAnchorRunSha256: digest('proof-from-anchor'),
  fromAnchorValue: 0.5,
  fromTwinRunId: 'proof-from-twin',
  fromTwinRunSha256: digest('proof-from-twin'),
  fromTwinValue: 0.5,
  toAnchorRunId: 'proof-to-anchor',
  toAnchorRunSha256: digest('proof-to-anchor'),
  toAnchorValue: 0.75,
  toTwinRunId: 'proof-to-twin',
  toTwinRunSha256: digest('proof-to-twin'),
  toTwinValue: 0.5,
  exposureLedgerReceiptRef: 'proof://exposure-ledger',
  exposureLedgerReceiptSha256: digest('proof-exposure-ledger'),
  anchorExposureEventId: 'proof-anchor-exposure',
  twinNonExposureEvidenceRef: 'proof://twin-nonexposure',
  twinNonExposureEvidenceSha256: digest('proof-twin-nonexposure'),
  matchingEvidenceRef: 'proof://matching',
  matchingEvidenceSha256: digest('proof-matching')
}];
const plan = {
  analysisId: 'provider-free-proof',
  matchingIdentity: 'externally-matched-exposed-anchor-and-unexposed-twin',
  windowOrderIdentity: 'externally-declared-from-window-before-to-window',
  windowOrderSourceRef: 'proof://window-order',
  gapIdentity: 'signed-anchor-value-minus-twin-value',
  wideningIdentity: 'increasing-absolute-gap-magnitude',
  wideningMethodSourceRef: 'proof://widening-method',
  interpretationIdentity: 'widening-gap-is-evidence-never-proof',
  recordSetSourceRef: 'proof://records',
  recordSetSha256: hashTwinGapData(records),
  provenance: { proof: true }
};
const execute = () => createTwinGapReceipt({ plan, records });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) throw new Error('twin-gap proof repetitions differ.');
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `twin-gap proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureTwinGapProof.mjs',
  'bench/index.js',
  'bench/twinGap.js',
  'tests/benchmarkTwinGap.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13e-c-twin-gap',
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
