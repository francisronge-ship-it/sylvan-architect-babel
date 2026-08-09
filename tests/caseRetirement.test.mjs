import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { __test__ } from '../server/babelParser.js';
import { buildReplaySnapshotProjection } from '../replay/replaySnapshot.ts';
import {
  createTreeBankBundleSnapshot,
  loadTreeBankBundleSnapshot
} from '../treeBankSnapshot.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyCaseFields = ['case', 'assigner', 'caseEvidence', 'caseOvert'];

const collectSyntaxNodes = (roots) => {
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    nodes.push(node);
    (Array.isArray(node.children) ? node.children : []).forEach(visit);
  };
  (Array.isArray(roots) ? roots : [roots]).forEach(visit);
  return nodes;
};

const assertNoLegacyCaseMetadataOnSyntaxRoots = (roots, scope = '') => {
  for (const node of collectSyntaxNodes(roots)) {
    for (const field of legacyCaseFields) {
      assert.equal(
        Object.hasOwn(node, field),
        false,
        `${scope ? `${scope}: ` : ''}legacy ${field} survived on ${node.id || node.label || '<anonymous>'}`
      );
    }
  }
};

const collectBundleSyntaxRoots = (bundle) => (
  (Array.isArray(bundle?.analyses) ? bundle.analyses : []).flatMap((analysis) => [
    analysis.tree,
    ...(Array.isArray(analysis.derivationStages)
      ? analysis.derivationStages.flatMap((stage) => stage.workspaceForest || [])
      : [])
  ])
);

const collectFixtureSyntaxRoots = (fixture) => {
  const directRoots = collectBundleSyntaxRoots(fixture);
  const payloadRoots = collectBundleSyntaxRoots(fixture?.payload);
  const rawStageRoots = Array.isArray(fixture?.payload?.derivationStages)
    ? fixture.payload.derivationStages.flatMap((stage) => stage.workspaceForest || [])
    : [];
  return [...directRoots, ...payloadRoots, ...rawStageRoots];
};

const assertNoLegacyCaseMetadata = (bundle) => {
  assertNoLegacyCaseMetadataOnSyntaxRoots(collectBundleSyntaxRoots(bundle));
};

test('provider-free fixture syntax nodes contain no legacy Case metadata keys', () => {
  for (const directory of ['raw', 'normalized', 'replay-snapshots']) {
    const fixtureDirectory = path.join(repoRoot, 'fixtures', directory);
    for (const fixtureName of fs.readdirSync(fixtureDirectory).filter((name) => name.endsWith('.json'))) {
      const fixture = JSON.parse(
        fs.readFileSync(path.join(fixtureDirectory, fixtureName), 'utf8')
      );
      assertNoLegacyCaseMetadataOnSyntaxRoots(
        collectFixtureSyntaxRoots(fixture),
        `${directory}/${fixtureName}`
      );
    }
  }
});

test('parser retirement ignores legacy Case node metadata without altering authored syntax', () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'fixtures', 'raw', 'mia-laughed.xbar.json'), 'utf8')
  );
  const authoredNode = fixture.payload.derivationStages[0].workspaceForest[0];
  Object.assign(authoredNode, {
    case: 'nominative',
    assigner: 'finite-T',
    caseEvidence: 'authored legacy evidence',
    caseOvert: false
  });

  const bundle = __test__.normalizeParseBundle(
    fixture.payload,
    fixture.framework,
    fixture.sentence,
    fixture.modelRoute,
    true,
    { payloadIntegrityFlags: [] }
  );

  assert.equal(authoredNode.label, 'NP');
  assert.equal(authoredNode.case, 'nominative');
  assert.equal(bundle.analyses[0].derivationStages[0].workspaceForest[0].label, 'NP');
  assert.deepEqual(bundle.analyses[0].surfaceOrder, ['Mia', 'laughed']);
  assertNoLegacyCaseMetadata(bundle);
});

test('historical Tree Bank records load without legacy Case metadata or archive mutation', () => {
  const legacyBundle = {
    analyses: [{
      tree: {
        id: 'tp',
        label: 'TP',
        children: [{
          id: 'dp_mia',
          label: 'DP',
          case: 'nominative',
          assigner: 't_finite',
          caseEvidence: 'legacy node annotation',
          caseOvert: false,
          children: [{
            id: 'd_mia',
            label: 'D',
            word: 'Mia',
            tokenIndex: 0
          }]
        }]
      },
      surfaceOrder: ['Mia'],
      derivationStages: [{
        statement: 'The DP is present in the authored workspace.',
        stageRecord: 'The historical record explicitly states its Case commitment in prose.',
        relations: [{
          relation: 'CaseAssignment',
          anchors: {
            assignee: 'dp_mia',
            assigner: 't_finite'
          }
        }],
        workspaceForest: [{
          id: 'dp_mia',
          label: 'DP',
          case: 'nominative',
          assigner: 't_finite',
          caseEvidence: 'legacy stage annotation',
          caseOvert: false,
          children: [{
            id: 'd_mia',
            label: 'D',
            word: 'Mia',
            tokenIndex: 0
          }]
        }]
      }],
      derivationSteps: [],
      provenance: {
        treeSource: 'derivationStages'
      }
    }],
    ambiguityDetected: false,
    sentence: 'Mia'
  };
  const archivedBytes = JSON.stringify(legacyBundle);
  const archivedSha256 = crypto.createHash('sha256').update(archivedBytes).digest('hex');

  const loaded = loadTreeBankBundleSnapshot(legacyBundle);

  assert.equal(JSON.stringify(legacyBundle), archivedBytes);
  assert.equal(
    crypto.createHash('sha256').update(JSON.stringify(legacyBundle)).digest('hex'),
    archivedSha256
  );
  assert.notEqual(loaded, legacyBundle);
  assert.equal(loaded.analyses[0].tree.children[0].label, 'DP');
  assert.equal(
    loaded.analyses[0].derivationStages[0].stageRecord,
    'The historical record explicitly states its Case commitment in prose.'
  );
  assert.deepEqual(
    loaded.analyses[0].derivationStages[0].relations,
    legacyBundle.analyses[0].derivationStages[0].relations
  );
  assertNoLegacyCaseMetadata(loaded);
  assert.equal(buildReplaySnapshotProjection(loaded).sentence, 'Mia');

  const resaved = createTreeBankBundleSnapshot(legacyBundle);
  assertNoLegacyCaseMetadata(resaved);
  assert.equal(JSON.stringify(legacyBundle), archivedBytes);
});
