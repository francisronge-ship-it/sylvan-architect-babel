const normalizeText = (value) => String(value || '').replace(/\r/g, '').trim();

const collectStageRecords = (analysis) => (
  Array.isArray(analysis?.derivationStages)
    ? analysis.derivationStages
      .map((stage) => normalizeText(stage?.stageRecord))
      .filter(Boolean)
    : []
);

const collectResolvedVisualRelations = (analysis) => (
  Array.isArray(analysis?.resolvedVisualRelations)
    ? analysis.resolvedVisualRelations.filter((relation) => relation && typeof relation === 'object')
    : []
);

const movementRelationPattern =
  /move|movement|raise|raising|lower|lowering|front|displac|extract|copy|trace|gap|chain|dependency|wh|a-?bar|clitic|affix|scrambl|rollup|sideward|head/i;

const collectMovementRelations = (analysis) => (
  collectResolvedVisualRelations(analysis).filter((relation) => (
    normalizeText(relation?.renderFamily).toLowerCase() === 'trajectory'
    || movementRelationPattern.test(normalizeText(relation?.relation))
  ))
);

const countUnresolvedAnchors = (relations) => (
  (Array.isArray(relations) ? relations : []).reduce((count, relation) => (
    count + (Array.isArray(relation?.anchors)
      ? relation.anchors.filter((anchor) => anchor?.resolved === false).length
      : 0)
  ), 0)
);

module.exports = {
  collectMovementRelations,
  collectResolvedVisualRelations,
  collectStageRecords,
  countUnresolvedAnchors,
  normalizeText
};
