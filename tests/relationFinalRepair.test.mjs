import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileRelationRenderPlan,
  visiblePlanFrameItems
} from '../replay/relations/renderPlanCompiler.ts';
import {
  adaptDerivationStagesForReplay,
  buildPlaybackStepsFromDerivationFrames
} from '../replay/replayCompiler.ts';
import { bindRelationPlanFrame } from '../replay/relations/geometryBinding.ts';
import { buildDerivationReplayPlan } from '../derivationReplayPlan.js';

const leaf = (id, label, word, extra = {}) => ({ id, label, ...(word ? { word } : {}), ...extra });
const node = (id, label, children, extra = {}) => ({ id, label, children, ...extra });
const stage = (relations, forest) => ({
  statement: 'A derivational state holds.',
  stageRecord: 'A record of the derivational state, long enough to be substantive prose.',
  relations: relations,
  workspaceForest: forest
});

const forest = () => [node('root_fr', 'TP', [
  node('a_fr', 'AP', [leaf('a_fr_l', 'A', 'a')]),
  node('b_fr', 'BP', [leaf('b_fr_l', 'B', 'b')]),
  node('c_fr', 'CPx', [leaf('c_fr_l', 'C', 'c')]),
  node('site_fr', 'VP', [leaf('v_fr', 'V', 'read', { silent: true })])
])];

/* ------------------------------------------------------------------ *
 * Task 1: coalesce only the complete same claim.
 * ------------------------------------------------------------------ */

test('coincident items from different render families both survive', () => {
  // Recoverability and licensing both compile an ellipsis-site item at the
  // same silent site; they are different families making different claims.
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'EllipsisRecoverability', anchors: { site: 'site_fr' } },
      { relation: 'EllipsisLicensing', anchors: { licensor: 'a_fr', domain: 'site_fr' } }
    ], forest())
  ]);
  const sites = plan.frames[0].items.filter((item) => item.kind === 'ellipsis-site');
  assert.equal(sites.length, 2, 'sharing a site is not identity across families');
  assert.notEqual(sites[0].familyId, sites[1].familyId);
});

test('ellipsis claims at one site naming different antecedents both survive', () => {
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'EllipsisRecoverability', anchors: { site: 'site_fr', antecedent: 'a_fr' } },
      { relation: 'EllipsisRecoverability', anchors: { site: 'site_fr', antecedent: 'b_fr' } }
    ], forest())
  ]);
  const sites = plan.frames[0].items.filter((item) => item.kind === 'ellipsis-site');
  assert.equal(sites.length, 2, 'a different antecedent is a different authored claim');
  assert.deepEqual(sites.map((item) => item.antecedentNodeId).sort(), ['a_fr', 'b_fr']);
});

test('same geometry with different labels, values, or outcomes never merges', () => {
  const plan = compileRelationRenderPlan([
    stage([
      {
        relation: 'AntiLocality',
        anchors: { source: 'site_fr', traceWitness: 'v_fr', landing: 'a_fr' },
        values: { outcome: 'blocked' }
      },
      {
        relation: 'AntiLocality',
        anchors: { source: 'site_fr', traceWitness: 'v_fr', landing: 'a_fr' },
        values: { outcome: 'licensed' }
      }
    ], forest())
  ]);
  const paths = plan.frames[0].items.filter((item) => item.pathStyle === 'anti-locality');
  assert.equal(paths.length, 2, 'a different authored outcome is a different claim');
  assert.deepEqual(paths.map((item) => item.outcome).sort(), ['blocked', 'licensed']);
});

test('unregistered relation names remain exact during coalescing', () => {
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'OpenRelation', anchors: { source: 'a_fr', target: 'b_fr' } },
      { relation: 'openrelation', anchors: { source: 'a_fr', target: 'b_fr' } }
    ], forest())
  ]);

  const fallbacks = plan.frames[0].items.filter((item) => item.kind === 'fallback');
  assert.equal(fallbacks.length, 2);
  assert.deepEqual(fallbacks.map((item) => item.relationRef.relation), [
    'OpenRelation',
    'openrelation'
  ]);
});

test('genuinely identical claims paint once with every authored reference retained, including across persistence', () => {
  const shared = forest();
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } }
    ], shared),
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } }
    ], shared)
  ]);
  const frameZero = plan.frames[0].items.filter((item) => item.kind === 'coindex');
  assert.equal(frameZero.length, 1, 'identical same-stage claims paint once');
  assert.ok(
    frameZero[0].coalescedRefs.some((ref) => ref.stageIndex === 0 && ref.relationIndex === 1),
    'the coalesced instance keeps its authored reference'
  );
  const frameOne = plan.frames[1].items.filter((item) => item.kind === 'coindex');
  assert.equal(frameOne.length, 1, 'a persisted claim and its identical later restatement paint once');
  const refs = [frameOne[0].relationRef, ...(frameOne[0].coalescedRefs || [])]
    .map((ref) => `${ref.stageIndex}:${ref.relationIndex}`);
  assert.ok(refs.includes('1:0'), 'the later authored instance is still recorded');
});

/* ------------------------------------------------------------------ *
 * Task 2: exact identities, robust to placement reordering.
 * ------------------------------------------------------------------ */

test('when playback placement order differs from authored order, identities stay exact', () => {
  // Two workspace roots assembled in sequence: relation 0 anchors inside the
  // SECOND root, relation 1 inside the first, so relation 1's anchors become
  // visible at an earlier structural step and its moment places first.
  const rootA = node('root_a_ord', 'AP', [
    node('a1_ord', 'A1', [leaf('a1_l', 'A', 'alpha')]),
    node('a2_ord', 'A2', [leaf('a2_l', 'A', 'ann')])
  ]);
  const rootB = node('root_b_ord', 'BP', [
    node('b1_ord', 'B1', [leaf('b1_l', 'B', 'beta')]),
    node('b2_ord', 'B2', [leaf('b2_l', 'B', 'ben')])
  ]);
  const stages = [stage([
    { relation: 'Coreference', anchors: { first: 'b1_ord', second: 'b2_ord' } },
    { relation: 'Coreference', anchors: { first: 'a1_ord', second: 'a2_ord' } }
  ], [rootA, rootB])];
  const frames = adaptDerivationStagesForReplay(stages);
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const steps = buildPlaybackStepsFromDerivationFrames(frames, undefined, undefined, replayPlan);
  const played = steps
    .filter((step) => step.replayKind === 'relation')
    .map((step) => step.replayRelationIdentity);
  assert.equal(played.length, 2);
  assert.deepEqual(
    [...played.map((identity) => identity.relationIndex)].sort(),
    [0, 1],
    'both authored identities play exactly once'
  );
  assert.deepEqual(
    played.map((identity) => identity.relationIndex),
    [1, 0],
    'placement order differs from authored order, so a count would misidentify the moments'
  );

  // Revealing by the FIRST PLAYED identity shows relation 1's mark, not
  // relation 0's — the exact behavior a count-based reveal gets wrong.
  const plan = compileRelationRenderPlan(stages);
  const afterFirstMoment = visiblePlanFrameItems(plan, 0, new Set([played[0].relationIndex]));
  assert.equal(afterFirstMoment.length, 1);
  assert.equal(afterFirstMoment[0].relationRef.relationIndex, 1);
});

test('sequential relation entries get separate Replay frames while one multi-anchor entry stays together', () => {
  const shared = forest();
  const sequentialStages = [stage([
    {
      relation: 'CyclicAgree',
      anchors: { probe: 'a_fr', goal: 'b_fr' },
      values: { cycle: '1' }
    },
    {
      relation: 'CyclicAgree',
      anchors: { probe: 'a_fr', goal: 'c_fr' },
      values: { cycle: '2' }
    }
  ], shared)];
  const sequentialFrames = adaptDerivationStagesForReplay(sequentialStages);
  const sequentialPlan = buildDerivationReplayPlan({ derivationStages: sequentialStages });
  const sequentialSteps = buildPlaybackStepsFromDerivationFrames(
    sequentialFrames,
    undefined,
    undefined,
    sequentialPlan
  );
  const relationFrames = sequentialSteps.filter((step) => step.replayKind === 'relation');
  assert.deepEqual(
    relationFrames.map((step) => step.replayRelationIdentity),
    [
      { stageIndex: 0, relationIndex: 0 },
      { stageIndex: 0, relationIndex: 1 }
    ]
  );
  relationFrames.forEach((frame) => {
    const block = frame.detailBlocks?.find((candidate) => candidate.title === 'Relations');
    assert.equal(block?.lines.length, 1, 'each Replay frame describes only its active relation entry');
  });

  const simultaneousStages = [stage([{
    relation: 'MultipleAgree',
    anchors: { probe: 'a_fr', goals: ['b_fr', 'c_fr'] }
  }], shared)];
  const simultaneousFrames = adaptDerivationStagesForReplay(simultaneousStages);
  const simultaneousPlan = buildDerivationReplayPlan({ derivationStages: simultaneousStages });
  const simultaneousSteps = buildPlaybackStepsFromDerivationFrames(
    simultaneousFrames,
    undefined,
    undefined,
    simultaneousPlan
  );
  const simultaneousRelationFrames = simultaneousSteps.filter((step) => step.replayKind === 'relation');
  assert.equal(simultaneousRelationFrames.length, 1, 'one simultaneous relation entry is one Replay frame');
  const simultaneousBlock = simultaneousRelationFrames[0].detailBlocks
    ?.find((candidate) => candidate.title === 'Relations');
  assert.match(simultaneousBlock?.lines[0] || '', /Goals: b, C/i);
});

/* ------------------------------------------------------------------ *
 * Task 4: vanished anchors fail closed with structured diagnostics.
 * ------------------------------------------------------------------ */

test('a persistent mark whose anchored node vanishes is not drawn later, never retargeted, and stays in history', () => {
  const early = [node('root_v', 'TP', [
    node('binder_v', 'DP', [leaf('binder_l', 'D', 'she', { lineageId: 'her-lin' })]),
    node('bound_v', 'DP', [leaf('bound_l', 'D', 'herself', { lineageId: 'her-lin' })]),
    node('dom_v', 'VP', [leaf('dom_l', 'V', 'saw')])
  ])];
  // The bound node no longer exists later; a same-lineage cousin does — and
  // must NOT be chosen as a stand-in.
  const late = [node('root_v', 'TP', [
    node('binder_v', 'DP', [leaf('binder_l', 'D', 'she', { lineageId: 'her-lin' })]),
    node('cousin_v', 'DP', [leaf('cousin_l', 'D', 'her', { lineageId: 'her-lin' })]),
    node('dom_v', 'VP', [leaf('dom_l', 'V', 'saw')])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'Binding',
      anchors: { binder: 'binder_v', bound: 'bound_v', domain: 'dom_v' },
      values: { outcome: 'licensed' }
    }], early),
    stage([], late)
  ]);
  const frameZero = plan.frames[0].items.filter((item) => item.kind === 'binding-domain');
  assert.equal(frameZero.length, 1, 'the earlier Replay history keeps the correct mark');
  const frameOne = plan.frames[1].items.filter((item) => item.kind === 'binding-domain');
  assert.equal(frameOne.length, 0, 'the invalid later-stage mark is not drawn');
  assert.ok(
    plan.frames[1].items.every((item) => !JSON.stringify(item).includes('cousin_v')),
    'no lineage or proximity retargeting invents a substitute anchor'
  );
  const diagnostic = plan.diagnostics.find((d) => d.kind === 'anchor-vanished');
  assert.ok(diagnostic, 'the developer diagnostic is structured, not silent');
  assert.equal(diagnostic.stageIndex, 1);
  assert.equal(diagnostic.relation, 'Binding');
  assert.match(diagnostic.detail, /bound_v/);
});

/* ------------------------------------------------------------------ *
 * Task 5 / F67: identical strings are never one copy chain by themselves.
 * ------------------------------------------------------------------ */

test('identical surface strings are not treated as one chain without authored identity evidence', () => {
  const twoWhats = [node('root_w', 'TP', [
    node('wh_one', 'DP', [leaf('wh_one_l', 'D', 'what')]),
    node('wh_two', 'DP', [leaf('wh_two_l', 'D', 'what')]),
    node('wh_three', 'DP', [leaf('wh_three_l', 'D', 'what')]),
    node('wh_four', 'DP', [leaf('wh_four_l', 'D', 'what')])
  ])];
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'Identity', anchors: { occurrences: ['wh_one', 'wh_two'] } },
      { relation: 'Identity', anchors: { occurrences: ['wh_three', 'wh_four'] } }
    ], twoWhats)
  ]);
  const chains = plan.frames[0].items.filter((item) => item.kind === 'coindex');
  assert.equal(chains.length, 2);
  assert.notEqual(chains[0].index, chains[1].index,
    'same word, no shared authored lineage: two chains, never merged by string equality');
});

/* ------------------------------------------------------------------ *
 * Found by the final audit: a stage-identified frame must never borrow
 * an unrelated positionally-aligned derivation step.
 * ------------------------------------------------------------------ */

test('a synthesized SpellOut derivation step never reclassifies stage 1 or drops its relation moments', () => {
  const shared = forest();
  const stages = [
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'Coreference', anchors: { antecedent: 'b_fr', pronoun: 'c_fr' } }
    ], shared),
    stage([{ relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'c_fr' } }], shared)
  ];
  const frames = adaptDerivationStagesForReplay(stages);
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  // The app synthesizes a single SpellOut derivation step when the bundle
  // authors none; positional alignment would land it on stage 1.
  const synthesizedSteps = [{
    stepId: 'synthesized-spellout',
    operation: 'SpellOut',
    targetNodeId: 'root_fr',
    targetLabel: 'TP',
    sourceNodeIds: ['root_fr'],
    sourceLabels: ['TP'],
    spelloutOrder: ['a', 'b', 'c'],
    note: 'Committed surface order: a b c'
  }];
  const steps = buildPlaybackStepsFromDerivationFrames(
    frames, synthesizedSteps, 'a b c', replayPlan);
  const moments = steps
    .filter((step) => step.replayKind === 'relation')
    .map((step) => step.replayRelationIdentity);
  assert.deepEqual(
    moments.map((identity) => [identity.stageIndex, identity.relationIndex]),
    [[0, 0], [0, 1], [1, 0]],
    'every authored relation keeps its exact moment despite the synthesized step'
  );
});

/* ------------------------------------------------------------------ *
 * Codex review fixes.
 * ------------------------------------------------------------------ */

test('authored values distinguish claims even when the specialized primitive copies none of them', () => {
  // `coindex` items carry only nodeIds and an index — no outcome or label —
  // so this cannot pass accidentally through item.outcome.
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' }, values: { interpretation: 'bound-variable' } },
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' }, values: { interpretation: 'strict' } }
    ], forest())
  ]);
  const chains = plan.frames[0].items.filter((item) => item.kind === 'coindex');
  assert.equal(chains.length, 2, 'different authored values are different claims, never one mark');
  assert.deepEqual(
    chains.map((item) => item.relationRef.values.interpretation).sort(),
    ['bound-variable', 'strict']
  );
  // Different priorAnchors likewise distinguish otherwise-identical claims.
  const shared = forest();
  const priorPlan = compileRelationRenderPlan([
    stage([], shared),
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' }, priorAnchors: { antecedent: 'a_fr' } }
    ], shared)
  ]);
  assert.equal(
    priorPlan.frames[1].items.filter((item) => item.kind === 'coindex').length,
    2,
    'an authored priorAnchors block is meaning-bearing'
  );
});

test('a vanished extra open role never suppresses the valid specialized core', () => {
  const early = [node('root_x', 'TP', [
    node('ctrl_x', 'DP', [leaf('ctrl_l', 'D', 'kai')]),
    node('ctee_x', 'DP', [leaf('ctee_l', 'D', 'PRO', { silent: true })]),
    node('dom_x', 'VP', [leaf('dom_l', 'V', 'try')]),
    node('anno_x', 'XP', [leaf('anno_l', 'X', 'note')])
  ])];
  // Stage 2 keeps every required Control anchor and removes ONLY the extra
  // open annotation node.
  const late = [node('root_x', 'TP', [
    node('ctrl_x', 'DP', [leaf('ctrl_l', 'D', 'kai')]),
    node('ctee_x', 'DP', [leaf('ctee_l', 'D', 'PRO', { silent: true })]),
    node('dom_x', 'VP', [leaf('dom_l', 'V', 'try')])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'Control',
      anchors: { controller: 'ctrl_x', controllee: 'ctee_x', domain: 'dom_x', annotation: 'anno_x' }
    }], early),
    stage([], late)
  ]);
  const frameOneKinds = plan.frames[1].items.map((item) => item.kind).sort();
  assert.ok(frameOneKinds.includes('directed-path'), 'the Control path survives its own anchors');
  assert.ok(frameOneKinds.includes('domain-mark'), 'the Control domain survives its own anchors');
  assert.equal(
    plan.frames[1].items.some((item) => item.kind === 'fallback'),
    false,
    'only the neutral mark depending on the vanished extra role stops drawing'
  );
  const vanished = plan.diagnostics.filter((d) => d.kind === 'anchor-vanished');
  assert.equal(vanished.length, 1, 'one deduplicated diagnostic for one relation/stage/missing set');
  assert.match(vanished[0].detail, /anno_x/);
  assert.equal(vanished[0].stageIndex, 1);
});

test('the ghost lens presentation is real: active glows below pronounced, quiet recedes below neutral', async () => {
  const { ghostLensPresentation } = await import('../replay/relations/geometryBinding.ts');
  const active = ghostLensPresentation('active');
  const neutral = ghostLensPresentation(null);
  const quiet = ghostLensPresentation('quiet');
  assert.ok(quiet.opacity < neutral.opacity, 'quiet silence recedes below its neutral presentation');
  assert.ok(neutral.opacity < active.opacity, 'active silence is visibly foregrounded');
  assert.ok(active.opacity < 1, 'silent material never looks pronounced');
  assert.ok(active.filter && /drop-shadow/.test(active.filter), 'the active emphasis is carried by a real glow');
  assert.equal(neutral.filter, null);
  assert.equal(quiet.filter, null);
});

/* ------------------------------------------------------------------ *
 * Codex post-fix review: alias coalescing and rail dependencies.
 * ------------------------------------------------------------------ */

test('identical claims under two registered aliases of one family paint once with both authored refs', () => {
  const tree = node('cp_al', 'CP', [
    node('dp_hi_al', 'DP', [leaf('d_hi_al', 'D', 'what')]),
    node('tp_al', 'TP', [
      node('dp_lo_al', 'DP', [leaf('d_lo_al', 'D', 't', { silent: true })], { silent: true })
    ])
  ]);
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'AbarMove', anchors: { lowerCopy: 'dp_lo_al', traceWitness: 'd_lo_al', pronouncedCopy: 'dp_hi_al' } },
      { relation: 'wh-movement', anchors: { lowerCopy: 'dp_lo_al', traceWitness: 'd_lo_al', pronouncedCopy: 'dp_hi_al' } }
    ], [tree])
  ]);
  const trajectories = plan.frames[0].items.filter((item) => item.kind === 'trajectory');
  assert.equal(trajectories.length, 1,
    'two aliases of trajectory.phrasal making the identical complete claim are one mark');
  const refs = [trajectories[0].relationRef, ...(trajectories[0].coalescedRefs || [])];
  assert.deepEqual(refs.map((ref) => ref.relation).sort(), ['AbarMove', 'wh-movement'],
    'both authored relation references stay retained so either Replay moment activates the mark');
});

test('A-movement and A-bar movement remain distinct claims despite sharing phrasal geometry', () => {
  const tree = node('cp_distinct', 'CP', [
    node('dp_hi_distinct', 'DP', [leaf('d_hi_distinct', 'D', 'what')]),
    node('tp_distinct', 'TP', [
      node('dp_lo_distinct', 'DP', [leaf('d_lo_distinct', 'D', 't', { silent: true })], { silent: true })
    ])
  ]);
  const anchors = {
    lowerCopy: 'dp_lo_distinct',
    traceWitness: 'd_lo_distinct',
    pronouncedCopy: 'dp_hi_distinct'
  };
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'AbarMove', anchors },
      { relation: 'AMove', anchors }
    ], [tree])
  ]);

  const trajectories = plan.frames[0].items.filter((item) => item.kind === 'trajectory');
  assert.equal(trajectories.length, 2);
  assert.deepEqual(trajectories.map((item) => item.relationRef.relation), ['AbarMove', 'AMove']);
});

test('unregistered open relations never collapse across different authored names', () => {
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'OpenTieAlpha', anchors: { first: 'a_fr', second: 'b_fr' } },
      { relation: 'OpenTieBeta', anchors: { first: 'a_fr', second: 'b_fr' } }
    ], forest())
  ]);
  const fallbacks = plan.frames[0].items.filter((item) => item.kind === 'fallback');
  assert.equal(fallbacks.length, 2,
    'an open relation has no registered family; its authored name is its identity');
});

test('a large-array rail depends only on the roles it renders, not stored non-large provenance', () => {
  const members = ['ch_1', 'ch_2', 'ch_3', 'ch_4', 'ch_5'];
  const chorusForest = (withAnnotation) => [node('root_ch', 'TP', [
    ...members.map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])),
    ...(withAnnotation ? [node('anno_ch', 'YP', [leaf('anno_ch_l', 'Y', 'y')])] : [])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'OpenChorus',
      anchors: { members, annotation: 'anno_ch' }
    }], chorusForest(true)),
    stage([], chorusForest(false))
  ]);
  const stageOneKinds = plan.frames[0].items.map((item) => item.kind).sort();
  assert.deepEqual(stageOneKinds, ['anchor-set', 'fallback']);
  const stageTwoKinds = plan.frames[1].items.map((item) => item.kind);
  assert.deepEqual(stageTwoKinds, ['anchor-set'],
    'the rail survives its own five rendered members; only the fallback (whose witness set included the annotation) stops');
  assert.ok(plan.diagnostics.some((d) => d.kind === 'anchor-vanished' && /anno_ch/.test(d.detail)));
});

test('a vanished rendered large-role member stops the rail with one diagnostic', () => {
  const members = ['cm_1', 'cm_2', 'cm_3', 'cm_4', 'cm_5'];
  const memberForest = (present) => [node('root_cm', 'TP',
    members.filter((id) => present.includes(id)).map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])))];
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'OpenChorus', anchors: { members } }], memberForest(members)),
    stage([], memberForest(members.slice(0, 4)))
  ]);
  assert.ok(plan.frames[0].items.some((item) => item.kind === 'anchor-set'));
  assert.equal(plan.frames[1].items.filter((item) => item.kind === 'anchor-set').length, 0,
    'a rail whose own rendered member vanished fails closed');
  const railDiagnostics = plan.diagnostics.filter((d) =>
    d.kind === 'anchor-vanished' && /cm_5/.test(d.detail));
  assert.equal(railDiagnostics.length, 1, 'one useful diagnostic, not duplicates');
});

test('a member unresolved at authoring is not a vanished dependency later; the partial rail persists unchanged', () => {
  const present = ['pr_a', 'pr_b', 'pr_c', 'pr_d'];
  const chorusForest = [node('root_pr', 'TP',
    present.map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])))];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'OpenChorus',
      anchors: { members: ['pr_a', 'pr_b', 'pr_missing', 'pr_c', 'pr_d'] }
    }], chorusForest),
    stage([], chorusForest)
  ]);
  assert.deepEqual(plan.frames[0].items.map((item) => item.kind).sort(), ['anchor-set', 'fallback']);
  assert.deepEqual(
    plan.frames[1].items.map((item) => item.kind).sort(),
    ['anchor-set', 'fallback'],
    'the unchanged partial rail persists exactly as it rendered at its authoring stage'
  );
  assert.equal(
    plan.diagnostics.filter((d) => d.kind === 'anchor-vanished').length,
    0,
    'no dependency changed between stages, so nothing "vanished"'
  );
  const unresolved = plan.diagnostics.filter((d) => d.kind === 'large-array-anchor-unresolved');
  assert.equal(unresolved.length, 1, 'the never-resolved member keeps only its original diagnostic');
  assert.match(unresolved[0].detail, /pr_missing/);

  // Geometry: the persisted rail binds at stage 2 over exactly the resolved
  // members; the unresolved member gets no geometry at any stage.
  const positions = new Map(present.map((id, index) => [id, { x: 100 + index * 120, y: 200 }]));
  positions.set('root_pr', { x: 300, y: 40 });
  const bound = bindRelationPlanFrame(plan, 1, (nodeId) => positions.get(nodeId) || null);
  assert.ok(
    bound.primitives.some((p) => p.type === 'anchor-set-rail'),
    'the partial rail draws at stage 2 from real positions'
  );
  assert.ok(
    !JSON.stringify(bound.primitives).includes('pr_missing'),
    'no primitive ever references the unresolved member'
  );
});

/* ------------------------------------------------------------------ *
 * Deletion-only stage reachability: the vanished-anchor guarantee must
 * be observable in Replay, not only in the compiled plan.
 * ------------------------------------------------------------------ */

const deletionStages = (silent) => {
  const boundExtra = silent ? { silent: true } : {};
  const early = [node('root_del', 'TP', [
    node('binder_del', 'DP', [leaf('binder_del_l', 'D', 'she')]),
    node('bound_del', 'DP', [leaf('bound_del_l', 'D', 'herself', boundExtra)], boundExtra),
    node('dom_del', 'VP', [leaf('dom_del_l', 'V', 'saw')])
  ])];
  const late = [node('root_del', 'TP', [
    node('binder_del', 'DP', [leaf('binder_del_l', 'D', 'she')]),
    node('dom_del', 'VP', [leaf('dom_del_l', 'V', 'saw')])
  ])];
  return [
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'binder_del', pronoun: 'bound_del' } }
    ], early),
    stage([], late)
  ];
};

const assertStageTwoReachable = (stages) => {
  const frames = adaptDerivationStagesForReplay(stages);
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const steps = buildPlaybackStepsFromDerivationFrames(frames, undefined, undefined, replayPlan);
  const stageTwoMacro = steps.find((step) =>
    step.replayKind === 'macro' && Number(step.visualFrameIndex) === 1);
  assert.ok(stageTwoMacro, 'the deletion-only stage owns a reachable Stage Record state');
  assert.match(String(stageTwoMacro.replayProgressLabel || ''), /Stage 2\/2/);
  assert.equal(
    (stageTwoMacro.replayVisibleNodeIds || []).some((id) => String(id).includes('bound_del')),
    false,
    'the stage 2 canvas omits the vanished node'
  );
  assert.equal(
    JSON.stringify(stageTwoMacro.replayRelationLinks || []).includes('bound_del'),
    false,
    'no stale relation link survives the loss of its dependency'
  );
  const stageOneMoments = steps.filter((step) =>
    step.replayKind === 'relation' && step.replayRelationIdentity?.stageIndex === 0);
  assert.equal(stageOneMoments.length, 1, 'stage 1 Replay history stays intact');
  assert.equal(stageOneMoments[0].replayRelationIdentity.relationIndex, 0);
  // The compiled plan agrees: frame 1 has no coindex mark, with the
  // structured vanished-anchor diagnostic.
  const plan = compileRelationRenderPlan(stages);
  assert.ok(plan.frames[0].items.some((item) => item.kind === 'coindex'));
  assert.equal(plan.frames[1].items.filter((item) => item.kind === 'coindex').length, 0);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'anchor-vanished'));
};

test('a stage whose only change removes a silent anchored node stays reachable with the relation gone', () => {
  assertStageTwoReachable(deletionStages(true));
});

test('the authored complete-tree contract also reaches a stage that removed an overt node', () => {
  // Stage forests are authored complete states; the per-stage Stage Record
  // displays exactly the authored state, so an authored overt removal is
  // reachable at macro level. Transient microstep guards still forbid
  // arbitrary overt loss inside a stage — only the authoritative Stage
  // Record carries the authored delta.
  assertStageTwoReachable(deletionStages(false));
});

/* ------------------------------------------------------------------ *
 * Temporal coalescing: future references never leak backward through
 * shared plan-item objects.
 * ------------------------------------------------------------------ */

test('an identical later restatement never leaks its reference into the earlier frame', () => {
  const shared = forest();
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } }], shared),
    stage([{ relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } }], shared)
  ]);
  const frameZero = plan.frames[0].items.filter((item) => item.kind === 'coindex');
  assert.equal(frameZero.length, 1);
  assert.deepEqual(
    [frameZero[0].relationRef, ...(frameZero[0].coalescedRefs || [])]
      .map((ref) => [ref.stageIndex, ref.relationIndex]),
    [[0, 0]],
    'frame 1 knows only the stage 1 authored reference — nothing from the future'
  );
  const frameOne = plan.frames[1].items.filter((item) => item.kind === 'coindex');
  assert.equal(frameOne.length, 1, 'the co-visible later frame paints one mark');
  assert.deepEqual(
    [frameOne[0].relationRef, ...(frameOne[0].coalescedRefs || [])]
      .map((ref) => [ref.stageIndex, ref.relationIndex]).sort(),
    [[0, 0], [1, 0]],
    'the later frame retains both authored references'
  );
});

test('same-stage identical duplicates still coalesce with both same-stage refs, frame-locally', () => {
  const shared = forest();
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } }
    ], shared),
    stage([], shared)
  ]);
  for (const frameIndex of [0, 1]) {
    const chains = plan.frames[frameIndex].items.filter((item) => item.kind === 'coindex');
    assert.equal(chains.length, 1);
    assert.deepEqual(
      [chains[0].relationRef, ...(chains[0].coalescedRefs || [])]
        .map((ref) => [ref.stageIndex, ref.relationIndex]).sort(),
      [[0, 0], [0, 1]],
      `frame ${frameIndex} carries exactly the two stage-1 refs`
    );
  }
});

test('cross-stage registered aliases obey the temporal law: one ref first, both refs later', () => {
  const aliasTree = node('cp_tal', 'CP', [
    node('dp_hi_tal', 'DP', [leaf('d_hi_tal', 'D', 'what')]),
    node('tp_tal', 'TP', [
      node('dp_lo_tal', 'DP', [leaf('d_lo_tal', 'D', 't', { silent: true })], { silent: true })
    ])
  ]);
  const anchors = { lowerCopy: 'dp_lo_tal', traceWitness: 'd_lo_tal', pronouncedCopy: 'dp_hi_tal' };
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'AbarMove', anchors }], [aliasTree]),
    stage([{ relation: 'wh-movement', anchors }], [aliasTree])
  ]);
  const frameZero = plan.frames[0].items.filter((item) => item.kind === 'trajectory');
  assert.equal(frameZero.length, 1);
  assert.deepEqual(
    [frameZero[0].relationRef, ...(frameZero[0].coalescedRefs || [])].map((ref) => ref.relation),
    ['AbarMove'],
    'the earlier frame carries exactly one authored reference'
  );
  const frameOne = plan.frames[1].items.filter((item) => item.kind === 'trajectory');
  assert.equal(frameOne.length, 1, 'the later co-visible frame paints one alias-coalesced trajectory');
  assert.deepEqual(
    [frameOne[0].relationRef, ...(frameOne[0].coalescedRefs || [])].map((ref) => ref.relation).sort(),
    ['AbarMove', 'wh-movement']
  );
  // The stage-2 wh-movement relation moment can activate the one mark.
  const revealed = visiblePlanFrameItems(plan, 1, new Set([0]));
  assert.ok(
    revealed.some((item) => item.kind === 'trajectory'),
    'the stage 2 alias moment reveals/activates the coalesced mark in its own frame'
  );
});

/* ------------------------------------------------------------------ *
 * Replacement continuity requires a COMPLETE resolving prior block.
 * ------------------------------------------------------------------ */

const dcForest = (ids) => [node('root_dc', 'TP',
  ids.map((id) => node(`dc_${id}`, 'XP', [leaf(`dc_${id}_l`, 'X', 'x')])))];

test('an unresolved prior block never proves continuity: the earlier claim returns beside the new one', () => {
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'DependentCase', anchors: { probe: 'dc_a', goal: 'dc_b' }, values: { goalLabel: 'ACC' } }], dcForest(['a', 'b'])),
    stage([], dcForest(['a'])),
    stage([{
      relation: 'DependentCase',
      anchors: { probe: 'dc_a', goal: 'dc_c' },
      values: { goalLabel: 'ERG' },
      priorAnchors: { probe: 'dc_a', goal: 'dc_b' }
    }], dcForest(['a', 'b', 'c']))
  ]);
  // Stage 2: OLD correctly cannot draw; its dependency vanished.
  assert.equal(plan.frames[1].items.filter((item) => item.pathStyle === 'dependent-case').length, 0);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'anchor-vanished'));
  // Stage 3: b's exact node returns, so OLD draws again; NEW coexists.
  const stageThree = plan.frames[2].items.filter((item) => item.pathStyle === 'dependent-case');
  assert.deepEqual(
    stageThree.map((item) => `${item.fromNodeId}->${item.toNodeId}`).sort(),
    ['dc_a->dc_b', 'dc_a->dc_c'],
    'the invalid prior block erased nothing; both claims coexist'
  );
  const newClaim = stageThree.find((item) => item.toNodeId === 'dc_c');
  assert.equal(newClaim.replacementPredecessorGroup, undefined,
    'the goal witness did not resolve in the immediately preceding stage, so no predecessor thread exists');
  assert.equal(newClaim.backward, false, 'an incomplete prior block draws no backward continuity cue');
  assert.deepEqual(newClaim.priorWitnessNodeIds, []);
  assert.deepEqual(
    newClaim.relationRef.priorAnchors,
    { probe: 'dc_a', goal: 'dc_b' },
    'the authored block is retained verbatim in provenance'
  );
  assert.ok(plan.diagnostics.some((d) => d.kind === 'prior-anchor-unresolved'));
});

test('a partially resolved prior block is diagnosed and proves nothing — no subset stands in for the whole', () => {
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'DependentCase', anchors: { probe: 'dc_a', goal: 'dc_b' }, values: { goalLabel: 'ACC' } }], dcForest(['a', 'b'])),
    stage([{
      relation: 'DependentCase',
      anchors: { probe: 'dc_a', goal: 'dc_c' },
      values: { goalLabel: 'ERG' },
      // probe resolves in stage 1; the phantom goal does not.
      priorAnchors: { probe: 'dc_a', goal: 'dc_phantom' }
    }], dcForest(['a', 'b', 'c']))
  ]);
  const stageTwo = plan.frames[1].items.filter((item) => item.pathStyle === 'dependent-case');
  assert.deepEqual(
    stageTwo.map((item) => `${item.fromNodeId}->${item.toNodeId}`).sort(),
    ['dc_a->dc_b', 'dc_a->dc_c'],
    'the partially resolved block replaces nothing'
  );
  const newClaim = stageTwo.find((item) => item.toNodeId === 'dc_c');
  assert.equal(newClaim.replacementPredecessorGroup, undefined);
  assert.equal(newClaim.backward, false);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'prior-anchor-unresolved'));
});

test('a complete resolving prior block still proves changed-participant replacement with the backward cue', () => {
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'DependentCase', anchors: { probe: 'dc_a', goal: 'dc_b' }, values: { goalLabel: 'ACC' } }], dcForest(['a', 'b'])),
    stage([{
      relation: 'DependentCase',
      anchors: { probe: 'dc_a', goal: 'dc_c' },
      values: { goalLabel: 'ERG' },
      priorAnchors: { probe: 'dc_a', goal: 'dc_b' }
    }], dcForest(['a', 'b', 'c']))
  ]);
  const stageTwo = plan.frames[1].items.filter((item) => item.pathStyle === 'dependent-case');
  assert.deepEqual(stageTwo.map((item) => `${item.fromNodeId}->${item.toNodeId}`), ['dc_a->dc_c'],
    'proven continuity replaces the earlier state');
  assert.equal(stageTwo[0].backward, true);
  assert.deepEqual([...stageTwo[0].priorWitnessNodeIds].sort(), ['dc_a', 'dc_b']);
});

test('a relation moment in a node-returning stage survives the overt-material guards and reveals its mark', () => {
  const stages = [
    stage([{ relation: 'DependentCase', anchors: { probe: 'dc_a', goal: 'dc_b' }, values: { goalLabel: 'ACC' } }], dcForest(['a', 'b'])),
    stage([], dcForest(['a'])),
    stage([{
      relation: 'DependentCase',
      anchors: { probe: 'dc_a', goal: 'dc_c' },
      values: { goalLabel: 'ERG' },
      priorAnchors: { probe: 'dc_a', goal: 'dc_b' }
    }], dcForest(['a', 'b', 'c']))
  ];
  const frames = adaptDerivationStagesForReplay(stages);
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const steps = buildPlaybackStepsFromDerivationFrames(frames, undefined, undefined, replayPlan);
  const stageThreeMoments = steps.filter((step) =>
    step.replayKind === 'relation' && step.replayRelationIdentity?.stageIndex === 2);
  assert.equal(stageThreeMoments.length, 1,
    'the authored moment is preserved — the adds-overt guard never deletes a preserved relation step');
  assert.equal(stageThreeMoments[0].replayRelationIdentity.relationIndex, 0);
  // With that moment played, the frame reveals both coexisting claims.
  const plan = compileRelationRenderPlan(stages);
  const revealed = visiblePlanFrameItems(plan, 2, new Set([0]))
    .filter((item) => item.pathStyle === 'dependent-case');
  assert.deepEqual(
    revealed.map((item) => `${item.fromNodeId}->${item.toNodeId}`).sort(),
    ['dc_a->dc_b', 'dc_a->dc_c']
  );
});

/* ------------------------------------------------------------------ *
 * The adds-overt exemption is exact: only identity-proven authored
 * relation moments qualify; synthetic preserved steps never do.
 * ------------------------------------------------------------------ */

test('each authored relation yields exactly one genuine relation moment with its exact identity', async () => {
  const { isAuthoredRelationReplayMoment } = await import('../replay/replayCompiler.ts');
  const shared = forest();
  const stages = [
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'Coreference', anchors: { antecedent: 'b_fr', pronoun: 'c_fr' } }
    ], shared),
    stage([{ relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'c_fr' } }], shared)
  ];
  const frames = adaptDerivationStagesForReplay(stages);
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const steps = buildPlaybackStepsFromDerivationFrames(frames, undefined, undefined, replayPlan);
  const genuine = steps.filter(isAuthoredRelationReplayMoment);
  assert.deepEqual(
    genuine.map((step) => [step.replayRelationIdentity.stageIndex, step.replayRelationIdentity.relationIndex]),
    [[0, 0], [0, 1], [1, 0]],
    'one genuine moment per authored relation, each with its exact identity'
  );
  // No other step carries relation kind or identity.
  steps.filter((step) => !genuine.includes(step)).forEach((step) => {
    assert.notEqual(step.replayKind, 'relation');
    assert.equal(step.replayRelationIdentity, undefined);
  });
});

test('a synthetic pre-movement landing merge is structurally identified and cannot count as a played relation', async () => {
  const { insertPreMovementLandingMergeSteps, isAuthoredRelationReplayMoment } =
    await import('../replay/replayCompiler.ts');
  const canvas = node('root_lm', 'TP', [
    node('land_parent_lm', 'CP', [node('land_lm', 'XP', [leaf('land_lm_l', 'X', 'x')])])
  ]);
  // The previous step is a genuine relation moment; the next step's movement
  // link lands where the parent only now becomes visible — triggering the
  // synthetic merge, cloned FROM the relation step.
  const previous = {
    operation: 'Coreference',
    replayKind: 'relation',
    replayRelationIdentity: { stageIndex: 0, relationIndex: 0 },
    preserveReplayStep: true,
    targetNodeId: 'land_lm',
    targetLabel: 'XP',
    sourceLabels: [],
    replayCanvasData: canvas,
    replayVisibleNodeIds: ['root_lm', 'land_lm', 'land_lm_l']
  };
  const mover = {
    operation: 'HeadMovement',
    replayKind: 'micro',
    targetNodeId: 'land_lm',
    targetLabel: 'XP',
    sourceLabels: [],
    replayCanvasData: canvas,
    replayVisibleNodeIds: ['root_lm', 'land_parent_lm', 'land_lm', 'land_lm_l'],
    replayRelationLinks: [{ operation: 'HeadMovement', targetNodeId: 'land_lm', sourceNodeId: 'root_lm' }]
  };
  const expanded = insertPreMovementLandingMergeSteps([previous, mover]);
  assert.equal(expanded.length, 3, 'the synthetic landing merge was generated');
  const synthetic = expanded[1];
  assert.equal(synthetic.operation, 'ExternalMerge');
  assert.equal(synthetic.replayKind, 'micro', 'generated structural steps are structurally identified');
  assert.equal(synthetic.replayRelationIdentity, undefined,
    'the clone inherits no relation identity from the relation step it spread');
  assert.equal(isAuthoredRelationReplayMoment(synthetic), false);
  assert.equal(synthetic.preserveReplayStep, true, 'it stays a preserved structural state');
});

test('a generic preserveReplayStep flag alone cannot authorize an invalid overt-material jump', async () => {
  const { removeInvalidReplayVisibilityTransitions, isAuthoredRelationReplayMoment } =
    await import('../replay/replayCompiler.ts');
  const canvas = node('root_pg', 'TP', [
    node('dp_pg', 'DP', [leaf('dp_pg_l', 'D', 'kai')]),
    node('vp_pg', 'VP', [leaf('vp_pg_l', 'V', 'ran')])
  ]);
  const before = {
    operation: 'Project',
    replayKind: 'micro',
    replayProgressLabel: 'Stage 1/1 \u00b7 Step 1/2',
    targetNodeId: 'dp_pg',
    targetLabel: 'DP',
    sourceLabels: [],
    replayCanvasData: canvas,
    replayVisibleNodeIds: ['root_pg', 'dp_pg', 'dp_pg_l']
  };
  const invalidJump = {
    operation: 'Other',
    replayKind: 'micro',
    preserveReplayStep: true, // generic flag, NOT an authored relation moment
    targetNodeId: 'vp_pg',
    targetLabel: 'VP',
    sourceLabels: [],
    replayCanvasData: canvas,
    replayVisibleNodeIds: ['root_pg', 'dp_pg', 'dp_pg_l', 'vp_pg', 'vp_pg_l']
  };
  assert.equal(isAuthoredRelationReplayMoment(invalidJump), false);
  const kept = removeInvalidReplayVisibilityTransitions([before, invalidJump]);
  assert.deepEqual(kept.map((step) => step.operation), ['Project'],
    'the flagged-but-unproven overt jump is still rejected');

  // The same jump WITH an exact authored identity is the lawful exemption.
  const genuineMoment = {
    ...invalidJump,
    operation: 'Coreference',
    replayKind: 'relation',
    replayRelationIdentity: { stageIndex: 1, relationIndex: 0 }
  };
  const keptWithMoment = removeInvalidReplayVisibilityTransitions([before, genuineMoment]);
  assert.deepEqual(keptWithMoment.map((step) => step.operation), ['Project', 'Coreference']);
});

/* ------------------------------------------------------------------ *
 * Domain-layer persistence law: authored members are dependencies;
 * derived subtree geometry refreshes from the current frame.
 * ------------------------------------------------------------------ */

test('an authored forbidden-region member vanishing fails the region closed — no stale partial mark', () => {
  const improperForest = (withB) => [node('tp_im', 'TP', [
    node('src_im', 'XP', [leaf('w_im', 'X', 't', { silent: true })], { silent: true }),
    node('land_im', 'YP', [leaf('l_im', 'Y', 'landed')]),
    node('rej_a_im', 'ZP', [leaf('ra_im', 'Z', 'za')]),
    ...(withB ? [node('rej_b_im', 'ZP', [leaf('rb_im', 'Z', 'zb')])] : [])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'ImproperMovement',
      anchors: {
        source: 'src_im', traceWitness: 'w_im', licensedLanding: 'land_im',
        rejectedLandingHosts: ['rej_a_im', 'rej_b_im'],
        forbiddenRegion: ['rej_a_im', 'rej_b_im']
      }
    }], improperForest(true)),
    stage([], improperForest(false))
  ]);
  assert.ok(plan.frames[0].items.some((item) => item.domainStyle === 'forbidden-region'));
  assert.equal(
    plan.frames[1].items.filter((item) => item.domainStyle === 'forbidden-region').length,
    0,
    'forbiddenRegion members are direct authored anchors; the region fails closed when one vanishes'
  );
  assert.ok(plan.diagnostics.some((d) => d.kind === 'anchor-vanished' && /rej_b_im/.test(d.detail)));
  // Per-mark truthfulness: no drawn geometry in frame 2 references the
  // vanished node (verbatim relationRef provenance is not geometry).
  const drawnGeometry = plan.frames[1].items.map(({ relationRef, coalescedRefs, ...rest }) => rest);
  assert.equal(JSON.stringify(drawnGeometry).includes('rej_b_im'), false);
  // Marks depending only on surviving nodes persist.
  assert.ok(plan.frames[1].items.some((item) =>
    item.kind === 'directed-path' && item.toNodeId === 'rej_a_im'));
});

test('a persistent Phase arc describes the CURRENT anchored domain, not the authoring-stage snapshot', () => {
  const phaseForest = (withNew) => [node('root_ph', 'TP', [
    node('phase_ph', 'vP', [
      leaf('head_ph', 'v', 'v'),
      ...(withNew ? [node('new_dp_ph', 'DP', [leaf('new_d_ph', 'D', 'the')])] : [])
    ])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'Phase', anchors: { phase: 'phase_ph' } }], phaseForest(false)),
    stage([], phaseForest(true))
  ]);
  const authoring = plan.frames[0].items.find((item) => item.domainStyle === 'phase');
  assert.deepEqual([...authoring.memberNodeIds].sort(), ['head_ph', 'phase_ph']);
  const later = plan.frames[1].items.find((item) => item.domainStyle === 'phase');
  assert.deepEqual(
    [...later.memberNodeIds].sort(),
    ['head_ph', 'new_dp_ph', 'new_d_ph', 'phase_ph'].sort(),
    'derived membership refreshes from the exact anchored root in the current frame'
  );
});

test('ellipsis ghost membership refreshes per frame: newly silent material under the site ghosts later', () => {
  const siteForest = (withNewSilent) => [node('root_el2', 'TP', [
    node('site_el2', 'VP', [
      leaf('v_el2', 'V', 'read', { silent: true }),
      ...(withNewSilent
        ? [node('obj_el2', 'DP', [leaf('obj_el2_l', 'D', 'it', { silent: true })], { silent: true })]
        : [])
    ])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'EllipsisRecoverability', anchors: { site: 'site_el2' } }], siteForest(false)),
    stage([], siteForest(true))
  ]);
  const authoring = plan.frames[0].items.find((item) => item.kind === 'ellipsis-site');
  assert.deepEqual(authoring.ghostNodeIds, ['v_el2']);
  const later = plan.frames[1].items.find((item) => item.kind === 'ellipsis-site');
  assert.deepEqual(
    [...later.ghostNodeIds].sort(),
    ['obj_el2', 'obj_el2_l', 'v_el2'],
    'authored-silent ghost membership is current-frame truth, still never covering overt material'
  );
  assert.ok(later.siteSubtreeNodeIds.includes('obj_el2'), 'the slash region also refreshes');
});

test('the dependency law still spares extra open roles and never counts unresolved large members', () => {
  // Extra open role: the specialized core persists when only the extra
  // vanishes (same law as the earlier Control regression, re-proven under
  // the declared-metadata dependency extractor).
  const controlForest = (withExtra) => [node('root_x2', 'TP', [
    node('ctrl_x2', 'DP', [leaf('ctrl_x2_l', 'D', 'kai')]),
    node('ctee_x2', 'DP', [leaf('ctee_x2_l', 'D', 'PRO', { silent: true })], { silent: true }),
    node('dom_x2', 'VP', [leaf('dom_x2_l', 'V', 'try')]),
    ...(withExtra ? [node('anno_x2', 'XP', [leaf('anno_x2_l', 'X', 'note')])] : [])
  ])];
  const controlPlan = compileRelationRenderPlan([
    stage([{
      relation: 'Control',
      anchors: { controller: 'ctrl_x2', controllee: 'ctee_x2', domain: 'dom_x2', annotation: 'anno_x2' }
    }], controlForest(true)),
    stage([], controlForest(false))
  ]);
  assert.ok(controlPlan.frames[1].items.some((item) => item.kind === 'directed-path'));
  assert.ok(controlPlan.frames[1].items.some((item) => item.kind === 'domain-mark'));

  // Unresolved large member: the partial rail still persists unchanged.
  const present = ['lg_a', 'lg_b', 'lg_c', 'lg_d'];
  const railForest = [node('root_lg', 'TP',
    present.map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])))];
  const railPlan = compileRelationRenderPlan([
    stage([{ relation: 'OpenChorus', anchors: { members: [...present, 'lg_missing'] } }], railForest),
    stage([], railForest)
  ]);
  assert.ok(railPlan.frames[1].items.some((item) => item.kind === 'anchor-set'));
  assert.equal(railPlan.diagnostics.filter((d) => d.kind === 'anchor-vanished').length, 0);
});

test('a refresh root that lives only in metadata is still a hard dependency: the blocked lane fails closed', () => {
  const transferForest = (withDom) => [node('root_pta', 'TP', [
    node('src_pta', 'XP', [leaf('src_pta_l', 'X', 'a')]),
    node('tgt_pta', 'YP', [leaf('tgt_pta_l', 'Y', 'b')]),
    ...(withDom ? [node('dom_pta', 'ZP', [leaf('dom_pta_l', 'Z', 'c')])] : [])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'PostTransferAccess',
      anchors: { source: 'src_pta', target: 'tgt_pta', spellOutDomain: 'dom_pta' }
    }], transferForest(true)),
    stage([], transferForest(false))
  ]);
  assert.ok(plan.frames[0].items.some((item) => item.kind === 'blocked-access-lane'));
  assert.equal(
    plan.frames[1].items.filter((item) => item.kind === 'blocked-access-lane').length,
    0,
    'the drawing lost its authored transfer domain and may not survive it'
  );
  const vanished = plan.diagnostics.filter((d) => d.kind === 'anchor-vanished');
  assert.equal(vanished.length, 1, 'one truthful diagnostic');
  assert.match(vanished[0].detail, /dom_pta/);
});

/* ------------------------------------------------------------------ *
 * Atomic geometry binding: one item, one complete visual assertion.
 * ------------------------------------------------------------------ */

const bindWith = (stages, positions) =>
  bindRelationPlanFrame(
    compileRelationRenderPlan(stages),
    0,
    (nodeId) => positions.get(nodeId) || null
  );

test('a two-node coindex with one unmeasurable node emits no lone badge and reports the missing node', () => {
  const bound = bindWith(
    [stage([{ relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } }], forest())],
    new Map([['a_fr', { x: 100, y: 100 }]])
  );
  assert.deepEqual(bound.primitives, [], 'a lone index badge is not the authored two-node relation');
  assert.ok(bound.failed.some((f) => f.nodeId === 'b_fr'));
});

test('a binding item with a required participant unmeasurable emits no shrunken region or surviving index', () => {
  const bound = bindWith(
    [stage([{
      relation: 'Binding',
      anchors: { binder: 'a_fr', bound: 'b_fr', domain: 'root_fr' },
      values: { outcome: 'licensed' }
    }], forest())],
    // Domain members measurable; the bound participant is not.
    new Map([['a_fr', { x: 100, y: 100 }], ['root_fr', { x: 300, y: 0 }], ['c_fr', { x: 500, y: 100 }]])
  );
  assert.equal(bound.primitives.filter((p) => p.type === 'domain-ellipse').length, 0,
    'no shrunken region');
  assert.equal(bound.primitives.filter((p) => p.type === 'index-badge').length, 0,
    'no surviving index');
  assert.ok(bound.failed.some((f) => f.nodeId === 'b_fr'));
});

test('a fallback connector with one witness unmeasurable emits neither mark nor segment', () => {
  const bound = bindWith(
    [stage([{ relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'b_fr' } }], forest())],
    new Map([['a_fr', { x: 100, y: 100 }]])
  );
  assert.equal(bound.primitives.filter((p) => p.type === 'fallback-mark').length, 0,
    'no surviving witness mark');
  assert.equal(bound.primitives.filter((p) => p.type === 'segment').length, 0,
    'no partial connector');
  assert.ok(bound.failed.some((f) => f.nodeId === 'b_fr'));
});

test('a failed item consumes no stacking, ordinal, or lane state used by the next valid item', () => {
  const shared = forest();
  const positions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 300, y: 100 }], ['root_fr', { x: 300, y: 0 }]
  ]);
  // Failing items first (c_fr unmeasurable), chosen so state IS mutated
  // before each failure: the MysteryTie link pushes b_fr's mark and stack
  // before its other witness fails; the PFRealization plate binds at a_fr
  // and occupies plaque space before its root fails. Route ordinals and
  // connector lanes cannot currently mutate before an intra-item failure
  // (curves register only after both endpoints resolve; a link needs
  // exactly its two witnesses), so their restoration is structural
  // snapshot/restore rather than separately exercised here. Then valid
  // items of the same shapes: their geometry must equal a bind where the
  // failing items never existed. (Chain-bearing kinds are kept out of the
  // failing set: display numerals are allocated at compile time by design.)
  const withFailure = bindWith(
    [stage([
      { relation: 'MysteryTie', anchors: { first: 'b_fr', second: 'c_fr' } },
      { relation: 'CyclicAgree', anchors: { probe: 'a_fr', goal: 'c_fr' }, values: { cycle: '1' } },
      { relation: 'PFRealization', anchors: { tense: 'a_fr', root: 'c_fr' } },
      { relation: 'FeatureBundle', anchors: { bearer: 'c_fr' }, values: { Case: 'NOM' } },
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'OpenTieAlpha', anchors: { first: 'a_fr', second: 'b_fr' } },
      { relation: 'CyclicAgree', anchors: { probe: 'a_fr', goal: 'b_fr' }, values: { cycle: '2' } },
      { relation: 'FeatureBundle', anchors: { bearer: 'a_fr' }, values: { Case: 'ACC' } }
    ], shared)],
    positions
  );
  const clean = bindWith(
    [stage([
      { relation: 'Coreference', anchors: { antecedent: 'a_fr', pronoun: 'b_fr' } },
      { relation: 'OpenTieAlpha', anchors: { first: 'a_fr', second: 'b_fr' } },
      { relation: 'CyclicAgree', anchors: { probe: 'a_fr', goal: 'b_fr' }, values: { cycle: '2' } },
      { relation: 'FeatureBundle', anchors: { bearer: 'a_fr' }, values: { Case: 'ACC' } }
    ], shared)],
    positions
  );
  const geometryOf = (bound) => bound.primitives.map(({ itemIndex, ...rest }) => rest);
  assert.deepEqual(geometryOf(withFailure), geometryOf(clean),
    'rolled-back items leave no trace in stacking, ordinals, lanes, or routing');
  assert.equal(
    new Set(withFailure.failed.map((f) => `${f.itemIndex}|${f.nodeId}`)).size,
    withFailure.failed.length,
    'no duplicate diagnostics'
  );
  assert.ok(withFailure.failed.every((f) => f.nodeId === 'c_fr'), 'every failure names the missing node');
});

/* ------------------------------------------------------------------ *
 * Fallback connector geometry: complete bound routes, lanes included.
 * ------------------------------------------------------------------ */

test('a row-2 link connector starts and ends at its rendered mark centers, on its allocated lane', () => {
  const positions = new Map([['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 400, y: 140 }]]);
  const bound = bindRelationPlanFrame(
    compileRelationRenderPlan(
      [stage([{ relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'b_fr' } }], forest())]
    ),
    0,
    (nodeId) => positions.get(nodeId) || null,
    { labelHeight: 28, badgeGap: 22, laneGap: 24 }
  );
  const marks = bound.primitives.filter((p) => p.type === 'fallback-mark');
  const link = bound.primitives.find((p) => p.type === 'segment');
  assert.equal(link.route, 'counter-lane');
  assert.equal(typeof link.lane, 'number');
  const markCenter = (nodeId) => {
    const mark = marks.find((m) => m.nodeId === nodeId);
    return { x: mark.x, y: mark.y };
  };
  assert.deepEqual(link.from, markCenter('a_fr'),
    'the connector endpoint is the rendered mark center, label and stack offsets included');
  assert.deepEqual(link.to, markCenter('b_fr'));
  assert.match(link.d, new RegExp(`^M ${link.from.x.toFixed(1)} `), 'the path starts at the mark');
  assert.ok(link.d.includes('Q'), 'the counter-lane path carries its lane turns');
});

test('two overlapping row-2 links occupy visibly distinct lane geometry', () => {
  const positions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 400, y: 100 }],
    ['c_fr', { x: 200, y: 100 }], ['d_fr', { x: 500, y: 100 }]
  ]);
  const forestWide = [node('root_ol', 'TP', ['a_fr', 'b_fr', 'c_fr', 'd_fr']
    .map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])))];
  const bound = bindRelationPlanFrame(
    compileRelationRenderPlan([stage([
      { relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'b_fr' } },
      { relation: 'OtherTie', anchors: { first: 'c_fr', second: 'd_fr' } }
    ], forestWide)]),
    0,
    (nodeId) => positions.get(nodeId) || null,
    { laneGap: 24, connectorBaselineY: 300 }
  );
  const links = bound.primitives.filter((p) => p.type === 'segment');
  assert.equal(links.length, 2);
  assert.notEqual(links[0].lane, links[1].lane, 'overlapping spans take different lanes');
  const laneYOf = (d) => Number(d.split('L ')[2].trim().split(' ')[1]);
  assert.notEqual(laneYOf(links[0].d), laneYOf(links[1].d),
    'the allocated lanes appear in the actual rendered geometry, not merely as unused integers');
});

test('a row-3 fan emits direct hub-to-spoke geometry and no counter-lane path', () => {
  const positions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 300, y: 200 }], ['c_fr', { x: 500, y: 100 }]
  ]);
  const bound = bindRelationPlanFrame(
    compileRelationRenderPlan([stage([
      { relation: 'MysteryFan', anchors: { hub: 'a_fr', members: ['b_fr', 'c_fr'] } }
    ], forest())]),
    0,
    (nodeId) => positions.get(nodeId) || null
  );
  const spokes = bound.primitives.filter((p) => p.type === 'segment');
  assert.equal(spokes.length, 2);
  spokes.forEach((spoke) => {
    assert.equal(spoke.route, 'direct');
    assert.equal(spoke.lane, null);
    assert.equal((spoke.d.match(/Q/g) || []).length, 0, 'a spoke is a straight mark-to-mark line');
    assert.match(spoke.d, /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });
});

test('a failed fallback link frees its lane for the next valid link', () => {
  const positions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 400, y: 100 }], ['d_fr', { x: 500, y: 100 }]
  ]);
  const forestWide = [node('root_lf', 'TP', ['a_fr', 'b_fr', 'c_fr', 'd_fr']
    .map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])))];
  const bound = bindRelationPlanFrame(
    compileRelationRenderPlan([stage([
      { relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'c_fr' } },
      { relation: 'OtherTie', anchors: { first: 'a_fr', second: 'b_fr' } }
    ], forestWide)]),
    0,
    (nodeId) => positions.get(nodeId) || null,
    { laneGap: 24, connectorBaselineY: 300 }
  );
  const links = bound.primitives.filter((p) => p.type === 'segment');
  assert.equal(links.length, 1, 'the failed link emits no connector');
  assert.equal(links[0].lane, 0, 'the surviving link takes the first lane — no phantom occupancy');
  assert.ok(bound.failed.some((f) => f.nodeId === 'c_fr'));
});

/* ------------------------------------------------------------------ *
 * Fallback numbering contract and vertical lane allocation.
 * ------------------------------------------------------------------ */

test('a one-scalar fallback mark carries its instance number with no array position', () => {
  const bound = bindWith(
    [stage([{ relation: 'MysterySolo', anchors: { spot: 'a_fr' } }], forest())],
    new Map([['a_fr', { x: 100, y: 100 }]])
  );
  const marks = bound.primitives.filter((p) => p.type === 'fallback-mark');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].instance, 1, 'the instance number is present for the frame numeral');
  assert.equal(marks[0].numeral, null, 'a scalar witness has no authored array position');
});

test('two equal authored arrays share the instance number in every mark with positions kept separate', () => {
  const positions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 250, y: 100 }],
    ['c_fr', { x: 400, y: 100 }], ['site_fr', { x: 550, y: 100 }]
  ]);
  const bound = bindWith(
    [stage([{
      relation: 'MysteryPairing',
      anchors: { lefts: ['a_fr', 'b_fr'], rights: ['c_fr', 'site_fr'] }
    }], forest())],
    positions
  );
  const marks = bound.primitives.filter((p) => p.type === 'fallback-mark');
  assert.equal(marks.length, 4);
  assert.ok(marks.every((mark) => mark.instance === 1),
    'the same relation instance sits inside every mark');
  assert.deepEqual(marks.map((mark) => mark.numeral).sort(), [1, 1, 2, 2],
    'authored array positions stay separate per-role numerals');
  const frames = new Set(marks.map((mark) => mark.frame));
  assert.equal(frames.size, 2, 'the circle/box role-group distinction is preserved');
});

test('repeated fallback relation instances number themselves correctly', () => {
  const bound = bindWith(
    [stage([
      { relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'b_fr' } },
      { relation: 'MysteryTie', anchors: { first: 'b_fr', second: 'c_fr' } }
    ], forest())],
    new Map([['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 300, y: 100 }], ['c_fr', { x: 500, y: 100 }]])
  );
  const marks = bound.primitives.filter((p) => p.type === 'fallback-mark');
  assert.deepEqual(
    [...new Set(marks.map((mark) => mark.instance))].sort(),
    [1, 2],
    'each authored instance of the repeated relation keeps its own number'
  );
});

test('three overlapping links take three distinct lane Ys spaced by the lane gap', () => {
  const wide = [node('root_3l', 'TP', ['la', 'lb', 'lc', 'ld', 'le', 'lf']
    .map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])))];
  const positions = new Map([
    ['la', { x: 100, y: 100 }], ['lb', { x: 600, y: 100 }],
    ['lc', { x: 150, y: 100 }], ['ld', { x: 650, y: 100 }],
    ['le', { x: 200, y: 100 }], ['lf', { x: 700, y: 100 }]
  ]);
  const bound = bindRelationPlanFrame(
    compileRelationRenderPlan([stage([
      { relation: 'TieOne', anchors: { first: 'la', second: 'lb' } },
      { relation: 'TieTwo', anchors: { first: 'lc', second: 'ld' } },
      { relation: 'TieThree', anchors: { first: 'le', second: 'lf' } }
    ], wide)]),
    0,
    (nodeId) => positions.get(nodeId) || null,
    { laneGap: 60, connectorBaselineY: 500 }
  );
  const links = bound.primitives.filter((p) => p.type === 'segment' && p.route === 'counter-lane');
  assert.equal(links.length, 3);
  const laneYs = links.map((link) => link.laneY).sort((a, b) => a - b);
  assert.deepEqual(laneYs, [500, 560, 620], 'each allocated lane has its own real Y, spaced by the gap');
});

/* ------------------------------------------------------------------ *
 * Complete overlay bounds: pure, four-sided, glyph extents included.
 * ------------------------------------------------------------------ */

test('overlay bounds cover representative left/right/top/bottom-extending primitives', async () => {
  const { boundOverlayBounds } = await import('../replay/relations/geometryBinding.ts');
  const positions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 700, y: 100 }],
    ['c_fr', { x: 400, y: 100 }], ['root_fr', { x: 400, y: 0 }],
    ['site_fr', { x: 600, y: 140 }], ['v_fr', { x: 600, y: 200 }]
  ]);
  const bound = bindRelationPlanFrame(
    compileRelationRenderPlan([stage([
      // Right/bottom: a wide plaque hanging below its anchor.
      { relation: 'FeatureBundle', anchors: { bearer: 'b_fr' }, values: { VeryLongFeatureName: 'AN-EXTREMELY-LONG-AUTHORED-VALUE' } },
      // Bottom: a counter-lane connector on its lane.
      { relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'c_fr' } },
      // Left: the leftmost fallback mark's glyph pad extends past the node.
      { relation: 'MysterySolo', anchors: { spot: 'a_fr' } },
      // Top: a movement trajectory carries fan/belly headroom above the row.
      { relation: 'AbarMove', anchors: { lowerCopy: 'site_fr', traceWitness: 'v_fr', pronouncedCopy: 'b_fr' } }
    ], forest())]),
    0,
    (nodeId) => positions.get(nodeId) || null,
    { labelHeight: 28, badgeGap: 22, laneGap: 24, connectorBaselineY: 400 }
  );
  const bounds = boundOverlayBounds(bound, { markerScale: 1 });
  assert.ok(bounds);
  assert.ok(bounds.minX < 100, 'left glyph extent reaches past the leftmost node position');
  const plaque = bound.primitives.find((p) => p.type === 'plaque');
  assert.ok(bounds.maxX >= plaque.x + plaque.width, 'right side includes the plaque width');
  assert.ok(bounds.maxY >= 400, 'bottom includes the connector lane');
  assert.ok(bounds.minY < 100, 'top includes glyph headroom above the node row');

  // Deep connector + rail case: the bounds bottom includes the rail set by
  // the binder's vertical law.
  const railPositions = new Map([
    ['a_fr', { x: 100, y: 100 }], ['b_fr', { x: 300, y: 100 }], ['c_fr', { x: 500, y: 100 }],
    ['site_fr', { x: 700, y: 100 }], ['root_fr', { x: 400, y: 0 }]
  ]);
  const railBound = bindRelationPlanFrame(
    compileRelationRenderPlan([stage([
      { relation: 'MysteryTie', anchors: { first: 'a_fr', second: 'b_fr' } },
      { relation: 'OpenChorus', anchors: { members: ['a_fr', 'b_fr', 'c_fr', 'site_fr', 'root_fr'] } }
    ], forest())]),
    0,
    (nodeId) => railPositions.get(nodeId) || null,
    { laneGap: 60, connectorBaselineY: 300, railBaseY: 340 }
  );
  const rail = railBound.primitives.find((p) => p.type === 'anchor-set-rail');
  assert.equal(rail.y, 390, 'the binder law lifts the rail below the deepest lane (300 + 90)');
  const railBounds = boundOverlayBounds(railBound, { markerScale: 1 });
  assert.ok(railBounds.maxY >= rail.y, 'bounds bottom includes the finalized rail');
});

/* ------------------------------------------------------------------ *
 * Exact trajectory bounds and text-aware label bounds.
 * ------------------------------------------------------------------ */

const aliasAnchorsFor = (low, witness, high) => ({ lowerCopy: low, traceWitness: witness, pronouncedCopy: high });

test('bounds contain the exact rendered quadratic of a very wide trajectory and every fanned route', async () => {
  const { boundOverlayBounds } = await import('../replay/relations/geometryBinding.ts');
  const wideTree = node('cp_w', 'CP', [
    node('dp_hi_w', 'DP', [leaf('d_hi_w', 'D', 'what')]),
    node('tp_w', 'TP', [
      node('dp_lo_w', 'DP', [leaf('d_lo_w', 'D', 't', { silent: true })], { silent: true })
    ])
  ]);
  const positions = new Map([
    ['dp_hi_w', { x: 40, y: 60 }], ['d_hi_w', { x: 40, y: 120 }],
    ['dp_lo_w', { x: 4000, y: 300 }], ['d_lo_w', { x: 4000, y: 360 }]
  ]);
  const anchors = aliasAnchorsFor('dp_lo_w', 'd_lo_w', 'dp_hi_w');
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'AbarMove', anchors },
      { relation: 'AbarMove', anchors, priorAnchors: { lowerCopy: 'dp_lo_w' } }
    ], [wideTree])
  ]);
  const bound = bindRelationPlanFrame(plan, 0, (nodeId) => positions.get(nodeId) || null);
  const trajectories = bound.primitives.filter((p) => p.type === 'trajectory-path');
  assert.ok(trajectories.length >= 2, 'coincident routes fan into distinct ordinals');
  assert.ok(new Set(trajectories.map((p) => p.ordinal)).size >= 2);
  const bounds = boundOverlayBounds(bound, { markerScale: 1 });
  trajectories.forEach((trajectory) => {
    // The belly of a ~3900-wide route dips far beyond any fixed 90 pad; the
    // exact extremum must be inside the bounds for EVERY fanned ordinal.
    const bellyY = Math.max(trajectory.start.y, trajectory.end.y)
      + Math.max(42, Math.abs(trajectory.end.x - trajectory.start.x) * 0.2)
      + trajectory.ordinal * 20;
    // Quadratic midpoint depth = (start+2*control+end)/4 >= endpoints; the
    // true extremum is captured by the closed form — assert containment.
    const midY = (trajectory.start.y + 2 * trajectory.control.y + trajectory.end.y) / 4;
    assert.ok(bounds.maxY >= midY, `bounds must contain the curve depth (${bounds.maxY} < ${midY})`);
    assert.ok(bellyY > trajectory.start.y + 90, 'the fixture really exceeds the old fixed pad');
    assert.match(trajectory.d, /^M -?[\d.]+ -?[\d.]+ Q -?[\d.]+ -?[\d.]+, -?[\d.]+ -?[\d.]+$/);
  });
});

test('bounds grow monotonically with authored label length on both horizontal edges', async () => {
  const { boundOverlayBounds } = await import('../replay/relations/geometryBinding.ts');
  const positions = new Map([
    ['a_fr', { x: 0, y: 100 }], ['b_fr', { x: 100, y: 100 }],
    ['c_fr', { x: 900, y: 100 }], ['site_fr', { x: 1000, y: 100 }]
  ]);
  const boundsFor = (label) => {
    const plan = compileRelationRenderPlan([
      stage([
        // Left edge: a middle-anchored agreement path label near x=0.
        { relation: 'MultipleAgree', anchors: { probe: 'a_fr', goals: ['b_fr'] }, values: { outcome: label } },
        // Right edge: a cyclic-agree badge near x=1000.
        { relation: 'CyclicAgree', anchors: { probe: 'c_fr', goal: 'site_fr' }, values: { cycle: label } }
      ], forest())
    ]);
    const bound = bindRelationPlanFrame(plan, 0, (nodeId) => positions.get(nodeId) || null);
    return boundOverlayBounds(bound, { markerScale: 1 });
  };
  const short = boundsFor('F');
  const medium = boundsFor('FEATURE-VALUE');
  const long = boundsFor('AN-EXTREMELY-LONG-AUTHORED-GAPPING-LABEL-VALUE');
  assert.ok(medium.maxX > short.maxX, 'right bound grows with label length');
  assert.ok(long.maxX > medium.maxX);
  assert.ok(medium.minX < short.minX, 'left bound grows with label length');
  assert.ok(long.minX < medium.minX);
});

/* ------------------------------------------------------------------ *
 * Anchored text bounds: renderer parity.
 * ------------------------------------------------------------------ */

test('every overlay text branch in TreeVisualizer is known to the bounds law', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../components/TreeVisualizer.tsx', import.meta.url), 'utf8');
  const overlayBlock = source.slice(
    source.indexOf('boundFrame.primitives.forEach'),
    source.indexOf('Resolve ghost lens states')
  );
  const textSites = overlayBlock.match(/\.append\('text'\)/g) || [];
  // The parity ledger: every overlay text-emitting branch, each accounted
  // for in boundOverlayBounds (geometryBinding.ts). Adding a new text
  // branch MUST extend the bounds law AND this count/list.
  const coveredMarkers = [
    'vr-path-label',          // shape label — middle 11px
    'vr-index-badge',         // index — start-anchored at +8, 13px
    'vr-fallback-instance',   // instance — middle 11px inside the frame
    'vr-fallback-position',   // external position — start at +12, 9px
    'vr-backward-cue',        // backward cue — start at -16, 10px
  ];
  coveredMarkers.forEach((marker) => {
    assert.ok(overlayBlock.includes(marker), `text site ${marker} missing from renderer`);
  });
  assert.equal(
    textSites.length,
    12,
    'overlay text call-site count changed: update boundOverlayBounds and this parity ledger '
      + '(sites: shape tip glyph, shape label, shape badge, domain-region label/blocked, plaque '
      + 'title, plaque rows, text-badge, index-badge, fallback instance/position/backward cue, '
      + 'anchor-set badge numeral)'
  );
});

test('a left-edge TransferDomain label and a long index are fully inside the bounds', async () => {
  const { boundOverlayBounds } = await import('../replay/relations/geometryBinding.ts');
  const positions = new Map([
    ['a_fr', { x: 0, y: 100 }], ['b_fr', { x: 200, y: 100 }],
    ['root_fr', { x: 100, y: 0 }], ['c_fr', { x: 400, y: 100 }]
  ]);
  const plan = compileRelationRenderPlan([
    stage([
      // The transfer edge box sits at the far left; its accepted
      // end-anchored "Phase edge" label extends further LEFT of it.
      { relation: 'TransferDomain', anchors: { phase: 'root_fr', edge: 'a_fr' } },
      // A long composite index extends RIGHT from its start anchor.
      { relation: 'Coreference', anchors: { antecedent: 'b_fr', pronoun: 'c_fr' } }
    ], forest())
  ]);
  const bound = bindRelationPlanFrame(plan, 0, (nodeId) => positions.get(nodeId) || null);
  const bounds = boundOverlayBounds(bound, { markerScale: 1 });
  const edge = bound.primitives.find((p) => p.type === 'domain-region' && p.domainStyle === 'transfer-edge');
  assert.ok(edge, 'the transfer edge region binds');
  assert.ok(edge.label, 'the accepted Phase edge label is present');
  const labelWidth = String(edge.label).length * 12 * 0.65;
  assert.ok(
    bounds.minX <= edge.x - 8 - labelWidth,
    `left bound must contain the complete end-anchored label (${bounds.minX} vs ${edge.x - 8 - labelWidth})`
  );
  // Index-badge right-edge law: start-anchored at +8 with the full text width.
  const badge = bound.primitives.find((p) => p.type === 'index-badge');
  const badgeWidth = String(badge.index).length * 13 * 0.65;
  assert.ok(bounds.maxX >= badge.x + 8 + badgeWidth,
    'right bound contains origin + 8 + full index text width');
});

test('bounds grow monotonically with composite index length', async () => {
  const { boundOverlayBounds } = await import('../replay/relations/geometryBinding.ts');
  // Long lineage keys produce long composite display indices only through
  // authored data; simulate by binding frames whose chain index strings
  // differ in length via increasing chain counts on the same rightmost node.
  const chainNodes = Array.from({ length: 14 }, (_unused, index) => `cn_${index}`);
  const chainForest = [node('root_cn2', 'TP', [
    ...chainNodes.map((id) => node(id, 'XP', [leaf(`${id}_l`, 'X', 'x')])),
    node('hub_cn2', 'HP', [leaf('hub_cn2_l', 'H', 'h')])
  ])];
  const positions = new Map([
    ...chainNodes.map((id, index) => [id, { x: index * 60, y: 100 }]),
    ['hub_cn2', { x: 900, y: 100 }]
  ]);
  const boundsWithChains = (chainCount) => {
    // Each chain has a DISTINCT participant pair, so the hub accumulates
    // chain indices 1..chainCount; past nine, the composite index string
    // gains a digit.
    const relations = chainNodes.slice(0, chainCount).map((id) => ({
      relation: 'Coreference',
      anchors: { antecedent: id, pronoun: 'hub_cn2' }
    }));
    const plan = compileRelationRenderPlan([stage(relations, chainForest)]);
    const bound = bindRelationPlanFrame(plan, 0, (nodeId) => positions.get(nodeId) || null);
    return boundOverlayBounds(bound, { markerScale: 1 });
  };
  // With 9 vs 10+ chains the rightmost badge's index goes '9' -> '10'+,
  // lengthening the start-anchored text; maxX must not shrink and must
  // grow once the numeral gains a digit.
  const nine = boundsWithChains(9);
  const twelve = boundsWithChains(12);
  assert.ok(twelve.maxX > nine.maxX, 'a longer composite index pushes the right bound out');
});

/* ------------------------------------------------------------------ *
 * Strict terminal attachment: unique or fail closed, never inferred.
 * ------------------------------------------------------------------ */

test('terminal resolution: anchor-terminal, unique, none, and ambiguous cases', async () => {
  const { resolveUniqueDisplayTerminal } = await import('../replay/relations/geometryBinding.ts');
  const terminal = (id) => ({ id, word: id, children: [] });
  const wrap = (id, children) => ({ id, children });
  const childrenOf = (n) => n.children || [];
  const isDisplay = (n) => (n.children || []).length === 0 && Boolean(n.word);

  // The anchored node itself is the display terminal.
  const leafAnchor = terminal('t1');
  assert.deepEqual(
    resolveUniqueDisplayTerminal(leafAnchor, childrenOf, isDisplay),
    { terminal: leafAnchor, reason: 'anchor-terminal' }
  );

  // Exactly one display terminal inside the exact subtree.
  const uniqueAnchor = wrap('phrase', [wrap('bar', [terminal('only')])]);
  const unique = resolveUniqueDisplayTerminal(uniqueAnchor, childrenOf, isDisplay);
  assert.equal(unique.reason, 'unique');
  assert.equal(unique.terminal.id, 'only');

  // Zero display terminals fail closed.
  const emptyAnchor = wrap('phrase', [wrap('bar', [{ id: 'cat', children: [] }])]);
  assert.deepEqual(
    resolveUniqueDisplayTerminal(emptyAnchor, childrenOf, isDisplay),
    { terminal: null, reason: 'none', count: 0 }
  );

  // More than one fails closed as ambiguity — independent of child order.
  const first = terminal('first');
  const second = terminal('second');
  const forward = wrap('phrase', [first, second]);
  const reversed = wrap('phrase', [second, first]);
  const forwardResolution = resolveUniqueDisplayTerminal(forward, childrenOf, isDisplay);
  const reversedResolution = resolveUniqueDisplayTerminal(reversed, childrenOf, isDisplay);
  assert.deepEqual(forwardResolution, { terminal: null, reason: 'ambiguous', count: 2 });
  assert.deepEqual(
    reversedResolution,
    forwardResolution,
    'child order never changes the refusal — no traversal-order picks'
  );
});
