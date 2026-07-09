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
  case?: string;
  assigner?: string;
  caseEvidence?: string;
  caseOvert?: boolean;
}

export type OpenOntologyLabel = string & {};

export type KnownDerivationOperation =
  | 'LexicalSelect'
  | 'ExternalMerge'
  | 'InternalMerge'
  | 'HeadMove'
  | 'A-Move'
  | 'AbarMove'
  | 'Project'
  | 'Label'
  | 'Move'
  | 'Agree'
  | 'SpellOutDomain'
  | 'SpellOut'
  | 'Other';

export type DerivationOperation = KnownDerivationOperation | OpenOntologyLabel;

export interface ReplayLedgerBlock {
  title: string;
  lines: string[];
}

export interface FeatureCheckEvent {
  feature: string;
  value?: string;
  status?: 'checked' | 'valued' | 'licensed' | 'deleted' | 'failed' | 'other';
  probeNodeId?: string;
  goalNodeId?: string;
  probeLabel?: string;
  goalLabel?: string;
  note?: string;
}

export interface DerivationFrameAnchor {
  role?: string;
  nodeId?: string;
  lineageId?: string;
  value?: string;
  text?: string;
  [key: string]: unknown;
}

export interface DerivationFrameChange {
  statement?: string;
  anchors?: DerivationFrameAnchor[];
  continuityIds?: string[];
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DerivationFrameAfterState {
  workspaceForest?: SyntaxNode[];
}

export interface DerivationStep {
  stepId?: string;
  operation: DerivationOperation;
  microOperations?: DerivationOperation[];
  affectedNodeIds?: string[];
  trigger?: string;
  chainId?: string;
  spelloutDomain?: string;
  preFeatures?: string[];
  postFeatures?: string[];
  thetaRole?: string;
  introducerHead?: string;
  phase?: string;
  labelDecision?: string;
  linearizationEffect?: string;
  morphologyEffect?: string;
  targetLabel?: string;
  targetNodeId?: string;
  sourceNodeIds?: string[];
  sourceLabels?: string[];
  recipe?: string;
  workspaceBefore?: string[];
  workspaceAfter?: string[];
  spelloutOrder?: string[];
  featureChecking?: FeatureCheckEvent[];
  ledgerBlocks?: ReplayLedgerBlock[];
  note?: string;
}

export interface DerivationFrame {
  frameId?: string;
  stepId?: string;
  after: DerivationFrameAfterState;
  change: DerivationFrameChange;
  note?: string;
}

export interface DerivationStage {
  statement: string;
  stageRecord: string;
  visualRelations: DerivationStageVisualRelation[];
  workspaceForest: SyntaxNode[];
}

export interface DerivationStageVisualRelation {
  relation: OpenOntologyLabel;
  anchors: Record<string, string | string[]>;
}

export type VisualRelationRenderFamily =
  | 'trajectory'
  | 'unknown'
  | OpenOntologyLabel;

export interface ResolvedVisualRelationAnchor {
  role: string;
  nodeId?: string;
  value?: string;
  label?: string;
  resolved: boolean;
  visibleInStage: boolean;
}

export interface ResolvedVisualRelationRecord {
  relationId: string;
  stageId?: string;
  stageIndex: number;
  relation: OpenOntologyLabel;
  anchors: ResolvedVisualRelationAnchor[];
  sourceNodeId?: string;
  targetNodeId?: string;
  witnessNodeId?: string;
  renderFamily: VisualRelationRenderFamily;
  renderable: boolean;
  renderStatus: OpenOntologyLabel;
  evidence?: string;
}

export interface NoteBinding {
  noteId?: string;
  kind: 'architecture' | 'chain' | 'licensing' | 'closure' | 'other';
  text: string;
  chainId?: string;
  stepIds?: string[];
  nodeIds?: string[];
  supportIds?: string[];
  commitmentFactIds?: string[];
  order?: number;
}

export interface DerivationChain {
  chainId: string;
  type?: OpenOntologyLabel;
  family?: 'A' | 'A-bar' | 'head' | 'other';
  copies?: string[];
  pronouncedCopy?: string;
  silentCopies?: string[];
  features?: string[];
  note?: string;
}

export interface CommitmentFactParticipant {
  role?: string;
  nodeId?: string;
  label?: string;
  value?: string;
}

export interface CommitmentFact {
  factId?: string;
  kind: OpenOntologyLabel;
  family?: OpenOntologyLabel;
  frameworkLabel?: string;
  subtype?: string;
  statement?: string;
  participants?: CommitmentFactParticipant[];
  chainId?: string;
  stepIds?: string[];
  nodeIds?: string[];
  [key: string]: unknown;
}

export interface Provenance {
  modelRoute?: 'gemini' | 'gpt' | 'claude' | 'local';
  framework?: 'xbar' | 'minimalism';
  language?: string;
  timestamp?: string;
  treeSource?: 'derivationStages' | 'committedTree';
  promptVersion?: string;
  parserVersion?: string;
  uiVersion?: string;
  payloadIntegrityFlags?: string[];
  payloadTranscriberUsed?: boolean;
  payloadTranscriberModel?: string;
  payloadTranscriberPromptTokenCount?: number;
  payloadTranscriberOutputTokenCount?: number;
  payloadTranscriberTotalTokenCount?: number;
  payloadTranscriberThoughtsTokenCount?: number;
  hasCommitmentFacts?: boolean;
  hasDerivationStages?: boolean;
  hasResolvedVisualRelations?: boolean;
  parsePromptTokenCount?: number;
  parseOutputTokenCount?: number;
  parseTotalTokenCount?: number;
  primaryPromptTokenCount?: number;
  primaryOutputTokenCount?: number;
  primaryTotalTokenCount?: number;
  providerReasoningRaw?: string;
  providerReasoningSummary?: string;
  providerThoughtsTokenCount?: number;
  notesSource?: string;
  notesCompiledFromDerivationStages?: boolean;
}

export interface ParseResult {
  // There is no `notes` field on committed analyses.
  // Structured notes live in noteBindings, and explanation is the rendered paragraph built from them.
  tree: SyntaxNode;
  explanation: string;
  surfaceOrder?: string[];
  derivationStages?: DerivationStage[];
  resolvedVisualRelations?: ResolvedVisualRelationRecord[];
  noteBindings?: NoteBinding[];
  derivationSteps?: DerivationStep[];
  chains?: DerivationChain[];
  // Compiler-owned open facts derived from derivationStages; never model-authored input.
  commitmentFacts?: CommitmentFact[];
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
}
