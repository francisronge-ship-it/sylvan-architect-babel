const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const EFFORT_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

export const RESEARCH_MODEL_CATALOG = deepFreeze([
  {
    id: 'openai:gpt-5.6-sol',
    label: 'GPT 5.6 Sol',
    provider: 'openai',
    providerRoute: 'gpt',
    providerModel: 'gpt-5.6-sol',
    qualificationStatus: 'unqualified',
    api: 'responses',
    controls: [
      {
        id: 'reasoning.effort',
        label: 'Reasoning effort',
        values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
        qualificationDefault: 'high'
      }
    ],
    requestPolicy: {
      maxOutputTokens: 128000,
      background: true,
      store: true
    },
    documentation: {
      retrievedOn: '2026-08-28',
      url: 'https://platform.openai.com/docs/models'
    }
  },
  {
    id: 'anthropic:claude-opus-5',
    label: 'Claude Opus 5',
    provider: 'anthropic',
    providerRoute: 'claude',
    providerModel: 'claude-opus-5',
    qualificationStatus: 'unqualified',
    api: 'messages',
    controls: [
      {
        id: 'output_config.effort',
        label: 'Effort',
        values: EFFORT_LEVELS,
        qualificationDefault: 'high'
      }
    ],
    requestPolicy: {
      maxOutputTokens: 128000,
      thinking: {
        requestMode: 'explicit-adaptive',
        value: { type: 'adaptive', display: 'omitted' }
      },
      omitSamplingParameters: true
    },
    documentation: {
      retrievedOn: '2026-08-28',
      url: 'https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4'
    }
  },
  {
    id: 'anthropic:claude-fable-5',
    label: 'Claude Fable 5',
    provider: 'anthropic',
    providerRoute: 'claude',
    providerModel: 'claude-fable-5',
    qualificationStatus: 'unqualified',
    api: 'messages',
    controls: [
      {
        id: 'output_config.effort',
        label: 'Effort',
        values: EFFORT_LEVELS,
        qualificationDefault: 'high'
      }
    ],
    requestPolicy: {
      maxOutputTokens: 128000,
      thinking: {
        requestMode: 'implicit-always-on'
      },
      omitSamplingParameters: true
    },
    constraints: {
      dataRetention: '30-days-required',
      zeroDataRetentionAvailable: false
    },
    documentation: {
      retrievedOn: '2026-08-28',
      url: 'https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4'
    }
  }
]);

const MODEL_BY_ID = new Map(RESEARCH_MODEL_CATALOG.map((entry) => [entry.id, entry]));

export const getResearchModel = (modelId) => MODEL_BY_ID.get(String(modelId || '').trim()) || null;

export const resolveResearchModelSelection = (modelId, requestedSettings = {}) => {
  const model = getResearchModel(modelId);
  if (!model) throw new TypeError(`Unknown research model: ${String(modelId || '')}`);
  if (!requestedSettings || typeof requestedSettings !== 'object' || Array.isArray(requestedSettings)) {
    throw new TypeError('Research model settings must be an object.');
  }

  const controlById = new Map(model.controls.map((control) => [control.id, control]));
  const unknownSettings = Object.keys(requestedSettings).filter((key) => !controlById.has(key));
  if (unknownSettings.length > 0) {
    throw new TypeError(`Unsupported settings for ${model.id}: ${unknownSettings.join(', ')}`);
  }

  const nativeSettings = Object.fromEntries(model.controls.map((control) => {
    const requested = Object.prototype.hasOwnProperty.call(requestedSettings, control.id)
      ? String(requestedSettings[control.id] || '').trim()
      : control.qualificationDefault;
    if (!control.values.includes(requested)) {
      throw new TypeError(
        `${control.id} for ${model.id} must be one of: ${control.values.join(', ')}.`
      );
    }
    return [control.id, requested];
  }));

  return deepFreeze({
    catalogId: model.id,
    label: model.label,
    provider: model.provider,
    providerRoute: model.providerRoute,
    providerModel: model.providerModel,
    qualificationStatus: model.qualificationStatus,
    nativeSettings,
    requestPolicy: model.requestPolicy,
    ...(model.constraints ? { constraints: model.constraints } : {})
  });
};
