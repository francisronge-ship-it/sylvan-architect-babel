import {
  copyJsonData,
  freezeJsonData,
  requireExactFields,
  requireNonemptyString,
  requirePlainRecord,
  requireSha256
} from './jsonData.js';

export const RECORD_EVIDENCE_ARTIFACT_NAMES = Object.freeze([
  'generationRecord',
  'reviewState',
  'ambiguityGroup',
  'providerNotice'
]);

export const GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY =
  'babel-durable-generation-evidence-v1';

const GENERATION_RECORD_FIELDS = Object.freeze([
  'schemaIdentity',
  'provider',
  'model',
  'effort',
  'promptContract',
  'sentConfig',
  'timing',
  'tokenUse',
  'costEstimate',
  'provenance'
]);

const PROMPT_CONTRACT_FIELDS = Object.freeze([
  'framework',
  'promptRoute',
  'systemInstructionSha256',
  'promptSha256',
  'promptTemplateSha256'
]);

const REVIEW_STATE_FIELDS = Object.freeze([
  'tier',
  'reviewerIdentity',
  'reviewedAt',
  'judgment',
  'notes',
  'provenance'
]);

const AMBIGUITY_GROUP_FIELDS = Object.freeze([
  'bundleId',
  'analysisIndex'
]);

const PROVIDER_NOTICE_FIELDS = Object.freeze([
  'provider',
  'noticeRef',
  'noticeSha256',
  'quotationRef',
  'quotationSha256',
  'observedAt',
  'provenance'
]);

const requireStringOrNull = (value, path) => {
  if (value !== null && typeof value !== 'string') {
    throw new TypeError(`${path} must be a string or null.`);
  }
};

export const validateGenerationRecordEvidence = (value) => {
  requireExactFields(value, GENERATION_RECORD_FIELDS, 'generationRecord');
  if (value.schemaIdentity !== GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY) {
    throw new TypeError(
      `generationRecord.schemaIdentity must equal ${
        GENERATION_RECORD_EVIDENCE_SCHEMA_IDENTITY
      }.`
    );
  }
  requireNonemptyString(value.provider, 'generationRecord.provider');
  requireNonemptyString(value.model, 'generationRecord.model');
  requireStringOrNull(value.effort, 'generationRecord.effort');

  requireExactFields(
    value.promptContract,
    PROMPT_CONTRACT_FIELDS,
    'generationRecord.promptContract'
  );
  requireNonemptyString(
    value.promptContract.framework,
    'generationRecord.promptContract.framework'
  );
  requireNonemptyString(
    value.promptContract.promptRoute,
    'generationRecord.promptContract.promptRoute'
  );
  [
    'systemInstructionSha256',
    'promptSha256',
    'promptTemplateSha256'
  ].forEach((field) => requireSha256(
    value.promptContract[field],
    `generationRecord.promptContract.${field}`
  ));

  requirePlainRecord(value.sentConfig, 'generationRecord.sentConfig');
  Object.entries(value.sentConfig).forEach(([field, entry]) => {
    if (
      entry !== null
      && typeof entry !== 'string'
      && typeof entry !== 'number'
      && typeof entry !== 'boolean'
    ) {
      throw new TypeError(
        `generationRecord.sentConfig.${field} must be a JSON scalar.`
      );
    }
    if (typeof entry === 'number' && !Number.isFinite(entry)) {
      throw new TypeError(
        `generationRecord.sentConfig.${field} must be finite.`
      );
    }
  });
  if (!Object.hasOwn(value.sentConfig, 'model')) {
    throw new TypeError(
      'generationRecord.sentConfig must contain its externally sent model.'
    );
  }
  if (value.sentConfig.model !== value.model) {
    throw new TypeError(
      'generationRecord.sentConfig.model must equal generationRecord.model.'
    );
  }

  [
    ['timing', value.timing],
    ['tokenUse', value.tokenUse],
    ['costEstimate', value.costEstimate],
    ['provenance', value.provenance]
  ].forEach(([field, entry]) => requirePlainRecord(
    entry,
    `generationRecord.${field}`
  ));
  requireNonemptyString(
    value.costEstimate.label,
    'generationRecord.costEstimate.label'
  );
  return freezeJsonData(copyJsonData(value));
};

export const validateReviewStateEvidence = (value) => {
  requireExactFields(value, REVIEW_STATE_FIELDS, 'reviewState');
  [
    'tier',
    'reviewerIdentity',
    'reviewedAt',
    'judgment',
    'notes'
  ].forEach((field) => requireStringOrNull(value[field], `reviewState.${field}`));
  requirePlainRecord(value.provenance, 'reviewState.provenance');
  return freezeJsonData(copyJsonData(value));
};

export const validateAmbiguityGroupEvidence = (value) => {
  requireExactFields(value, AMBIGUITY_GROUP_FIELDS, 'ambiguityGroup');
  requireNonemptyString(value.bundleId, 'ambiguityGroup.bundleId');
  if (!Number.isSafeInteger(value.analysisIndex) || value.analysisIndex < 0) {
    throw new TypeError(
      'ambiguityGroup.analysisIndex must be a nonnegative safe integer.'
    );
  }
  return freezeJsonData(copyJsonData(value));
};

export const validateProviderNoticeEvidence = (value) => {
  requireExactFields(value, PROVIDER_NOTICE_FIELDS, 'providerNotice');
  [
    'provider',
    'noticeRef',
    'quotationRef',
    'observedAt'
  ].forEach((field) => requireNonemptyString(value[field], `providerNotice.${field}`));
  requireSha256(value.noticeSha256, 'providerNotice.noticeSha256');
  requireSha256(value.quotationSha256, 'providerNotice.quotationSha256');
  requirePlainRecord(value.provenance, 'providerNotice.provenance');
  return freezeJsonData(copyJsonData(value));
};

export const validateRecordEvidenceArtifacts = (artifacts) => {
  requireExactFields(artifacts, RECORD_EVIDENCE_ARTIFACT_NAMES, 'recordEvidence');
  const generationRecord =
    validateGenerationRecordEvidence(artifacts.generationRecord);
  const providerNotice = validateProviderNoticeEvidence(artifacts.providerNotice);
  if (generationRecord.provider !== providerNotice.provider) {
    throw new TypeError(
      'providerNotice.provider must equal generationRecord.provider.'
    );
  }
  return freezeJsonData({
    generationRecord,
    reviewState: validateReviewStateEvidence(artifacts.reviewState),
    ambiguityGroup: validateAmbiguityGroupEvidence(artifacts.ambiguityGroup),
    providerNotice
  });
};
