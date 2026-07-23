import { buildSystemInstruction } from './babelParser/systemInstruction.js';
import { MOVEMENT_INDEX_SUBSCRIPT_MAP } from './babelParser/constants.js';
import { ParseApiError } from './babelParser/error.js';
import { withFailureDetails } from './babelParser/validationErrors.js';
import {
  normalizeSurfaceToken,
  tokenizeSentenceSurfaceOrder
} from './babelParser/surfaceTokens.js';
import {
  STRUCTURAL_LEAF_LABELS,
  PRIME_CATEGORY_LABEL_RE,
  canonicalizeCovertSurface,
  collectNodeReferencesById
} from './babelParser/treeBasics.js';
import {
  buildParseContentsPrompt
} from './babelParser/prompts.js';
import {
  estimateGeminiOutputBudget,
  resolveRouteMaxOutputTokens
} from './babelParser/routeConfig.js';
import {
  extractLocalModelResponseText,
  summarizeGeneration
} from './babelParser/modelRuntime.js';
import { createDerivationHelpers } from './babelParser/derivationHelpers.js';
import { createParseRoutes } from './babelParser/parseRoutes.js';
import { createParseNormalizationHelpers } from './babelParser/parseNormalization.js';
import { createDerivationCompilerHelpers } from './babelParser/derivationCompiler.js';
import { createNormalizationUtils } from './babelParser/normalizationUtils.js';
import { createSyntaxTreeHelpers } from './babelParser/syntaxTree.js';
import { parseStrictModelJson, parseStrictModelJsonDetailed } from './babelParser/strictJson.js';

export { ParseApiError } from './babelParser/error.js';

const {
  normalizeOptionalStepText,
  normalizeNodeIdArray,
  normalizeMovementOperation
} = createNormalizationUtils({
  MOVEMENT_INDEX_SUBSCRIPT_MAP
});

const {
  isAbstractFeatureSurface,
  isNullLikeSurface,
  buildNodeIndexFromTree,
  buildParentIndexFromTree,
  collectLeafNodes,
  resolveNodeSurface,
  resolveOvertLeafSurface,
  isTraceLikeSurface,
  isTraceLikeNode,
  isNullLikeNode,
  normalizeMovementLabelKey
} = createDerivationHelpers({
  STRUCTURAL_LEAF_LABELS,
  PRIME_CATEGORY_LABEL_RE,
  canonicalizeCovertSurface
});

const syntaxTreeHelpersRef = createSyntaxTreeHelpers({
  ParseApiError,
  normalizeOptionalStepText,
  normalizeNodeIdArray,
  normalizeMovementOperation,
  resolveNodeSurface,
  resolveOvertLeafSurface,
  isAbstractFeatureSurface,
  isTraceLikeSurface,
  isNullLikeSurface,
  isTraceLikeNode,
  isNullLikeNode,
  collectLeafNodes,
  buildNodeIndexFromTree,
  buildParentIndexFromTree,
  normalizeMovementLabelKey
});

const {
  collectOvertTerminalNodes,
  sameTokenSequence,
  anchorOvertLeavesToSentenceTokens,
  deriveCanonicalSurfaceSpans,
  validateAndCommitSurfaceOrder
} = syntaxTreeHelpersRef;

const {
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  canonicalizeDerivationRootCandidateForSentence,
  selectCommittedDerivationRoot,
  findLatestCommittedDerivationFrame,
  buildCanonicalDerivationFromDerivationFrames
} = createDerivationCompilerHelpers({
  ParseApiError,
  normalizeOptionalStepText,
  collectNodeReferencesById,
  collectOvertTerminalNodes,
  resolveNodeSurface,
  sameTokenSequence,
  deriveCanonicalSurfaceSpans
});

const {
  normalizeParseResult,
  normalizeParseBundle
} = createParseNormalizationHelpers({
  ParseApiError,
  normalizeOptionalStepText,
  tokenizeSentenceSurfaceOrder,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  collectNodeReferencesById,
  sameTokenSequence,
  collectOvertTerminalNodes,
  resolveNodeSurface
});

const parseModelJson = (rawText) => parseStrictModelJson(
  rawText,
  (code, message, status, offendingRawText) => new ParseApiError(
    code,
    message,
    status,
    withFailureDetails({}, {
      failureClass: 'transport_serialization',
      ruleId: 'TRANSPORT_JSON_OBJECT',
      fieldPath: '$',
      offendingValue: offendingRawText
    }, offendingRawText)
  )
);

const parseModelJsonDetailed = (rawText) => parseStrictModelJsonDetailed(
  rawText,
  (code, message, status, offendingRawText) => new ParseApiError(
    code,
    message,
    status,
    withFailureDetails({}, {
      failureClass: 'transport_serialization',
      ruleId: 'TRANSPORT_JSON_OBJECT',
      fieldPath: '$',
      offendingValue: offendingRawText
    }, offendingRawText)
  )
);

export const {
  parseSentenceWithLocalModel,
  parseSentenceWithGemini,
  parseSentenceWithOpenAI,
  parseSentenceWithClaude
} = createParseRoutes({
  ParseApiError,
  normalizeParseBundle,
  parseModelJson,
  parseModelJsonDetailed
});

export const __test__ = {
  normalizeParseBundle,
  normalizeParseResult,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  validateAndCommitSurfaceOrder,
  canonicalizeDerivationRootCandidateForSentence,
  selectCommittedDerivationRoot,
  findLatestCommittedDerivationFrame,
  buildCanonicalDerivationFromDerivationFrames,
  buildSystemInstruction,
  buildParseContentsPrompt,
  summarizeGeneration,
  extractLocalModelResponseText,
  estimateGeminiOutputBudget,
  resolveRouteMaxOutputTokens,
  parseModelJson,
  parseModelJsonDetailed,
  normalizeSurfaceToken,
  tokenizeSentenceSurfaceOrder,
  anchorOvertLeavesToSentenceTokens,
  deriveCanonicalSurfaceSpans,
  collectOvertTerminalNodes
};
