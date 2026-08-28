import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createDraftItemSetReceipt,
  createDraftTaxonomyAuditReceipt,
  hashDraftItemData,
  hashDraftTaxonomyAuditData
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
const sha256Text = (value) => createHash('sha256')
  .update(value, 'utf8')
  .digest('hex');
const digest = (text) => hashDraftTaxonomyAuditData({ text });
const inputText = 'Proof draft input 🜁';
const items = [{
  itemVersionId: 'proof-draft-item-v1',
  itemId: 'proof-draft-item',
  versionNumber: 1,
  lifecycle: 'draft',
  input: {
    text: inputText,
    textSha256: sha256Text(inputText)
  },
  language: 'proof-open-language',
  script: 'proof-open-script',
  frameworks: ['proof-open-framework'],
  phenomena: {
    primary: 'proof-open-phenomenon',
    secondary: []
  },
  noveltyClass: 'nonce',
  conditionalChecklist: [{
    checkId: 'proof-check',
    obligationClass: 'analysis-conditional',
    text: 'Proof externally authored checklist text.',
    registerIds: []
  }],
  familyDocumentation: [],
  ambiguitySpec: {
    mode: 'single-adequate-analysis',
    specRef: 'proof://ambiguity/spec',
    specSha256: digest('proof-ambiguity-spec')
  },
  purposeFlags: [{
    kind: 'adversarial'
  }],
  provenance: {
    authorRef: 'proof-external-author',
    authoredAt: 'proof-authorship-record',
    sourceArtifactRef: 'proof://draft/item',
    sourceArtifactSha256: digest('proof-draft-source')
  }
}];
const draftReceipt = createDraftItemSetReceipt({
  plan: {
    draftSetId: 'proof-draft-set',
    itemSourceSha256: hashDraftItemData(items),
    checklistPolicyIdentity: 'bm5-conditional-checklist-structural-lint-only',
    taxonomyIdentity: 'bm5-content-axes-and-purpose-flags',
    lifecycleIdentity: 'draft-only-no-review-activation-scoring-or-release',
    provenance: { proof: true }
  },
  items
});
const taxonomyCatalogRef = 'proof://taxonomy/catalog';
const taxonomyCatalogSha256 = digest('proof-taxonomy-catalog');
const audits = [{
  itemVersionId: items[0].itemVersionId,
  draftReceiptSha256: draftReceipt.receiptSha256,
  taxonomyCatalogRef,
  taxonomyCatalogSha256,
  auditorRefs: ['proof-external-auditor'],
  auditedAt: 'proof-audit-record',
  auditRef: 'proof://taxonomy/audit/item',
  auditSha256: digest('proof-taxonomy-audit'),
  outcome: 'findings-recorded',
  findingRefs: ['proof://taxonomy/finding']
}];
const plan = {
  auditSetId: 'proof-taxonomy-audit-set',
  draftReceiptSha256: draftReceipt.receiptSha256,
  taxonomyCatalogRef,
  taxonomyCatalogSha256,
  auditRecordSourceSha256: hashDraftTaxonomyAuditData(audits),
  auditIdentity: 'bm5-external-taxonomy-audit-evidence-only',
  lifecycleIdentity:
    'draft-remains-draft-no-review-promotion-activation-scoring-or-release',
  provenance: { proof: true }
};
const execute = () => createDraftTaxonomyAuditReceipt({
  plan,
  draftReceipt,
  audits
});
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('draft-taxonomy-audit proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `draft-taxonomy-audit proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureDraftTaxonomyAuditProof.mjs',
  'bench/draftTaxonomyAudit.js',
  'bench/index.js',
  'tests/benchmarkDraftTaxonomyAudit.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W14b-draft-taxonomy-audit-evidence',
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
