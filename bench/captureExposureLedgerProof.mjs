import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createExposureLedgerReceipt,
  hashExposureLedgerData
} from './exposureLedger.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashExposureLedgerData({ text });
const executions = [
  {
    runId: 'proof-api-run',
    itemVersionId: 'proof-private-item-v1',
    materialClass: 'private-item',
    executionRoute: 'provider-api',
    sourceRunArtifactSha256: digest('proof-api-run'),
    providerIdentity: 'proof-provider'
  },
  {
    runId: 'proof-local-run',
    itemVersionId: 'proof-private-item-v1',
    materialClass: 'private-item',
    executionRoute: 'operator-local-open-weight',
    sourceRunArtifactSha256: digest('proof-local-run')
  }
];
const events = [
  {
    eventId: 'proof-api-exposure',
    runId: 'proof-api-run',
    eventType: 'provider-api-exposure',
    occurredAt: 'proof-api-date',
    sourceRunArtifactSha256: digest('proof-api-run'),
    providerIdentity: 'proof-provider',
    retentionTier: 'proof-retention-tier',
    retentionEvidenceRef: 'proof://retention',
    retentionEvidenceSha256: digest('proof-retention')
  },
  {
    eventId: 'proof-local-execution',
    runId: 'proof-local-run',
    eventType: 'operator-local-execution',
    occurredAt: 'proof-local-date',
    sourceRunArtifactSha256: digest('proof-local-run'),
    operatorControlEvidenceRef: 'proof://operator-control',
    operatorControlEvidenceSha256: digest('proof-operator-control')
  }
];
const plan = {
  ledgerId: 'provider-free-proof',
  coverageIdentity: 'one-ledger-event-per-declared-execution',
  providerExposureIdentity: 'provider-api-execution-is-exposure',
  localExecutionIdentity:
    'operator-controlled-local-execution-is-not-provider-exposure',
  retentionIdentity: 'retention-commitments-do-not-reverse-exposure',
  nonExposureIdentity: 'provider-api-exposure-revokes-provider-nonexposure',
  eventOrderIdentity: 'externally-recorded-complete-chronological-event-order',
  orderedEventIds: ['proof-api-exposure', 'proof-local-execution'],
  executionSetSourceRef: 'proof://executions',
  executionSetSha256: hashExposureLedgerData(executions),
  eventSetSourceRef: 'proof://events',
  eventSetSha256: hashExposureLedgerData(events),
  provenance: { proof: true }
};
const execute = () => createExposureLedgerReceipt({ plan, executions, events });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) throw new Error('exposure-ledger proof repetitions differ.');
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `exposure-ledger proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureExposureLedgerProof.mjs',
  'bench/exposureLedger.js',
  'bench/index.js',
  'tests/benchmarkExposureLedger.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13e-b-exposure-ledger',
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
