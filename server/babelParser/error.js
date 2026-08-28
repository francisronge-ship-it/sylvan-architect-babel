import { failureFromErrorParts } from './validationErrors.js';

export class ParseApiError extends Error {
  constructor(code, message, status = 500, details = undefined) {
    super(message);
    this.name = 'ParseApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.failure = failureFromErrorParts(code, details);
    this.rawOutput = details?.rawOutputArtifact;
  }
}
