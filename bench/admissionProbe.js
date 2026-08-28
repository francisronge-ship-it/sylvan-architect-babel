import { canonicalizeJsonData, copyJsonData, freezeJsonData } from './jsonData.js';
import {
  assertExactFields,
  assertJsonRecord,
  assertNonemptyText,
  assertTextChoice,
  assertUniqueTextArray,
  sameTextSet
} from './benchmarkValidation.js';
import {
  createModelRegistryEntry,
  getRegistryResolvedVersion
} from './modelRegistry.js';

const RECEIPT_FIELDS = Object.freeze([
  'probeId',
  'registryId',
  'documentationRef',
  'retrievedAt',
  'observedVersion',
  'observedControlSet',
  'observedNativeReasoningTiers',
  'observedSamplingDefaults',
  'observedLimits',
  'observedTransportCapabilities',
  'technicalAvailability',
  'provenance'
]);

const equalJson = (left, right) => (
  JSON.stringify(canonicalizeJsonData(left))
  === JSON.stringify(canonicalizeJsonData(right))
);

export const createAdmissionProbeReceipt = (input) => {
  assertExactFields(input, RECEIPT_FIELDS, 'admission probe receipt');
  [
    'probeId',
    'registryId',
    'documentationRef',
    'retrievedAt',
    'observedVersion'
  ].forEach((field) => {
    assertNonemptyText(input[field], `admission probe receipt.${field}`);
  });
  assertUniqueTextArray(
    input.observedControlSet,
    'admission probe receipt.observedControlSet',
    { allowEmpty: true }
  );
  assertUniqueTextArray(
    input.observedNativeReasoningTiers,
    'admission probe receipt.observedNativeReasoningTiers'
  );
  assertJsonRecord(
    input.observedSamplingDefaults,
    'admission probe receipt.observedSamplingDefaults'
  );
  assertJsonRecord(input.observedLimits, 'admission probe receipt.observedLimits');
  assertUniqueTextArray(
    input.observedTransportCapabilities,
    'admission probe receipt.observedTransportCapabilities',
    { allowEmpty: true }
  );
  assertExactFields(
    input.technicalAvailability,
    ['status', 'evidenceRef'],
    'admission probe receipt.technicalAvailability'
  );
  assertTextChoice(
    input.technicalAvailability.status,
    ['available', 'unavailable'],
    'admission probe receipt.technicalAvailability.status'
  );
  assertNonemptyText(
    input.technicalAvailability.evidenceRef,
    'admission probe receipt.technicalAvailability.evidenceRef'
  );
  assertJsonRecord(input.provenance, 'admission probe receipt.provenance');

  return freezeJsonData(copyJsonData(input, 'admission probe receipt'));
};

export const verifyAdmissionProbeReceipt = ({ registryEntry, receipt }) => {
  const checkedRegistryEntry = createModelRegistryEntry(registryEntry);
  const checkedReceipt = createAdmissionProbeReceipt(receipt);
  const mismatches = [];
  const expectEqual = (matches, field) => {
    if (!matches) mismatches.push(field);
  };

  expectEqual(
    checkedReceipt.registryId === checkedRegistryEntry.registryId,
    'registryId'
  );
  expectEqual(
    checkedReceipt.documentationRef
      === checkedRegistryEntry.officialDocumentation.documentationRef,
    'documentationRef'
  );
  expectEqual(
    checkedReceipt.retrievedAt
      === checkedRegistryEntry.officialDocumentation.retrievedAt,
    'retrievedAt'
  );
  expectEqual(
    checkedReceipt.observedVersion === getRegistryResolvedVersion(checkedRegistryEntry),
    'observedVersion'
  );
  expectEqual(
    sameTextSet(
      checkedReceipt.observedControlSet,
      checkedRegistryEntry.officialDocumentation.controlSet
    ),
    'observedControlSet'
  );
  expectEqual(
    sameTextSet(
      checkedReceipt.observedNativeReasoningTiers,
      checkedRegistryEntry.nativeReasoningTiers
    ),
    'observedNativeReasoningTiers'
  );
  expectEqual(
    equalJson(
      checkedReceipt.observedSamplingDefaults,
      checkedRegistryEntry.documentedSamplingDefaults
    ),
    'observedSamplingDefaults'
  );
  expectEqual(
    equalJson(checkedReceipt.observedLimits, checkedRegistryEntry.limits),
    'observedLimits'
  );
  expectEqual(
    sameTextSet(
      checkedReceipt.observedTransportCapabilities,
      checkedRegistryEntry.transportCapabilities
    ),
    'observedTransportCapabilities'
  );

  return freezeJsonData({
    probeId: checkedReceipt.probeId,
    registryId: checkedReceipt.registryId,
    status: mismatches.length === 0 ? 'confirmed' : 'mismatch',
    mismatches
  });
};
