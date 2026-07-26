import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildReleaseManifest,
  freezeReleaseManifest,
  hashReleaseManifestDraft,
  validateFrozenReleaseManifest
} from './index.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => sha256(Buffer.from(text, 'utf8'));
const registryEntry = {
  registryId: 'proof-selected-model',
  canonicalName: 'Proof External Model',
  lab: 'Proof External Lab',
  provider: 'Proof External Provider',
  version: {
    kind: 'immutable-snapshot',
    resolvedVersion: 'proof-model-version'
  },
  hostRoutes: ['proof-host'],
  api: {
    name: 'proof-api',
    version: 'proof-api-version'
  },
  officialDocumentation: {
    documentationRef: 'proof://documentation/model',
    retrievedAt: 'proof-retrieval-record',
    controlSet: ['proof-control']
  },
  nativeReasoningTiers: ['proof-native-tier'],
  documentedSamplingDefaults: { proof: true },
  limits: { proof: true },
  prices: { proof: true },
  transportCapabilities: ['proof-transport'],
  retentionNoTrainAvailability: { proof: true },
  status: 'active'
};
const admissionProbe = {
  probeId: 'proof-admission',
  registryId: registryEntry.registryId,
  documentationRef: registryEntry.officialDocumentation.documentationRef,
  retrievedAt: registryEntry.officialDocumentation.retrievedAt,
  observedVersion: registryEntry.version.resolvedVersion,
  observedControlSet: registryEntry.officialDocumentation.controlSet,
  observedNativeReasoningTiers: registryEntry.nativeReasoningTiers,
  observedSamplingDefaults: registryEntry.documentedSamplingDefaults,
  observedLimits: registryEntry.limits,
  observedTransportCapabilities: registryEntry.transportCapabilities,
  technicalAvailability: {
    status: 'available',
    evidenceRef: 'proof://admission/availability'
  },
  provenance: { proof: true }
};
const draft = buildReleaseManifest({
  manifest: {
    releaseId: 'proof-release',
    manifestVersion: 'proof-manifest-version',
    suiteVersion: 'proof-suite-version',
    contractHashes: {
      prompt: digest('proof-prompt'),
      contract: digest('proof-contract')
    },
    engineVersion: 'proof-engine-version',
    runWindow: 'proof-run-window',
    policyVersion: 'proof-policy-version',
    selectionAuthority: {
      authorityRef: 'proof://authority/selection',
      selectedAt: 'proof-selection-record',
      selectionEvidenceRef: 'proof://evidence/selection'
    },
    selections: [{
      registryId: registryEntry.registryId,
      hostRoutes: registryEntry.hostRoutes,
      tierCoverage: {
        scope: 'full-characterization',
        requiredNativeReasoningTiers: registryEntry.nativeReasoningTiers,
        scopeStatement: 'proof externally declared scope'
      },
      requestParameters: { proof: true },
      admissionProbeRef: admissionProbe.probeId
    }],
    amendmentRefs: []
  },
  registryEntries: [registryEntry],
  admissionProbeReceipts: [admissionProbe]
});
const draftSha256 = hashReleaseManifestDraft(draft);
const launchAuthorization = {
  authorizationRef: 'proof://authority/launch',
  authorizationEvidenceSha256: digest('proof-launch-authorization-evidence'),
  authorizedDraftSha256: draftSha256,
  authorizedAt: 'proof-launch-record',
  authorizedBy: 'proof-external-authority'
};
const execute = () => validateFrozenReleaseManifest(
  freezeReleaseManifest({
    draft,
    launchAuthorization
  })
);
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('manifest launch-integrity proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `manifest launch-integrity proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureManifestLaunchProof.mjs',
  'bench/captureReleaseBundleProof.mjs',
  'bench/index.js',
  'bench/releaseManifest.js',
  'tests/benchmarkManifestRegistry.test.mjs',
  'tests/benchmarkReleaseBundle.test.mjs',
  'tests/benchmarkRunnerPlanning.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W14c-manifest-launch-integrity',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  draftSha256,
  authorizationEvidenceSha256:
    launchAuthorization.authorizationEvidenceSha256,
  manifestSha256: first.manifestSha256,
  manifest: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  draftSha256,
  authorizationEvidenceSha256:
    launchAuthorization.authorizationEvidenceSha256,
  manifestSha256: first.manifestSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
