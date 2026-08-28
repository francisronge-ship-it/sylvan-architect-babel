import {
  ParseBundle,
  ParseFailure,
  RawOutputArtifact
} from '../types';

export class ParseServiceError extends Error {
  code: string;
  failure?: ParseFailure;
  rawOutput?: RawOutputArtifact;

  constructor({
    code,
    message,
    failure,
    rawOutput
  }: {
    code: string;
    message: string;
    failure?: ParseFailure;
    rawOutput?: RawOutputArtifact;
  }) {
    super(message);
    this.name = 'ParseServiceError';
    this.code = code;
    this.failure = failure;
    this.rawOutput = rawOutput;
  }
}

const parseErrorFromResponse = async (response: Response): Promise<ParseServiceError> => {
  try {
    const payload = await response.json();
    const code = String(payload?.error?.code || '').trim();
    const message = String(payload?.error?.message || '').trim();
    return new ParseServiceError({
      code: code || 'HTTP_ERROR',
      message: message || code || `Request failed with status ${response.status}.`,
      failure: payload?.error?.failure,
      rawOutput: payload?.error?.rawOutput
    });
  } catch {
    return new ParseServiceError({
      code: 'HTTP_ERROR',
      message: `Request failed with status ${response.status}.`
    });
  }
};

export const parseSentence = async (
  sentence: string,
  framework: 'xbar' | 'minimalism' = 'xbar',
  modelRoute: 'gemini' | 'gpt' | 'claude' = 'gemini',
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'high'
): Promise<ParseBundle> => {
  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sentence, framework, modelRoute, reasoningEffort })
  });

  if (!response.ok) {
    throw await parseErrorFromResponse(response);
  }

  const data = (await response.json()) as ParseBundle;
  if (!data || !Array.isArray(data.analyses) || data.analyses.length === 0) {
    throw new Error('Linguistic result malformed. Please try again.');
  }

  return data;
};
