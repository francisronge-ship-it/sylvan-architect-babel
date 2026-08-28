import { createHash } from 'node:crypto';

import { FAILURE_CLASSES } from '../server/babelParser/validationErrors.js';
import {
  canonicalizeJsonData,
  copyJsonData,
  freezeJsonData
} from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertUniqueTextArray,
  sameTextSet
} from './benchmarkValidation.js';

const REGISTER_ENTRY_FIELDS = Object.freeze([
  'registerId',
  'sourceRef',
  'ruleIds',
  'instructionStated'
]);

const RULE_CATALOG_FIELDS = Object.freeze([
  'sourceRef',
  'sourceSha256',
  'ruleIds'
]);

const FIXTURE_EXPECTATION_FIELDS = Object.freeze([
  'fixtureRef',
  'registerIds',
  'expectedFailures'
]);

const FAILURE_COUNT_FIELDS = Object.freeze([
  'failureClass',
  'ruleId',
  'count'
]);

const PLAN_FIELDS = Object.freeze([
  'schemaVersion',
  'contractHashes',
  'ruleCatalog',
  'registerEntries',
  'fixtureExpectations',
  'planSha256'
]);

const OBSERVATION_FIELDS = Object.freeze([
  'fixtureRef',
  'failures'
]);

const FAILURE_CLASS_VALUES = new Set(Object.values(FAILURE_CLASSES));

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertDigest = (value, path) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest.`);
  }
};

const failureCountIdentity = ({ failureClass, ruleId }) => (
  JSON.stringify([failureClass, ruleId])
);

const ruleIdsForRegisters = (registerById, registerIds) => new Set(
  registerIds.flatMap((registerId) => registerById.get(registerId).ruleIds)
);

const validateFailureCounts = ({ failures, ruleIds, path }) => {
  if (!Array.isArray(failures)) {
    throw new TypeError(`${path} must be an array.`);
  }
  failures.forEach((failure, index) => {
    const itemPath = `${path}[${index}]`;
    assertExactFields(failure, FAILURE_COUNT_FIELDS, itemPath);
    if (!FAILURE_CLASS_VALUES.has(failure.failureClass)) {
      throw new TypeError(`${itemPath}.failureClass must be a normative failure class.`);
    }
    if (!ruleIds.has(failure.ruleId)) {
      throw new TypeError(`${itemPath}.ruleId must be present in the rule catalog.`);
    }
    if (!Number.isSafeInteger(failure.count) || failure.count < 1) {
      throw new TypeError(`${itemPath}.count must be a positive safe integer.`);
    }
  });
  const identities = failures.map(failureCountIdentity);
  if (new Set(identities).size !== identities.length) {
    throw new TypeError(`${path} must not duplicate a failure class/rule pair.`);
  }
};

const validateRuleCatalog = (ruleCatalog) => {
  assertExactFields(ruleCatalog, RULE_CATALOG_FIELDS, 'ruleCatalog');
  assertNonemptyText(ruleCatalog.sourceRef, 'ruleCatalog.sourceRef');
  assertDigest(ruleCatalog.sourceSha256, 'ruleCatalog.sourceSha256');
  assertUniqueTextArray(ruleCatalog.ruleIds, 'ruleCatalog.ruleIds');
};

const validateRegisterEntries = ({ entries, ruleCatalog }) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('registerEntries must be a non-empty array.');
  }
  entries.forEach((entry, index) => {
    const path = `registerEntries[${index}]`;
    assertExactFields(entry, REGISTER_ENTRY_FIELDS, path);
    assertNonemptyText(entry.registerId, `${path}.registerId`);
    assertNonemptyText(entry.sourceRef, `${path}.sourceRef`);
    assertUniqueTextArray(entry.ruleIds, `${path}.ruleIds`);
    entry.ruleIds.forEach((ruleId) => {
      if (!ruleCatalog.ruleIds.includes(ruleId)) {
        throw new TypeError(`${path}.ruleIds contains a rule absent from the catalog.`);
      }
    });
    if (typeof entry.instructionStated !== 'boolean') {
      throw new TypeError(`${path}.instructionStated must be boolean.`);
    }
  });
  const registerIds = entries.map((entry) => entry.registerId);
  if (new Set(registerIds).size !== registerIds.length) {
    throw new TypeError('registerEntries must have unique registerId values.');
  }
};

const validateFixtureExpectations = ({
  ruleCatalog,
  registerEntries,
  fixtureExpectations
}) => {
  if (!Array.isArray(fixtureExpectations) || fixtureExpectations.length === 0) {
    throw new TypeError('fixtureExpectations must be a non-empty array.');
  }
  const registerById = new Map(
    registerEntries.map((entry) => [entry.registerId, entry])
  );
  const catalogRuleIds = new Set(ruleCatalog.ruleIds);
  fixtureExpectations.forEach((fixture, index) => {
    const path = `fixtureExpectations[${index}]`;
    assertExactFields(fixture, FIXTURE_EXPECTATION_FIELDS, path);
    assertNonemptyText(fixture.fixtureRef, `${path}.fixtureRef`);
    assertUniqueTextArray(fixture.registerIds, `${path}.registerIds`);
    validateFailureCounts({
      failures: fixture.expectedFailures,
      ruleIds: catalogRuleIds,
      path: `${path}.expectedFailures`
    });
    fixture.registerIds.forEach((registerId) => {
      if (!registerById.has(registerId)) {
        throw new TypeError(`${path}.registerIds contains an unknown register ID.`);
      }
    });
    const tracedRuleIds = ruleIdsForRegisters(registerById, fixture.registerIds);
    fixture.expectedFailures.forEach(({ ruleId }) => {
      if (!tracedRuleIds.has(ruleId)) {
        throw new TypeError(
          `${path}.expectedFailures ruleId=${ruleId} is not traced by its register IDs.`
        );
      }
    });
  });
  const fixtureRefs = fixtureExpectations.map((fixture) => fixture.fixtureRef);
  if (new Set(fixtureRefs).size !== fixtureRefs.length) {
    throw new TypeError('fixtureExpectations must have unique fixtureRef values.');
  }
  const referencedRegisterIds = new Set(fixtureExpectations.flatMap(
    (fixture) => fixture.registerIds
  ));
  registerEntries.forEach(({ registerId }) => {
    if (!referencedRegisterIds.has(registerId)) {
      throw new TypeError(`registerId=${registerId} is not covered by any fixture.`);
    }
  });
};

export const createContractValidationPlan = ({
  contractHashes,
  ruleCatalog,
  registerEntries,
  fixtureExpectations
}) => {
  assertJsonRecord(contractHashes, 'contractHashes');
  if (Object.keys(contractHashes).length === 0) {
    throw new TypeError('contractHashes must not be empty.');
  }
  Object.entries(contractHashes).forEach(([name, digest]) => {
    assertNonemptyText(name, 'contractHashes key');
    assertDigest(digest, `contractHashes.${name}`);
  });
  validateRuleCatalog(ruleCatalog);
  validateRegisterEntries({ entries: registerEntries, ruleCatalog });
  validateFixtureExpectations({
    ruleCatalog,
    registerEntries,
    fixtureExpectations
  });
  const body = {
    schemaVersion: 1,
    contractHashes: copyJsonData(contractHashes, 'contractHashes'),
    ruleCatalog: copyJsonData(ruleCatalog, 'ruleCatalog'),
    registerEntries: copyJsonData(registerEntries, 'registerEntries'),
    fixtureExpectations: copyJsonData(
      fixtureExpectations,
      'fixtureExpectations'
    )
  };
  return freezeJsonData({
    ...body,
    planSha256: sha256CanonicalJson(body)
  });
};

export const validateContractValidationPlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'contract validation plan');
  if (plan.schemaVersion !== 1) {
    throw new TypeError('contract validation plan.schemaVersion must be 1.');
  }
  assertDigest(plan.planSha256, 'contract validation plan.planSha256');
  const rebuilt = createContractValidationPlan({
    contractHashes: plan.contractHashes,
    ruleCatalog: plan.ruleCatalog,
    registerEntries: plan.registerEntries,
    fixtureExpectations: plan.fixtureExpectations
  });
  if (
    JSON.stringify(canonicalizeJsonData(rebuilt))
    !== JSON.stringify(canonicalizeJsonData(plan))
  ) {
    throw new TypeError('contract validation plan does not match its content.');
  }
  return rebuilt;
};

const failureCountMap = (failures) => new Map(
  failures.map((failure) => [failureCountIdentity(failure), failure.count])
);

export const compareContractValidationCounts = ({ plan, observations }) => {
  const validatedPlan = validateContractValidationPlan(plan);
  if (!Array.isArray(observations)) {
    throw new TypeError('observations must be an array.');
  }
  const catalogRuleIds = new Set(validatedPlan.ruleCatalog.ruleIds);
  observations.forEach((observation, index) => {
    const path = `observations[${index}]`;
    assertExactFields(observation, OBSERVATION_FIELDS, path);
    assertNonemptyText(observation.fixtureRef, `${path}.fixtureRef`);
    validateFailureCounts({
      failures: observation.failures,
      ruleIds: catalogRuleIds,
      path: `${path}.failures`
    });
  });
  const observedRefs = observations.map((observation) => observation.fixtureRef);
  if (new Set(observedRefs).size !== observedRefs.length) {
    throw new TypeError('observations must have unique fixtureRef values.');
  }
  const expectedRefs = validatedPlan.fixtureExpectations.map(
    (fixture) => fixture.fixtureRef
  );
  if (!sameTextSet(observedRefs, expectedRefs)) {
    throw new TypeError('observations must exactly cover the planned fixture refs.');
  }
  const registerById = new Map(validatedPlan.registerEntries.map(
    (entry) => [entry.registerId, entry]
  ));
  const fixtureByRef = new Map(validatedPlan.fixtureExpectations.map(
    (fixture) => [fixture.fixtureRef, fixture]
  ));
  observations.forEach((observation) => {
    const fixture = fixtureByRef.get(observation.fixtureRef);
    const tracedRuleIds = ruleIdsForRegisters(registerById, fixture.registerIds);
    observation.failures.forEach(({ ruleId }) => {
      if (!tracedRuleIds.has(ruleId)) {
        throw new TypeError(
          `observation fixtureRef=${observation.fixtureRef} ruleId=${ruleId} `
          + 'is not traced by its planned register IDs.'
        );
      }
    });
  });
  const observationByRef = new Map(
    observations.map((observation) => [observation.fixtureRef, observation])
  );
  const fixtureResults = validatedPlan.fixtureExpectations.map((fixture) => {
    const expected = failureCountMap(fixture.expectedFailures);
    const observed = failureCountMap(
      observationByRef.get(fixture.fixtureRef).failures
    );
    const identities = new Set([...expected.keys(), ...observed.keys()]);
    const mismatches = [...identities].flatMap((identity) => {
      const expectedCount = expected.get(identity) ?? 0;
      const observedCount = observed.get(identity) ?? 0;
      if (expectedCount === observedCount) return [];
      const [failureClass, ruleId] = JSON.parse(identity);
      return [{ failureClass, ruleId, expectedCount, observedCount }];
    });
    return {
      fixtureRef: fixture.fixtureRef,
      registerIds: [...fixture.registerIds],
      status: mismatches.length === 0 ? 'matched' : 'mismatched',
      mismatches
    };
  });
  const body = {
    schemaVersion: 1,
    planSha256: validatedPlan.planSha256,
    status: fixtureResults.every((result) => result.status === 'matched')
      ? 'matched'
      : 'mismatched',
    fixtureResults
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
