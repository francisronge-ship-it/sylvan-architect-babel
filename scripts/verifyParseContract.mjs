import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_INPUTS = fs.globSync('fixtures/normalized/*.json').sort();

const readJson = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const asText = (value) => String(value || '').trim();

const normalizeAnchorValues = (value) => {
  if (Array.isArray(value)) return value.flatMap(normalizeAnchorValues);
  if (typeof value !== 'string') return [];
  const text = asText(value);
  return text ? [text] : [];
};

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const isAnchorValue = (value) => (
  typeof value === 'string'
    ? Boolean(value.trim())
    : Array.isArray(value)
      && value.length > 0
      && value.every((item) => typeof item === 'string' && item.trim())
);

const isAnchorBlock = (value) => (
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.entries(value).length > 0
  && Object.entries(value).every(([role, anchorValue]) => role.trim() && isAnchorValue(anchorValue))
);

const isValuesBlock = (value) => (
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.entries(value).length > 0
  && Object.entries(value).every(([key, literal]) => (
    key.trim()
    && (
      typeof literal === 'string'
      || (
        Array.isArray(literal)
        && literal.length > 0
        && literal.every((item) => typeof item === 'string')
      )
    )
  ))
);

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

const relationAnchorEntries = (relation, field = 'anchors') => {
  const anchors = relation?.[field] && typeof relation[field] === 'object' && !Array.isArray(relation[field])
    ? relation[field]
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
      const stageFields = Object.keys(stage || {});
      const requiredStageFields = ['statement', 'stageRecord', 'relations', 'workspaceForest'];
      if (
        stageFields.length !== requiredStageFields.length
        || requiredStageFields.some((field) => !Object.prototype.hasOwnProperty.call(stage || {}, field))
      ) {
        errors.push(`${stageLabel}: must contain exactly statement, stageRecord, relations, and workspaceForest`);
      }
      if (!asText(stage.statement)) errors.push(`${stageLabel}: missing statement`);
      if (!asText(stage.stageRecord)) errors.push(`${stageLabel}: missing stageRecord`);
      if (asArray(stage.workspaceForest).length === 0) errors.push(`${stageLabel}: missing workspaceForest`);

      asArray(stage.relations).forEach((relation, relationIndex) => {
        const relationNumber = relationIndex + 1;
        const relationPath = `${stageLabel} relation ${relationNumber}`;
        if (!relation || typeof relation !== 'object' || Array.isArray(relation)) {
          errors.push(`${relationPath}: must be an object`);
          return;
        }
        const relationFields = Object.keys(relation || {});
        const allowedRelationFields = ['relation', 'anchors', 'priorAnchors', 'values'];
        if (
          relationFields.some((field) => !allowedRelationFields.includes(field))
          || !hasOwn(relation, 'relation')
          || !hasOwn(relation, 'anchors')
        ) {
          errors.push(`${relationPath}: must contain relation and anchors, with only optional priorAnchors and values`);
        }
        const relationLabel = asText(relation.relation)
          || `relation ${relationNumber}`;
        if (!asText(relation.relation)) {
          errors.push(`${relationPath}: relation name must be a non-empty string`);
        }
        if (!isAnchorBlock(relation.anchors)) {
          errors.push(`${stageLabel} ${relationLabel}: anchors must be a non-empty string or string-array map`);
          return;
        }
        if (hasOwn(relation, 'priorAnchors') && !isAnchorBlock(relation.priorAnchors)) {
          errors.push(`${stageLabel} ${relationLabel}: priorAnchors must be a non-empty string or string-array map`);
        }
        if (hasOwn(relation, 'values') && !isValuesBlock(relation.values)) {
          errors.push(`${stageLabel} ${relationLabel}: values must be a non-empty string or string-array map`);
        }
        const anchors = relationAnchorEntries(relation);

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

        if (hasOwn(relation, 'priorAnchors') && isAnchorBlock(relation.priorAnchors)) {
          relationAnchorEntries(relation, 'priorAnchors').forEach(({ role, nodeId }) => {
            if (stageIndex > 0 && indexes[stageIndex - 1].byId.has(nodeId)) return;
            errors.push(
              `${stageLabel} ${relationLabel}: ${role} priorAnchor "${nodeId}" must resolve in the immediately preceding stage`
            );
          });
        }
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
