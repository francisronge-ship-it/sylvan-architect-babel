const CURRENT_PROVENANCE_FIELDS = [
  'modelRoute',
  'framework',
  'language',
  'timestamp',
  'treeSource',
  'promptVersion',
  'parserVersion',
  'uiVersion',
  'payloadIntegrityFlags',
  'payloadRepairDiagnostics',
  'hasDerivationStages',
  'parsePromptTokenCount',
  'parseOutputTokenCount',
  'parseTotalTokenCount',
  'primaryPromptTokenCount',
  'primaryOutputTokenCount',
  'primaryTotalTokenCount'
];

// Current parses never write these fields. Preserve them only when an older
// saved parse already contains truthful transcriber provenance.
const LEGACY_PAYLOAD_TRANSCRIBER_FIELDS = [
  'payloadTranscriberUsed',
  'payloadTranscriberModel',
  'payloadTranscriberPromptTokenCount',
  'payloadTranscriberOutputTokenCount',
  'payloadTranscriberTotalTokenCount'
];

const SNAPSHOT_PROVENANCE_FIELDS = [
  ...CURRENT_PROVENANCE_FIELDS,
  ...LEGACY_PAYLOAD_TRANSCRIBER_FIELDS
];

const CURRENT_ANALYSIS_FIELDS = [
  'tree',
  'derivationStages',
  'derivationSteps',
  'provenance'
];

const CURRENT_BUNDLE_FIELDS = [
  'analyses',
  'ambiguityDetected',
  'ambiguityNote',
  'sentence',
  'requestedModelRoute',
  'requestedReasoningEffort',
  'modelUsed',
  'generationRecord'
];

const removeFalseLegacyPayloadTranscriberMarker = (provenance) => {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) return;
  if (Array.isArray(provenance.payloadIntegrityFlags)) {
    provenance.payloadIntegrityFlags = provenance.payloadIntegrityFlags
      .filter((flag) => flag !== 'payload_transcribed_by_flash_lite');
  }
};

export const loadTreeBankBundleSnapshot = (bundle) => {
  const current = JSON.parse(JSON.stringify(bundle));
  (Array.isArray(current?.analyses) ? current.analyses : []).forEach((analysis) => {
    if (!analysis || typeof analysis !== 'object') return;
    removeFalseLegacyPayloadTranscriberMarker(analysis.provenance);
    delete analysis.surfaceOrder;
    if (Array.isArray(analysis.derivationSteps)) {
      analysis.derivationSteps = analysis.derivationSteps
        .filter((step) => String(step?.operation || '').trim() !== 'SpellOut')
        .map((step) => {
          if (!step || typeof step !== 'object') return step;
          const next = { ...step };
          delete next.spelloutOrder;
          return next;
        });
    }
  });
  return current;
};

const projectFields = (source, fields) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return fields.reduce((projected, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) projected[field] = source[field];
    return projected;
  }, {});
};

const snapshotCurrentAnalysis = (analysis) => {
  const current = projectFields(analysis, CURRENT_ANALYSIS_FIELDS);
  if (current.provenance) {
    current.provenance = projectFields(current.provenance, SNAPSHOT_PROVENANCE_FIELDS);
  }
  return current;
};

export const createTreeBankBundleSnapshot = (bundle) => {
  const snapshot = loadTreeBankBundleSnapshot(bundle);
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  const current = projectFields(snapshot, CURRENT_BUNDLE_FIELDS);
  return {
    ...current,
    analyses: (Array.isArray(current.analyses) ? current.analyses : [])
      .map(snapshotCurrentAnalysis)
  };
};
