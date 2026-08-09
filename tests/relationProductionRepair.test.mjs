import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileRelationRenderPlan,
  visiblePlanFrameItems
} from '../replay/relations/renderPlanCompiler.ts';
import { bindRelationPlanFrame } from '../replay/relations/geometryBinding.ts';
import {
  adaptDerivationStagesForReplay,
  buildPlaybackStepsFromDerivationFrames,
  formatAuthoredWitnessSurface
} from '../replay/replayCompiler.ts';
import { buildDerivationReplayPlan } from '../derivationReplayPlan.js';

const leaf = (id, label, word, extra = {}) => ({ id, label, ...(word ? { word } : {}), ...extra });
const node = (id, label, children, extra = {}) => ({ id, label, children, ...extra });
const stage = (relations, forest) => ({
  statement: 'A derivational state holds.',
  stageRecord: 'A record of the derivational state, long enough to be substantive prose.',
  relations: relations,
  workspaceForest: forest
});

const gridProvider = (positions) => (nodeId) => positions.get(nodeId) || null;

/* ------------------------------------------------------------------ *
 * Blocker 2: authored witness kind is authoritative.
 * ------------------------------------------------------------------ */

test('display indexing is additive only: t gains its index; ∅, silent lexical, and overt stay authored', () => {
  assert.equal(formatAuthoredWitnessSurface('t', '2'), 't₂');
  assert.match(formatAuthoredWitnessSurface('t₁'), /^t₁$/);
  assert.equal(formatAuthoredWitnessSurface('∅', '1'), '∅', 'authored ∅ stays ∅ even inside a movement chain');
  assert.equal(formatAuthoredWitnessSurface('someone', '3'), 'someone', 'silent lexical material stays lexical');
  assert.equal(formatAuthoredWitnessSurface('laughed', '1'), 'laughed', 'overt material stays overt');
});

test('ellipsis relations ghost only material the model authored silent', () => {
  const tree = node('cp_gh', 'CP', [
    node('vp_site_gh', 'VP', [
      leaf('v_gh', 'V', 'read', { silent: true }),
      node('dp_gh', 'DP', [leaf('d_gh', 'D', 'it')])
    ])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'EllipsisRecoverability', anchors: { site: 'vp_site_gh' } }], [tree])
  ]);
  const [item] = plan.frames[0].items;
  assert.equal(item.kind, 'ellipsis-site');
  // Only the authored-silent leaf ghosts; the overt DP material never does.
  assert.deepEqual(item.ghostNodeIds, ['v_gh']);
});

/* ------------------------------------------------------------------ *
 * Blocker 1: one movement authority, per instance.
 * ------------------------------------------------------------------ */

const twoChainTree = node('cp_2c', 'CP', [
  node('dp_wh_high', 'DP', [leaf('d_wh_high', 'D', 'what')]),
  node('dp_adv_high', 'DP', [leaf('d_adv_high', 'D', 'where')]),
  node('tp_2c', 'TP', [
    node('dp_wh_low', 'DP', [leaf('d_wh_low', 'D', 't', { silent: true, lineageId: 'chain-wh' })], { silent: true, lineageId: 'chain-wh' }),
    node('dp_adv_low', 'DP', [leaf('d_adv_low', 'D', 't', { silent: true, lineageId: 'chain-adv' })], { silent: true, lineageId: 'chain-adv' })
  ])
]);

test('two independent A-bar chains in one derivation both compile and both bind', () => {
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'AbarMove', anchors: { lowerCopy: 'dp_wh_low', traceWitness: 'd_wh_low', pronouncedCopy: 'dp_wh_high' } },
      { relation: 'AbarMove', anchors: { lowerCopy: 'dp_adv_low', traceWitness: 'd_adv_low', pronouncedCopy: 'dp_adv_high' } }
    ], [twoChainTree])
  ]);
  const trajectories = plan.frames[0].items.filter((item) => item.kind === 'trajectory');
  assert.equal(trajectories.length, 2, 'two same-stage instances of one relation both compile');
  const positions = new Map([
    ['dp_wh_high', { x: 100, y: 50 }], ['d_wh_high', { x: 100, y: 150 }],
    ['dp_adv_high', { x: 300, y: 50 }], ['d_adv_high', { x: 300, y: 150 }],
    ['dp_wh_low', { x: 500, y: 300 }], ['d_wh_low', { x: 500, y: 400 }],
    ['dp_adv_low', { x: 700, y: 300 }], ['d_adv_low', { x: 700, y: 400 }]
  ]);
  const bound = bindRelationPlanFrame(plan, 0, (nodeId, attachment = 'position') => positions.get(nodeId) || null);
  assert.equal(bound.primitives.filter((p) => p.type === 'trajectory-path').length, 2);
});

test('ATB with three paired gaps compiles one trajectory per pair, all preserved', () => {
  const sources = ['atb_s1', 'atb_s2', 'atb_s3'];
  const witnesses = ['atb_w1', 'atb_w2', 'atb_w3'];
  const tree = node('tp_atb3', 'TP', [
    ...sources.map((id, index) =>
      node(id, 'XP', [leaf(witnesses[index], 'X', 't', { silent: true })], { silent: true })),
    node('yp_atb3', 'YP', [leaf('t_atb3', 'Y', 'what')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AcrossTheBoardMovement',
      anchors: { sources, traceWitnesses: witnesses, pronouncedCopy: 'yp_atb3' }
    }], [tree])
  ]);
  const trajectories = plan.frames[0].items.filter((item) => item.kind === 'trajectory');
  assert.equal(trajectories.length, 3);
  assert.deepEqual(trajectories.map((item) => item.witnessNodeId), witnesses);
});

/* ------------------------------------------------------------------ *
 * Blocker 3: Replay-step timing through real playback steps.
 * ------------------------------------------------------------------ */

test('a relation appears only at its Replay relation moment, never during earlier structural microsteps', () => {
  const tree = node('tp_time', 'TP', [
    node('dp_time_a', 'DP', [leaf('d_time_a', 'D', 'she')]),
    node('dp_time_b', 'DP', [leaf('d_time_b', 'D', 'her')])
  ]);
  const stages = [
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'dp_time_a', pronoun: 'dp_time_b' } },
      { relation: 'Coreference', anchors: { first: 'dp_time_b', second: 'dp_time_a' } }
    ], [tree])
  ];
  const plan = compileRelationRenderPlan(stages);
  assert.equal(plan.frames[0].items.filter((item) => item.kind === 'coindex').length, 2);

  // Real playback: relation steps arrive after the stage's structural
  // microsteps, and each authored relation gets its own moment.
  const frames = adaptDerivationStagesForReplay(stages);
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const steps = buildPlaybackStepsFromDerivationFrames(frames, undefined, undefined, replayPlan);
  const relationStepIndices = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.replayKind === 'relation');
  assert.equal(relationStepIndices.length, 2, 'each authored relation gets its own Replay moment');
  const firstRelationStepIndex = relationStepIndices[0].index;
  assert.ok(firstRelationStepIndex > 0, 'structural microsteps precede the first relation moment');

  // Each relation step carries its exact authored identity.
  const playedIdentities = relationStepIndices.map(({ step }) => step.replayRelationIdentity);
  assert.ok(playedIdentities.every((identity) =>
    identity && identity.stageIndex === 0 && Number.isInteger(identity.relationIndex)));

  // Before any relation moment: no same-stage marks.
  assert.equal(visiblePlanFrameItems(plan, 0, new Set()).length, 0);
  // After the first relation moment only its own exact mark shows.
  const afterFirst = visiblePlanFrameItems(plan, 0, new Set([playedIdentities[0].relationIndex]));
  assert.equal(afterFirst.length, 1);
  assert.equal(afterFirst[0].relationRef.relationIndex, playedIdentities[0].relationIndex);
  // After both moments, both marks show; the committed view shows everything.
  assert.equal(
    visiblePlanFrameItems(plan, 0, new Set(playedIdentities.map((identity) => identity.relationIndex))).length,
    2
  );
  assert.equal(visiblePlanFrameItems(plan, 0, null).length, 2);
});

/* ------------------------------------------------------------------ *
 * Blocker 5: stable lineage identity for indices.
 * ------------------------------------------------------------------ */

test('a lineage-keyed chain keeps its index as it grows from two to four occurrences', () => {
  const occurrence = (id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'x', { lineageId: 'stable-lin' })], { lineageId: 'stable-lin' });
  const other = (id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'y', { lineageId: 'other-lin' })], { lineageId: 'other-lin' });
  const forestA = [node('r1', 'TP', [occurrence('occ_a'), occurrence('occ_b'), other('oth_a'), other('oth_b')])];
  const forestB = [node('r1', 'TP', [
    occurrence('occ_a'), occurrence('occ_b'), occurrence('occ_c'), occurrence('occ_d'),
    other('oth_a'), other('oth_b')
  ])];
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'Identity', anchors: { occurrences: ['occ_a', 'occ_b'] } },
      { relation: 'Identity', anchors: { occurrences: ['oth_a', 'oth_b'] } }
    ], forestA),
    stage([
      { relation: 'Identity', anchors: { occurrences: ['occ_a', 'occ_b', 'occ_c', 'occ_d'] } }
    ], forestB)
  ]);
  const stageZero = plan.frames[0].items.filter((item) => item.kind === 'coindex');
  const grown = plan.frames[1].items.find((item) =>
    item.kind === 'coindex' && item.nodeIds.length === 4);
  const original = stageZero.find((item) => item.nodeIds.includes('occ_a'));
  const independent = stageZero.find((item) => item.nodeIds.includes('oth_a'));
  assert.ok(original && independent && grown);
  assert.equal(grown.index, original.index, 'the grown chain keeps its lineage-stable index');
  assert.notEqual(independent.index, original.index, 'independent chains keep distinct indices');
});

/* ------------------------------------------------------------------ *
 * Blocker 4: extra open roles never veto the specialized core.
 * ------------------------------------------------------------------ */

test('a known relation with required roles plus unknown extra scalar and array roles keeps its core mark', () => {
  const tree = node('tp_extra', 'TP', [
    node('a_ex', 'AP', [leaf('a_ex_l', 'A', 'a')]),
    node('b_ex', 'BP', [leaf('b_ex_l', 'B', 'b')]),
    node('c_ex', 'CPx', [leaf('c_ex_l', 'C', 'c')]),
    node('d_ex', 'DPx', [leaf('d_ex_l', 'D', 'd')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'Agree',
      anchors: {
        probe: 'a_ex',
        goal: 'b_ex',
        mysteryScalar: 'c_ex',
        mysteryArray: ['c_ex', 'd_ex']
      },
      values: { feature: 'φ', value: '3SG' }
    }], [tree])
  ]);
  const plaque = plan.frames[0].items.find((item) => item.kind === 'node-plaque');
  assert.ok(plaque, 'the specialized core mark survives the extra open roles');
  const fallback = plan.frames[0].items.find((item) => item.kind === 'fallback');
  assert.ok(fallback, 'the extra resolved participants keep neutral marks');
  const fallbackWitnesses = fallback.drawing.marks.map((mark) => mark.witness);
  assert.ok(fallbackWitnesses.includes('c_ex') && fallbackWitnesses.includes('d_ex'));
  assert.ok(!fallbackWitnesses.includes('a_ex') && !fallbackWitnesses.includes('b_ex'),
    'the neutral marks cover only the extra roles');
  assert.ok(plan.diagnostics.some((d) => d.kind === 'signature-incomplete'));
});

test('a known relation missing a required role keeps its witnesses inspectable through neutral presentation', () => {
  const tree = node('tp_missing', 'TP', [
    node('a_ms2', 'AP', [leaf('a_ms2_l', 'A', 'a')]),
    node('b_ms2', 'BP', [leaf('b_ms2_l', 'B', 'b')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'Binding',
      anchors: { binder: 'a_ms2', bound: 'b_ms2' } // required `domain` missing
    }], [tree])
  ]);
  assert.equal(plan.frames[0].items.filter((item) => item.kind === 'binding-domain').length, 0);
  const fallback = plan.frames[0].items.find((item) => item.kind === 'fallback');
  assert.ok(fallback, 'the authored instance does not disappear');
  assert.equal(fallback.drawing.row, 2, 'two resolved scalars keep their neutral undirected link');
});

/* ------------------------------------------------------------------ *
 * Blocker 8: PF composition provenance.
 * ------------------------------------------------------------------ */

test('multiple PF packages in one stage stay separate and collect only their own targeted insertions', () => {
  const tree = node('tp_pf2', 'TP', [
    node('root_a_pf', 'Root', [leaf('root_a_leaf', 'Root', '√A')]),
    node('t_a_pf', 'T', [leaf('t_a_leaf', 'T', '-ed')]),
    node('root_b_pf', 'Root', [leaf('root_b_leaf', 'Root', '√B')]),
    node('n_free_pf', 'n', [leaf('n_free_leaf', 'n', 'n')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'PFRealization', anchors: { root: 'root_a_pf', tense: 't_a_pf' } },
      { relation: 'PFRealization', anchors: { root: 'root_b_pf' } },
      { relation: 'VocabularyInsertion', anchors: { terminal: 'root_a_pf' }, values: { input: '√A', output: 'a' } },
      { relation: 'VocabularyInsertion', anchors: { terminal: 'root_b_pf' }, values: { input: '√B', output: 'b' } },
      { relation: 'VocabularyInsertion', anchors: { terminal: 'n_free_pf' }, values: { input: 'n', output: '-er' } },
      { relation: 'VocabularyInsertion', anchors: { terminal: 'missing_target' }, values: { input: 'X', output: 'x' } }
    ], [tree])
  ]);
  const plates = plan.frames[0].items.filter((item) => item.kind === 'node-plaque');
  const plateA = plates.find((plate) => plate.anchorNodeIds.includes('root_a_pf'));
  const plateB = plates.find((plate) => plate.anchorNodeIds.includes('root_b_pf'));
  const plateFree = plates.find((plate) => plate.anchorNodeIds.includes('n_free_pf'));
  assert.ok(plateA && plateB && plateFree);
  assert.deepEqual(plateA.rows, [{ label: 'input', value: '√A' }, { label: 'output', value: 'a' }]);
  assert.deepEqual(plateB.rows, [{ label: 'input', value: '√B' }, { label: 'output', value: 'b' }]);
  assert.deepEqual(plateFree.rows, [{ label: 'input', value: 'n' }, { label: 'output', value: '-er' }],
    'an unmatched insertion keeps its own plate and contaminates no package');
  // The unresolved insertion contributed nowhere and failed closed.
  assert.ok(plates.every((plate) => !plate.rows.some((row) => row.value === 'x')));
  assert.ok(plan.diagnostics.some((d) => d.kind === 'anchor-unresolved' && /missing_target/.test(d.detail)));
});

/* ------------------------------------------------------------------ *
 * Blocker 9: no invented linguistic claims.
 * ------------------------------------------------------------------ */

test('missing or unrecognized authored outcomes yield no judgment mark, never the opposite claim', () => {
  const tree = node('tp_out', 'TP', [
    node('src_out', 'XP', [leaf('w_out', 'X', 't', { silent: true })], { silent: true }),
    node('tgt_out', 'YP', [leaf('t_out', 'Y', 'word')])
  ]);
  const missing = compileRelationRenderPlan([
    stage([{
      relation: 'AntiLocality',
      anchors: { source: 'src_out', traceWitness: 'w_out', landing: 'tgt_out' }
    }], [tree])
  ]);
  const path = missing.frames[0].items.find((item) => item.kind === 'directed-path');
  assert.ok(path);
  assert.equal(path.outcome, undefined, 'no authored outcome, no invented judgment');
  assert.ok(missing.diagnostics.some((d) => d.kind === 'value-unrecognized'));
  const positions = new Map([
    ['src_out', { x: 100, y: 100 }], ['w_out', { x: 100, y: 200 }],
    ['tgt_out', { x: 400, y: 50 }], ['t_out', { x: 400, y: 150 }]
  ]);
  const bound = bindRelationPlanFrame(missing, 0, (nodeId) => positions.get(nodeId) || null);
  const shape = bound.primitives.find((p) => p.type === 'shape-path' && p.shapeStyle === 'anti-locality');
  assert.ok(shape);
  assert.equal(shape.tip, undefined, 'neither the bar nor the check is invented');

  const garbled = compileRelationRenderPlan([
    stage([{
      relation: 'Binding',
      anchors: { binder: 'src_out', bound: 'tgt_out', domain: 'tp_out' },
      values: { outcome: 'sideways' }
    }], [tree])
  ]);
  const binding = garbled.frames[0].items.find((item) => item.kind === 'binding-domain');
  assert.equal(binding.outcome, undefined);
  assert.ok(garbled.diagnostics.some((d) => d.kind === 'value-unrecognized'));
});

/* ------------------------------------------------------------------ *
 * Blocker 7: complete accepted family drawings.
 * ------------------------------------------------------------------ */

test('Right Roof keeps its movement path with the authored judgment, plus the compact roof', () => {
  const tree = node('tp_rr2', 'TP', [
    node('roof_rr2', 'CP', [leaf('c_rr2', 'C', 'that')]),
    node('src_rr2', 'XP', [leaf('w_rr2', 'X', 't', { silent: true })], { silent: true }),
    node('tgt_rr2', 'YP', [leaf('t_rr2', 'Y', 'word')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'RightRoof',
      anchors: { roof: 'roof_rr2', source: 'src_rr2', traceWitness: 'w_rr2', landing: 'tgt_rr2' },
      values: { outcome: 'blocked' }
    }], [tree])
  ]);
  const roofMark = plan.frames[0].items.find((item) => item.kind === 'domain-mark');
  const roofPath = plan.frames[0].items.find((item) =>
    item.kind === 'directed-path' && item.pathStyle === 'right-roof');
  assert.ok(roofMark && roofPath, 'the roof and the movement path both draw');
  assert.equal(roofPath.fromNodeId, 'w_rr2');
  assert.equal(roofPath.toNodeId, 'tgt_rr2');
  assert.equal(roofPath.outcome, 'blocked');
});

test('Improper Movement draws the rejected candidate paths, the region, and the host marks', () => {
  const tree = node('tp_im2', 'TP', [
    node('src_im2', 'XP', [leaf('w_im2', 'X', 't', { silent: true })], { silent: true }),
    node('land_im2', 'YP', [leaf('l_im2', 'Y', 'landed')]),
    node('rej_a_im2', 'ZP', [leaf('ra_im2', 'Z', 'za')]),
    node('rej_b_im2', 'ZP', [leaf('rb_im2', 'Z', 'zb')]),
    node('lic_im2', 'WP', [leaf('li_im2', 'W', 'w')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'ImproperMovement',
      anchors: {
        source: 'src_im2', traceWitness: 'w_im2', licensedLanding: 'land_im2',
        licensedLandingHosts: ['lic_im2'],
        rejectedLandingHosts: ['rej_a_im2', 'rej_b_im2'],
        forbiddenRegion: ['rej_a_im2', 'rej_b_im2']
      }
    }], [tree])
  ]);
  const candidatePaths = plan.frames[0].items.filter((item) =>
    item.kind === 'directed-path' && item.pathStyle === 'improper-candidate');
  assert.equal(candidatePaths.length, 2, 'each rejected host gets its candidate path');
  assert.deepEqual(candidatePaths.map((item) => item.toNodeId), ['rej_a_im2', 'rej_b_im2']);
  assert.ok(plan.frames[0].items.some((item) =>
    item.kind === 'domain-mark' && item.domainStyle === 'forbidden-region'));
  assert.ok(plan.frames[0].items.some((item) => item.kind === 'node-badges'));
});

/* ------------------------------------------------------------------ *
 * Blocker 10: large arrays without false ownership.
 * ------------------------------------------------------------------ */

test('large Cooper storage arrays receive the organizational policy — the plaque does not own them', () => {
  const members = ['cs_q1', 'cs_q2', 'cs_q3', 'cs_q4', 'cs_q5', 'cs_q6'];
  const tree = node('s_cs2', 'S', [
    node('scope_cs2', 'VPx', [leaf('v_cs2', 'V', 'v')]),
    ...members.map((id) => node(id, 'QPx', [leaf(`${id}_l`, 'Q', 'q')]))
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'CooperStorage',
      anchors: { scope: 'scope_cs2', quantifiers: members },
      values: { category: 'S' }
    }], [tree])
  ]);
  assert.ok(plan.frames[0].items.some((item) => item.kind === 'node-plaque'));
  const anchorSet = plan.frames[0].items.find((item) => item.kind === 'anchor-set');
  assert.ok(anchorSet, 'the accepted organizational policy applies to the large array');
  assert.deepEqual(
    anchorSet.set.roles.find((role) => role.role === 'quantifiers').anchors.map((anchor) => anchor.nodeId),
    members
  );
});

test('three unknown array groups keep every participant and separate organizational rails', () => {
  const groupA = ['ga_1', 'ga_2', 'ga_3', 'ga_4', 'ga_5'];
  const groupB = ['gb_1', 'gb_2', 'gb_3', 'gb_4', 'gb_5'];
  const groupC = ['gc_1', 'gc_2', 'gc_3', 'gc_4', 'gc_5'];
  const all = [...groupA, ...groupB, ...groupC];
  const tree = node('root_3g', 'TP', all.map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])));
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'TripleOpenGrouping',
      anchors: { alpha: groupA, beta: groupB, gamma: groupC }
    }], [tree])
  ]);
  const fallback = plan.frames[0].items.find((item) => item.kind === 'fallback');
  assert.ok(fallback);
  assert.equal(fallback.drawing.marks.length, 15, 'every participant keeps a mark');
  const anchorSet = plan.frames[0].items.find((item) => item.kind === 'anchor-set');
  assert.ok(anchorSet);
  assert.equal(anchorSet.set.roles.filter((role) => role.large).length, 3);
  const positions = new Map(all.map((id, index) => [id, { x: (index % 5) * 150 + Math.floor(index / 5) * 20, y: 100 + Math.floor(index / 5) * 40 }]));
  positions.set('root_3g', { x: 400, y: 0 });
  const bound = bindRelationPlanFrame(plan, 0, (nodeId) => positions.get(nodeId) || null);
  const rails = bound.primitives.filter((p) => p.type === 'anchor-set-rail');
  assert.equal(rails.length, 3, 'each role group keeps its own rail');
  assert.equal(new Set(rails.map((rail) => rail.lane)).size, rails.length,
    'overlapping rails take distinct lanes — no frame or numeral collisions');
});
