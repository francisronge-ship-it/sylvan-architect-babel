import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildDerivationReplayPlan } from '../derivationReplayPlan.js';
import { buildReplaySnapshotProjection } from '../replay/replaySnapshot.ts';
import { __test__ } from '../server/babelParser.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(
  repoRoot,
  'docs',
  'implementation',
  'baselines',
  '2026-07-23-provider-free.json'
);
const outputArgumentIndex = process.argv.indexOf('--output');
const outputPath = outputArgumentIndex >= 0 && process.argv[outputArgumentIndex + 1]
  ? path.resolve(process.cwd(), process.argv[outputArgumentIndex + 1])
  : defaultOutputPath;

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const fileSha256 = (relativePath) =>
  sha256(fs.readFileSync(path.join(repoRoot, relativePath)));

const git = (...args) => execFileSync('git', args, {
  cwd: repoRoot,
  encoding: 'utf8'
}).trimEnd();

const clone = (value) => JSON.parse(JSON.stringify(value));

const stripVolatileProvenance = (bundle) => {
  for (const analysis of bundle.analyses || []) {
    if (!analysis.provenance || typeof analysis.provenance !== 'object') continue;
    for (const field of ['timestamp', 'promptVersion', 'parserVersion', 'uiVersion']) {
      delete analysis.provenance[field];
    }
  }
  return bundle;
};

const describeFailure = (run) => {
  try {
    const result = run();
    const stableResult = result?.analyses
      ? stripVolatileProvenance(clone(result))
      : result;
    return {
      outcome: 'accepted',
      resultSha256: sha256(stableJson(stableResult))
    };
  } catch (error) {
    return {
      outcome: 'rejected',
      name: String(error?.name || 'Error'),
      code: String(error?.code || ''),
      status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      message: String(error?.message || ''),
      details: error?.details === undefined ? null : clone(error.details)
    };
  }
};

const rawFixtureDir = path.join(repoRoot, 'fixtures', 'raw');
const normalizedFixtureDir = path.join(repoRoot, 'fixtures', 'normalized');
const replayFixtureDir = path.join(repoRoot, 'fixtures', 'replay-snapshots');
const fixtureNames = fs.readdirSync(rawFixtureDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

const fixtureOutputs = Object.fromEntries(fixtureNames.map((fixtureName) => {
  const rawFixture = JSON.parse(
    fs.readFileSync(path.join(rawFixtureDir, fixtureName), 'utf8')
  );
  const compiledBundle = stripVolatileProvenance(__test__.normalizeParseBundle(
    clone(rawFixture.payload),
    rawFixture.framework,
    rawFixture.sentence,
    rawFixture.modelRoute,
    true,
    { payloadIntegrityFlags: [] }
  ));
  const committedBundle = JSON.parse(
    fs.readFileSync(path.join(normalizedFixtureDir, fixtureName), 'utf8')
  );
  const replayPlan = buildDerivationReplayPlan({
    derivationStages: compiledBundle.analyses[0]?.derivationStages || []
  });
  const renderPlan = buildReplaySnapshotProjection(compiledBundle);
  const replaySnapshotName = fixtureName.replace(/\.json$/, '.playback.json');
  const committedReplaySnapshot = JSON.parse(
    fs.readFileSync(path.join(replayFixtureDir, replaySnapshotName), 'utf8')
  );

  return [fixtureName, {
    sentence: rawFixture.sentence,
    framework: rawFixture.framework,
    normalizedCommittedSha256: sha256(stableJson(committedBundle)),
    normalizedCurrentSha256: sha256(stableJson(compiledBundle)),
    normalizedParity: stableJson(compiledBundle) === stableJson(committedBundle),
    replayPlanSha256: sha256(stableJson(replayPlan)),
    replayPlanStepCount: replayPlan.steps.length,
    renderPlanSha256: sha256(stableJson(renderPlan)),
    renderPlanStepCount: renderPlan.stepCount,
    committedReplaySnapshotSha256: sha256(stableJson(committedReplaySnapshot)),
    renderPlanParity: stableJson(renderPlan) === stableJson(committedReplaySnapshot)
  }];
}));

const malformedSource = JSON.parse(
  fs.readFileSync(path.join(rawFixtureDir, fixtureNames[0]), 'utf8')
);
const normalizeMalformed = (payload, sentence = malformedSource.sentence) =>
  __test__.normalizeParseBundle(
    payload,
    malformedSource.framework,
    sentence,
    malformedSource.modelRoute,
    true,
    { payloadIntegrityFlags: [] }
  );

const malformedPayloads = {
  invalidJson: describeFailure(() => __test__.parseModelJson('{"derivationStages":')),
  topLevelArray: describeFailure(() =>
    __test__.parseModelJson(JSON.stringify([malformedSource.payload]))
  ),
  extraStageField: describeFailure(() => {
    const payload = clone(malformedSource.payload);
    payload.derivationStages[0].unexpected = 'not part of the contract';
    return normalizeMalformed(payload);
  }),
  missingStageField: describeFailure(() => {
    const payload = clone(malformedSource.payload);
    delete payload.derivationStages[0].statement;
    return normalizeMalformed(payload);
  }),
  unresolvedRelationAnchor: describeFailure(() => {
    const payload = clone(malformedSource.payload);
    payload.derivationStages.at(-1).visualRelations.push({
      relation: 'baseline-unresolved-anchor',
      anchors: { witness: 'missing-node-id' }
    });
    return normalizeMalformed(payload);
  }),
  tokenMismatch: describeFailure(() =>
    normalizeMalformed(clone(malformedSource.payload), 'Different input.')
  )
};

const sourceSurfaces = [
  'server/babelParser/systemInstruction.js',
  'server/babelParser/prompts.js',
  'server/babelParser/routeConfig.js',
  'server/babelParser/modelRuntime.js',
  'server/babelParser/parseRoutes.js',
  'server/babelParser/parseNormalization.js',
  'server/babelParser/derivationCompiler.js',
  'server/babelParser/surfaceTokens.js',
  'replay/replayCompiler.ts',
  'replay/replaySnapshot.ts',
  'derivationReplayPlan.js',
  'types.ts'
];
const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
const [ahead, behind] = git('rev-list', '--left-right', '--count', `HEAD...${upstream}`)
  .split(/\s+/)
  .map(Number);
const baselineCaptureOwnedPaths = new Set([
  path.relative(repoRoot, outputPath),
  'scripts/captureProviderFreeBaseline.mjs'
]);
const openingStatus = git('status', '--short', '--branch', '--untracked-files=all')
  .split('\n')
  .filter(Boolean)
  .filter((line) => {
    const statusPath = line.startsWith('##') ? '' : line.slice(3);
    return !baselineCaptureOwnedPaths.has(statusPath);
  });
const indexEntries = git('diff', '--cached', '--name-status')
  .split('\n')
  .filter(Boolean);

const manifest = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  providerCalls: 0,
  repository: {
    branch: git('branch', '--show-current'),
    head: git('rev-parse', 'HEAD'),
    upstream,
    ahead,
    behind,
    indexEntries,
    baselineCaptureOwnedPaths: Array.from(baselineCaptureOwnedPaths),
    openingStatus
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch
  },
  verification: [
    { command: 'npm run build', exitCode: 0, observedInOpeningProtocol: true },
    { command: 'npm run verify:all', exitCode: 0, observedInOpeningProtocol: true }
  ],
  sourceHashes: Object.fromEntries(
    sourceSurfaces.map((relativePath) => [relativePath, fileSha256(relativePath)])
  ),
  fixtureOutputs,
  malformedPayloads
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, stableJson(manifest), 'utf8');
console.log(path.relative(repoRoot, outputPath));
