import assert from 'node:assert/strict';
import test from 'node:test';

import { hydrateLabLensFromCurrentContract } from '../docs/design/visual-relations-lab-adapter.ts';
import { compileRelationRenderPlan } from '../replay/relations/renderPlanCompiler.ts';

const itemsForMoment = (plan, stageIndex, relationIndex) => (
  plan.frames[stageIndex]?.items.filter((item) => (
    item.relationRef.stageIndex === stageIndex
    && item.relationRef.relationIndex === relationIndex
  )) || []
);

test('Phase boundaries retain exact authored Replay identities', () => {
  const tree = {
    id: 'cp_phase_test',
    label: 'CP',
    children: [
      { id: 'edge_phase_test', label: 'DP', children: [] },
      { id: 'vp_phase_test', label: 'vP', children: [] }
    ]
  };
  const stages = [
    {
      statement: 'Build the phase.',
      stageRecord: 'No relation yet.',
      relations: [],
      workspaceForest: [tree]
    },
    {
      statement: 'Identify the phase.',
      stageRecord: 'Phase names the domain and edge.',
      relations: [{
        relation: 'Phase',
        anchors: { phase: 'vp_phase_test', edge: 'edge_phase_test' }
      }],
      workspaceForest: [tree]
    }
  ];

  assert.deepEqual(hydrateLabLensFromCurrentContract(stages, tree).phase.boundaries, [{
    node: 'vp_phase_test',
    edge: 'edge_phase_test',
    primary: true,
    stage: 1,
    relationIndex: 0
  }]);
});

test('the production Phase plan retains the exact authored Replay relation identity', () => {
  const tree = {
    id: 'cp_phase_plan_test',
    label: 'CP',
    children: [
      { id: 'edge_phase_plan_test', label: 'DP', children: [] },
      { id: 'vp_phase_plan_test', label: 'vP', children: [] }
    ]
  };
  const stages = [
    {
      statement: 'Build the phase.',
      stageRecord: 'No relation yet.',
      relations: [],
      workspaceForest: [tree]
    },
    {
      statement: 'Identify the phase.',
      stageRecord: 'Phase names the domain and edge.',
      relations: [{
        relation: 'Phase',
        anchors: { phase: 'vp_phase_plan_test', edge: 'edge_phase_plan_test' }
      }],
      workspaceForest: [tree]
    }
  ];
  const plan = compileRelationRenderPlan(stages);
  assert.equal(plan.frames[0].items.length, 0, 'the Phase mark cannot leak into the earlier stage');
  const items = itemsForMoment(plan, 1, 0);
  assert.ok(items.some((item) => item.kind === 'domain-mark' && item.domainStyle === 'phase'));
  assert.ok(items.every((item) => item.relationRef.relation === 'Phase'));
});

test('Transfer and post-transfer access retain exact authored Replay identities', () => {
  const tree = {
    id: 'tp_transfer_test',
    label: 'TP',
    children: [
      { id: 't_transfer_test', label: 'T', children: [] },
      {
        id: 'vp_phase_transfer_test',
        label: 'vP',
        children: [
          { id: 'edge_transfer_test', label: 'DP', children: [] },
          {
            id: 'vp_domain_transfer_test',
            label: 'VP',
            children: [{ id: 'target_transfer_test', label: 'DP', children: [] }]
          }
        ]
      }
    ]
  };
  const stages = [
    {
      statement: 'Identify the phase.',
      stageRecord: 'Phase names the domain and edge.',
      relations: [{
        relation: 'Phase',
        anchors: { phase: 'vp_phase_transfer_test', edge: 'edge_transfer_test' }
      }],
      workspaceForest: [tree]
    },
    {
      statement: 'Transfer the complement.',
      stageRecord: 'TransferDomain names the spell-out domain.',
      relations: [{
        relation: 'TransferDomain',
        anchors: {
          phase: 'vp_phase_transfer_test',
          edge: 'edge_transfer_test',
          spellOutDomain: 'vp_domain_transfer_test'
        }
      }],
      workspaceForest: [tree]
    },
    {
      statement: 'Attempt post-transfer access.',
      stageRecord: 'PostTransferAccess names the blocked dependency.',
      relations: [{
        relation: 'PostTransferAccess',
        anchors: {
          source: 't_transfer_test',
          target: 'target_transfer_test',
          spellOutDomain: 'vp_domain_transfer_test'
        }
      }],
      workspaceForest: [tree]
    }
  ];

  const transferPic = hydrateLabLensFromCurrentContract(stages, tree).transferPic;
  assert.deepEqual(transferPic.domains, [{
    phase: 'vp_phase_transfer_test',
    edge: 'edge_transfer_test',
    spellOutDomain: 'vp_domain_transfer_test',
    stage: 1,
    relationIndex: 0
  }]);
  assert.deepEqual(transferPic.accessAttempts, [{
    source: 't_transfer_test',
    target: 'target_transfer_test',
    spellOutDomain: 'vp_domain_transfer_test',
    stage: 2,
    relationIndex: 0
  }]);
});

test('production Transfer/PIC plans preserve each exact authored Replay identity', () => {
  const tree = {
    id: 'tp_transfer_plan_test',
    label: 'TP',
    children: [
      { id: 't_transfer_plan_test', label: 'T', children: [] },
      {
        id: 'vp_phase_transfer_plan_test',
        label: 'vP',
        children: [
          { id: 'edge_transfer_plan_test', label: 'DP', children: [] },
          {
            id: 'vp_domain_transfer_plan_test',
            label: 'VP',
            children: [{ id: 'target_transfer_plan_test', label: 'DP', children: [] }]
          }
        ]
      }
    ]
  };
  const stages = [
    {
      statement: 'Identify the phase.',
      stageRecord: 'Phase names the domain and edge.',
      relations: [{
        relation: 'Phase',
        anchors: { phase: 'vp_phase_transfer_plan_test', edge: 'edge_transfer_plan_test' }
      }],
      workspaceForest: [tree]
    },
    {
      statement: 'Transfer the complement.',
      stageRecord: 'TransferDomain names the spell-out domain.',
      relations: [{
        relation: 'TransferDomain',
        anchors: {
          phase: 'vp_phase_transfer_plan_test',
          edge: 'edge_transfer_plan_test',
          spellOutDomain: 'vp_domain_transfer_plan_test'
        }
      }],
      workspaceForest: [tree]
    },
    {
      statement: 'Attempt post-transfer access.',
      stageRecord: 'PostTransferAccess names the blocked dependency.',
      relations: [{
        relation: 'PostTransferAccess',
        anchors: {
          source: 't_transfer_plan_test',
          target: 'target_transfer_plan_test',
          spellOutDomain: 'vp_domain_transfer_plan_test'
        }
      }],
      workspaceForest: [tree]
    }
  ];
  const plan = compileRelationRenderPlan(stages);
  assert.ok(itemsForMoment(plan, 0, 0).every((item) => item.relationRef.relation === 'Phase'));
  assert.ok(itemsForMoment(plan, 1, 0).some((item) => item.relationRef.relation === 'TransferDomain'));
  assert.ok(itemsForMoment(plan, 2, 0).some((item) => item.relationRef.relation === 'PostTransferAccess'));
});

test('AntiLocality retains its exact authored Replay identity in the production plan', () => {
  const tree = {
    id: 'vp_anti_test',
    label: 'vP',
    children: [
      { id: 'dp_high_anti_test', label: 'DP', children: [] },
      {
        id: 'dp_low_anti_test',
        label: 'DP',
        children: [{ id: 'trace_anti_test', label: 'D', word: 't', silent: true }]
      }
    ]
  };
  const stages = [{
    statement: 'Attempt the movement.',
    stageRecord: 'AntiLocality classifies the path.',
    relations: [
      {
        relation: 'AntiLocality',
        anchors: {
          source: 'dp_low_anti_test',
          traceWitness: 'trace_anti_test',
          landing: 'dp_high_anti_test'
        },
        values: { outcome: 'blocked' }
      }
    ],
    workspaceForest: [tree]
  }];

  assert.deepEqual(hydrateLabLensFromCurrentContract(stages, tree).antiLocality.paths, [{
    source: 'dp_low_anti_test',
    traceWitness: 'trace_anti_test',
    landing: 'dp_high_anti_test',
    facilitator: undefined,
    outcome: 'blocked',
    stage: 0,
    relationIndex: 0
  }]);

  const plan = compileRelationRenderPlan(stages);
  const items = itemsForMoment(plan, 0, 0);
  assert.ok(items.some((item) =>
    item.kind === 'directed-path'
    && item.pathStyle === 'anti-locality'
    && item.fromNodeId === 'dp_low_anti_test'
    && item.toNodeId === 'dp_high_anti_test'));
  assert.ok(items.every((item) => item.relationRef.relation === 'AntiLocality'));
});

test('movement paths and lower-copy presentation share the exact production relation identity', () => {
  const tree = {
    id: 'vp_move_timing_test',
    label: 'vP',
    children: [
      {
        id: 'dp_high_move_timing_test',
        label: 'DP',
        lineageId: 'move-timing-dp',
        children: [{
          id: 'd_high_move_timing_test',
          label: 'D',
          word: 'The',
          lineageId: 'move-timing-d'
        }]
      },
      {
        id: 'dp_low_move_timing_test',
        label: 'DP',
        lineageId: 'move-timing-dp',
        silent: true,
        children: [{
          id: 'd_low_move_timing_test',
          label: 'D',
          word: 't',
          lineageId: 'move-timing-d',
          silent: true
        }]
      }
    ]
  };
  const stages = [{
    statement: 'Move the phrase.',
    stageRecord: 'AMove introduces the complete landing and lower copy.',
    relations: [{
      relation: 'AMove',
      anchors: {
        lowerCopy: 'dp_low_move_timing_test',
        traceWitness: 'd_low_move_timing_test',
        pronouncedCopy: 'dp_high_move_timing_test'
      }
    }],
    workspaceForest: [tree]
  }];

  const lens = hydrateLabLensFromCurrentContract(stages, tree);
  assert.deepEqual(lens.trajectoryStages, [0]);
  assert.deepEqual(lens.trajectoryRelationIndices, [0]);

  const plan = compileRelationRenderPlan(stages);
  const items = itemsForMoment(plan, 0, 0);
  assert.ok(items.some((item) => item.kind === 'trajectory'));
  assert.ok(items.every((item) => (
    item.relationRef.relation === 'AMove'
    && item.relationRef.stageIndex === 0
    && item.relationRef.relationIndex === 0
  )));
});

test('ImproperMovement retains its exact authored Replay identity in the production plan', () => {
  const tree = {
    id: 'cp_improper_timing_test',
    label: 'CP',
    children: [
      { id: 'cp_high_improper_timing_test', label: 'CP' },
      {
        id: 'tp_improper_timing_test',
        label: 'TP',
        children: [{
          id: 'cp_low_improper_timing_test',
          label: 'CP',
          children: [{ id: 'trace_improper_timing_test', label: 'C', word: 't', silent: true }]
        }]
      }
    ]
  };
  const stages = [{
    statement: 'Move the clause and diagnose its landing domain.',
    stageRecord: 'AbarMove introduces the chain before ImproperMovement adds the domain comparison.',
    relations: [
      {
        relation: 'AbarMove',
        anchors: {
          lowerCopy: 'cp_low_improper_timing_test',
          traceWitness: 'trace_improper_timing_test',
          pronouncedCopy: 'cp_high_improper_timing_test'
        }
      },
      {
        relation: 'ImproperMovement',
        anchors: {
          source: 'cp_low_improper_timing_test',
          traceWitness: 'trace_improper_timing_test',
          licensedLanding: 'cp_high_improper_timing_test',
          rejectedLandingHosts: ['tp_improper_timing_test'],
          forbiddenRegion: ['tp_improper_timing_test']
        }
      }
    ],
    workspaceForest: [tree]
  }];

  assert.deepEqual(hydrateLabLensFromCurrentContract(stages, tree).improperMovement, {
    source: 'cp_low_improper_timing_test',
    traceWitness: 'trace_improper_timing_test',
    licensedLanding: 'cp_high_improper_timing_test',
    licensedLandingHosts: [],
    rejectedLandingHosts: ['tp_improper_timing_test'],
    forbiddenRegion: ['tp_improper_timing_test'],
    stage: 0,
    relationIndex: 1
  });

  const plan = compileRelationRenderPlan(stages);
  const items = itemsForMoment(plan, 0, 1);
  assert.ok(items.some((item) => item.kind === 'domain-mark' && item.domainStyle === 'forbidden-region'));
  assert.ok(items.every((item) => item.relationRef.relation === 'ImproperMovement'));
});

test('legacy recoverability authors the ghost primitive without a connector', () => {
  const tree = {
    id: 'coordp_ellipsis_timing_test',
    label: 'CoordP',
    children: [
      { id: 'vp_antecedent_ellipsis_timing_test', label: 'VP' },
      { id: 'vp_site_ellipsis_timing_test', label: 'VP', silent: true }
    ]
  };
  const stages = [{
    statement: 'Recover the silent predicate.',
    stageRecord: 'EllipsisRecoverability relates the antecedent to the silent site.',
    relations: [{
      relation: 'EllipsisRecoverability',
      anchors: {
        antecedent: 'vp_antecedent_ellipsis_timing_test',
        site: 'vp_site_ellipsis_timing_test'
      }
    }],
    workspaceForest: [tree]
  }];

  assert.deepEqual(hydrateLabLensFromCurrentContract(stages, tree).ellipsisRecoverability, {
    antecedent: 'vp_antecedent_ellipsis_timing_test',
    site: 'vp_site_ellipsis_timing_test',
    stage: 0,
    relationIndex: 0
  });

  const plan = compileRelationRenderPlan(stages);
  const items = itemsForMoment(plan, 0, 0);
  assert.ok(items.some(
    (item) => item.kind === 'ellipsis-site' && item.siteNodeId === 'vp_site_ellipsis_timing_test'
  ));
  assert.equal(items.some((item) => item.kind === 'undirected-link'), false);
  assert.ok(items.every((item) => item.relationRef.relation === 'EllipsisRecoverability'));
});

test('feature plaques and ellipsis sites retain separate authored Replay identities', () => {
  const tree = {
    id: 'cp_ellipsis_licensing_timing_test',
    label: 'CP',
    children: [
      { id: 'c_ellipsis_licensing_timing_test', label: 'C' },
      { id: 'tp_ellipsis_licensing_timing_test', label: 'TP' }
    ]
  };
  const stages = [{
    statement: 'License ellipsis after an independent relation.',
    stageRecord: 'The E feature and silent domain are independent authored claims.',
    relations: [
      {
        relation: 'Phase',
        anchors: {
          phase: 'cp_ellipsis_licensing_timing_test',
          edge: 'c_ellipsis_licensing_timing_test'
        }
      },
      {
        relation: 'FeatureBundle',
        anchors: { licensor: 'c_ellipsis_licensing_timing_test' },
        values: { feature: '[E]' }
      },
      { relation: 'Ellipsis', anchors: { domain: 'tp_ellipsis_licensing_timing_test' } }
    ],
    workspaceForest: [tree]
  }];

  const lens = hydrateLabLensFromCurrentContract(stages, tree);
  assert.deepEqual(lens.featureValuation.annotations, [{
    anchor: 'c_ellipsis_licensing_timing_test',
    anchorNodes: ['c_ellipsis_licensing_timing_test'],
    title: 'C licensor',
    placement: 'below-anchor',
    rows: [{ label: 'feature', value: '[E]' }],
    stage: 0,
    relationIndex: 1
  }]);
  assert.equal(lens.ellipsis, undefined);

  const plan = compileRelationRenderPlan(stages);
  const plaqueItems = itemsForMoment(plan, 0, 1);
  assert.ok(plaqueItems.some(
    (item) => item.kind === 'node-plaque'
      && item.plaqueStyle === 'feature'
      && item.rows.some((row) => row.value === '[E]')
  ));
  assert.ok(plaqueItems.every((item) => item.relationRef.relationIndex === 1));

  const ellipsisItems = itemsForMoment(plan, 0, 2);
  assert.ok(ellipsisItems.some((item) => item.kind === 'ellipsis-site'));
  assert.equal(ellipsisItems.some((item) => item.kind === 'directed-path'), false);
  assert.ok(ellipsisItems.every((item) => item.relationRef.relationIndex === 2));
});
