import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_INPUTS = [
  '.local-tests/fresh-claude-parse-2026-05-18/response.json'
];

const readJson = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const asText = (value) => String(value || '').trim();

const normalizeAnchorValues = (value) => {
  if (Array.isArray(value)) return value.flatMap(normalizeAnchorValues);
  if (value && typeof value === 'object') {
    const nodeId = asText(value.nodeId || value.id || value.refId || value.value || value.text);
    return nodeId ? [nodeId] : [];
  }
  const text = asText(value);
  return text ? [text] : [];
};

const collectNodes = (forest = []) => {
  const byId = new Map();
  const byLineage = new Map();

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const id = asText(node.id || node.refId);
    if (id) byId.set(id, node);

    const lineageId = asText(
      node.lineageId
      || node.lineage
      || node.copyLineageId
      || node.movementLineageId
      || (node.identity && typeof node.identity === 'object' ? node.identity.lineageId || node.identity.lineage : '')
    );
    if (lineageId && id) {
      const bucket = byLineage.get(lineageId) || [];
      bucket.push({ id, node });
      byLineage.set(lineageId, bucket);
    }

    asArray(node.children).forEach(visit);
  };

  asArray(forest).forEach(visit);
  return { byId, byLineage };
};

const unwrapBundle = (payload) => {
  if (Array.isArray(payload?.analyses)) return payload;
  if (Array.isArray(payload?.response?.analyses)) return payload.response;
  if (Array.isArray(payload?.bundle?.analyses)) return payload.bundle;
  return payload;
};

const relationAnchorEntries = (relation) => {
  const anchors = relation?.anchors && typeof relation.anchors === 'object' && !Array.isArray(relation.anchors)
    ? relation.anchors
    : {};
  return Object.entries(anchors)
    .flatMap(([role, value]) => normalizeAnchorValues(value).map((nodeId) => ({ role, nodeId })));
};

const validateFile = (filePath) => {
  const payload = unwrapBundle(readJson(filePath));
  const analyses = asArray(payload.analyses);
  const errors = [];
  const warnings = [];

  if (analyses.length === 0) {
    errors.push('no analyses array found');
    return { filePath, errors, warnings };
  }

  analyses.forEach((analysis, analysisIndex) => {
    const prefix = `analysis ${analysisIndex + 1}`;
    const stages = asArray(analysis.derivationStages);
    if (stages.length < 4) {
      warnings.push(`${prefix}: only ${stages.length} derivationStages`);
    }

    const indexes = stages.map((stage) => collectNodes(stage.workspaceForest));

    stages.forEach((stage, stageIndex) => {
      const stageLabel = `${prefix} stage ${stageIndex + 1}`;
      if (!asText(stage.statement)) errors.push(`${stageLabel}: missing statement`);
      if (!asText(stage.stageRecord)) errors.push(`${stageLabel}: missing stageRecord`);
      if (asArray(stage.workspaceForest).length === 0) errors.push(`${stageLabel}: missing workspaceForest`);

      asArray(stage.visualRelations).forEach((relation, relationIndex) => {
        const relationLabel = asText(relation.relation || relation.kind || relation.type || relation.label)
          || `visualRelation ${relationIndex + 1}`;
        const anchors = relationAnchorEntries(relation);
        if (anchors.length === 0) {
          errors.push(`${stageLabel} ${relationLabel}: missing anchors`);
          return;
        }

        anchors.forEach(({ role, nodeId }) => {
          const currentIndex = indexes[stageIndex];
          if (currentIndex.byId.has(nodeId)) return;

          const previousStageIndex = indexes
            .slice(0, stageIndex)
            .findLastIndex((index) => index.byId.has(nodeId));
          if (previousStageIndex >= 0) {
            const previousNode = indexes[previousStageIndex].byId.get(nodeId);
            const lineageId = asText(previousNode?.lineageId || previousNode?.lineage || previousNode?.copyLineageId || previousNode?.movementLineageId);
            const currentLineageNodes = lineageId
              ? asArray(currentIndex.byLineage.get(lineageId)).map((entry) => entry.id).join(', ')
              : '';
            errors.push(
              `${stageLabel} ${relationLabel}: ${role} anchor "${nodeId}" exists only in stage ${previousStageIndex + 1}`
              + (currentLineageNodes ? `; current ${lineageId} lineage nodes: ${currentLineageNodes}` : '')
            );
            return;
          }

          errors.push(`${stageLabel} ${relationLabel}: ${role} anchor "${nodeId}" does not resolve in current or previous stages`);
        });
      });
    });
  });

  return { filePath, errors, warnings };
};

const inputs = process.argv.slice(2);
const files = inputs.length > 0 ? inputs : DEFAULT_INPUTS;
const results = files.map((file) => validateFile(path.resolve(file)));

let hasErrors = false;
for (const result of results) {
  console.log(`\n${result.filePath}`);
  if (result.warnings.length > 0) {
    result.warnings.forEach((warning) => console.log(`  warning: ${warning}`));
  }
  if (result.errors.length === 0) {
    console.log('  Parse contract verification passed.');
  } else {
    hasErrors = true;
    result.errors.forEach((error) => console.log(`  error: ${error}`));
  }
}

if (hasErrors) {
  process.exitCode = 1;
}
