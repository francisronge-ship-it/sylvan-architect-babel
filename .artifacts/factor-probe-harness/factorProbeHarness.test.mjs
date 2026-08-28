import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { __test__ as parserTest } from '../../server/babelParser.js';
import {
  AUTHORED_STAGE_FIELDS,
  FACTOR_KEYS,
  SETTLED_FIELD_IDENTITIES,
  canonicalJson,
  createParserAdapter,
  executeFactorProbePlan,
  sha256,
  validateFactorProbePlan
} from './factorProbeHarness.mjs';
import { buildStubPlan } from './stubPlan.mjs';
import { createProviderFreeStubTransport } from './stubTransport.mjs';

const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(harnessDir, '../..');
const clone = (value) => structuredClone(value);

const expectInvalid = (mutate, pattern) => {
  const plan = buildStubPlan(repoRoot);
  mutate(plan);
  assert.throws(
    () => validateFactorProbePlan(plan),
    (error) => error?.code === 'INVALID_FACTOR_PROBE_CONFIG' && pattern.test(error.message)
  );
};

test('factor registry covers the bounded tranche axes and remaining W3 wording rules', () => {
  assert.deepEqual(FACTOR_KEYS, [
    'restructuring',
    'values',
    'priorAnchors',
    'fieldNameWording',
    'carrier',
    'dormantSkeletonUse',
    'incompleteLeafRule',
    'ambiguityCriterion',
    'xbarNaryEscape'
  ]);
});

test('contract boundary keeps the four authored fields and settled identities unchanged', () => {
  const plan = validateFactorProbePlan(buildStubPlan(repoRoot));
  assert.deepEqual(plan.contract.authoredStageFields, AUTHORED_STAGE_FIELDS);
  assert.deepEqual(plan.contract.settledFieldIdentities, SETTLED_FIELD_IDENTITIES);
  assert.equal(plan.contract.productionContractMutationAllowed, false);
});

test('rejects an unknown factor assignment', () => {
  expectInvalid((plan) => {
    plan.runs[0].factors.unapprovedFactor = {
      level: 'probe',
      materialId: 'unapproved',
      materialSha256: '0'.repeat(64)
    };
  }, /assign exactly/u);
});

test('rejects a missing factor assignment', () => {
  expectInvalid((plan) => {
    delete plan.runs[0].factors.values;
  }, /assign exactly/u);
});

test('rejects any attempted rename of settled field identities', () => {
  expectInvalid((plan) => {
    plan.contract.settledFieldIdentities.values = 'valueCandidates';
  }, /keep values and priorAnchors unchanged/u);
});

test('rejects a confounded single-factor comparison', () => {
  expectInvalid((plan) => {
    const target = plan.runs.find((run) => run.id === 'factor-values');
    target.factors.priorAnchors = {
      level: 'also-changed',
      materialId: 'confound',
      materialSha256: '1'.repeat(64)
    };
  }, /confounded/u);
});

test('rejects hardcoded decision, roster, sizing, review, and publication policy', () => {
  for (const key of [
    'winner',
    'score',
    'sampleSize',
    'reviewerCount',
    'publicationRule',
    'modelRoster',
    'tierPolicy'
  ]) {
    expectInvalid((plan) => {
      plan[key] = 'forbidden';
    }, /decision policy/u);
  }
});

test('rejects incomplete externally supplied runner identity', () => {
  expectInvalid((plan) => {
    delete plan.runs[0].runnerIdentity.reasoning.identity;
  }, /reasoning.identity must be a non-empty string/u);
});

test('rejects fixture path traversal', () => {
  expectInvalid((plan) => {
    plan.runs[0].stub.sourceRef = '../outside.json';
  }, /repository-relative path without traversal/u);
});

test('effective prompt and contract hashes may vary only as recorded arm provenance', () => {
  const plan = buildStubPlan(repoRoot);
  const target = plan.runs.find((run) => run.id === 'factor-fieldNameWording');
  target.artifacts.systemInstructionSha256 = '2'.repeat(64);
  target.artifacts.contentsPromptSha256 = '3'.repeat(64);
  assert.doesNotThrow(() => validateFactorProbePlan(plan));
});

test('provider-free stub run archives raw bytes and emits comparison-ready outcomes', async (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-factor-probe-'));
  t.after(() => fs.rmSync(outputRoot, { force: true, recursive: true }));
  const receipt = await executeFactorProbePlan({
    outputRoot,
    parseAndCompile: createParserAdapter(parserTest),
    plan: buildStubPlan(repoRoot),
    transport: createProviderFreeStubTransport(repoRoot)
  });
  assert.equal(receipt.semantic.comparisons.length, 15);
  receipt.semantic.comparisons.forEach((comparison) => {
    assert.equal(comparison.attributionEligible, true);
    assert.deepEqual(comparison.changedFactors, comparison.factors);
  });
  const acceptedRuns = receipt.semantic.runs.filter((run) => run.role !== 'diagnostic');
  acceptedRuns.forEach((run) => {
    assert.equal(run.parseOutcome.status, 'accepted');
    assert.equal(run.compileOutcome.status, 'accepted');
    assert.equal(run.compileOutcome.decodedAuthoredDataArchived, true);
    assert.equal(run.compileOutcome.fourFieldContractPreserved, true);
    assert.deepEqual(
      run.compileOutcome.compiledProjectionFieldIdentity,
      [
        { field: 'statement', identical: true },
        { field: 'stageRecord', identical: true },
        { field: 'visualRelations', identical: true },
        { field: 'workspaceForest', identical: false }
      ]
    );
    assert.match(run.parseOutcome.decodedAuthoredStagesSha256, /^[a-f0-9]{64}$/u);
    assert.match(run.compileOutcome.compiledAuthoredStagesSha256, /^[a-f0-9]{64}$/u);
    const archived = fs.readFileSync(path.join(outputRoot, run.rawOutput.archiveRelativePath));
    assert.equal(sha256(archived), run.rawOutput.sha256);
  });
  const contractDiagnostic = receipt.semantic.runs.find(
    (run) => run.runId === 'diagnostic-contract-envelope'
  );
  assert.equal(contractDiagnostic.parseOutcome.status, 'accepted');
  assert.equal(contractDiagnostic.compileOutcome.status, 'rejected');
  assert.equal(
    contractDiagnostic.compileOutcome.error.failure.class,
    'contract_misunderstanding'
  );
  const parseDiagnostic = receipt.semantic.runs.find(
    (run) => run.runId === 'diagnostic-invalid-json'
  );
  assert.equal(parseDiagnostic.parseOutcome.status, 'rejected');
  assert.equal(parseDiagnostic.compileOutcome.status, 'not-attempted');
  assert.equal(
    parseDiagnostic.parseOutcome.error.failure.class,
    'transport_serialization'
  );
});

test('stub program carries self-pair, interaction, and sequential attribution without conclusions', () => {
  const plan = validateFactorProbePlan(buildStubPlan(repoRoot));
  const modes = plan.comparisons.map(({ mode }) => mode);
  assert.equal(modes.filter((mode) => mode === 'self-pair').length, 1);
  assert.equal(modes.filter((mode) => mode === 'multi-factor').length, 1);
  assert.equal(modes.filter((mode) => mode === 'single-factor').length, 13);
  assert.equal(JSON.stringify(plan).includes('winner'), false);
  assert.equal(JSON.stringify(plan).includes('adopted'), false);
});

test('self-pair comparison rejects changed prompt or contract material', () => {
  expectInvalid((plan) => {
    const selfPair = plan.runs.find((run) => run.id === 'baseline-self-pair');
    selfPair.artifacts = {
      ...selfPair.artifacts,
      contractSha256: '4'.repeat(64)
    };
  }, /self-pair must preserve all material artifact hashes/u);
});

test('identical stub plans produce identical semantic receipts', async (t) => {
  const outputRoots = [];
  t.after(() => {
    outputRoots.forEach((outputRoot) => fs.rmSync(outputRoot, { force: true, recursive: true }));
  });
  const run = async () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-factor-repeat-'));
    outputRoots.push(outputRoot);
    return executeFactorProbePlan({
      outputRoot,
      parseAndCompile: createParserAdapter(parserTest),
      plan: buildStubPlan(repoRoot),
      transport: createProviderFreeStubTransport(repoRoot)
    });
  };
  const first = await run();
  const second = await run();
  assert.equal(first.semanticSha256, second.semanticSha256);
  assert.equal(canonicalJson(first.semantic), canonicalJson(second.semantic));
});
