import {
  cloneFrozenJson,
  failPlanningConfig,
  requireExactFields,
  requireFiniteNumber,
  requireNonnegativeInteger,
  requireSafeId
} from './planningData.mjs';

const ROOT_FIELDS = Object.freeze(['schemaVersion', 'cells', 'human']);
const CELL_FIELDS = Object.freeze(['id', 'runs', 'tokensPerRun', 'pricesPerToken']);
const TOKEN_FIELDS = Object.freeze(['inputUncached', 'inputCached', 'output', 'reasoning']);
const HUMAN_FIELDS = Object.freeze([
  'judgedRuns',
  'minutesPerJudgment',
  'doubleRatingShare',
  'disagreementRate',
  'minutesPerAdjudication',
  'calibrationHours',
  'auditHours'
]);

const validateMeasures = (value, fields, path) => {
  requireExactFields(value, fields, path);
  fields.forEach((field) => requireFiniteNumber(value[field], `${path}.${field}`, {
    minimum: 0
  }));
};

export const estimateProbeCost = (input) => {
  requireExactFields(input, ROOT_FIELDS, '$');
  if (input.schemaVersion !== 1) failPlanningConfig('$.schemaVersion must be 1.');
  if (!Array.isArray(input.cells) || input.cells.length === 0) {
    failPlanningConfig('$.cells must contain externally supplied condition cells.');
  }
  const cellIds = new Set();
  const cells = input.cells.map((cell, index) => {
    const path = `$.cells[${index}]`;
    requireExactFields(cell, CELL_FIELDS, path);
    requireSafeId(cell.id, `${path}.id`);
    if (cellIds.has(cell.id)) failPlanningConfig(`${path}.id must be unique.`);
    cellIds.add(cell.id);
    requireNonnegativeInteger(cell.runs, `${path}.runs`);
    validateMeasures(cell.tokensPerRun, TOKEN_FIELDS, `${path}.tokensPerRun`);
    validateMeasures(cell.pricesPerToken, TOKEN_FIELDS, `${path}.pricesPerToken`);
    const apiCostUsd = cell.runs * TOKEN_FIELDS.reduce(
      (total, field) => total + (
        cell.tokensPerRun[field] * cell.pricesPerToken[field]
      ),
      0
    );
    return {
      apiCostUsd,
      id: cell.id,
      pricesPerToken: cell.pricesPerToken,
      runs: cell.runs,
      tokensPerRun: cell.tokensPerRun
    };
  });

  validateMeasures(input.human, HUMAN_FIELDS, '$.human');
  requireNonnegativeInteger(input.human.judgedRuns, '$.human.judgedRuns');
  requireFiniteNumber(input.human.doubleRatingShare, '$.human.doubleRatingShare', {
    maximum: 1,
    minimum: 0
  });
  requireFiniteNumber(input.human.disagreementRate, '$.human.disagreementRate', {
    maximum: 1,
    minimum: 0
  });
  const primaryHours = (
    input.human.judgedRuns
    * input.human.minutesPerJudgment
    * (1 + input.human.doubleRatingShare)
  ) / 60;
  const adjudicationHours = (
    input.human.judgedRuns
    * input.human.disagreementRate
    * input.human.minutesPerAdjudication
  ) / 60;

  return cloneFrozenJson({
    apiCostUsd: cells.reduce((total, cell) => total + cell.apiCostUsd, 0),
    cells,
    humanComponents: {
      adjudicationHours,
      primaryHours
    },
    humanHours: (
      primaryHours
      + adjudicationHours
      + input.human.calibrationHours
      + input.human.auditHours
    ),
    humanInputs: input.human,
    schemaVersion: 1
  });
};
