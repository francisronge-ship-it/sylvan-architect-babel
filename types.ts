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
  hasResolvedVisualRelations?: boolean;
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
  resolvedVisualRelations?: ResolvedVisualRelationRecord[];
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
}
