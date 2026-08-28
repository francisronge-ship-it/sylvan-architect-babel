import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertUniqueTextArray
} from './benchmarkValidation.js';
import { validateFrozenReleaseManifest } from './releaseManifest.js';

const CONDITION_FIELDS = Object.freeze([
  'conditionId',
  'registryId',
  'hostRoute',
  'frameworkIdentity',
  'nativeTier',
  'carrierIdentity',
  'sentParameters',
  'serviceMetadata',
  'unpinnableBehaviorNotes'
]);

const DERIVED_CONDITION_FIELDS = Object.freeze([
  'schemaVersion',
  'conditionId',
  'releaseId',
  'manifestSha256',
  'registryId',
  'modelIdentity',
  'providerIdentity',
  'versionIdentity',
  'hostRoute',
  'api',
  'frameworkIdentity',
  'nativeTier',
  'carrierIdentity',
  'sentParameters',
  'contractHashes',
  'engineVersion',
  'serviceMetadata',
  'runWindow',
  'unpinnableBehaviorNotes'
]);

const MATRIX_FIELDS = Object.freeze([
  'schemaVersion',
  'manifestSha256',
  'conditions',
  'matrixSha256'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertDigest = (value, path) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest.`);
  }
};

const equalJson = (left, right) => (
  JSON.stringify(canonicalizeJsonData(left))
  === JSON.stringify(canonicalizeJsonData(right))
);

const createCondition = ({ frozenManifest, input }, index) => {
  const path = `conditions[${index}]`;
  assertExactFields(input, CONDITION_FIELDS, path);
  [
    'conditionId',
    'registryId',
    'hostRoute',
    'frameworkIdentity',
    'nativeTier',
    'carrierIdentity'
  ].forEach((field) => assertNonemptyText(input[field], `${path}.${field}`));
  assertJsonRecord(input.sentParameters, `${path}.sentParameters`);
  assertJsonRecord(input.serviceMetadata, `${path}.serviceMetadata`);
  assertUniqueTextArray(
    input.unpinnableBehaviorNotes,
    `${path}.unpinnableBehaviorNotes`,
    { allowEmpty: true }
  );

  const selection = frozenManifest.selections.find(
    (candidate) => candidate.registryId === input.registryId
  );
  const registryEntry = frozenManifest.registrySnapshot.find(
    (candidate) => candidate.registryId === input.registryId
  );
  if (!selection || !registryEntry) {
    throw new TypeError(`${path}.registryId must be present in the frozen manifest.`);
  }
  if (!selection.hostRoutes.includes(input.hostRoute)) {
    throw new TypeError(`${path}.hostRoute must be selected in the frozen manifest.`);
  }
  if (!selection.tierCoverage.requiredNativeReasoningTiers.includes(input.nativeTier)) {
    throw new TypeError(`${path}.nativeTier must be required by the frozen manifest.`);
  }
  if (!equalJson(input.sentParameters, selection.requestParameters)) {
    throw new TypeError(`${path}.sentParameters must exactly match the frozen manifest.`);
  }

  return freezeJsonData({
    schemaVersion: 1,
    conditionId: input.conditionId,
    releaseId: frozenManifest.releaseId,
    manifestSha256: frozenManifest.manifestSha256,
    registryId: input.registryId,
    modelIdentity: registryEntry.canonicalName,
    providerIdentity: registryEntry.provider,
    versionIdentity: copyJsonData(registryEntry.version, `${path}.versionIdentity`),
    hostRoute: input.hostRoute,
    api: copyJsonData(registryEntry.api, `${path}.api`),
    frameworkIdentity: input.frameworkIdentity,
    nativeTier: input.nativeTier,
    carrierIdentity: input.carrierIdentity,
    sentParameters: copyJsonData(input.sentParameters, `${path}.sentParameters`),
    contractHashes: copyJsonData(
      frozenManifest.contractHashes,
      `${path}.contractHashes`
    ),
    engineVersion: frozenManifest.engineVersion,
    serviceMetadata: copyJsonData(input.serviceMetadata, `${path}.serviceMetadata`),
    runWindow: frozenManifest.runWindow,
    unpinnableBehaviorNotes: [...input.unpinnableBehaviorNotes]
  });
};

const conditionIdentity = ({
  conditionId: _conditionId,
  ...identity
}) => sha256CanonicalJson(identity);

export const createConditionMatrix = ({ frozenManifest, conditions }) => {
  const manifest = validateFrozenReleaseManifest(frozenManifest);
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new TypeError('conditions must be a non-empty array.');
  }
  const derivedConditions = conditions.map((input, index) => createCondition({
    frozenManifest: manifest,
    input
  }, index));
  const conditionIds = derivedConditions.map((condition) => condition.conditionId);
  if (new Set(conditionIds).size !== conditionIds.length) {
    throw new TypeError('conditions must have unique conditionId values.');
  }
  const identities = derivedConditions.map(conditionIdentity);
  if (new Set(identities).size !== identities.length) {
    throw new TypeError('conditions must not duplicate the same condition identity.');
  }

  manifest.selections.forEach((selection) => {
    selection.hostRoutes.forEach((hostRoute) => {
      selection.tierCoverage.requiredNativeReasoningTiers.forEach((nativeTier) => {
        const covered = derivedConditions.some((condition) => (
          condition.registryId === selection.registryId
          && condition.hostRoute === hostRoute
          && condition.nativeTier === nativeTier
        ));
        if (!covered) {
          throw new TypeError(
            `conditions must cover registryId=${selection.registryId}, `
            + `hostRoute=${hostRoute}, nativeTier=${nativeTier}.`
          );
        }
      });
    });
  });

  const body = {
    schemaVersion: 1,
    manifestSha256: manifest.manifestSha256,
    conditions: derivedConditions
  };
  return freezeJsonData({
    ...body,
    matrixSha256: sha256CanonicalJson(body)
  });
};

export const validateConditionMatrix = ({ frozenManifest, conditionMatrix }) => {
  const manifest = validateFrozenReleaseManifest(frozenManifest);
  assertExactFields(conditionMatrix, MATRIX_FIELDS, 'condition matrix');
  if (conditionMatrix.schemaVersion !== 1) {
    throw new TypeError('condition matrix.schemaVersion must be 1.');
  }
  if (conditionMatrix.manifestSha256 !== manifest.manifestSha256) {
    throw new TypeError('condition matrix manifestSha256 does not match the manifest.');
  }
  assertDigest(conditionMatrix.matrixSha256, 'condition matrix.matrixSha256');
  const { matrixSha256, ...body } = conditionMatrix;
  if (sha256CanonicalJson(body) !== matrixSha256) {
    throw new TypeError('condition matrix hash does not match its content.');
  }
  if (!Array.isArray(conditionMatrix.conditions)) {
    throw new TypeError('condition matrix.conditions must be an array.');
  }
  const inputs = conditionMatrix.conditions.map((condition, index) => {
    const path = `condition matrix.conditions[${index}]`;
    assertExactFields(condition, DERIVED_CONDITION_FIELDS, path);
    if (condition.schemaVersion !== 1) {
      throw new TypeError(`${path}.schemaVersion must be 1.`);
    }
    return {
      conditionId: condition.conditionId,
      registryId: condition.registryId,
      hostRoute: condition.hostRoute,
      frameworkIdentity: condition.frameworkIdentity,
      nativeTier: condition.nativeTier,
      carrierIdentity: condition.carrierIdentity,
      sentParameters: condition.sentParameters,
      serviceMetadata: condition.serviceMetadata,
      unpinnableBehaviorNotes: condition.unpinnableBehaviorNotes
    };
  });
  const rebuilt = createConditionMatrix({
    frozenManifest: manifest,
    conditions: inputs
  });
  if (!equalJson(rebuilt, conditionMatrix)) {
    throw new TypeError(
      'condition matrix does not match its frozen manifest and authored conditions.'
    );
  }
  return rebuilt;
};
