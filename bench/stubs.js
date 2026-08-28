import { copyJsonData, isPlainRecord } from './jsonData.js';

export const STUB_BOUNDARIES = Object.freeze({
  artifactSink: 'provider-free-memory-artifacts',
  engine: 'provider-free-stub-engine',
  s2Simulator: 'provider-free-s2-simulator-stub',
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

const s2CellKey = ({ candidateId, drawId }) => JSON.stringify([candidateId, drawId]);

export const createS2SimulatorStub = (cellResults) => {
  if (!Array.isArray(cellResults) || cellResults.length === 0) {
    throw new TypeError('S2 simulator stub cellResults must be a non-empty array.');
  }
  const snapshot = copyJsonData(cellResults, 'S2 simulator stub cellResults');
  const keys = snapshot.map(s2CellKey);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError('S2 simulator stub cellResults must use unique candidate/draw cells.');
  }
  return Object.freeze({
    boundary: STUB_BOUNDARIES.s2Simulator,
    listCellKeys: () => [...keys],
    simulate: async ({ candidate, posteriorDraw }) => {
      const key = JSON.stringify([candidate.candidateId, posteriorDraw.drawId]);
      const index = keys.indexOf(key);
      if (index < 0) throw new TypeError('S2 simulator stub has no result for the requested cell.');
      return copyJsonData(snapshot[index], 'S2 simulator stub cell result');
    }
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
