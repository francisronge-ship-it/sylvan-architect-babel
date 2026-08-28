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
import { createModelRegistry } from './modelRegistry.js';
import {
  createAdmissionProbeReceipt,
  verifyAdmissionProbeReceipt
} from './admissionProbe.js';

const MANIFEST_FIELDS = Object.freeze([
  'releaseId',
  'manifestVersion',
  'suiteVersion',
  'contractHashes',
  'engineVersion',
  'runWindow',
  'policyVersion',
  'selectionAuthority',
  'selections',
  'amendmentRefs'
]);

const DRAFT_FIELDS = Object.freeze([
  'lifecycle',
  ...MANIFEST_FIELDS,
  'registrySnapshot',
  'admissionProbeSnapshot'
]);

const FROZEN_FIELDS = Object.freeze([
  ...DRAFT_FIELDS,
  'launchAuthorization',
  'manifestSha256'
]);

const LAUNCH_AUTHORIZATION_FIELDS = Object.freeze([
  'authorizationRef',
  'authorizationEvidenceSha256',
  'authorizedDraftSha256',
  'authorizedAt',
  'authorizedBy'
]);

const SELECTION_FIELDS = Object.freeze([
  'registryId',
  'hostRoutes',
  'tierCoverage',
  'requestParameters',
  'admissionProbeRef'
]);

const sha256CanonicalJson = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalizeJsonData(value)))
  .digest('hex');

const assertDigest = (value, path) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest.`);
  }
};

const pickFields = (value, fields) => Object.fromEntries(
  fields.map((field) => [field, value[field]])
);

const validateLaunchAuthorization = ({
  launchAuthorization,
  draftSha256
}) => {
  assertExactFields(
    launchAuthorization,
    LAUNCH_AUTHORIZATION_FIELDS,
    'launch authorization'
  );
  for (const field of ['authorizationRef', 'authorizedAt', 'authorizedBy']) {
    assertNonemptyText(
      launchAuthorization[field],
      `launch authorization.${field}`
    );
  }
  assertDigest(
    launchAuthorization.authorizationEvidenceSha256,
    'launch authorization.authorizationEvidenceSha256'
  );
  assertDigest(
    launchAuthorization.authorizedDraftSha256,
    'launch authorization.authorizedDraftSha256'
  );
  if (launchAuthorization.authorizedDraftSha256 !== draftSha256) {
    throw new TypeError(
      'launch authorization.authorizedDraftSha256 must match the canonical release manifest draft.'
    );
  }
};

const validateSelection = ({
  selection,
  registryById,
  probeById
}, index) => {
  const path = `release manifest.selections[${index}]`;
  assertExactFields(selection, SELECTION_FIELDS, path);
  assertNonemptyText(selection.registryId, `${path}.registryId`);
  assertUniqueTextArray(selection.hostRoutes, `${path}.hostRoutes`);
  assertJsonRecord(selection.requestParameters, `${path}.requestParameters`);
  assertNonemptyText(selection.admissionProbeRef, `${path}.admissionProbeRef`);

  const registryEntry = registryById.get(selection.registryId);
  if (!registryEntry) {
    throw new TypeError(`${path}.registryId must reference a supplied registry entry.`);
  }
  if (registryEntry.status !== 'active') {
    throw new TypeError(`${path}.registryId must reference an active registry entry.`);
  }
  selection.hostRoutes.forEach((hostRoute) => {
    if (!registryEntry.hostRoutes.includes(hostRoute)) {
      throw new TypeError(`${path}.hostRoutes contains an undeclared host route.`);
    }
  });

  assertExactFields(
    selection.tierCoverage,
    ['scope', 'requiredNativeReasoningTiers', 'scopeStatement'],
    `${path}.tierCoverage`
  );
  assertTextChoice(
    selection.tierCoverage.scope,
    ['full-characterization', 'tier-subset'],
    `${path}.tierCoverage.scope`
  );
  assertUniqueTextArray(
    selection.tierCoverage.requiredNativeReasoningTiers,
    `${path}.tierCoverage.requiredNativeReasoningTiers`
  );
  assertNonemptyText(
    selection.tierCoverage.scopeStatement,
    `${path}.tierCoverage.scopeStatement`
  );
  selection.tierCoverage.requiredNativeReasoningTiers.forEach((tier) => {
    if (!registryEntry.nativeReasoningTiers.includes(tier)) {
      throw new TypeError(
        `${path}.tierCoverage references a tier absent from the supplied registry entry.`
      );
    }
  });
  if (
    selection.tierCoverage.scope === 'full-characterization'
    && !sameTextSet(
      selection.tierCoverage.requiredNativeReasoningTiers,
      registryEntry.nativeReasoningTiers
    )
  ) {
    throw new TypeError(
      `${path}.tierCoverage full-characterization must include every recorded native tier.`
    );
  }

  const receipt = probeById.get(selection.admissionProbeRef);
  if (!receipt) {
    throw new TypeError(`${path}.admissionProbeRef must reference a supplied receipt.`);
  }
  const verification = verifyAdmissionProbeReceipt({ registryEntry, receipt });
  if (verification.status !== 'confirmed') {
    throw new TypeError(
      `${path}.admissionProbeRef has registry mismatches=[${verification.mismatches.join(',')}].`
    );
  }
};

export const buildReleaseManifest = ({
  manifest,
  registryEntries,
  admissionProbeReceipts
}) => {
  assertExactFields(manifest, MANIFEST_FIELDS, 'release manifest');
  [
    'releaseId',
    'manifestVersion',
    'suiteVersion',
    'engineVersion',
    'runWindow',
    'policyVersion'
  ].forEach((field) => {
    assertNonemptyText(manifest[field], `release manifest.${field}`);
  });
  assertJsonRecord(
    manifest.contractHashes,
    'release manifest.contractHashes'
  );
  const contractHashes = manifest.contractHashes;
  if (Object.keys(contractHashes).length === 0) {
    throw new TypeError('release manifest.contractHashes must not be empty.');
  }
  Object.entries(contractHashes).forEach(([name, hash]) => {
    assertNonemptyText(hash, `release manifest.contractHashes.${name}`);
  });
  assertExactFields(
    manifest.selectionAuthority,
    ['authorityRef', 'selectedAt', 'selectionEvidenceRef'],
    'release manifest.selectionAuthority'
  );
  Object.entries(manifest.selectionAuthority).forEach(([field, value]) => {
    assertNonemptyText(value, `release manifest.selectionAuthority.${field}`);
  });
  if (!Array.isArray(manifest.selections) || manifest.selections.length === 0) {
    throw new TypeError('release manifest.selections must be a non-empty array.');
  }
  assertUniqueTextArray(
    manifest.amendmentRefs,
    'release manifest.amendmentRefs',
    { allowEmpty: true }
  );

  const registry = createModelRegistry(registryEntries);
  const registryById = new Map(registry.map((entry) => [entry.registryId, entry]));
  if (!Array.isArray(admissionProbeReceipts)) {
    throw new TypeError('admission probe receipts must be an array.');
  }
  const receipts = admissionProbeReceipts.map(createAdmissionProbeReceipt);
  const probeById = new Map(receipts.map((receipt) => [receipt.probeId, receipt]));
  if (probeById.size !== receipts.length) {
    throw new TypeError('admission probe receipts must have unique probeId values.');
  }
  manifest.selections.forEach((selection, index) => validateSelection({
    selection,
    registryById,
    probeById
  }, index));
  const selectedRegistryIds = manifest.selections.map((selection) => selection.registryId);
  if (new Set(selectedRegistryIds).size !== selectedRegistryIds.length) {
    throw new TypeError('release manifest selections must have unique registryId values.');
  }
  if (!sameTextSet(selectedRegistryIds, registry.map((entry) => entry.registryId))) {
    throw new TypeError(
      'supplied registry entries must be exactly the externally selected registry IDs.'
    );
  }
  const selectedProbeIds = manifest.selections.map(
    (selection) => selection.admissionProbeRef
  );
  if (!sameTextSet(selectedProbeIds, receipts.map((receipt) => receipt.probeId))) {
    throw new TypeError(
      'supplied admission probe receipts must be exactly the selected probe references.'
    );
  }

  return freezeJsonData({
    lifecycle: 'draft',
    ...copyJsonData(manifest, 'release manifest'),
    registrySnapshot: selectedRegistryIds.map((registryId) => registryById.get(registryId)),
    admissionProbeSnapshot: selectedProbeIds.map((probeId) => probeById.get(probeId))
  });
};

const validateReleaseManifestDraft = (rawDraft) => {
  assertExactFields(rawDraft, DRAFT_FIELDS, 'release manifest draft');
  assertTextChoice(
    rawDraft.lifecycle,
    ['draft'],
    'release manifest draft.lifecycle'
  );
  const draft = copyJsonData(rawDraft, 'release manifest draft');
  const rebuilt = buildReleaseManifest({
    manifest: pickFields(draft, MANIFEST_FIELDS),
    registryEntries: draft.registrySnapshot,
    admissionProbeReceipts: draft.admissionProbeSnapshot
  });
  if (
    JSON.stringify(canonicalizeJsonData(rebuilt))
    !== JSON.stringify(canonicalizeJsonData(draft))
  ) {
    throw new TypeError(
      'release manifest draft does not match its evidence snapshots.'
    );
  }
  return rebuilt;
};

export const hashReleaseManifestDraft = (draft) => (
  sha256CanonicalJson(validateReleaseManifestDraft(draft))
);

export const freezeReleaseManifest = ({ draft, launchAuthorization }) => {
  const checkedDraft = validateReleaseManifestDraft(draft);
  const draftSha256 = sha256CanonicalJson(checkedDraft);
  validateLaunchAuthorization({
    launchAuthorization,
    draftSha256
  });
  const frozenBody = {
    ...copyJsonData(checkedDraft, 'release manifest draft'),
    lifecycle: 'frozen',
    launchAuthorization: copyJsonData(launchAuthorization, 'launch authorization')
  };
  return freezeJsonData({
    ...frozenBody,
    manifestSha256: sha256CanonicalJson(frozenBody)
  });
};

export const validateFrozenReleaseManifest = (manifest) => {
  assertExactFields(manifest, FROZEN_FIELDS, 'frozen release manifest');
  assertTextChoice(
    manifest.lifecycle,
    ['frozen'],
    'frozen release manifest.lifecycle'
  );
  assertDigest(
    manifest.manifestSha256,
    'frozen release manifest.manifestSha256'
  );
  const { manifestSha256, launchAuthorization, ...frozenDraft } = manifest;
  const checkedDraft = validateReleaseManifestDraft({
    ...frozenDraft,
    lifecycle: 'draft'
  });
  validateLaunchAuthorization({
    launchAuthorization,
    draftSha256: sha256CanonicalJson(checkedDraft)
  });
  const frozenBody = {
    ...copyJsonData(checkedDraft, 'release manifest draft'),
    lifecycle: 'frozen',
    launchAuthorization: copyJsonData(launchAuthorization, 'launch authorization')
  };
  if (sha256CanonicalJson(frozenBody) !== manifestSha256) {
    throw new TypeError('frozen release manifest hash does not match its content.');
  }
  return freezeJsonData(copyJsonData(manifest, 'frozen release manifest'));
};
