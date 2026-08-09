import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createRelationRegistry } from '../replay/relationDispatch/index.js';
import {
  compileRelationRenderPlan,
  planItemOwnsRelationMoment
} from '../replay/relations/renderPlanCompiler.ts';
import { bindRelationPlanFrame } from '../replay/relations/geometryBinding.ts';
import { fallbackDrawing } from '../replay/relations/fallbackTopology.ts';
import {
  LARGE_ANCHOR_ARRAY_THRESHOLD,
  compileLargeAnchorSets
} from '../replay/relations/largeAnchorSets.ts';
import { EXCLUDED_RELATION_IDENTITIES, PRODUCTION_RENDER_FAMILIES } from '../replay/relations/renderFamilies.ts';

const leaf = (id, label, word, extra = {}) => ({ id, label, ...(word ? { word } : {}), ...extra });
const node = (id, label, children, extra = {}) => ({ id, label, children, ...extra });

const stage = (relations, forest, overrides = {}) => ({
  statement: 'statement',
  stageRecord: 'record',
  relations: relations,
  workspaceForest: forest,
  ...overrides
});

test('committed question fixture compiles both authored movements without diagnostics', () => {
  const fixture = JSON.parse(fs.readFileSync(
    new URL('../fixtures/normalized/what-did-mia-see.xbar.json', import.meta.url),
    'utf8'
  ));
  const plan = compileRelationRenderPlan(fixture.analyses[0].derivationStages);
  const finalFrame = plan.frames.at(-1);

  assert.equal(plan.diagnostics.length, 0);
  assert.equal(finalFrame.items.filter((item) => item.kind === 'trajectory').length, 2);
  assert.deepEqual(
    finalFrame.items.map((item) => item.relationRef.relation).sort(),
    ['auxiliary-head-movement', 'wh-movement']
  );
});

const whTree = node('cp', 'CP', [
  node('dp_high', 'DP', [leaf('d_high', 'D', 'What')]),
  node('tp', 'TP', [
    node('dp_low', 'DP', [leaf('d_low', 'D', 't₁', { silent: true })], { silent: true }),
    node('vp', 'VP', [leaf('v', 'V', 'see')])
  ])
]);

test('registered phrasal movement compiles with witness endpoints and authored payload preserved', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AbarMove',
      anchors: { lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high' },
      values: { note: 'authored literal' },
    }], [whTree])
  ]);

  assert.equal(plan.registryVersion, '2');
  assert.equal(plan.frames.length, 1);
  const [item] = plan.frames[0].items;
  assert.equal(item.kind, 'trajectory');
  assert.equal(item.trajectoryKind, 'phrasal');
  assert.equal(item.sourceNodeId, 'dp_low');
  assert.equal(item.targetNodeId, 'dp_high');
  assert.equal(item.witnessNodeId, 'd_low');
  // Authored data survives verbatim on the relation reference.
  assert.deepEqual(item.relationRef.values, { note: 'authored literal' });
  assert.deepEqual(item.relationRef.anchors, {
    lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high'
  });
  assert.deepEqual(plan.unregistered, []);
});

test('coalesced geometry remains focusable from every authored relation moment', () => {
  const relation = {
    relation: 'AbarMove',
    anchors: { lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high' }
  };
  const plan = compileRelationRenderPlan([
    stage([relation, { ...relation }], [whTree])
  ]);

  assert.equal(plan.frames[0].items.length, 1, 'identical geometry paints once');
  const [item] = plan.frames[0].items;
  assert.equal(item.coalescedRefs?.length, 1, 'the second authored reference survives');
  assert.equal(planItemOwnsRelationMoment(item, 0, 0), true);
  assert.equal(planItemOwnsRelationMoment(item, 0, 1), true);
  assert.equal(planItemOwnsRelationMoment(item, 0, 2), false);
});

test('a phrasal trajectory without a witness fails closed with a diagnostic, never a substitute', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AbarMove',
      anchors: { lowerCopy: 'dp_low', pronouncedCopy: 'dp_high' }
    }], [whTree])
  ]);
  assert.equal(plan.frames[0].items.length, 0);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'witness-missing'));
});

test('a witness outside the source occurrence fails closed', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AbarMove',
      anchors: { lowerCopy: 'dp_low', traceWitness: 'd_high', pronouncedCopy: 'dp_high' }
    }], [whTree])
  ]);
  assert.equal(plan.frames[0].items.length, 0);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'witness-outside-source'));
});

test('an unregistered name never becomes a movement drawing, even when movement-flavored', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'FancyFocusMovementParty',
      anchors: { one: 'dp_low', two: 'dp_high' }
    }], [whTree])
  ]);
  const [item] = plan.frames[0].items;
  assert.equal(item.kind, 'fallback');
  // Two scalars license exactly one undirected connector — row 2 — with the
  // relation name preserved verbatim in provenance and never in geometry.
  assert.equal(item.drawing.row, 2);
  assert.equal(item.drawing.link.directed, false);
  assert.equal(item.drawing.link.arrowheads, 0);
  assert.equal(item.relationRef.relation, 'FancyFocusMovementParty');
  assert.deepEqual(plan.unregistered, [{ relation: 'FancyFocusMovementParty', count: 1 }]);
});

test('fallback anchors that do not resolve fail closed and demote the topology row', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'OpenPairing',
      anchors: { one: 'dp_low', two: 'node_that_never_existed' }
    }], [whTree])
  ]);
  const [item] = plan.frames[0].items;
  assert.equal(item.kind, 'fallback');
  // With one endpoint failed closed, only one witness remains: row 1, no
  // connector is invented from a substitute endpoint.
  assert.equal(item.drawing.row, 1);
  assert.equal(item.drawing.link, null);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'anchor-unresolved'));
});

test('unregistered fallback persists unless a registered design says it is transient', () => {
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'OpenMark', anchors: { spot: 'dp_low' } }], [whTree]),
    stage([], [whTree])
  ]);
  assert.equal(plan.frames[0].items.length, 1);
  assert.equal(plan.frames[0].items[0].persistence, 'from-stage-onward');
  assert.equal(plan.frames[1].items.length, 1,
    'an unknown authored claim is retained rather than assigned invented transience');
});

test('registered movement persists from its authored frame onward and never leaks backward', () => {
  const plan = compileRelationRenderPlan([
    stage([], [whTree]),
    stage([{
      relation: 'AbarMove',
      anchors: { lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high' }
    }], [whTree]),
    stage([], [whTree])
  ]);
  assert.equal(plan.frames[0].items.length, 0, 'nothing leaks backward');
  assert.equal(plan.frames[1].items.length, 1, 'appears in its authored frame');
  assert.equal(plan.frames[2].items.length, 1, 'movement persists');
});

test('priorAnchors resolve only against the immediately preceding stage and add the backward cue', () => {
  const before = node('tp_before', 'TP', [leaf('cl_le', 'Cl', 'le')]);
  const after = node('tp_after', 'TP', [leaf('cl_se', 'Cl', 'se'), leaf('cl_lo', 'Cl', 'lo')]);
  const plan = compileRelationRenderPlan([
    stage([], [before]),
    stage([{
      relation: 'SpuriousSeExponence',
      anchors: { exponent: 'cl_se', conditioningClitic: 'cl_lo' },
      priorAnchors: { replacedDative: 'cl_le' }
    }], [after])
  ]);
  const [item] = plan.frames[1].items;
  assert.equal(item.kind, 'fallback');
  assert.equal(item.backward, true);
  assert.deepEqual(item.priorWitnessNodeIds, ['cl_le']);
  // The two current scalars still license their connector; priorAnchors veto nothing.
  assert.equal(item.drawing.row, 2);

  // priorAnchors at stage 0, or naming a node absent from the previous stage,
  // fail closed with diagnostics and add no cue.
  const badPlan = compileRelationRenderPlan([
    stage([{
      relation: 'SpuriousSeExponence',
      anchors: { exponent: 'cl_le' },
      priorAnchors: { ghost: 'nowhere' }
    }], [before])
  ]);
  assert.ok(badPlan.diagnostics.some((d) => d.kind === 'prior-anchor-without-prior-stage'));
  assert.equal(badPlan.frames[0].items[0].backward, false);
});

test('multiple same-stage instances all compile — no single() sampling', () => {
  const tree = node('tp_multi', 'TP', [
    node('dp_a', 'DP', [leaf('d_a', 'D', 'a')]),
    node('dp_b', 'DP', [leaf('d_b', 'D', 'b')]),
    node('dp_c', 'DP', [leaf('d_c', 'D', 'c')]),
    node('dp_d', 'DP', [leaf('d_d', 'D', 'd')])
  ]);
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'Coreference', anchors: { antecedent: 'dp_a', pronoun: 'dp_b' } },
      { relation: 'Coreference', anchors: { antecedent: 'dp_c', pronoun: 'dp_d' } }
    ], [tree])
  ]);
  const coindexItems = plan.frames[0].items.filter((item) => item.kind === 'coindex');
  assert.equal(coindexItems.length, 2);
  // Indices accumulate deterministically, never last-writer-wins.
  assert.notEqual(coindexItems[0].index, coindexItems[1].index);
});

test('a stage-only claim changed in a later stage is a legitimate change, not a conflict', () => {
  const registry = createRelationRegistry({
    registryId: 'test.transient',
    version: 't1',
    entries: [{
      id: 'transient.trajectory',
      version: '1',
      identities: [{ name: 'TransientMove', normalization: 'case-whitespace' }],
      signature: { anchors: { allowAdditional: true } },
      marks: [{ id: 'm', licenses: [{ field: 'relation' }] }]
    }]
  });
  const families = {
    'transient.trajectory': { family: 'trajectory', trajectoryKind: 'head', persistence: 'stage-only' }
  };
  const headTree = node('xp', 'XP', [
    leaf('h_low', 'X', 'low'),
    leaf('h_high', 'Y', 'high')
  ]);
  const planChanged = compileRelationRenderPlan([
    stage([{ relation: 'TransientMove', anchors: { source: 'h_low', target: 'h_high' } }], [headTree]),
    stage([{ relation: 'TransientMove', anchors: { source: 'h_low', target: 'h_high' } }], [headTree])
  ], { registry, families });
  // Same channel, but the marks are never co-visible: both frames keep theirs
  // and no conflict diagnostic is emitted.
  assert.equal(planChanged.frames[0].items.length, 1);
  assert.equal(planChanged.frames[1].items.length, 1);
  assert.equal(planChanged.diagnostics.filter((d) => d.kind === 'conflicting-claim').length, 0);
});

test('coincident but distinct authored claims both survive, routed apart instead of suppressed', () => {
  const registry = createRelationRegistry({
    registryId: 'test.conflict',
    version: 't1',
    entries: [{
      id: 'conflict.head',
      version: '1',
      identities: [{ name: 'HeadishMove', normalization: 'case-whitespace' }],
      signature: { anchors: { allowAdditional: true } },
      marks: [{ id: 'm', licenses: [{ field: 'relation' }] }]
    }, {
      id: 'conflict.lowering',
      version: '1',
      identities: [{ name: 'LoweringishMove', normalization: 'case-whitespace' }],
      signature: { anchors: { allowAdditional: true } },
      marks: [{ id: 'm', licenses: [{ field: 'relation' }] }]
    }]
  });
  const families = {
    'conflict.head': { family: 'trajectory', trajectoryKind: 'head', persistence: 'from-stage-onward' },
    'conflict.lowering': { family: 'trajectory', trajectoryKind: 'lowering', persistence: 'from-stage-onward' }
  };
  const headTree = node('xp2', 'XP', [
    leaf('e_low', 'X', 'low'),
    leaf('e_high', 'Y', 'high')
  ]);
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'HeadishMove', anchors: { source: 'e_low', target: 'e_high' } }], [headTree]),
    stage([{ relation: 'LoweringishMove', anchors: { source: 'e_low', target: 'e_high' } }], [headTree])
  ], { registry, families });
  // Frame 0: only the first authored claim exists yet.
  assert.equal(plan.frames[0].items.length, 1);
  // Frame 1: both authored claims are co-visible on the same route. Babel
  // never decides two authored linguistic claims are incompatible merely
  // because they share a visual channel — both survive, and the binder
  // routes them apart with deterministic ordinals.
  assert.equal(plan.frames[1].items.length, 2);
  assert.deepEqual(
    plan.frames[1].items.map((item) => item.trajectoryKind).sort(),
    ['head', 'lowering']
  );
  assert.equal(plan.diagnostics.length, 0);
  const positions = new Map([
    ['e_low', { x: 100, y: 200 }],
    ['e_high', { x: 400, y: 100 }],
    ['xp2', { x: 250, y: 0 }]
  ]);
  const bound = bindRelationPlanFrame(plan, 1, (nodeId) => positions.get(nodeId) || null);
  const paths = bound.primitives.filter((p) => p.type === 'trajectory-path');
  assert.equal(paths.length, 2, 'both coincident trajectories draw');
  assert.notEqual(paths[0].ordinal, paths[1].ordinal, 'coincident routes take distinct ordinals');
});

test('identical duplicate claims deduplicate to the earlier mark', () => {
  const plan = compileRelationRenderPlan([
    stage([
      { relation: 'AbarMove', anchors: { lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high' } },
      { relation: 'AbarMove', anchors: { lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high' } }
    ], [whTree])
  ]);
  assert.equal(plan.frames[0].items.filter((item) => item.kind === 'trajectory').length, 1);
  assert.equal(plan.diagnostics.filter((d) => d.kind === 'conflicting-claim').length, 0);
});

test('large anchor arrays compile additively and inherit the parent persistence', () => {
  const members = Array.from({ length: 6 }, (_unused, index) => `m_${index}`);
  const bigTree = node('root_big', 'TP', members.map((id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'x')])));
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'OpenChorus', anchors: { members } }], [bigTree]),
    stage([], [bigTree])
  ]);
  const fallback = plan.frames[0].items.find((item) => item.kind === 'fallback');
  const anchorSet = plan.frames[0].items.find((item) => item.kind === 'anchor-set');
  assert.ok(fallback && anchorSet);
  assert.ok(members.length >= LARGE_ANCHOR_ARRAY_THRESHOLD);
  // Every participant, in authored order, no truncation.
  assert.deepEqual(
    anchorSet.set.roles[0].anchors.map((anchor) => anchor.nodeId),
    members
  );
  // Organization inherits the unregistered parent's conservative persistence.
  assert.equal(anchorSet.persistence, 'from-stage-onward');
  assert.equal(plan.frames[1].items.length, 2,
    'both the fallback marks and their organizational rail persist');
});

test('a registered parent with a large array keeps its semantic marks and its persistence on the rail', () => {
  const members = Array.from({ length: 5 }, (_unused, index) => `w_${index}`);
  const bigTree = node('root_reg', 'TP', members.map((id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'x')])));
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'Coreference', anchors: { group: members } }], [bigTree]),
    stage([], [bigTree])
  ]);
  const coindex = plan.frames[0].items.find((item) => item.kind === 'coindex');
  const anchorSet = plan.frames[0].items.find((item) => item.kind === 'anchor-set');
  assert.ok(coindex, 'the registered semantic mark still renders');
  assert.ok(anchorSet, 'the large-array organization is additive');
  assert.equal(anchorSet.badgeSize, 'standard');
  assert.equal(anchorSet.persistence, 'from-stage-onward');
  assert.ok(plan.frames[1].items.some((item) => item.kind === 'anchor-set'));
});

test('CyclicLinearization uses compact production anchor badges', () => {
  const members = Array.from({ length: 5 }, (_unused, index) => `cyclic_${index}`);
  const cyclicTree = node(
    'root_cyclic_badges',
    'TP',
    members.map((id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'x')]))
  );
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'CyclicLinearization',
      anchors: { order: members, edgePosition: members[0] },
      values: { outcome: 'licensed' }
    }], [cyclicTree])
  ]);
  const anchorSet = plan.frames[0].items.find((item) => item.kind === 'anchor-set');
  assert.ok(anchorSet);
  assert.equal(anchorSet.badgeSize, 'compact');

  const bound = bindRelationPlanFrame(
    plan,
    0,
    (nodeId) => members.includes(nodeId)
      ? { x: (members.indexOf(nodeId) + 1) * 100, y: 50 }
      : null
  );
  const badges = bound.primitives.filter((primitive) => primitive.type === 'anchor-set-badge');
  assert.equal(badges.length, members.length);
  assert.ok(badges.every((badge) => badge.badgeSize === 'compact'));
});

test('repeated large-array instances in one stage each keep their own ordered set', () => {
  const first = ['a1', 'a2', 'a3', 'a4', 'a5'];
  const second = ['b1', 'b2', 'b3', 'b4', 'b5'];
  const forest = [node('root_two', 'TP', [...first, ...second].map((id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'x')])))];
  const { sets } = compileLargeAnchorSets([
    stage([
      { relation: 'OpenChorus', anchors: { members: first } },
      { relation: 'OpenChorus', anchors: { members: second } }
    ], forest)
  ]);
  assert.equal(sets.length, 2);
  assert.deepEqual(sets.map((set) => set.instanceIndex), [0, 1]);
  assert.deepEqual(sets[0].roles[0].anchors.map((anchor) => anchor.nodeId), first);
  assert.deepEqual(sets[1].roles[0].anchors.map((anchor) => anchor.nodeId), second);
});

test('an unknown large array reuses fallback badges and adds only its organizational rail', () => {
  const members = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
  const forest = [node('root_unknown_large', 'TP', members.map((id) => node(id, 'DP', [leaf(`${id}_d`, 'D', id)])))];
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'OpenSixWayRelation', anchors: { members } }], forest)
  ]);
  const bound = bindRelationPlanFrame(
    plan,
    0,
    (nodeId) => members.includes(nodeId)
      ? { x: (members.indexOf(nodeId) + 1) * 100, y: 50 }
      : null
  );
  assert.equal(bound.primitives.filter((p) => p.type === 'fallback-mark').length, 6);
  assert.equal(bound.primitives.filter((p) => p.type === 'anchor-set-badge').length, 0);
  assert.equal(bound.primitives.filter((p) => p.type === 'anchor-set-rail').length, 1);
});

test('unresolved large-array entries stay diagnostics and get no geometry', () => {
  const members = ['ok_1', 'ok_2', 'missing_3', 'ok_4', 'ok_5'];
  const forest = [node('root_miss', 'TP', ['ok_1', 'ok_2', 'ok_4', 'ok_5'].map((id) => node(id, 'DP', [leaf(`${id}_d`, 'D', 'x')])))];
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'OpenChorus', anchors: { members } }], forest)
  ]);
  assert.ok(plan.diagnostics.some((d) => d.kind === 'large-array-anchor-unresolved' && /missing_3/.test(d.detail)));
  const bound = bindRelationPlanFrame(
    plan,
    0,
    (nodeId) => (nodeId.startsWith('ok_') || nodeId.startsWith('root') ? { x: Number(nodeId.slice(-1)) * 100, y: 50 } : null)
  );
  const fallbackMarks = bound.primitives.filter((p) => p.type === 'fallback-mark');
  assert.equal(fallbackMarks.length, 4, 'every resolved participant renders once');
  assert.ok(fallbackMarks.every((mark) => mark.nodeId !== 'missing_3'));
  assert.equal(bound.primitives.filter((p) => p.type === 'anchor-set-badge').length, 0);
  assert.equal(bound.primitives.filter((p) => p.type === 'anchor-set-rail').length, 1);
});

test('geometry binding fails closed on missing positions and prints no names, roles, ids, or values', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'SecretRelation',
      anchors: { one: 'dp_low', two: 'dp_high' },
      values: { secret: 'payload' }
    }], [whTree])
  ]);
  const positions = new Map([
    ['dp_low', { x: 100, y: 200 }],
    ['dp_high', { x: 300, y: 40 }]
  ]);
  const bound = bindRelationPlanFrame(plan, 0, (nodeId) => positions.get(nodeId) || null);
  const rendered = JSON.stringify(bound.primitives.map(({ nodeId, itemIndex, ...visual }) => visual));
  assert.ok(!rendered.includes('SecretRelation'));
  assert.ok(!rendered.includes('secret'));
  assert.ok(!rendered.includes('payload'));
  assert.ok(bound.primitives.some((p) => p.type === 'segment' && p.directed === false));

  const boundMissing = bindRelationPlanFrame(plan, 0, () => null);
  assert.equal(boundMissing.primitives.length, 0);
  assert.ok(boundMissing.failed.length > 0);
});

test('the fallback dispatcher rows match the accepted table', () => {
  assert.equal(fallbackDrawing({ relation: 'X', anchors: { a: 'n1' } }).row, 1);
  assert.equal(fallbackDrawing({ relation: 'X', anchors: { a: 'n1', b: 'n2' } }).row, 2);
  assert.equal(fallbackDrawing({ relation: 'X', anchors: { a: 'n1', b: ['n2', 'n3'] } }).row, 3);
  assert.equal(fallbackDrawing({ relation: 'X', anchors: { a: ['n1', 'n2'] } }).row, 4);
  assert.equal(fallbackDrawing({ relation: 'X', anchors: { a: ['n1', 'n2'], b: ['n3', 'n4'] } }).row, 5);
  assert.equal(fallbackDrawing({ relation: 'X', anchors: { a: 'n1', b: 'n2', c: 'n3' } }).row, 6);
  assert.equal(fallbackDrawing({ relation: 'X', anchors: {}, priorAnchors: { p: 'n0' } }).row, 0);
  // Frames distinguish role groups only for two array groups.
  const twoArrays = fallbackDrawing({ relation: 'X', anchors: { a: ['n1', 'n2'], b: ['n3', 'n4'] } });
  assert.deepEqual(twoArrays.marks.map((mark) => mark.frame), ['circle', 'circle', 'box', 'box']);
});

test('every registry entry has a production render family and the exclusion list stays reasoned', () => {
  const wiredEntryIds = new Set(Object.keys(PRODUCTION_RENDER_FAMILIES));
  assert.ok(wiredEntryIds.size >= 45, `expected the full accepted grammar, got ${wiredEntryIds.size}`);
  Object.entries(EXCLUDED_RELATION_IDENTITIES).forEach(([relation, reason]) => {
    assert.ok(reason.length > 10, `${relation} exclusion carries no reason`);
  });
});

test('bound HeadMove endpoints are pronounced-terminal positions, never preterminal shells', () => {
  const headTree = node('cp_h', 'CP', [
    node('c_did', 'C', [leaf('c_did_word', 'C', 'did')]),
    node('tp_h', 'TP', [
      node('t_trace', 'T', [leaf('t_trace_word', 'T', 't₁', { silent: true })]),
      node('vp_h', 'VP', [leaf('v_h', 'V', 'leave')])
    ])
  ]);
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'HeadMove',
      anchors: { source: 't_trace', target: 'c_did' }
    }], [headTree])
  ]);
  const [item] = plan.frames[0].items;
  assert.equal(item.kind, 'trajectory');
  assert.equal(item.sourceAttachment, 'terminal');
  assert.equal(item.targetAttachment, 'terminal');

  // A provider in TreeVisualizer's mold: terminal resolves the materialized
  // display leaf inside the exact anchored preterminal; shell resolves the
  // anchored node itself. Distinct positions prove which one was used.
  const shellPositions = new Map([
    ['t_trace', { x: 10, y: 10 }],
    ['c_did', { x: 20, y: 10 }]
  ]);
  const terminalPositions = new Map([
    ['t_trace', { x: 11, y: 99 }],
    ['c_did', { x: 21, y: 99 }]
  ]);
  const provider = (nodeId, attachment = 'position') => (
    attachment === 'terminal'
      ? terminalPositions.get(nodeId) || null
      : shellPositions.get(nodeId) || null
  );
  const bound = bindRelationPlanFrame(plan, 0, provider);
  const path = bound.primitives.find((p) => p.type === 'trajectory-path');
  assert.ok(path);
  assert.deepEqual(path.from, { x: 11, y: 99 });
  assert.deepEqual(path.to, { x: 21, y: 99 }, 'the head landing binds to the pronounced terminal');

  // A head endpoint with no materialized terminal fails closed.
  const noTerminalProvider = (nodeId, attachment = 'position') => (
    attachment === 'terminal' ? null : shellPositions.get(nodeId) || null
  );
  const refused = bindRelationPlanFrame(plan, 0, noTerminalProvider);
  assert.equal(refused.primitives.filter((p) => p.type === 'trajectory-path').length, 0);
  assert.ok(refused.failed.some((f) => /materialized terminal/.test(f.reason)));
});

test('bound AbarMove departs from the witness terminal and lands on the phrase-shell position', () => {
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AbarMove',
      anchors: { lowerCopy: 'dp_low', traceWitness: 'd_low', pronouncedCopy: 'dp_high' }
    }], [whTree])
  ]);
  const [item] = plan.frames[0].items;
  assert.equal(item.sourceAttachment, 'terminal');
  assert.equal(item.targetAttachment, 'shell');

  const provider = (nodeId, attachment = 'position') => {
    if (nodeId === 'd_low' && attachment === 'terminal') return { x: 5, y: 300 };
    if (nodeId === 'dp_high' && attachment === 'shell') return { x: 200, y: 20 };
    if (nodeId === 'dp_high' && attachment === 'terminal') return { x: 999, y: 999 };
    return null;
  };
  const bound = bindRelationPlanFrame(plan, 0, provider);
  const path = bound.primitives.find((p) => p.type === 'trajectory-path');
  assert.ok(path);
  assert.deepEqual(path.from, { x: 5, y: 300 }, 'departure is the witness trace terminal');
  assert.deepEqual(path.to, { x: 200, y: 20 }, 'landing is the phrase shell, not a terminal');
});

test('every production-wired identity compiles its real accepted anchor shape without signature failure', () => {
  // Fixtures mirror the accepted Lab cards' authored anchor shapes exactly —
  // this is the regression net for any wired relation whose real roles were
  // omitted from its registry entry.
  const tripleTree = node('root_t', 'TP', [
    node('xp_src', 'XP', [leaf('w_src', 'X', 't₁', { silent: true })], { silent: true }),
    node('yp_tgt', 'YP', [leaf('t_tgt', 'Y', 'word')])
  ]);
  const triple = { lowerCopy: 'xp_src', traceWitness: 'w_src', pronouncedCopy: 'yp_tgt' };

  const headTree = node('root_h', 'TP', [
    node('t_src', 'T', [leaf('t_src_word', 'T', 't₁', { silent: true })]),
    node('c_tgt', 'C', [leaf('c_tgt_word', 'C', 'did')])
  ]);

  const opVarTree = node('root_ov', 'CP', [
    node('d_op', 'D', [leaf('d_op_word', 'D', 'Who')]),
    node('dp_var', 'DP', [leaf('d_var', 'D', 't₁', { silent: true })], { silent: true })
  ]);

  const atbTree = node('root_atb', 'TP', [
    node('xp_a', 'XP', [leaf('w_a', 'X', 't₁', { silent: true })], { silent: true }),
    node('xp_b', 'XP', [leaf('w_b', 'X', 't₁', { silent: true })], { silent: true }),
    node('yp_shared', 'YP', [leaf('t_shared', 'Y', 'what')])
  ]);

  const smugglingTree = node('root_sm', 'TP', [
    node('vp_carrier', 'VP', [
      leaf('w_carrier', 'V', 't₁', { silent: true }),
      node('dp_passenger', 'DP', [leaf('d_passenger', 'D', 'obj', { silent: true })], { silent: true })
    ], { silent: true }),
    node('dp_intervener', 'DP', [leaf('d_intervener', 'D', 'exp')]),
    node('vp_landed', 'VP', [leaf('v_landed', 'V', 'carried')])
  ]);

  const pairTree = node('root_pair', 'TP', [
    node('dp_one', 'DP', [leaf('d_one', 'D', 'John')]),
    node('dp_two', 'DP', [leaf('d_two', 'D', 'he')]),
    node('vbar_dom', "V'", [leaf('v_dom', 'V', 'saw'), node('dp_three', 'DP', [leaf('d_three', 'D', 'himself')])])
  ]);

  const qrTree = node('root_qr', 'TP', [
    node('qp_low', 'QP', [leaf('q_low', 'Q', 'every')]),
    node('qp_high', 'QP', [leaf('q_high', 'Q', 'every', { silent: true })], { silent: true })
  ]);

  const ellipsisTree = node('root_el', 'CoordP', [
    node('vp_ante', 'VP', [leaf('v_ante', 'V', 'read')]),
    node('vp_site', 'VP', [leaf('v_site', 'V', 'read', { silent: true })], { silent: true })
  ]);

  const cases = [
    { relation: 'AbarMove', anchors: triple, forest: [tripleTree] },
    { relation: 'AbarMove', anchors: { lowerCopy: 'xp_src', traceWitness: 'w_src', higherCopy: 'yp_tgt' }, forest: [tripleTree] },
    { relation: 'AMove', anchors: triple, forest: [tripleTree] },
    { relation: 'Scrambling', anchors: triple, forest: [tripleTree] },
    { relation: 'wh-movement', anchors: triple, forest: [tripleTree] },
    { relation: 'HeadMove', anchors: { source: 't_src', target: 'c_tgt' }, forest: [headTree] },
    { relation: 'auxiliary-head-movement', anchors: { source: 't_src', target: 'c_tgt' }, forest: [headTree] },
    { relation: 'Lowering', anchors: { source: 't_src', target: 'c_tgt' }, forest: [headTree] },
    {
      relation: 'OperatorVariableBinding',
      anchors: { operator: 'd_op', variable: 'dp_var', traceWitness: 'd_var' },
      forest: [opVarTree]
    },
    { relation: 'RemnantMovement', anchors: triple, forest: [tripleTree] },
    { relation: 'RollUpMovement', anchors: triple, forest: [tripleTree] },
    {
      relation: 'Smuggling',
      anchors: {
        lowerCopy: 'vp_carrier',
        traceWitness: 'w_carrier',
        pronouncedCopy: 'vp_landed',
        passenger: 'dp_passenger',
        intervener: 'dp_intervener'
      },
      forest: [smugglingTree]
    },
    {
      relation: 'AcrossTheBoardMovement',
      anchors: { sources: ['xp_a', 'xp_b'], traceWitnesses: ['w_a', 'w_b'], pronouncedCopy: 'yp_shared' },
      forest: [atbTree]
    },
    { relation: 'SidewardMovement', anchors: triple, forest: [tripleTree] },
    { relation: 'Coreference', anchors: { antecedent: 'dp_one', pronoun: 'dp_two' }, forest: [pairTree] },
    { relation: 'Coreference', anchors: { first: 'dp_one', second: 'dp_two' }, forest: [pairTree] },
    {
      relation: 'Binding',
      anchors: { binder: 'dp_one', bound: 'dp_three', domain: 'vbar_dom' },
      forest: [pairTree]
    },
    {
      relation: 'QuantifierRaising',
      anchors: { pronouncedQP: 'qp_low', lfQP: 'qp_high', scopeDomain: 'root_qr' },
      forest: [qrTree]
    },
    {
      relation: 'EllipsisRecoverability',
      anchors: { antecedent: 'vp_ante', site: 'vp_site' },
      forest: [ellipsisTree]
    }
  ];

  cases.forEach(({ relation, anchors, forest }) => {
    const plan = compileRelationRenderPlan([stage([{ relation, anchors }], forest)]);
    assert.deepEqual(
      plan.unregistered,
      [],
      `${relation} must dispatch through its exact registry entry`
    );
    const signatureFailures = plan.diagnostics.filter((d) => d.kind === 'signature-incomplete');
    assert.deepEqual(
      signatureFailures,
      [],
      `${relation} signature-incomplete: ${JSON.stringify(signatureFailures)}`
    );
    const semanticItems = plan.frames[0].items.filter((item) => item.kind !== 'fallback' && item.kind !== 'anchor-set');
    assert.ok(
      semanticItems.length >= 1,
      `${relation} compiled no semantic item; diagnostics: ${JSON.stringify(plan.diagnostics)}`
    );
  });
});

test('the wired ParasiticGap composition renders every large path-array node itself', () => {
  const pathIds = ['pgn_1', 'pgn_2', 'pgn_3', 'pgn_4', 'pgn_5', 'pgn_6'];
  const forest = [node('root_pg', 'CP', pathIds.map((id) => node(id, 'XP', [leaf(`${id}_h`, 'X', 'x')])))];
  const plan = compileRelationRenderPlan([
    stage([{ relation: 'ParasiticGap', anchors: { primaryPath: pathIds } }], forest)
  ]);
  // ParasiticGap is production-wired and owns its path arrays: the sourced
  // composition marks every path node, so the organizational rail must not
  // double-mark them — and nothing may silently truncate.
  assert.deepEqual(plan.unregistered, []);
  const pathStatus = plan.frames[0].items.find((item) => item.kind === 'path-status');
  assert.ok(pathStatus, 'the island composition renders its path nodes');
  assert.deepEqual(pathStatus.primaryNodeIds, pathIds);
  assert.equal(plan.frames[0].items.filter((item) => item.kind === 'anchor-set').length, 0);
});

test('only an exact registered family declaring full-array ownership suppresses the organization', () => {
  const sources = ['own_1', 'own_2', 'own_3', 'own_4', 'own_5'];
  const witnesses = sources.map((id) => `${id}_w`);
  const forest = [node('root_own', 'TP', [
    ...sources.map((id, index) => node(id, 'XP', [leaf(witnesses[index], 'X', 't₁', { silent: true })], { silent: true })),
    node('yp_own', 'YP', [leaf('t_own', 'Y', 'what')])
  ])];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AcrossTheBoardMovement',
      anchors: { sources, traceWitnesses: witnesses, pronouncedCopy: 'yp_own' }
    }], forest)
  ]);
  // The wired ATB family renders one trajectory per positional pair — it
  // owns the arrays, so no organizational anchor-set doubles them.
  const trajectories = plan.frames[0].items.filter((item) => item.kind === 'trajectory');
  assert.equal(trajectories.length, sources.length, 'every array element renders semantically');
  assert.equal(plan.frames[0].items.filter((item) => item.kind === 'anchor-set').length, 0);
});

test('a similarly named unregistered relation never inherits a full-array exemption', () => {
  const sources = ['sim_1', 'sim_2', 'sim_3', 'sim_4', 'sim_5'];
  const forest = [node('root_sim', 'TP', sources.map((id) => node(id, 'XP', [leaf(`${id}_h`, 'X', 'x')])))];
  const plan = compileRelationRenderPlan([
    stage([{
      relation: 'AcrossTheBoardMovementParty',
      anchors: { sources }
    }], forest)
  ]);
  assert.deepEqual(plan.unregistered.map((entry) => entry.relation), ['AcrossTheBoardMovementParty']);
  const anchorSet = plan.frames[0].items.find((item) => item.kind === 'anchor-set');
  assert.ok(anchorSet, 'the exemption belongs to the exact registered entry, never a lookalike');
});

test('values and priorAnchors travel verbatim through the replay plan and authored links', async () => {
  const { buildDerivationReplayPlan } = await import('../derivationReplayPlan.js');
  const {
    adaptDerivationStagesForReplay,
    buildAuthoredRelationLinksForFrames
  } = await import('../replay/replayCompiler.ts');

  const before = node('tp_v_before', 'TP', [leaf('lex_before', 'X', 'le')]);
  const after = node('tp_v_after', 'TP', [leaf('lex_after', 'X', 'se'), leaf('lex_other', 'Y', 'lo')]);
  const stages = [
    stage([], [before]),
    stage([{
      relation: 'AbarMove',
      anchors: {
        lowerCopy: 'lex_after',
        traceWitness: 'lex_after',
        pronouncedCopy: 'lex_other'
      },
      priorAnchors: { replaced: 'lex_before' },
      values: { register: ['α', 'β'], note: 'verbatim' }
    }], [after])
  ];

  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const relationStep = replayPlan.stages[1].relationSteps[0];
  assert.deepEqual(relationStep.priorAnchors, { replaced: 'lex_before' });
  assert.deepEqual(relationStep.values, { register: ['α', 'β'], note: 'verbatim' });

  const frames = adaptDerivationStagesForReplay(stages);
  const links = buildAuthoredRelationLinksForFrames(
    frames,
    replayPlan,
    1,
    [after]
  );
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].priorAnchors, { replaced: 'lex_before' });
  assert.deepEqual(links[0].values, { register: ['α', 'β'], note: 'verbatim' });
});
