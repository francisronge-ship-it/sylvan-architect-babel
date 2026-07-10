import assert from 'node:assert/strict';
import test from 'node:test';

import { collectDerivationStageRecords } from '../derivationNotes.js';
import { createTreeBankBundleSnapshot } from '../treeBankSnapshot.js';

test('Notes are exactly the ordered non-empty derivation stage records', () => {
  const stages = [
    { statement: 'Ignored statement one', stageRecord: 'First record', visualRelations: [], workspaceForest: [] },
    { statement: 'Ignored statement two', stageRecord: '  Second record?  ', visualRelations: [], workspaceForest: [] },
    { statement: 'Ignored statement three', stageRecord: '', visualRelations: [], workspaceForest: [] }
  ];

  assert.deepEqual(collectDerivationStageRecords(stages), ['First record', 'Second record?']);
  assert.deepEqual(collectDerivationStageRecords(undefined), []);
});

test('new Tree Bank snapshots omit the compiled-analysis fossil while preserving reasoning provenance', () => {
  const bundle = {
    commitmentFacts: [{ factId: 'legacy-top-level-fact', kind: 'transition' }],
    analyses: [
      {
        tree: { id: 'root', label: 'TP', children: [] },
        explanation: 'Legacy synthesized explanation.',
        noteBindings: [{ noteId: 'legacy-note', text: 'Legacy note.' }],
        commitmentFacts: [{ factId: 'legacy-fact', kind: 'transition' }],
        derivationStages: [],
        derivationSteps: [{ operation: 'Other' }],
        provenance: {
          hasCommitmentFacts: true,
          notesSource: 'derivationStages',
          notesCompiledFromDerivationStages: true,
          providerReasoningRaw: 'Preserved provider reasoning trace.'
        }
      }
    ],
    ambiguityDetected: false
  };

  const snapshot = createTreeBankBundleSnapshot(bundle);
  const analysis = snapshot.analyses[0];

  assert.equal('commitmentFacts' in snapshot, false);
  for (const field of ['commitmentFacts', 'noteBindings', 'explanation']) {
    assert.equal(field in analysis, false, field);
  }
  for (const field of ['hasCommitmentFacts', 'notesSource', 'notesCompiledFromDerivationStages']) {
    assert.equal(field in analysis.provenance, false, field);
  }
  assert.equal(analysis.provenance.providerReasoningRaw, 'Preserved provider reasoning trace.');
  assert.deepEqual(analysis.derivationSteps, [{ operation: 'Other' }]);
  assert.equal(bundle.analyses[0].commitmentFacts.length, 1, 'source bundle must not be mutated');
});
