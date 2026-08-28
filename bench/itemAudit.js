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
  assertUniqueTextArray,
  sameTextSet
} from './benchmarkValidation.js';

const PLAN_FIELDS = Object.freeze([
  'auditCycleId',
  'auditScopeIdentity',
  'taxonomyIdentity',
  'dispositionIdentity',
  'revisionIdentity',
  'uncertainIdentity',
  'itemSetSourceRef',
  'itemSetSha256',
  'auditSetSourceRef',
  'auditSetSha256',
  'targetItemVersionIds',
  'provenance'
]);

const ITEM_FIELDS = Object.freeze([
  'itemId',
  'itemVersionId',
  'versionNumber',
  'itemArtifactRef',
  'itemArtifactSha256',
  'statusHistoryRef',
  'statusHistorySha256'
]);

const AUDIT_FIELDS = Object.freeze([
  'auditId',
  'itemId',
  'auditedItemVersionId',
  'auditorIdentity',
  'auditCompletedAt',
  'auditArtifactRef',
  'auditArtifactSha256',
  'findings',
  'disposition',
  'dispositionEvidenceRef',
  'dispositionEvidenceSha256',
  'revision'
]);

const FINDING_FIELDS = Object.freeze([
  'findingId',
  'taxonomyClass',
  'evidenceRef',
  'evidenceSha256'
]);

const REVISION_FIELDS = Object.freeze([
  'itemId',
  'fromItemVersionId',
  'toItemVersionId',
  'toVersionNumber',
  'revisedItemArtifactRef',
  'revisedItemArtifactSha256',
  'affectedScoreSetRef',
  'affectedScoreSetSha256',
  'dualVersionRepublicationPlanRef',
  'dualVersionRepublicationPlanSha256'
]);

export const ITEM_AUDIT_TAXONOMY = Object.freeze([
  'key-error',
  'underspecified-checklist',
  'family-doc-gap',
  'ambiguity-defect',
  'contamination-evidence'
]);

export const ITEM_AUDIT_DISPOSITIONS = Object.freeze([
  'verified',
  'revised',
  'documented-uncertain'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  auditScopeIdentity: 'externally-declared-complete-item-version-set',
  taxonomyIdentity:
    'key-error-underspecified-checklist-family-doc-gap-ambiguity-defect-contamination-evidence',
  dispositionIdentity:
    'externally-authored-verified-revised-or-documented-uncertain',
  revisionIdentity: 'next-version-plus-dual-version-score-republication',
  uncertainIdentity: 'exclude-from-claim-bearing-scores-until-resolved'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const assertPositiveInteger = (value, path) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${path} must be a positive safe integer.`);
  }
};

const encodeItemVersionCoordinate = (itemId, versionNumber) => (
  JSON.stringify([itemId, versionNumber])
);

export const hashItemAuditData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'item-audit hash input'))
);

const validatePlan = (plan) => {
  assertExactFields(plan, PLAN_FIELDS, 'item-audit plan');
  assertNonemptyText(plan.auditCycleId, 'item-audit plan.auditCycleId');
  Object.entries(EXPECTED_IDENTITIES).forEach(([field, expected]) => {
    if (plan[field] !== expected) {
      throw new TypeError(`item-audit plan.${field} must be ${expected}.`);
    }
  });
  for (const field of ['itemSetSourceRef', 'auditSetSourceRef']) {
    assertNonemptyText(plan[field], `item-audit plan.${field}`);
  }
  for (const field of ['itemSetSha256', 'auditSetSha256']) {
    assertSha256(plan[field], `item-audit plan.${field}`);
  }
  assertUniqueTextArray(
    plan.targetItemVersionIds,
    'item-audit plan.targetItemVersionIds',
    { allowEmpty: true }
  );
  assertJsonRecord(plan.provenance, 'item-audit plan.provenance');
};

const normalizeItems = (items) => {
  if (!Array.isArray(items)) {
    throw new TypeError('item-audit items must be an array.');
  }
  const itemVersionIds = [];
  const versionCoordinates = [];
  const normalized = items.map((item, index) => {
    const path = `item-audit items[${index}]`;
    assertExactFields(item, ITEM_FIELDS, path);
    for (const field of [
      'itemId',
      'itemVersionId',
      'itemArtifactRef',
      'statusHistoryRef'
    ]) {
      assertNonemptyText(item[field], `${path}.${field}`);
    }
    assertPositiveInteger(item.versionNumber, `${path}.versionNumber`);
    for (const field of ['itemArtifactSha256', 'statusHistorySha256']) {
      assertSha256(item[field], `${path}.${field}`);
    }
    itemVersionIds.push(item.itemVersionId);
    versionCoordinates.push(encodeItemVersionCoordinate(
      item.itemId,
      item.versionNumber
    ));
    return copyJsonData(item, path);
  });
  if (new Set(itemVersionIds).size !== itemVersionIds.length) {
    throw new TypeError(
      'item-audit items must use unique itemVersionId values.'
    );
  }
  if (new Set(versionCoordinates).size !== versionCoordinates.length) {
    throw new TypeError(
      'item-audit items must use unique itemId/versionNumber coordinates.'
    );
  }
  return normalized;
};

const normalizeFindings = (findings, path) => {
  if (!Array.isArray(findings)) {
    throw new TypeError(`${path} must be an array.`);
  }
  const findingIds = [];
  const normalized = findings.map((finding, index) => {
    const findingPath = `${path}[${index}]`;
    assertExactFields(finding, FINDING_FIELDS, findingPath);
    assertNonemptyText(finding.findingId, `${findingPath}.findingId`);
    assertTextChoice(
      finding.taxonomyClass,
      ITEM_AUDIT_TAXONOMY,
      `${findingPath}.taxonomyClass`
    );
    assertNonemptyText(finding.evidenceRef, `${findingPath}.evidenceRef`);
    assertSha256(finding.evidenceSha256, `${findingPath}.evidenceSha256`);
    findingIds.push(finding.findingId);
    return copyJsonData(finding, findingPath);
  });
  if (new Set(findingIds).size !== findingIds.length) {
    throw new TypeError(`${path} must use unique findingId values.`);
  }
  return normalized;
};

const normalizeRevision = (revision, audit, item, path) => {
  if (audit.disposition !== 'revised') {
    if (revision !== null) {
      throw new TypeError(
        `${path} must be null unless disposition is revised.`
      );
    }
    return null;
  }
  assertExactFields(revision, REVISION_FIELDS, path);
  for (const field of [
    'itemId',
    'fromItemVersionId',
    'toItemVersionId',
    'revisedItemArtifactRef',
    'affectedScoreSetRef',
    'dualVersionRepublicationPlanRef'
  ]) {
    assertNonemptyText(revision[field], `${path}.${field}`);
  }
  for (const field of [
    'revisedItemArtifactSha256',
    'affectedScoreSetSha256',
    'dualVersionRepublicationPlanSha256'
  ]) {
    assertSha256(revision[field], `${path}.${field}`);
  }
  assertPositiveInteger(revision.toVersionNumber, `${path}.toVersionNumber`);
  if (
    revision.itemId !== item.itemId
    || revision.fromItemVersionId !== item.itemVersionId
  ) {
    throw new TypeError(`${path} must continue the audited item version.`);
  }
  if (
    revision.toItemVersionId === item.itemVersionId
    || revision.toVersionNumber !== item.versionNumber + 1
  ) {
    throw new TypeError(`${path} must identify the next distinct item version.`);
  }
  return copyJsonData(revision, path);
};

const normalizeAudits = (audits, itemsByVersionId) => {
  if (!Array.isArray(audits)) {
    throw new TypeError('item-audit records must be an array.');
  }
  const auditIds = [];
  const auditedItemVersionIds = [];
  const normalized = audits.map((audit, index) => {
    const path = `item-audit records[${index}]`;
    assertExactFields(audit, AUDIT_FIELDS, path);
    for (const field of [
      'auditId',
      'itemId',
      'auditedItemVersionId',
      'auditorIdentity',
      'auditCompletedAt',
      'auditArtifactRef',
      'dispositionEvidenceRef'
    ]) {
      assertNonemptyText(audit[field], `${path}.${field}`);
    }
    for (const field of [
      'auditArtifactSha256',
      'dispositionEvidenceSha256'
    ]) {
      assertSha256(audit[field], `${path}.${field}`);
    }
    assertTextChoice(
      audit.disposition,
      ITEM_AUDIT_DISPOSITIONS,
      `${path}.disposition`
    );
    const item = itemsByVersionId.get(audit.auditedItemVersionId);
    if (!item || audit.itemId !== item.itemId) {
      throw new TypeError(`${path} must name one declared item version.`);
    }
    const findings = normalizeFindings(audit.findings, `${path}.findings`);
    if (audit.disposition === 'verified' && findings.length !== 0) {
      throw new TypeError(`${path} verified disposition requires no findings.`);
    }
    if (audit.disposition !== 'verified' && findings.length === 0) {
      throw new TypeError(
        `${path} ${audit.disposition} disposition requires a finding.`
      );
    }
    const revision = normalizeRevision(
      audit.revision,
      audit,
      item,
      `${path}.revision`
    );
    auditIds.push(audit.auditId);
    auditedItemVersionIds.push(audit.auditedItemVersionId);
    return {
      ...copyJsonData(audit, path),
      findings,
      revision
    };
  });
  if (new Set(auditIds).size !== auditIds.length) {
    throw new TypeError('item-audit records must use unique auditId values.');
  }
  if (
    new Set(auditedItemVersionIds).size !== auditedItemVersionIds.length
  ) {
    throw new TypeError(
      'item-audit records must audit each item version exactly once.'
    );
  }
  const revisions = normalized
    .map(({ revision }) => revision)
    .filter(Boolean);
  const revisionTargetIds = revisions.map(({ toItemVersionId }) => (
    toItemVersionId
  ));
  if (new Set(revisionTargetIds).size !== revisionTargetIds.length) {
    throw new TypeError(
      'item-audit revisions must use unique target item-version IDs.'
    );
  }
  if (revisionTargetIds.some((itemVersionId) => (
    itemsByVersionId.has(itemVersionId)
  ))) {
    throw new TypeError(
      'item-audit revision targets must not alias audited item versions.'
    );
  }
  const declaredVersionCoordinates = new Set(
    [...itemsByVersionId.values()].map(({ itemId, versionNumber }) => (
      encodeItemVersionCoordinate(itemId, versionNumber)
    ))
  );
  if (revisions.some((revision) => (
    declaredVersionCoordinates.has(encodeItemVersionCoordinate(
      revision.itemId,
      revision.toVersionNumber
    ))
  ))) {
    throw new TypeError(
      'item-audit revision targets must not fork an existing itemId/versionNumber coordinate.'
    );
  }
  return normalized;
};

const deriveAuditResult = (item, audit) => {
  const common = {
    itemId: item.itemId,
    auditedItemVersionId: item.itemVersionId,
    auditedVersionNumber: item.versionNumber,
    itemArtifactRef: item.itemArtifactRef,
    itemArtifactSha256: item.itemArtifactSha256,
    statusHistoryRef: item.statusHistoryRef,
    statusHistorySha256: item.statusHistorySha256,
    auditId: audit.auditId,
    auditorIdentity: audit.auditorIdentity,
    auditCompletedAt: audit.auditCompletedAt,
    auditArtifactRef: audit.auditArtifactRef,
    auditArtifactSha256: audit.auditArtifactSha256,
    disposition: audit.disposition,
    dispositionEvidenceRef: audit.dispositionEvidenceRef,
    dispositionEvidenceSha256: audit.dispositionEvidenceSha256,
    findings: audit.findings,
    sourceAuditSha256: sha256CanonicalJson(audit)
  };
  if (audit.disposition === 'revised') {
    return {
      ...common,
      claimBearingTreatment:
        'old-and-new-versions-require-dual-version-score-republication',
      versionTransition: {
        fromItemVersionId: audit.revision.fromItemVersionId,
        toItemVersionId: audit.revision.toItemVersionId,
        toVersionNumber: audit.revision.toVersionNumber,
        revisedItemArtifactRef: audit.revision.revisedItemArtifactRef,
        revisedItemArtifactSha256:
          audit.revision.revisedItemArtifactSha256,
        affectedScoreSetRef: audit.revision.affectedScoreSetRef,
        affectedScoreSetSha256: audit.revision.affectedScoreSetSha256,
        dualVersionRepublicationPlanRef:
          audit.revision.dualVersionRepublicationPlanRef,
        dualVersionRepublicationPlanSha256:
          audit.revision.dualVersionRepublicationPlanSha256
      }
    };
  }
  return {
    ...common,
    claimBearingTreatment: audit.disposition === 'documented-uncertain'
      ? 'excluded-from-claim-bearing-scores-until-resolved'
      : 'no-item-audit-exclusion-no-release-authorization',
    versionTransition: null
  };
};

export const createItemAuditReceipt = ({ plan, items, audits }) => {
  const planCopy = copyJsonData(plan, 'item-audit plan');
  validatePlan(planCopy);
  const normalizedItems = normalizeItems(items);
  const itemsByVersionId = new Map(normalizedItems.map((item) => [
    item.itemVersionId,
    item
  ]));
  const normalizedAudits = normalizeAudits(audits, itemsByVersionId);
  if (sha256CanonicalJson(normalizedItems) !== planCopy.itemSetSha256) {
    throw new TypeError('item-audit items do not match their declared SHA-256.');
  }
  if (sha256CanonicalJson(normalizedAudits) !== planCopy.auditSetSha256) {
    throw new TypeError(
      'item-audit records do not match their declared SHA-256.'
    );
  }
  const itemVersionIds = normalizedItems.map(({ itemVersionId }) => (
    itemVersionId
  ));
  const auditedItemVersionIds = normalizedAudits.map(
    ({ auditedItemVersionId }) => auditedItemVersionId
  );
  if (!sameTextSet(planCopy.targetItemVersionIds, itemVersionIds)) {
    throw new TypeError(
      'item-audit targetItemVersionIds must exactly cover items.'
    );
  }
  if (!sameTextSet(planCopy.targetItemVersionIds, auditedItemVersionIds)) {
    throw new TypeError(
      'item-audit records must exactly cover targetItemVersionIds.'
    );
  }
  const auditsByItemVersionId = new Map(normalizedAudits.map((audit) => [
    audit.auditedItemVersionId,
    audit
  ]));
  const itemAuditResults = planCopy.targetItemVersionIds.map(
    (itemVersionId) => deriveAuditResult(
      itemsByVersionId.get(itemVersionId),
      auditsByItemVersionId.get(itemVersionId)
    )
  );
  const body = {
    schemaVersion: 1,
    plan: planCopy,
    itemSetSha256: sha256CanonicalJson(normalizedItems),
    auditSetSha256: sha256CanonicalJson(normalizedAudits),
    itemCount: normalizedItems.length,
    dispositionCounts: Object.fromEntries(
      ITEM_AUDIT_DISPOSITIONS.map((disposition) => [
        disposition,
        itemAuditResults.filter((result) => (
          result.disposition === disposition
        )).length
      ])
    ),
    itemAuditResults
  };
  return freezeJsonData({
    ...body,
    receiptSha256: sha256CanonicalJson(body)
  });
};
