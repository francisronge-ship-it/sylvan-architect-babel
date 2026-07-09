import { buildSystemInstruction } from './babelParser/systemInstruction.js';
import { MOVEMENT_INDEX_SUBSCRIPT_MAP } from './babelParser/constants.js';
import { ParseApiError } from './babelParser/error.js';
import {
  normalizeSurfaceToken,
  tokenizeSentenceSurfaceOrder
} from './babelParser/surfaceTokens.js';
import {
  STRUCTURAL_LEAF_LABELS,
  PRIME_CATEGORY_LABEL_RE,
  PRIME_MARK_RE,
  nextGeneratedNodeId,
  canonicalizeCovertSurface,
  collectNodeReferencesById,
  addNodeAliasIds,
  getLabelProfile
} from './babelParser/treeBasics.js';
import {
  buildParseContentsPrompt
} from './babelParser/prompts.js';
import {
  estimateProOutputBudget,
  resolveRouteMaxOutputTokens
} from './babelParser/routeConfig.js';
import {
  extractLocalModelResponseText,
  summarizeGeneration,
  summarizeProviderReasoningForDisplay
} from './babelParser/modelRuntime.js';
import { createDerivationHelpers } from './babelParser/derivationHelpers.js';
import { createNoteBindingHelpers } from './babelParser/noteBindings.js';
import { createSemanticValidationHelpers } from './babelParser/semanticValidation.js';
import { createParseRoutes } from './babelParser/parseRoutes.js';
import { createAnalysisNormalizationHelpers } from './babelParser/analysisNormalization.js';
import { createParseNormalizationHelpers } from './babelParser/parseNormalization.js';
import { createDerivationCompilerHelpers } from './babelParser/derivationCompiler.js';
import { createNormalizationUtils } from './babelParser/normalizationUtils.js';
import { createStepNormalizationHelpers } from './babelParser/stepNormalization.js';
import { createSyntaxTreeHelpers } from './babelParser/syntaxTree.js';
import { parseStrictModelJson, parseStrictModelJsonDetailed } from './babelParser/strictJson.js';

export { ParseApiError } from './babelParser/error.js';

const {
  normalizeKey,
  normalizeDerivationOperation,
  normalizeSpelloutOrder,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  normalizeNodeIdArray,
  normalizeMovementOperation,
  normalizeIndexedText,
  extractMovementIndex,
  stripMovementIndex,
  normalizeOpenChainType,
  normalizeChainType,
  mergeChainTypes,
  deriveChainTypeFromOperation
} = createNormalizationUtils({
  MOVEMENT_INDEX_SUBSCRIPT_MAP
});

let syntaxTreeHelpersRef = null;

const subtreeHasOvertYield = (...args) => {
  if (!syntaxTreeHelpersRef) {
    throw new Error('syntaxTreeHelpers not initialized');
  }
  return syntaxTreeHelpersRef.subtreeHasOvertYield(...args);
};

const {
  isMoveLikeOperation,
  buildNodeLabelIndexFromTree,
  normalizeVisualRelationEvents,
  isAbstractFeatureSurface,
  cleanExplanationWhitespace,
  ensureExplanationTerminator,
  getNodeOvertYield,
  normalizeTraceLikeSurface,
  isNullLikeSurface,
  buildNodeIndexFromTree,
  buildParentIndexFromTree,
  collectLeafNodes,
  resolveNodeSurface,
  resolveOvertLeafSurface,
  isTraceLikeSurface,
  isTraceLikeNode,
  isNullLikeNode,
  subtreeContainsOnlyCovertCategoryLeaves,
  subtreeContainsNamedCovertCategoryLeaf,
  stripMovementIndicesFromTree,
  materializeEmptyStructuralLeaves,
  promoteSentenceMatchingLeaves,
  buildCanonicalVisualRelationEvents,
  buildGroundedExplanation,
  harmonizeExplanationWithDerivation,
  getMovementDisplayLabel,
  normalizeMovementLabelKey,
  resolveHeadMovementLandingNode
} = createDerivationHelpers({
  MOVEMENT_INDEX_SUBSCRIPT_MAP,
  STRUCTURAL_LEAF_LABELS,
  PRIME_CATEGORY_LABEL_RE,
  canonicalizeCovertSurface,
  normalizeSurfaceToken,
  subtreeHasOvertYield,
  getLabelProfile,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  normalizeMovementOperation,
  extractMovementIndex,
  stripMovementIndex
});

syntaxTreeHelpersRef = createSyntaxTreeHelpers({
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
  normalizeSyntaxNode,
  normalizeSyntaxTreeWithIds,
  collectOvertTerminalNodes,
  sameTokenSequence,
  isTraceOrNullOnlySubtree,
  anchorOvertLeavesToSentenceTokens,
  deriveCanonicalSurfaceSpans,
  collectExistingNodeIds,
  collapseOvertHeadLandingChains,
  validateAndCommitSurfaceOrder,
  validateSpelloutConsistency
} = syntaxTreeHelpersRef;

const {
  compileNoteBindingsFromDerivationFrames,
  buildExplanationFromNoteBindings
} = createNoteBindingHelpers({
  normalizeOptionalStepText,
  cleanExplanationWhitespace,
  ensureExplanationTerminator
});

const {
  normalizeTransportJsonArray,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  normalizeMovementStemFromId,
  materializeImplicitPhrasalTraceShellsInDerivationFrames,
  materializeCommittedTraceShells,
  collectDerivationFrameNodeIds,
  canonicalizeDerivationRootCandidateForSentence,
  selectCommittedDerivationRoot,
  findLatestCommittedDerivationFrame,
  buildCanonicalVisualRelationEventsFromDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  assignDerivationStepIds
} = createDerivationCompilerHelpers({
  ParseApiError,
  nextGeneratedNodeId,
  normalizeSurfaceToken,
  normalizeDerivationOperation,
  normalizeOptionalStepText,
  normalizeNodeIdArray,
  normalizeOptionalStringArray,
  normalizeSpelloutOrder,
  normalizeMovementOperation,
  normalizeIndexedText,
  normalizeSyntaxNode,
  normalizeSyntaxTreeWithIds,
  collectNodeReferencesById,
  collectOvertTerminalNodes,
  promoteSentenceMatchingLeaves,
  stripMovementIndicesFromTree,
  materializeEmptyStructuralLeaves,
  resolveNodeSurface,
  subtreeHasOvertYield,
  isTraceOrNullOnlySubtree,
  getLabelProfile,
  isTraceLikeNode,
  isNullLikeNode,
  sameTokenSequence,
  isMoveLikeOperation,
  PRIME_CATEGORY_LABEL_RE,
  PRIME_MARK_RE,
  buildNodeIndexFromTree,
  buildParentIndexFromTree,
  collectLeafNodes,
  collectExistingNodeIds,
  getNodeOvertYield,
  isTraceLikeSurface,
  isNullLikeSurface,
  resolveHeadMovementLandingNode,
  anchorOvertLeavesToSentenceTokens,
  deriveCanonicalSurfaceSpans,
  subtreeContainsOnlyCovertCategoryLeaves,
  subtreeContainsNamedCovertCategoryLeaf,
  collapseOvertHeadLandingChains,
  addNodeAliasIds
});

const {
  deriveImplicitDerivationChainId
} = createStepNormalizationHelpers({
  normalizeOptionalStepText,
  normalizeMovementStemFromId
});

const {
  validatePronouncedCopiesAgainstCommittedTree,
  validateNoteBindingsAgainstStructuredAnalysis,
  runSemanticValidation,
  auditNoteConsistency
} = createSemanticValidationHelpers({
  ParseApiError,
  cleanExplanationWhitespace,
  normalizeMovementOperation,
  normalizeChainType,
  normalizeOptionalStepText,
  normalizeKey,
  buildNodeIndexFromTree,
  collectOvertTerminalNodes,
  subtreeContainsNamedCovertCategoryLeaf
});

const {
  normalizeCommitmentFacts,
  ensureStructuredEntryIds
} = createAnalysisNormalizationHelpers({
  normalizeNodeIdArray,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  normalizeTransportJsonArray
});

const {
  deriveChainsFromCommittedAnalysis,
  normalizeParseResult,
  normalizeParseBundle,
  validateFinalProNoteBindings
} = createParseNormalizationHelpers({
  ParseApiError,
  normalizeKey,
  normalizeOpenChainType,
  normalizeChainType,
  normalizeMovementOperation,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  getLabelProfile,
  tokenizeSentenceSurfaceOrder,
  normalizeSurfaceToken,
  compileNoteBindingsFromDerivationFrames,
  buildExplanationFromNoteBindings,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  materializeImplicitPhrasalTraceShellsInDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  collectNodeReferencesById,
  normalizeSyntaxTreeWithIds,
  buildNodeIndexFromTree,
  buildParentIndexFromTree,
  buildNodeLabelIndexFromTree,
  assignDerivationStepIds,
  normalizeVisualRelationEvents,
  validateAndCommitSurfaceOrder,
  validateSpelloutConsistency,
  buildCanonicalVisualRelationEvents,
  stripMovementIndicesFromTree,
  collectOvertTerminalNodes,
  resolveNodeSurface,
  resolveHeadMovementLandingNode,
  materializeCommittedTraceShells,
  buildGroundedExplanation,
  harmonizeExplanationWithDerivation,
  collectDerivationFrameNodeIds,
  normalizeCommitmentFacts,
  ensureStructuredEntryIds,
  runSemanticValidation,
  validatePronouncedCopiesAgainstCommittedTree,
  validateNoteBindingsAgainstStructuredAnalysis,
  auditNoteConsistency,
  deriveImplicitDerivationChainId,
  deriveChainTypeFromOperation,
  mergeChainTypes,
  normalizeMovementStemFromId,
  subtreeContainsNamedCovertCategoryLeaf
});

const parseModelJson = (rawText) => parseStrictModelJson(
  rawText,
  (code, message, status) => new ParseApiError(code, message, status)
);

const parseModelJsonDetailed = (rawText) => parseStrictModelJsonDetailed(
  rawText,
  (code, message, status) => new ParseApiError(code, message, status)
);

export const {
  parseSentenceWithLocalModel,
  parseSentenceWithGemini,
  parseSentenceWithOpenAI,
  parseSentenceWithClaude
} = createParseRoutes({
  ParseApiError,
  normalizeParseBundle,
  validateFinalProNoteBindings,
  parseModelJson,
  parseModelJsonDetailed
});

export const __test__ = {
  normalizeParseBundle,
  normalizeParseResult,
  validateFinalProNoteBindings,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  validateAndCommitSurfaceOrder,
  canonicalizeDerivationRootCandidateForSentence,
  selectCommittedDerivationRoot,
  findLatestCommittedDerivationFrame,
  buildCanonicalVisualRelationEvents,
  buildCanonicalVisualRelationEventsFromDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  harmonizeExplanationWithDerivation,
  buildSystemInstruction,
  buildParseContentsPrompt,
  summarizeProviderReasoningForDisplay,
  summarizeGeneration,
  extractLocalModelResponseText,
  estimateProOutputBudget,
  resolveRouteMaxOutputTokens,
  parseModelJson,
  parseModelJsonDetailed,
  compileNoteBindingsFromDerivationFrames,
  normalizeSurfaceToken,
  tokenizeSentenceSurfaceOrder,
  anchorOvertLeavesToSentenceTokens,
  deriveCanonicalSurfaceSpans,
  collectOvertTerminalNodes,
  validatePronouncedCopiesAgainstCommittedTree,
  validateNoteBindingsAgainstStructuredAnalysis
};
