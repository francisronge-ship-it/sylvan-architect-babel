import { copyJsonData, isPlainRecord } from './jsonData.js';

export const STUB_BOUNDARIES = Object.freeze({
  artifactSink: 'provider-free-memory-artifacts',
  engine: 'provider-free-stub-engine',
  transport: 'provider-free-stub-transport',
  varianceComponentFitter: 'provider-free-variance-component-fitter-stub'
});

const cloneBytes = (value) => (
  Buffer.isBuffer(value) || value instanceof Uint8Array
    ? Buffer.from(value)
    : value
);

export const createStubTransport = (response) => {
  if (!isPlainRecord(response)) throw new TypeError('stub response must be an object.');
  return Object.freeze({
    boundary: STUB_BOUNDARIES.transport,
    execute: async () => ({
      ...response,
      ...(Object.hasOwn(response, 'rawOutput')
        ? { rawOutput: cloneBytes(response.rawOutput) }
        : {})
    })
  });
};

export const createStubEngine = ({
  parseOutcome,
  compileOutcome
}) => Object.freeze({
  boundary: STUB_BOUNDARIES.engine,
  parse: async () => ({ ...parseOutcome }),
  compile: async () => ({ ...compileOutcome })
});

export const createVarianceComponentFitterStub = (outcome) => {
  const snapshot = copyJsonData(outcome, 'variance component fitter stub outcome');
  return Object.freeze({
    boundary: STUB_BOUNDARIES.varianceComponentFitter,
    fit: async () => copyJsonData(snapshot, 'variance component fitter stub outcome')
  });
};

export const createMemoryArtifactSink = () => {
  const writes = [];
  return Object.freeze({
    boundary: STUB_BOUNDARIES.artifactSink,
    storeRaw: async ({ bytes, runId, sha256 }) => {
      writes.push({
        bytes: Buffer.from(bytes),
        runId,
        sha256
      });
      return {
        artifactRef: `memory://benchmark-raw/${sha256}`
      };
    },
    inspectWrites: () => writes.map((write) => ({
      ...write,
      bytes: Buffer.from(write.bytes)
    }))
  });
};
