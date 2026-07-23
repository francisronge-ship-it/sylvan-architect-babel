import {
  ParseApiError,
  parseSentenceWithClaude,
  parseSentenceWithGemini,
  parseSentenceWithOpenAI
} from './babelParser.js';
import { normalizeProviderReasoningEffort } from './babelParser/routeConfig.js';
import {
  createFailure,
  withFailureDetails
} from './babelParser/validationErrors.js';

const FRAMEWORKS = new Set(['xbar', 'minimalism']);
const MODEL_ROUTES = new Set(['gemini', 'gpt', 'claude']);
const MAX_SENTENCE_LENGTH = 600;

/**
 * Strip characters and patterns commonly used in prompt-injection attacks
 * while preserving legitimate linguistic content (diacritics, scripts, punctuation).
 */
const sanitizeSentenceInput = (raw) => {
  let s = raw;
  s = s.replace(/`{2,}/g, '');
  s = s.replace(/\[INST\]|\[\/INST\]|\[SYSTEM\]|\[\/SYSTEM\]/gi, '');
  s = s.replace(/^(system|user|assistant|human)\s*:/gim, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
};

export const validateParseBody = (body) => {
  if (!body || typeof body !== 'object') {
    throw new ParseApiError(
      'INVALID_REQUEST',
      'Request body must be a JSON object.',
      400,
      withFailureDetails({}, {
        failureClass: 'transport_serialization',
        ruleId: 'REQUEST_BODY_OBJECT',
        fieldPath: '$',
        offendingValue: body
      })
    );
  }

  const rawSentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
  const framework = typeof body.framework === 'string' ? body.framework.trim() : 'xbar';
  const modelRoute = typeof body.modelRoute === 'string' ? body.modelRoute.trim().toLowerCase() : 'gemini';
  const reasoningEffort = normalizeProviderReasoningEffort(
    modelRoute,
    typeof body.reasoningEffort === 'string' ? body.reasoningEffort : undefined
  );

  if (!rawSentence) {
    throw new ParseApiError(
      'INVALID_REQUEST',
      'Sentence is required.',
      400,
      withFailureDetails({}, {
        failureClass: 'transport_serialization',
        ruleId: 'REQUEST_SENTENCE_REQUIRED',
        fieldPath: '$.sentence',
        offendingValue: body.sentence
      })
    );
  }

  if (rawSentence.length > MAX_SENTENCE_LENGTH) {
    throw new ParseApiError(
      'INVALID_REQUEST',
      `Sentence exceeds ${MAX_SENTENCE_LENGTH} characters.`,
      400,
      withFailureDetails({}, {
        failureClass: 'transport_serialization',
        ruleId: 'REQUEST_SENTENCE_LENGTH',
        fieldPath: '$.sentence',
        offendingValue: rawSentence
      })
    );
  }

  const sentence = sanitizeSentenceInput(rawSentence);

  if (!sentence) {
    throw new ParseApiError(
      'INVALID_REQUEST',
      'Sentence is empty after sanitization.',
      400,
      withFailureDetails({}, {
        failureClass: 'transport_serialization',
        ruleId: 'REQUEST_SENTENCE_SANITIZED_NONEMPTY',
        fieldPath: '$.sentence',
        offendingValue: body.sentence
      })
    );
  }

  if (!FRAMEWORKS.has(framework)) {
    throw new ParseApiError(
      'INVALID_REQUEST',
      'Framework must be "xbar" or "minimalism".',
      400,
      withFailureDetails({}, {
        failureClass: 'transport_serialization',
        ruleId: 'REQUEST_FRAMEWORK_SUPPORTED',
        fieldPath: '$.framework',
        offendingValue: framework
      })
    );
  }

  if (!MODEL_ROUTES.has(modelRoute)) {
    throw new ParseApiError(
      'INVALID_REQUEST',
      'Model route must be "gemini", "gpt", or "claude".',
      400,
      withFailureDetails({}, {
        failureClass: 'transport_serialization',
        ruleId: 'REQUEST_MODEL_ROUTE_SUPPORTED',
        fieldPath: '$.modelRoute',
        offendingValue: modelRoute
      })
    );
  }

  return { sentence, framework, modelRoute, reasoningEffort };
};

export const parseFromBodyWithProviders = async (
  body,
  providers = {
    gemini: parseSentenceWithGemini,
    gpt: parseSentenceWithOpenAI,
    claude: parseSentenceWithClaude
  }
  ) => {
  const { sentence, framework, modelRoute, reasoningEffort } = validateParseBody(body);
  return providers[modelRoute](sentence, framework, modelRoute, { reasoningEffort });
};

export const parseFromBody = async (body) => parseFromBodyWithProviders(body);

const isProduction = process.env.NODE_ENV === 'production';

export const formatApiError = (error) => {
  if (error instanceof ParseApiError) {
    const { rawOutputArtifact: _rawOutputArtifact, ...safeDetails } =
      error.details && typeof error.details === 'object'
        ? error.details
        : {};
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          failure: error.failure,
          ...(error.rawOutput ? { rawOutput: error.rawOutput } : {}),
          ...(isProduction ? {} : { details: safeDetails })
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error.',
        failure: createFailure({
          failureClass: 'deterministic_engine_failure',
          ruleId: 'DETERMINISTIC_ENGINE',
          fieldPath: '$',
          offendingValue: null
        })
      }
    }
  };
};
