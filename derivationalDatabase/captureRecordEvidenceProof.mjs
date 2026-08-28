import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY,
  hashDurableRecordData,
  validateRecordEvidenceArtifacts
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
const artifacts = {
  generationRecord: {
    schemaIdentity: GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY,
    provider: 'proof-provider-verbatim',
    model: 'proof-model-verbatim',
    effort: 'proof-effort-verbatim',
    promptContract: {
      framework: 'proof-framework',
      promptRoute: 'proof-route',
      systemInstructionSha256: sha256('proof-system-instruction'),
      promptSha256: sha256('proof-prompt'),
      promptTemplateSha256: sha256('proof-prompt-template')
    },
    sentConfig: {
      model: 'proof-model-verbatim',
      maxOutputTokens: 4096,
      providerSpecificFlag: true
    },
    timing: { observedAt: 'proof-opaque-time', durationMs: 1 },
    tokenUse: { input: 101, output: 202, reasoning: 303 },
    costEstimate: {
      label: 'proof-external-estimate',
      currency: 'proof-unit',
      value: 4
    },
    provenance: { source: 'provider-free-proof' }
  },
  reviewState: {
    tier: 'proof-open-tier',
    reviewerIdentity: 'proof-reviewer',
    reviewedAt: 'proof-opaque-review-time',
    judgment: 'proof-open-judgment',
    notes: 'Verbatim review evidence.',
    provenance: { source: 'provider-free-proof' }
  },
  ambiguityGroup: {
    bundleId: 'proof-bundle',
    analysisIndex: 0
  },
  providerNotice: {
    provider: 'proof-provider-verbatim',
    noticeRef: 'proof://provider/notice',
    noticeSha256: sha256('proof-provider-notice'),
    quotationRef: 'proof://provider/notice/quotation',
    quotationSha256: sha256('proof-provider-notice-quotation'),
    observedAt: 'proof-opaque-notice-time',
    provenance: { source: 'provider-free-proof' }
  }
};
const execute = () => validateRecordEvidenceArtifacts(artifacts);
const first = execute();
const second = execute();
const firstSha256 = hashDurableRecordData(first);
const secondSha256 = hashDurableRecordData(second);
const deterministicRepeatEqual =
  firstSha256 === secondSha256
  && JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('record-evidence proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `record-evidence proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'derivationalDatabase/README.md',
  'derivationalDatabase/captureRecordEvidenceProof.mjs',
  'derivationalDatabase/durableRecord.js',
  'derivationalDatabase/index.js',
  'derivationalDatabase/jsonData.js',
  'derivationalDatabase/recordEvidence.js',
  'tests/derivationalDatabaseEvidence.test.mjs',
  'tests/derivationalDatabaseRecord.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W17b-record-evidence-schemas',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  evidenceSha256: firstSha256,
  evidence: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  evidenceSha256: firstSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
