import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertTextChoice,
  assertUniqueTextArray
} from './benchmarkValidation.js';

export const REPORT_TABLE_NAMES = Object.freeze([
  'Release',
  'Model',
  'Condition',
  'ItemVersion',
  'Run',
  'Judgment',
  'Score',
  'Correction'
]);

const PLAN_FIELDS = Object.freeze([
  'reportDatasetId',
  'schemaIdentity',
  'rawDerivedIdentity',
  'publicationIdentity',
  'tableSources',
  'provenance'
]);

const TABLE_SOURCE_FIELDS = Object.freeze([
  'sourceRef',
  'sourceSha256'
]);

const TABLE_FIELDS = Object.freeze({
  Release: Object.freeze([
    'id',
    'suiteVer',
    'contractHashes',
    'engineVer',
    'window',
    'policyVer'
  ]),
  Model: Object.freeze([
    'registryId',
    'name',
    'lab',
    'manifestRef'
  ]),
  Condition: Object.freeze([
    'id',
    'releaseId',
    'modelId',
    'resolvedVersion',
    'aliasWindow',
    'host',
    'tier',
    'framework',
    'sentParams',
    'carrier'
  ]),
  ItemVersion: Object.freeze([
    'itemVersionId',
    'itemId',
    'vN',
    'contentAxes',
    'flags',
    'statusHistory',
    'dispositions'
  ]),
  Run: Object.freeze([
    'id',
    'conditionId',
    'itemVersionId',
    'outcomeClass',
    'subCause',
    'partition',
    'finishReason',
    'tokens',
    'latencyMs',
    'costUSD',
    'rawHash',
    'bundleRef'
  ]),
  Judgment: Object.freeze([
    'runId',
    'reviewerId',
    'dimension',
    'value',
    'rubricVer',
    'adjudicated',
    'blindingRecord'
  ]),
  Score: Object.freeze([
    'estimandId',
    'conditionScope',
    'value',
    'ciLow',
    'ciHigh',
    'method',
    'clusterSpec',
    'multiplicityFamily'
  ]),
  Correction: Object.freeze([
    'itemId',
    'fromV',
    'toV',
    'reason',
    'taxonomyClass',
    'affectedScores'
  ])
});

const EXPECTED_IDENTITIES = Object.freeze({
  schemaIdentity: 'bm12-eight-table-star-schema',
  rawDerivedIdentity: 'raw-facts-and-externally-derived-scores-remain-distinct',
  publicationIdentity: 'dataset-generation-is-not-publication-authorization'
});

const RUN_PARTITIONS = Object.freeze(['native', 'recovered', 'variant']);
const TOKEN_FIELDS = Object.freeze([
  'inUncached',
  'inCached',
  'out',
  'reasoning'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const assertNullableText = (value, path) => {
  if (value !== null) assertNonemptyText(value, path);
};

const assertPositiveInteger = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${path} must be a positive safe integer.`);
  }
};

const assertNonnegativeInteger = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer.`);
  }
};

const assertFiniteNumber = (value, path, { nonnegative = false } = {}) => {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || (nonnegative && value < 0)
  ) {
    throw new TypeError(
      `${path} must be a ${nonnegative ? 'non-negative ' : ''}finite number.`
    );
  }
};

const assertJsonArray = (value, path) => {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array.`);
  }
};

const assertUniqueValues = (values, path) => {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${path} must be unique.`);
  }
};

const itemVersionCoordinate = (itemId, vN) => JSON.stringify([itemId, vN]);

export const hashReportStarSchemaData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'report-star-schema hash input'))
);

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'report-star-schema plan');
  assertExactFields(plan, PLAN_FIELDS, 'report-star-schema plan');
  assertNonemptyText(
    plan.reportDatasetId,
    'report-star-schema plan.reportDatasetId'
  );
  Object.entries(EXPECTED_IDENTITIES).forEach(([field, expected]) => {
    if (plan[field] !== expected) {
      throw new TypeError(
        `report-star-schema plan.${field} must be ${expected}.`
      );
    }
  });
  assertExactFields(
    plan.tableSources,
    REPORT_TABLE_NAMES,
    'report-star-schema plan.tableSources'
  );
  for (const tableName of REPORT_TABLE_NAMES) {
    const path = `report-star-schema plan.tableSources.${tableName}`;
    const source = plan.tableSources[tableName];
    assertExactFields(source, TABLE_SOURCE_FIELDS, path);
    assertNonemptyText(source.sourceRef, `${path}.sourceRef`);
    assertSha256(source.sourceSha256, `${path}.sourceSha256`);
  }
  assertJsonRecord(plan.provenance, 'report-star-schema plan.provenance');
  return plan;
};

const normalizeRows = (rawTables, tableName, validateRow) => {
  const rawRows = rawTables[tableName];
  if (!Array.isArray(rawRows)) {
    throw new TypeError(`report-star-schema tables.${tableName} must be an array.`);
  }
  return rawRows.map((rawRow, index) => {
    const path = `report-star-schema tables.${tableName}[${index}]`;
    const row = copyJsonData(rawRow, path);
    assertExactFields(row, TABLE_FIELDS[tableName], path);
    validateRow(row, path);
    return row;
  });
};

const validateRelease = (row, path) => {
  for (const field of ['id', 'suiteVer', 'engineVer', 'window', 'policyVer']) {
    assertNonemptyText(row[field], `${path}.${field}`);
  }
  assertJsonRecord(row.contractHashes, `${path}.contractHashes`);
  if (Object.keys(row.contractHashes).length === 0) {
    throw new TypeError(`${path}.contractHashes must not be empty.`);
  }
  for (const [contractId, contractHash] of Object.entries(row.contractHashes)) {
    assertNonemptyText(contractId, `${path}.contractHashes key`);
    assertSha256(contractHash, `${path}.contractHashes.${contractId}`);
  }
};

const validateModel = (row, path) => {
  for (const field of ['registryId', 'name', 'lab', 'manifestRef']) {
    assertNonemptyText(row[field], `${path}.${field}`);
  }
};

const validateCondition = (row, path) => {
  for (const field of [
    'id',
    'releaseId',
    'modelId',
    'host',
    'tier',
    'framework',
    'carrier'
  ]) {
    assertNonemptyText(row[field], `${path}.${field}`);
  }
  assertNullableText(row.resolvedVersion, `${path}.resolvedVersion`);
  assertNullableText(row.aliasWindow, `${path}.aliasWindow`);
  if ((row.resolvedVersion === null) === (row.aliasWindow === null)) {
    throw new TypeError(
      `${path} must declare exactly one of resolvedVersion or aliasWindow.`
    );
  }
  assertJsonRecord(row.sentParams, `${path}.sentParams`);
};

const validateItemVersion = (row, path) => {
  assertNonemptyText(row.itemVersionId, `${path}.itemVersionId`);
  assertNonemptyText(row.itemId, `${path}.itemId`);
  assertPositiveInteger(row.vN, `${path}.vN`);
  assertJsonRecord(row.contentAxes, `${path}.contentAxes`);
  assertJsonArray(row.flags, `${path}.flags`);
  assertJsonArray(row.statusHistory, `${path}.statusHistory`);
  assertJsonArray(row.dispositions, `${path}.dispositions`);
};

const validateRun = (row, path) => {
  for (const field of [
    'id',
    'conditionId',
    'itemVersionId',
    'outcomeClass',
    'bundleRef'
  ]) {
    assertNonemptyText(row[field], `${path}.${field}`);
  }
  assertNullableText(row.subCause, `${path}.subCause`);
  assertNullableText(row.finishReason, `${path}.finishReason`);
  assertTextChoice(row.partition, RUN_PARTITIONS, `${path}.partition`);
  assertExactFields(row.tokens, TOKEN_FIELDS, `${path}.tokens`);
  for (const tokenField of TOKEN_FIELDS) {
    assertNonnegativeInteger(row.tokens[tokenField], `${path}.tokens.${tokenField}`);
  }
  assertFiniteNumber(row.latencyMs, `${path}.latencyMs`, { nonnegative: true });
  assertFiniteNumber(row.costUSD, `${path}.costUSD`, { nonnegative: true });
  assertSha256(row.rawHash, `${path}.rawHash`);
};

const validateJudgment = (row, path) => {
  for (const field of [
    'runId',
    'reviewerId',
    'dimension',
    'rubricVer'
  ]) {
    assertNonemptyText(row[field], `${path}.${field}`);
  }
  if (typeof row.adjudicated !== 'boolean') {
    throw new TypeError(`${path}.adjudicated must be a boolean.`);
  }
  assertJsonRecord(row.blindingRecord, `${path}.blindingRecord`);
};

const validateScore = (row, path) => {
  assertNonemptyText(row.estimandId, `${path}.estimandId`);
  assertUniqueTextArray(
    row.conditionScope,
    `${path}.conditionScope`
  );
  for (const field of ['value', 'ciLow', 'ciHigh']) {
    assertFiniteNumber(row[field], `${path}.${field}`);
  }
  if (row.ciLow > row.value || row.value > row.ciHigh) {
    throw new TypeError(`${path} must satisfy ciLow <= value <= ciHigh.`);
  }
  assertNonemptyText(row.method, `${path}.method`);
  assertJsonRecord(row.clusterSpec, `${path}.clusterSpec`);
  assertNullableText(row.multiplicityFamily, `${path}.multiplicityFamily`);
};

const validateCorrection = (row, path) => {
  assertNonemptyText(row.itemId, `${path}.itemId`);
  assertPositiveInteger(row.fromV, `${path}.fromV`);
  assertPositiveInteger(row.toV, `${path}.toV`);
  if (row.toV <= row.fromV) {
    throw new TypeError(`${path}.toV must be greater than fromV.`);
  }
  assertNonemptyText(row.reason, `${path}.reason`);
  assertNonemptyText(row.taxonomyClass, `${path}.taxonomyClass`);
  assertUniqueTextArray(
    row.affectedScores,
    `${path}.affectedScores`,
    { allowEmpty: true }
  );
};

const ROW_VALIDATORS = Object.freeze({
  Release: validateRelease,
  Model: validateModel,
  Condition: validateCondition,
  ItemVersion: validateItemVersion,
  Run: validateRun,
  Judgment: validateJudgment,
  Score: validateScore,
  Correction: validateCorrection
});

const assertPrimaryKeys = (tables) => {
  const keys = {
    Release: tables.Release.map(({ id }) => id),
    Model: tables.Model.map(({ registryId }) => registryId),
    Condition: tables.Condition.map(({ id }) => id),
    ItemVersion: tables.ItemVersion.map(({ itemVersionId }) => itemVersionId),
    Run: tables.Run.map(({ id }) => id),
    Judgment: tables.Judgment.map((row) => JSON.stringify([
      row.runId,
      row.reviewerId,
      row.dimension
    ])),
    Score: tables.Score.map(({ estimandId }) => estimandId),
    Correction: tables.Correction.map((row) => JSON.stringify([
      row.itemId,
      row.fromV,
      row.toV
    ]))
  };
  for (const tableName of REPORT_TABLE_NAMES) {
    assertUniqueValues(keys[tableName], `report-star-schema ${tableName} keys`);
  }
  assertUniqueValues(
    tables.ItemVersion.map(({ itemId, vN }) => (
      itemVersionCoordinate(itemId, vN)
    )),
    'report-star-schema ItemVersion itemId/vN coordinates'
  );
  assertUniqueValues(
    tables.Model.map(({ manifestRef }) => manifestRef),
    'report-star-schema Model manifestRef values'
  );
  assertUniqueValues(
    tables.Run.map(({ bundleRef }) => bundleRef),
    'report-star-schema Run bundleRef values'
  );
  const semanticKeys = {
    Model: tables.Model.map(({ registryId: _registryId, ...definition }) => (
      sha256CanonicalJson(definition)
    )),
    Condition: tables.Condition.map(({ id: _id, ...definition }) => (
      sha256CanonicalJson(definition)
    )),
    Run: tables.Run.map(({ id: _id, ...definition }) => (
      sha256CanonicalJson(definition)
    )),
    Score: tables.Score.map(({ estimandId: _estimandId, ...definition }) => (
      sha256CanonicalJson(definition)
    ))
  };
  for (const [tableName, definitions] of Object.entries(semanticKeys)) {
    assertUniqueValues(
      definitions,
      `report-star-schema ${tableName} substantive definitions`
    );
  }
};

const assertForeignKeys = (tables) => {
  const releaseIds = new Set(tables.Release.map(({ id }) => id));
  const modelIds = new Set(tables.Model.map(({ registryId }) => registryId));
  const conditionIds = new Set(tables.Condition.map(({ id }) => id));
  const itemVersionIds = new Set(
    tables.ItemVersion.map(({ itemVersionId }) => itemVersionId)
  );
  const runIds = new Set(tables.Run.map(({ id }) => id));
  const scoreIds = new Set(tables.Score.map(({ estimandId }) => estimandId));
  const itemCoordinates = new Set(
    tables.ItemVersion.map(({ itemId, vN }) => (
      itemVersionCoordinate(itemId, vN)
    ))
  );

  for (const condition of tables.Condition) {
    if (!releaseIds.has(condition.releaseId)) {
      throw new TypeError(
        `Condition ${condition.id} must reference the report Release.`
      );
    }
    if (!modelIds.has(condition.modelId)) {
      throw new TypeError(
        `Condition ${condition.id} must reference a declared Model.`
      );
    }
  }
  for (const run of tables.Run) {
    if (!conditionIds.has(run.conditionId)) {
      throw new TypeError(`Run ${run.id} must reference a declared Condition.`);
    }
    if (!itemVersionIds.has(run.itemVersionId)) {
      throw new TypeError(`Run ${run.id} must reference a declared ItemVersion.`);
    }
  }
  for (const judgment of tables.Judgment) {
    if (!runIds.has(judgment.runId)) {
      throw new TypeError(
        `Judgment for ${judgment.runId} must reference a declared Run.`
      );
    }
  }
  for (const score of tables.Score) {
    for (const conditionId of score.conditionScope) {
      if (!conditionIds.has(conditionId)) {
        throw new TypeError(
          `Score ${score.estimandId} must reference declared Conditions.`
        );
      }
    }
  }
  for (const correction of tables.Correction) {
    for (const vN of [correction.fromV, correction.toV]) {
      if (!itemCoordinates.has(itemVersionCoordinate(correction.itemId, vN))) {
        throw new TypeError(
          `Correction ${correction.itemId} ${correction.fromV}->${correction.toV}`
          + ' must reference both declared ItemVersion coordinates.'
        );
      }
    }
    for (const estimandId of correction.affectedScores) {
      if (!scoreIds.has(estimandId)) {
        throw new TypeError(
          `Correction ${correction.itemId} must reference declared Scores.`
        );
      }
    }
  }
};

export const createReportStarSchemaReceipt = ({
  plan: rawPlan,
  tables: rawTables
}) => {
  const plan = normalizePlan(rawPlan);
  assertExactFields(
    rawTables,
    REPORT_TABLE_NAMES,
    'report-star-schema tables'
  );
  const tables = Object.fromEntries(REPORT_TABLE_NAMES.map((tableName) => [
    tableName,
    normalizeRows(rawTables, tableName, ROW_VALIDATORS[tableName])
  ]));
  if (tables.Release.length !== 1) {
    throw new TypeError(
      'report-star-schema tables.Release must contain exactly one release.'
    );
  }
  for (const tableName of REPORT_TABLE_NAMES) {
    const actualSha256 = hashReportStarSchemaData(tables[tableName]);
    if (actualSha256 !== plan.tableSources[tableName].sourceSha256) {
      throw new TypeError(
        `report-star-schema tables.${tableName} does not match its source SHA-256.`
      );
    }
  }
  assertPrimaryKeys(tables);
  assertForeignKeys(tables);

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W13f-a-star-schema-report-generator',
    reportDatasetId: plan.reportDatasetId,
    schemaIdentity: plan.schemaIdentity,
    rawDerivedIdentity: plan.rawDerivedIdentity,
    publicationIdentity: plan.publicationIdentity,
    releaseId: tables.Release[0].id,
    tableSources: plan.tableSources,
    rowCounts: Object.fromEntries(REPORT_TABLE_NAMES.map((tableName) => [
      tableName,
      tables[tableName].length
    ])),
    tableSha256: Object.fromEntries(REPORT_TABLE_NAMES.map((tableName) => [
      tableName,
      hashReportStarSchemaData(tables[tableName])
    ])),
    reportTreatment:
      'validated-star-schema-data-no-score-computation-or-publication-authorization',
    tables,
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
