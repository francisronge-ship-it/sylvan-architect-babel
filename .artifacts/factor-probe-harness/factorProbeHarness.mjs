import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FACTOR_KEYS = Object.freeze([
  'restructuring',
  'values',
  'priorAnchors',
  'fieldNameWording',
  'carrier',
  'dormantSkeletonUse'
]);

export const SETTLED_FIELD_IDENTITIES = Object.freeze({
  priorAnchors: 'priorAnchors',
  values: 'values'
});

export const AUTHORED_STAGE_FIELDS = Object.freeze([
  'statement',
  'stageRecord',
  'visualRelations',
  'workspaceForest'
]);

const SHA256_RE = /^[a-f0-9]{64}$/u;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const FORBIDDEN_PLAN_KEYS = new Set([
  'winner',
  'score',
  'sampleSize',
  'reviewerCount',
  'publicationRule',
  'modelRoster',
  'tierPolicy'
]);

const isPlainObject = (value) => Boolean(
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype
);

const fail = (message) => {
  const error = new Error(message);
  error.code = 'INVALID_FACTOR_PROBE_CONFIG';
  throw error;
};

const requirePlainObject = (value, fieldPath) => {
  if (!isPlainObject(value)) fail(`${fieldPath} must be an object.`);
  return value;
};

const requireNonEmptyString = (value, fieldPath) => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${fieldPath} must be a non-empty string.`);
  }
  return value;
};

const requireSafeId = (value, fieldPath) => {
  requireNonEmptyString(value, fieldPath);
  if (!SAFE_ID_RE.test(value)) {
    fail(`${fieldPath} must contain only safe receipt-id characters.`);
  }
  return value;
};

const requireSha256 = (value, fieldPath) => {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(`${fieldPath} must be a lowercase SHA-256 digest.`);
  }
  return value;
};

const requireRepoRelativeRef = (value, fieldPath) => {
  requireNonEmptyString(value, fieldPath);
  if (
    path.isAbsolute(value)
    || value.split(/[\\/]/u).includes('..')
    || value.includes('\0')
  ) {
    fail(`${fieldPath} must be a repository-relative path without traversal.`);
  }
  return value;
};

export const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => typeof value[key] !== 'undefined')
      .map((key) => [key, canonicalize(value[key])])
  );
};

export const canonicalJson = (value) => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

export const sha256 = (value) => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

const clone = (value) => structuredClone(value);
const VOLATILE_PROVENANCE_FIELDS = Object.freeze([
  'timestamp',
  'promptVersion',
  'parserVersion',
  'uiVersion'
]);

const stripVolatileProvenance = (bundle) => {
  const stableBundle = clone(bundle);
  for (const analysis of stableBundle.analyses || []) {
    if (!analysis.provenance || typeof analysis.provenance !== 'object') continue;
    for (const field of VOLATILE_PROVENANCE_FIELDS) {
      delete analysis.provenance[field];
    }
  }
  return stableBundle;
};

const assertNoPolicyConclusions = (value, fieldPath = '$') => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPolicyConclusions(item, `${fieldPath}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PLAN_KEYS.has(key)) {
      fail(`${fieldPath}.${key} is decision policy, not factor-harness input.`);
    }
    assertNoPolicyConclusions(child, `${fieldPath}.${key}`);
  }
};

const validateContractBoundary = (contract) => {
  requirePlainObject(contract, '$.contract');
  const stageFields = contract.authoredStageFields;
  if (!Array.isArray(stageFields) || stageFields.length !== AUTHORED_STAGE_FIELDS.length) {
    fail('$.contract.authoredStageFields must declare the settled four-field baseline.');
  }
  if (stageFields.some((field, index) => field !== AUTHORED_STAGE_FIELDS[index])) {
    fail('$.contract.authoredStageFields must preserve the settled four-field order and names.');
  }
  if (
    !isPlainObject(contract.settledFieldIdentities)
    || contract.settledFieldIdentities.values !== SETTLED_FIELD_IDENTITIES.values
    || contract.settledFieldIdentities.priorAnchors !== SETTLED_FIELD_IDENTITIES.priorAnchors
    || Object.keys(contract.settledFieldIdentities).length !== 2
  ) {
    fail('$.contract.settledFieldIdentities must keep values and priorAnchors unchanged.');
  }
  if (contract.productionContractMutationAllowed !== false) {
    fail('$.contract.productionContractMutationAllowed must be false for this harness.');
  }
};

const validateRunnerIdentity = (identity, fieldPath) => {
  requirePlainObject(identity, fieldPath);
  requireNonEmptyString(identity.provider, `${fieldPath}.provider`);
  requireNonEmptyString(identity.model, `${fieldPath}.model`);
  requireNonEmptyString(identity.host, `${fieldPath}.host`);
  requireNonEmptyString(identity.suppliedBy, `${fieldPath}.suppliedBy`);
  const reasoning = requirePlainObject(identity.reasoning, `${fieldPath}.reasoning`);
  requireNonEmptyString(reasoning.identity, `${fieldPath}.reasoning.identity`);
  requirePlainObject(reasoning.parameters, `${fieldPath}.reasoning.parameters`);
};

const validateInput = (input, fieldPath) => {
  requirePlainObject(input, fieldPath);
  requireNonEmptyString(input.sentence, `${fieldPath}.sentence`);
  requireNonEmptyString(input.framework, `${fieldPath}.framework`);
  requireNonEmptyString(input.fixtureRole, `${fieldPath}.fixtureRole`);
  if (input.fixtureRole !== 'provider-free-development-fixture') {
    fail(`${fieldPath}.fixtureRole must identify non-benchmark development evidence.`);
  }
  requireRepoRelativeRef(input.sourceRef, `${fieldPath}.sourceRef`);
  requireSha256(input.sourceSha256, `${fieldPath}.sourceSha256`);
};

const validateFactorAssignments = (factors, fieldPath) => {
  requirePlainObject(factors, fieldPath);
  const actualKeys = Object.keys(factors).sort();
  const expectedKeys = [...FACTOR_KEYS].sort();
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail(`${fieldPath} must assign exactly: ${FACTOR_KEYS.join(', ')}.`);
  }
  for (const factor of FACTOR_KEYS) {
    const assignment = requirePlainObject(factors[factor], `${fieldPath}.${factor}`);
    requireNonEmptyString(assignment.level, `${fieldPath}.${factor}.level`);
    requireNonEmptyString(assignment.materialId, `${fieldPath}.${factor}.materialId`);
    requireSha256(assignment.materialSha256, `${fieldPath}.${factor}.materialSha256`);
    const assignmentKeys = Object.keys(assignment).sort();
    if (
      assignmentKeys.length !== 3
      || assignmentKeys.join(',') !== 'level,materialId,materialSha256'
    ) {
      fail(`${fieldPath}.${factor} may contain only level, materialId, and materialSha256.`);
    }
  }
};

const validateRun = (run, index) => {
  const fieldPath = `$.runs[${index}]`;
  requirePlainObject(run, fieldPath);
  requireSafeId(run.id, `${fieldPath}.id`);
  if (!['baseline', 'factor-arm', 'diagnostic'].includes(run.role)) {
    fail(`${fieldPath}.role must be baseline, factor-arm, or diagnostic.`);
  }
  validateInput(run.input, `${fieldPath}.input`);
  validateRunnerIdentity(run.runnerIdentity, `${fieldPath}.runnerIdentity`);
  validateFactorAssignments(run.factors, `${fieldPath}.factors`);
  const artifacts = requirePlainObject(run.artifacts, `${fieldPath}.artifacts`);
  for (const name of [
    'systemInstructionSha256',
    'contentsPromptSha256',
    'contractSha256',
    'engineSha256'
  ]) {
    requireSha256(artifacts[name], `${fieldPath}.artifacts.${name}`);
  }
  const stub = requirePlainObject(run.stub, `${fieldPath}.stub`);
  if (!['fixture-payload-json', 'fixture-file-bytes', 'inline-utf8'].includes(stub.kind)) {
    fail(`${fieldPath}.stub.kind is not a provider-free stub transport.`);
  }
  if (stub.kind === 'inline-utf8') {
    requireNonEmptyString(stub.text, `${fieldPath}.stub.text`);
  } else {
    requireRepoRelativeRef(stub.sourceRef, `${fieldPath}.stub.sourceRef`);
    requireSha256(stub.sourceSha256, `${fieldPath}.stub.sourceSha256`);
  }
};

const factorAssignmentDigest = (run, factor) => sha256(canonicalJson(run.factors[factor]));

export const changedFactorsBetweenRuns = (baselineRun, targetRun) => FACTOR_KEYS.filter(
  (factor) => factorAssignmentDigest(baselineRun, factor) !== factorAssignmentDigest(targetRun, factor)
);

const sameComparisonCondition = (left, right) => (
  sha256(canonicalJson(left.input)) === sha256(canonicalJson(right.input))
  && sha256(canonicalJson(left.runnerIdentity)) === sha256(canonicalJson(right.runnerIdentity))
  && left.artifacts.engineSha256 === right.artifacts.engineSha256
);

const validateComparisons = (plan) => {
  if (!Array.isArray(plan.comparisons) || plan.comparisons.length === 0) {
    fail('$.comparisons must declare at least one attribution comparison.');
  }
  const runById = new Map(plan.runs.map((run) => [run.id, run]));
  const comparisonIds = new Set();
  for (let index = 0; index < plan.comparisons.length; index += 1) {
    const comparison = requirePlainObject(plan.comparisons[index], `$.comparisons[${index}]`);
    requireSafeId(comparison.id, `$.comparisons[${index}].id`);
    if (comparisonIds.has(comparison.id)) fail(`Duplicate comparison id: ${comparison.id}.`);
    comparisonIds.add(comparison.id);
    if (comparison.mode !== 'single-factor') {
      fail(`$.comparisons[${index}].mode must be single-factor.`);
    }
    if (!FACTOR_KEYS.includes(comparison.factor)) {
      fail(`$.comparisons[${index}].factor is unknown.`);
    }
    const baselineRun = runById.get(comparison.baselineRunId);
    const targetRun = runById.get(comparison.targetRunId);
    if (!baselineRun || !targetRun) {
      fail(`$.comparisons[${index}] references an unknown run.`);
    }
    if (!sameComparisonCondition(baselineRun, targetRun)) {
      fail(`$.comparisons[${index}] changes input, runner identity, or engine identity.`);
    }
    const changedFactors = changedFactorsBetweenRuns(baselineRun, targetRun);
    if (changedFactors.length !== 1 || changedFactors[0] !== comparison.factor) {
      fail(
        `$.comparisons[${index}] is confounded; expected only ${comparison.factor}, changed ${changedFactors.join(', ') || 'none'}.`
      );
    }
  }
};

export const validateFactorProbePlan = (inputPlan) => {
  const plan = clone(inputPlan);
  requirePlainObject(plan, '$');
  assertNoPolicyConclusions(plan);
  if (plan.schemaVersion !== 1) fail('$.schemaVersion must be 1.');
  requireSafeId(plan.planId, '$.planId');
  if (plan.intent !== 'attribution-only-provider-neutral-probe') {
    fail('$.intent must be attribution-only-provider-neutral-probe.');
  }
  validateContractBoundary(plan.contract);
  if (!Array.isArray(plan.runs) || plan.runs.length < 2) {
    fail('$.runs must contain a baseline and at least one arm.');
  }
  plan.runs.forEach(validateRun);
  const runIds = plan.runs.map((run) => run.id);
  if (new Set(runIds).size !== runIds.length) fail('$.runs contains duplicate ids.');
  validateComparisons(plan);
  return plan;
};

const describeError = (error) => ({
  code: typeof error?.code === 'string' ? error.code : '',
  failure: error?.failure && typeof error.failure === 'object'
    ? clone(error.failure)
    : null,
  message: error instanceof Error ? error.message : String(error),
  name: typeof error?.name === 'string' ? error.name : 'Error',
  rawOutput: error?.rawOutput && typeof error.rawOutput === 'object'
    ? clone(error.rawOutput)
    : null,
  status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null
});

const writeRawArchive = (outputRoot, runId, rawBytes) => {
  const relativePath = path.posix.join('raw', `${runId}.bin`);
  const absolutePath = path.join(outputRoot, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, rawBytes);
  const readBack = fs.readFileSync(absolutePath);
  if (!readBack.equals(rawBytes)) {
    throw new Error(`Raw output archive mismatch for ${runId}.`);
  }
  return relativePath;
};

export const executeFactorProbePlan = async ({
  plan: inputPlan,
  outputRoot,
  transport,
  parseAndCompile
}) => {
  const plan = validateFactorProbePlan(inputPlan);
  requireNonEmptyString(outputRoot, 'outputRoot');
  if (typeof transport !== 'function') fail('transport must be a function.');
  if (typeof parseAndCompile !== 'function') fail('parseAndCompile must be a function.');
  fs.mkdirSync(outputRoot, { recursive: true });

  const runReceipts = [];
  for (const run of plan.runs) {
    const transportResult = await transport(clone(run));
    if (!Buffer.isBuffer(transportResult?.rawBytes)) {
      throw new Error(`Transport for ${run.id} did not return raw Buffer bytes.`);
    }
    const rawBytes = transportResult.rawBytes;
    const rawSha256 = sha256(rawBytes);
    if (
      transportResult.declaredRawSha256
      && transportResult.declaredRawSha256 !== rawSha256
    ) {
      throw new Error(`Transport raw-byte declaration mismatch for ${run.id}.`);
    }
    const archiveRelativePath = writeRawArchive(outputRoot, run.id, rawBytes);
    const evaluation = await parseAndCompile({
      rawBytes,
      run: clone(run)
    });
    runReceipts.push({
      artifacts: clone(run.artifacts),
      factorAssignmentSha256: sha256(canonicalJson(run.factors)),
      factors: clone(run.factors),
      generation: {
        attempts: clone(transportResult.attempts || []),
        finishReason: transportResult.finishReason ?? null,
        usage: clone(transportResult.usage || {})
      },
      input: clone(run.input),
      parseOutcome: clone(evaluation.parseOutcome),
      compileOutcome: clone(evaluation.compileOutcome),
      provenance: {
        runnerIdentity: clone(run.runnerIdentity),
        transport: clone(transportResult.provenance || {})
      },
      rawOutput: {
        archiveRelativePath,
        byteLength: rawBytes.byteLength,
        sha256: rawSha256
      },
      role: run.role,
      runId: run.id
    });
  }

  const receiptByRunId = new Map(runReceipts.map((receipt) => [receipt.runId, receipt]));
  const runById = new Map(plan.runs.map((run) => [run.id, run]));
  const comparisonReceipts = plan.comparisons.map((comparison) => {
    const changedFactors = changedFactorsBetweenRuns(
      runById.get(comparison.baselineRunId),
      runById.get(comparison.targetRunId)
    );
    return {
      attributionEligible: changedFactors.length === 1 && changedFactors[0] === comparison.factor,
      baselineOutcome: {
        compile: receiptByRunId.get(comparison.baselineRunId).compileOutcome.status,
        parse: receiptByRunId.get(comparison.baselineRunId).parseOutcome.status
      },
      baselineRunId: comparison.baselineRunId,
      changedFactors,
      comparisonId: comparison.id,
      factor: comparison.factor,
      mode: comparison.mode,
      targetOutcome: {
        compile: receiptByRunId.get(comparison.targetRunId).compileOutcome.status,
        parse: receiptByRunId.get(comparison.targetRunId).parseOutcome.status
      },
      targetRunId: comparison.targetRunId
    };
  });

  const semantic = {
    comparisons: comparisonReceipts,
    contract: clone(plan.contract),
    factorKeys: [...FACTOR_KEYS],
    intent: plan.intent,
    planId: plan.planId,
    planSha256: sha256(canonicalJson(plan)),
    runs: runReceipts
  };
  const receipt = {
    schemaVersion: 1,
    semantic,
    semanticSha256: sha256(canonicalJson(semantic))
  };
  fs.writeFileSync(path.join(outputRoot, 'receipt.json'), canonicalJson(receipt));
  return receipt;
};

export const createParserAdapter = (parserTest) => async ({ rawBytes, run }) => {
  const rawText = rawBytes.toString('utf8');
  let parsedValue;
  try {
    parsedValue = parserTest.parseModelJson(rawText);
  } catch (error) {
    return {
      parseOutcome: {
        error: describeError(error),
        status: 'rejected'
      },
      compileOutcome: {
        status: 'not-attempted'
      }
    };
  }

  const parsedValueSha256 = sha256(canonicalJson(parsedValue));
  try {
    const bundle = parserTest.normalizeParseBundle(
      parsedValue,
      run.input.framework,
      run.input.sentence,
      run.runnerIdentity.provider,
      true,
      { payloadIntegrityFlags: [] }
    );
    const compiledAnalysesStages = (bundle.analyses || []).map((analysis) => (
      Array.isArray(analysis?.derivationStages) ? analysis.derivationStages : []
    ));
    const authoredFieldSets = compiledAnalysesStages.map((stages) => (
      stages.map((stage) => Object.keys(stage))
    ));
    const fourFieldContractPreserved = authoredFieldSets.flat().every(
      (fields) => (
        fields.length === AUTHORED_STAGE_FIELDS.length
        && fields.every((field, index) => field === AUTHORED_STAGE_FIELDS[index])
      )
    );
    const decodedAnalysesStages = Array.isArray(parsedValue?.derivationStages)
      ? [parsedValue.derivationStages]
      : Array.isArray(parsedValue?.analyses)
        ? parsedValue.analyses.map((analysis) => analysis?.derivationStages)
        : null;
    const decodedAuthoredStagesSha256 = decodedAnalysesStages
      ? sha256(canonicalJson(decodedAnalysesStages))
      : null;
    const compiledAuthoredStagesSha256 = sha256(canonicalJson(compiledAnalysesStages));
    const compiledProjectionFieldIdentity = decodedAnalysesStages
      ? AUTHORED_STAGE_FIELDS.map((field) => ({
        field,
        identical: decodedAnalysesStages.every(
          (stages, analysisIndex) => stages.every(
            (stage, stageIndex) => (
              sha256(canonicalJson(stage[field]))
              === sha256(
                canonicalJson(compiledAnalysesStages[analysisIndex]?.[stageIndex]?.[field])
              )
            )
          )
        )
      }))
      : null;
    return {
      parseOutcome: {
        decodedAuthoredStagesSha256,
        decodedValueSha256: parsedValueSha256,
        status: 'accepted'
      },
      compileOutcome: {
        authoredFieldSets,
        compiledAuthoredStagesSha256,
        compiledProjectionFieldIdentity,
        decodedAuthoredDataArchived: Boolean(decodedAnalysesStages),
        bundleSha256: sha256(canonicalJson(stripVolatileProvenance(bundle))),
        fourFieldContractPreserved,
        status: 'accepted'
      }
    };
  } catch (error) {
    return {
      parseOutcome: {
        decodedValueSha256: parsedValueSha256,
        status: 'accepted'
      },
      compileOutcome: {
        error: describeError(error),
        status: 'rejected'
      }
    };
  }
};
