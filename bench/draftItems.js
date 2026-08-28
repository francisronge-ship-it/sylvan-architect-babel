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

export const ITEM_NOVELTY_CLASSES = Object.freeze([
  'none',
  'nonce',
  'template-lexicalized',
  'conlang-specification',
  'minimal-mutation'
]);

export const CHECKLIST_OBLIGATION_CLASSES = Object.freeze([
  'stand-taking',
  'analysis-conditional',
  'register-compliance'
]);

const PLAN_FIELDS = Object.freeze([
  'draftSetId',
  'itemSourceSha256',
  'checklistPolicyIdentity',
  'taxonomyIdentity',
  'lifecycleIdentity',
  'provenance'
]);

const ITEM_FIELDS = Object.freeze([
  'itemVersionId',
  'itemId',
  'versionNumber',
  'lifecycle',
  'input',
  'language',
  'script',
  'frameworks',
  'phenomena',
  'noveltyClass',
  'conditionalChecklist',
  'familyDocumentation',
  'ambiguitySpec',
  'purposeFlags',
  'provenance'
]);

const INPUT_FIELDS = Object.freeze([
  'text',
  'textSha256'
]);

const PHENOMENA_FIELDS = Object.freeze([
  'primary',
  'secondary'
]);

const CHECKLIST_FIELDS = Object.freeze([
  'checkId',
  'obligationClass',
  'text',
  'registerIds'
]);

const FAMILY_DOCUMENTATION_FIELDS = Object.freeze([
  'familyId',
  'status',
  'normative',
  'documentRef',
  'documentSha256'
]);

const AMBIGUITY_FIELDS = Object.freeze([
  'mode',
  'specRef',
  'specSha256'
]);

const PURPOSE_FLAG_FIELDS = Object.freeze({
  foundational: Object.freeze(['kind']),
  control: Object.freeze([
    'kind',
    'targetItemVersionId',
    'factor'
  ]),
  calibration: Object.freeze([
    'kind',
    'baselineRef',
    'baselineSha256'
  ]),
  adversarial: Object.freeze(['kind'])
});

const PROVENANCE_FIELDS = Object.freeze([
  'authorRef',
  'authoredAt',
  'sourceArtifactRef',
  'sourceArtifactSha256'
]);

const EXPECTED_IDENTITIES = Object.freeze({
  checklistPolicyIdentity:
    'bm5-conditional-checklist-structural-lint-only',
  taxonomyIdentity:
    'bm5-content-axes-and-purpose-flags',
  lifecycleIdentity:
    'draft-only-no-review-activation-scoring-or-release'
});

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const sha256Text = (value) => createHash('sha256')
  .update(value, 'utf8')
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

const assertArray = (value, path) => {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array.`);
  }
};

const assertUniqueCanonicalValues = (values, path) => {
  const keys = values.map((value) => sha256CanonicalJson(value));
  if (new Set(keys).size !== keys.length) {
    throw new TypeError(`${path} must not contain substantive duplicates.`);
  }
};

export const hashDraftItemData = (value) => (
  sha256CanonicalJson(copyJsonData(value, 'draft-item hash input'))
);

const normalizePlan = (rawPlan) => {
  const plan = copyJsonData(rawPlan, 'draft-item plan');
  assertExactFields(plan, PLAN_FIELDS, 'draft-item plan');
  assertNonemptyText(plan.draftSetId, 'draft-item plan.draftSetId');
  assertSha256(plan.itemSourceSha256, 'draft-item plan.itemSourceSha256');
  for (const [field, expected] of Object.entries(EXPECTED_IDENTITIES)) {
    if (plan[field] !== expected) {
      throw new TypeError(`draft-item plan.${field} must be ${expected}.`);
    }
  }
  assertJsonRecord(plan.provenance, 'draft-item plan.provenance');
  return plan;
};

const normalizeChecklist = (rawChecklist, itemPath) => {
  const path = `${itemPath}.conditionalChecklist`;
  assertArray(rawChecklist, path);
  if (rawChecklist.length === 0) {
    throw new TypeError(`${path} must contain at least one entry.`);
  }
  const checklist = rawChecklist.map((rawEntry, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = copyJsonData(rawEntry, entryPath);
    assertExactFields(entry, CHECKLIST_FIELDS, entryPath);
    assertNonemptyText(entry.checkId, `${entryPath}.checkId`);
    assertTextChoice(
      entry.obligationClass,
      CHECKLIST_OBLIGATION_CLASSES,
      `${entryPath}.obligationClass`
    );
    assertNonemptyText(entry.text, `${entryPath}.text`);
    assertUniqueTextArray(
      entry.registerIds,
      `${entryPath}.registerIds`,
      { allowEmpty: true }
    );
    if (
      entry.obligationClass === 'register-compliance'
      && entry.registerIds.length === 0
    ) {
      throw new TypeError(
        `${entryPath}.registerIds must identify the stated register obligation.`
      );
    }
    if (
      entry.obligationClass !== 'register-compliance'
      && entry.registerIds.length > 0
    ) {
      throw new TypeError(
        `${entryPath}.registerIds are allowed only for register-compliance.`
      );
    }
    return entry;
  });
  assertUniqueTextArray(
    checklist.map(({ checkId }) => checkId),
    `${path} check IDs`
  );
  assertUniqueCanonicalValues(
    checklist.map(({ checkId: _checkId, ...definition }) => definition),
    `${path} substantive entries`
  );
  return checklist;
};

const normalizeFamilyDocumentation = (rawDocumentation, itemPath) => {
  const path = `${itemPath}.familyDocumentation`;
  assertArray(rawDocumentation, path);
  const documentation = rawDocumentation.map((rawEntry, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = copyJsonData(rawEntry, entryPath);
    assertExactFields(entry, FAMILY_DOCUMENTATION_FIELDS, entryPath);
    assertNonemptyText(entry.familyId, `${entryPath}.familyId`);
    assertTextChoice(entry.status, ['draft'], `${entryPath}.status`);
    if (entry.normative !== false) {
      throw new TypeError(`${entryPath}.normative must be false.`);
    }
    assertNonemptyText(entry.documentRef, `${entryPath}.documentRef`);
    assertSha256(entry.documentSha256, `${entryPath}.documentSha256`);
    return entry;
  });
  assertUniqueCanonicalValues(documentation, path);
  return documentation;
};

const normalizePurposeFlags = (rawFlags, itemPath, itemVersionId) => {
  const path = `${itemPath}.purposeFlags`;
  assertArray(rawFlags, path);
  const flags = rawFlags.map((rawFlag, index) => {
    const flagPath = `${path}[${index}]`;
    const flag = copyJsonData(rawFlag, flagPath);
    assertJsonRecord(flag, flagPath);
    assertTextChoice(
      flag.kind,
      Object.keys(PURPOSE_FLAG_FIELDS),
      `${flagPath}.kind`
    );
    assertExactFields(flag, PURPOSE_FLAG_FIELDS[flag.kind], flagPath);
    if (flag.kind === 'control') {
      assertNonemptyText(
        flag.targetItemVersionId,
        `${flagPath}.targetItemVersionId`
      );
      if (flag.targetItemVersionId === itemVersionId) {
        throw new TypeError(
          `${flagPath}.targetItemVersionId must identify a different item version.`
        );
      }
      assertNonemptyText(flag.factor, `${flagPath}.factor`);
    }
    if (flag.kind === 'calibration') {
      assertNonemptyText(flag.baselineRef, `${flagPath}.baselineRef`);
      assertSha256(flag.baselineSha256, `${flagPath}.baselineSha256`);
    }
    return flag;
  });
  assertUniqueCanonicalValues(flags, path);
  return flags;
};

const normalizeItem = (rawItem, index) => {
  const path = `draft-item items[${index}]`;
  const item = copyJsonData(rawItem, path);
  assertExactFields(item, ITEM_FIELDS, path);
  assertNonemptyText(item.itemVersionId, `${path}.itemVersionId`);
  assertNonemptyText(item.itemId, `${path}.itemId`);
  assertPositiveInteger(item.versionNumber, `${path}.versionNumber`);
  assertTextChoice(item.lifecycle, ['draft'], `${path}.lifecycle`);

  assertExactFields(item.input, INPUT_FIELDS, `${path}.input`);
  assertNonemptyText(item.input.text, `${path}.input.text`);
  assertSha256(item.input.textSha256, `${path}.input.textSha256`);
  if (sha256Text(item.input.text) !== item.input.textSha256) {
    throw new TypeError(`${path}.input.textSha256 must hash the exact UTF-8 text.`);
  }

  assertNonemptyText(item.language, `${path}.language`);
  assertNonemptyText(item.script, `${path}.script`);
  assertUniqueTextArray(item.frameworks, `${path}.frameworks`);
  assertExactFields(item.phenomena, PHENOMENA_FIELDS, `${path}.phenomena`);
  assertNonemptyText(item.phenomena.primary, `${path}.phenomena.primary`);
  assertUniqueTextArray(
    item.phenomena.secondary,
    `${path}.phenomena.secondary`,
    { allowEmpty: true }
  );
  if (item.phenomena.secondary.includes(item.phenomena.primary)) {
    throw new TypeError(
      `${path}.phenomena.secondary must not repeat the primary phenomenon.`
    );
  }
  assertTextChoice(
    item.noveltyClass,
    ITEM_NOVELTY_CLASSES,
    `${path}.noveltyClass`
  );
  item.conditionalChecklist = normalizeChecklist(
    item.conditionalChecklist,
    path
  );
  item.familyDocumentation = normalizeFamilyDocumentation(
    item.familyDocumentation,
    path
  );

  assertExactFields(item.ambiguitySpec, AMBIGUITY_FIELDS, `${path}.ambiguitySpec`);
  assertTextChoice(
    item.ambiguitySpec.mode,
    ['single-adequate-analysis', 'enumeration-sub-suite'],
    `${path}.ambiguitySpec.mode`
  );
  assertNonemptyText(item.ambiguitySpec.specRef, `${path}.ambiguitySpec.specRef`);
  assertSha256(item.ambiguitySpec.specSha256, `${path}.ambiguitySpec.specSha256`);
  item.purposeFlags = normalizePurposeFlags(
    item.purposeFlags,
    path,
    item.itemVersionId
  );

  assertExactFields(item.provenance, PROVENANCE_FIELDS, `${path}.provenance`);
  for (const field of ['authorRef', 'authoredAt', 'sourceArtifactRef']) {
    assertNonemptyText(item.provenance[field], `${path}.provenance.${field}`);
  }
  assertSha256(
    item.provenance.sourceArtifactSha256,
    `${path}.provenance.sourceArtifactSha256`
  );
  return item;
};

export const createDraftItemSetReceipt = ({
  plan: rawPlan,
  items: rawItems
}) => {
  const plan = normalizePlan(rawPlan);
  assertArray(rawItems, 'draft-item items');
  const items = rawItems.map(normalizeItem);
  if (hashDraftItemData(items) !== plan.itemSourceSha256) {
    throw new TypeError('draft-item items do not match their source SHA-256.');
  }

  assertUniqueTextArray(
    items.map(({ itemVersionId }) => itemVersionId),
    'draft-item itemVersionId values',
    { allowEmpty: true }
  );
  const coordinates = items.map(({ itemId, versionNumber }) => (
    JSON.stringify([itemId, versionNumber])
  ));
  assertUniqueTextArray(
    coordinates,
    'draft-item itemId/versionNumber coordinates',
    { allowEmpty: true }
  );
  assertUniqueCanonicalValues(
    items.map(({
      itemVersionId: _itemVersionId,
      itemId: _itemId,
      versionNumber: _versionNumber,
      provenance: _provenance,
      ...definition
    }) => definition),
    'draft-item substantive definitions'
  );

  const receiptWithoutHash = {
    schemaVersion: 1,
    packageId: 'W14a-draft-item-structural-lint',
    draftSetId: plan.draftSetId,
    itemSourceSha256: plan.itemSourceSha256,
    checklistPolicyIdentity: plan.checklistPolicyIdentity,
    taxonomyIdentity: plan.taxonomyIdentity,
    lifecycleIdentity: plan.lifecycleIdentity,
    itemCount: items.length,
    itemVersionIds: items.map(({ itemVersionId }) => itemVersionId),
    items,
    lintTreatment:
      'structural-only-no-linguistic-validity-taxonomy-review-or-activation',
    lifecycleTreatment:
      'draft-not-reviewed-piloted-active-scored-or-release-authorized',
    provenance: plan.provenance
  };
  return freezeJsonData({
    ...receiptWithoutHash,
    receiptSha256: sha256CanonicalJson(receiptWithoutHash)
  });
};
