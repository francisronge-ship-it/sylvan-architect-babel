import {
  cloneFrozenJson,
  failPlanningConfig,
  isPlainRecord,
  requireExactFields,
  requireRecord,
  requireSafeId,
  requireText
} from './planningData.mjs';

const ROOT_FIELDS = Object.freeze([
  'schemaVersion',
  'requestId',
  'runnerIdentity',
  'carrier',
  'sentParameters',
  'temperaturePolicy',
  'provenance'
]);
const RUNNER_FIELDS = Object.freeze([
  'provider',
  'model',
  'host',
  'reasoning',
  'suppliedBy'
]);
const REASONING_FIELDS = Object.freeze(['identity', 'parameters']);
const CARRIER_FIELDS = Object.freeze([
  'identity',
  'mediaType',
  'payloadArtifactRef',
  'payloadSha256'
]);
const SHA256_RE = /^[a-f0-9]{64}$/u;

const collectTemperatureFields = (value, path = '$.sentParameters', fields = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTemperatureFields(item, `${path}[${index}]`, fields));
    return fields;
  }
  if (!isPlainRecord(value)) return fields;
  Object.entries(value).forEach(([key, child]) => {
    if (key.toLowerCase() === 'temperature') {
      fields.push({
        path: `${path}.${key}`,
        value: child
      });
    }
    collectTemperatureFields(child, `${path}.${key}`, fields);
  });
  return fields;
};

const validateTemperaturePolicy = (policy, sentParameters) => {
  requireRecord(policy, '$.temperaturePolicy');
  const temperatureFields = collectTemperatureFields(sentParameters);
  if (policy.mode === 'omitted') {
    requireExactFields(policy, ['mode'], '$.temperaturePolicy');
    if (temperatureFields.length !== 0) {
      failPlanningConfig(
        `${temperatureFields[0].path} is prohibited when temperaturePolicy.mode is omitted.`
      );
    }
    return;
  }
  if (policy.mode !== 'default-required') {
    failPlanningConfig('$.temperaturePolicy.mode must be omitted or default-required.');
  }
  requireExactFields(
    policy,
    ['mode', 'documentedDefault', 'documentationRef'],
    '$.temperaturePolicy'
  );
  if (!Number.isFinite(policy.documentedDefault)) {
    failPlanningConfig('$.temperaturePolicy.documentedDefault must be a finite number.');
  }
  requireText(policy.documentationRef, '$.temperaturePolicy.documentationRef');
  if (
    temperatureFields.length !== 1
    || !Object.is(temperatureFields[0].value, policy.documentedDefault)
  ) {
    failPlanningConfig(
      '$.sentParameters must carry exactly one temperature equal to the externally documented default.'
    );
  }
};

export const buildCarrierParameterizedProbeRequest = (input) => {
  requireExactFields(input, ROOT_FIELDS, '$');
  if (input.schemaVersion !== 1) failPlanningConfig('$.schemaVersion must be 1.');
  requireSafeId(input.requestId, '$.requestId');
  requireExactFields(input.runnerIdentity, RUNNER_FIELDS, '$.runnerIdentity');
  ['provider', 'model', 'host', 'suppliedBy'].forEach((field) => (
    requireText(input.runnerIdentity[field], `$.runnerIdentity.${field}`)
  ));
  requireExactFields(
    input.runnerIdentity.reasoning,
    REASONING_FIELDS,
    '$.runnerIdentity.reasoning'
  );
  requireText(input.runnerIdentity.reasoning.identity, '$.runnerIdentity.reasoning.identity');
  requireRecord(
    input.runnerIdentity.reasoning.parameters,
    '$.runnerIdentity.reasoning.parameters'
  );
  requireExactFields(input.carrier, CARRIER_FIELDS, '$.carrier');
  ['identity', 'mediaType', 'payloadArtifactRef'].forEach((field) => (
    requireText(input.carrier[field], `$.carrier.${field}`)
  ));
  if (
    typeof input.carrier.payloadSha256 !== 'string'
    || !SHA256_RE.test(input.carrier.payloadSha256)
  ) {
    failPlanningConfig('$.carrier.payloadSha256 must be a lowercase SHA-256 digest.');
  }
  requireRecord(input.sentParameters, '$.sentParameters');
  validateTemperaturePolicy(input.temperaturePolicy, input.sentParameters);
  requireRecord(input.provenance, '$.provenance');

  return cloneFrozenJson({
    ...input,
    executionBoundary: 'external-runner-only'
  });
};
