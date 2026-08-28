import { createHash } from 'node:crypto';

import { canonicalizeJsonData, copyJsonData, freezeJsonData } from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertUniqueTextArray
} from './benchmarkValidation.js';

const PLAN_FIELDS = Object.freeze([
  'assignmentPlanId',
  'adjudicatedItemVersionIds',
  'reviewerIds',
  'coverageIdentity',
  'ratingMultiplicityIdentity',
  'reviewerBlindingIdentity',
  'reviewerBlindingSourceRef',
  'itemAuthorBlindingIdentity',
  'itemAuthorBlindingSourceRef',
  'runOrderIdentity',
  'runOrderSourceRef',
  'orderedRunIds',
  'pairingBalanceIdentity',
  'pairingPlanSourceRef',
  'pairingPlanSha256',
  'runSetSourceRef',
  'runSetSha256',
  'assignmentSetSourceRef',
  'assignmentSetSha256',
  'provenance'
]);
const RUN_FIELDS = Object.freeze([
  'runId',
  'itemVersionId',
  'validityStatus',
  'itemAuthorId',
  'runArtifactSha256'
]);
const ASSIGNMENT_FIELDS = Object.freeze([
  'assignmentId',
  'runId',
  'reviewerId',
  'sourceRunArtifactSha256',
  'blindedRunRef',
  'blindedRunSha256',
  'blindingRecordRef',
  'blindingRecordSha256'
]);
const PAIR_FIELDS = Object.freeze(['reviewerIds', 'requiredRunCount']);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

export const hashJudgedUnitPlanData = (value) => {
  const normalized = copyJsonData(value, 'judged-unit plan hash input');
  return sha256CanonicalJson(normalized);
};

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'judged-unit plan');
  assertNonemptyText(plan.assignmentPlanId, 'judged-unit plan.assignmentPlanId');
  assertUniqueTextArray(
    plan.adjudicatedItemVersionIds,
    'judged-unit plan.adjudicatedItemVersionIds',
    { allowEmpty: true }
  );
  assertUniqueTextArray(plan.reviewerIds, 'judged-unit plan.reviewerIds');
  assertUniqueTextArray(
    plan.orderedRunIds,
    'judged-unit plan.orderedRunIds',
    { allowEmpty: true }
  );
  for (const field of [
    'reviewerBlindingSourceRef',
    'itemAuthorBlindingSourceRef',
    'runOrderSourceRef',
    'pairingPlanSourceRef',
    'runSetSourceRef',
    'assignmentSetSourceRef'
  ]) {
    assertNonemptyText(plan[field], `judged-unit plan.${field}`);
  }
  const requiredIdentities = {
    coverageIdentity: 'every-valid-run-in-adjudicated-item-set',
    ratingMultiplicityIdentity: 'externally-assigned-one-or-two-reviewers-per-run',
    reviewerBlindingIdentity: 'model-identity-withheld',
    itemAuthorBlindingIdentity: 'reviewer-assignment-withheld',
    runOrderIdentity: 'externally-randomized-complete-run-order',
    pairingBalanceIdentity: 'complete-reviewer-pair-counts-differ-by-at-most-one'
  };
  Object.entries(requiredIdentities).forEach(([field, required]) => {
    if (plan[field] !== required) {
      throw new TypeError(`judged-unit plan.${field} must be ${required}.`);
    }
  });
  for (const field of [
    'pairingPlanSha256',
    'runSetSha256',
    'assignmentSetSha256'
  ]) {
    assertSha256(plan[field], `judged-unit plan.${field}`);
  }
  assertJsonRecord(plan.provenance, 'judged-unit plan.provenance');
};

const normalizeRuns = (runs) => {
  if (!Array.isArray(runs)) throw new TypeError('judged-unit runs must be an array.');
  const runIds = [];
  const normalized = runs.map((run, index) => {
    const path = `judged-unit runs[${index}]`;
    assertExactFields(run, RUN_FIELDS, path);
    for (const field of ['runId', 'itemVersionId', 'itemAuthorId']) {
      assertNonemptyText(run[field], `${path}.${field}`);
    }
    if (!['valid', 'invalid'].includes(run.validityStatus)) {
      throw new TypeError(`${path}.validityStatus must be valid or invalid.`);
    }
    assertSha256(run.runArtifactSha256, `${path}.runArtifactSha256`);
    runIds.push(run.runId);
    return copyJsonData(run, path);
  });
  if (new Set(runIds).size !== runIds.length) {
    throw new TypeError('judged-unit runs must use unique runId values.');
  }
  return normalized;
};

const normalizeAssignments = (assignments) => {
  if (!Array.isArray(assignments)) {
    throw new TypeError('judged-unit assignments must be an array.');
  }
  const assignmentIds = [];
  const coordinates = [];
  const normalized = assignments.map((assignment, index) => {
    const path = `judged-unit assignments[${index}]`;
    assertExactFields(assignment, ASSIGNMENT_FIELDS, path);
    for (const field of [
      'assignmentId',
      'runId',
      'reviewerId',
      'blindedRunRef',
      'blindingRecordRef'
    ]) {
      assertNonemptyText(assignment[field], `${path}.${field}`);
    }
    assertSha256(assignment.blindedRunSha256, `${path}.blindedRunSha256`);
    assertSha256(
      assignment.sourceRunArtifactSha256,
      `${path}.sourceRunArtifactSha256`
    );
    assertSha256(assignment.blindingRecordSha256, `${path}.blindingRecordSha256`);
    assignmentIds.push(assignment.assignmentId);
    coordinates.push(JSON.stringify([assignment.runId, assignment.reviewerId]));
    return copyJsonData(assignment, path);
  });
  if (new Set(assignmentIds).size !== assignmentIds.length) {
    throw new TypeError('judged-unit assignments must use unique assignmentId values.');
  }
  if (new Set(coordinates).size !== coordinates.length) {
    throw new TypeError(
      'judged-unit assignments must use unique runId/reviewerId coordinates.'
    );
  }
  return normalized;
};

const expectedReviewerPairs = (reviewerIds) => {
  const pairs = [];
  reviewerIds.forEach((left, leftIndex) => {
    reviewerIds.slice(leftIndex + 1).forEach((right) => pairs.push([left, right]));
  });
  return pairs;
};

const countsDifferByAtMostOne = (counts) => {
  if (counts.length === 0) return true;
  const { minimum, maximum } = counts.reduce(
    (range, count) => ({
      minimum: Math.min(range.minimum, count),
      maximum: Math.max(range.maximum, count)
    }),
    { minimum: counts[0], maximum: counts[0] }
  );
  return maximum - minimum <= 1;
};

const normalizePairingPlan = (pairingPlan, reviewerIds) => {
  if (!Array.isArray(pairingPlan)) {
    throw new TypeError('judged-unit pairingPlan must be an array.');
  }
  const reviewerRanks = new Map(
    reviewerIds.map((reviewerId, index) => [reviewerId, index])
  );
  const normalized = pairingPlan.map((entry, index) => {
    const path = `judged-unit pairingPlan[${index}]`;
    assertExactFields(entry, PAIR_FIELDS, path);
    assertUniqueTextArray(entry.reviewerIds, `${path}.reviewerIds`);
    if (
      entry.reviewerIds.length !== 2
      || entry.reviewerIds.some((reviewerId) => !reviewerRanks.has(reviewerId))
      || reviewerRanks.get(entry.reviewerIds[0]) >= reviewerRanks.get(entry.reviewerIds[1])
    ) {
      throw new TypeError(
        `${path}.reviewerIds must be one pair in declared reviewer order.`
      );
    }
    if (!Number.isSafeInteger(entry.requiredRunCount) || entry.requiredRunCount < 0) {
      throw new TypeError(`${path}.requiredRunCount must be a non-negative safe integer.`);
    }
    return copyJsonData(entry, path);
  });
  const expectedPairKeys = expectedReviewerPairs(reviewerIds)
    .map((pair) => JSON.stringify(pair));
  const actualPairKeys = normalized.map(({ reviewerIds: pair }) => JSON.stringify(pair));
  if (
    actualPairKeys.length !== expectedPairKeys.length
    || expectedPairKeys.some((key) => !actualPairKeys.includes(key))
  ) {
    throw new TypeError(
      'judged-unit pairingPlan must contain every declared reviewer pair exactly once.'
    );
  }
  const counts = normalized.map(({ requiredRunCount }) => requiredRunCount);
  if (!countsDifferByAtMostOne(counts)) {
    throw new TypeError(
      'judged-unit pairingPlan requiredRunCount values must differ by at most one.'
    );
  }
  return normalized;
};

export const validateJudgedUnitPlan = ({ plan, runs, assignments, pairingPlan }) => {
  const planCopy = copyJsonData(plan, 'judged-unit plan');
  validatePlan(planCopy);
  const normalizedRuns = normalizeRuns(runs);
  const normalizedAssignments = normalizeAssignments(assignments);
  const normalizedPairingPlan = normalizePairingPlan(
    pairingPlan,
    planCopy.reviewerIds
  );
  for (const [value, expectedSha256, label] of [
    [normalizedRuns, planCopy.runSetSha256, 'runs'],
    [normalizedAssignments, planCopy.assignmentSetSha256, 'assignments'],
    [normalizedPairingPlan, planCopy.pairingPlanSha256, 'pairingPlan']
  ]) {
    if (sha256CanonicalJson(value) !== expectedSha256) {
      throw new TypeError(`judged-unit ${label} do not match their declared SHA-256.`);
    }
  }

  const adjudicatedItems = new Set(planCopy.adjudicatedItemVersionIds);
  const targetRuns = normalizedRuns.filter((run) => (
    run.validityStatus === 'valid' && adjudicatedItems.has(run.itemVersionId)
  ));
  const targetRunIds = new Set(targetRuns.map(({ runId }) => runId));
  if (
    planCopy.orderedRunIds.length !== targetRuns.length
    || planCopy.orderedRunIds.some((runId) => !targetRunIds.has(runId))
  ) {
    throw new TypeError(
      'judged-unit plan.orderedRunIds must cover every target valid run exactly once.'
    );
  }

  const runById = new Map(normalizedRuns.map((run) => [run.runId, run]));
  const reviewerIds = new Set(planCopy.reviewerIds);
  const reviewerRanks = new Map(
    planCopy.reviewerIds.map((reviewerId, index) => [reviewerId, index])
  );
  const reviewerAssignmentTotals = new Map(
    planCopy.reviewerIds.map((reviewerId) => [reviewerId, 0])
  );
  const assignmentsByRunId = new Map(
    planCopy.orderedRunIds.map((runId) => [runId, []])
  );
  normalizedAssignments.forEach((assignment) => {
    if (!targetRunIds.has(assignment.runId)) {
      throw new TypeError(
        `judged-unit assignment ${assignment.assignmentId} must target a valid run in the adjudicated item set.`
      );
    }
    if (!reviewerIds.has(assignment.reviewerId)) {
      throw new TypeError(
        `judged-unit assignment ${assignment.assignmentId} must name a declared reviewer.`
      );
    }
    if (assignment.reviewerId === runById.get(assignment.runId).itemAuthorId) {
      throw new TypeError(
        `judged-unit assignment ${assignment.assignmentId} violates no-self-review.`
      );
    }
    if (
      assignment.sourceRunArtifactSha256
      !== runById.get(assignment.runId).runArtifactSha256
    ) {
      throw new TypeError(
        `judged-unit assignment ${assignment.assignmentId} does not bind its source run artifact.`
      );
    }
    assignmentsByRunId.get(assignment.runId).push(assignment);
    reviewerAssignmentTotals.set(
      assignment.reviewerId,
      reviewerAssignmentTotals.get(assignment.reviewerId) + 1
    );
  });
  assignmentsByRunId.forEach((runAssignments, runId) => {
    if (runAssignments.length < 1 || runAssignments.length > 2) {
      throw new TypeError(
        `judged-unit run ${runId} must have exactly one or two reviewer assignments.`
      );
    }
  });

  const pairCounts = new Map(
    expectedReviewerPairs(planCopy.reviewerIds).map((pair) => [JSON.stringify(pair), 0])
  );
  let doubleRatedRunCount = 0;
  assignmentsByRunId.forEach((runAssignments) => {
    if (runAssignments.length !== 2) return;
    doubleRatedRunCount += 1;
    const pair = runAssignments
      .map(({ reviewerId }) => reviewerId)
      .sort((left, right) => (
        reviewerRanks.get(left) - reviewerRanks.get(right)
      ));
    const pairKey = JSON.stringify(pair);
    pairCounts.set(pairKey, pairCounts.get(pairKey) + 1);
  });
  normalizedPairingPlan.forEach(({ reviewerIds: pair, requiredRunCount }) => {
    if (pairCounts.get(JSON.stringify(pair)) !== requiredRunCount) {
      throw new TypeError(
        `judged-unit reviewer pair ${pair.join('/')} does not match requiredRunCount.`
      );
    }
  });

  const reviewerLoads = planCopy.reviewerIds.map((reviewerId) => ({
    reviewerId,
    assignmentCount: reviewerAssignmentTotals.get(reviewerId)
  }));
  const body = {
    schemaVersion: 1,
    plan: planCopy,
    runSetSha256: sha256CanonicalJson(normalizedRuns),
    assignmentSetSha256: sha256CanonicalJson(normalizedAssignments),
    pairingPlanSha256: sha256CanonicalJson(normalizedPairingPlan),
    runCount: normalizedRuns.length,
    targetValidRunCount: targetRuns.length,
    excludedRunCount: normalizedRuns.length - targetRuns.length,
    assignmentCount: normalizedAssignments.length,
    singleRatedRunCount: targetRuns.length - doubleRatedRunCount,
    doubleRatedRunCount,
    observedDoubleRatingShare: targetRuns.length === 0
      ? null
      : doubleRatedRunCount / targetRuns.length,
    orderedRunIds: [...planCopy.orderedRunIds],
    reviewerLoads,
    pairCounts: normalizedPairingPlan.map(({ reviewerIds: pair }) => ({
      reviewerIds: [...pair],
      runCount: pairCounts.get(JSON.stringify(pair))
    })),
    assignments: normalizedAssignments
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
