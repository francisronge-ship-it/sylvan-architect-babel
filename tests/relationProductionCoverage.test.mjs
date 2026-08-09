import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findRelationRegistryEntry,
  productionRelationRegistry
} from '../replay/relationDispatch/index.js';
import { compileRelationRenderPlan } from '../replay/relations/renderPlanCompiler.ts';
import {
  EXCLUDED_RELATION_IDENTITIES,
  PRODUCTION_RENDER_FAMILIES
} from '../replay/relations/renderFamilies.ts';

/**
 * The production coverage gate. This committed manifest records every
 * identity in the accepted relation catalog. Each must be production-wired to
 * a specialized compiler —
 * exact registry entry plus render family — or explicitly excluded with a
 * reason. The gate deliberately does not read the local-only research Lab.
 */
const ACCEPTED_RELATION_IDENTITIES = [
  'AMove',
  'AbarMove',
  'Accord',
  'AcrossTheBoardMovement',
  'Agree',
  'AntiLocality',
  'ArgumentSharing',
  'Binding',
  'BlockedExtraction',
  'BoundingNodeCrossing',
  'CaseAssignment',
  'Control',
  'CooperStorage',
  'Coreference',
  'CyclicAgree',
  'CyclicLinearization',
  'DependentCase',
  'EllipsisDeletion',
  'EllipsisLicensing',
  'EllipsisRecoverability',
  'FProjection',
  'FeatureBundle',
  'FeatureSharing',
  'Fission',
  'FocusMarking',
  'GappingAlignment',
  'HeadMove',
  'Identity',
  'IdiomChunkCointerpretation',
  'Impoverishment',
  'ImproperMovement',
  'Intervention',
  'LFReconstruction',
  'LocalDislocation',
  'Lowering',
  'ManyToManyCorrespondence',
  'Multidominance',
  'MultipleAgree',
  'MultiplePronunciation',
  'OperatorVariableBinding',
  'PFRealization',
  'PairMerge',
  'ParasiticGap',
  'PartialCopyDeletion',
  'Phase',
  'PhrasalSpellOut',
  'PostTransferAccess',
  'Predication',
  'QuantifierRaising',
  'RemnantMovement',
  'RightRoof',
  'RollUpMovement',
  'Scrambling',
  'SidewardMovement',
  'Smuggling',
  'SplitAntecedence',
  'StrongNPILicensing',
  'ThetaAssignment',
  'TransferDomain',
  'VocabularyInsertion'
].sort();

test('every accepted relation identity is production-wired or explicitly excluded with a reason', () => {
  const authoredNames = ACCEPTED_RELATION_IDENTITIES;
  assert.equal(authoredNames.length, 60, 'accepted relation manifest changed unexpectedly');

  const wired = [];
  const excluded = [];
  const uncovered = [];
  authoredNames.forEach((name) => {
    if (Object.hasOwn(EXCLUDED_RELATION_IDENTITIES, name)) {
      excluded.push(name);
      return;
    }
    const entry = findRelationRegistryEntry(productionRelationRegistry, name);
    if (entry && PRODUCTION_RENDER_FAMILIES[entry.id]) {
      wired.push(name);
      return;
    }
    uncovered.push(name);
  });

  assert.deepEqual(
    uncovered,
    [],
    `accepted active relations without production wiring: ${uncovered.join(', ')}`
  );
  assert.ok(wired.length >= 49, `wired count regressed: ${wired.length}`);
  excluded.forEach((name) => {
    assert.ok(
      EXCLUDED_RELATION_IDENTITIES[name].length > 10,
      `${name} exclusion carries no reason`
    );
  });
});

/**
 * Real accepted anchor shapes for every wired identity beyond the movement
 * core (covered in relationRenderPlan.test.mjs). Fixtures mirror the
 * accepted Lab cards' authored shapes so an omitted registry role cannot
 * silently produce signature-incomplete.
 */
const leaf = (id, label, word, extra = {}) => ({ id, label, ...(word ? { word } : {}), ...extra });
const node = (id, label, children, extra = {}) => ({ id, label, children, ...extra });
const stage = (relations, forest) => ({
  statement: 'statement',
  stageRecord: 'record',
  relations: relations,
  workspaceForest: forest
});

const fixtureForest = () => [node('root_fx', 'TP', [
  node('src_fx', 'XP', [leaf('w_fx', 'X', 't₁', { silent: true })], { silent: true }),
  node('tgt_fx', 'YP', [leaf('t_fx', 'Y', 'word')]),
  node('a_fx', 'AP', [leaf('a_leaf_fx', 'A', 'a')]),
  node('b_fx', 'BP', [leaf('b_leaf_fx', 'B', 'b')]),
  node('c_fx', 'CPx', [leaf('c_leaf_fx', 'C', 'c')]),
  node('d_fx', 'DPx', [leaf('d_leaf_fx', 'D', 'd')]),
  node('dom_fx', 'ZP', [
    node('in_a_fx', 'ZA', [leaf('in_a_leaf_fx', 'Z', 'za')]),
    node('in_b_fx', 'ZB', [leaf('in_b_leaf_fx', 'Z', 'zb')])
  ])
])];

const CASES = [
  { relation: 'Identity', anchors: { occurrences: ['a_fx', 'b_fx', 'c_fx'] } },
  { relation: 'Identity', anchors: { pronouncedCopy: 'a_fx', lowerCopy: 'b_fx' } },
  { relation: 'Control', anchors: { controller: 'a_fx', controllee: 'in_a_fx', domain: 'dom_fx' } },
  { relation: 'Predication', anchors: { predicand: 'a_fx', predicate: 'b_fx' } },
  { relation: 'Predication', anchors: { predicand: 'a_fx', predicates: ['b_fx', 'c_fx'] } },
  {
    relation: 'SplitAntecedence',
    anchors: { antecedents: ['a_fx', 'b_fx'], dependent: 'c_fx' },
    values: { antecedentIndices: ['1', '2'], dependentIndex: '1⊕2' }
  },
  {
    relation: 'ParasiticGap',
    anchors: { filler: 'a_fx', realGap: 'src_fx', traceWitness: 'w_fx', parasiticGap: 'b_fx' }
  },
  {
    relation: 'ParasiticGap',
    anchors: {
      filler: 'a_fx', realGap: 'src_fx', traceWitness: 'w_fx', parasiticGap: 'b_fx',
      primaryPath: ['a_fx', 'b_fx', 'c_fx'],
      secondaryPath: ['d_fx', 'in_a_fx'],
      blockedEdge: 'in_b_fx'
    },
    values: { outcome: 'blocked' }
  },
  { relation: 'PairMerge', anchors: { pairMember: 'a_fx', host: 'b_fx' } },
  { relation: 'Multidominance', anchors: { parents: ['dom_fx', 'a_fx'], shared: 'in_a_fx' } },
  { relation: 'ArgumentSharing', anchors: { domains: ['dom_fx', 'a_fx'], shared: 'in_b_fx' } },
  {
    relation: 'IdiomChunkCointerpretation',
    anchors: { predicateChunk: 'a_fx', argumentChunk: 'b_fx', interpretationDomain: 'dom_fx' }
  },
  { relation: 'Agree', anchors: { probe: 'a_fx', goal: 'b_fx' }, values: { feature: 'φ', value: '3SG' } },
  { relation: 'FeatureBundle', anchors: { bearer: 'a_fx' }, values: { Case: 'NOM' } },
  { relation: 'MultipleAgree', anchors: { probe: 'a_fx', goals: ['b_fx', 'c_fx'] }, values: { outcome: 'agree' } },
  { relation: 'CyclicAgree', anchors: { probe: 'a_fx', goal: 'b_fx' }, values: { cycle: '1', outcome: 'fails' } },
  { relation: 'FeatureSharing', anchors: { bearers: ['a_fx', 'b_fx', 'c_fx'] }, values: { feature: 'φ', value: '□' } },
  { relation: 'CaseAssignment', anchors: { assigner: 'a_fx', bearer: 'b_fx' }, values: { feature: 'Case', value: 'NOM' } },
  {
    relation: 'DependentCase',
    anchors: { probe: 'a_fx', goal: 'b_fx' },
    values: { step: '1', Case: 'ACC', probeLabel: '[*φ*]', goalLabel: '[CASE: ACC]' }
  },
  { relation: 'Accord', anchors: { source: 'a_fx', goal: 'b_fx' }, values: { index: '1', feature: 'POL', value: '−' } },
  { relation: 'BoundingNodeCrossing', anchors: { domain: 'dom_fx', boundary: ['a_fx', 'b_fx'] } },
  { relation: 'Phase', anchors: { phase: 'dom_fx', edge: 'in_a_fx' } },
  { relation: 'TransferDomain', anchors: { phase: 'dom_fx', edge: 'in_a_fx', spellOutDomain: 'in_b_fx' } },
  { relation: 'PostTransferAccess', anchors: { source: 'a_fx', target: 'in_b_fx', spellOutDomain: 'in_b_fx' } },
  {
    relation: 'AntiLocality',
    anchors: { source: 'src_fx', traceWitness: 'w_fx', landing: 'tgt_fx' },
    values: { outcome: 'blocked' }
  },
  {
    relation: 'AntiLocality',
    anchors: { source: 'src_fx', traceWitness: 'w_fx', landing: 'tgt_fx', facilitator: 'a_fx' },
    values: { outcome: 'licensed' }
  },
  {
    relation: 'ImproperMovement',
    anchors: {
      source: 'src_fx', traceWitness: 'w_fx', licensedLanding: 'tgt_fx',
      licensedLandingHosts: ['a_fx'], rejectedLandingHosts: ['b_fx'], forbiddenRegion: ['c_fx', 'd_fx']
    }
  },
  {
    relation: 'RightRoof',
    anchors: { roof: 'dom_fx', source: 'src_fx', traceWitness: 'w_fx', landing: 'tgt_fx' },
    values: { outcome: 'licensed' }
  },
  {
    relation: 'BlockedExtraction',
    anchors: { source: 'in_a_fx', target: 'a_fx', adjunctDomain: 'dom_fx' },
    values: { label: '* extraction' }
  },
  {
    relation: 'AdjunctInaccessibility',
    anchors: { source: 'in_a_fx', target: 'a_fx', adjunctDomain: 'dom_fx' }
  },
  { relation: 'Intervention', anchors: { landing: 'a_fx', intervener: 'b_fx', target: 'c_fx' } },
  {
    relation: 'EllipsisLicensing',
    anchors: { checker: 'a_fx', licensor: 'b_fx', domain: 'dom_fx' },
    values: { checkerFeature: '[CAT[T]]', licensorFeature: '[E[INFL[uT]]]', valuedFeature: 'uT', domainLabel: 'ellipsis' }
  },
  { relation: 'EllipsisLicensing', anchors: { licensor: 'b_fx', domain: 'dom_fx' } },
  { relation: 'EllipsisDeletion', anchors: { domain: 'dom_fx' } },
  { relation: 'MultiplePronunciation', anchors: { higherCopy: 'a_fx', lowerCopy: 'b_fx' } },
  { relation: 'PartialCopyDeletion', anchors: { lowerCopy: 'dom_fx', deletedSubconstituent: 'in_a_fx' } },
  { relation: 'PhrasalSpellOut', anchors: { phrase: 'dom_fx' }, values: { exponent: '-nak' } },
  {
    relation: 'ManyToManyCorrespondence',
    anchors: { word: 'a_fx' },
    values: { sources: ['K', 'Poss'], exponents: ['-eer', '-maan'] }
  },
  { relation: 'Impoverishment', anchors: { terminal: 'a_fx' }, values: { featureHierarchy: ['π', 'PART'], delinkAfter: 'π' } },
  { relation: 'LocalDislocation', anchors: { sequence: ['a_fx', 'b_fx', 'c_fx'] }, values: { beforeGroupSizes: ['1', '2'], afterGroupSizes: ['2', '1'] } },
  {
    relation: 'QuantifierRaising',
    anchors: { pronouncedQP: 'a_fx', lfQP: 'b_fx', scopeDomain: 'dom_fx' }
  },
  { relation: 'LFReconstruction', anchors: { neglectedCopy: 'a_fx', interpretedCopy: 'b_fx', binder: 'c_fx' } },
  {
    relation: 'CooperStorage',
    anchors: { scope: 'dom_fx', quantifier: 'a_fx' },
    values: { category: 'S', qstore: ['⟨every book⟩'] }
  },
  {
    relation: 'StrongNPILicensing',
    anchors: { exhaustifier: 'a_fx', npi: 'b_fx', focusOperator: 'c_fx', focusAssociate: 'd_fx' },
    values: { feature: 'D' }
  },
  { relation: 'FocusMarking', anchors: { focus: 'in_a_fx', background: 'in_b_fx', domain: 'dom_fx' } },
  { relation: 'FProjection', anchors: { accentBearer: 'a_fx', projections: ['b_fx', 'c_fx'] }, values: { accent: 'H*', feature: 'F' } },
  { relation: 'ThetaAssignment', anchors: { predicate: 'a_fx', agent: 'b_fx', theme: 'c_fx' } },
  {
    relation: 'GappingAlignment',
    anchors: { antecedent: 'a_fx', gap: 'b_fx', correlates: ['c_fx', 'd_fx'], remnants: ['in_a_fx', 'in_b_fx'] },
    values: { labels: ['1', '2'] }
  }
];

test('every remaining wired identity compiles its real accepted anchor shape into semantic items', () => {
  CASES.forEach(({ relation, anchors, values }) => {
    const plan = compileRelationRenderPlan([
      stage([{ relation, anchors, ...(values ? { values } : {}) }], fixtureForest())
    ]);
    assert.deepEqual(plan.unregistered, [], `${relation} must dispatch through its exact registry entry`);
    const signatureFailures = plan.diagnostics.filter((d) => d.kind === 'signature-incomplete');
    assert.deepEqual(signatureFailures, [], `${relation} signature-incomplete: ${JSON.stringify(signatureFailures)}`);
    const semanticItems = plan.frames[0].items
      .filter((item) => item.kind !== 'fallback' && item.kind !== 'anchor-set');
    assert.ok(
      semanticItems.length >= 1,
      `${relation} compiled no semantic item; diagnostics: ${JSON.stringify(plan.diagnostics)}`
    );
  });
});

test('PFRealization collects same-stage VocabularyInsertion rows into one plate, verbatim and in authored order', () => {
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'PFRealization', anchors: { root: 'a_fx', tense: 'b_fx' } },
      { relation: 'VocabularyInsertion', anchors: { terminal: 'a_fx' }, values: { input: '√LAUGH', output: 'laugh' } },
      { relation: 'VocabularyInsertion', anchors: { terminal: 'b_fx' }, values: { input: 'T[past]', output: '-ed' } }
    ], fixtureForest())
  ]);
  assert.deepEqual(plan.unregistered, []);
  const plates = plan.frames[0].items.filter((item) => item.kind === 'node-plaque');
  assert.equal(plates.length, 1, 'insertions fold into the realization plate, not separate plates');
  assert.deepEqual(plates[0].rows, [
    { label: 'input', value: '√LAUGH' },
    { label: 'output', value: 'laugh' },
    { label: 'input', value: 'T[past]' },
    { label: 'output', value: '-ed' }
  ]);
  // A standalone insertion keeps its own plate.
  const alone = compileRelationRenderPlan([
    stage([
      { relation: 'VocabularyInsertion', anchors: { terminal: 'a_fx' }, values: { input: 'X', output: 'x' } }
    ], fixtureForest())
  ]);
  assert.equal(alone.frames[0].items.filter((item) => item.kind === 'node-plaque').length, 1);
});

test('CyclicLinearization replaces its previous instance per frame and keeps the backward cue', () => {
  const forest = fixtureForest();
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'CyclicLinearization',
      anchors: { order: ['a_fx', 'b_fx'], edgePosition: 'a_fx' },
      values: { outcome: 'licensed' }
    }], forest),
    stage([{
      relation: 'CyclicLinearization',
      anchors: { order: ['a_fx', 'b_fx', 'c_fx'], conflictWitness: 'c_fx' },
      priorAnchors: { order: ['a_fx', 'b_fx'] },
      values: { outcome: 'conflict' }
    }], forest)
  ]);
  const frameZero = plan.frames[0].items.filter((item) => item.kind === 'node-plaque');
  const frameOne = plan.frames[1].items.filter((item) => item.kind === 'node-plaque');
  assert.equal(frameZero.length, 1);
  assert.equal(frameOne.length, 1);
  assert.equal(frameOne[0].title, 'conflict', 'the later instance replaced the earlier one');
  assert.equal(frameOne[0].backward, true);
  assert.deepEqual(frameOne[0].priorWitnessNodeIds, ['a_fx', 'b_fx']);
});

test('a multidominance claim none of whose parents dominates the shared node fails closed', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'Multidominance',
      anchors: { parents: ['a_fx', 'b_fx'], shared: 'c_fx' }
    }], fixtureForest())
  ]);
  assert.equal(plan.frames[0].items.filter((item) => item.kind === 'shared-node').length, 0);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'illegal-configuration'));
});

test('LF reconstruction compiles strike/ghost plus shared index and no connector of any kind', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'LFReconstruction',
      anchors: { neglectedCopy: 'dom_fx', interpretedCopy: 'a_fx', binder: 'b_fx' }
    }], fixtureForest())
  ]);
  const kinds = plan.frames[0].items.map((item) => item.kind).sort();
  assert.deepEqual(kinds, ['coindex', 'strike-ghost']);
  assert.equal(plan.frames[0].items.some((item) => item.kind === 'directed-path'), false);
});
