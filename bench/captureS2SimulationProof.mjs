import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createS2SimulationPlan,
  hashS2SimulationData,
  runS2SimulationDryRun
} from './s2Simulation.js';
import { createS2SimulatorStub } from './stubs.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const posteriorDraws = [
  { drawId: 'proof-draw', components: { item: 0.2, rerun: 0.1 } }
];
const posteriorFitBody = {
  schemaVersion: 1,
  posterior: {
    status: 'available',
    drawCount: 1,
    drawsSha256: hashS2SimulationData(posteriorDraws),
    draws: posteriorDraws,
    diagnostics: { proof: true }
  },
  provenance: { fitRef: 'proof://fit' }
};
const posteriorFitReceipt = {
  ...posteriorFitBody,
  receiptSha256: hashS2SimulationData(posteriorFitBody)
};
const design = { externallyChosenItems: 20, externallyChosenReruns: 2 };
const simulatorConfiguration = { proof: true };
const plan = {
  simulationId: 'provider-free-proof',
  posteriorFitReceiptSha256: posteriorFitReceipt.receiptSha256,
  posteriorDrawsSha256: hashS2SimulationData(posteriorDraws),
  posteriorSelection: {
    selectionId: 'proof-selection',
    sourceRef: 'proof://selection',
    drawIds: ['proof-draw']
  },
  designCandidates: [{
    candidateId: 'proof-design',
    design,
    designSha256: hashS2SimulationData(design)
  }],
  targetSpecifications: [{
    targetId: 'proof-target',
    metricId: 'halfWidth',
    comparator: 'at-most',
    threshold: 0.1,
    sourceRef: 'proof://target'
  }],
  simulatorSpecification: {
    simulatorId: 'proof-simulator',
    implementationRef: 'proof://simulator',
    configuration: simulatorConfiguration,
    configurationSha256: hashS2SimulationData(simulatorConfiguration)
  },
  executionSpecification: {
    executionId: 'proof-execution',
    environmentIdentity: 'proof-environment',
    randomScheduleIdentity: 'proof-random-schedule',
    randomScheduleSourceRef: 'proof://random-schedule'
  },
  provenance: { proof: true }
};
const frozenPlan = createS2SimulationPlan(plan);
const cellResult = {
  status: 'simulated',
  simulationPlanSha256: frozenPlan.planSha256,
  posteriorDrawsSha256: frozenPlan.posteriorDrawsSha256,
  executionId: frozenPlan.executionSpecification.executionId,
  candidateId: 'proof-design',
  candidateDesignSha256: frozenPlan.designCandidates[0].designSha256,
  drawId: 'proof-draw',
  metrics: { halfWidth: 0.08 },
  provenance: { proof: true }
};
const execute = () => runS2SimulationDryRun({
  plan,
  posteriorFitReceipt,
  posteriorDraws,
  simulator: createS2SimulatorStub([cellResult])
});
const first = await execute();
const second = await execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) throw new Error('S2 proof repetitions differ.');
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(`S2 proof observed network attempts: ${networkAttempts.join(', ')}`);
}

const sourcePaths = [
  'bench/captureS2SimulationProof.mjs',
  'bench/s2Simulation.js',
  'bench/stubs.js',
  'tests/benchmarkS2Simulation.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async (sourcePath) => [
  sourcePath,
  sha256(await readFile(sourcePath))
])));
const proof = {
  schemaVersion: 1,
  packageId: 'W13d-d-s2-simulator',
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
