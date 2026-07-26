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

const PLAN_FIELDS = Object.freeze([
  'ledgerId',
  'coverageIdentity',
  'providerExposureIdentity',
  'localExecutionIdentity',
  'retentionIdentity',
  'nonExposureIdentity',
  'eventOrderIdentity',
  'orderedEventIds',
  'executionSetSourceRef',
  'executionSetSha256',
  'eventSetSourceRef',
  'eventSetSha256',
  'provenance'
]);

const EXECUTION_FIELDS = Object.freeze({
  'provider-api': [
    'runId',
    'itemVersionId',
    'materialClass',
    'executionRoute',
    'sourceRunArtifactSha256',
    'providerIdentity'
  ],
  'operator-local-open-weight': [
    'runId',
    'itemVersionId',
    'materialClass',
    'executionRoute',
    'sourceRunArtifactSha256'
  ]
});

const EVENT_FIELDS = Object.freeze({
  'provider-api-exposure': [
    'eventId',
    'runId',
    'eventType',
    'occurredAt',
    'sourceRunArtifactSha256',
    'providerIdentity',
    'retentionTier',
    'retentionEvidenceRef',
    'retentionEvidenceSha256'
  ],
  'operator-local-execution': [
    'eventId',
    'runId',
    'eventType',
    'occurredAt',
    'sourceRunArtifactSha256',
    'operatorControlEvidenceRef',
    'operatorControlEvidenceSha256'
  ]
});

const EXPECTED_IDENTITIES = Object.freeze({
  coverageIdentity: 'one-ledger-event-per-declared-execution',
  providerExposureIdentity: 'provider-api-execution-is-exposure',
  localExecutionIdentity:
    'operator-controlled-local-execution-is-not-provider-exposure',
  retentionIdentity: 'retention-commitments-do-not-reverse-exposure',
  nonExposureIdentity: 'provider-api-exposure-revokes-provider-nonexposure',
  eventOrderIdentity: 'externally-recorded-complete-chronological-event-order'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

export const hashExposureLedgerData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'exposure-ledger hash input'))
);

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'exposure ledger plan');
  assertNonemptyText(plan.ledgerId, 'exposure ledger plan.ledgerId');
  Object.entries(EXPECTED_IDENTITIES).forEach(([field, expected]) => {
    if (plan[field] !== expected) {
      throw new TypeError(`exposure ledger plan.${field} must be ${expected}.`);
    }
  });
  assertUniqueTextArray(
    plan.orderedEventIds,
    'exposure ledger plan.orderedEventIds',
    { allowEmpty: true }
  );
  for (const field of ['executionSetSourceRef', 'eventSetSourceRef']) {
    assertNonemptyText(plan[field], `exposure ledger plan.${field}`);
  }
  for (const field of ['executionSetSha256', 'eventSetSha256']) {
    assertSha256(plan[field], `exposure ledger plan.${field}`);
  }
  assertJsonRecord(plan.provenance, 'exposure ledger plan.provenance');
};

const normalizeExecutions = (executions) => {
  if (!Array.isArray(executions)) {
    throw new TypeError('exposure ledger executions must be an array.');
  }
  const runIds = [];
  const materialClasses = new Map();
  const normalized = executions.map((execution, index) => {
    const path = `exposure ledger executions[${index}]`;
    if (!execution || typeof execution !== 'object') {
      throw new TypeError(`${path} must be an object.`);
    }
    assertTextChoice(
      execution.executionRoute,
      Object.keys(EXECUTION_FIELDS),
      `${path}.executionRoute`
    );
    assertExactFields(execution, EXECUTION_FIELDS[execution.executionRoute], path);
    for (const field of ['runId', 'itemVersionId', 'materialClass']) {
      assertNonemptyText(execution[field], `${path}.${field}`);
    }
    assertSha256(
      execution.sourceRunArtifactSha256,
      `${path}.sourceRunArtifactSha256`
    );
    if (execution.executionRoute === 'provider-api') {
      assertNonemptyText(execution.providerIdentity, `${path}.providerIdentity`);
    }
    const previousClass = materialClasses.get(execution.itemVersionId);
    if (previousClass && previousClass !== execution.materialClass) {
      throw new TypeError(
        `exposure ledger itemVersionId=${execution.itemVersionId} `
        + 'must retain one materialClass.'
      );
    }
    materialClasses.set(execution.itemVersionId, execution.materialClass);
    runIds.push(execution.runId);
    return copyJsonData(execution, path);
  });
  if (new Set(runIds).size !== runIds.length) {
    throw new TypeError('exposure ledger executions must use unique runId values.');
  }
  return normalized;
};

const normalizeEvents = (events) => {
  if (!Array.isArray(events)) {
    throw new TypeError('exposure ledger events must be an array.');
  }
  const eventIds = [];
  const runIds = [];
  const normalized = events.map((event, index) => {
    const path = `exposure ledger events[${index}]`;
    if (!event || typeof event !== 'object') {
      throw new TypeError(`${path} must be an object.`);
    }
    assertTextChoice(
      event.eventType,
      Object.keys(EVENT_FIELDS),
      `${path}.eventType`
    );
    assertExactFields(event, EVENT_FIELDS[event.eventType], path);
    for (const field of ['eventId', 'runId', 'occurredAt']) {
      assertNonemptyText(event[field], `${path}.${field}`);
    }
    assertSha256(event.sourceRunArtifactSha256, `${path}.sourceRunArtifactSha256`);
    if (event.eventType === 'provider-api-exposure') {
      for (const field of [
        'providerIdentity',
        'retentionTier',
        'retentionEvidenceRef'
      ]) {
        assertNonemptyText(event[field], `${path}.${field}`);
      }
      assertSha256(
        event.retentionEvidenceSha256,
        `${path}.retentionEvidenceSha256`
      );
    } else {
      assertNonemptyText(
        event.operatorControlEvidenceRef,
        `${path}.operatorControlEvidenceRef`
      );
      assertSha256(
        event.operatorControlEvidenceSha256,
        `${path}.operatorControlEvidenceSha256`
      );
    }
    eventIds.push(event.eventId);
    runIds.push(event.runId);
    return copyJsonData(event, path);
  });
  if (new Set(eventIds).size !== eventIds.length) {
    throw new TypeError('exposure ledger events must use unique eventId values.');
  }
  if (new Set(runIds).size !== runIds.length) {
    throw new TypeError('exposure ledger events must use unique runId values.');
  }
  return normalized;
};

const validateCompleteEventOrder = (orderedEventIds, events) => {
  const eventIds = new Set(events.map(({ eventId }) => eventId));
  if (
    orderedEventIds.length !== events.length
    || orderedEventIds.some((eventId) => !eventIds.has(eventId))
  ) {
    throw new TypeError(
      'exposure ledger plan.orderedEventIds must contain every event exactly once.'
    );
  }
};

const validateEventExecutionPair = (event, execution) => {
  if (event.sourceRunArtifactSha256 !== execution.sourceRunArtifactSha256) {
    throw new TypeError(
      `exposure ledger event ${event.eventId} does not bind its source run artifact.`
    );
  }
  if (
    execution.executionRoute === 'provider-api'
    && (
      event.eventType !== 'provider-api-exposure'
      || event.providerIdentity !== execution.providerIdentity
    )
  ) {
    throw new TypeError(
      `exposure ledger event ${event.eventId} must record its provider API exposure.`
    );
  }
  if (
    execution.executionRoute === 'operator-local-open-weight'
    && event.eventType !== 'operator-local-execution'
  ) {
    throw new TypeError(
      `exposure ledger event ${event.eventId} must record operator-local execution.`
    );
  }
};

const buildProviderExposureStates = ({ orderedEvents, executionByRunId }) => {
  const states = new Map();
  orderedEvents.forEach((event) => {
    if (event.eventType !== 'provider-api-exposure') return;
    const execution = executionByRunId.get(event.runId);
    const key = JSON.stringify([
      execution.itemVersionId,
      event.providerIdentity
    ]);
    const existing = states.get(key);
    const retentionObservation = {
      eventId: event.eventId,
      retentionTier: event.retentionTier,
      retentionEvidenceRef: event.retentionEvidenceRef,
      retentionEvidenceSha256: event.retentionEvidenceSha256
    };
    if (existing) {
      existing.exposureEventIds.push(event.eventId);
      existing.retentionObservations.push(retentionObservation);
      return;
    }
    states.set(key, {
      itemVersionId: execution.itemVersionId,
      materialClass: execution.materialClass,
      providerIdentity: event.providerIdentity,
      exposureStatus: 'exposed',
      firstExposureAt: event.occurredAt,
      firstExposureEventId: event.eventId,
      exposureEventIds: [event.eventId],
      retentionObservations: [retentionObservation]
    });
  });
  return [...states.values()];
};

export const createExposureLedgerReceipt = ({ plan, executions, events }) => {
  const planCopy = copyJsonData(plan, 'exposure ledger plan');
  validatePlan(planCopy);
  const normalizedExecutions = normalizeExecutions(executions);
  const normalizedEvents = normalizeEvents(events);
  if (sha256CanonicalJson(normalizedExecutions) !== planCopy.executionSetSha256) {
    throw new TypeError(
      'exposure ledger executions do not match their declared SHA-256.'
    );
  }
  if (sha256CanonicalJson(normalizedEvents) !== planCopy.eventSetSha256) {
    throw new TypeError(
      'exposure ledger events do not match their declared SHA-256.'
    );
  }
  validateCompleteEventOrder(planCopy.orderedEventIds, normalizedEvents);

  const executionByRunId = new Map(
    normalizedExecutions.map((execution) => [execution.runId, execution])
  );
  if (
    normalizedEvents.length !== normalizedExecutions.length
    || normalizedEvents.some((event) => !executionByRunId.has(event.runId))
  ) {
    throw new TypeError(
      'exposure ledger must contain one event for every declared execution.'
    );
  }
  normalizedEvents.forEach((event) => {
    validateEventExecutionPair(event, executionByRunId.get(event.runId));
  });

  const eventById = new Map(
    normalizedEvents.map((event) => [event.eventId, event])
  );
  const orderedEvents = planCopy.orderedEventIds.map(
    (eventId) => eventById.get(eventId)
  );
  const providerExposureStates = buildProviderExposureStates({
    orderedEvents,
    executionByRunId
  });
  const body = {
    schemaVersion: 1,
    plan: planCopy,
    executionSetSha256: sha256CanonicalJson(normalizedExecutions),
    eventSetSha256: sha256CanonicalJson(normalizedEvents),
    executionCount: normalizedExecutions.length,
    providerApiExposureCount: orderedEvents.filter(
      ({ eventType }) => eventType === 'provider-api-exposure'
    ).length,
    operatorLocalExecutionCount: orderedEvents.filter(
      ({ eventType }) => eventType === 'operator-local-execution'
    ).length,
    orderedEvents,
    providerExposureStates
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
