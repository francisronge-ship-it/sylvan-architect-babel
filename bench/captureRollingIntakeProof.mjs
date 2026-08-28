import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createRollingIntakeReceipt,
  hashRollingIntakeData
} from './rollingIntake.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashRollingIntakeData({ text });
const entry = (id) => ({
  intakeId: `proof-intake-${id}`,
  itemId: `proof-item-${id}`,
  itemVersionId: `proof-item-${id}-v1`,
  versionNumber: 1,
  itemArtifactRef: `proof://items/${id}/v1`,
  itemArtifactSha256: digest(`item-${id}`),
  submissionArtifactRef: `proof://submissions/${id}`,
  submissionArtifactSha256: digest(`submission-${id}`),
  submittedByIdentity: `proof-external-submitter-${id}`,
  submittedAt: `proof-opaque-submitted-${id}`,
  reviewRecordRef: `proof://reviews/${id}`,
  reviewRecordSha256: digest(`review-${id}`),
  reviewAuthorityIdentity: `proof-external-review-authority-${id}`,
  reviewCompletedAt: `proof-opaque-reviewed-${id}`
});
const priorEntries = [entry('alpha')];
const currentEntries = [...priorEntries, entry('beta')];
const plan = {
  queueSnapshotId: 'provider-free-proof',
  growthIdentity: 'append-only-reviewed-intake-with-record-stable-prior-prefix',
  orderingIdentity: 'externally-declared-complete-intake-order-only',
  reviewEvidenceIdentity: 'externally-supplied-review-record-evidence-only',
  activationIdentity: 'no-release-or-activation-authorization',
  priorEntrySetSourceRef: 'proof://intake/prior',
  priorEntrySetSha256: hashRollingIntakeData(priorEntries),
  currentEntrySetSourceRef: 'proof://intake/current',
  currentEntrySetSha256: hashRollingIntakeData(currentEntries),
  priorOrderedIntakeIds: priorEntries.map(({ intakeId }) => intakeId),
  currentOrderedIntakeIds: currentEntries.map(({ intakeId }) => intakeId),
  provenance: { proof: true }
};
const execute = () => createRollingIntakeReceipt({
  plan,
  priorEntries,
  currentEntries
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('rolling-intake proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `rolling-intake proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureRollingIntakeProof.mjs',
  'bench/index.js',
  'bench/rollingIntake.js',
  'tests/benchmarkRollingIntake.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13e-f-rolling-reviewed-intake',
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
