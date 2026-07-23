import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { __test__ as parserTest } from '../../server/babelParser.js';
import {
  FACTOR_KEYS,
  canonicalJson,
  createParserAdapter,
  executeFactorProbePlan,
  sha256
} from './factorProbeHarness.mjs';
import { buildStubPlan } from './stubPlan.mjs';
import { createProviderFreeStubTransport } from './stubTransport.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const harnessDir = path.dirname(scriptPath);
const repoRoot = path.resolve(harnessDir, '../..');
const guardPath = path.join(repoRoot, 'scripts/providerFreeNetworkGuard.cjs');
const defaultOutputRoot = path.join(repoRoot, 'bench-baseline/slice4-factor-probe');
const minimumNodeMajor = 24;

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
if (!Number.isInteger(nodeMajor) || nodeMajor < minimumNodeMajor) {
  throw new Error(
    `Factor-probe proof requires Node ${minimumNodeMajor}+; found ${process.version}.`
  );
}

const parseArguments = (argv) => {
  const options = {
    guardedChild: false,
    outputRoot: defaultOutputRoot
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--guarded-child') {
      options.guardedChild = true;
      continue;
    }
    if (argument === '--output') {
      options.outputRoot = path.resolve(process.cwd(), argv[index + 1] || '');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
};

const options = parseArguments(process.argv.slice(2));
if (!options.guardedChild) {
  const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim();
  const guardOption = `--require=${guardPath}`;
  const child = spawnSync(process.execPath, [
    scriptPath,
    '--guarded-child',
    '--output',
    options.outputRoot
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: [existingNodeOptions, guardOption].filter(Boolean).join(' ')
    },
    maxBuffer: 32 * 1024 * 1024
  });
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  process.exit(child.status ?? 1);
}

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active) throw new Error('Provider-free network guard is not active.');

const logsDir = path.join(options.outputRoot, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const runCommand = (name, command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024
  });
  const log = `${result.stdout || ''}${result.stderr || ''}`;
  const logRelativePath = path.posix.join('logs', `${name}.log`);
  fs.writeFileSync(path.join(options.outputRoot, ...logRelativePath.split('/')), log);
  return {
    command: [command, ...args].join(' '),
    executed: true,
    exitCode: result.status,
    logBytes: Buffer.byteLength(log),
    logFile: logRelativePath,
    logSha256: sha256(log),
    signal: result.signal
  };
};

const testReceipt = runCommand(
  'factor-harness-tests',
  process.execPath,
  ['--test', '.artifacts/factor-probe-harness/factorProbeHarness.test.mjs']
);
if (testReceipt.exitCode !== 0) {
  throw new Error('Factor harness tests failed; see the proof log.');
}

const plan = buildStubPlan(repoRoot);
const runOnce = (directoryName) => executeFactorProbePlan({
  outputRoot: path.join(options.outputRoot, directoryName),
  parseAndCompile: createParserAdapter(parserTest),
  plan,
  transport: createProviderFreeStubTransport(repoRoot)
});
const first = await runOnce('semantic-run-1');
const second = await runOnce('semantic-run-2');
if (
  first.semanticSha256 !== second.semanticSha256
  || canonicalJson(first.semantic) !== canonicalJson(second.semantic)
) {
  throw new Error('Deterministic stub repetitions diverged.');
}

const verifyAllReceipt = runCommand(
  'verify-all',
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'verify:all']
);
if (verifyAllReceipt.exitCode !== 0) {
  throw new Error('npm run verify:all failed; see the proof log.');
}

const networkAttempts = guard.getAttempts();
if (networkAttempts.length !== 0) {
  throw new Error(`Provider-free proof observed network attempts: ${networkAttempts.join(', ')}`);
}

const harnessSources = [
  '.artifacts/factor-probe-harness/factorProbeHarness.mjs',
  '.artifacts/factor-probe-harness/stubPlan.mjs',
  '.artifacts/factor-probe-harness/factorProbeHarness.test.mjs',
  '.artifacts/factor-probe-harness/captureProviderFreeProof.mjs',
  '.artifacts/factor-probe-harness/stubTransport.mjs',
  '.artifacts/factor-probe-harness/README.md'
];
const sourceHashes = Object.fromEntries(harnessSources.map((relativePath) => [
  relativePath,
  sha256(fs.readFileSync(path.join(repoRoot, relativePath)))
]));
const semantic = {
  contractMutation: false,
  determinism: {
    equal: true,
    semanticRunSha256: [first.semanticSha256, second.semanticSha256]
  },
  factorKeys: [...FACTOR_KEYS],
  planSha256: sha256(canonicalJson(plan)),
  transportBoundary: {
    providerTransportConfigured: false,
    mode: 'provider-free-stub-only'
  },
  receiptSha256: first.semanticSha256,
  sourceHashes
};
const manifest = {
  capture: {
    executionBoundary: {
      assertion: 'All proof processes inherited the deny-by-default provider-free network guard.',
      guardActive: true,
      guardedSurfaces: [...guard.guardedSurfaces],
      runtimeNetworkAttempts: networkAttempts
    },
    receipts: [testReceipt, verifyAllReceipt],
    runtime: {
      node: process.version,
      platform: process.platform
    }
  },
  partition: {
    semanticDigestAlgorithm: 'sha256(canonical-json($.semantic))',
    semanticRoot: '$.semantic',
    volatileExecutionRoot: '$.capture'
  },
  schemaVersion: 1,
  semantic,
  semanticSha256: sha256(canonicalJson(semantic))
};
const manifestPath = path.join(options.outputRoot, 'proof-manifest.json');
fs.writeFileSync(manifestPath, canonicalJson(manifest));
process.stdout.write(
  `${path.relative(repoRoot, manifestPath)}\n`
  + `semantic ${manifest.semanticSha256}\n`
  + `receipt ${first.semanticSha256}\n`
  + `manifest ${sha256(fs.readFileSync(manifestPath))}\n`
);
