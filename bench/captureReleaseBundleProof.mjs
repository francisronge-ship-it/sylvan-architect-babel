import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  BM13_D3_PRECONDITION_IDS,
  buildReleaseManifest,
  createReleaseBundleReceipt,
  createReportStarSchemaReceipt,
  freezeReleaseManifest,
  hashReleaseManifestDraft,
  hashReleaseBundleData,
  hashReportStarSchemaData,
  REPORT_TABLE_NAMES
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
const digest = (text) => hashReleaseBundleData({ text });
const releaseId = 'proof-release-d3';
const registryEntry = {
  registryId: 'proof-model',
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
    documentationRef: 'https://example.invalid/proof-model',
    retrievedAt: 'proof-retrieval-record',
    controlSet: ['proof-control']
  },
  nativeReasoningTiers: ['proof-tier'],
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
const contractHashes = {
  prompt: digest('proof-prompt-contract'),
  parser: digest('proof-parser-contract')
};
const manifestInput = {
  releaseId,
  manifestVersion: 'proof-manifest-version',
  suiteVersion: 'proof-suite-version',
  contractHashes,
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
};
const manifestDraft = buildReleaseManifest({
  manifest: manifestInput,
  registryEntries: [registryEntry],
  admissionProbeReceipts: [admissionProbe]
});
const frozenManifest = freezeReleaseManifest({
  draft: manifestDraft,
  launchAuthorization: {
    authorizationRef: 'proof://authority/launch',
    authorizationEvidenceSha256:
      digest('proof-launch-authorization-evidence'),
    authorizedDraftSha256: hashReleaseManifestDraft(manifestDraft),
    authorizedAt: 'proof-launch-record',
    authorizedBy: 'proof-external-authority'
  }
});
const model = {
  registryId: registryEntry.registryId,
  name: registryEntry.canonicalName,
  lab: registryEntry.lab,
  manifestRef: 'proof://manifest/model'
};
const condition = {
  id: 'proof-condition',
  releaseId,
  modelId: model.registryId,
  resolvedVersion: registryEntry.version.resolvedVersion,
  aliasWindow: null,
  host: registryEntry.hostRoutes[0],
  tier: registryEntry.nativeReasoningTiers[0],
  framework: 'proof-framework',
  sentParams: { proof: true },
  carrier: 'proof-carrier'
};
const itemVersion = {
  itemVersionId: 'proof-item-v1',
  itemId: 'proof-item',
  vN: 1,
  contentAxes: { proof: true },
  flags: [],
  statusHistory: [],
  dispositions: []
};
const run = {
  id: 'proof-run',
  conditionId: condition.id,
  itemVersionId: itemVersion.itemVersionId,
  outcomeClass: 'proof-outcome',
  subCause: null,
  partition: 'native',
  finishReason: 'proof-finish',
  tokens: {
    inUncached: 1,
    inCached: 0,
    out: 1,
    reasoning: 0
  },
  latencyMs: 1,
  costUSD: 0,
  rawHash: digest('proof-raw-output'),
  bundleRef: 'proof://run/bundle'
};
const score = {
  estimandId: 'proof-estimand',
  conditionScope: [condition.id],
  value: 0.5,
  ciLow: 0.1,
  ciHigh: 0.9,
  method: 'proof-external-method',
  clusterSpec: { proof: true },
  multiplicityFamily: null
};
const tables = {
  Release: [{
    id: releaseId,
    suiteVer: manifestInput.suiteVersion,
    contractHashes,
    engineVer: manifestInput.engineVersion,
    window: manifestInput.runWindow,
    policyVer: manifestInput.policyVersion
  }],
  Model: [model],
  Condition: [condition],
  ItemVersion: [itemVersion],
  Run: [run],
  Judgment: [{
    runId: run.id,
    reviewerId: 'proof-reviewer',
    dimension: 'proof-dimension',
    value: 'proof-value',
    rubricVer: 'proof-rubric',
    adjudicated: false,
    blindingRecord: { ref: 'proof://blinding/run' }
  }],
  Score: [score],
  Correction: []
};
const reportReceipt = createReportStarSchemaReceipt({
  plan: {
    reportDatasetId: 'proof-report-dataset',
    schemaIdentity: 'bm12-eight-table-star-schema',
    rawDerivedIdentity:
      'raw-facts-and-externally-derived-scores-remain-distinct',
    publicationIdentity:
      'dataset-generation-is-not-publication-authorization',
    tableSources: Object.fromEntries(REPORT_TABLE_NAMES.map((tableName) => [
      tableName,
      {
        sourceRef: `proof://report/${tableName}`,
        sourceSha256: hashReportStarSchemaData(tables[tableName])
      }
    ])),
    provenance: { proof: true }
  },
  tables
});
const preconditionEvidence = BM13_D3_PRECONDITION_IDS.map((preconditionId) => ({
  preconditionId,
  releaseId,
  manifestSha256: frozenManifest.manifestSha256,
  status: 'satisfied',
  evidenceRef: `proof://bm13/${preconditionId}`,
  evidenceSha256: digest(`proof-evidence:${preconditionId}`),
  authorityRef: `proof://authority/${preconditionId}`
}));
const plan = {
  bundleId: 'proof-bundle-d3',
  releaseClass: 'first-D3-release',
  releaseId,
  manifestSha256: frozenManifest.manifestSha256,
  reportReceiptSha256: reportReceipt.receiptSha256,
  preconditionEvidenceSha256: hashReleaseBundleData(preconditionEvidence),
  provenance: { proof: true }
};
const execute = () => createReleaseBundleReceipt({
  plan,
  frozenManifest,
  reportReceipt,
  preconditionEvidence
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('release-bundle proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `release-bundle proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureReleaseBundleProof.mjs',
  'bench/index.js',
  'bench/releaseBundle.js',
  'tests/benchmarkReleaseBundle.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13f-b-bm13-release-bundler',
  nodeVersion: process.version,
  networkGuard: {
    active: guard.active,
    version: guard.version,
    attempts: networkAttempts
  },
  deterministicRepeatEqual,
  sourceSha256,
  receiptSha256: first.receiptSha256,
  receipt: first
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  proofFileSha256: sha256(await readFile(outputPath)),
  receiptSha256: first.receiptSha256,
  deterministicRepeatEqual,
  networkAttempts
}));
