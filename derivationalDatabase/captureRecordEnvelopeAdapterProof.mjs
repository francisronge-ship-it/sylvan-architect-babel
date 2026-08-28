import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createEvidenceBoundDurableRecord,
  GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY,
  hashDurableRecordData,
  parseDurableRecord,
  serializeDurableRecord,
  validateEvidenceBoundDurableRecord
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
const normalizedDerivation = {
  sentence: 'Mía laughed.',
  derivationStages: [{
    statement: 'Proof-authored stage.',
    stageRecord: 'Proof-authored note.',
    relations: [{
      relation: 'proof-open-relation',
      anchors: [{ role: 'proof-open-role', nodeId: 'node-a' }],
      values: { proof: ['α', 'β'] },
      priorAnchors: []
    }],
    workspaceForest: [{ nodeId: 'node-a', label: 'XP' }]
  }]
};
const evidence = {
  generationRecord: {
    schemaIdentity: GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY,
    provider: 'proof-provider',
    model: 'proof-model',
    effort: 'proof-effort',
    promptContract: {
      framework: 'proof-framework',
      promptRoute: 'proof-route',
      systemInstructionSha256: sha256('proof-system'),
      promptSha256: sha256('proof-prompt'),
      promptTemplateSha256: sha256('proof-template')
    },
    sentConfig: { model: 'proof-model', outputLimit: 4096 },
    timing: { observedAt: 'proof-opaque-time' },
    tokenUse: { input: 10, output: 20 },
    costEstimate: { label: 'proof-estimate', value: 1 },
    provenance: { source: 'provider-free-proof' }
  },
  reviewState: {
    tier: null,
    reviewerIdentity: null,
    reviewedAt: null,
    judgment: null,
    notes: null,
    provenance: { source: 'provider-free-proof' }
  },
  ambiguityGroup: {
    bundleId: 'proof-bundle',
    analysisIndex: 0
  },
  providerNotice: {
    provider: 'proof-provider',
    noticeRef: 'proof://provider/notice',
    noticeSha256: sha256('proof-notice'),
    quotationRef: 'proof://provider/quotation',
    quotationSha256: sha256('proof-quotation'),
    observedAt: 'proof-opaque-notice-time',
    provenance: { source: 'provider-free-proof' }
  }
};
const artifacts = { normalizedDerivation, ...evidence };
const plan = {
  recordId: 'proof-evidence-bound-record',
  contractVersion: 'proof-adopted-contract-version',
  contractArtifactRef: 'proof://contracts/adopted',
  contractArtifactSha256: sha256('proof-contract'),
  engineVersion: 'proof-engine-version',
  frameworkIdentity: evidence.generationRecord.promptContract.framework,
  supersedesRecordId: null,
  artifactBindings: Object.fromEntries(Object.entries(artifacts).map(
    ([artifactName, artifact]) => [artifactName, {
      sourceRef: `proof://record/${artifactName}`,
      canonicalSha256: hashDurableRecordData(artifact)
    }]
  )),
  provenance: { source: 'provider-free-proof' }
};
const execute = () => {
  const record = createEvidenceBoundDurableRecord({
    plan,
    normalizedDerivation,
    evidence
  });
  const serialized = serializeDurableRecord(record);
  validateEvidenceBoundDurableRecord(parseDurableRecord(serialized));
  return { record, serialized };
};
const first = execute();
const second = execute();
const deterministicRepeatEqual =
  first.serialized === second.serialized
  && first.record.recordSha256 === second.record.recordSha256;
if (!deterministicRepeatEqual) {
  throw new Error('record-envelope adapter proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `record-envelope adapter proof observed network attempts: ${
      networkAttempts.join(', ')
    }`
  );
}
const sourcePaths = [
  'derivationalDatabase/README.md',
  'derivationalDatabase/captureRecordEnvelopeAdapterProof.mjs',
  'derivationalDatabase/index.js',
  'derivationalDatabase/recordEnvelopeAdapter.js',
  'tests/derivationalDatabaseEnvelopeAdapter.test.mjs',
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
  packageId: 'W17c-evidence-bound-envelope-adapter',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  recordSha256: first.record.recordSha256,
  serializedSha256: sha256(first.serialized),
  record: first.record
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  recordSha256: first.record.recordSha256,
  serializedSha256: proof.serializedSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
