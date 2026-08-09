const asText = (value) => String(value || '').trim();

const asArray = (value) => (Array.isArray(value) ? value : []);

const cloneJson = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const nodeId = (node) => asText(node?.id || node?.refId);

const nodeLabel = (node) => asText(node?.label || node?.word);

const flattenAnchorNodeIds = (anchors = {}) => {
  const ids = [];
  Object.values(anchors || {}).forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const id = asText(item);
        if (id) ids.push(id);
      });
      return;
    }
    const id = asText(value);
    if (id) ids.push(id);
  });
  return Array.from(new Set(ids));
};

const collectWorkspaceNodeIds = (workspaceForest = []) => {
  const ids = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const id = asText(node.id);
    if (id) ids.add(id);
    asArray(node.children).forEach(visit);
  };
  asArray(workspaceForest).forEach(visit);
  return ids;
};

export const resolveRelationAnchors = (anchors = {}, workspaceForest = []) => {
  const workspaceNodeIds = collectWorkspaceNodeIds(workspaceForest);
  let authoredAnchorIndex = 0;
  return Object.entries(anchors).flatMap(([role, rawValue]) => {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    return values.flatMap((value) => {
      const nodeId = asText(value);
      const anchor = {
        role,
        nodeId,
        authoredAnchorIndex
      };
      authoredAnchorIndex += 1;
      return nodeId && workspaceNodeIds.has(nodeId) ? [anchor] : [];
    });
  });
};

const isPlainRecord = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeRelations = (value) => asArray(value)
  .map((relation) => {
    const label = asText(relation?.relation);
    const anchors = isPlainRecord(relation?.anchors) ? relation.anchors : {};
    if (!label) return null;
    return {
      relation: label,
      anchors: cloneJson(anchors),
      // Authored optional blocks travel verbatim through the plan.
      ...(isPlainRecord(relation?.priorAnchors)
        ? { priorAnchors: cloneJson(relation.priorAnchors) }
        : {}),
      ...(isPlainRecord(relation?.values)
        ? { values: cloneJson(relation.values) }
        : {})
    };
  })
  .filter(Boolean);

const normalizeStage = (stage, index) => {
  return {
    stageIndex: index,
    stageNumber: index + 1,
    stepId: `stage-${index + 1}`,
    statement: asText(stage?.statement),
    stageRecord: asText(stage?.stageRecord),
    relations: normalizeRelations(stage?.relations),
    workspaceForest: asArray(stage?.workspaceForest)
  };
};

const makeStep = (kind, stage, partial) => ({
  kind,
  stageIndex: stage.stageIndex,
  stageNumber: stage.stageNumber,
  stageId: stage.stepId,
  statement: stage.statement,
  ...partial
});

const buildNodeMicrosteps = (node, stage, path = []) => {
  if (!node || typeof node !== 'object') return [];

  const id = nodeId(node);
  const label = nodeLabel(node);
  const children = asArray(node.children);

  if (node.refId && !node.id) {
    return [
      makeStep('micro', stage, {
        operation: 'Preserve',
        label: `Preserve ${label}`,
        targetNodeId: id,
        targetLabel: label,
        nodePath: path
      })
    ];
  }

  if (children.length === 0) {
    return [
      makeStep('micro', stage, {
        operation: 'LexicalSelect',
        label: `Select ${label}`,
        targetNodeId: id,
        targetLabel: label,
        nodePath: path
      })
    ];
  }

  const childSteps = children.flatMap((child, childIndex) =>
    buildNodeMicrosteps(child, stage, [...path, id || label || String(childIndex)])
  );
  const childLabels = children.map(nodeLabel).filter(Boolean);
  const operation = children.length === 1 ? 'Project' : 'ExternalMerge';
  const labelText = operation === 'Project'
    ? `Project ${label}`
    : `Merge ${childLabels.join(' + ')} as ${label}`;
  return [
    ...childSteps,
    makeStep('micro', stage, {
      operation,
      label: labelText,
      targetNodeId: id,
      targetLabel: label,
      sourceNodeIds: children.map(nodeId).filter(Boolean),
      sourceLabels: childLabels,
      nodePath: path
    })
  ];
};

const buildStageMicrosteps = (stage) =>
  stage.workspaceForest.flatMap((root, rootIndex) => buildNodeMicrosteps(root, stage, [String(rootIndex)]));

const buildRelationSteps = (stage) => stage.relations.map((relation, authoredRelationIndex) => (
  makeStep('relation', stage, {
    operation: 'Relation',
    label: relation.relation,
    relation: relation.relation,
    anchors: cloneJson(relation.anchors),
    ...(relation.priorAnchors ? { priorAnchors: cloneJson(relation.priorAnchors) } : {}),
    ...(relation.values ? { values: cloneJson(relation.values) } : {}),
    authoredRelationIndex,
    resolvedAnchors: resolveRelationAnchors(
      relation.anchors,
      stage.workspaceForest
    ),
    stageRecord: stage.stageRecord
  })
));

const buildMacroStep = (stage) => makeStep('macro', stage, {
  operation: 'StageRecord',
  label: stage.statement || `Stage ${stage.stageNumber}`,
  stageRecord: stage.stageRecord,
  workspaceForest: cloneJson(stage.workspaceForest),
  relations: cloneJson(stage.relations)
});

const addStageProgress = (stages) => {
  stages.forEach((stage) => {
    const steps = stage.steps;
    steps.forEach((step, stepIndex) => {
      step.stageStepIndex = stepIndex;
      step.stageStepNumber = stepIndex + 1;
      step.stageStepCount = steps.length;
      step.progressLabel = `Stage ${stage.stageNumber}/${stages.length} \u00b7 Step ${stepIndex + 1}/${steps.length}`;
    });
  });
  return stages;
};

export const buildDerivationReplayPlan = (input = {}) => {
  const rawStages = asArray(input.derivationStages);
  const stages = rawStages.map(normalizeStage).map((stage) => {
    const microsteps = buildStageMicrosteps(stage);
    const relationSteps = buildRelationSteps(stage);
    const macroStep = buildMacroStep(stage);
    return {
      ...stage,
      microsteps,
      relationSteps,
      macroStep,
      steps: [...microsteps, ...relationSteps, macroStep]
    };
  });

  addStageProgress(stages);

  return {
    stages,
    steps: stages.flatMap((stage) => stage.steps)
  };
};

export const __test__ = {
  buildNodeMicrosteps,
  buildRelationSteps,
  collectWorkspaceNodeIds,
  flattenAnchorNodeIds,
  resolveRelationAnchors,
  normalizeStage
};
