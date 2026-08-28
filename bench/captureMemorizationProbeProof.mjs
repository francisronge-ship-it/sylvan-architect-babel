import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createMemorizationProbeReceipt,
  hashMemorizationProbeData
} from './memorizationProbe.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const bytes = (text) => Buffer.from(text, 'utf8');
const encoded = (text) => bytes(text).toString('base64');
const rawDigest = (text) => sha256(bytes(text));
const digest = (text) => hashMemorizationProbeData({ text });

const probes = [
  {
    probeId: 'proof-probe-match',
    itemVersionId: 'proof-item-v1',
    inputArtifactRef: 'proof://input/match',
    inputArtifactSha256: digest('input-match'),
    expectedContinuationArtifactRef: 'proof://expected/match',
    expectedContinuationSha256: rawDigest('authored continuation'),
    expectedContinuationBase64: encoded('authored continuation')
  },
  {
    probeId: 'proof-probe-mismatch',
    itemVersionId: 'proof-item-v2',
    inputArtifactRef: 'proof://input/mismatch',
    inputArtifactSha256: digest('input-mismatch'),
    expectedContinuationArtifactRef: 'proof://expected/mismatch',
    expectedContinuationSha256: rawDigest('exact bytes'),
    expectedContinuationBase64: encoded('exact bytes')
  },
  {
    probeId: 'proof-probe-unspent',
    itemVersionId: 'proof-item-v3',
    inputArtifactRef: 'proof://input/unspent',
    inputArtifactSha256: digest('input-unspent'),
    expectedContinuationArtifactRef: 'proof://expected/unspent',
    expectedContinuationSha256: rawDigest('unused bytes'),
    expectedContinuationBase64: encoded('unused bytes')
  }
];

const observation = ({
  observationId,
  probe,
  observedText,
  occurredAt
}) => ({
  observationId,
  probeId: probe.probeId,
  executionId: `proof-execution-${observationId}`,
  providerIdentity: 'proof-provider',
  conditionIdentity: 'proof-condition',
  windowIdentity: 'proof-window',
  occurredAt,
  exposureLedgerReceiptRef: 'proof://exposure-ledger',
  exposureLedgerReceiptSha256: digest('exposure-ledger'),
  exposureEventId: `proof-exposure-${observationId}`,
  inputArtifactRef: probe.inputArtifactRef,
  inputArtifactSha256: probe.inputArtifactSha256,
  expectedContinuationArtifactRef: probe.expectedContinuationArtifactRef,
  expectedContinuationSha256: probe.expectedContinuationSha256,
  observedContinuationArtifactRef: `proof://observed/${observationId}`,
  observedContinuationSha256: rawDigest(observedText),
  observedContinuationBase64: encoded(observedText)
});

const observations = [
  observation({
    observationId: 'match',
    probe: probes[0],
    observedText: 'authored continuation',
    occurredAt: 'opaque-later-label'
  }),
  observation({
    observationId: 'mismatch',
    probe: probes[1],
    observedText: 'different bytes',
    occurredAt: 'opaque-earlier-label'
  })
];

const plan = {
  analysisId: 'provider-free-proof',
  comparisonIdentity:
    'exact-byte-equality-over-externally-extracted-continuation-windows',
  probeSpendIdentity: 'first-declared-use-spends-probe',
  observationOrderIdentity:
    'externally-declared-complete-observation-order-only',
  interpretationIdentity:
    'verbatim-match-is-observation-not-memorization-proof',
  extractionMethodRef: 'proof://external-extraction-method',
  extractionMethodSha256: digest('external-extraction-method'),
  probeSetSourceRef: 'proof://probe-set',
  probeSetSha256: hashMemorizationProbeData(probes),
  observationSetSourceRef: 'proof://observation-set',
  observationSetSha256: hashMemorizationProbeData(observations),
  orderedObservationIds: ['match', 'mismatch'],
  provenance: { proof: true }
};

const execute = () => createMemorizationProbeReceipt({
  plan,
  probes,
  observations
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('memorization-probe proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `memorization-probe proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureMemorizationProbeProof.mjs',
  'bench/index.js',
  'bench/memorizationProbe.js',
  'tests/benchmarkMemorizationProbe.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13e-d-memorization-probe-evidence',
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
