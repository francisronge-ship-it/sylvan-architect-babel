import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  hashJudgedUnitPlanData,
  validateJudgedUnitPlan
} from './judgedUnitPlan.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashJudgedUnitPlanData({ text });
const runs = [{
  runId: 'proof-run',
  itemVersionId: 'proof-item',
  validityStatus: 'valid',
  itemAuthorId: 'proof-author',
  runArtifactSha256: digest('proof-run')
}];
const assignments = [{
  assignmentId: 'proof-assignment',
  runId: 'proof-run',
  reviewerId: 'proof-reviewer-a',
  sourceRunArtifactSha256: digest('proof-run'),
  blindedRunRef: 'proof://blinded-run',
  blindedRunSha256: digest('proof-blinded-run'),
  blindingRecordRef: 'proof://blinding-record',
  blindingRecordSha256: digest('proof-blinding-record')
}];
const pairingPlan = [{
  reviewerIds: ['proof-reviewer-a', 'proof-reviewer-b'],
  requiredRunCount: 0
}];
const plan = {
  assignmentPlanId: 'provider-free-proof',
  adjudicatedItemVersionIds: ['proof-item'],
  reviewerIds: ['proof-reviewer-a', 'proof-reviewer-b'],
  coverageIdentity: 'every-valid-run-in-adjudicated-item-set',
  ratingMultiplicityIdentity: 'externally-assigned-one-or-two-reviewers-per-run',
  reviewerBlindingIdentity: 'model-identity-withheld',
  reviewerBlindingSourceRef: 'proof://reviewer-blinding',
  itemAuthorBlindingIdentity: 'reviewer-assignment-withheld',
  itemAuthorBlindingSourceRef: 'proof://author-blinding',
  runOrderIdentity: 'externally-randomized-complete-run-order',
  runOrderSourceRef: 'proof://run-order',
  orderedRunIds: ['proof-run'],
  pairingBalanceIdentity: 'complete-reviewer-pair-counts-differ-by-at-most-one',
  pairingPlanSourceRef: 'proof://pairing-plan',
  pairingPlanSha256: hashJudgedUnitPlanData(pairingPlan),
  runSetSourceRef: 'proof://runs',
  runSetSha256: hashJudgedUnitPlanData(runs),
  assignmentSetSourceRef: 'proof://assignments',
  assignmentSetSha256: hashJudgedUnitPlanData(assignments),
  provenance: { proof: true }
};
const execute = () => validateJudgedUnitPlan({
  plan,
  runs,
  assignments,
  pairingPlan
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) throw new Error('judged-unit proof repetitions differ.');
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(`judged-unit proof observed network attempts: ${networkAttempts.join(', ')}`);
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureJudgedUnitPlanProof.mjs',
  'bench/index.js',
  'bench/judgedUnitPlan.js',
  'tests/benchmarkJudgedUnitPlan.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13e-a-judged-unit-plan',
  nodeVersion: process.version,
  networkGuard: { active: guard.active, version: guard.version, attempts: networkAttempts },
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
