import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData,
  isPlainRecord
} from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertTextChoice,
  assertUniqueTextArray
} from './benchmarkValidation.js';
import { STUB_BOUNDARIES } from './stubs.js';

const PLAN_FIELDS = Object.freeze([
  'simulationId',
  'posteriorFitReceiptSha256',
  'posteriorDrawsSha256',
  'posteriorSelection',
  'designCandidates',
  'targetSpecifications',
  'simulatorSpecification',
  'executionSpecification',
  'provenance'
]);
const SELECTION_FIELDS = Object.freeze(['selectionId', 'sourceRef', 'drawIds']);
const CANDIDATE_FIELDS = Object.freeze(['candidateId', 'design', 'designSha256']);
const TARGET_FIELDS = Object.freeze([
  'targetId',
  'metricId',
  'comparator',
  'threshold',
  'sourceRef'
]);
const SIMULATOR_FIELDS = Object.freeze([
  'simulatorId',
  'implementationRef',
  'configuration',
  'configurationSha256'
]);
const EXECUTION_FIELDS = Object.freeze([
  'executionId',
  'environmentIdentity',
  'randomScheduleIdentity',
  'randomScheduleSourceRef'
]);
const CELL_BINDING_FIELDS = Object.freeze([
  'status',
  'simulationPlanSha256',
  'posteriorDrawsSha256',
  'executionId',
  'candidateId',
  'candidateDesignSha256',
  'drawId',
  'provenance'
]);
const SIMULATED_CELL_FIELDS = Object.freeze([
  ...CELL_BINDING_FIELDS,
  'metrics'
]);
const NOT_SIMULATED_CELL_FIELDS = Object.freeze([
  ...CELL_BINDING_FIELDS,
  'failureIdentity',
  'failureSourceRef',
  'details'
]);
const AVAILABLE_POSTERIOR_FIELDS = Object.freeze([
  'status',
  'drawCount',
  'drawsSha256',
  'draws',
  'diagnostics'
]);

const sha256CanonicalJson = (value) => {
  const validated = copyJsonData(value, 'S2 hash input');
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeJsonData(validated)))
    .digest('hex');
};

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const verifyHashBinding = (value, expectedSha256, path) => {
  assertSha256(expectedSha256, `${path}Sha256`);
  if (sha256CanonicalJson(value) !== expectedSha256) {
    throw new TypeError(`${path} does not match its declared SHA-256.`);
  }
};

const normalizeCandidates = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new TypeError('S2 simulation plan.designCandidates must be non-empty.');
  }
  const candidateIds = [];
  const designHashes = [];
  const normalized = candidates.map((candidate, index) => {
    const path = `S2 simulation plan.designCandidates[${index}]`;
    assertExactFields(candidate, CANDIDATE_FIELDS, path);
    assertNonemptyText(candidate.candidateId, `${path}.candidateId`);
    assertJsonRecord(candidate.design, `${path}.design`);
    verifyHashBinding(candidate.design, candidate.designSha256, `${path}.design`);
    candidateIds.push(candidate.candidateId);
    designHashes.push(candidate.designSha256);
    return copyJsonData(candidate, path);
  });
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new TypeError('S2 simulation plan.designCandidates must use unique candidateId values.');
  }
  if (new Set(designHashes).size !== designHashes.length) {
    throw new TypeError('S2 simulation plan.designCandidates must not duplicate designs.');
  }
  return normalized;
};

const normalizeTargets = (targets) => {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new TypeError('S2 simulation plan.targetSpecifications must be non-empty.');
  }
  const targetIds = [];
  const targetTuples = [];
  const normalized = targets.map((target, index) => {
    const path = `S2 simulation plan.targetSpecifications[${index}]`;
    assertExactFields(target, TARGET_FIELDS, path);
    assertNonemptyText(target.targetId, `${path}.targetId`);
    assertNonemptyText(target.metricId, `${path}.metricId`);
    assertTextChoice(target.comparator, ['at-least', 'at-most'], `${path}.comparator`);
    if (typeof target.threshold !== 'number' || !Number.isFinite(target.threshold)) {
      throw new TypeError(`${path}.threshold must be finite.`);
    }
    assertNonemptyText(target.sourceRef, `${path}.sourceRef`);
    targetIds.push(target.targetId);
    targetTuples.push(JSON.stringify([
      target.metricId,
      target.comparator,
      target.threshold
    ]));
    return copyJsonData(target, path);
  });
  if (new Set(targetIds).size !== targetIds.length) {
    throw new TypeError('S2 simulation plan.targetSpecifications must use unique targetId values.');
  }
  if (new Set(targetTuples).size !== targetTuples.length) {
    throw new TypeError('S2 simulation plan.targetSpecifications must not duplicate targets.');
  }
  return normalized;
};

export const hashS2SimulationData = (value) => sha256CanonicalJson(value);

export const createS2SimulationPlan = (input) => {
  assertExactFields(input, PLAN_FIELDS, 'S2 simulation plan');
  assertNonemptyText(input.simulationId, 'S2 simulation plan.simulationId');
  assertSha256(
    input.posteriorFitReceiptSha256,
    'S2 simulation plan.posteriorFitReceiptSha256'
  );
  assertSha256(input.posteriorDrawsSha256, 'S2 simulation plan.posteriorDrawsSha256');

  assertExactFields(
    input.posteriorSelection,
    SELECTION_FIELDS,
    'S2 simulation plan.posteriorSelection'
  );
  assertNonemptyText(
    input.posteriorSelection.selectionId,
    'S2 simulation plan.posteriorSelection.selectionId'
  );
  assertNonemptyText(
    input.posteriorSelection.sourceRef,
    'S2 simulation plan.posteriorSelection.sourceRef'
  );
  assertUniqueTextArray(
    input.posteriorSelection.drawIds,
    'S2 simulation plan.posteriorSelection.drawIds'
  );

  const designCandidates = normalizeCandidates(input.designCandidates);
  const targetSpecifications = normalizeTargets(input.targetSpecifications);

  assertExactFields(
    input.simulatorSpecification,
    SIMULATOR_FIELDS,
    'S2 simulation plan.simulatorSpecification'
  );
  assertNonemptyText(
    input.simulatorSpecification.simulatorId,
    'S2 simulation plan.simulatorSpecification.simulatorId'
  );
  assertNonemptyText(
    input.simulatorSpecification.implementationRef,
    'S2 simulation plan.simulatorSpecification.implementationRef'
  );
  assertJsonRecord(
    input.simulatorSpecification.configuration,
    'S2 simulation plan.simulatorSpecification.configuration'
  );
  verifyHashBinding(
    input.simulatorSpecification.configuration,
    input.simulatorSpecification.configurationSha256,
    'S2 simulation plan.simulatorSpecification.configuration'
  );

  assertExactFields(
    input.executionSpecification,
    EXECUTION_FIELDS,
    'S2 simulation plan.executionSpecification'
  );
  for (const field of EXECUTION_FIELDS) {
    assertNonemptyText(
      input.executionSpecification[field],
      `S2 simulation plan.executionSpecification.${field}`
    );
  }
  assertJsonRecord(input.provenance, 'S2 simulation plan.provenance');

  const body = copyJsonData({
    ...input,
    designCandidates,
    targetSpecifications
  }, 'S2 simulation plan');
  return freezeJsonData({
    ...body,
    planSha256: sha256CanonicalJson(body)
  });
};

const normalizePosteriorDraws = (draws, expectedSha256, selectedDrawIds) => {
  if (!Array.isArray(draws) || draws.length === 0) {
    throw new TypeError('S2 posteriorDraws must be a non-empty array.');
  }
  const normalized = copyJsonData(draws, 'S2 posteriorDraws');
  const drawIds = normalized.map((draw, index) => {
    if (!isPlainRecord(draw)) {
      throw new TypeError(`S2 posteriorDraws[${index}] must be an object.`);
    }
    assertNonemptyText(draw.drawId, `S2 posteriorDraws[${index}].drawId`);
    return draw.drawId;
  });
  if (new Set(drawIds).size !== drawIds.length) {
    throw new TypeError('S2 posteriorDraws must use unique drawId values.');
  }
  verifyHashBinding(normalized, expectedSha256, 'S2 posteriorDraws');
  const drawById = new Map(normalized.map((draw) => [draw.drawId, draw]));
  selectedDrawIds.forEach((drawId, index) => {
    if (!drawById.has(drawId)) {
      throw new TypeError(
        `S2 simulation plan.posteriorSelection.drawIds[${index}] is not in posteriorDraws.`
      );
    }
  });
  return drawById;
};

const validatePosteriorFitReceipt = (receipt, plan) => {
  if (!isPlainRecord(receipt)) {
    throw new TypeError('S2 posteriorFitReceipt must be an object.');
  }
  assertSha256(receipt.receiptSha256, 'S2 posteriorFitReceipt.receiptSha256');
  if (receipt.receiptSha256 !== plan.posteriorFitReceiptSha256) {
    throw new TypeError(
      'S2 posteriorFitReceipt.receiptSha256 does not match the simulation plan.'
    );
  }
  const { receiptSha256: _receiptSha256, ...body } = receipt;
  if (sha256CanonicalJson(body) !== receipt.receiptSha256) {
    throw new TypeError('S2 posteriorFitReceipt fails canonical reconstruction.');
  }
  if (!isPlainRecord(receipt.posterior) || receipt.posterior.status !== 'available') {
    throw new TypeError('S2 posteriorFitReceipt must contain an available posterior.');
  }
  assertExactFields(
    receipt.posterior,
    AVAILABLE_POSTERIOR_FIELDS,
    'S2 posteriorFitReceipt.posterior'
  );
  if (
    !Array.isArray(receipt.posterior.draws)
    || receipt.posterior.draws.length === 0
    || receipt.posterior.drawCount !== receipt.posterior.draws.length
  ) {
    throw new TypeError(
      'S2 posteriorFitReceipt.posterior.drawCount must match its non-empty draws.'
    );
  }
  assertJsonRecord(
    receipt.posterior.diagnostics,
    'S2 posteriorFitReceipt.posterior.diagnostics'
  );
  verifyHashBinding(
    receipt.posterior.draws,
    receipt.posterior.drawsSha256,
    'S2 posteriorFitReceipt.posterior.draws'
  );
  if (receipt.posterior.drawsSha256 !== plan.posteriorDrawsSha256) {
    throw new TypeError(
      'S2 posteriorFitReceipt.posterior.drawsSha256 does not match the simulation plan.'
    );
  }
};

const cellKey = (candidateId, drawId) => JSON.stringify([candidateId, drawId]);

const normalizeCellResult = ({
  result,
  plan,
  candidate,
  drawId,
  metricIds
}) => {
  if (!isPlainRecord(result)) throw new TypeError('S2 simulator cell result must be an object.');
  if (result.status !== 'simulated' && result.status !== 'not-simulated') {
    throw new TypeError('S2 simulator cell result.status must be simulated or not-simulated.');
  }
  assertExactFields(
    result,
    result.status === 'simulated'
      ? SIMULATED_CELL_FIELDS
      : NOT_SIMULATED_CELL_FIELDS,
    'S2 simulator cell result'
  );
  const expectedBindings = {
    simulationPlanSha256: plan.planSha256,
    posteriorDrawsSha256: plan.posteriorDrawsSha256,
    executionId: plan.executionSpecification.executionId,
    candidateId: candidate.candidateId,
    candidateDesignSha256: candidate.designSha256,
    drawId
  };
  Object.entries(expectedBindings).forEach(([field, expected]) => {
    if (result[field] !== expected) {
      throw new TypeError(`S2 simulator cell result.${field} does not match its input.`);
    }
  });
  assertJsonRecord(result.provenance, 'S2 simulator cell result.provenance');
  if (result.status === 'not-simulated') {
    assertNonemptyText(
      result.failureIdentity,
      'S2 simulator cell result.failureIdentity'
    );
    assertNonemptyText(
      result.failureSourceRef,
      'S2 simulator cell result.failureSourceRef'
    );
    assertJsonRecord(result.details, 'S2 simulator cell result.details');
    return copyJsonData(result, 'S2 simulator cell result');
  }
  assertExactFields(result.metrics, metricIds, 'S2 simulator cell result.metrics');
  const metrics = Object.fromEntries(metricIds.map((metricId) => {
    const value = result.metrics[metricId];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`S2 simulator cell result.metrics.${metricId} must be finite.`);
    }
    return [metricId, value];
  }));
  return {
    ...copyJsonData(result, 'S2 simulator cell result'),
    metrics
  };
};

const targetSatisfied = (value, target) => (
  target.comparator === 'at-least'
    ? value >= target.threshold
    : value <= target.threshold
);

export const runS2SimulationDryRun = async ({
  plan: planInput,
  posteriorFitReceipt,
  posteriorDraws,
  simulator
}) => {
  const plan = createS2SimulationPlan(planInput);
  if (
    !simulator
    || simulator.boundary !== STUB_BOUNDARIES.s2Simulator
    || typeof simulator.simulate !== 'function'
    || typeof simulator.listCellKeys !== 'function'
  ) {
    throw new TypeError(
      `S2 simulator must use the ${STUB_BOUNDARIES.s2Simulator} boundary.`
    );
  }
  validatePosteriorFitReceipt(posteriorFitReceipt, plan);
  const drawById = normalizePosteriorDraws(
    posteriorDraws,
    plan.posteriorDrawsSha256,
    plan.posteriorSelection.drawIds
  );
  const expectedCellKeys = plan.designCandidates.flatMap(({ candidateId }) => (
    plan.posteriorSelection.drawIds.map((drawId) => cellKey(candidateId, drawId))
  ));
  const suppliedCellKeys = simulator.listCellKeys();
  if (
    suppliedCellKeys.length !== expectedCellKeys.length
    || expectedCellKeys.some((key) => !suppliedCellKeys.includes(key))
  ) {
    throw new TypeError('S2 simulator stub must cover every planned candidate/draw cell exactly once.');
  }

  const metricIds = [...new Set(plan.targetSpecifications.map(({ metricId }) => metricId))];
  const cells = await Promise.all(plan.designCandidates.flatMap((candidate) => (
    plan.posteriorSelection.drawIds.map(async (drawId) => {
      const result = normalizeCellResult({
        result: await simulator.simulate({
          plan,
          candidate,
          posteriorDraw: copyJsonData(drawById.get(drawId), 'S2 selected posterior draw')
        }),
        plan,
        candidate,
        drawId,
        metricIds
      });
      if (result.status === 'not-simulated') return result;
      return {
        ...result,
        targetEvaluations: plan.targetSpecifications.map((target) => ({
          targetId: target.targetId,
          metricId: target.metricId,
          observedValue: result.metrics[target.metricId],
          comparator: target.comparator,
          threshold: target.threshold,
          satisfied: targetSatisfied(result.metrics[target.metricId], target)
        }))
      };
    })
  )));

  const candidateSummaries = plan.designCandidates.map(({ candidateId }) => {
    const candidateCells = cells.filter((cell) => cell.candidateId === candidateId);
    const complete = candidateCells.every(({ status }) => status === 'simulated');
    const targetSummaries = plan.targetSpecifications.map((target) => {
      const evaluations = candidateCells
        .filter(({ status }) => status === 'simulated')
        .map(({ targetEvaluations }) => (
          targetEvaluations.find(({ targetId }) => targetId === target.targetId)
        ));
      return {
        targetId: target.targetId,
        simulatedDrawCount: evaluations.length,
        selectedDrawCount: plan.posteriorSelection.drawIds.length,
        satisfiedDrawCount: evaluations.filter(({ satisfied }) => satisfied).length,
        allSelectedDrawsSatisfy: complete
          && evaluations.every(({ satisfied }) => satisfied)
      };
    });
    return {
      candidateId,
      status: complete ? 'complete' : 'incomplete',
      allDeclaredTargetsSatisfied: complete
        ? targetSummaries.every(({ allSelectedDrawsSatisfy }) => allSelectedDrawsSatisfy)
        : null,
      targetSummaries
    };
  });
  const body = {
    schemaVersion: 1,
    plan,
    posteriorSelection: plan.posteriorSelection,
    cells,
    candidateSummaries
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
