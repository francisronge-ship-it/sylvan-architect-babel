import {
  cloneFrozenJson,
  failPlanningConfig,
  requireExactFields,
  requireFiniteNumber,
  requireRecord,
  requireSafeId,
  requireText
} from './planningData.mjs';

const ROOT_FIELDS = Object.freeze([
  'schemaVersion',
  'declarationRef',
  'declarationSha256',
  'targets',
  'candidates'
]);
const TARGET_FIELDS = Object.freeze(['id', 'metric', 'direction', 'threshold']);
const CANDIDATE_FIELDS = Object.freeze(['id', 'quantities', 'posteriorDraws']);
const DRAW_FIELDS = Object.freeze(['drawId', 'metrics']);
const SHA256_RE = /^[a-f0-9]{64}$/u;

const targetSatisfied = (target, value) => (
  target.direction === 'at-least'
    ? value >= target.threshold
    : value <= target.threshold
);

export const evaluatePhaseOneCandidateDesigns = (input) => {
  requireExactFields(input, ROOT_FIELDS, '$');
  if (input.schemaVersion !== 1) failPlanningConfig('$.schemaVersion must be 1.');
  requireText(input.declarationRef, '$.declarationRef');
  if (typeof input.declarationSha256 !== 'string' || !SHA256_RE.test(input.declarationSha256)) {
    failPlanningConfig('$.declarationSha256 must be a lowercase SHA-256 digest.');
  }
  if (!Array.isArray(input.targets) || input.targets.length === 0) {
    failPlanningConfig('$.targets must contain externally supplied decision targets.');
  }
  const targetIds = new Set();
  const targetMetrics = new Set();
  const targets = input.targets.map((target, index) => {
    const path = `$.targets[${index}]`;
    requireExactFields(target, TARGET_FIELDS, path);
    requireSafeId(target.id, `${path}.id`);
    if (targetIds.has(target.id)) failPlanningConfig(`${path}.id must be unique.`);
    targetIds.add(target.id);
    requireText(target.metric, `${path}.metric`);
    if (targetMetrics.has(target.metric)) {
      failPlanningConfig(`${path}.metric must be unique.`);
    }
    targetMetrics.add(target.metric);
    if (!['at-least', 'at-most'].includes(target.direction)) {
      failPlanningConfig(`${path}.direction must be at-least or at-most.`);
    }
    requireFiniteNumber(target.threshold, `${path}.threshold`);
    return target;
  });

  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    failPlanningConfig('$.candidates must contain externally supplied candidate designs.');
  }
  const candidateIds = new Set();
  const evaluations = input.candidates.map((candidate, candidateIndex) => {
    const path = `$.candidates[${candidateIndex}]`;
    requireExactFields(candidate, CANDIDATE_FIELDS, path);
    requireSafeId(candidate.id, `${path}.id`);
    if (candidateIds.has(candidate.id)) failPlanningConfig(`${path}.id must be unique.`);
    candidateIds.add(candidate.id);
    requireRecord(candidate.quantities, `${path}.quantities`);
    const quantities = cloneFrozenJson(candidate.quantities, `${path}.quantities`);
    if (!Array.isArray(candidate.posteriorDraws) || candidate.posteriorDraws.length === 0) {
      failPlanningConfig(`${path}.posteriorDraws must be a non-empty array.`);
    }
    const drawIds = new Set();
    const draws = candidate.posteriorDraws.map((draw, drawIndex) => {
      const drawPath = `${path}.posteriorDraws[${drawIndex}]`;
      requireExactFields(draw, DRAW_FIELDS, drawPath);
      requireSafeId(draw.drawId, `${drawPath}.drawId`);
      if (drawIds.has(draw.drawId)) failPlanningConfig(`${drawPath}.drawId must be unique.`);
      drawIds.add(draw.drawId);
      requireExactFields(draw.metrics, [...targetMetrics], `${drawPath}.metrics`);
      const targetResults = targets.map((target) => {
        const value = requireFiniteNumber(
          draw.metrics[target.metric],
          `${drawPath}.metrics.${target.metric}`
        );
        return {
          met: targetSatisfied(target, value),
          metric: target.metric,
          targetId: target.id,
          value
        };
      });
      return {
        allTargetsMet: targetResults.every(({ met }) => met),
        drawId: draw.drawId,
        targetResults
      };
    });
    const allTargetsMetCount = draws.filter(({ allTargetsMet }) => allTargetsMet).length;
    return {
      candidateId: candidate.id,
      drawCount: draws.length,
      draws,
      quantities,
      summary: {
        allTargetsMetCount,
        allTargetsMetFraction: allTargetsMetCount / draws.length
      }
    };
  });

  return cloneFrozenJson({
    declarationRef: input.declarationRef,
    declarationSha256: input.declarationSha256,
    evaluations,
    schemaVersion: 1,
    targets
  });
};
