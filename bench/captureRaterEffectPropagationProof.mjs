import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  hashRaterEffectPropagationData,
  propagateRaterEffects
} from './raterEffectPropagation.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const scoreDraws = [
  { drawId: 'proof-a', value: 0.3 },
  { drawId: 'proof-b', value: 0.7 }
];
const raterEffectDraws = [
  { drawId: 'proof-b', signedEffect: -0.05 },
  { drawId: 'proof-a', signedEffect: 0.05 }
];
const plan = {
  propagationId: 'provider-free-proof',
  scoreIdentity: 'proof-score-draws',
  raterEffectIdentity: 'proof-rater-effect-draws',
  baseScoreRaterEffectTreatmentIdentity: 'rater-effect-excluded',
  baseScoreRaterEffectTreatmentSourceRef: 'proof://base-score-construction',
  combinationIdentity: 'paired-additive-signed-rater-effect-draws',
  drawPairingIdentity: 'exact-draw-id',
  jointDrawConstructionIdentity: 'joint-score-rater-effect-draws',
  jointDrawConstructionSourceRef: 'proof://joint-draw-construction',
  pointSummaryIdentity: 'equal-draw-arithmetic-mean',
  scaleCompatibilityIdentity: 'common-additive-scale',
  scaleCompatibilitySourceRef: 'proof://scale-compatibility',
  confidenceLevel: 0.95,
  confidenceLevelSourceRef: 'proof://confidence-policy',
  intervalType: 'percentile-order-statistics',
  scoreDrawsSourceRef: 'proof://score-draws',
  scoreDrawsSha256: hashRaterEffectPropagationData(scoreDraws),
  raterEffectDrawsSourceRef: 'proof://rater-effect-draws',
  raterEffectDrawsSha256: hashRaterEffectPropagationData(raterEffectDraws),
  lowerOrderIndex: 0,
  upperOrderIndex: 1,
  provenance: { proof: true }
};
const execute = () => propagateRaterEffects({
  plan,
  scoreDraws,
  raterEffectDraws
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('rater-effect propagation proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `rater-effect propagation proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}

const sourcePaths = [
  'bench/README.md',
  'bench/captureRaterEffectPropagationProof.mjs',
  'bench/index.js',
  'bench/raterEffectPropagation.js',
  'tests/benchmarkRaterEffectPropagation.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13d-f-rater-effect-propagation',
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
