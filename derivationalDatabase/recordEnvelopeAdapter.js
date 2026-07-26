import {
  createDurableRecord,
  validateDurableRecord
} from './durableRecord.js';
import { requireExactFields } from './jsonData.js';
import { validateRecordEvidenceArtifacts } from './recordEvidence.js';

const assertFrameworkJoin = (record, evidence) => {
  if (
    record.plan.frameworkIdentity
    !== evidence.generationRecord.promptContract.framework
  ) {
    throw new TypeError(
      'plan.frameworkIdentity must equal generationRecord.promptContract.framework.'
    );
  }
  return record;
};

export const createEvidenceBoundDurableRecord = (input) => {
  requireExactFields(
    input,
    ['plan', 'normalizedDerivation', 'evidence'],
    'recordEnvelopeInput'
  );
  const evidence = validateRecordEvidenceArtifacts(input.evidence);
  const record = createDurableRecord({
    plan: input.plan,
    artifacts: {
      normalizedDerivation: input.normalizedDerivation,
      ...evidence
    }
  });
  return assertFrameworkJoin(record, evidence);
};

export const validateEvidenceBoundDurableRecord = (input) => {
  const record = validateDurableRecord(input);
  const evidence = validateRecordEvidenceArtifacts({
    generationRecord: record.artifacts.generationRecord,
    reviewState: record.artifacts.reviewState,
    ambiguityGroup: record.artifacts.ambiguityGroup,
    providerNotice: record.artifacts.providerNotice
  });
  return assertFrameworkJoin(record, evidence);
};
