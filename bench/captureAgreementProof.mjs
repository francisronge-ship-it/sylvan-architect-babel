import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  estimateGwetAc1,
  hashAgreementData
} from './agreementCoefficients.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const units = [
  {
    unitId: 'proof-a',
    ratings: [
      { raterId: 'one', categoryId: 'yes' },
      { raterId: 'two', categoryId: 'yes' }
    ]
  },
  {
    unitId: 'proof-b',
    ratings: [
      { raterId: 'one', categoryId: 'yes' },
      { raterId: 'two', categoryId: 'no' }
    ]
  }
];
const bootstrapSchedule = [
  {
    replicationId: 'proof-identity',
    sampledUnitIds: ['proof-a', 'proof-b']
  },
  {
    replicationId: 'proof-agreeing',
    sampledUnitIds: ['proof-a', 'proof-a']
  }
];
const plan = {
  agreementId: 'provider-free-proof',
  coefficientIdentity: 'gwet-ac1',
  ratingScale: 'nominal',
  categoryIds: ['yes', 'no'],
  unitWeighting: 'equal-unit',
  chanceAgreementIdentity: 'gwet-ac1-multicategory',
  missingnessHandlingIdentity: 'proof-complete-cases',
  missingnessHandlingSourceRef: 'proof://missingness-policy',
  confidenceLevel: 0.95,
  confidenceLevelSourceRef: 'proof://confidence-policy',
  intervalType: 'percentile-order-statistics',
  bootstrapMethod: 'explicit-unit-resample-schedule',
  bootstrapScheduleSourceRef: 'proof://unit-bootstrap-schedule',
  bootstrapScheduleSha256: hashAgreementData(bootstrapSchedule),
  lowerOrderIndex: 0,
  upperOrderIndex: 1
};
const execute = () => estimateGwetAc1({ plan, units, bootstrapSchedule });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) throw new Error('agreement proof repetitions differ.');
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `agreement proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}

const sourcePaths = [
  'bench/README.md',
  'bench/agreementCoefficients.js',
  'bench/captureAgreementProof.mjs',
  'bench/index.js',
  'tests/benchmarkAgreementCoefficients.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13d-e-agreement-coefficients',
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
