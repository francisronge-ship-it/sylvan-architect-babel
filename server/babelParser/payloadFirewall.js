const TRANSCRIBER_GATE_STRING_KEYS = [
  'id',
  'refId',
  'lineageId',
  'word',
  'relation',
  'label'
];

const TRANSCRIBER_AUTHORED_TEXT_KEYS = [
  'statement',
  'stageRecord',
  'relation'
];

const decodeJsonLikeString = (value) => {
  if (typeof value !== 'string') return '';
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
};

export const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
};

export const canonicalizeTransportValueForGate = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeTransportValueForGate(item));
  }
  if (!value || typeof value !== 'object') return value;

  const canonical = {};
  Object.keys(value).forEach((key) => {
    canonical[key] = canonicalizeTransportValueForGate(value[key]);
  });
  return canonical;
};

export const buildPayloadFingerprint = (payload) =>
  stableStringify(canonicalizeTransportValueForGate(payload));

const DERIVATION_STAGE_RELOCATABLE_FIELDS = ['statement', 'stageRecord', 'visualRelations'];

const cloneTransportValue = (value) => (
  value && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : value
);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const relocateLeakedDerivationStageFieldsForGate = (payload) => {
  const cloned = cloneTransportValue(payload);
  const analyses = Array.isArray(cloned?.analyses) ? cloned.analyses : [];

  analyses.forEach((analysis) => {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return;
    const stages = Array.isArray(analysis.derivationStages) ? analysis.derivationStages : [];
    if (stages.length === 0) return;

    const leakedFields = DERIVATION_STAGE_RELOCATABLE_FIELDS
      .filter((field) => hasOwn(analysis, field));
    if (leakedFields.length === 0) return;

    const targetFields = leakedFields.filter((field) => field !== 'visualRelations');
    const fieldsThatIdentifyTarget = targetFields.length > 0 ? targetFields : leakedFields;
    const targetIndexes = new Set();
    fieldsThatIdentifyTarget.forEach((field) => {
      stages.forEach((stage, index) => {
        if (stage && typeof stage === 'object' && !Array.isArray(stage) && !hasOwn(stage, field)) {
          targetIndexes.add(index);
        }
      });
    });

    if (targetIndexes.size !== 1) return;
    const [targetIndex] = Array.from(targetIndexes);
    const targetStage = stages[targetIndex];
    if (!targetStage || typeof targetStage !== 'object' || Array.isArray(targetStage)) return;

    leakedFields.forEach((field) => {
      if (!hasOwn(targetStage, field)) {
        targetStage[field] = analysis[field];
      }
      delete analysis[field];
    });
  });

  return cloned;
};

export const buildPayloadFingerprintAllowingStageFieldRelocation = (payload) =>
  stableStringify(canonicalizeTransportValueForGate(
    relocateLeakedDerivationStageFieldsForGate(payload)
  ));

export const extractRawStructuralAnchors = (rawText) => {
  const text = String(rawText || '');
  const anchors = Object.fromEntries(
    TRANSCRIBER_GATE_STRING_KEYS.map((key) => [key, new Set()])
  );

  for (const key of TRANSCRIBER_GATE_STRING_KEYS) {
    const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
    let match = pattern.exec(text);
    while (match) {
      const decoded = decodeJsonLikeString(match[1]).trim();
      if (decoded) anchors[key].add(decoded);
      match = pattern.exec(text);
    }
  }

  return anchors;
};

export const collectPayloadStructuralAnchors = (value) => {
  const anchors = Object.fromEntries(
    TRANSCRIBER_GATE_STRING_KEYS.map((key) => [key, new Set()])
  );

  const visit = (entry) => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!entry || typeof entry !== 'object') return;
    Object.entries(entry).forEach(([key, child]) => {
      if (TRANSCRIBER_GATE_STRING_KEYS.includes(key) && typeof child === 'string') {
        const normalized = child.trim();
        if (normalized) anchors[key].add(normalized);
      }
      visit(child);
    });
  };

  visit(value);
  return anchors;
};

export const payloadRespectsRawStructuralAnchors = (payload, rawText) => {
  const rawAnchors = extractRawStructuralAnchors(rawText);
  const transcribedAnchors = collectPayloadStructuralAnchors(payload);

  let rawSignalCount = 0;
  for (const key of TRANSCRIBER_GATE_STRING_KEYS) {
    rawSignalCount += rawAnchors[key].size;
  }
  if (rawSignalCount === 0) {
    return {
      ok: false,
      reason: 'no_raw_structural_anchors'
    };
  }

  for (const key of TRANSCRIBER_GATE_STRING_KEYS) {
    const allowed = rawAnchors[key];
    for (const value of transcribedAnchors[key]) {
      if (!allowed.has(value)) {
        return {
          ok: false,
          reason: 'transcriber_structural_drift',
          key,
          value
        };
      }
    }
  }

  return { ok: true };
};

export const extractRawAuthoredText = (rawText) => {
  const text = String(rawText || '');
  const authoredText = Object.fromEntries(
    TRANSCRIBER_AUTHORED_TEXT_KEYS.map((key) => [key, new Set()])
  );

  for (const key of TRANSCRIBER_AUTHORED_TEXT_KEYS) {
    const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
    let match = pattern.exec(text);
    while (match) {
      const decoded = decodeJsonLikeString(match[1]).trim();
      if (decoded) authoredText[key].add(decoded);
      match = pattern.exec(text);
    }
  }

  return authoredText;
};

export const collectPayloadAuthoredText = (value) => {
  const authoredText = Object.fromEntries(
    TRANSCRIBER_AUTHORED_TEXT_KEYS.map((key) => [key, new Set()])
  );

  const visit = (entry) => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!entry || typeof entry !== 'object') return;
    Object.entries(entry).forEach(([key, child]) => {
      if (TRANSCRIBER_AUTHORED_TEXT_KEYS.includes(key) && typeof child === 'string') {
        const normalized = child.trim();
        if (normalized) authoredText[key].add(normalized);
      }
      visit(child);
    });
  };

  visit(value);
  return authoredText;
};

export const payloadPreservesRawAuthoredText = (payload, rawText) => {
  const rawAuthoredText = extractRawAuthoredText(rawText);
  const transcribedAuthoredText = collectPayloadAuthoredText(payload);

  for (const key of TRANSCRIBER_AUTHORED_TEXT_KEYS) {
    const rawValues = rawAuthoredText[key];
    const transcribedValues = transcribedAuthoredText[key];
    if (transcribedValues.size > 0 && rawValues.size === 0) {
      return {
        ok: false,
        reason: 'no_raw_authored_text',
        key
      };
    }
    for (const value of transcribedValues) {
      if (!rawValues.has(value)) {
        return {
          ok: false,
          reason: 'transcriber_authored_text_drift',
          key,
          value
        };
      }
    }
    for (const value of rawValues) {
      if (!transcribedValues.has(value)) {
        return {
          ok: false,
          reason: 'transcriber_authored_text_deleted',
          key,
          value
        };
      }
    }
  }

  return { ok: true };
};
