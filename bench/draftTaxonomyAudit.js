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
import { createDraftItemSetReceipt } from './draftItems.js';

export const DRAFT_TAXONOMY_AUDIT_OUTCOMES = Object.freeze([
  'no-findings-recorded',
  'findings-recorded'
]);

const PLAN_FIELDS = Object.freeze([
  'auditSetId',
  'draftReceiptSha256',
  'taxonomyCatalogRef',
  'taxonomyCatalogSha256',
  'auditRecordSourceSha256',
  'auditIdentity',
  'lifecycleIdentity',
  'provenance'
]);

const AUDIT_FIELDS = Object.freeze([
  'itemVersionId',
  'draftReceiptSha256',
  'taxonomyCatalogRef',
  'taxonomyCatalogSha256',
  'auditorRefs',
  'auditedAt',
  'auditRef',
  'auditSha256',
  'outcome',
  'findingRefs'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  auditIdentity: 'bm5-external-taxonomy-audit-evidence-only',
  lifecycleIdentity:
    'draft-remains-draft-no-review-promotion-activation-scoring-or-release'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
};

const canonicalJsonEqual = (left, right) => (
  JSON.stringify(canonicalizeJsonData(left))
  === JSON.stringify(canonicalizeJsonData(right))
);

export const hashDraftTaxonomyAuditData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'draft-taxonomy-audit hash input'))
);

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'draft-taxonomy-audit plan');
  assertExactFields(plan, PLAN_FIELDS, 'draft-taxonomy-audit plan');
  assertNonemptyText(
    plan.auditSetId,
    'draft-taxonomy-audit plan.auditSetId'
  );
  assertSha256(
    plan.draftReceiptSha256,
    'draft-taxonomy-audit plan.draftReceiptSha256'
  );
  assertNonemptyText(
    plan.taxonomyCatalogRef,
    'draft-taxonomy-audit plan.taxonomyCatalogRef'
  );
  assertSha256(
    plan.taxonomyCatalogSha256,
    'draft-taxonomy-audit plan.taxonomyCatalogSha256'
  );
  assertSha256(
    plan.auditRecordSourceSha256,
    'draft-taxonomy-audit plan.auditRecordSourceSha256'
  );
  for (const [field, expected] of Object.entries(EXPECTED_IDENTITIES)) {
    if (plan[field] !== expected) {
      throw new TypeError(
        `draft-taxonomy-audit plan.${field} must be ${expected}.`
      );
    }
  }
  assertJsonRecord(
    plan.provenance,
    'draft-taxonomy-audit plan.provenance'
  );
  return plan;
};

const reconstructDraftReceipt = (rawReceipt) => {
  const receipt = copyJsonData(
    rawReceipt,
    'draft-taxonomy-audit draft receipt'
  );
  assertJsonRecord(receipt, 'draft-taxonomy-audit draft receipt');
  const rebuilt = createDraftItemSetReceipt({
    plan: {
      draftSetId: receipt.draftSetId,
      itemSourceSha256: receipt.itemSourceSha256,
      checklistPolicyIdentity: receipt.checklistPolicyIdentity,
      taxonomyIdentity: receipt.taxonomyIdentity,
      lifecycleIdentity: receipt.lifecycleIdentity,
      provenance: receipt.provenance
    },
    items: receipt.items
  });
  if (!canonicalJsonEqual(rebuilt, receipt)) {
    throw new TypeError(
      'draft-taxonomy-audit draft receipt must reconstruct from its authored items.'
    );
  }
  return rebuilt;
};

const normalizeAudits = ({
  rawAudits,
  plan,
  draftReceipt
}) => {
  if (!Array.isArray(rawAudits)) {
    throw new TypeError('draft-taxonomy-audit records must be an array.');
  }
  const audits = rawAudits.map((rawAudit, index) => {
    const path = `draft-taxonomy-audit records[${index}]`;
    const audit = copyJsonData(rawAudit, path);
    assertExactFields(audit, AUDIT_FIELDS, path);
    assertNonemptyText(audit.itemVersionId, `${path}.itemVersionId`);
    assertSha256(audit.draftReceiptSha256, `${path}.draftReceiptSha256`);
    assertNonemptyText(audit.taxonomyCatalogRef, `${path}.taxonomyCatalogRef`);
    assertSha256(audit.taxonomyCatalogSha256, `${path}.taxonomyCatalogSha256`);
    assertUniqueTextArray(audit.auditorRefs, `${path}.auditorRefs`);
    assertNonemptyText(audit.auditedAt, `${path}.auditedAt`);
    assertNonemptyText(audit.auditRef, `${path}.auditRef`);
    assertSha256(audit.auditSha256, `${path}.auditSha256`);
    assertTextChoice(
      audit.outcome,
      DRAFT_TAXONOMY_AUDIT_OUTCOMES,
      `${path}.outcome`
    );
    assertUniqueTextArray(
      audit.findingRefs,
      `${path}.findingRefs`,
      { allowEmpty: true }
    );
    if (
      audit.outcome === 'no-findings-recorded'
      && audit.findingRefs.length > 0
    ) {
      throw new TypeError(
        `${path}.findingRefs must be empty for no-findings-recorded.`
      );
    }
    if (
      audit.outcome === 'findings-recorded'
      && audit.findingRefs.length === 0
    ) {
      throw new TypeError(
        `${path}.findingRefs must identify the recorded findings.`
      );
    }
    if (audit.draftReceiptSha256 !== plan.draftReceiptSha256) {
      throw new TypeError(
        `${path}.draftReceiptSha256 must match the audited draft receipt.`
      );
    }
    if (
      audit.taxonomyCatalogRef !== plan.taxonomyCatalogRef
      || audit.taxonomyCatalogSha256 !== plan.taxonomyCatalogSha256
    ) {
      throw new TypeError(
        `${path} taxonomy catalog must match the audit plan.`
      );
    }
    return audit;
  });

  if (
    hashDraftTaxonomyAuditData(audits)
    !== plan.auditRecordSourceSha256
  ) {
    throw new TypeError(
      'draft-taxonomy-audit records do not match their source SHA-256.'
    );
  }
  const auditedItemVersionIds = audits.map(({ itemVersionId }) => itemVersionId);
  assertUniqueTextArray(
    auditedItemVersionIds,
    'draft-taxonomy-audit itemVersionId values',
    { allowEmpty: true }
  );
  if (!sameTextSet(auditedItemVersionIds, draftReceipt.itemVersionIds)) {
    throw new TypeError(
      'draft-taxonomy-audit records must cover every draft item exactly once.'
    );
  }
  return audits;
};

export const createDraftTaxonomyAuditReceipt = ({
  plan: rawPlan,
  draftReceipt: rawDraftReceipt,
  audits: rawAudits
}) => {
  const plan = normalizePlan(rawPlan);
  const draftReceipt = reconstructDraftReceipt(rawDraftReceipt);
  if (draftReceipt.receiptSha256 !== plan.draftReceiptSha256) {
    throw new TypeError(
      'draft-taxonomy-audit draft receipt does not match the audit plan.'
    );
  }
  const audits = normalizeAudits({
    rawAudits,
    plan,
    draftReceipt
  });

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W14b-draft-taxonomy-audit-evidence',
    auditSetId: plan.auditSetId,
    draftSetId: draftReceipt.draftSetId,
    draftReceiptSha256: plan.draftReceiptSha256,
    taxonomyCatalogRef: plan.taxonomyCatalogRef,
    taxonomyCatalogSha256: plan.taxonomyCatalogSha256,
    auditRecordSourceSha256: plan.auditRecordSourceSha256,
    auditIdentity: plan.auditIdentity,
    lifecycleIdentity: plan.lifecycleIdentity,
    itemCount: draftReceipt.itemCount,
    auditedItemVersionIds: audits.map(({ itemVersionId }) => itemVersionId),
    audits,
    auditTreatment:
      'external-evidence-coverage-only-no-taxonomy-or-linguistic-judgment',
    lifecycleTreatment:
      'draft-remains-draft-not-reviewed-piloted-active-scored-or-release-authorized',
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
