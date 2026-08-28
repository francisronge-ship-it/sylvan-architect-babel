import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createDraftItemSetReceipt,
  hashDraftItemData
} from './draftItems.js';

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
const digest = (text) => hashDraftItemData({ text });
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
  familyDocumentation: [{
    familyId: 'proof-open-family',
    status: 'draft',
    normative: false,
    documentRef: 'proof://family/document',
    documentSha256: digest('proof-family-document')
  }],
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
const plan = {
  draftSetId: 'proof-draft-set',
  itemSourceSha256: hashDraftItemData(items),
  checklistPolicyIdentity: 'bm5-conditional-checklist-structural-lint-only',
  taxonomyIdentity: 'bm5-content-axes-and-purpose-flags',
  lifecycleIdentity: 'draft-only-no-review-activation-scoring-or-release',
  provenance: { proof: true }
};
const execute = () => createDraftItemSetReceipt({ plan, items });
const first = execute();
const second = execute();
const deterministicRepeatEqual = JSON.stringify(first) === JSON.stringify(second);
if (!deterministicRepeatEqual) {
  throw new Error('draft-item proof repetitions differ.');
}
const networkAttempts = guard.getAttempts();
if (networkAttempts.length > 0) {
  throw new Error(
    `draft-item proof observed network attempts: ${networkAttempts.join(', ')}`
  );
}
const sourcePaths = [
  'bench/README.md',
  'bench/captureDraftItemsProof.mjs',
  'bench/draftItems.js',
  'bench/index.js',
  'tests/benchmarkDraftItems.test.mjs'
];
const sourceSha256 = Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(sourcePath))
  ])
));
const proof = {
  schemaVersion: 1,
  packageId: 'W14a-draft-item-structural-lint',
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
