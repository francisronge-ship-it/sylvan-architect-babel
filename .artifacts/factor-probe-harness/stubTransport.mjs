import fs from 'node:fs';
import path from 'node:path';

import { sha256 } from './factorProbeHarness.mjs';

export const createProviderFreeStubTransport = (repoRoot) => async (run) => {
  if (run.stub.kind === 'inline-utf8') {
    return {
      attempts: [{ attemptNumber: 1, outcome: 'completed-stub' }],
      finishReason: 'stub-complete',
      provenance: {
        driver: 'inline-utf8',
        providerInvocation: false
      },
      rawBytes: Buffer.from(run.stub.text, 'utf8'),
      usage: {}
    };
  }

  const sourceBytes = fs.readFileSync(path.join(repoRoot, run.stub.sourceRef));
  if (sha256(sourceBytes) !== run.stub.sourceSha256) {
    throw new Error(`Stub source hash mismatch for ${run.id}.`);
  }
  if (run.stub.kind === 'fixture-file-bytes') {
    return {
      attempts: [{ attemptNumber: 1, outcome: 'completed-stub' }],
      declaredRawSha256: run.stub.sourceSha256,
      finishReason: 'stub-complete',
      provenance: {
        driver: 'fixture-file-bytes',
        providerInvocation: false,
        transform: 'none'
      },
      rawBytes: sourceBytes,
      usage: {}
    };
  }

  const sourceFixture = JSON.parse(sourceBytes.toString('utf8'));
  const rawBytes = Buffer.from(JSON.stringify(sourceFixture.payload), 'utf8');
  return {
    attempts: [{ attemptNumber: 1, outcome: 'completed-stub' }],
    declaredRawSha256: sha256(rawBytes),
    finishReason: 'stub-complete',
    provenance: {
      driver: 'fixture-payload-json',
      providerInvocation: false,
      transform: 'declared JSON serialization of the existing fixture payload'
    },
    rawBytes,
    usage: {}
  };
};

