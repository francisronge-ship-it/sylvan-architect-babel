import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAuthoredVisualRelationRelationLinksForFrames
} from '../replay/replayCompiler.ts';

test('authored relation links preserve literal anchor roles and use shared lineage only as identity', () => {
  const forest = [{
    id: 'cp',
    label: 'CP',
    children: [
      {
        id: 'high_dp',
        label: 'DP',
        children: [{ id: 'high_d', label: 'D', word: 'Which', lineageId: 'wh-d' }]
      },
      {
        id: 'low_dp',
        label: 'DP',
        silent: true,
        children: [{ id: 'low_d', label: 'D', word: 't₁', silent: true, lineageId: 'wh-d' }]
      }
    ]
  }];
  const frames = [{
    workspaceForest: forest,
    change: {
      details: {
        derivationStageVisualRelations: [{
          relation: 'AbarMove',
          anchors: { lowerCopy: 'low_dp', pronouncedCopy: 'high_dp' }
        }]
      }
    }
  }];

  const links = buildAuthoredVisualRelationRelationLinksForFrames(frames, null, 0, forest);
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].anchors, [
    { role: 'lowerCopy', nodeId: 'low_dp' },
    { role: 'pronouncedCopy', nodeId: 'high_dp' }
  ]);
  assert.equal(links[0].sourceNodeId, 'low_dp');
  assert.equal(links[0].targetNodeId, 'high_dp');
  assert.equal(links[0].endpointOrderProvenance, 'authored-anchor-order');
  assert.ok(String(links[0].relationIndex || '').length > 0);
  assert.equal(links[0].relationIndexProvenance, 'derived-presentation');
  assert.equal(links[0].identityProvenance, 'authored-shared-lineage');
  assert.match(links[0].identityKey, /wh-d/);
  assert.equal(links[0].chainId, undefined);

  const distinctForest = structuredClone(forest);
  distinctForest[0].children[0].children[0].lineageId = 'high-only';
  distinctForest[0].children[1].children[0].lineageId = 'low-only';
  const distinctFrames = [{
    ...frames[0],
    workspaceForest: distinctForest
  }];
  const [distinctLink] = buildAuthoredVisualRelationRelationLinksForFrames(
    distinctFrames,
    null,
    0,
    distinctForest
  );
  assert.equal(distinctLink.sourceNodeId, 'low_dp');
  assert.equal(distinctLink.targetNodeId, 'high_dp');
  assert.equal(distinctLink.identityKey, undefined);
});

test('authored relation display indices are derived without prescribing index symbols or inferred pairing', () => {
  const forest = [{
    id: 'cp',
    label: 'CP',
    children: [
      {
        id: 'who_high',
        label: 'DP',
        children: [{ id: 'who_high_d', label: 'D', word: 'Who', lineageId: 'who-chain' }]
      },
      {
        id: 'who_low',
        label: 'DP',
        silent: true,
        children: [{ id: 'who_low_d', label: 'D', word: 't', silent: true, lineageId: 'who-chain' }]
      },
      {
        id: 'what_high',
        label: 'DP',
        children: [{ id: 'what_high_d', label: 'D', word: 'What', lineageId: 'what-chain' }]
      },
      {
        id: 'what_low',
        label: 'DP',
        silent: true,
        children: [{ id: 'what_low_d', label: 'D', word: 't', silent: true, lineageId: 'what-chain' }]
      }
    ]
  }];
  const frames = [{
    workspaceForest: forest,
    change: {
      details: {
        derivationStageVisualRelations: [
          {
            relation: 'OperatorVariableBinding',
            anchors: { operator: 'who_high', variable: 'who_low' }
          },
          {
            relation: 'OperatorVariableBinding',
            anchors: { operator: 'what_high', variable: 'what_low' }
          }
        ]
      }
    }
  }];

  const links = buildAuthoredVisualRelationRelationLinksForFrames(frames, null, 0, forest);
  assert.equal(links.length, 2);
  assert.equal(new Set(links.map((link) => link.relationIndex)).size, 2);
  links.forEach((link) => {
    assert.ok(String(link.relationIndex || '').length > 0);
    assert.equal(link.relationIndexProvenance, 'derived-presentation');
    assert.equal(link.endpointOrderProvenance, 'authored-anchor-order');
    assert.equal(link.identityProvenance, 'authored-shared-lineage');
    assert.equal(link.chainId, undefined);
  });
  assert.deepEqual(links[0].anchors, [
    { role: 'operator', nodeId: 'who_high' },
    { role: 'variable', nodeId: 'who_low' }
  ]);
  assert.deepEqual(links[1].anchors, [
    { role: 'operator', nodeId: 'what_high' },
    { role: 'variable', nodeId: 'what_low' }
  ]);
  assert.match(links[0].identityKey, /who-chain/);
  assert.match(links[1].identityKey, /what-chain/);
  assert.notEqual(links[0].identityKey, links[1].identityKey);
});
