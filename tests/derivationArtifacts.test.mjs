import assert from 'node:assert/strict';
import test from 'node:test';

import { collectDerivationStageRecords } from '../derivationNotes.js';
import { createTreeBankBundleSnapshot } from '../treeBankSnapshot.js';

test('Notes are exactly the ordered non-empty derivation stage records', () => {
  const stages = [
    { statement: 'Ignored statement one', stageRecord: 'First record', relations: [], workspaceForest: [] },
    { statement: 'Ignored statement two', stageRecord: '  Second record?  ', relations: [], workspaceForest: [] },
    { statement: 'Ignored statement three', stageRecord: '', relations: [], workspaceForest: [] }
  ];

  assert.deepEqual(collectDerivationStageRecords(stages), ['First record', 'Second record?']);
  assert.deepEqual(collectDerivationStageRecords(undefined), []);
});

test('Tree Bank snapshots keep only current parse artifacts without mutating the source bundle', () => {
  const bundle = {
    transientBundleField: 'not persisted',
    analyses: [
      {
        tree: { id: 'root', label: 'TP', children: [] },
        surfaceOrder: [],
        derivationStages: [],
        derivationSteps: [{ operation: 'Other' }],
        transientAnalysisField: 'not persisted',
        provenance: {
          treeSource: 'derivationStages',
          hasDerivationStages: false,
          transientProvenanceField: 'not persisted'
        }
      }
    ],
    ambiguityDetected: false
  };

  const snapshot = createTreeBankBundleSnapshot(bundle);
  const analysis = snapshot.analyses[0];

  assert.equal('transientBundleField' in snapshot, false);
  assert.equal('transientAnalysisField' in analysis, false);
  assert.equal('transientProvenanceField' in analysis.provenance, false);
  assert.equal(analysis.provenance.treeSource, 'derivationStages');
  assert.deepEqual(analysis.derivationSteps, [{ operation: 'Other' }]);
  analysis.tree.label = 'Changed snapshot';
  assert.equal(bundle.analyses[0].tree.label, 'TP');
});
