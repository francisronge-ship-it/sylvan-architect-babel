import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  BENCHMARK_STAGE_DEFINITIONS,
  createBenchmarkStageReceipt,
  hashBenchmarkStageData,
  hashBenchmarkStageEvidence
} from './benchmarkStage.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashBenchmarkStageData({ text });
const stageId = 'D0';
const evidence = [{
  evidenceId: 'proof-stage-evidence',
  stageId,
  evidenceRole: 'proof-external-role',
  evidenceRef: 'proof://stage/evidence',
  evidenceSha256: digest('proof-stage-evidence'),
  authorityRef: 'proof://external-authority',
  observedAt: 'proof-opaque-time',
  provenance: { proof: true }
}];
const plan = {
  stageRecordId: 'proof-stage-record',
  stageId,
  ...BENCHMARK_STAGE_DEFINITIONS[stageId],
  evidenceIdentity:
    'external-stage-evidence-does-not-authorize-release-or-publication',
  evidenceSetSha256: hashBenchmarkStageEvidence(evidence),
  provenance: { proof: true }
};
const execute = () => createBenchmarkStageReceipt({ plan, evidence });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('benchmark-stage proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `benchmark-stage proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/benchmarkStage.js',
  'bench/captureBenchmarkStageProof.mjs',
  'bench/index.js',
  'tests/benchmarkStage.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W16a-benchmark-stage-evidence-label',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  evidenceSetSha256: plan.evidenceSetSha256,
  receiptSha256: first.receiptSha256,
  receipt: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  evidenceSetSha256: plan.evidenceSetSha256,
  receiptSha256: first.receiptSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
