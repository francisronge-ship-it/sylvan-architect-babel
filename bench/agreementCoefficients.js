import { createHash } from 'node:crypto';

import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertNonemptyText,
  assertUniqueTextArray
} from './benchmarkValidation.js';

const PLAN_FIELDS = Object.freeze([
  'agreementId',
  'coefficientIdentity',
  'ratingScale',
  'categoryIds',
  'unitWeighting',
  'chanceAgreementIdentity',
  'missingnessHandlingIdentity',
  'missingnessHandlingSourceRef',
  'confidenceLevel',
  'confidenceLevelSourceRef',
  'intervalType',
  'bootstrapMethod',
  'bootstrapScheduleSourceRef',
  'bootstrapScheduleSha256',
  'lowerOrderIndex',
  'upperOrderIndex'
]);
const UNIT_FIELDS = Object.freeze(['unitId', 'ratings']);
const RATING_FIELDS = Object.freeze(['raterId', 'categoryId']);
const REPLICATION_FIELDS = Object.freeze(['replicationId', 'sampledUnitIds']);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

export const hashAgreementData = (value) => {
  const normalized = copyJsonData(value, 'agreement hash input');
  return sha256CanonicalJson(normalized);
};

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'agreement plan');
  for (const field of [
    'agreementId',
    'missingnessHandlingIdentity',
    'missingnessHandlingSourceRef',
    'confidenceLevelSourceRef',
    'bootstrapScheduleSourceRef'
  ]) {
    assertNonemptyText(plan[field], `agreement plan.${field}`);
  }
  assertUniqueTextArray(plan.categoryIds, 'agreement plan.categoryIds');
  if (plan.categoryIds.length < 2) {
    throw new TypeError('agreement plan.categoryIds must contain at least two categories.');
  }
  const requiredIdentities = {
    coefficientIdentity: 'gwet-ac1',
    ratingScale: 'nominal',
    unitWeighting: 'equal-unit',
    chanceAgreementIdentity: 'gwet-ac1-multicategory',
    intervalType: 'percentile-order-statistics',
    bootstrapMethod: 'explicit-unit-resample-schedule'
  };
  Object.entries(requiredIdentities).forEach(([field, required]) => {
    if (plan[field] !== required) {
      throw new TypeError(`agreement plan.${field} must be ${required}.`);
    }
  });
  if (
    typeof plan.confidenceLevel !== 'number'
    || !Number.isFinite(plan.confidenceLevel)
    || plan.confidenceLevel <= 0
    || plan.confidenceLevel >= 1
  ) {
    throw new TypeError('agreement plan.confidenceLevel must be between 0 and 1.');
  }
  assertSha256(
    plan.bootstrapScheduleSha256,
    'agreement plan.bootstrapScheduleSha256'
  );
};

const validateOrderIndices = (plan, replicationCount) => {
  for (const field of ['lowerOrderIndex', 'upperOrderIndex']) {
    if (
      !Number.isSafeInteger(plan[field])
      || plan[field] < 0
      || plan[field] >= replicationCount
    ) {
      throw new TypeError(
        `agreement plan.${field} must index the supplied bootstrap schedule.`
      );
    }
  }
  if (plan.lowerOrderIndex > plan.upperOrderIndex) {
    throw new TypeError(
      'agreement plan lowerOrderIndex must not exceed upperOrderIndex.'
    );
  }
};

const normalizeUnits = (units, categoryIds) => {
  if (!Array.isArray(units) || units.length === 0) {
    throw new TypeError('agreement units must be a non-empty array.');
  }
  const declaredCategories = new Set(categoryIds);
  const unitIds = [];
  const normalized = units.map((unit, unitIndex) => {
    const path = `agreement units[${unitIndex}]`;
    assertExactFields(unit, UNIT_FIELDS, path);
    assertNonemptyText(unit.unitId, `${path}.unitId`);
    if (!Array.isArray(unit.ratings) || unit.ratings.length < 2) {
      throw new TypeError(`${path}.ratings must contain at least two ratings.`);
    }
    const raterIds = [];
    const ratings = unit.ratings.map((rating, ratingIndex) => {
      const ratingPath = `${path}.ratings[${ratingIndex}]`;
      assertExactFields(rating, RATING_FIELDS, ratingPath);
      assertNonemptyText(rating.raterId, `${ratingPath}.raterId`);
      assertNonemptyText(rating.categoryId, `${ratingPath}.categoryId`);
      if (!declaredCategories.has(rating.categoryId)) {
        throw new TypeError(`${ratingPath}.categoryId must name a declared category.`);
      }
      raterIds.push(rating.raterId);
      return {
        raterId: rating.raterId,
        categoryId: rating.categoryId
      };
    });
    if (new Set(raterIds).size !== raterIds.length) {
      throw new TypeError(`${path}.ratings must use unique raterId values.`);
    }
    unitIds.push(unit.unitId);
    return { unitId: unit.unitId, ratings };
  });
  if (new Set(unitIds).size !== unitIds.length) {
    throw new TypeError('agreement units must use unique unitId values.');
  }
  return normalized;
};

const normalizeBootstrapSchedule = (schedule, unitIds) => {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    throw new TypeError('agreement bootstrapSchedule must be a non-empty array.');
  }
  const knownUnitIds = new Set(unitIds);
  const replicationIds = [];
  const normalized = schedule.map((replication, replicationIndex) => {
    const path = `agreement bootstrapSchedule[${replicationIndex}]`;
    assertExactFields(replication, REPLICATION_FIELDS, path);
    assertNonemptyText(replication.replicationId, `${path}.replicationId`);
    if (
      !Array.isArray(replication.sampledUnitIds)
      || replication.sampledUnitIds.length !== unitIds.length
    ) {
      throw new TypeError(
        `${path}.sampledUnitIds must contain exactly one draw per original unit.`
      );
    }
    replication.sampledUnitIds.forEach((unitId, sampleIndex) => {
      assertNonemptyText(unitId, `${path}.sampledUnitIds[${sampleIndex}]`);
      if (!knownUnitIds.has(unitId)) {
        throw new TypeError(
          `${path}.sampledUnitIds[${sampleIndex}] must name a declared unit.`
        );
      }
    });
    replicationIds.push(replication.replicationId);
    return {
      replicationId: replication.replicationId,
      sampledUnitIds: [...replication.sampledUnitIds]
    };
  });
  if (new Set(replicationIds).size !== replicationIds.length) {
    throw new TypeError(
      'agreement bootstrapSchedule must use unique replicationId values.'
    );
  }
  return normalized;
};

const calculateGwetAc1 = (units, categoryIds) => {
  const categoryProportionSums = new Map(
    categoryIds.map((categoryId) => [categoryId, 0])
  );
  let ratingCount = 0;
  let observedAgreementSum = 0;
  units.forEach(({ ratings }) => {
    const unitCounts = new Map(categoryIds.map((categoryId) => [categoryId, 0]));
    ratings.forEach(({ categoryId }) => {
      unitCounts.set(categoryId, unitCounts.get(categoryId) + 1);
      ratingCount += 1;
    });
    unitCounts.forEach((count, categoryId) => {
      categoryProportionSums.set(
        categoryId,
        categoryProportionSums.get(categoryId) + (count / ratings.length)
      );
    });
    const agreeingOrderedPairs = [...unitCounts.values()].reduce(
      (sum, count) => sum + (count * (count - 1)),
      0
    );
    observedAgreementSum += agreeingOrderedPairs
      / (ratings.length * (ratings.length - 1));
  });
  const observedAgreement = observedAgreementSum / units.length;
  const chanceAgreement = [...categoryProportionSums.values()].reduce(
    (sum, proportionSum) => {
      const proportion = proportionSum / units.length;
      return sum + (proportion * (1 - proportion));
    },
    0
  ) / (categoryIds.length - 1);
  const coefficient = (observedAgreement - chanceAgreement)
    / (1 - chanceAgreement);
  if (![observedAgreement, chanceAgreement, coefficient].every(Number.isFinite)) {
    throw new RangeError('agreement calculation produced a non-finite result.');
  }
  return {
    ratingCount,
    observedAgreement,
    chanceAgreement,
    coefficient
  };
};

export const estimateGwetAc1 = ({ plan, units, bootstrapSchedule }) => {
  const planCopy = copyJsonData(plan, 'agreement plan');
  validatePlan(planCopy);
  const normalizedUnits = normalizeUnits(units, planCopy.categoryIds);
  const unitsById = new Map(normalizedUnits.map((unit) => [unit.unitId, unit]));
  const normalizedSchedule = normalizeBootstrapSchedule(
    bootstrapSchedule,
    normalizedUnits.map(({ unitId }) => unitId)
  );
  validateOrderIndices(planCopy, normalizedSchedule.length);
  const bootstrapScheduleSha256 = sha256CanonicalJson(normalizedSchedule);
  if (bootstrapScheduleSha256 !== planCopy.bootstrapScheduleSha256) {
    throw new TypeError(
      'agreement bootstrapSchedule does not match plan.bootstrapScheduleSha256.'
    );
  }

  const estimate = calculateGwetAc1(normalizedUnits, planCopy.categoryIds);
  const commonBody = {
    schemaVersion: 1,
    method: 'gwet-ac1',
    plan: planCopy,
    unitsSha256: sha256CanonicalJson(normalizedUnits),
    bootstrapScheduleSha256,
    status: normalizedUnits.length >= 2 ? 'estimated' : 'insufficient-units',
    unitCount: normalizedUnits.length,
    ratingCount: estimate.ratingCount,
    observedAgreement: estimate.observedAgreement,
    chanceAgreement: estimate.chanceAgreement,
    coefficient: estimate.coefficient,
    replicationCount: normalizedSchedule.length
  };
  if (normalizedUnits.length < 2) {
    const body = {
      ...commonBody,
      bootstrapCoefficients: null,
      confidenceInterval: null
    };
    return freezeJsonData({
      ...body,
      receiptSha256: sha256CanonicalJson(body)
    });
  }

  const bootstrapCoefficients = normalizedSchedule.map((replication) => ({
    replicationId: replication.replicationId,
    coefficient: calculateGwetAc1(
      replication.sampledUnitIds.map((unitId) => unitsById.get(unitId)),
      planCopy.categoryIds
    ).coefficient
  }));
  const orderedCoefficients = bootstrapCoefficients
    .map(({ coefficient }) => coefficient)
    .sort((left, right) => left - right);
  const body = {
    ...commonBody,
    bootstrapCoefficients,
    confidenceInterval: {
      low: orderedCoefficients[planCopy.lowerOrderIndex],
      high: orderedCoefficients[planCopy.upperOrderIndex]
    }
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
