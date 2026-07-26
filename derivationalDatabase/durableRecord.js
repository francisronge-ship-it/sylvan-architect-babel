import { createHash } from 'node:crypto';

import {
  canonicalJson,
  copyJsonData,
  freezeJsonData,
  requireExactFields,
  requireNonemptyString,
  requirePlainRecord,
  requireSha256
} from './jsonData.js';

export const DURABLE_RECORD_SCHEMA_IDENTITY =
  'babel-derivational-record-envelope-v1';

export const DURABLE_RECORD_ARTIFACT_NAMES = Object.freeze([
  'normalizedDerivation',
  'generationRecord',
  'reviewState',
  'ambiguityGroup',
  'providerNotice'
]);

const PLAN_FIELDS = Object.freeze([
  'recordId',
  'contractVersion',
  'contractArtifactRef',
  'contractArtifactSha256',
  'engineVersion',
  'frameworkIdentity',
  'supersedesRecordId',
  'artifactBindings',
  'provenance'
]);

const RECORD_FIELDS = Object.freeze([
  'schemaVersion',
  'schemaIdentity',
  'plan',
  'artifacts',
  'recordSha256'
]);

export const hashDurableRecordData = (value) => createHash('sha256')
  .update(canonicalJson(copyJsonData(value)))
  .digest('hex');

const normalizeArtifactBindings = (bindings) => {
  requireExactFields(bindings, DURABLE_RECORD_ARTIFACT_NAMES, 'plan.artifactBindings');
  return Object.fromEntries(DURABLE_RECORD_ARTIFACT_NAMES.map((artifactName) => {
    const binding = bindings[artifactName];
    requireExactFields(
      binding,
      ['sourceRef', 'canonicalSha256'],
      `plan.artifactBindings.${artifactName}`
    );
    requireNonemptyString(
      binding.sourceRef,
      `plan.artifactBindings.${artifactName}.sourceRef`
    );
    requireSha256(
      binding.canonicalSha256,
      `plan.artifactBindings.${artifactName}.canonicalSha256`
    );
    return [artifactName, {
      sourceRef: binding.sourceRef,
      canonicalSha256: binding.canonicalSha256
    }];
  }));
};

const normalizePlan = (plan) => {
  requireExactFields(plan, PLAN_FIELDS, 'plan');
  [
    'recordId',
    'contractVersion',
    'contractArtifactRef',
    'engineVersion',
    'frameworkIdentity'
  ].forEach((field) => requireNonemptyString(plan[field], `plan.${field}`));
  requireSha256(plan.contractArtifactSha256, 'plan.contractArtifactSha256');
  if (plan.supersedesRecordId !== null) {
    requireNonemptyString(plan.supersedesRecordId, 'plan.supersedesRecordId');
    if (plan.supersedesRecordId === plan.recordId) {
      throw new TypeError('plan.supersedesRecordId must differ from plan.recordId.');
    }
  }
  return {
    recordId: plan.recordId,
    contractVersion: plan.contractVersion,
    contractArtifactRef: plan.contractArtifactRef,
    contractArtifactSha256: plan.contractArtifactSha256,
    engineVersion: plan.engineVersion,
    frameworkIdentity: plan.frameworkIdentity,
    supersedesRecordId: plan.supersedesRecordId,
    artifactBindings: normalizeArtifactBindings(plan.artifactBindings),
    provenance: copyJsonData(plan.provenance, 'plan.provenance')
  };
};

const normalizeArtifacts = (artifacts, bindings) => {
  requireExactFields(artifacts, DURABLE_RECORD_ARTIFACT_NAMES, 'artifacts');
  requirePlainRecord(artifacts.normalizedDerivation, 'artifacts.normalizedDerivation');
  return Object.fromEntries(DURABLE_RECORD_ARTIFACT_NAMES.map((artifactName) => {
    const artifact = copyJsonData(artifacts[artifactName], `artifacts.${artifactName}`);
    const observedSha256 = hashDurableRecordData(artifact);
    if (observedSha256 !== bindings[artifactName].canonicalSha256) {
      throw new TypeError(
        `artifacts.${artifactName} canonical SHA-256 does not match its binding.`
      );
    }
    return [artifactName, artifact];
  }));
};

const buildRecordPayload = (plan, artifacts) => ({
  schemaVersion: 1,
  schemaIdentity: DURABLE_RECORD_SCHEMA_IDENTITY,
  plan,
  artifacts
});

export const createDurableRecord = ({ plan, artifacts } = {}) => {
  const normalizedPlan = normalizePlan(plan);
  const normalizedArtifacts = normalizeArtifacts(
    artifacts,
    normalizedPlan.artifactBindings
  );
  const payload = buildRecordPayload(normalizedPlan, normalizedArtifacts);
  return freezeJsonData({
    ...payload,
    recordSha256: hashDurableRecordData(payload)
  });
};

export const validateDurableRecord = (record) => {
  requireExactFields(record, RECORD_FIELDS, 'record');
  if (record.schemaVersion !== 1) {
    throw new TypeError('record.schemaVersion must equal 1.');
  }
  if (record.schemaIdentity !== DURABLE_RECORD_SCHEMA_IDENTITY) {
    throw new TypeError(
      `record.schemaIdentity must equal ${DURABLE_RECORD_SCHEMA_IDENTITY}.`
    );
  }
  requireSha256(record.recordSha256, 'record.recordSha256');
  const rebuilt = createDurableRecord({
    plan: record.plan,
    artifacts: record.artifacts
  });
  if (rebuilt.recordSha256 !== record.recordSha256) {
    throw new TypeError('record.recordSha256 does not match the record payload.');
  }
  return rebuilt;
};

export const serializeDurableRecord = (record) =>
  `${canonicalJson(validateDurableRecord(record))}\n`;

export const parseDurableRecord = (text) => {
  if (typeof text !== 'string') {
    throw new TypeError('durable record JSON must be a string.');
  }
  let decoded;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new TypeError('durable record JSON must be valid JSON.');
  }
  const record = validateDurableRecord(decoded);
  if (text !== `${canonicalJson(record)}\n`) {
    throw new TypeError('durable record JSON must use canonical native-JSON bytes.');
  }
  return record;
};
