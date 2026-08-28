import { createHash } from 'node:crypto';

import {
  FAILURE_CLASSES,
  createFailure
} from '../server/babelParser/validationErrors.js';
import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData,
  isPlainRecord
} from './jsonData.js';
import { createBenchmarkRunPlan } from './runPlan.js';
import { STUB_BOUNDARIES } from './stubs.js';

const FAILURE_CLASS_VALUES = new Set(Object.values(FAILURE_CLASSES));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const canonicalJson = (value) => JSON.stringify(canonicalizeJsonData(value));

const normalizeFailure = (failure, path) => {
  if (!isPlainRecord(failure) || !FAILURE_CLASS_VALUES.has(failure.class)) {
    throw new TypeError(`${path} must carry one normative typed failure class.`);
  }
  return createFailure({
    failureClass: failure.class,
    ruleId: failure.ruleId,
    stageIndex: failure.stageIndex,
    fieldPath: failure.fieldPath,
    offendingValue: failure.offendingValue
  });
};

const rawBytes = (value) => {
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError('stub transport rawOutput must be a string or byte array.');
};

const artifactOutcome = (outcome, phase) => {
  if (!isPlainRecord(outcome) || typeof outcome.ok !== 'boolean') {
    throw new TypeError(`${phase} outcome must carry boolean ok.`);
  }
  if (!outcome.ok) {
    return {
      status: 'failed',
      failure: normalizeFailure(outcome.failure, `${phase}.failure`)
    };
  }
  if (typeof outcome.artifactRef !== 'string' || !outcome.artifactRef.trim()) {
    throw new TypeError(`${phase}.artifactRef must be a non-empty string.`);
  }
  if (typeof outcome.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(outcome.sha256)) {
    throw new TypeError(`${phase}.sha256 must be a lowercase SHA-256 digest.`);
  }
  return {
    status: 'valid',
    artifactRef: outcome.artifactRef,
    sha256: outcome.sha256
  };
};

const transportReceipt = (response) => copyJsonData({
  finishReason: response.finishReason ?? null,
  latencyMs: response.latencyMs ?? null,
  usage: response.usage ?? {},
  provenance: response.provenance ?? {}
}, 'transport');

const finalizeReceipt = (receipt) => {
  const stableReceipt = canonicalizeJsonData(copyJsonData(receipt, 'receipt'));
  return freezeJsonData({
    ...stableReceipt,
    receiptSha256: sha256(Buffer.from(canonicalJson(stableReceipt), 'utf8'))
  });
};

const requireStubBoundary = (component, expected, name) => {
  if (!component || component.boundary !== expected) {
    throw new TypeError(`${name} must use the ${expected} boundary.`);
  }
};

export const runBenchmarkDryRun = async ({
  plan: planInput,
  transport,
  engine,
  artifactSink
}) => {
  const plan = createBenchmarkRunPlan(planInput);
  requireStubBoundary(transport, STUB_BOUNDARIES.transport, 'transport');
  requireStubBoundary(engine, STUB_BOUNDARIES.engine, 'engine');
  requireStubBoundary(artifactSink, STUB_BOUNDARIES.artifactSink, 'artifactSink');

  const response = await transport.execute({ plan });
  if (!isPlainRecord(response) || typeof response.ok !== 'boolean') {
    throw new TypeError('stub transport response must carry boolean ok.');
  }
  const transportMetadata = transportReceipt(response);
  const transportFailure = response.ok
    ? null
    : normalizeFailure(response.failure, 'transport.failure');

  let rawArtifact = null;
  let bytes = null;
  if (Object.hasOwn(response, 'rawOutput')) {
    bytes = rawBytes(response.rawOutput);
    const rawHash = sha256(bytes);
    const stored = await artifactSink.storeRaw({
      bytes: Buffer.from(bytes),
      runId: plan.runId,
      sha256: rawHash
    });
    if (
      !isPlainRecord(stored)
      || typeof stored.artifactRef !== 'string'
      || !stored.artifactRef.trim()
    ) {
      throw new TypeError('artifactSink.storeRaw must return artifactRef.');
    }
    rawArtifact = {
      artifactRef: stored.artifactRef,
      byteLength: bytes.byteLength,
      sha256: rawHash
    };
  }

  const base = {
    schemaVersion: 1,
    runPlan: plan,
    transport: transportMetadata,
    rawOutputArtifact: rawArtifact
  };

  if (!response.ok) {
    return finalizeReceipt({
      ...base,
      parse: { status: 'not-run' },
      compile: { status: 'not-run' },
      outcome: {
        status: 'failed',
        phase: 'transport',
        failure: transportFailure
      }
    });
  }
  if (bytes === null) throw new TypeError('successful stub transport must return rawOutput.');

  const parse = artifactOutcome(await engine.parse({
    plan,
    rawBytes: Buffer.from(bytes),
    rawOutput: response.rawOutput
  }), 'parse');
  if (parse.status === 'failed') {
    return finalizeReceipt({
      ...base,
      parse,
      compile: { status: 'not-run' },
      outcome: {
        status: 'failed',
        phase: 'parse',
        failure: parse.failure
      }
    });
  }

  const compile = artifactOutcome(await engine.compile({ plan, parse }), 'compile');
  if (compile.status === 'failed') {
    return finalizeReceipt({
      ...base,
      parse,
      compile,
      outcome: {
        status: 'failed',
        phase: 'compile',
        failure: compile.failure
      }
    });
  }

  return finalizeReceipt({
    ...base,
    parse,
    compile,
    outcome: { status: 'valid' }
  });
};
