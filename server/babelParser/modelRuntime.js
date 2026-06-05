import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ANTHROPIC_EFFORT,
  ANTHROPIC_THINKING_CONFIG,
  DEFAULT_MAX_OUTPUT_TOKENS,
  LOCAL_MODEL_COMMAND,
  LOCAL_MODEL_MAX_OUTPUT_TOKENS,
  LOCAL_MODEL_NAME,
  LOCAL_MODEL_NUM_CTX,
  LOCAL_MODEL_TIMEOUT_MS,
  LOCAL_MODEL_URL,
  MODEL_TEMPERATURE,
  OPENAI_BACKGROUND_POLL_INTERVAL_MS,
  OPENAI_BACKGROUND_RESPONSES,
  OPENAI_REASONING_EFFORT,
  PRIMARY_MODEL,
  PRO_MODEL
} from './routeConfig.js';

export const getErrorMeta = (error) => {
  const msg = String(error?.message || '');
  const details = JSON.stringify(error || {});
  const haystack = `${msg}\n${details}`.toLowerCase();
  const statusCode = Number(
    error?.status ??
    error?.response?.status ??
    (typeof error?.code === 'number' ? error.code : NaN)
  );
  return { msg, haystack, statusCode };
};

export const isNetworkTransportError = (error) => {
  const { haystack } = getErrorMeta(error);
  return (
    haystack.includes('fetch failed') ||
    haystack.includes('network') ||
    haystack.includes('timed out') ||
    haystack.includes('econnreset') ||
    haystack.includes('etimedout') ||
    haystack.includes('enotfound') ||
    haystack.includes('socket')
  );
};

export const summarizeErrorForLog = (error) => {
  const { msg, statusCode } = getErrorMeta(error);
  const shortMessage = String(msg || '')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
    message: shortMessage || undefined
  };
};

export const withTimeout = async (run, timeoutMs, label) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return run(undefined);
  }

  const controller = new AbortController();
  let timeoutId = null;
  const timeoutMessage = `${label} timed out after ${timeoutMs}ms.`;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const extractLocalModelResponseText = (payload) => {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';
  if (Array.isArray(payload?.analyses)) return JSON.stringify(payload);
  if (typeof payload.response === 'string') return payload.response.trim();
  if (typeof payload.output === 'string') return payload.output.trim();
  if (typeof payload.text === 'string') return payload.text.trim();
  const firstChoice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = firstChoice?.message?.content ?? firstChoice?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
};

const normalizeLocalTransportText = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    return extractLocalModelResponseText(parsed) || trimmed;
  } catch {
    return trimmed;
  }
};

export const resolveLocalMaxOutputTokens = (requestedMaxOutputTokens) => {
  const requested = Number(requestedMaxOutputTokens);
  if (!Number.isFinite(requested) || requested <= 0) {
    return LOCAL_MODEL_MAX_OUTPUT_TOKENS;
  }
  return Math.max(256, Math.min(requested, LOCAL_MODEL_MAX_OUTPUT_TOKENS));
};

const invokeLocalModelCommand = async ({
  sentence,
  framework,
  systemInstruction,
  prompt,
  temperature,
  maxOutputTokens,
  format = 'json',
  timeoutMs
}) => {
  const result = spawnSync(LOCAL_MODEL_COMMAND, {
    shell: true,
    input: JSON.stringify({
      sentence,
      framework,
      model: LOCAL_MODEL_NAME,
      systemInstruction,
      prompt,
      temperature,
      maxOutputTokens,
      format,
      numCtx: LOCAL_MODEL_NUM_CTX,
      think: false
    }),
    encoding: 'utf8',
    timeout: Math.max(0, Number(timeoutMs || LOCAL_MODEL_TIMEOUT_MS)),
    maxBuffer: 25 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || `Local command exited with status ${result.status}`));
  }
  return normalizeLocalTransportText(result.stdout || '');
};

const invokeLocalModelHttp = async ({
  systemInstruction,
  prompt,
  temperature,
  maxOutputTokens,
  timeoutMs,
  format = 'json'
}) => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), Math.max(0, Number(timeoutMs || LOCAL_MODEL_TIMEOUT_MS)));
  try {
    const response = await fetch(LOCAL_MODEL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: LOCAL_MODEL_NAME,
        system: systemInstruction,
        prompt,
        format,
        stream: false,
        think: false,
        options: {
          temperature,
          num_predict: resolveLocalMaxOutputTokens(maxOutputTokens),
          num_ctx: LOCAL_MODEL_NUM_CTX
        }
      }),
      signal: abortController.signal
    });
    const responseText = await response.text();
    if (!response.ok) {
      const error = new Error(String(responseText || `Local model HTTP transport failed (${response.status})`));
      error.status = response.status;
      throw error;
    }
    return normalizeLocalTransportText(responseText || '');
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Local model HTTP transport timed out after ${Math.max(0, Number(timeoutMs || LOCAL_MODEL_TIMEOUT_MS))} ms`);
      timeoutError.status = 408;
      throw timeoutError;
    }
    if (error?.cause?.message) {
      error.message = `${error.message}: ${error.cause.message}`;
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const generateStructuredLocalContent = async ({
  sentence,
  framework,
  systemInstruction,
  prompt,
  temperature,
  maxOutputTokens,
  timeoutMs = LOCAL_MODEL_TIMEOUT_MS,
  format = 'json'
}) => {
  if (LOCAL_MODEL_COMMAND) {
    return invokeLocalModelCommand({
      sentence,
      framework,
      systemInstruction,
      prompt,
      temperature,
      maxOutputTokens: resolveLocalMaxOutputTokens(maxOutputTokens),
      timeoutMs,
      format
    });
  }
  return invokeLocalModelHttp({
    systemInstruction,
    prompt,
    temperature,
    maxOutputTokens: resolveLocalMaxOutputTokens(maxOutputTokens),
    timeoutMs,
    format
  });
};

export const isTruncatedGeneration = (generation) => {
  const finishReason = String(generation?.candidates?.[0]?.finishReason || '').toUpperCase();
  return finishReason.includes('MAX_TOKENS') || finishReason.includes('LENGTH');
};

const unwrapProviderReasoningTransportText = (value) => {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text.replace(/^```(?:json|text|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string' && parsed.trim()) {
        text = parsed.trim();
      } else {
        text = text.slice(1, -1).trim();
      }
    } catch {
      text = text.slice(1, -1).trim();
    }
  }
  return text.trim();
};

export const summarizeProviderReasoningForDisplay = (text, maxChars = 520) => {
  const cleaned = unwrapProviderReasoningTransportText(text)
    .replace(/\r/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\bSHOW FULL RAW THINKING TRACE\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (
    /^[{\[]/.test(cleaned) &&
    /"(?:analyses|analysis|derivationStages|stageRecord|workspaceForest|visualRelations|noteBindings|tree)"/.test(cleaned)
  ) {
    return '';
  }

  const metaIntroRe =
    /^(?:analysis of[^:]*:\s*|deep dive into[^:]*:?|okay[, ]+|here(?:'|’)s how i(?:'|’)m thinking(?: about this sentence)?[, ]*|my immediate thought\??|first[, ]+|let(?:'|’)s\s+)/i;
  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim().replace(/^\d+\.\s*/, '').replace(metaIntroRe, '').trim())
    .filter(Boolean);

  if (sentenceParts.length === 0) {
    return cleaned.length <= maxChars ? cleaned : `${cleaned.slice(0, maxChars).trim()}...`;
  }

  const decisionCueRe =
    /\b(?:because|since|therefore|thus|so|given|evidence|cue|signal|shows?|indicates?|suggests?|supports?|licenses?|forces?|requires?|must|challenge|favou?rs?|prefers?|chooses?|decides?|rather than|instead of|contrast|alternative|standard analysis|word order|agreement|morphology|movement|selection|locality|scope|case|theta|theta-role|raising|control|passive|unaccusative|v2|wh|inversion)\b/i;
  const recapPenaltyRe =
    /\b(?:the analysis projects|the clause architecture|the final tree|spellout yields|surface string|surface order|the sentence is|this is a)\b/i;
  const metaPenaltyRe =
    /\b(?:i immediately recognize|i see|i begin|i'm thinking|here's how i'm thinking|my immediate thought|let's|okay)\b/i;

  const ranked = sentenceParts.map((part, index) => {
    let score = 0;
    if (decisionCueRe.test(part)) score += 4;
    if (/\b(?:rather than|instead of|contrast|alternative)\b/i.test(part)) score += 2;
    if (/\b(?:because|since|given|shows?|indicates?|suggests?)\b/i.test(part)) score += 2;
    if (/\b(?:must|requires?|challenge|standard analysis)\b/i.test(part)) score += 2;
    if (recapPenaltyRe.test(part)) score -= 3;
    if (metaPenaltyRe.test(part)) score -= 4;
    return { part, index, score };
  });

  const chosen = ranked
    .slice()
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .filter((entry) => entry.score > 0)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.part);

  const preferredParts = chosen.length > 0 ? chosen : sentenceParts.slice(0, 2);
  const selected = [];
  let total = 0;
  for (const part of preferredParts) {
    const nextTotal = total + (selected.length > 0 ? 1 : 0) + part.length;
    if (selected.length >= 3 || nextTotal > maxChars) break;
    selected.push(part);
    total = nextTotal;
  }

  if (selected.length > 0) {
    return selected.join(' ').trim();
  }
  return cleaned.length <= maxChars ? cleaned : `${cleaned.slice(0, maxChars).trim()}...`;
};

export const summarizeGeneration = (generation) => {
  const contentParts = Array.isArray(generation?.candidates?.[0]?.content?.parts)
    ? generation.candidates[0].content.parts
    : [];
  const nonThoughtText = contentParts
    .filter((part) => !part?.thought && typeof part?.text === 'string')
    .map((part) => String(part.text || ''))
    .join('')
    .trim();
  const rawText = String(nonThoughtText || generation?.text || '');
  const finishReason = String(generation?.candidates?.[0]?.finishReason || '').toUpperCase() || 'UNKNOWN';
  const promptTokenCount = Number(
    generation?.usageMetadata?.promptTokenCount
    || generation?.usageMetadata?.inputTokenCount
    || generation?.usageMetadata?.promptTokens
    || 0
  ) || undefined;
  const outputTokenCount = Number(
    generation?.usageMetadata?.candidatesTokenCount
    || generation?.usageMetadata?.outputTokenCount
    || generation?.usageMetadata?.completionTokenCount
    || 0
  ) || undefined;
  const totalTokenCount = Number(
    generation?.usageMetadata?.totalTokenCount
    || generation?.usageMetadata?.totalTokens
    || 0
  ) || (promptTokenCount && outputTokenCount ? (promptTokenCount + outputTokenCount) : undefined);
  const thoughtParts = contentParts.filter((part) => Boolean(part?.thought));
  const providerReasoningRaw = thoughtParts
    .map((part) => String(part?.text || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
  const providerReasoningSummary = summarizeProviderReasoningForDisplay(providerReasoningRaw);
  const preview = rawText
    .slice(0, 220)
    .replace(/\s+/g, ' ')
    .trim();
  return {
    rawText,
    finishReason,
    textLength: rawText.length,
    preview,
    providerReasoningRaw: providerReasoningRaw || undefined,
    providerReasoningSummary: providerReasoningSummary || undefined,
    promptTokenCount,
    outputTokenCount,
    totalTokenCount,
    thoughtsTokenCount: Number(generation?.usageMetadata?.thoughtsTokenCount || generation?.usageMetadata?.totalThoughtTokens || 0) || undefined
  };
};

export const writeDebugModelPayload = ({ stage = 'unknown', model = 'unknown', sentence = '', rawText = '' }) => {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const dir = path.resolve(process.cwd(), '.artifacts', 'debug-model-payloads');
    fs.mkdirSync(dir, { recursive: true });
    const safeStage = String(stage || 'unknown').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    const safeModel = String(model || 'unknown').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${timestamp}-${safeStage}-${safeModel}.txt`);
    fs.writeFileSync(
      file,
      [
        `sentence: ${sentence}`,
        `model: ${model}`,
        `stage: ${stage}`,
        '',
        String(rawText || '')
      ].join('\n'),
      'utf8'
    );
    return file;
  } catch {
    return null;
  }
};

export const generateStructuredContent = async ({
  ai,
  model,
  contents,
  systemInstruction,
  temperature = MODEL_TEMPERATURE,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  responseJsonSchema,
  abortSignal,
  includeThoughts = false,
  thinkingConfig
}) => {
  return ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      maxOutputTokens,
      temperature,
      ...(responseJsonSchema ? { responseJsonSchema } : {}),
      ...(thinkingConfig
        ? { thinkingConfig }
        : (includeThoughts ? { thinkingConfig: { includeThoughts: true } } : {})),
      abortSignal
    }
  });
};

const readResponseText = async (response) => {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
};

const delayWithAbort = (ms, abortSignal) => new Promise((resolve, reject) => {
  if (abortSignal?.aborted) {
    reject(abortSignal.reason || new Error('Operation aborted.'));
    return;
  }
  const timeout = setTimeout(resolve, Math.max(0, ms));
  const onAbort = () => {
    clearTimeout(timeout);
    reject(abortSignal.reason || new Error('Operation aborted.'));
  };
  abortSignal?.addEventListener?.('abort', onAbort, { once: true });
});

const OPENAI_RESPONSE_TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'incomplete']);

const fetchOpenAIResponseJson = async ({ apiKey, responseId, abortSignal }) => {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal: abortSignal
  });
  const payload = await readResponseText(response);
  if (!response.ok) {
    const error = new Error(String(payload.json?.error?.message || payload.text || `OpenAI response polling failed (${response.status})`));
    error.status = response.status;
    error.responseBody = payload.text;
    throw error;
  }
  return payload;
};

const writeOpenAIDebugResponseState = ({ model, responseId, stage, payload }) => {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const dir = path.resolve(process.cwd(), '.artifacts', 'debug-model-payloads');
    fs.mkdirSync(dir, { recursive: true });
    const safeModel = String(model || 'unknown').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
    const safeId = String(responseId || 'no-id').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
    const safeStage = String(stage || 'state').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${timestamp}-openai-${safeStage}-${safeModel}-${safeId}.json`);
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return file;
  } catch {
    return null;
  }
};

const waitForOpenAIResponseCompletion = async ({
  apiKey,
  initialPayload,
  pollIntervalMs,
  model,
  abortSignal
}) => {
  let payload = initialPayload;
  let json = payload.json;
  const responseId = String(json?.id || '').trim();
  if (!responseId) return payload;
  writeOpenAIDebugResponseState({ model, responseId, stage: 'created', payload: json });

  while (json && !OPENAI_RESPONSE_TERMINAL_STATUSES.has(String(json.status || '').toLowerCase())) {
    await delayWithAbort(pollIntervalMs, abortSignal);
    payload = await fetchOpenAIResponseJson({ apiKey, responseId, abortSignal });
    json = payload.json;
    writeOpenAIDebugResponseState({ model, responseId, stage: 'polled', payload: json });
  }
  return payload;
};

const extractOpenAIOutputText = (payloadJson) => String(payloadJson?.output_text || '').trim()
  || (Array.isArray(payloadJson?.output)
    ? payloadJson.output
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .map((part) => String(part?.text || ''))
      .join('')
      .trim()
    : '');

export const generateOpenAIStructuredContent = async ({
  apiKey,
  model,
  contents,
  systemInstruction,
  temperature = MODEL_TEMPERATURE,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  reasoningEffort = OPENAI_REASONING_EFFORT,
  background = OPENAI_BACKGROUND_RESPONSES,
  pollIntervalMs = OPENAI_BACKGROUND_POLL_INTERVAL_MS,
  abortSignal
}) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      instructions: systemInstruction,
      input: contents,
      text: { format: { type: 'json_object' } },
      reasoning: { effort: reasoningEffort },
      ...(background ? { background: true, store: true } : {}),
      max_output_tokens: maxOutputTokens
    }),
    signal: abortSignal
  });

  const payload = await readResponseText(response);
  if (!response.ok) {
    const error = new Error(String(payload.json?.error?.message || payload.text || `OpenAI request failed (${response.status})`));
    error.status = response.status;
    error.responseBody = payload.text;
    throw error;
  }

  if (background) {
    const completedPayload = await waitForOpenAIResponseCompletion({
      apiKey,
      initialPayload: payload,
      pollIntervalMs,
      model,
      abortSignal
    });
    payload.text = completedPayload.text;
    payload.json = completedPayload.json;
  }

  if (payload.json?.status === 'incomplete') {
    const reason = String(payload.json?.incomplete_details?.reason || 'unknown').trim();
    const error = new Error(`OpenAI response incomplete: ${reason}`);
    error.status = 422;
    error.responseBody = payload.text;
    throw error;
  }

  if (payload.json?.status === 'failed' || payload.json?.status === 'cancelled') {
    const errorMessage = String(payload.json?.error?.message || `OpenAI response ${payload.json.status}.`);
    const error = new Error(errorMessage);
    error.status = 502;
    error.responseBody = payload.text;
    throw error;
  }

  const outputText = extractOpenAIOutputText(payload.json);

  return {
    text: outputText,
    candidates: [{ finishReason: String(payload.json?.status || 'STOP').toUpperCase() }],
    usageMetadata: {
      inputTokenCount: payload.json?.usage?.input_tokens,
      outputTokenCount: payload.json?.usage?.output_tokens,
      totalTokenCount: payload.json?.usage?.total_tokens
    }
  };
};

export const generateAnthropicStructuredContent = async ({
  apiKey,
  model,
  contents,
  systemInstruction,
  temperature = MODEL_TEMPERATURE,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  effort = ANTHROPIC_EFFORT,
  thinking = ANTHROPIC_THINKING_CONFIG,
  abortSignal
}) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      system: `${systemInstruction}\n\nReturn exactly one valid JSON object and no prose.`,
      messages: [{ role: 'user', content: contents }],
      thinking,
      output_config: { effort },
      max_tokens: maxOutputTokens
    }),
    signal: abortSignal
  });

  const payload = await readResponseText(response);
  if (!response.ok) {
    const error = new Error(String(payload.json?.error?.message || payload.text || `Anthropic request failed (${response.status})`));
    error.status = response.status;
    error.responseBody = payload.text;
    throw error;
  }

  const outputText = Array.isArray(payload.json?.content)
    ? payload.json.content
      .map((part) => String(part?.text || ''))
      .join('')
      .trim()
    : '';

  return {
    text: outputText,
    candidates: [{ finishReason: String(payload.json?.stop_reason || 'STOP').toUpperCase() }],
    usageMetadata: {
      inputTokenCount: payload.json?.usage?.input_tokens,
      outputTokenCount: payload.json?.usage?.output_tokens,
      totalTokenCount: (
        Number(payload.json?.usage?.input_tokens || 0) +
        Number(payload.json?.usage?.output_tokens || 0)
      ) || undefined
    }
  };
};

export const isPrimaryModel = (model) => model === PRIMARY_MODEL;
export const isProModel = (model) => model === PRO_MODEL;
