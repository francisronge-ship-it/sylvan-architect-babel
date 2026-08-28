const LEGACY_CASE_METADATA_FIELDS = [
  'case',
  'assigner',
  'caseEvidence',
  'caseOvert'
];

const stripLegacyCaseMetadataFromNode = (node) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  LEGACY_CASE_METADATA_FIELDS.forEach((field) => {
    delete node[field];
  });
  (Array.isArray(node.children) ? node.children : [])
    .forEach(stripLegacyCaseMetadataFromNode);
};

export const stripLegacyCaseMetadataFromSyntaxForest = (forest) => {
  (Array.isArray(forest) ? forest : []).forEach(stripLegacyCaseMetadataFromNode);
  return forest;
};

export const stripLegacyCaseMetadataFromParseBundle = (bundle) => {
  (Array.isArray(bundle?.analyses) ? bundle.analyses : []).forEach((analysis) => {
    stripLegacyCaseMetadataFromNode(analysis?.tree);
    (Array.isArray(analysis?.derivationStages) ? analysis.derivationStages : [])
      .forEach((stage) => (
        stripLegacyCaseMetadataFromSyntaxForest(stage?.workspaceForest)
      ));
  });
  return bundle;
};
