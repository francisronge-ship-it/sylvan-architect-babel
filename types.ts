export interface SyntaxNode {
  label: string;
  children?: SyntaxNode[];
  word?: string;
  tokenIndex?: number;
  silent?: boolean;
  surfaceSpan?: [number, number];
  id?: string; // Optional ID for D3 indexing
  aliasIds?: string[];
  lineageId?: string;
}

export type OpenOntologyLabel = string & {};

export type DerivationOperation = OpenOntologyLabel;

export interface ReplayDetailBlock {
  title: string;
  lines: string[];
}

export interface DerivationStep {
  stepId?: string;
  operation: DerivationOperation;
  chainId?: string;
  targetLabel?: string;
  targetNodeId?: string;
  sourceNodeIds?: string[];
  sourceLabels?: string[];
  recipe?: string;
  workspaceAfter?: string[];
  spelloutOrder?: string[];
  detailBlocks?: ReplayDetailBlock[];
  note?: string;
}

export interface DerivationStage {
  statement: string;
  stageRecord: string;
  relations: DerivationStageRelation[];
  workspaceForest: SyntaxNode[];
}

export interface DerivationStageRelation {
  relation: OpenOntologyLabel;
  anchors: Record<string, string | string[]>;
  /**
   * Optional witnesses that resolve in the immediately preceding authored
   * stage's workspace, verbatim. Carried untouched through normalization and
   * replay; renderers use them only for backward comparison cues.
   */
  priorAnchors?: Record<string, string | string[]>;
  /**
   * Optional authored literal payload, verbatim. Values are display literals,
   * never node ids, and never affect neutral-fallback geometry.
   */
  values?: Record<string, string | string[]>;
}

export interface GenerationPromptContract {
  framework: 'xbar' | 'minimalism';
  promptRoute: 'gemini' | 'gpt' | 'claude';
  systemInstructionSha256: string;
  promptSha256: string;
  promptTemplateSha256: string;
}

export interface SentGenerationConfig {
  [key: string]: string | number | boolean | null;
}

export interface GenerationRecord {
  schemaVersion: 2;
  provider: 'gemini' | 'gpt' | 'claude' | 'local';
  promptContract: GenerationPromptContract;
  sentGenerationConfig: SentGenerationConfig;
  timing: {
    requestStartedAt: string;
    durationMs: number;
  };
  outcome?: {
    sentMaxOutputTokens: number;
    finishReason: string;
    finishStatus: string;
    reasoningTokenCount?: number;
    promptTokenCount?: number;
    outputTokenCount?: number;
    totalTokenCount?: number;
    runId: string;
    attempts: Array<{
      attemptNumber: number;
      startedAt: string;
      completedAt: string;
      outcome: string;
      finishReason?: string;
      finishStatus?: string;
      statusCode?: number;
      message?: string;
    }>;
  };
}

export type ParseFailureClass =
  | 'transport_serialization'
  | 'incomplete_generation'
  | 'contract_misunderstanding'
  | 'linguistic_failure'
  | 'deterministic_engine_failure'
  | 'valid_but_unexpected';

export interface ParseFailure {
  class: ParseFailureClass;
  ruleId: string;
  stageIndex: number | null;
  fieldPath: string;
  offendingValue: unknown;
}

export interface RawOutputArtifact {
  mediaType: string;
  encoding: 'base64';
  byteLength: number;
  retainedByteLength: number;
  truncated: boolean;
  sha256: string;
  data: string;
}

export interface Provenance {
  modelRoute?: 'gemini' | 'gpt' | 'claude' | 'local';
  framework?: 'xbar' | 'minimalism';
  language?: string;
  timestamp?: string;
  treeSource?: 'derivationStages';
  promptVersion?: string;
  parserVersion?: string;
  uiVersion?: string;
  payloadIntegrityFlags?: string[];
  payloadTranscriberUsed?: boolean;
  payloadTranscriberModel?: string;
  payloadTranscriberPromptTokenCount?: number;
  payloadTranscriberOutputTokenCount?: number;
  payloadTranscriberTotalTokenCount?: number;
  hasDerivationStages?: boolean;
  parsePromptTokenCount?: number;
  parseOutputTokenCount?: number;
  parseTotalTokenCount?: number;
  primaryPromptTokenCount?: number;
  primaryOutputTokenCount?: number;
  primaryTotalTokenCount?: number;
}

export interface ParseResult {
  tree: SyntaxNode;
  surfaceOrder?: string[];
  derivationStages?: DerivationStage[];
  derivationSteps?: DerivationStep[];
  provenance?: Provenance;
}

export interface ParseBundle {
  analyses: ParseResult[];
  ambiguityDetected: boolean;
  ambiguityNote?: string;
  sentence?: string;
  requestedModelRoute?: 'gemini' | 'gpt' | 'claude';
  requestedReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  modelUsed?: string;
  generationRecord?: GenerationRecord;
}
