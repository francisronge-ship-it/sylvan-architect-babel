export type VisualRelationRenderFamily = string & {};

export type VisualRelationTrajectoryKind = 'head' | 'phrasal';

export interface ResolvedVisualRelationAnchor {
  role: string;
  nodeId?: string;
  value?: string;
}

export interface ResolvedVisualRelation {
  relationIndex?: string;
  relation?: string;
  anchors?: ResolvedVisualRelationAnchor[];
  sourceNodeId?: string;
  targetNodeId?: string;
  witnessNodeId?: string;
  sourcePhraseId?: string;
  stepIndex?: number;
  operation?: string;
  renderFamily?: VisualRelationRenderFamily;
  trajectoryKind?: VisualRelationTrajectoryKind;
  movedSurface?: string;
  chainId?: string;
  note?: string;
}
