import { GoogleGenAI } from '@google/genai';
import { attachAggregateParseTokenCounts } from './provenance.js';
import { buildSystemInstruction } from './systemInstruction.js';
import { buildParseContentsPrompt } from './prompts.js';
import {
  buildGeminiThinkingConfig,
  LOCAL_MODEL_COMMAND,
  LOCAL_MODEL_NAME,
  LOCAL_MODEL_URL,
  ANTHROPIC_MODEL,
  OPENAI_MODEL,
  PAYLOAD_TRANSCRIBER_MAX_OUTPUT_TOKENS,
  PAYLOAD_TRANSCRIBER_MODEL,
  PAYLOAD_TRANSCRIBER_TEMPERATURE,
  PAYLOAD_TRANSCRIBER_TIMEOUT_MS,
  PRO_MODEL,
  getRemainingRequestBudgetMs,
  localRouteUnavailableMessage,
  resolveModelTimeoutMs,
  resolveRequestTimeoutMs,
  resolveRouteMaxOutputTokens,
  resolveRouteTemperature,
  routeUnavailableMessage,
  normalizeProviderReasoningEffort
} from './routeConfig.js';
import {
  generateAnthropicStructuredContent,
  generateOpenAIStructuredContent,
  generateStructuredContent,
  generateStructuredLocalContent,
  getErrorMeta,
  isNetworkTransportError,
  isTruncatedGeneration,
  resolveLocalMaxOutputTokens,
  summarizeErrorForLog,
  summarizeGeneration,
  withTimeout,
  writeDebugModelPayload
} from './modelRuntime.js';
import {
  buildPayloadFingerprint,
  buildPayloadFingerprintAllowingStageFieldRelocation,
  payloadPreservesRawAuthoredText,
  payloadRespectsRawStructuralAnchors
} from './payloadFirewall.js';

export const classifyGeminiRouteError = ({
  error,
  ParseApiError,
  modelRoute = 'pro',
  model
}) => {
  if (error instanceof ParseApiError) {
    return error;
  }

  const { msg, haystack, statusCode } = getErrorMeta(error);
  const providerMessage = String(msg || '').trim() || undefined;

  if (
    haystack.includes('api key expired') ||
    haystack.includes('api_key_expired') ||
    haystack.includes('invalid api key') ||
    haystack.includes('api_key_invalid') ||
    haystack.includes('unauthenticated') ||
    haystack.includes('permission_denied') ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return new ParseApiError('API_KEY_INVALID', 'Server API key is invalid or expired.', 500);
  }

  if (haystack.includes('resource_exhausted') || haystack.includes('quota') || statusCode === 429) {
    return new ParseApiError('GEMINI_QUOTA', 'Rate limit or quota reached for this server key.', 429);
  }

  if (
    statusCode === 404 ||
    (haystack.includes('model') && (
      haystack.includes('not found') ||
      haystack.includes('not available') ||
      haystack.includes('unsupported')
    ))
  ) {
    return new ParseApiError('MODEL_UNAVAILABLE', 'Requested model is unavailable for this project/key.', 503);
  }

  if (haystack.includes('invalid_argument') || statusCode === 400) {
    return new ParseApiError('INVALID_REQUEST', 'Request was rejected by Gemini (invalid argument).', 400);
  }

  if (
    statusCode === 408 ||
    haystack.includes('timed out') ||
    haystack.includes('timeout') ||
    haystack.includes('aborterror')
  ) {
    return new ParseApiError(
      'GEMINI_TIMEOUT',
      `Gemini parse timed out before ${model || 'the model'} returned a result.`,
      504,
      providerMessage ? { providerMessage } : undefined
    );
  }

  if (
    statusCode === 503 ||
    haystack.includes('service unavailable') ||
    haystack.includes('backend error')
  ) {
    return new ParseApiError(
      'GEMINI_UNAVAILABLE',
      routeUnavailableMessage(modelRoute),
      503
    );
  }

  if (isNetworkTransportError(error)) {
    return new ParseApiError(
      'GEMINI_TRANSPORT',
      `Gemini transport failed before ${model || 'the model'} returned a result.`,
      502,
      providerMessage ? { providerMessage } : undefined
    );
  }

  return new ParseApiError('PARSE_FAILED', msg || 'Syntactic parsing failed.', 500);
};

const classifyProviderRouteError = ({
  error,
  ParseApiError,
  providerLabel,
  model
}) => {
  if (error instanceof ParseApiError) {
    return error;
  }

  const { msg, haystack, statusCode } = getErrorMeta(error);
  const providerMessage = String(msg || '').trim();
  if (
    haystack.includes('api key expired') ||
    haystack.includes('invalid api key') ||
    haystack.includes('unauthorized') ||
    haystack.includes('unauthenticated') ||
    haystack.includes('permission') ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return new ParseApiError('API_KEY_INVALID', `${providerLabel} API key is invalid or lacks required permissions.`, 500, {
      provider: providerLabel,
      model,
      providerMessage: providerMessage || null
    });
  }
  if (haystack.includes('quota') || haystack.includes('rate limit') || statusCode === 429) {
    return new ParseApiError('PROVIDER_QUOTA', `Rate limit or quota reached for ${providerLabel}.`, 429, {
      provider: providerLabel,
      model,
      providerMessage: providerMessage || null
    });
  }
  if (
    statusCode === 404 ||
    (haystack.includes('model') && (
      haystack.includes('not found') ||
      haystack.includes('not available') ||
      haystack.includes('unsupported')
    ))
  ) {
    return new ParseApiError('MODEL_UNAVAILABLE', `${providerLabel} model is unavailable for this key or endpoint.`, 503, {
      provider: providerLabel,
      model,
      providerMessage: providerMessage || null
    });
  }
  if (statusCode === 400 || haystack.includes('invalid')) {
    return new ParseApiError('INVALID_REQUEST', `${providerLabel} rejected the request.`, 400, {
      provider: providerLabel,
      model,
      providerMessage: providerMessage || null
    });
  }
  if (isNetworkTransportError(error)) {
    return new ParseApiError('PROVIDER_UNAVAILABLE', `${providerLabel} transport failed before the model returned a result.`, 503, {
      provider: providerLabel,
      model,
      providerMessage: providerMessage || null
    });
  }
  return new ParseApiError('PARSE_FAILED', providerMessage || `${providerLabel} parsing failed.`, 500, {
    provider: providerLabel,
    model
  });
};

export const createParseRoutes = ({
  ParseApiError,
  normalizeParseBundle,
  validateFinalProNoteBindings,
  parseModelJson,
  parseModelJsonDetailed
}) => {
  const buildPayloadTranscriberSystemInstruction = () => (
    'Return raw JSON only. ' +
    'You are Babel\'s structural payload transcriber. ' +
    'Your job is to repair transport or field-placement problems without changing the linguistic analysis. ' +
    'Preserve all overt terminals, node ids, step ids, frame.after, frame.change, visualRelations, compatibility chains or commitmentGraph mirrors if they are present, token indices, and structural relations. ' +
    'Do not invent movement, do not invent change content, do not reorder terminals, do not add or remove nodes, do not change case, theta roles, selection, locality, or any authored change/commitmentGraph content. ' +
    'If the payload is already parseable JSON, preserve that authored content exactly apart from harmless transport-canonical notation repair and mechanical field-placement repair. ' +
    'Output exactly one top-level JSON object and nothing else.'
  );

  const buildPayloadTranscriberContents = ({
    sentence,
    framework,
    failureStage,
    rawText,
    originalPayload
  }) => {
    const originalPayloadText = originalPayload
      ? `\nAuthoritative parsed payload snapshot:\n\`\`\`json\n${JSON.stringify(originalPayload, null, 2)}\n\`\`\`\n`
      : '\nNo authoritative parsed payload was available because the original text did not parse as JSON.\n';
    return (
      `Sentence: "${sentence}"\n` +
      `Framework: ${framework}\n` +
      `Failure stage: ${failureStage}\n` +
      'Task: rewrite the following Babel first-pass parse payload into valid canonical JSON without changing linguistics.\n' +
      'Allowed repairs only:\n' +
      '- remove wrapper prose or fences\n' +
      '- fix broken JSON syntax\n' +
      '- place fields into their correct JSON positions\n' +
      '- normalize harmless transport notation drift without changing linguistic content\n' +
      'Forbidden repairs:\n' +
      '- changing tree shape\n' +
      '- changing derivationSteps\n' +
      '- changing frame.after\n' +
      '- changing frame.change\n' +
      '- changing visualRelations\n' +
      '- changing chains\n' +
      '- changing commitmentGraph when present\n' +
      '- changing overt terminal order or token indices\n' +
      `${originalPayloadText}` +
      'Original raw payload:\n' +
      '```text\n' +
      `${String(rawText || '')}\n` +
      '```'
    );
  };

  const attachPrimaryParseProvenance = (analysis, generationMeta, extraProvenance = {}) => ({
    ...analysis,
    provenance: attachAggregateParseTokenCounts({
      ...(analysis?.provenance || {}),
      ...(generationMeta?.providerReasoningSummary
        ? { providerReasoningSummary: generationMeta.providerReasoningSummary }
        : {}),
      ...(generationMeta?.providerReasoningRaw
        ? { providerReasoningRaw: generationMeta.providerReasoningRaw }
        : {}),
      ...(generationMeta?.promptTokenCount
        ? { primaryPromptTokenCount: generationMeta.promptTokenCount }
        : {}),
      ...(generationMeta?.outputTokenCount
        ? { primaryOutputTokenCount: generationMeta.outputTokenCount }
        : {}),
      ...(generationMeta?.totalTokenCount
        ? { primaryTotalTokenCount: generationMeta.totalTokenCount }
        : {}),
      ...(generationMeta?.thoughtsTokenCount
        ? { providerThoughtsTokenCount: generationMeta.thoughtsTokenCount }
        : {}),
      ...extraProvenance
    })
  });

  const attachPayloadTranscriberProvenance = (analysis, transcriberMeta, extraProvenance = {}) => ({
    ...analysis,
    provenance: attachAggregateParseTokenCounts({
      ...(analysis?.provenance || {}),
      payloadTranscriberUsed: true,
      payloadTranscriberModel: PAYLOAD_TRANSCRIBER_MODEL,
      ...(transcriberMeta?.promptTokenCount
        ? { payloadTranscriberPromptTokenCount: transcriberMeta.promptTokenCount }
        : {}),
      ...(transcriberMeta?.outputTokenCount
        ? { payloadTranscriberOutputTokenCount: transcriberMeta.outputTokenCount }
        : {}),
      ...(transcriberMeta?.totalTokenCount
        ? { payloadTranscriberTotalTokenCount: transcriberMeta.totalTokenCount }
        : {}),
      ...(transcriberMeta?.thoughtsTokenCount
        ? { payloadTranscriberThoughtsTokenCount: transcriberMeta.thoughtsTokenCount }
        : {}),
      ...extraProvenance
    })
  });

  const maybeWritePrimaryDebugPayload = ({
    modelRoute,
    model,
    sentence,
    rawText
  }) => {
    if (String(process.env.BABEL_SAVE_PROVIDER_RAW || '').trim() !== '1') return null;
    return writeDebugModelPayload({
      stage: `${modelRoute}-primary-output`,
      model,
      sentence,
      rawText
    });
  };

  const attemptPayloadTranscriber = async ({
    ai,
    sentence,
    framework,
    modelRoute,
    rawText,
    requestStartedAt,
    failureStage,
    originalPayload,
    existingIntegrityFlags = []
  }) => {
    const remainingBudgetMs = getRemainingRequestBudgetMs(requestStartedAt, modelRoute);
    if (!Number.isFinite(remainingBudgetMs) ? false : remainingBudgetMs <= 2500) {
      return null;
    }

    writeDebugModelPayload({
      stage: `payload-transcriber-input-${failureStage}`,
      model: PAYLOAD_TRANSCRIBER_MODEL,
      sentence,
      rawText
    });

    let generation;
    try {
      generation = await withTimeout(
        (abortSignal) => generateStructuredContent({
          ai,
          model: PAYLOAD_TRANSCRIBER_MODEL,
          contents: buildPayloadTranscriberContents({
            sentence,
            framework,
            failureStage,
            rawText,
            originalPayload
          }),
          systemInstruction: buildPayloadTranscriberSystemInstruction(),
          temperature: PAYLOAD_TRANSCRIBER_TEMPERATURE,
          maxOutputTokens: PAYLOAD_TRANSCRIBER_MAX_OUTPUT_TOKENS,
          includeThoughts: false,
          abortSignal
        }),
        resolveRequestTimeoutMs({
          baseTimeoutMs: PAYLOAD_TRANSCRIBER_TIMEOUT_MS,
          remainingBudgetMs
        }),
        `Payload transcriber (${PAYLOAD_TRANSCRIBER_MODEL})`
      );
    } catch {
      return null;
    }

    const generationMeta = summarizeGeneration(generation);
    writeDebugModelPayload({
      stage: `payload-transcriber-output-${failureStage}`,
      model: PAYLOAD_TRANSCRIBER_MODEL,
      sentence,
      rawText: generationMeta.rawText
    });

    let parsedTranscribed;
    try {
      parsedTranscribed = parseModelJsonDetailed
        ? parseModelJsonDetailed(generationMeta.rawText)
        : { payload: parseModelJson(generationMeta.rawText), integrityFlags: [] };
    } catch {
      return null;
    }

    if (originalPayload) {
      const originalFingerprint = buildPayloadFingerprint(originalPayload);
      const transcribedFingerprint = buildPayloadFingerprint(parsedTranscribed.payload);
      const relocationSafeOriginalFingerprint = buildPayloadFingerprintAllowingStageFieldRelocation(originalPayload);
      const relocationSafeTranscribedFingerprint = buildPayloadFingerprintAllowingStageFieldRelocation(parsedTranscribed.payload);
      if (
        originalFingerprint !== transcribedFingerprint
        && relocationSafeOriginalFingerprint !== relocationSafeTranscribedFingerprint
      ) {
        writeDebugModelPayload({
          stage: `payload-transcriber-drift-${failureStage}`,
          model: PAYLOAD_TRANSCRIBER_MODEL,
          sentence,
          rawText: JSON.stringify({
            originalPayload,
            transcribedPayload: parsedTranscribed.payload
          }, null, 2)
        });
        return null;
      }
    } else {
      // Pure JSON-parse failures have no authoritative parsed payload to diff against.
      // In that case the transcriber may only pass if every structural anchor it emits
      // already exists in the raw text transport itself.
      const rawAnchorGate = payloadRespectsRawStructuralAnchors(parsedTranscribed.payload, rawText);
      if (!rawAnchorGate.ok) {
        writeDebugModelPayload({
          stage: `payload-transcriber-anchor-reject-${failureStage}`,
          model: PAYLOAD_TRANSCRIBER_MODEL,
          sentence,
          rawText: JSON.stringify(rawAnchorGate, null, 2)
        });
        return null;
      }
      const rawAuthoredTextGate = payloadPreservesRawAuthoredText(parsedTranscribed.payload, rawText);
      if (!rawAuthoredTextGate.ok) {
        writeDebugModelPayload({
          stage: `payload-transcriber-authored-text-reject-${failureStage}`,
          model: PAYLOAD_TRANSCRIBER_MODEL,
          sentence,
          rawText: JSON.stringify(rawAuthoredTextGate, null, 2)
        });
        return null;
      }
    }

    const payloadIntegrityFlags = Array.from(new Set([
      ...(Array.isArray(existingIntegrityFlags) ? existingIntegrityFlags : []),
      ...(Array.isArray(parsedTranscribed.integrityFlags) ? parsedTranscribed.integrityFlags : []),
      'payload_transcribed_by_flash_lite',
      `payload_transcribed_after_${failureStage}`
    ]));

    try {
      const normalized = normalizeParseBundle(
        parsedTranscribed.payload,
        framework,
        sentence,
        modelRoute,
        true,
        { payloadIntegrityFlags }
      );
      return {
        normalized,
        transcriberMeta: generationMeta,
        payloadIntegrityFlags
      };
    } catch {
      return null;
    }
  };

  const parseSentenceWithLocalModel = async (sentence, framework = 'xbar') => {
    const promptRoute = 'pro';
    const requestStartedAt = Date.now();
    const systemInstruction = buildSystemInstruction(framework, promptRoute);
    const prompt = buildParseContentsPrompt(
      sentence,
      framework,
      promptRoute
    );
    const temperature = resolveRouteTemperature(promptRoute);
    const maxOutputTokens = resolveLocalMaxOutputTokens(resolveRouteMaxOutputTokens(promptRoute, sentence));
    const modelUsed = `local:${LOCAL_MODEL_NAME}`;

    try {
      const rawText = await generateStructuredLocalContent({
        sentence,
        framework,
        systemInstruction,
        prompt,
        temperature,
        maxOutputTokens,
        timeoutMs: undefined
      });

      if (!rawText) {
        throw new ParseApiError('BAD_MODEL_RESPONSE', 'Local model returned no text.', 502, {
          stage: 'local-transport',
          model: modelUsed
        });
      }

      const parsedPayload = parseModelJsonDetailed ? parseModelJsonDetailed(rawText) : { payload: parseModelJson(rawText), integrityFlags: [] };
      let normalized = normalizeParseBundle(
        parsedPayload.payload,
        framework,
        sentence,
        promptRoute,
        true,
        { payloadIntegrityFlags: parsedPayload.integrityFlags }
      );
      if (normalized?.analyses?.[0]) {
        normalized = {
          ...normalized,
          analyses: [
            {
              ...normalized.analyses[0],
              provenance: attachAggregateParseTokenCounts({
                ...(normalized.analyses[0].provenance || {}),
                modelRoute: 'local'
              })
            }
          ]
        };
      }

      if (normalized?.analyses?.[0]) {
        normalized = validateFinalProNoteBindings(normalized);
      }

      return {
        ...normalized,
        requestedModelRoute: 'local',
        modelUsed
      };
    } catch (error) {
      if (error instanceof ParseApiError) {
        throw error;
      }
      const { msg, haystack, statusCode } = getErrorMeta(error);
      if (
        isNetworkTransportError(error) ||
        haystack.includes('econnrefused') ||
        haystack.includes('connection refused') ||
        haystack.includes('failed to fetch') ||
        statusCode === 404 ||
        statusCode === 503
      ) {
        throw new ParseApiError('LOCAL_MODEL_UNAVAILABLE', localRouteUnavailableMessage(), 503, {
          model: modelUsed,
          endpoint: LOCAL_MODEL_COMMAND ? 'command' : LOCAL_MODEL_URL,
          transportMessage: msg || null
        });
      }
      throw new ParseApiError('PARSE_FAILED', msg || 'Local model parsing failed.', 500);
    }
  };

  const parseSentenceWithGemini = async (sentence, framework = 'xbar', modelRoute = 'pro', options = {}) => {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new ParseApiError('API_KEY_MISSING', 'Gemini API key is not configured on the server.', 500);
    }

    const ai = new GoogleGenAI({ apiKey });
    const normalizedModelRoute = 'gemini';
    const systemInstruction = buildSystemInstruction(framework, normalizedModelRoute);
    const fullContents = buildParseContentsPrompt(
      sentence,
      framework,
      normalizedModelRoute
    );
    const routeTemperature = resolveRouteTemperature(normalizedModelRoute);
    const routeMaxOutputTokens = resolveRouteMaxOutputTokens(normalizedModelRoute, sentence);
    const selectedModel = PRO_MODEL;
    const requestStartedAt = Date.now();
    const reasoningEffort = normalizeProviderReasoningEffort(normalizedModelRoute, options.reasoningEffort);

    try {
      const remainingBudgetMs = getRemainingRequestBudgetMs(requestStartedAt, normalizedModelRoute);
      if (remainingBudgetMs <= 1200) {
        throw new ParseApiError(
          'GEMINI_UNAVAILABLE',
          routeUnavailableMessage(normalizedModelRoute),
          503
        );
      }

      const generation = await withTimeout(
        (abortSignal) => generateStructuredContent({
          ai,
          model: selectedModel,
          contents: fullContents,
          systemInstruction,
          temperature: routeTemperature,
          maxOutputTokens: routeMaxOutputTokens,
          thinkingConfig: buildGeminiThinkingConfig(reasoningEffort),
          abortSignal
        }),
        resolveRequestTimeoutMs({
          baseTimeoutMs: resolveModelTimeoutMs(selectedModel, normalizedModelRoute),
          remainingBudgetMs
        }),
        `Model generation (${selectedModel})`
      );

      const generationMeta = summarizeGeneration(generation);
      const truncatedGeneration = isTruncatedGeneration(generation);
      const primaryDebugPayloadPath = maybeWritePrimaryDebugPayload({
        modelRoute: normalizedModelRoute,
        model: selectedModel,
        sentence,
        rawText: generationMeta.rawText
      });

      let payload;
      let payloadIntegrityFlags = [];
      try {
        const parsedPayload = parseModelJsonDetailed
          ? parseModelJsonDetailed(generationMeta.rawText)
          : { payload: parseModelJson(generationMeta.rawText), integrityFlags: [] };
        payload = parsedPayload.payload;
          payloadIntegrityFlags = Array.isArray(parsedPayload.integrityFlags)
            ? parsedPayload.integrityFlags
            : [];
      } catch (error) {
        if (error instanceof ParseApiError && error.code === 'BAD_MODEL_RESPONSE') {
          const transcribed = await attemptPayloadTranscriber({
            ai,
            sentence,
            framework,
            modelRoute: normalizedModelRoute,
            rawText: generationMeta.rawText,
            requestStartedAt,
            failureStage: truncatedGeneration ? 'truncated_json_parse' : 'json_parse',
            originalPayload: null,
            existingIntegrityFlags: []
          });
          if (transcribed?.normalized?.analyses?.[0]) {
            let recovered = {
              ...transcribed.normalized,
              analyses: [
                attachPayloadTranscriberProvenance(
                  attachPrimaryParseProvenance(
                    transcribed.normalized.analyses[0],
                    generationMeta,
                    primaryDebugPayloadPath ? { primaryDebugPayloadPath } : {}
                  ),
                  transcribed.transcriberMeta
                )
              ]
            };
            if (recovered?.analyses?.[0]) {
              recovered = validateFinalProNoteBindings(recovered);
            }
            return {
              ...recovered,
              requestedModelRoute: normalizedModelRoute,
              requestedReasoningEffort: reasoningEffort,
              modelUsed: selectedModel
            };
          }
          const debugPayloadPath = writeDebugModelPayload({
            stage: 'json-parse',
            model: selectedModel,
            sentence,
            rawText: generationMeta.rawText
          });
          throw new ParseApiError(
            error.code,
            error.message,
            422,
            {
              stage: 'json-parse',
              model: selectedModel,
              finishReason: generationMeta.finishReason || null,
              textLength: generationMeta.textLength,
              preview: generationMeta.preview || '',
              debugPayloadPath
            }
          );
        }
        if (truncatedGeneration) {
          throw new ParseApiError('BAD_MODEL_RESPONSE', 'Model output was truncated before JSON completion.', 502);
        }
        throw error;
      }

      let normalized;
      try {
        normalized = normalizeParseBundle(
          payload,
          framework,
          sentence,
          normalizedModelRoute,
          true,
          { payloadIntegrityFlags }
        );
        if (normalized?.analyses?.[0]) {
          normalized = {
            ...normalized,
            analyses: [
              attachPrimaryParseProvenance(
                normalized.analyses[0],
                generationMeta,
                primaryDebugPayloadPath ? { primaryDebugPayloadPath } : {}
              )
            ]
          };
        }
      } catch (error) {
        if (error instanceof ParseApiError && error.code === 'BAD_MODEL_RESPONSE') {
          const transcribed = await attemptPayloadTranscriber({
            ai,
            sentence,
            framework,
            modelRoute: normalizedModelRoute,
            rawText: generationMeta.rawText,
            requestStartedAt,
            failureStage: 'normalization',
            originalPayload: payload,
            existingIntegrityFlags: payloadIntegrityFlags
          });
          if (transcribed?.normalized?.analyses?.[0]) {
            normalized = {
              ...transcribed.normalized,
              analyses: [
                attachPayloadTranscriberProvenance(
                  attachPrimaryParseProvenance(
                    transcribed.normalized.analyses[0],
                    generationMeta,
                    primaryDebugPayloadPath ? { primaryDebugPayloadPath } : {}
                  ),
                  transcribed.transcriberMeta
                )
              ]
            };
          } else {
          const debugPayloadPath = writeDebugModelPayload({
            stage: 'normalization',
            model: selectedModel,
            sentence,
            rawText: generationMeta.rawText
          });
          let payloadPreview = '<unserializable>';
          try {
            payloadPreview = JSON.stringify(payload).slice(0, 320);
          } catch {
            // keep fallback preview
          }
          throw new ParseApiError(
            error.code,
            error.message,
            422,
            {
              stage: 'normalization',
              model: selectedModel,
              finishReason: generationMeta.finishReason || null,
              textLength: generationMeta.textLength,
              preview: generationMeta.preview || '',
              payloadPreview,
              debugPayloadPath
            }
          );
          }
        }
        if (!(error instanceof ParseApiError && error.code === 'BAD_MODEL_RESPONSE' && normalized?.analyses?.[0])) {
          throw error;
        }
      }

      if (normalized?.analyses?.[0]) {
        normalized = validateFinalProNoteBindings(normalized);
      }

      return {
        ...normalized,
        requestedModelRoute: normalizedModelRoute,
        requestedReasoningEffort: reasoningEffort,
        modelUsed: selectedModel
      };
    } catch (error) {
      throw classifyGeminiRouteError({
        error,
        ParseApiError,
        modelRoute: normalizedModelRoute,
        model: selectedModel
      });
    }
  };

  const parseSentenceWithExternalProvider = async ({
    sentence,
    framework,
    modelRoute,
    apiKey,
    selectedModel,
    providerLabel,
    generate,
    reasoningEffort: requestedReasoningEffort
  }) => {
    if (!apiKey) {
      throw new ParseApiError('API_KEY_MISSING', `${providerLabel} API key is not configured on the server.`, 500);
    }

    const systemInstruction = buildSystemInstruction(framework, modelRoute);
    const fullContents = buildParseContentsPrompt(sentence, framework, modelRoute);
    const routeTemperature = resolveRouteTemperature(modelRoute);
    const routeMaxOutputTokens = resolveRouteMaxOutputTokens(modelRoute, sentence);
    const requestStartedAt = Date.now();
    const reasoningEffort = normalizeProviderReasoningEffort(modelRoute, requestedReasoningEffort);

    try {
      const remainingBudgetMs = getRemainingRequestBudgetMs(requestStartedAt, modelRoute);
      if (remainingBudgetMs <= 1200) {
        throw new ParseApiError(
          'PROVIDER_UNAVAILABLE',
          `${providerLabel} is unavailable; please try again in a moment.`,
          503
        );
      }

      const generation = await withTimeout(
        (abortSignal) => generate({
          apiKey,
          model: selectedModel,
          contents: fullContents,
          systemInstruction,
          temperature: routeTemperature,
          maxOutputTokens: routeMaxOutputTokens,
          reasoningEffort,
          effort: reasoningEffort,
          abortSignal
        }),
        resolveRequestTimeoutMs({
          baseTimeoutMs: resolveModelTimeoutMs(selectedModel, modelRoute),
          remainingBudgetMs
        }),
        `Model generation (${selectedModel})`
      );

      const generationMeta = summarizeGeneration(generation);
      const truncatedGeneration = isTruncatedGeneration(generation);
      const primaryDebugPayloadPath = maybeWritePrimaryDebugPayload({
        modelRoute,
        model: selectedModel,
        sentence,
        rawText: generationMeta.rawText
      });
      let payload;
      let payloadIntegrityFlags = [];

      try {
        const parsedPayload = parseModelJsonDetailed
          ? parseModelJsonDetailed(generationMeta.rawText)
          : { payload: parseModelJson(generationMeta.rawText), integrityFlags: [] };
        payload = parsedPayload.payload;
        payloadIntegrityFlags = Array.isArray(parsedPayload.integrityFlags)
          ? parsedPayload.integrityFlags
          : [];
      } catch (error) {
        const debugPayloadPath = writeDebugModelPayload({
          stage: `${modelRoute}-json-parse`,
          model: selectedModel,
          sentence,
          rawText: generationMeta.rawText
        });
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          truncatedGeneration ? 'Model output was truncated before JSON completion.' : (error?.message || 'Model returned invalid JSON.'),
          422,
          {
            stage: 'json-parse',
            model: selectedModel,
            finishReason: generationMeta.finishReason || null,
            textLength: generationMeta.textLength,
            preview: generationMeta.preview || '',
            debugPayloadPath
          }
        );
      }

      let normalized;
      try {
        normalized = normalizeParseBundle(
          payload,
          framework,
          sentence,
          modelRoute,
          true,
          { payloadIntegrityFlags }
        );
        if (normalized?.analyses?.[0]) {
          normalized = {
            ...normalized,
            analyses: [
            attachPrimaryParseProvenance(
              normalized.analyses[0],
              generationMeta,
              primaryDebugPayloadPath ? { primaryDebugPayloadPath } : {}
            )
          ]
        };
          normalized = validateFinalProNoteBindings(normalized);
        }
      } catch (error) {
        const debugPayloadPath = writeDebugModelPayload({
          stage: `${modelRoute}-normalization`,
          model: selectedModel,
          sentence,
          rawText: generationMeta.rawText
        });
        let payloadPreview = '<unserializable>';
        try {
          payloadPreview = JSON.stringify(payload).slice(0, 320);
        } catch {
          // keep fallback preview
        }
        const errorDetails = error instanceof ParseApiError && error.details && typeof error.details === 'object'
          ? error.details
          : {};
        throw new ParseApiError(
          error instanceof ParseApiError ? error.code : 'BAD_MODEL_RESPONSE',
          error?.message || 'Model payload failed normalization.',
          error instanceof ParseApiError ? error.status : 422,
          {
            ...errorDetails,
            stage: 'normalization',
            model: selectedModel,
            finishReason: generationMeta.finishReason || null,
            textLength: generationMeta.textLength,
            preview: generationMeta.preview || '',
            payloadPreview,
            debugPayloadPath
          }
        );
      }

      return {
        ...normalized,
        requestedModelRoute: modelRoute,
        requestedReasoningEffort: reasoningEffort,
        modelUsed: selectedModel
      };
    } catch (error) {
      throw classifyProviderRouteError({
        error,
        ParseApiError,
        providerLabel,
        model: selectedModel
      });
    }
  };

  const parseSentenceWithOpenAI = async (sentence, framework = 'xbar', modelRoute = 'gpt', options = {}) =>
    parseSentenceWithExternalProvider({
      sentence,
      framework,
      modelRoute,
      apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
      selectedModel: OPENAI_MODEL,
      providerLabel: 'OpenAI',
      generate: generateOpenAIStructuredContent,
      reasoningEffort: options.reasoningEffort
    });

  const parseSentenceWithClaude = async (sentence, framework = 'xbar', modelRoute = 'claude', options = {}) =>
    parseSentenceWithExternalProvider({
      sentence,
      framework,
      modelRoute,
      apiKey: String(process.env.ANTHROPIC_API_KEY || '').trim(),
      selectedModel: ANTHROPIC_MODEL,
      providerLabel: 'Claude',
      generate: generateAnthropicStructuredContent,
      reasoningEffort: options.reasoningEffort
    });

  return {
    parseSentenceWithLocalModel,
    parseSentenceWithGemini,
    parseSentenceWithOpenAI,
    parseSentenceWithClaude
  };
};
