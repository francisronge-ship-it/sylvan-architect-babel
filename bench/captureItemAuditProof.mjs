import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createItemAuditReceipt,
  hashItemAuditData
} from './itemAudit.js';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!outputPath) throw new TypeError('capture requires --output <path>.');

const guard = globalThis.__BABEL_PROVIDER_FREE_NETWORK_GUARD__;
if (!guard?.active || typeof guard.getAttempts !== 'function') {
  throw new Error('capture requires the provider-free network guard.');
}
guard.resetAttempts();

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (text) => hashItemAuditData({ text });
const item = (id, versionNumber = 1) => ({
  itemId: `proof-item-${id}`,
  itemVersionId: `proof-item-${id}-v${versionNumber}`,
  versionNumber,
  itemArtifactRef: `proof://items/${id}/v${versionNumber}`,
  itemArtifactSha256: digest(`item-${id}-v${versionNumber}`),
  statusHistoryRef: `proof://status/${id}`,
  statusHistorySha256: digest(`status-${id}`)
});
const items = [item('verified'), item('revised'), item('uncertain')];
const finding = (id, taxonomyClass) => ({
  findingId: `proof-finding-${id}`,
  taxonomyClass,
  evidenceRef: `proof://findings/${id}`,
  evidenceSha256: digest(`finding-${id}`)
});
const audit = (target, disposition, overrides = {}) => ({
  auditId: `proof-audit-${target.itemId}`,
  itemId: target.itemId,
  auditedItemVersionId: target.itemVersionId,
  auditorIdentity: 'proof-external-auditor',
  auditCompletedAt: 'proof-opaque-date',
  auditArtifactRef: `proof://audits/${target.itemVersionId}`,
  auditArtifactSha256: digest(`audit-${target.itemVersionId}`),
  findings: [],
  disposition,
  dispositionEvidenceRef: `proof://dispositions/${target.itemVersionId}`,
  dispositionEvidenceSha256: digest(`disposition-${target.itemVersionId}`),
  revision: null,
  ...overrides
});
const audits = [
  audit(items[0], 'verified'),
  audit(items[1], 'revised', {
    findings: [finding('revised', 'underspecified-checklist')],
    revision: {
      itemId: items[1].itemId,
      fromItemVersionId: items[1].itemVersionId,
      toItemVersionId: 'proof-item-revised-v2',
      toVersionNumber: 2,
      revisedItemArtifactRef: 'proof://items/revised/v2',
      revisedItemArtifactSha256: digest('item-revised-v2'),
      affectedScoreSetRef: 'proof://scores/revised',
      affectedScoreSetSha256: digest('scores-revised'),
      dualVersionRepublicationPlanRef: 'proof://republication/revised',
      dualVersionRepublicationPlanSha256: digest('republication-revised')
    }
  }),
  audit(items[2], 'documented-uncertain', {
    findings: [finding('uncertain', 'ambiguity-defect')]
  })
];
const plan = {
  auditCycleId: 'provider-free-proof',
  auditScopeIdentity: 'externally-declared-complete-item-version-set',
  taxonomyIdentity:
    'key-error-underspecified-checklist-family-doc-gap-ambiguity-defect-contamination-evidence',
  dispositionIdentity:
    'externally-authored-verified-revised-or-documented-uncertain',
  revisionIdentity: 'next-version-plus-dual-version-score-republication',
  uncertainIdentity: 'exclude-from-claim-bearing-scores-until-resolved',
  itemSetSourceRef: 'proof://item-set',
  itemSetSha256: hashItemAuditData(items),
  auditSetSourceRef: 'proof://audit-set',
  auditSetSha256: hashItemAuditData(audits),
  targetItemVersionIds: items.map(({ itemVersionId }) => itemVersionId),
  provenance: { proof: true }
};
const execute = () => createItemAuditReceipt({ plan, items, audits });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('item-audit proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `item-audit proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureItemAuditProof.mjs',
  'bench/index.js',
  'bench/itemAudit.js',
  'tests/benchmarkItemAudit.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W13e-e-item-audit',
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
