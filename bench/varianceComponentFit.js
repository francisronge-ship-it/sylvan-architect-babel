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
  assertUniqueTextArray
} from './benchmarkValidation.js';
import { STUB_BOUNDARIES } from './stubs.js';

const PLAN_FIELDS = Object.freeze([
  'fitId',
  'outcomeIdentity',
  'likelihoodIdentity',
  'modelFormula',
  'componentSpecifications',
  'priorSpecification',
  'samplerSpecification',
  'inputDataSchemaRef',
  'inputDataSha256',
  'provenance'
]);
const COMPONENT_FIELDS = Object.freeze([
  'componentId',
  'groupingFields',
  'effectIdentity'
]);
const PRIOR_FIELDS = Object.freeze([
  'specificationId',
  'sourceRef',
  'parameters',
  'parametersSha256'
]);
const SAMPLER_FIELDS = Object.freeze([
  'samplerId',
  'implementationRef',
  'configuration',
  'configurationSha256'
]);
const FITTED_FIELDS = Object.freeze([
  'status',
  'planSha256',
  'inputDataSha256',
  'execution',
  'posteriorDraws',
  'diagnostics',
  'provenance'
]);
const EXECUTION_FIELDS = Object.freeze([
  'executionId',
  'implementationIdentity',
  'implementationSourceRef',
  'environmentIdentity',
  'seedIdentity'
]);
const DRAW_FIELDS = Object.freeze([
  'drawId',
  'chainId',
  'drawIndex',
  'components'
]);
const NOT_FITTED_FIELDS = Object.freeze([
  'status',
  'planSha256',
  'inputDataSha256',
  'execution',
  'failureIdentity',
  'failureSourceRef',
  'details',
  'provenance'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

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

const normalizeComponentSpecifications = (specifications) => {
  if (!Array.isArray(specifications) || specifications.length === 0) {
    throw new TypeError('variance component fit plan.componentSpecifications must be non-empty.');
  }
  const componentIds = [];
  const normalized = specifications.map((specification, index) => {
    const path = `variance component fit plan.componentSpecifications[${index}]`;
    assertExactFields(specification, COMPONENT_FIELDS, path);
    assertNonemptyText(specification.componentId, `${path}.componentId`);
    assertUniqueTextArray(specification.groupingFields, `${path}.groupingFields`);
    assertNonemptyText(specification.effectIdentity, `${path}.effectIdentity`);
    componentIds.push(specification.componentId);
    return copyJsonData(specification, path);
  });
  if (new Set(componentIds).size !== componentIds.length) {
    throw new TypeError(
      'variance component fit plan.componentSpecifications must use unique componentId values.'
    );
  }
  return normalized;
};

export const hashVarianceComponentFitData = (value) => {
  copyJsonData(value, 'variance component fit hash input');
  return sha256CanonicalJson(value);
};

export const createVarianceComponentFitPlan = (input) => {
  assertExactFields(input, PLAN_FIELDS, 'variance component fit plan');
  for (const field of [
    'fitId',
    'outcomeIdentity',
    'likelihoodIdentity',
    'modelFormula',
    'inputDataSchemaRef'
  ]) {
    assertNonemptyText(input[field], `variance component fit plan.${field}`);
  }
  assertSha256(input.inputDataSha256, 'variance component fit plan.inputDataSha256');
  const componentSpecifications = normalizeComponentSpecifications(
    input.componentSpecifications
  );

  assertExactFields(
    input.priorSpecification,
    PRIOR_FIELDS,
    'variance component fit plan.priorSpecification'
  );
  assertNonemptyText(
    input.priorSpecification.specificationId,
    'variance component fit plan.priorSpecification.specificationId'
  );
  assertNonemptyText(
    input.priorSpecification.sourceRef,
    'variance component fit plan.priorSpecification.sourceRef'
  );
  assertJsonRecord(
    input.priorSpecification.parameters,
    'variance component fit plan.priorSpecification.parameters'
  );
  verifyHashBinding(
    input.priorSpecification.parameters,
    input.priorSpecification.parametersSha256,
    'variance component fit plan.priorSpecification.parameters'
  );

  assertExactFields(
    input.samplerSpecification,
    SAMPLER_FIELDS,
    'variance component fit plan.samplerSpecification'
  );
  assertNonemptyText(
    input.samplerSpecification.samplerId,
    'variance component fit plan.samplerSpecification.samplerId'
  );
  assertNonemptyText(
    input.samplerSpecification.implementationRef,
    'variance component fit plan.samplerSpecification.implementationRef'
  );
  assertJsonRecord(
    input.samplerSpecification.configuration,
    'variance component fit plan.samplerSpecification.configuration'
  );
  verifyHashBinding(
    input.samplerSpecification.configuration,
    input.samplerSpecification.configurationSha256,
    'variance component fit plan.samplerSpecification.configuration'
  );
  assertJsonRecord(input.provenance, 'variance component fit plan.provenance');

  const body = copyJsonData({
    ...input,
    componentSpecifications
  }, 'variance component fit plan');
  return freezeJsonData({
    ...body,
    planSha256: sha256CanonicalJson(body)
  });
};

const normalizePosteriorDraws = (draws, componentIds) => {
  if (!Array.isArray(draws) || draws.length === 0) {
    throw new TypeError('variance component posteriorDraws must be a non-empty array.');
  }
  const drawIds = [];
  const chainCoordinates = [];
  const normalized = draws.map((draw, index) => {
    const path = `variance component posteriorDraws[${index}]`;
    assertExactFields(draw, DRAW_FIELDS, path);
    assertNonemptyText(draw.drawId, `${path}.drawId`);
    assertNonemptyText(draw.chainId, `${path}.chainId`);
    if (!Number.isSafeInteger(draw.drawIndex) || draw.drawIndex < 0) {
      throw new TypeError(`${path}.drawIndex must be a non-negative safe integer.`);
    }
    assertExactFields(draw.components, componentIds, `${path}.components`);
    const components = Object.fromEntries(componentIds.map((componentId) => {
      const value = draw.components[componentId];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError(
          `${path}.components.${componentId} must be a finite non-negative variance.`
        );
      }
      return [componentId, value];
    }));
    drawIds.push(draw.drawId);
    chainCoordinates.push(`${draw.chainId}\u0000${draw.drawIndex}`);
    return {
      drawId: draw.drawId,
      chainId: draw.chainId,
      drawIndex: draw.drawIndex,
      components
    };
  });
  if (new Set(drawIds).size !== drawIds.length) {
    throw new TypeError('variance component posteriorDraws must use unique drawId values.');
  }
  if (new Set(chainCoordinates).size !== chainCoordinates.length) {
    throw new TypeError(
      'variance component posteriorDraws must use unique chainId/drawIndex coordinates.'
    );
  }
  return normalized;
};

const normalizeFitOutcome = (outcome, componentIds, plan, inputDataSha256) => {
  if (!isPlainRecord(outcome)) {
    throw new TypeError('variance component fitter outcome must be an object.');
  }
  if (outcome.status !== 'fitted' && outcome.status !== 'not-fitted') {
    throw new TypeError('variance component fitter outcome.status must be fitted or not-fitted.');
  }
  assertExactFields(
    outcome,
    outcome.status === 'fitted' ? FITTED_FIELDS : NOT_FITTED_FIELDS,
    'variance component fitter outcome'
  );
  assertSha256(outcome.planSha256, 'variance component fitter outcome.planSha256');
  assertSha256(
    outcome.inputDataSha256,
    'variance component fitter outcome.inputDataSha256'
  );
  if (outcome.planSha256 !== plan.planSha256) {
    throw new TypeError('variance component fitter outcome does not match plan.planSha256.');
  }
  if (outcome.inputDataSha256 !== inputDataSha256) {
    throw new TypeError(
      'variance component fitter outcome does not match plan.inputDataSha256.'
    );
  }
  if (outcome.status === 'not-fitted') {
    assertExactFields(
      outcome.execution,
      EXECUTION_FIELDS,
      'variance component fitter outcome.execution'
    );
    for (const field of EXECUTION_FIELDS) {
      assertNonemptyText(
        outcome.execution[field],
        `variance component fitter outcome.execution.${field}`
      );
    }
    assertNonemptyText(outcome.failureIdentity, 'variance component fitter outcome.failureIdentity');
    assertNonemptyText(outcome.failureSourceRef, 'variance component fitter outcome.failureSourceRef');
    assertJsonRecord(outcome.details, 'variance component fitter outcome.details');
    assertJsonRecord(outcome.provenance, 'variance component fitter outcome.provenance');
    return copyJsonData(outcome, 'variance component fitter outcome');
  }
  assertExactFields(outcome.execution, EXECUTION_FIELDS, 'variance component fitter outcome.execution');
  for (const field of EXECUTION_FIELDS) {
    assertNonemptyText(
      outcome.execution[field],
      `variance component fitter outcome.execution.${field}`
    );
  }
  assertJsonRecord(outcome.diagnostics, 'variance component fitter outcome.diagnostics');
  assertJsonRecord(outcome.provenance, 'variance component fitter outcome.provenance');
  return {
    status: 'fitted',
    execution: copyJsonData(outcome.execution, 'variance component fitter outcome.execution'),
    posteriorDraws: normalizePosteriorDraws(outcome.posteriorDraws, componentIds),
    diagnostics: copyJsonData(outcome.diagnostics, 'variance component fitter outcome.diagnostics'),
    provenance: copyJsonData(outcome.provenance, 'variance component fitter outcome.provenance')
  };
};

export const runVarianceComponentFitDryRun = async ({
  plan: planInput,
  inputData,
  fitter
}) => {
  const plan = createVarianceComponentFitPlan(planInput);
  if (
    !fitter
    || fitter.boundary !== STUB_BOUNDARIES.varianceComponentFitter
    || typeof fitter.fit !== 'function'
  ) {
    throw new TypeError(
      `variance component fitter must use the ${STUB_BOUNDARIES.varianceComponentFitter} boundary.`
    );
  }
  if (!Array.isArray(inputData) || inputData.length === 0) {
    throw new TypeError('variance component fit inputData must be a non-empty array.');
  }
  const copiedInputData = copyJsonData(inputData, 'variance component fit inputData');
  const groupingFields = new Set(
    plan.componentSpecifications.flatMap(({ groupingFields: fields }) => fields)
  );
  copiedInputData.forEach((observation, index) => {
    if (!isPlainRecord(observation)) {
      throw new TypeError(`variance component fit inputData[${index}] must be an object.`);
    }
    groupingFields.forEach((field) => {
      if (!Object.hasOwn(observation, field)) {
        throw new TypeError(
          `variance component fit inputData[${index}] must contain grouping field ${field}.`
        );
      }
    });
  });
  const inputDataSha256 = sha256CanonicalJson(copiedInputData);
  if (inputDataSha256 !== plan.inputDataSha256) {
    throw new TypeError(
      'variance component fit inputData does not match plan.inputDataSha256.'
    );
  }
  const componentIds = plan.componentSpecifications.map(({ componentId }) => componentId);
  const outcome = normalizeFitOutcome(
    await fitter.fit({
      plan,
      inputData: copyJsonData(copiedInputData, 'variance component fitter inputData')
    }),
    componentIds,
    plan,
    inputDataSha256
  );
  const posterior = outcome.status === 'fitted'
    ? {
        status: 'available',
        drawCount: outcome.posteriorDraws.length,
        drawsSha256: sha256CanonicalJson(outcome.posteriorDraws),
        draws: outcome.posteriorDraws,
        diagnostics: outcome.diagnostics
      }
    : {
        status: 'unavailable',
        failureIdentity: outcome.failureIdentity,
        failureSourceRef: outcome.failureSourceRef,
        details: outcome.details
      };
  const body = {
    schemaVersion: 1,
    plan,
    inputDataSha256,
    execution: outcome.execution,
    posterior,
    provenance: outcome.provenance
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
