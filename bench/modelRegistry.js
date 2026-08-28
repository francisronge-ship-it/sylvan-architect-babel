import { copyJsonData, freezeJsonData } from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertTextChoice,
  assertUniqueTextArray
} from './benchmarkValidation.js';

const REGISTRY_ENTRY_FIELDS = Object.freeze([
  'registryId',
  'canonicalName',
  'lab',
  'provider',
  'version',
  'hostRoutes',
  'api',
  'officialDocumentation',
  'nativeReasoningTiers',
  'documentedSamplingDefaults',
  'limits',
  'prices',
  'transportCapabilities',
  'retentionNoTrainAvailability',
  'status'
]);

const VERSION_FIELDS = Object.freeze({
  'immutable-snapshot': ['kind', 'resolvedVersion'],
  'alias-mutable': ['kind', 'alias', 'observedVersion', 'runWindow']
});

const validateVersion = (value, path) => {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${path} must be an object.`);
  }
  const kind = value.kind;
  assertTextChoice(kind, Object.keys(VERSION_FIELDS), `${path}.kind`);
  assertExactFields(value, VERSION_FIELDS[kind], path);
  VERSION_FIELDS[kind]
    .filter((field) => field !== 'kind')
    .forEach((field) => assertNonemptyText(value[field], `${path}.${field}`));
};

export const createModelRegistryEntry = (input) => {
  assertExactFields(input, REGISTRY_ENTRY_FIELDS, 'registry entry');
  assertNonemptyText(input.registryId, 'registry entry.registryId');
  assertNonemptyText(input.canonicalName, 'registry entry.canonicalName');
  assertNonemptyText(input.lab, 'registry entry.lab');
  assertNonemptyText(input.provider, 'registry entry.provider');
  validateVersion(input.version, 'registry entry.version');
  assertUniqueTextArray(input.hostRoutes, 'registry entry.hostRoutes');

  assertExactFields(input.api, ['name', 'version'], 'registry entry.api');
  assertNonemptyText(input.api.name, 'registry entry.api.name');
  assertNonemptyText(input.api.version, 'registry entry.api.version');

  assertExactFields(
    input.officialDocumentation,
    ['documentationRef', 'retrievedAt', 'controlSet'],
    'registry entry.officialDocumentation'
  );
  assertNonemptyText(
    input.officialDocumentation.documentationRef,
    'registry entry.officialDocumentation.documentationRef'
  );
  assertNonemptyText(
    input.officialDocumentation.retrievedAt,
    'registry entry.officialDocumentation.retrievedAt'
  );
  assertUniqueTextArray(
    input.officialDocumentation.controlSet,
    'registry entry.officialDocumentation.controlSet',
    { allowEmpty: true }
  );

  assertUniqueTextArray(
    input.nativeReasoningTiers,
    'registry entry.nativeReasoningTiers'
  );
  assertJsonRecord(
    input.documentedSamplingDefaults,
    'registry entry.documentedSamplingDefaults'
  );
  assertJsonRecord(input.limits, 'registry entry.limits');
  assertJsonRecord(input.prices, 'registry entry.prices');
  assertUniqueTextArray(
    input.transportCapabilities,
    'registry entry.transportCapabilities',
    { allowEmpty: true }
  );
  assertJsonRecord(
    input.retentionNoTrainAvailability,
    'registry entry.retentionNoTrainAvailability'
  );
  assertTextChoice(
    input.status,
    ['active', 'retired-archived'],
    'registry entry.status'
  );

  return freezeJsonData(copyJsonData(input, 'registry entry'));
};

export const createModelRegistry = (inputs) => {
  if (!Array.isArray(inputs)) throw new TypeError('registry entries must be an array.');
  const entries = inputs.map(createModelRegistryEntry);
  const identifiers = entries.map((entry) => entry.registryId);
  if (new Set(identifiers).size !== identifiers.length) {
    throw new TypeError('registry entries must have unique registryId values.');
  }
  return freezeJsonData(entries);
};

export const getRegistryResolvedVersion = (entry) => (
  entry.version.kind === 'immutable-snapshot'
    ? entry.version.resolvedVersion
    : entry.version.observedVersion
);
