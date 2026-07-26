import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createDurableRecord,
  hashDurableRecordData,
  parseDurableRecord,
  serializeDurableRecord
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
  normalizedDerivation: {
    sentence: '¿Qué vio Mía? 👁️',
    derivationStages: [{
      statement: 'Authored scalar  e\u0301  stays byte-distinct.',
      stageRecord: 'Proof-only authored note.',
      relations: [{
        relation: 'proof-open-relation',
        anchors: [
          { role: 'π-source', nodeId: 'node-a' },
          { role: 'π-target', nodeId: 'node-b' }
        ],
        values: { feature: ['α', 'β'] },
        priorAnchors: []
      }],
      workspaceForest: [{ nodeId: 'node-a', label: 'XP' }]
    }]
  },
  generationRecord: {
    promptTemplateSha256: sha256('proof-prompt-template'),
    systemInstructionSha256: sha256('proof-system-instruction'),
    sentConfig: { externallySupplied: true, temperature: 0 },
    provider: 'proof-provider-verbatim',
    model: 'proof-model-verbatim',
    effort: 'proof-effort-verbatim',
    timing: { observedAt: 'proof-opaque-time' },
    tokenUse: { input: 101, output: 202 },
    costEstimate: { label: 'proof-estimate', currency: 'proof-unit', value: 3 },
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
const artifactBindings = Object.fromEntries(Object.entries(artifacts).map(
  ([artifactName, artifact]) => [artifactName, {
    sourceRef: `proof://durable-record/${artifactName}`,
    canonicalSha256: hashDurableRecordData(artifact)
  }]
));
const plan = {
  recordId: 'proof-durable-record',
  contractVersion: 'proof-adopted-contract-version',
  contractArtifactRef: 'proof://contracts/adopted',
  contractArtifactSha256: sha256('proof-adopted-contract-artifact'),
  engineVersion: 'proof-engine-version',
  frameworkIdentity: 'proof-framework',
  supersedesRecordId: null,
  artifactBindings,
  provenance: { source: 'provider-free-proof' }
};
const execute = () => {
  const record = createDurableRecord({ plan, artifacts });
  const serialized = serializeDurableRecord(record);
  return {
    record,
    serialized,
    reparsed: parseDurableRecord(serialized)
  };
};
const first = execute();
const second = execute();
const deterministicRepeatEqual =
  first.serialized === second.serialized
  && JSON.stringify(first.reparsed) === JSON.stringify(second.reparsed);
if (!deterministicRepeatEqual) {
  throw new Error('durable-record proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `durable-record proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'derivationalDatabase/README.md',
  'derivationalDatabase/captureDurableRecordProof.mjs',
  'derivationalDatabase/durableRecord.js',
  'derivationalDatabase/index.js',
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
  packageId: 'W17a-durable-record-envelope',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  artifactCanonicalSha256: artifactBindings,
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
