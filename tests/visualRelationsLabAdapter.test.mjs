import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import ts from 'typescript';

import { buildDerivationReplayPlan } from '../derivationReplayPlan.js';
import {
  adaptDerivationStagesForReplay,
  buildPlaybackStepsFromDerivationFrames
} from '../replay/replayCompiler.ts';

import {
  ACTIVE_VISUAL_DESIGNS,
  HISTORICAL_RELATIONS,
  LARGE_ANCHOR_ARRAY_THRESHOLD,
  SOURCE_BACKED_UNFROZEN_DESIGNS,
  allocateSpanLanes,
  bindCrossingDependencyPath,
  compileLargeAnchorSets,
  planAnchorSetLayout,
  containingEllipse,
  isOrthogonalPath,
  ellipseContainsRect,
  polygonArea,
  polygonContainsPoint,
  rectCorners,
  MIN_CROSSING_SEPARATION,
  findBoundaryCrossings,
  findBoundaryExit,
  orientPathFromOrigin,
  remnantDepartureTraceIds,
  trajectoryControlY,
  trajectoryIsOrthogonal,
  trajectoryKindForRelation,
  trajectoryMeetsPhraseShell,
  trajectoryRequiresWitness,
  RECOGNIZED_RELATIONS,
  deriveLineageDisplayIndices,
  hydrateLabLensFromCurrentContract,
  matchRelations,
  toRendererStages,
  unregisteredRelationNames,
  validateCurrentStageRelationAnchors,
  validateLabRelations
} from '../docs/design/visual-relations-lab-adapter.ts';

const offsetFixtureTokenIndices = (tree, offset) => ({
  ...tree,
  ...(Number.isInteger(tree?.tokenIndex) ? { tokenIndex: tree.tokenIndex + offset } : {}),
  ...(tree?.children
    ? { children: tree.children.map((child) => offsetFixtureTokenIndices(child, offset)) }
    : {})
});

const tree = {
  id: 'cp',
  label: 'CP',
  children: [
    {
      id: 'high',
      label: 'DP',
      lineageId: 'wh-chain',
      children: [{ id: 'high_d', label: 'D', word: 'Which', lineageId: 'wh-d' }]
    },
    {
      id: 'low',
      label: 'DP',
      silent: true,
      lineageId: 'wh-chain',
      children: [{ id: 'low_d', label: 'D', word: 't₁', silent: true, lineageId: 'wh-d' }]
    }
  ]
};

const stages = [{
  statement: 'Move the object.',
  stageRecord: 'AbarMove relates the two occurrences.',
  relations: [{ relation: 'AbarMove', anchors: { lowerCopy: 'low', pronouncedCopy: 'high' } }],
  workspaceForest: [tree]
}];

test('current-stage relation anchors validate as node IDs', () => {
  assert.deepEqual(validateCurrentStageRelationAnchors(stages, tree), { valid: true, invalid: [] });
  const invalid = structuredClone(stages);
  invalid[0].relations[0].anchors.chain = 'wh-chain';
  assert.equal(validateCurrentStageRelationAnchors(invalid, tree).valid, false);
});

test('display indices derive from anchored occurrence lineage, not scalar anchors', () => {
  const indices = deriveLineageDisplayIndices(stages, tree);
  assert.equal(indices.low, 'i');
  assert.equal(indices.high, 'i');
});

test('Argument Sharing preserves two authored domains and one existing object', () => {
  const argumentTree = {
    id: 'serialp_argument_test',
    label: 'SerialP',
    children: [
      { id: 'vp_left_argument_test', label: 'VP', children: [] },
      {
        id: 'vp_right_argument_test',
        label: 'VP',
        children: [{ id: 'dp_object_argument_test', label: 'DP', children: [] }]
      }
    ]
  };
  const argumentStages = [{
    statement: 'Two predicates share one object.',
    stageRecord: 'ArgumentSharing names the two predicate domains and the existing object.',
    relations: [{
      relation: 'ArgumentSharing',
      anchors: {
        domains: ['vp_left_argument_test', 'vp_right_argument_test'],
        shared: 'dp_object_argument_test'
      }
    }],
    workspaceForest: [argumentTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(argumentStages, argumentTree);
  assert.deepEqual(lens.argumentSharing, {
    domains: ['vp_left_argument_test', 'vp_right_argument_test'],
    shared: 'dp_object_argument_test',
    role: 'ARG',
    stage: 0,
    relationIndex: 0
  });
  assert.equal(lens.multidominance, undefined);
});

test('Multidominance accepts three authored parents without requiring another Lab card', () => {
  const sharingTree = {
    id: 'coordp_three_parent_test',
    label: 'CoordP',
    children: [
      { id: 'vp_one_three_parent_test', label: 'VP', children: [] },
      { id: 'vp_two_three_parent_test', label: 'VP', children: [] },
      {
        id: 'vp_three_three_parent_test',
        label: 'VP',
        children: [{ id: 'dp_shared_three_parent_test', label: 'DP', children: [] }]
      }
    ]
  };
  const sharingStages = [{
    statement: 'Three predicates share one object.',
    stageRecord: 'Multidominance names all three parents and the canonical shared DP.',
    relations: [{
      relation: 'Multidominance',
      anchors: {
        parents: [
          'vp_one_three_parent_test',
          'vp_two_three_parent_test',
          'vp_three_three_parent_test'
        ],
        shared: 'dp_shared_three_parent_test'
      }
    }],
    workspaceForest: [sharingTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(sharingStages, sharingTree);
  assert.deepEqual(lens.multidominance, {
    parents: [
      'vp_one_three_parent_test',
      'vp_two_three_parent_test',
      'vp_three_three_parent_test'
    ],
    shared: 'dp_shared_three_parent_test',
    stage: 0,
    relationIndex: 0
  });
});

test('constituent enclosures retain their exact authored relation identity', () => {
  const enclosureTree = {
    id: 'root_enclosure_identity_test',
    label: 'Root',
    children: [
      {
        id: 'vp_carrier_low_enclosure_test',
        label: 'VP',
        silent: true,
        lineageId: 'carrier-enclosure-test',
        children: [{ id: 'v_trace_enclosure_test', label: 'V', silent: true, children: [] }]
      },
      {
        id: 'vp_carrier_high_enclosure_test',
        label: 'VP',
        lineageId: 'carrier-enclosure-test',
        children: [{ id: 'v_overt_enclosure_test', label: 'V', word: 'read', children: [] }]
      }
    ]
  };
  const enclosureStages = [{
    statement: 'The carrier moves.',
    stageRecord: 'The relation owns its enclosure.',
    relations: [
      {
        relation: 'Identity',
        anchors: { occurrences: ['vp_carrier_low_enclosure_test', 'vp_carrier_high_enclosure_test'] }
      },
      {
        relation: 'Smuggling',
        anchors: {
          lowerCopy: 'vp_carrier_low_enclosure_test',
          traceWitness: 'v_trace_enclosure_test',
          pronouncedCopy: 'vp_carrier_high_enclosure_test'
        }
      }
    ],
    workspaceForest: [enclosureTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(enclosureStages, enclosureTree);
  assert.deepEqual(lens.enclosures, [{
    node: 'vp_carrier_low_enclosure_test',
    licence: 'carrier-chunk',
    nodes: ['vp_carrier_low_enclosure_test', 'v_trace_enclosure_test'],
    stage: 0,
    relationIndex: 1
  }]);
});

test('the ACD relative clause binds its object gap through a complete operator chain', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const acdBlock = source.slice(
    source.indexOf("const acdHighQp ="),
    source.indexOf("const orderedCaseStackingTree =")
  );

  assert.ok(acdBlock.length > 0);
  // No bare `t` terminals and no chainless null placeholders: the object gap is
  // a silent occurrence of the relative operator, tied to its chain by lineage.
  assert.doesNotMatch(acdBlock, /silentLexicalNode\([^\n]+, 'D', 't'\)/);
  assert.doesNotMatch(acdBlock, /'D', '∅'/);
  // Both QP occurrences author the operator in Spec,CP and its gap occurrence,
  // all four on the one 'acd-op' lineage.
  assert.equal((acdBlock.match(/silentLexicalNode\('d_op_(?:high|low)_acd', 'D', 'Op', \{ lineageId: 'acd-op' \}\)/g) || []).length, 2);
  assert.equal((acdBlock.match(/silentLexicalNode\('d_object_gap_(?:high|low)_acd', 'D', 'Op', \{ lineageId: 'acd-op' \}\)/g) || []).length, 2);
});

test('the archived ACD fixture composes QR and ellipsis without dedicated machinery', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const cardStart = source.indexOf("title: 'Antecedent-Contained Deletion'");
  const cardEnd = source.indexOf("title: 'Ordered Case Stacking'");
  const card = source.slice(cardStart, cardEnd);
  assert.ok(card.length > 0);

  assert.equal(card.indexOf("relation: 'AntecedentContainedDeletion'"), -1);
  assert.equal((card.match(/relation: 'QuantifierRaising'/g) || []).length, 1);
  assert.equal((card.match(/relation: 'Ellipsis'/g) || []).length, 1);
  const scopeAt = card.indexOf('pronouncedQP:');
  const recoverabilityAt = card.indexOf('antecedent:');
  assert.ok(scopeAt > 0 && scopeAt < recoverabilityAt, 'QR precedes the independent ellipsis claim');
  assert.match(card, /pronouncedQP:[\s\S]*lfQP:[\s\S]*scopeDomain:/);
  assert.match(card, /domain: 'vp_ellipsis_high_acd'[\s\S]*antecedent: 'vp_matrix_acd'/);
  // The unresolved surface frame precedes the composed resolution.
  const surfaceAt = card.indexOf('acdSurfaceTree');
  assert.ok(surfaceAt > 0 && surfaceAt < scopeAt, 'the surface frame comes first');
});

test('Illicit Analysis has a canonical card with an open authored verdict label', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const cardStart = source.indexOf("title: 'Illicit Analysis'");
  const cardEnd = source.indexOf("title: 'Ellipsis / Silent Structure'");
  const card = source.slice(cardStart, cardEnd);
  assert.ok(card.length > 0);
  assert.equal((card.match(/relation: 'IllicitAnalysis'/g) || []).length, 1);
  assert.match(card, /anchors: \{ analysis: 'tp_illicit_analysis' \}/);
  assert.match(card, /judgment: '\*'[\s\S]*label: 'agreement'[\s\S]*outcome: 'illicit'[\s\S]*reason: 'Plural the girls requires plural present agreement, but arrives is third-person singular\.'/);
  assert.match(card, /workspaceForest: \[illicitAnalysisSubject, illicitAnalysisPredicate\]/);
  assert.match(card, /External Merge assembles the deviant input as one complete TP/);
  assert.doesNotMatch(card, /BlockedExtraction|extraction/);
});

test('the Atlas keeps preserved executable examples internal', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const archiveStart = source.indexOf('export const archivedExampleArchetypes');
  const archiveEnd = source.indexOf(']);', archiveStart);
  const archiveBlock = source.slice(archiveStart, archiveEnd);
  const archivedCodes = [...archiveBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const cardCodes = [...source.matchAll(/\n    archetype: '([^']+)'/g)]
    .map((match) => match[1].split('.')[0]);
  const allCardCount = cardCodes.length;

  assert.equal(allCardCount, 98);
  assert.equal(new Set(archivedCodes).size, 43);
  assert.equal(allCardCount - archivedCodes.length, 55);
  assert.match(source, /const cases = canonicalCases/);
  assert.doesNotMatch(source, /fixtureArchiveActive/);
  assert.doesNotMatch(source, /view=fixtures/);
  assert.doesNotMatch(source, /Example archive/);

  archivedCodes.forEach((code) => {
    assert.equal(cardCodes.includes(code), true, `${code} must name an executable card`);
  });

  for (const retained of ['A1', 'A2', 'E7', 'H2B', 'L1', 'M3', 'O1B', 'O5']) {
    assert.equal(archivedCodes.includes(retained), false, `${retained} remains canonical`);
  }
  for (const example of ['B2', 'C4b', 'D3b', 'F2', 'F4', 'F4b', 'M2B', 'N3B', 'O4']) {
    assert.equal(archivedCodes.includes(example), true, `${example} is preserved as an internal fixture`);
  }
});

test('the Orchard keeps card prose out and preserves its source manifest', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const gallery = await readFile(
    new URL('../docs/design/visual-relations-source-gallery.tsx', import.meta.url),
    'utf8'
  );
  const html = await readFile(
    new URL('../docs/design/babel-visual-relations-research.production-only-audit.html', import.meta.url),
    'utf8'
  );
  const publicHtml = await readFile(
    new URL('../docs/research/relation-orchard/orchard.html', import.meta.url),
    'utf8'
  );
  let sourceAssets = [];
  try {
    sourceAssets = await readdir(
      new URL('../docs/design/visual-relations-assets/', import.meta.url),
      { recursive: true }
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const imageAssets = sourceAssets
    .filter((path) => /\.(?:png|jpe?g|webp|gif)$/i.test(path))
    .map((path) => `visual-relations-assets/${path}`)
    .sort();
  const manifestStart = gallery.indexOf('export const visualSourceImagePaths');
  const manifestEnd = gallery.indexOf('] as const;', manifestStart);
  const manifestPaths = [...gallery.slice(manifestStart, manifestEnd).matchAll(/'([^']+)'/g)]
    .map((match) => match[1])
    .sort();

  assert.doesNotMatch(source, /Notes \/ source|babel-card-notes/);
  assert.doesNotMatch(html, /This is the finished set, not every experiment that came before it\./);
  assert.doesNotMatch(html, /Each card uses Babel's real tree renderer\./);
  if (imageAssets.length > 0) assert.deepEqual(manifestPaths, imageAssets);
  assert.equal(manifestPaths.length, 191);
  assert.equal(new Set(manifestPaths).size, manifestPaths.length);
  manifestPaths.forEach((path) => {
    assert.match(path, /^visual-relations-assets\/.+\.(?:png|jpe?g|webp|gif)$/i);
  });
  assert.match(gallery, /loading="lazy"/);
  for (const releasedHtml of [html, publicHtml]) {
    assert.doesNotMatch(releasedHtml, /id="babel-source-gallery"/);
    assert.doesNotMatch(releasedHtml, /191 figures/);
    assert.match(releasedHtml, />Research records</);
  }
});

test('the visual vocabulary is exhaustive, isolated, and tree-free', async () => {
  const vocabulary = await readFile(
    new URL('../docs/design/visual-relations-vocabulary.tsx', import.meta.url),
    'utf8'
  );
  const html = await readFile(
    new URL('../docs/design/babel-visual-relations-research.production-only-audit.html', import.meta.url),
    'utf8'
  );
  const listStart = vocabulary.indexOf('export const visualPrimitiveNames');
  const listEnd = vocabulary.indexOf('];', listStart);
  const names = [...vocabulary.slice(listStart, listEnd).matchAll(/'([^']+)'/g)]
    .map((match) => match[1]);

  /*
   * The canonical inventory is a vocabulary of reusable drawing atoms and
   * style variants. It must not recreate complete relations or authored trees.
   */
  const expectedInventory = [
    'Movement curve',
    'Orthogonal movement',
    'Cross-workspace crest',
    'Carrier arrow',
    'Path states',
    'Gap label',
    'Coindex',
    'Lens emphasis',
    'Forest light',
    'Rectangular domain',
    'Control connector',
    'Elliptic domain',
    'Predication connector',
    'Path-node rings',
    'Copy fork',
    'Barrier cut',
    'Ghosting',
    'Correspondence curves',
    'Correspondence index',
    'Strike',
    'Constituent enclosure',
    'Gradient enclosure',
    'Branch overlay',
    'Shared branch',
    'Crossed domain ovals',
    'Label box',
    'Underline',
    'Domain bracket',
    'Plaque shell',
    'Feature vine',
    'Cycle badge',
    'Feature connectors',
    'Dependent-case elbow',
    'Accord connector',
    'Boxed index',
    'Phase arc',
    'Transfer arcs',
    'Overlay annotation',
    'Edge outline',
    'Access path',
    'Verdict glyph',
    'Verdict label',
    'Candidate rail',
    'Blocking cross',
    'Licensed check',
    'Intervention path',
    'Blocked extraction curve',
    'Prominence branches',
    'Projection hop',
    'Feature annotation',
    'Accent annotation',
    'Nested association curves',
    'Feature notation',
    'Ledger frame',
    'Covert path',
    'Scope domain',
    'Ranked scope hulls',
    'Variable-binding path',
    'Role grid',
    'PF plate frame',
    'PF plate rows',
    'Rewrite arrow',
    'Correspondence map',
    'Bundle shell',
    'Delinking mark',
    'State lanes',
    'Comparison column layout',
    'Anchor badge',
    'Anchor rail'
  ];
  assert.deepEqual(names, expectedInventory);
  assert.equal(new Set(names).size, 69);
  assert.doesNotMatch(vocabulary, /TreeVisualizer|SyntaxNode|derivationStages|workspaceForest/);
  assert.match(vocabulary, /const OPERATOR_AMBER = '#c98a3d';/);
  assert.doesNotMatch(vocabulary, /#f59e0b/);
  assert.doesNotMatch(html, /\.babel-vocabulary-(?:anchor|index|numeral|badge|identity|domain|ghost|fallback|counter|shape|path|plaque|text|gapping|operator|strike|branch|shared)/);

  /* Card-authored content and complete relation compositions stay out. */
  for (const authoredValue of [
    'OBJ',
    '[NEG]',
    'Phase edge',
    'SOD',
    'ℰxh[D]',
    'NPI[D]',
    'category:',
    'qstore:',
    'retrieved:',
    'Mia',
    'Agent',
    'Theme',
    'PF REALIZATION',
    'T[past]',
    '√laugh',
    'laughed',
    '-nak',
    'DAT',
    'PRIOR TERMINAL',
    '[+aux]',
    '[+agr]',
    '[+part]',
    'BEFORE',
    'AFTER',
    'PRIOR DOMAIN',
    'CURRENT DOMAIN',
    'CyclicLinearization · order'
  ]) {
    assert.equal(vocabulary.includes(authoredValue), false, `${authoredValue} is card content, not a primitive`);
  }
  assert.doesNotMatch(vocabulary, /OPERATOR_PATHS|OPERATOR_INDICES|data-operator-variable-index-role/);
  assert.doesNotMatch(vocabulary, />F<\/text>|>H\*<\/text>/);
  assert.doesNotMatch(vocabulary, /•/);

  /* Every specimen reuses actual production classes, never lookalike CSS. */
  for (const productionClass of [
    'babel-trajectory-path',
    'babel-trajectory-path-shadow',
    'babel-trajectory-arrowhead',
    'babel-trajectory-path-roll-up',
    'babel-trajectory-path-sideward',
    'babel-trajectory-path-smuggling',
    'babel-carrier-arrowhead',
    'babel-locality-path-licensed',
    'babel-locality-path-failed',
    'babel-gap-notation',
    'babel-pg-gap-label',
    'babel-binding-index',
    'babel-binding-domain',
    'babel-lens-node',
    'babel-forest-light-canvas',
    'babel-agree-cycle-badge',
    'babel-agree-directed-path-multiple',
    'babel-agree-arrowhead',
    'babel-case-assignment-path',
    'babel-case-collection-path',
    'babel-feature-sharing-vine',
    'babel-anchor-set-badge',
    'babel-anchor-set-badge-number',
    'babel-anchor-set-rail',
    'babel-anchor-set-stub',
    'babel-predication-path',
    'babel-pg-path-node',
    'babel-island-barrier-cut',
    'babel-island-barrier-shadow',
    'babel-control-domain',
    'babel-control-dependency',
    'babel-control-dependency-marker',
    'babel-feature-plaque-shell',
    'babel-argument-sharing-object-box',
    'babel-argument-sharing-domain',
    'babel-idiom-domain-bracket',
    'babel-idiom-chunk-underline',
    'babel-gapping-correspondence',
    'babel-gapping-arrowhead',
    'babel-gapping-index',
    'babel-lf-path-qr',
    'babel-lf-arrowhead',
    'babel-lf-domain',
    'babel-lf-strike',
    'babel-lf-strike-shadow',
    'babel-lf-ghost-label',
    'babel-lf-copy-label',
    'babel-operator-variable-domain',
    'babel-operator-variable-path',
    'babel-operator-variable-arrowhead',
    'babel-partial-copy-deletion-strike',
    'babel-constituent-enclosure',
    'babel-enclosure-remnant-landing',
    'babel-enclosure-copy-occurrence',
    'babel-enclosure-carrier-chunk',
    'babel-improper-forbidden-region',
    'babel-native-branch-overlay',
    'babel-focus-branch-strong',
    'babel-focus-branch-weak',
    'babel-focus-branch-mask',
    'babel-multidominance-branch',
    'babel-shared-feature-plaque',
    'babel-phase-arc',
    'babel-phase-arc-primary',
    'babel-phase-arc-shadow-primary',
    'babel-transfer-phase-arc',
    'babel-transfer-domain-arc',
    'babel-transfer-component-label',
    'babel-transfer-edge-outline',
    'babel-transfer-access-path',
    'babel-transfer-access-origin',
    'babel-anti-locality-cap',
    'babel-anti-locality-face',
    'babel-improper-candidate-rail',
    'babel-improper-candidate-path-licensed',
    'babel-improper-candidate-path-blocked',
    'babel-domain-locality-arrowhead',
    'babel-domain-locality-x',
    'babel-domain-locality-x-shadow',
    'babel-dependent-case-elbow',
    'babel-dependent-case-endpoint',
    'babel-accord-path',
    'babel-accord-arrowhead',
    'babel-accord-index-box',
    'babel-accord-index',
    'babel-intervention-x-mark',
    'babel-intervention-search-path',
    'babel-intervention-arrowhead',
    'babel-blocked-extraction-path',
    'babel-blocked-extraction-marker',
    'babel-analysis-verdict-label',
    'babel-f-projection-path',
    'babel-f-projection-arrowhead',
    'babel-f-projection-feature',
    'babel-f-projection-accent',
    'babel-strong-npi-path-outer',
    'babel-strong-npi-path-inner',
    'babel-strong-npi-feature-mark',
    'babel-cooper-storage-plaque',
    'babel-cooper-storage-bracket',
    'babel-cooper-storage-connector',
    'babel-cooper-storage-key',
    'babel-cooper-storage-value',
    'babel-theta-grid-shell',
    'babel-theta-grid-rule',
    'babel-pf-plate-shell',
    'babel-pf-plate-rule',
    'babel-pf-plate-arrow',
    'babel-pf-plate-output',
    'babel-pf-plate-text-final',
    'babel-phrasal-spellout-label',
    'babel-pf-correspondence-shell',
    'babel-pf-correspondence-link',
    'babel-pf-correspondence-source',
    'babel-pf-correspondence-exponent',
    'babel-fission-bundle-shell',
    'babel-fission-bundle-title',
    'babel-fission-bundle-row',
    'babel-fission-arrow',
    'babel-impoverishment-link',
    'babel-impoverishment-cross',
    'babel-pf-lane-label',
    'babel-pf-lane-expression',
    'babel-pf-lane-expression-current',
    'babel-linearization-column-title',
    'babel-linearization-row',
    'babel-linearization-row-current',
    'babel-ellipsis-ghost-label',
    'babel-domain-locality-check'
  ]) {
    assert.match(vocabulary, new RegExp(productionClass), `${productionClass} is reused from production`);
  }
  assert.doesNotMatch(vocabulary, /vr-(?:fallback|shape|domain|branch|shared)/);
  assert.match(vocabulary, /className="babel-anchor-set-badge-number" x="0" y="2\.7" textAnchor="middle" fontSize="8"/);
  assert.match(vocabulary, /className="babel-carrier-arrowhead"\s+d="M 136 96 L 160 60 L 184 96 Z"/);
  assert.match(vocabulary, /className="babel-phase-arc babel-phase-arc-primary"/);
  assert.match(vocabulary, /className="babel-improper-candidate-rail" d="M 280 82 L 280 154 L 58 154"/);
  assert.match(vocabulary, /d="M 58 154 L 58 52"/);
  assert.match(vocabulary, /d="M 178 154 L 178 70"/);
  assert.match(vocabulary, /d="M 230 154 L 230 94"/);
  assert.match(vocabulary, /d="M 256 154 L 256 106"/);
  assert.match(vocabulary, /className="babel-analysis-verdict-label"[^>]*>\s*diagnosis\s*<\/text>/);
  assert.match(vocabulary, /className="babel-strong-npi-feature-mark"[^>]*>α\[β\]<\/text>/);
  assert.doesNotMatch(vocabulary, /babel-anchor-set-rail-label/);
  assert.match(vocabulary, /className="babel-anchor-set-stub" x1="88" y1="64" x2="88" y2="116"/);
  assert.match(vocabulary, /className="babel-anchor-set-rail" x1="88" y1="116" x2="232" y2="116"/);

  /* Archived-only implementations must not be presented as canonical vocabulary. */
  for (const archivedOnly of [
    'babel-pg-blocked-edge',
    'babel-ellipsis-licensing-link',
    'babel-vpe-ellipsis-slash',
    'babel-linearization-row-conflict',
    'babel-linearization-failure-mark'
  ]) {
    assert.doesNotMatch(vocabulary, new RegExp(`${archivedOnly}[^-]`), `${archivedOnly} stays archived-only`);
  }

  /* Scope hulls and thin binding paths are separate reusable primitives. */
  assert.match(vocabulary, /const OPERATOR_PALETTE = \['#10b981', OPERATOR_AMBER, '#e6efeb'\];/);
  assert.match(vocabulary, /fillOpacity: 0\.12, strokeOpacity: 0\.88, strokeWidth: 3, dash: '10 9'/);
  assert.match(vocabulary, /fillOpacity: 0\.105, strokeOpacity: 0\.78, strokeWidth: 3\.2, dash: '12 8'/);
  assert.match(vocabulary, /strokeWidth="1\.15"/);
  assert.match(vocabulary, /strokeWidth="1\.2"/);
  assert.match(vocabulary, /d="M 1 -4 L 8\.5 0 L 1 4"/);
  assert.match(vocabulary, /M403\.5,160\.1C397\.8,139\.1/);
  assert.match(vocabulary, /data-operator-variable-rank/);
  assert.match(vocabulary, /data-operator-variable-count="3"/);
  assert.match(vocabulary, /case 'Ranked scope hulls'/);
  assert.match(vocabulary, /case 'Variable-binding path'/);

  /* Covert scope is the production rectilinear elbow, not an invented curve. */
  assert.match(vocabulary, /d="M 80 146 L 80 52 L 240 52 L 240 112"/);
  assert.match(vocabulary, /className="babel-lf-domain"/);
  assert.match(vocabulary, /data-lf-domain-kind="scope"/);
  assert.match(vocabulary, /className="babel-gapping-index babel-relation-index"/);
  assert.match(vocabulary, /d="M 160 48 L 160 132 L 84 132 L 84 92"/);
  /* The carrier shaft ends at the head base instead of showing through it. */
  assert.match(vocabulary, /d="M 160 148 L 160 96"/);
  assert.match(vocabulary, /d="M 136 96 L 160 60 L 184 96 Z"/);
  /* The control route gives the production marker a clean vertical approach. */
  assert.match(vocabulary, /d="M 250 148 L 250 118 L 74 118 L 74 42"/);
  assert.match(html, /\.babel-partial-copy-deletion-strike \{[\s\S]*stroke: rgba\(167, 243, 208, 0\.92\);[\s\S]*stroke-width: 1\.6px;/);
  assert.match(html, /\.babel-feature-plaque-shell \{[\s\S]*fill: rgba\(2, 18, 13, 0\.74\);[\s\S]*stroke: rgba\(94, 234, 157, 0\.58\);/);
  assert.match(
    html,
    /\.babel-focus-branch-strong \{[\s\S]*?stroke: rgba\(126, 88, 30, 0\.98\);[\s\S]*?drop-shadow\(0 0 3px rgba\(181, 129, 45, 0\.22\)\)/,
    'the strong focus branch keeps the accepted autumn-brown styling'
  );
  assert.match(
    html,
    /\.babel-focus-branch-weak \{[\s\S]*?stroke: rgba\(126, 88, 30, 0\.46\);/,
    'the weak focus branch keeps its accepted brown contrast'
  );
  assert.match(html, /id="visual-vocabulary"/);
  assert.match(html, /id="babel-visual-vocabulary"/);
  assert.doesNotMatch(html, /view=fixtures/);
  assert.doesNotMatch(html, />Examples</);
});

test('Atlas fixtures use genuine authored stages instead of relation-only timing stages', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /relationOnlyStage/);

  const cardSource = (title) => {
    const start = source.indexOf(`title: '${title}'`);
    assert.ok(start >= 0, `${title} is present`);
    const next = source.indexOf("\n  {\n    archetype:", start + 1);
    return source.slice(start, next >= 0 ? next : source.length);
  };
  for (const title of [
    'Binding / Principle A'
  ]) {
    assert.equal(
      (cardSource(title).match(/\bstage\(/g) || []).length,
      1,
      `${title} remains one compact model-authored inspection stage`
    );
  }
  for (const title of [
    'Control Dependency',
    'Control Dependency (object control)',
    'Binding / C-command Failure',
    'Plain Coreference',
    'Plain Coreference (across coordination)'
  ]) {
    assert.equal(
      (cardSource(title).match(/\bstage\(/g) || []).length,
      2,
      `${title} separates workspace construction from the interpretive relation`
    );
  }
  assert.equal(
    (cardSource('Transfer / Spell-Out Domain').match(/\bstage\(/g) || []).length,
    2,
    'Phase identification and Transfer remain two genuine operations without a no-op base stage'
  );
});

test('Atlas cards use only the current production contract and renderer path', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /disableRelationOverlay=\{false\}/u);
  assert.doesNotMatch(
    source,
    /\b(?:productionOverlay|stageScopedTrajectories|accumulatedTrajectories|derivationSteps|surfaceOrder|visualRelations|resolvedVisualRelations|visualRelationEvents)\b/u
  );
  assert.doesNotMatch(
    source,
    /\b(?:markLensNodes|renderTrajectoryRelation|hydrateLabLensFromCurrentContract)\b/u,
    'the Atlas must not retain an alternate Lab painter or semantic hydration path'
  );

  const sourceFile = ts.createSourceFile(
    'visual-relations-current-lab.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const rawCasesDeclaration = sourceFile.statements.find((statement) =>
    ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some((declaration) => declaration.name.getText(sourceFile) === 'rawCases')
  );
  assert.ok(rawCasesDeclaration, 'the Atlas rawCases fixture set is present');
  const rawCases = rawCasesDeclaration.declarationList.declarations
    .find((declaration) => declaration.name.getText(sourceFile) === 'rawCases');
  assert.ok(rawCases?.initializer && ts.isArrayLiteralExpression(rawCases.initializer));

  const allowedCardFields = new Set([
    'archetype',
    'title',
    'status',
    'sentence',
    'data',
    'derivationStages',
    'wide',
    'lensLabel'
  ]);
  rawCases.initializer.elements.forEach((element, index) => {
    assert.ok(ts.isObjectLiteralExpression(element), `card ${index + 1} is an object literal`);
    const fields = element.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => property.name.getText(sourceFile).replace(/^['"]|['"]$/g, ''));
    assert.deepEqual(
      fields.filter((field) => !allowedCardFields.has(field)),
      [],
      `card ${index + 1} has no Lab-only semantic or rendering fields`
    );
  });
});

test('parasitic gap leaves movement and copy-fork ownership entirely to production', () => {
  const pgTree = {
    id: 'cp_pg_test',
    label: 'CP',
    children: [
      { id: 'filler_pg_test', label: 'DP', lineageId: 'pg-test', children: [] },
      {
        id: 'gap_pg_test',
        label: 'DP',
        silent: true,
        lineageId: 'pg-test',
        children: [{ id: 'gap_witness_pg_test', label: 'D', silent: true, children: [] }]
      },
      { id: 'parasitic_one_pg_test', label: 'DP', silent: true, lineageId: 'pg-test', children: [] },
      { id: 'parasitic_two_pg_test', label: 'DP', silent: true, lineageId: 'pg-test', children: [] }
    ]
  };
  const pgStages = [{
    statement: 'A filler licenses two gaps.',
    stageRecord: 'The three occurrences share an index.',
    relations: [{
      relation: 'ParasiticGap',
      anchors: {
        filler: 'filler_pg_test',
        realGap: 'gap_pg_test',
        traceWitness: 'gap_witness_pg_test',
        parasiticGaps: ['parasitic_one_pg_test', 'parasitic_two_pg_test']
      }
    }],
    workspaceForest: [pgTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(pgStages, pgTree);
  assert.equal(lens.coindex, undefined);
  assert.equal(lens.gapNotation, undefined);
  assert.equal(
    lens.trajectory,
    undefined,
    'the Lab adapter must not independently own the production composite trajectory'
  );
});

test('parasitic-gap island status preserves source path classes and the authored blocked edge', () => {
  const islandTree = {
    id: 'cp_pg_island_test',
    label: 'CP',
    children: [
      { id: 'filler_pg_island_test', label: 'DP', lineageId: 'pg-island-test', children: [] },
      {
        id: 'tp_pg_island_test',
        label: 'TP',
        children: [
          {
            id: 'cp_blocked_pg_island_test',
            label: 'CP',
            children: [{ id: 'parasitic_pg_island_test', label: 'DP', silent: true, children: [] }]
          },
          {
            id: 'real_pg_island_test',
            label: 'DP',
            silent: true,
            lineageId: 'pg-island-test',
            children: [{ id: 'witness_pg_island_test', label: 'D', silent: true, children: [] }]
          }
        ]
      }
    ]
  };
  const islandStages = [{
    statement: 'The secondary path is blocked.',
    stageRecord: 'The relative CP interrupts the square path.',
    relations: [{
      relation: 'ParasiticGap',
      anchors: {
        filler: 'filler_pg_island_test',
        realGap: 'real_pg_island_test',
        traceWitness: 'witness_pg_island_test',
        parasiticGap: 'parasitic_pg_island_test',
        primaryPath: ['cp_pg_island_test', 'tp_pg_island_test', 'real_pg_island_test'],
        secondaryPath: ['cp_blocked_pg_island_test', 'parasitic_pg_island_test'],
        blockedEdge: 'cp_blocked_pg_island_test'
      },
      values: { outcome: 'blocked' }
    }],
    workspaceForest: [islandTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(islandStages, islandTree);
  assert.deepEqual(lens.parasiticGapIsland, {
    primaryPath: ['cp_pg_island_test', 'tp_pg_island_test', 'real_pg_island_test'],
    secondaryPath: ['cp_blocked_pg_island_test', 'parasitic_pg_island_test'],
    blockedEdge: 'cp_blocked_pg_island_test',
    outcome: 'blocked'
  });
});

test('split antecedence leaves its source-backed arrows wholly to production', () => {
  const relationTree = {
    id: 'root_completion_test',
    label: 'Root',
    children: [
      { id: 'antecedent_one_completion_test', label: 'DP', children: [] },
      { id: 'antecedent_two_completion_test', label: 'DP', children: [] },
      { id: 'dependent_completion_test', label: 'DP', children: [] },
    ]
  };
  const relationStages = [{
    statement: 'Two source-backed relations are present.',
    stageRecord: 'One dependent origin links to both authored antecedents.',
    relations: [
      {
        relation: 'SplitAntecedence',
        anchors: {
          antecedents: ['antecedent_one_completion_test', 'antecedent_two_completion_test'],
          dependent: 'dependent_completion_test'
        }
      }
    ],
    workspaceForest: [relationTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(relationStages, relationTree);
  assert.equal(lens.coindex, undefined);
});

test('one across-the-board relation compiles paired sources into two convergent paths', () => {
  const atbTree = {
    id: 'cp_atb_test',
    label: 'CP',
    children: [
      { id: 'landing_atb_test', label: 'DP', lineageId: 'atb-test', children: [] },
      {
        id: 'left_atb_test',
        label: 'DP',
        silent: true,
        lineageId: 'atb-test',
        children: [{ id: 'left_witness_atb_test', label: 'D', silent: true, children: [] }]
      },
      {
        id: 'right_atb_test',
        label: 'DP',
        silent: true,
        lineageId: 'atb-test',
        children: [{ id: 'right_witness_atb_test', label: 'D', silent: true, children: [] }]
      }
    ]
  };
  const atbStages = [{
    statement: 'One phrase is extracted from both conjuncts.',
    stageRecord: 'Two gaps converge on one landing.',
    relations: [{
      relation: 'AcrossTheBoardMovement',
      anchors: {
        sources: ['left_atb_test', 'right_atb_test'],
        traceWitnesses: ['left_witness_atb_test', 'right_witness_atb_test'],
        pronouncedCopy: 'landing_atb_test'
      }
    }],
    workspaceForest: [atbTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(atbStages, atbTree);
  assert.deepEqual(lens.trajectory.map((path) => ({
    from: path.from,
    to: path.to,
    witness: path.fromWitness,
    kind: path.kind,
    index: path.index
  })), [
    {
      from: 'left_atb_test',
      to: 'landing_atb_test',
      witness: 'left_witness_atb_test',
      kind: 'atb',
      index: 'i'
    },
    {
      from: 'right_atb_test',
      to: 'landing_atb_test',
      witness: 'right_witness_atb_test',
      kind: 'atb',
      index: 'i'
    }
  ]);
  assert.deepEqual(lens.trajectoryStages, [0, 0]);
});

test('sideward movement trajectory semantics belong to production, not the Lab adapter', () => {
  assert.equal(RECOGNIZED_RELATIONS.trajectory.includes('SidewardMovement'), false);
});

test('phrasal wh trajectories keep movement geometry while operator binding has its own composition', () => {
  assert.equal(trajectoryMeetsPhraseShell('phrasal'), true);
  assert.equal(trajectoryMeetsPhraseShell('atb'), true);
  assert.equal(trajectoryMeetsPhraseShell('parasitic-gap'), true);
  assert.equal(trajectoryMeetsPhraseShell('head'), false);
  assert.equal(trajectoryMeetsPhraseShell('lowering'), false);
  assert.equal(trajectoryMeetsPhraseShell('phrasal-lowering'), true);
  assert.equal(trajectoryRequiresWitness('atb'), true);
  assert.equal(trajectoryRequiresWitness('parasitic-gap'), true);
  assert.equal(trajectoryRequiresWitness('phrasal-lowering'), true);
  assert.deepEqual(
    ACTIVE_VISUAL_DESIGNS.headTrajectory.relations,
    ['HeadMove', 'Lowering']
  );
  assert.deepEqual(
    ACTIVE_VISUAL_DESIGNS.operatorVariableComposition.relations,
    ['OperatorVariableBinding']
  );
  assert.equal(RECOGNIZED_RELATIONS.trajectory.includes('OperatorVariableBinding'), false);
  assert.deepEqual(RECOGNIZED_RELATIONS.operatorVariableBinding, ['OperatorVariableBinding']);
  assert.match(
    ACTIVE_VISUAL_DESIGNS.operatorVariableComposition.label,
    /scope domains, binding paths, and shared indices/i
  );
});

test('remnant departure traces derive from source topology without lineage metadata', () => {
  const evacuated = {
    id: 'object_gap',
    label: 'DP',
    silent: true,
    children: [{ id: 'object_trace', label: 'D', silent: true, children: [] }]
  };
  const remnant = {
    id: 'lower_phrase',
    label: 'XP',
    silent: true,
    children: [
      { id: 'head_trace', label: 'X', silent: true, children: [] },
      evacuated,
      {
        id: 'complement',
        label: 'YP',
        silent: true,
        children: [{ id: 'complement_trace', label: 'Y', silent: true, children: [] }]
      },
      { id: 'null_head', label: '∅', silent: true, children: [] }
    ]
  };

  assert.deepEqual(
    remnantDepartureTraceIds(remnant, [evacuated]),
    ['head_trace', 'complement_trace']
  );
  assert.deepEqual(
    remnantDepartureTraceIds(remnant),
    ['head_trace', 'object_trace', 'complement_trace']
  );
});

test('ellipsis recoverability preserves only its authored antecedent-site correspondence', () => {
  const ellipsisTree = {
    id: 'coord',
    label: 'CoordP',
    children: [
      { id: 'antecedent', label: 'VP', children: [{ id: 'read_overt', label: 'V', word: 'read' }] },
      { id: 'site', label: 'VP', silent: true, children: [{ id: 'read_silent', label: 'V', silent: true }] }
    ]
  };
  const ellipsisStages = [{
    statement: 'The VP is unpronounced.',
    stageRecord: 'The silent VP is recoverable from its antecedent.',
    relations: [{ relation: 'EllipsisRecoverability', anchors: { antecedent: 'antecedent', site: 'site' } }],
    workspaceForest: [ellipsisTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(ellipsisStages, ellipsisTree, {
    label: 'Ellipsis lens',
    nodes: []
  });
  assert.deepEqual(lens.ellipsisRecoverability, {
    antecedent: 'antecedent',
    site: 'site',
    stage: 0,
    relationIndex: 0
  });
  assert.equal(lens.ellipsis, undefined);
});

test('Sluicing requires explicit movement, licensing, deletion, and recoverability relations', () => {
  const sluicingTree = {
    id: 'coord_sluicing_lens',
    label: 'CoordP',
    children: [
      {
        id: 'antecedent_sluicing_lens',
        label: 'TP',
        children: [{ id: 'antecedent_v_sluicing_lens', label: 'V', word: 'left' }]
      },
      {
        id: 'cp_sluicing_lens',
        label: 'CP',
        children: [
          {
            id: 'remnant_sluicing_lens',
            label: 'AdvP',
            lineageId: 'sluicing-lens-chain',
            children: [{ id: 'remnant_adv_sluicing_lens', label: 'Adv', word: 'why' }]
          },
          {
            id: 'site_sluicing_lens',
            label: 'TP',
            silent: true,
            children: [{
              id: 'lower_sluicing_lens',
              label: 'AdvP',
              silent: true,
              lineageId: 'sluicing-lens-chain',
              children: [{ id: 'lower_adv_sluicing_lens', label: 'Adv', silent: true }]
            }]
          }
        ]
      }
    ]
  };
  const stages = [{
    statement: 'The clause is sluiced by composing three independent claims.',
    stageRecord: 'Movement, deletion, and recoverability are explicit.',
    relations: [
      {
        relation: 'AbarMove',
        anchors: {
          lowerCopy: 'lower_sluicing_lens',
          traceWitness: 'lower_adv_sluicing_lens',
          pronouncedCopy: 'remnant_sluicing_lens'
        }
      },
      {
        relation: 'EllipsisDeletion',
        anchors: { domain: 'site_sluicing_lens' }
      },
      {
        relation: 'EllipsisRecoverability',
        anchors: {
          site: 'site_sluicing_lens',
          antecedent: 'antecedent_sluicing_lens'
        }
      }
    ],
    workspaceForest: [sluicingTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(stages, sluicingTree, {
    label: 'Sluicing lens',
    nodes: []
  });
  assert.deepEqual(lens.trajectory, [{
    from: 'lower_sluicing_lens',
    to: 'remnant_sluicing_lens',
    kind: 'phrasal',
    relation: 'AbarMove',
    index: '1',
    fromWitness: 'lower_adv_sluicing_lens'
  }]);
  assert.deepEqual(lens.ellipsisRecoverability, {
    antecedent: 'antecedent_sluicing_lens',
    site: 'site_sluicing_lens',
    stage: 0,
    relationIndex: 2
  });
  assert.deepEqual(unregisteredRelationNames([{
    ...stages[0],
    relations: [{ relation: 'Sluicing', anchors: { site: 'site_sluicing_lens' } }]
  }]), ['Sluicing']);
});

test('an E feature uses the ordinary feature plaque without implying ellipsis', () => {
  const licensingTree = {
    id: 'cp',
    label: 'CP',
    children: [
      { id: 'c_licensor', label: 'C', children: [] },
      {
        id: 'tp_domain',
        label: 'TP',
        silent: true,
        children: [{ id: 'vp_domain', label: 'VP', silent: true, children: [] }]
      }
    ]
  };
  const licensingStages = [
    {
      statement: 'Build the clause.',
      stageRecord: 'No ellipsis is licensed yet.',
      relations: [],
      workspaceForest: [licensingTree]
    },
    {
      statement: 'C bears an E feature.',
      stageRecord: 'FeatureBundle records the authored feature without adding another claim.',
      relations: [{
        relation: 'FeatureBundle',
        anchors: { licensor: 'c_licensor' },
        values: { feature: '[E]' }
      }],
      workspaceForest: [licensingTree]
    }
  ];

  const lens = hydrateLabLensFromCurrentContract(licensingStages, licensingTree, {
    label: 'Ellipsis lens',
    nodes: []
  });

  assert.deepEqual(lens.featureValuation.annotations, [{
    anchor: 'c_licensor',
    anchorNodes: ['c_licensor'],
    title: 'C licensor',
    placement: 'below-anchor',
    rows: [{ label: 'feature', value: '[E]' }],
    stage: 1,
    relationIndex: 0
  }]);
  assert.equal(lens.ellipsis, undefined);
  assert.equal(lens.trajectory, undefined);
});

test('EllipsisDeletion leaves terminal striking to production and adds no ghost lens', () => {
  const deletionTree = {
    id: 'tp',
    label: 'TP',
    children: [
      { id: 'escaped_dp', label: 'DP', word: 'Jane', children: [] },
      {
        id: 'silent_vp',
        label: 'VP',
        silent: true,
        children: [{ id: 'silent_v', label: 'V', silent: true, children: [] }]
      }
    ]
  };
  const deletionStages = [{
    statement: 'The remnant has escaped and VP is silent.',
    stageRecord: 'EllipsisDeletion silences the authored VP.',
    relations: [{ relation: 'EllipsisDeletion', anchors: { domain: 'silent_vp' } }],
    workspaceForest: [deletionTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(deletionStages, deletionTree, {
    label: 'Deletion lens',
    nodes: []
  });

  assert.equal(lens.ellipsis, undefined);
  assert.equal(lens.featureValuation, undefined);
});

test('CopyOccurrence owns the boxes while PartialCopyDeletion owns only the selected constituent', () => {
  const copyTree = {
    id: 'cp',
    label: 'CP',
    children: [
      { id: 'vp_high', label: 'VP', children: [] },
      {
        id: 'vp_low',
        label: 'VP',
        children: [
          { id: 'v_low', label: 'V', word: 'kan', children: [] },
          { id: 'dp_low', label: 'DP', silent: true, children: [] }
        ]
      }
    ]
  };
  const copyStages = [
    {
      statement: 'Both VP occurrences are pronounced.',
      stageRecord: 'CopyOccurrence identifies the two complete copies.',
      relations: [
        {
          relation: 'AbarMove',
          anchors: { lowerCopy: 'vp_low', pronouncedCopy: 'vp_high' }
        },
        {
          relation: 'CopyOccurrence',
          anchors: { higherCopy: 'vp_high', lowerCopy: 'vp_low' }
        }
      ],
      workspaceForest: [copyTree]
    },
    {
      statement: 'PF deletes only the lower object.',
      stageRecord: 'PartialCopyDeletion selects the lower DP.',
      relations: [{
        relation: 'PartialCopyDeletion',
        anchors: { deletedSubconstituent: 'dp_low' }
      }],
      workspaceForest: [copyTree]
    }
  ];

  const lens = hydrateLabLensFromCurrentContract(copyStages, copyTree, {
    label: 'Partial deletion lens',
    nodes: []
  });

  assert.deepEqual(lens.enclosures, [
    {
      node: 'vp_high',
      licence: 'copy-occurrence',
      nodes: ['vp_high'],
      stage: 0,
      relationIndex: 1
    },
    {
      node: 'vp_low',
      licence: 'copy-occurrence',
      nodes: ['vp_low', 'v_low', 'dp_low'],
      stage: 0,
      relationIndex: 1
    }
  ]);
  assert.deepEqual(lens.partialCopyDeletion, {
    deleted: 'dp_low',
    stage: 1,
    relationIndex: 0
  });
  assert.equal(lens.ellipsis, undefined);
});

test('one-context source-backed designs remain deliberately unfrozen', () => {
  assert.deepEqual(SOURCE_BACKED_UNFROZEN_DESIGNS, {
    phrasalSpellOutLabel: {
      label: 'Phrase-shell spell-out label',
      relations: ['PhrasalSpellOut']
    },
    manyToManyPfCorrespondence: {
      label: 'Node-anchored PF correspondence plate',
      relations: ['ManyToManyCorrespondence']
    },
    fissionFeatureSplit: {
      label: 'One feature bundle split into two output bundles',
      relations: ['Fission']
    },
    impoverishmentDelinking: {
      label: 'Feature geometry with one delinked dependency',
      relations: ['Impoverishment']
    },
    localDislocationLane: {
      label: 'Before-and-after PF adjacency lane',
      relations: ['LocalDislocation']
    },
    cooperStorageLedger: {
      label: 'Staged qstore and retrieval plaques',
      relations: ['CooperStorage']
    },
    negativeConcordAccord: {
      label: 'Indexed polarity features plus directed Accord connector',
      relations: ['Accord']
    },
    strongNpiPathContainment: {
      label: 'Nested Exhaustifier and focus-association dependencies',
      relations: ['StrongNPILicensing']
    },
    fProjectionPropagation: {
      label: 'Accent mark and upward F-projection paths',
      relations: ['FProjection']
    },
    splitAntecedenceIndices: {
      label: 'Separate antecedent indices summed on one dependent',
      relations: ['SplitAntecedence']
    },
    gappingAlignmentPlate: {
      label: 'Predicate and ordered correlate-remnant correspondences',
      relations: ['GappingAlignment']
    },
    parasiticIslandPathStatus: {
      label: 'Primary and secondary path nodes with blocked-edge status',
      relations: ['ParasiticGap']
    },
    sluicingComposition: {
      label: 'Wh movement and ellipsis ghosting as explicit claims',
      relations: ['AbarMove', 'Ellipsis']
    }
  });
  const activeRelationNames = Object.values(ACTIVE_VISUAL_DESIGNS)
    .flatMap((design) => design.relations);
  assert.equal(activeRelationNames.includes('EllipsisLicensing'), false);
  for (const relationName of [
    'PartialCopyDeletion',
    'CyclicLinearization'
  ]) {
    assert.equal(activeRelationNames.includes(relationName), true);
  }
  assert.equal(activeRelationNames.includes('RemnantEscape'), false);
});

test('the four scope and information-structure relations compile only their authored marks', () => {
  const relationTree = {
    id: 'root_scope_information_test',
    label: 'Root',
    children: [
      { id: 'storage_scope_test', label: 'S', children: [] },
      { id: 'accord_source_test', label: 'I', children: [] },
      { id: 'accord_goal_test', label: 'DP', children: [] },
      { id: 'exhaustifier_test', label: 'Exh', children: [] },
      { id: 'npi_test', label: 'DP', children: [] },
      { id: 'only_test', label: 'Adv', children: [] },
      { id: 'associate_test', label: 'DP', children: [] },
      { id: 'accent_test', label: 'D', children: [] },
      { id: 'projection_one_test', label: 'V', children: [] },
      { id: 'projection_two_test', label: 'VP', children: [] }
    ]
  };
  const relationStages = [
    {
      statement: 'Introduce the five relations.',
      stageRecord: 'Every drawing uses only its named anchors.',
      relations: [
        {
          relation: 'CooperStorage',
          anchors: { scope: 'storage_scope_test' },
          values: { category: 'S', qstore: ['everyone', 'someone'] }
        },
        {
          relation: 'Accord',
          anchors: { source: 'accord_source_test', goal: 'accord_goal_test' },
          values: { index: '1', feature: 'POL', value: '−' }
        },
        {
          relation: 'StrongNPILicensing',
          anchors: {
            licensor: 'exhaustifier_test',
            npi: 'npi_test',
            focusOperator: 'only_test',
            focusAssociate: 'associate_test'
          },
          values: { feature: 'D' }
        },
        {
          relation: 'FProjection',
          anchors: {
            accentBearer: 'accent_test',
            projections: ['projection_one_test', 'projection_two_test']
          },
          values: { accent: 'H*', feature: 'F' }
        }
      ],
      workspaceForest: [relationTree]
    },
    {
      statement: 'Retrieve the remaining quantifier.',
      stageRecord: 'Only the qstore plaque changes state.',
      relations: [{
        relation: 'CooperStorage',
        anchors: { scope: 'storage_scope_test' },
        values: { category: 'S', retrieved: ['someone'] }
      }],
      workspaceForest: [relationTree]
    }
  ];

  const lens = hydrateLabLensFromCurrentContract(relationStages, relationTree);
  assert.deepEqual(lens.cooperStorage.states, [
    {
      anchor: 'storage_scope_test',
      category: 'S',
      qstore: ['everyone', 'someone'],
      retrieved: [],
      stage: 0,
      relationIndex: 0
    },
    {
      anchor: 'storage_scope_test',
      category: 'S',
      qstore: [],
      retrieved: ['someone'],
      stage: 1,
      relationIndex: 0
    }
  ]);
  assert.deepEqual(lens.accord.links, [{
    source: 'accord_source_test',
    goal: 'accord_goal_test',
    index: '1',
    feature: 'POL',
    value: '−',
    stage: 0,
    relationIndex: 1
  }]);
  assert.deepEqual(lens.strongNpiLicensing, {
    licensor: 'exhaustifier_test',
    npi: 'npi_test',
    focusOperator: 'only_test',
    focusAssociate: 'associate_test',
    feature: 'D',
    stage: 0,
    relationIndex: 2
  });
  assert.deepEqual(lens.fProjection, {
    accentBearer: 'accent_test',
    projections: ['projection_one_test', 'projection_two_test'],
    accent: 'H*',
    feature: 'F',
    stage: 0,
    relationIndex: 3
  });
  assert.equal(lens.trajectory, undefined);
  assert.equal(lens.agreementPaths, undefined);
});

test('relation emphasis retains exact authored relation identities', () => {
  const stages = valuesStage([
    { relation: 'Accord', anchors: { source: 't_probe', goal: 'dp_goal' } },
    { relation: 'FeatureBundle', anchors: { bearer: 'dp_goal' }, values: { Case: 'NOM' } }
  ]);
  const lens = hydrateLabLensFromCurrentContract(stages, valuesTree, {
    label: 'x',
    nodes: [
      { id: 't_probe', role: 'probe' },
      { id: 'tp', role: 'domain' }
    ]
  });
  assert.deepEqual(lens.relationRefs, [
    { stage: 0, relationIndex: 0 },
    { stage: 0, relationIndex: 1 }
  ]);
  assert.deepEqual(lens.nodes[0].relationRefs, [{ stage: 0, relationIndex: 0 }]);
  assert.deepEqual(lens.nodes[1].relationRefs, lens.relationRefs);

});

test('control lens derives a structured silent PRO target and its domain', () => {
  const controlTree = {
    id: 'tp',
    label: 'TP',
    children: [
      { id: 'john_dp', label: 'DP', word: 'John', children: [] },
      {
        id: 'tp_inf',
        label: 'TP',
        children: [{
          id: 'pro_subject',
          label: 'DP',
          silent: true,
          children: [{ id: 'pro_terminal', label: 'PRO', silent: true, children: [] }]
        }]
      }
    ]
  };
  const controlStages = [{
    statement: 'John controls PRO.',
    stageRecord: 'Control relates the controller to the silent subject.',
    relations: [{
      relation: 'Control',
      anchors: { controller: 'john_dp', controllee: 'pro_subject', domain: 'tp_inf' }
    }],
    workspaceForest: [controlTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(controlStages, controlTree, {
    label: 'Control lens',
    nodes: []
  });
  assert.equal(lens.control.controller, 'john_dp');
  assert.equal(lens.control.controllee, 'pro_subject');
  assert.equal(lens.control.domain, 'tp_inf');
  assert.deepEqual(lens.control.domainNodes, ['tp_inf', 'pro_subject', 'pro_terminal']);
});

test('predication compiles one predicand to one or many undirected links', () => {
  const predicationTree = {
    id: 'tp_predication_test',
    label: 'TP',
    children: [
      { id: 'subject_predication_test', label: 'DP', children: [] },
      {
        id: 'vp_predication_test',
        label: 'VP',
        children: [
          { id: 'event_predication_test', label: 'V', word: 'froze' },
          { id: 'result_predication_test', label: 'A', word: 'solid' }
        ]
      }
    ]
  };
  const predicationStages = [{
    statement: 'One subject bears two predicates.',
    stageRecord: 'Predication relates one predicand to two predicate heads.',
    relations: [{
      relation: 'Predication',
      anchors: {
        predicand: 'subject_predication_test',
        predicates: ['event_predication_test', 'result_predication_test']
      }
    }],
    workspaceForest: [predicationTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(predicationStages, predicationTree);
  assert.deepEqual(lens.predication.links, [
    {
      predicand: 'subject_predication_test',
      predicate: 'event_predication_test',
      stage: 0
    },
    {
      predicand: 'subject_predication_test',
      predicate: 'result_predication_test',
      stage: 0
    }
  ]);
  assert.equal(lens.label, 'Predication lens');
  assert.deepEqual(ACTIVE_VISUAL_DESIGNS.predicationDependency.relations, ['Predication']);
  assert.deepEqual(unregisteredRelationNames(predicationStages), []);
});

test('Pair Merge compiles its member and host as one shared-parent fork', () => {
  const tree = {
    id: 'vp_pair_test',
    label: 'VP',
    children: [
      { id: 'vp_host_pair_test', label: 'VP', children: [] },
      { id: 'advp_pair_test', label: 'AdvP', children: [] }
    ]
  };
  const stages = [{
    statement: 'The adjunct is Pair-Merged with its host.',
    stageRecord: 'PairMerge names the pair member and host.',
    relations: [{
      relation: 'PairMerge',
      anchors: {
        pairMember: 'advp_pair_test',
        host: 'vp_host_pair_test'
      }
    }],
    workspaceForest: [tree]
  }];

  const lens = hydrateLabLensFromCurrentContract(stages, tree);
  assert.deepEqual(lens.pairMerge.links, [{
    pairMember: 'advp_pair_test',
    host: 'vp_host_pair_test'
  }]);
  assert.equal(lens.label, 'Pair-Merge lens');
  assert.deepEqual(ACTIVE_VISUAL_DESIGNS.pairMergeFork.relations, ['PairMerge']);
  assert.deepEqual(unregisteredRelationNames(stages), []);
});

test('blocked adjunct extraction compiles its source, target, domain, and label', () => {
  const tree = {
    id: 'cp_blocked_test',
    label: 'CP',
    children: [
      { id: 'c_target_blocked_test', label: 'C', children: [] },
      {
        id: 'vp_blocked_test',
        label: 'VP',
        children: [{
          id: 'pp_domain_blocked_test',
          label: 'PP',
          children: [{ id: 'dp_source_blocked_test', label: 'DP', children: [] }]
        }]
      }
    ]
  };
  const stages = [{
    statement: 'Extraction from the adjunct is blocked.',
    stageRecord: 'BlockedExtraction names the impossible dependency.',
    relations: [{
      relation: 'BlockedExtraction',
      anchors: {
        source: 'dp_source_blocked_test',
        target: 'cp_blocked_test',
        adjunctDomain: 'pp_domain_blocked_test'
      },
      values: { label: '* extraction' }
    }],
    workspaceForest: [tree]
  }];

  const lens = hydrateLabLensFromCurrentContract(stages, tree);
  assert.deepEqual(lens.blockedExtraction.paths, [{
    source: 'dp_source_blocked_test',
    target: 'cp_blocked_test',
    domain: 'pp_domain_blocked_test',
    label: '* extraction'
  }]);
  assert.deepEqual(
    ACTIVE_VISUAL_DESIGNS.blockedAdjunctExtraction.relations,
    ['AdjunctInaccessibility', 'BlockedExtraction']
  );
  assert.deepEqual(unregisteredRelationNames(stages), []);
});

test('the shared native branch overlay stops clear of each target label', async () => {
  const renderer = await readFile(
    new URL('../components/TreeVisualizer.tsx', import.meta.url),
    'utf8'
  );
  assert.match(renderer, /sampleNativeBranchOverlay/);
  assert.match(renderer, /measuredTreeLabelRectNow\(targetNodeId, false\)/);
  assert.match(renderer, /nativeBranchNode\.getTotalLength\(\)/);
  assert.match(renderer, /nativeBranchNode\.getPointAtLength\(/);
  assert.match(renderer, /const endClearance = Math\.max\(28, targetLabelRect\.height \/ 2 \+ 16\)/);
  assert.match(renderer, /primitive\.requireSharedParent/);
  assert.match(renderer, /babel-native-branch-overlay/);
  assert.match(renderer, /babel-pair-merge-branch/);
  assert.doesNotMatch(renderer, /nativeBranch\.style\('opacity', '0'\)/);
  assert.doesNotMatch(renderer, /babel-blocked-extraction-branch-mask/);
  assert.doesNotMatch(renderer, /babel-blocked-extraction-adjunct-clearance-/);
});

test('idiom cointerpretation keeps open chunk roles and separates the domain', () => {
  const tree = {
    id: 'vp_idiom_test',
    label: 'VP',
    children: [
      { id: 'v_idiom_test', label: 'V', word: 'cook' },
      { id: 'dp_idiom_test', label: 'DP', children: [] }
    ]
  };
  const stages = [{
    statement: 'Two chunks are interpreted together.',
    stageRecord: 'IdiomChunkCointerpretation names the chunks and domain.',
    relations: [{
      relation: 'IdiomChunkCointerpretation',
      anchors: {
        predicateChunk: 'v_idiom_test',
        argumentChunk: 'dp_idiom_test',
        interpretationDomain: 'vp_idiom_test'
      }
    }],
    workspaceForest: [tree]
  }];

  const lens = hydrateLabLensFromCurrentContract(stages, tree);
  assert.deepEqual(lens.idiomChunks.relations, [{
    domain: 'vp_idiom_test',
    chunks: ['v_idiom_test', 'dp_idiom_test']
  }]);
  assert.deepEqual(
    ACTIVE_VISUAL_DESIGNS.idiomChunkDomain.relations,
    ['IdiomChunkCointerpretation']
  );
  assert.deepEqual(unregisteredRelationNames(stages), []);
});

test('domain and locality relations hydrate only their authored syntax-node anchors', () => {
  const localityTree = {
    id: 'cp_locality_test',
    label: 'CP',
    children: [
      { id: 'edge_locality_test', label: 'DP', children: [] },
      { id: 'spellout_locality_test', label: 'VP', children: [] },
      { id: 'probe_locality_test', label: 'T', children: [] },
      { id: 'goal_locality_test', label: 'DP', children: [] },
      { id: 'source_locality_test', label: 'DP', children: [] },
      { id: 'trace_locality_test', label: 'D', children: [] },
      { id: 'facilitator_locality_test', label: 'AdvP', children: [] },
      { id: 'landing_locality_test', label: 'DP', children: [] },
      { id: 'licensed_host_locality_test', label: 'TP', children: [] },
      { id: 'rejected_host_locality_test', label: 'vP', children: [] }
    ]
  };
  const stages = [
    {
      statement: 'Build the base structure.',
      stageRecord: 'No relation is drawn yet.',
      relations: [],
      workspaceForest: [localityTree]
    },
    {
      statement: 'Evaluate the domains and dependencies.',
      stageRecord: 'The source-backed locality relations are active.',
      relations: [
        {
          relation: 'TransferDomain',
          anchors: {
            phase: 'cp_locality_test',
            edge: 'edge_locality_test',
            spellOutDomain: 'spellout_locality_test'
          }
        },
        {
          relation: 'PostTransferAccess',
          anchors: {
            source: 'probe_locality_test',
            target: 'goal_locality_test',
            spellOutDomain: 'spellout_locality_test'
          }
        },
        {
          relation: 'AntiLocality',
          anchors: {
            source: 'source_locality_test',
            traceWitness: 'trace_locality_test',
            landing: 'landing_locality_test',
            facilitator: 'facilitator_locality_test'
          },
          values: { outcome: 'licensed' }
        },
        {
          relation: 'ImproperMovement',
          anchors: {
            source: 'source_locality_test',
            traceWitness: 'trace_locality_test',
            licensedLanding: 'landing_locality_test',
            licensedLandingHosts: ['licensed_host_locality_test'],
            rejectedLandingHosts: ['rejected_host_locality_test'],
            forbiddenRegion: ['rejected_host_locality_test']
          }
        }
      ],
      workspaceForest: [localityTree]
    }
  ];

  const lens = hydrateLabLensFromCurrentContract(stages, localityTree);
  assert.deepEqual(lens.transferPic, {
    domains: [{
      phase: 'cp_locality_test',
      edge: 'edge_locality_test',
      spellOutDomain: 'spellout_locality_test',
      stage: 1,
      relationIndex: 0
    }],
    accessAttempts: [{
      source: 'probe_locality_test',
      target: 'goal_locality_test',
      spellOutDomain: 'spellout_locality_test',
      stage: 1,
      relationIndex: 1
    }]
  });
  assert.deepEqual(lens.antiLocality, {
    paths: [{
      source: 'source_locality_test',
      traceWitness: 'trace_locality_test',
      landing: 'landing_locality_test',
      facilitator: 'facilitator_locality_test',
      outcome: 'licensed',
      stage: 1,
      relationIndex: 2
    }]
  });
  assert.deepEqual(lens.improperMovement, {
    source: 'source_locality_test',
    traceWitness: 'trace_locality_test',
    licensedLanding: 'landing_locality_test',
    licensedLandingHosts: ['licensed_host_locality_test'],
    rejectedLandingHosts: ['rejected_host_locality_test'],
    forbiddenRegion: ['rejected_host_locality_test'],
    stage: 1,
    relationIndex: 3
  });
  assert.deepEqual(unregisteredRelationNames(stages), []);
});

test('the locality registry keeps the active source drawings and invents no Freezing primitive', () => {
  assert.deepEqual(ACTIVE_VISUAL_DESIGNS.transferPicComposition.relations, [
    'TransferDomain',
    'PostTransferAccess'
  ]);
  assert.deepEqual(ACTIVE_VISUAL_DESIGNS.antiLocalityComparison.relations, ['AntiLocality']);
  assert.deepEqual(ACTIVE_VISUAL_DESIGNS.improperLandingDomain.relations, ['ImproperMovement']);
  assert.equal(
    Object.values(ACTIVE_VISUAL_DESIGNS)
      .flatMap((design) => design.relations)
      .includes('Freezing'),
    false
  );
});

test('the Transfer cards contain one pronounced edge DP and no unexplained movement copy', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const treeStart = source.indexOf("const transferPhaseTree = node('tp_transfer'");
  const treeEnd = source.indexOf('const multiPhaseTree', treeStart);
  const transferTree = source.slice(treeStart, treeEnd);

  assert.ok(treeStart > 0 && treeEnd > treeStart);
  assert.match(transferTree, /sara_transfer_edge/);
  assert.match(transferTree, /nullHead\('t_probe_transfer', 'T'\)/);
  assert.doesNotMatch(transferTree, /t_past_transfer/);
  assert.doesNotMatch(transferTree, /lineageId/);
  assert.doesNotMatch(transferTree, /silentLexicalNode\('sara/);
  assert.doesNotMatch(transferTree, /trace/);
});

test('phase-only cards keep subjects at their authored edges without hidden movement chains', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const phaseStart = source.indexOf("const phaseTree = node('cp_phase'");
  const transferStart = source.indexOf('const transferPhaseTree', phaseStart);
  const multiStart = source.indexOf("const multiPhaseTree = node('cp_multiphase'");
  const antiStart = source.indexOf('const antiLocalityShortTree', multiStart);
  const phaseTreeSource = source.slice(phaseStart, transferStart);
  const multiPhaseTreeSource = source.slice(multiStart, antiStart);

  assert.ok(phaseStart > 0 && transferStart > phaseStart);
  assert.ok(multiStart > transferStart && antiStart > multiStart);
  assert.equal((phaseTreeSource.match(/'Sara'/g) || []).length, 1);
  assert.match(phaseTreeSource, /node\('sara_phase_edge', 'DP'/);
  assert.doesNotMatch(phaseTreeSource, /lineageId|silentLexicalNode\('sara/);
  assert.equal((multiPhaseTreeSource.match(/'Lena'/g) || []).length, 1);
  assert.equal((multiPhaseTreeSource.match(/'Orion'/g) || []).length, 1);
  assert.match(multiPhaseTreeSource, /node\('lena_matrix_edge', 'DP'/);
  assert.match(multiPhaseTreeSource, /node\('orion_embedded_edge', 'DP'/);
  assert.doesNotMatch(multiPhaseTreeSource, /lineageId|silentLexicalNode\('(?:lena|orion)/);
  assert.match(source, /pronounced C is the phase head and accessible edge anchor/);
});

test('the live lab contains no scalar chain or index pseudo-anchors', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const authoredAnchorBlocks = source.match(/anchors:\s*\{[^}]*\}/gs) || [];
  for (const block of authoredAnchorBlocks) {
    assert.doesNotMatch(block, /\b(?:chain|index)\s*:/);
  }
  // Every active context, including the agreement/Case generalization cards,
  // is authored through real relation blocks rather than lab-only drawing data.
  assert.ok(
    authoredAnchorBlocks.length > 100,
    'the complete Atlas must remain relation-authored rather than falling back to Lab drawing data'
  );
});

test('every live lab anchor resolves to an authored fixture node ID', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('visual-relations-current-lab.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodeIds = new Set();
  const anchorValues = [];

  const collectStringValues = (expression) => {
    if (ts.isStringLiteralLike(expression)) {
      anchorValues.push(expression.text);
      return;
    }
    if (ts.isArrayLiteralExpression(expression)) {
      expression.elements.forEach(collectStringValues);
    }
  };

  const visit = (node) => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && ['node', 'leaf', 'silentLexicalNode', 'nullHead'].includes(node.expression.text)
      && ts.isStringLiteralLike(node.arguments[0])
    ) {
      const id = node.arguments[0].text;
      nodeIds.add(id);
      if (node.expression.text === 'silentLexicalNode') nodeIds.add(`${id}__silent`);
      if (node.expression.text === 'nullHead') nodeIds.add(`${id}__null`);
    }
    if (
      ts.isPropertyAssignment(node)
      && ts.isIdentifier(node.name)
      && ['anchors', 'priorAnchors'].includes(node.name.text)
      && ts.isObjectLiteralExpression(node.initializer)
    ) {
      node.initializer.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property)) collectStringValues(property.initializer);
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  const unresolved = anchorValues.filter((value) => !nodeIds.has(value));
  assert.deepEqual(unresolved, []);
  assert.ok(anchorValues.length > 400, 'the complete Atlas anchor corpus must remain under validation');
});

test('corrected fixtures preserve exact surface tokens and one licensed pronunciation per lineage', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('visual-relations-current-lab.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const evaluate = (expression) => {
    if (!expression) return undefined;
    if (ts.isStringLiteralLike(expression)) return expression.text;
    if (ts.isNumericLiteral(expression)) return Number(expression.text);
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.map(evaluate);
    if (ts.isObjectLiteralExpression(expression)) {
      return Object.fromEntries(expression.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : property.name.getText(file);
        return [[name, evaluate(property.initializer)]];
      }));
    }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
      const name = expression.expression.text;
      const args = expression.arguments.map(evaluate);
      if (name === 'leaf') {
        const [id, label, word, extra = {}] = args;
        return { id, label, ...(word ? { word } : {}), ...extra };
      }
      if (name === 'node') {
        const [id, label, children, extra = {}] = args;
        return { id, label, children, ...extra };
      }
      if (name === 'silentLexicalNode') {
        const [id, label, surface, extra = {}] = args;
        return {
          id,
          label,
          children: [{ id: `${id}__silent`, label: surface, silent: true, ...extra }],
          silent: true,
          ...extra
        };
      }
      if (name === 'nullHead') {
        const [id, label] = args;
        return { id, label, children: [{ id: `${id}__null`, label: '∅', silent: true }] };
      }
    }
    throw new Error(`Unsupported fixture expression: ${expression.getText(file).slice(0, 120)}`);
  };

  const wanted = new Set([
    'controlTree',
    'phaseTree',
    'multiPhaseTree',
    'ellipsisTree',
    'localDislocationTree',
    'qrScopeTree',
    'lfReconstructionTree'
  ]);
  const fixtures = new Map();
  file.statements.forEach((statement) => {
    if (!ts.isVariableStatement(statement)) return;
    statement.declarationList.declarations.forEach((declaration) => {
      if (!ts.isIdentifier(declaration.name) || !wanted.has(declaration.name.text)) return;
      fixtures.set(declaration.name.text, evaluate(declaration.initializer));
    });
  });

  const walk = (root, visit) => {
    visit(root);
    (root.children || []).forEach((child) => walk(child, visit));
  };
  const nodesOf = (name) => {
    const nodes = [];
    walk(fixtures.get(name), (node) => nodes.push(node));
    return nodes;
  };
  const assertSurface = (name, expected) => {
    const surface = nodesOf(name)
      .filter((node) => Number.isInteger(node.tokenIndex) && node.silent !== true && node.word)
      .sort((left, right) => left.tokenIndex - right.tokenIndex)
      .map((node) => node.word);
    assert.deepEqual(surface, expected.split(' '), name);
  };
  const assertSinglePronunciationPerRepeatedLineage = (name) => {
    const byLineage = new Map();
    nodesOf(name).forEach((node) => {
      if (!node.lineageId) return;
      const occurrences = byLineage.get(node.lineageId) || [];
      occurrences.push(node);
      byLineage.set(node.lineageId, occurrences);
    });
    byLineage.forEach((occurrences, lineageId) => {
      if (occurrences.length < 2) return;
      const overt = occurrences.filter((node) => node.silent !== true && Boolean(node.word));
      assert.ok(overt.length <= 1, `${name}:${lineageId} has duplicate pronunciation`);
    });
  };

  assertSurface('controlTree', 'John promised to leave');
  assertSurface('phaseTree', 'Sara read the book');
  assertSurface('multiPhaseTree', 'Lena said that Orion praised the singer');
  assertSurface('localDislocationTree', 'Tery -eer -maan');
  assertSurface('ellipsisTree', 'Lena read the book and Noa did too');
  assertSurface('qrScopeTree', 'Sue read every book');
  assertSurface('lfReconstructionTree', 'Which picture of himself did every student file');

  ['phaseTree', 'multiPhaseTree', 'ellipsisTree', 'qrScopeTree', 'lfReconstructionTree']
    .forEach(assertSinglePronunciationPerRepeatedLineage);

  const silentRoots = [
    ['controlTree', 'pro_subject'],
    ['ellipsisTree', 'vp_silent_site'],
    ['qrScopeTree', 'qp_every_book_high_lf'],
    ['lfReconstructionTree', 'dp_picture_low_lf']
  ];
  silentRoots.forEach(([fixtureName, nodeId]) => {
    const node = nodesOf(fixtureName).find((candidate) => candidate.id === nodeId);
    assert.equal(node?.silent, true, `${fixtureName}:${nodeId} must be silent`);
    assert.ok(node?.children?.length > 0, `${fixtureName}:${nodeId} must preserve its subtree`);
  });
});

test('A1 phrasal movement contains no unauthored lower auxiliary copy', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const block = source.match(
    /const phrasalMovementTree = [\s\S]*?(?=const headMovementTree =)/
  )?.[0] || '';

  assert.ok(block, 'the A1 phrasal-movement fixtures are missing');
  assert.equal(
    (block.match(/leaf\('c_did', 'C', 'did'/g) || []).length,
    2,
    'each A1 stage must pronounce the one auxiliary in C'
  );
  assert.equal(
    (block.match(/nullHead\('t_did_wh', 'T'\)/g) || []).length,
    2,
    'each A1 stage must contain an ordinary null T'
  );
  assert.doesNotMatch(
    block,
    /silentLexicalNode\('t_did_wh', 'T', 'did'/,
    'A1 must not display a second did without an authored head-movement relation'
  );
});

const valuesTree = {
  id: 'tp',
  label: 'TP',
  children: [
    { id: 't_probe', label: 'T', children: [{ id: 't_terminal', label: '[uφ]', silent: true }] },
    { id: 'dp_goal', label: 'DP', children: [{ id: 'd_goal', label: 'D', word: 'The' }] }
  ]
};

const valuesStage = (relations) => [{
  statement: 'T agrees with the DP.',
  stageRecord: 'Agree relates the probe to the goal.',
  relations,
  workspaceForest: [valuesTree]
}];

test('values accept strings and string arrays and reject anything else', () => {
  const ok = validateLabRelations(valuesStage([{
    relation: 'FeatureBundle',
    anchors: { probe: 't_probe' },
    values: { 'uφ': '__ → 3PL', Case: ['NOM', 'NOM'], empty: '' }
  }]), valuesTree);
  assert.deepEqual(ok.issues, []);

  const wrongType = validateLabRelations(valuesStage([{
    relation: 'FeatureBundle',
    anchors: { probe: 't_probe' },
    values: { number: 3 }
  }]), valuesTree);
  assert.equal(wrongType.valid, false);
  assert.equal(wrongType.issues[0].kind, 'value_type');
  assert.match(wrongType.issues[0].detail, /number received number/);

  const emptyArray = validateLabRelations(valuesStage([{
    relation: 'FeatureBundle',
    anchors: { probe: 't_probe' },
    values: { nothing: [] }
  }]), valuesTree);
  assert.equal(emptyArray.issues[0].kind, 'value_empty_array');
});

test('a values literal that duplicates a node ID is flagged, never silently accepted', () => {
  const result = validateLabRelations(valuesStage([{
    relation: 'FeatureBundle',
    anchors: { probe: 't_probe' },
    values: { exponent: 'dp_goal' }
  }]), valuesTree);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].kind, 'value_matches_node_id');
});

test('priorAnchors resolve in the immediately preceding stage only', () => {
  const before = {
    id: 'tp',
    label: 'TP',
    children: [{ id: 'input_a', label: 'T' }, { id: 'input_b', label: 'v' }]
  };
  const after = { id: 'tp', label: 'TP', children: [{ id: 'fused_output', label: 'T+v' }] };
  const stagesWithTransition = [
    { statement: 'Two heads.', stageRecord: 'Both heads are present.', relations: [], workspaceForest: [before] },
    {
      statement: 'The heads fuse.',
      stageRecord: 'Fusion maps both input terminals onto one exponent.',
      relations: [{
        relation: 'Fusion',
        anchors: { output: 'fused_output' },
        priorAnchors: { inputs: ['input_a', 'input_b'] }
      }],
      workspaceForest: [after]
    }
  ];
  assert.deepEqual(validateLabRelations(stagesWithTransition, before).issues, []);

  const unresolved = structuredClone(stagesWithTransition);
  unresolved[1].relations[0].priorAnchors.inputs = ['fused_output'];
  const result = validateLabRelations(unresolved, before);
  assert.equal(result.issues[0].kind, 'prior_anchor_unresolved');

  const atStageZero = [structuredClone(stagesWithTransition[1])];
  const zeroResult = validateLabRelations(atStageZero, after);
  assert.ok(zeroResult.issues.some((issue) => issue.kind === 'prior_anchor_without_prior_stage'));
});

test('relation dispatch matches exact names and never by substring', () => {
  const stagesWithLookalike = valuesStage([
    { relation: 'BoundingNodeEscape', anchors: { domain: 't_probe' } },
    { relation: '  boundingnodecrossing ', anchors: { domain: 'dp_goal' } }
  ]);
  const matched = matchRelations(stagesWithLookalike, ['BoundingNodeCrossing']);
  assert.equal(matched.length, 1, 'BoundingNodeEscape must not match BoundingNodeCrossing');
  assert.equal(matched[0].anchors.domain, 'dp_goal', 'case and whitespace folding is permitted');

  const lens = hydrateLabLensFromCurrentContract(stagesWithLookalike, valuesTree, { label: 'x', nodes: [] });
  assert.equal(lens.boundingNodeCrossing.domain, 'dp_goal');
  assert.deepEqual(unregisteredRelationNames(stagesWithLookalike), ['BoundingNodeEscape']);
});

test('Lab registration warnings use the production exact-name registry', () => {
  const stages = valuesStage([
    {
      relation: 'GappingAlignment',
      anchors: {
        antecedent: 't_probe',
        gap: 'dp_goal',
        correlates: ['t_probe'],
        remnants: ['dp_goal']
      }
    },
    { relation: 'UnregisteredResearchRelation', anchors: { witness: 't_probe' } }
  ]);

  assert.deepEqual(unregisteredRelationNames(stages), ['UnregisteredResearchRelation']);
});

test('a second instance of a singular relation is reported, not silently dropped', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'Binding', anchors: { binder: 't_probe', bound: 'dp_goal', domain: 'tp' } },
    { relation: 'Binding', anchors: { binder: 'dp_goal', bound: 't_probe', domain: 'tp' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.ok(lens.diagnostics.some((note) => /Binding: 2 instances/.test(note)));
});

test('the renderer bridge carries complete relations entries', () => {
  const [bridged] = toRendererStages(valuesStage([{
    relation: 'FeatureBundle',
    anchors: { probe: 't_probe' },
    priorAnchors: { was: 't_probe' },
    values: { 'uφ': '3PL' }
  }]));
  assert.deepEqual(bridged.relations, [{
    relation: 'FeatureBundle',
    anchors: { probe: 't_probe' },
    priorAnchors: { was: 't_probe' },
    values: { 'uφ': '3PL' }
  }]);
});

test('feature plaque rows come from authored values and the title from the anchor role', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'FeatureBundle',
    anchors: { goal: 'dp_goal' },
    values: { 'φ': '3PL', Case: 'NOM' }
  }]), valuesTree, { label: 'x', nodes: [], featurePlacement: { dp_goal: 'below-anchor' } });
  const [annotation] = lens.featureValuation.annotations;
  assert.equal(annotation.title, 'DP goal');
  assert.equal(annotation.placement, 'below-anchor');
  assert.deepEqual(annotation.rows, [
    { label: 'φ', value: '3PL' },
    { label: 'Case', value: 'NOM' }
  ]);
});

test('Multiple Agree expands one authored goal array into a directed fan-out', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'MultipleAgree',
    anchors: { probe: 't_probe', goals: ['dp_goal', 'tp'] },
    values: { outcome: 'successful' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.agreementPaths, {
    mode: 'multiple',
    paths: [
      { from: 't_probe', to: 'dp_goal', stage: 0, relationIndex: 0, outcome: 'successful' },
      { from: 't_probe', to: 'tp', stage: 0, relationIndex: 0, outcome: 'successful' }
    ]
  });
});

test('Cyclic Agree preserves authored cycle order and stage boundaries', () => {
  const cyclicStages = [
    {
      statement: 'Search the complement.',
      stageRecord: 'Cycle 1.',
      relations: [{
        relation: 'CyclicAgree',
        anchors: { probe: 't_probe', searchDomain: 'dp_goal' },
        values: { cycle: '1', outcome: 'no accessible goal' }
      }],
      workspaceForest: [valuesTree]
    },
    {
      statement: 'Search the expanded domain.',
      stageRecord: 'Cycle 2.',
      relations: [{
        relation: 'CyclicAgree',
        anchors: { probe: 't_probe', goal: 'tp' },
        values: { cycle: '2', outcome: 'valued' }
      }],
      workspaceForest: [valuesTree]
    }
  ];
  const lens = hydrateLabLensFromCurrentContract(cyclicStages, valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.agreementPaths, {
    mode: 'cyclic',
    paths: [
      {
        from: 't_probe',
        to: 'dp_goal',
        stage: 0,
        relationIndex: 0,
        cycle: '1',
        outcome: 'no accessible goal'
      },
      {
        from: 't_probe',
        to: 'tp',
        stage: 1,
        relationIndex: 0,
        cycle: '2',
        outcome: 'valued'
      }
    ]
  });
});

test('Feature Sharing keeps one shared feature token for every bearer', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'FeatureSharing',
    anchors: { bearers: ['t_probe', 'dp_goal', 'tp'] },
    values: { feature: 'Case', value: '□' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.featureSharing, {
    bearers: ['t_probe', 'dp_goal', 'tp'],
    feature: 'Case',
    value: '□',
    stage: 0,
    relationIndex: 0
  });
});

test('Case Assignment keeps its solid dependency separate from dotted Agree collection', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    {
      relation: 'CaseAssignment',
      anchors: { assigner: 't_probe', bearer: 'dp_goal' },
      values: { feature: 'Case', value: 'DAT' }
    },
    {
      relation: 'Agree',
      anchors: { probe: 'dp_goal', goal: 'tp' },
      values: { feature: 'Number', value: 'PL' }
    }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.caseAssignment, {
    assigner: 't_probe',
    bearer: 'dp_goal',
    feature: 'Case',
    value: 'DAT',
    stage: 0,
    relationIndex: 0,
    agreePaths: [{
      source: 'tp',
      feature: 'Number',
      value: 'PL',
      stage: 0,
      relationIndex: 1
    }]
  });
});

test('Dependent Case retains the two ordered elbow relations', () => {
  const dependentStages = [
    {
      statement: 'Unlock.',
      stageRecord: 'Step 1.',
      relations: [{
        relation: 'DependentCase',
        anchors: { probe: 't_probe', goal: 'dp_goal' },
        values: {
          step: '1 · unlock',
          Case: 'UNM',
          probeLabel: '[*φ*] UNM',
          goalLabel: '[CASE: □]'
        }
      }],
      workspaceForest: [valuesTree]
    },
    {
      statement: 'Assign.',
      stageRecord: 'Step 2.',
      relations: [{
        relation: 'DependentCase',
        anchors: { probe: 't_probe', goal: 'tp' },
        values: {
          step: '2 · assign',
          Case: 'DEP',
          probeLabel: '[*φ*] UNM/DEP',
          goalLabel: '[CASE: DEP]'
        }
      }],
      workspaceForest: [valuesTree]
    }
  ];
  const lens = hydrateLabLensFromCurrentContract(dependentStages, valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.dependentCase.paths, [
    {
      probe: 't_probe',
      goal: 'dp_goal',
      stage: 0,
      relationIndex: 0,
      step: '1 · unlock',
      value: 'UNM',
      probeLabel: '[*φ*] UNM',
      goalLabel: '[CASE: □]'
    },
    {
      probe: 't_probe',
      goal: 'tp',
      stage: 1,
      relationIndex: 0,
      step: '2 · assign',
      value: 'DEP',
      probeLabel: '[*φ*] UNM/DEP',
      goalLabel: '[CASE: DEP]'
    }
  ]);
});

test('PF plate rows are one per authored insertion with the last as the surface result', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'PFRealization', anchors: { root: 't_probe', exponent: 'dp_goal' } },
    { relation: 'VocabularyInsertion', anchors: { terminal: 't_probe' }, values: { input: 'A', output: 'a' } },
    { relation: 'VocabularyInsertion', anchors: { terminal: 't_probe' }, values: { input: 'a + b', output: 'ab' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.pfRealization.targetNodes, ['t_probe', 'dp_goal']);
  assert.equal(lens.pfRealization.stage, 0);
  assert.equal(lens.pfRealization.relationIndex, 0);
  assert.deepEqual(lens.pfRealization.rows, [
    { input: 'A', output: 'a', stage: 0, relationIndex: 1 },
    { input: 'a + b', output: 'ab', stage: 0, relationIndex: 2, final: true }
  ]);
});

test('phrasal spell-out targets one complete phrase shell and preserves its exponent literal', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    {
      relation: 'PhrasalSpellOut',
      anchors: { phrase: 'tp' },
      values: { exponent: '-nak' }
    }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.phrasalSpellOut, {
    phrase: 'tp',
    exponent: '-nak',
    stage: 0,
    relationIndex: 0
  });
});

test('many-to-many PF correspondence compiles only explicitly authored pairs', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    {
      relation: 'ManyToManyCorrespondence',
      anchors: { word: 'tp' },
      values: {
        sources: ['ROOT', '3', 'SG'],
        exponents: ['/stem/', '/-s/'],
        correspondence: ['ROOT=>/stem/', '3=>/-s/', 'SG=>/-s/']
      }
    }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.pfCorrespondence, {
    anchor: 'tp',
    sources: ['ROOT', '3', 'SG'],
    exponents: ['/stem/', '/-s/'],
    correspondence: [
      { source: 'ROOT', exponent: '/stem/' },
      { source: '3', exponent: '/-s/' },
      { source: 'SG', exponent: '/-s/' }
    ],
    stage: 0,
    relationIndex: 0
  });
});

test('PF morphology relations hydrate only their authored source geometry', () => {
  const stages = [
    {
      statement: 'Prior state.',
      stageRecord: 'The prior anchors exist in the previous workspace.',
      relations: [],
      workspaceForest: [valuesTree]
    },
    {
      statement: 'PF morphology.',
      stageRecord: 'Each relation carries the values needed by its source-backed overlay.',
      relations: [
        {
          relation: 'Fission',
          anchors: { outputs: ['dp_goal', 'tp'] },
          priorAnchors: { input: 't_probe' },
          values: {
            inputFeatures: ['2', 'pl'],
            outputOneFeatures: ['2'],
            outputTwoFeatures: ['pl']
          }
        },
        {
          relation: 'Impoverishment',
          anchors: { terminal: 'dp_goal' },
          values: { featureHierarchy: ['2', 'pl', 'f'], delinkAfter: '2' }
        },
        {
          relation: 'LocalDislocation',
          anchors: { sequence: ['t_probe', 'dp_goal'] },
          values: { beforeGroupSizes: ['1', '1'], afterGroupSizes: ['2'] }
        },
        {
          relation: 'CyclicLinearization',
          anchors: { order: ['dp_goal', 't_probe'] },
          priorAnchors: { order: ['t_probe', 'dp_goal'] },
          values: { outcome: 'conflict' }
        }
      ],
      workspaceForest: [valuesTree]
    }
  ];

  const lens = hydrateLabLensFromCurrentContract(stages, valuesTree, { label: 'x', nodes: [] });

  assert.deepEqual(lens.fission, {
    inputAnchor: 't_probe',
    outputAnchors: ['dp_goal', 'tp'],
    inputFeatures: ['2', 'pl'],
    outputFeatures: [['2'], ['pl']],
    stage: 1,
    relationIndex: 0
  });
  assert.deepEqual(lens.impoverishment, {
    anchor: 'dp_goal',
    features: ['2', 'pl', 'f'],
    delinkAfter: '2',
    stage: 1,
    relationIndex: 1
  });
  assert.deepEqual(lens.localDislocation, {
    sequence: ['t_probe', 'dp_goal'],
    beforeGroupSizes: [1, 1],
    afterGroupSizes: [2],
    stage: 1,
    relationIndex: 2
  });
  assert.deepEqual(lens.cyclicLinearization, {
    priorOrder: ['t_probe', 'dp_goal'],
    currentOrder: ['dp_goal', 't_probe'],
    outcome: 'conflict',
    stage: 1,
    relationIndex: 3
  });
});

test('polarity marks come from declared notation and a derived index, not authored values', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'NegativePolarityAnswer',
    anchors: { polarityHead: 't_probe', proposition: 'tp', propositionPredicate: 'dp_goal' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.lf.operatorMarks.map((mark) => mark.label), ['Σᵢ−', 'Σᵢ−']);
  assert.equal(lens.lf.paths[0].kind, 'polarity');
  assert.deepEqual(
    { stage: lens.lf.stage, relationIndex: lens.lf.relationIndex },
    { stage: 0, relationIndex: 0 }
  );
});

test('an authored lf lens survives QR and reconstruction hydration', () => {
  const authored = { label: 'x', nodes: [], lf: { strikeNodes: ['keep_me'] } };
  const qrLens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'QuantifierRaising',
    anchors: { pronouncedQP: 'dp_goal', lfQP: 't_probe', scopeDomain: 'tp' }
  }]), valuesTree, structuredClone(authored));
  assert.deepEqual(qrLens.lf.strikeNodes, ['keep_me']);
  assert.deepEqual(
    { stage: qrLens.lf.stage, relationIndex: qrLens.lf.relationIndex },
    { stage: 0, relationIndex: 0 }
  );
  assert.deepEqual(
    qrLens.coindex.map(({ stage, relationIndex }) => ({ stage, relationIndex })),
    [{ stage: 0, relationIndex: 0 }]
  );

  const reconstructionLens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'LFReconstruction',
    anchors: { interpretedCopy: 't_probe', neglectedCopy: 'dp_goal' }
  }]), valuesTree, { label: 'x', nodes: [], lf: { operatorMarks: [{ id: 'keep', anchor: 'tp', label: 'L', placement: 'below-anchor' }] } });
  assert.equal(reconstructionLens.lf.operatorMarks[0].id, 'keep');
  assert.deepEqual(
    { stage: reconstructionLens.lf.stage, relationIndex: reconstructionLens.lf.relationIndex },
    { stage: 0, relationIndex: 0 }
  );
});

test('the migrated lab cards derive the same drawings from authored values', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('visual-relations-current-lab.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fixtures = new Map();

  const build = (expression) => {
    if (!expression) return undefined;
    if (ts.isStringLiteralLike(expression)) return expression.text;
    if (ts.isNumericLiteral(expression)) return Number(expression.text);
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(expression)) return fixtures.get(expression.text);
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.map(build);
    if (ts.isObjectLiteralExpression(expression)) {
      return Object.fromEntries(expression.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : property.name.getText(file);
        return [[name, build(property.initializer)]];
      }));
    }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
      const name = expression.expression.text;
      const args = expression.arguments.map(build);
      if (name === 'leaf') {
        const [id, label, word, extra = {}] = args;
        return { id, label, ...(word ? { word } : {}), ...extra };
      }
      if (name === 'node') {
        const [id, label, children, extra = {}] = args;
        return { id, label, children, ...extra };
      }
      if (name === 'silentLexicalNode') {
        const [id, label, surface, extra = {}] = args;
        return {
          id,
          label,
          children: [{ id: `${id}__silent`, label: surface, silent: true, ...extra }],
          silent: true,
          ...extra
        };
      }
      if (name === 'nullHead') {
        const [id, label] = args;
        return { id, label, children: [{ id: `${id}__null`, label: '∅', silent: true }] };
      }
      if (name === 'offsetTokenIndices') {
        const [tree, offset] = args;
        return offsetFixtureTokenIndices(tree, offset);
      }
      if (name === 'stage') {
        const [, statement, stageRecord, relations, tree] = args;
        return { statement, stageRecord, relations, workspaceForest: [tree] };
      }
    }
    return undefined;
  };

  file.statements.forEach((statement) => {
    if (!ts.isVariableStatement(statement)) return;
    statement.declarationList.declarations.forEach((declaration) => {
      if (!ts.isIdentifier(declaration.name)) return;
      const value = build(declaration.initializer);
      if (value && typeof value === 'object' && 'id' in value) fixtures.set(declaration.name.text, value);
    });
  });

  const stages = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'stage'
    ) {
      const built = build(node);
      if (built?.relations) stages.push(built);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  const stagesNaming = (relationName) =>
    stages.filter((stage) => stage.relations.some((relation) => relation.relation === relationName));

  const agreeStages = stagesNaming('Agree')
    .filter((stage) => JSON.stringify(stage.relations).includes('t_phi_probe'));
  assert.equal(agreeStages.length, 1, 'exactly one card carries the T-probe feature bundles');
  const agreeLens = hydrateLabLensFromCurrentContract(agreeStages, agreeStages[0].workspaceForest[0], {
    label: 'Agree lens',
    nodes: [],
    featurePlacement: { t_phi_probe: 'left-of-anchor', girls_goal: 'below-anchor' }
  });
  // The Lab lens reports the currently active authored relation. Production
  // persistence retains the earlier probe plaque while this later goal bundle
  // is active; the lens must not merge two relation moments into one payload.
  assert.deepEqual(agreeLens.featureValuation.annotations.map((annotation) => ({
    anchor: annotation.anchor,
    title: annotation.title,
    placement: annotation.placement,
    rows: annotation.rows
  })), [
    {
      anchor: 'girls_goal',
      title: 'DP goal',
      placement: 'below-anchor',
      rows: [{ label: 'φ', value: '3PL' }, { label: 'Case', value: 'NOM' }]
    }
  ]);
  assert.deepEqual(agreeLens.featureValuation.annotations[0].anchorNodes, ['d_girls', 'n_girls']);

  const pfStages = stagesNaming('PFRealization')
    .filter((stage) => JSON.stringify(stage.relations).includes('root_laugh'));
  assert.equal(pfStages.length, 1, 'exactly one card carries the regular affixation steps');
  const pfLens = hydrateLabLensFromCurrentContract(pfStages, pfStages[0].workspaceForest[0], {
    label: 'PF lens',
    nodes: []
  });
  assert.deepEqual(pfLens.pfRealization.targetNodes, ['root_laugh', 'v_pf', 't_past', 'past_pf']);
  assert.deepEqual(pfLens.pfRealization.rows, [
    { input: '√LAUGH', output: 'laugh', stage: 0, relationIndex: 0 },
    { input: 'T[past]', output: '-ed', stage: 0, relationIndex: 1 },
    { input: 'laugh + -ed', output: 'laughed', stage: 0, relationIndex: 2, final: true }
  ]);

  assert.equal(
    stagesNaming('NegativePolarityAnswer').length,
    0,
    'the retired Sigma study does not appear in the public relation archive'
  );

  assert.deepEqual(unregisteredRelationNames(stages), []);
});

test('trajectory paths derive endpoints from authored roles, not position', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'AbarMove', anchors: { lowerCopy: 'dp_goal', traceWitness: 'd_goal', pronouncedCopy: 't_probe' } },
    { relation: 'HeadMove', anchors: { source: 't_probe', target: 'dp_goal' } },
    { relation: 'Lowering', anchors: { source: 't_probe', target: 'dp_goal' } }
  ]), valuesTree, { label: 'x', nodes: [] });

  assert.deepEqual(lens.trajectory, [
    { from: 'dp_goal', to: 't_probe', kind: 'phrasal', relation: 'AbarMove', index: '1', fromWitness: 'd_goal' },
    { from: 't_probe', to: 'dp_goal', kind: 'head', relation: 'HeadMove', index: '2' },
    // Lowering leaves no trace, so it carries no index at all.
    { from: 't_probe', to: 'dp_goal', kind: 'lowering', relation: 'Lowering', index: '' }
  ]);
});

test('an intermediate chain link uses higherCopy as its landing endpoint', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'AbarMove', anchors: { lowerCopy: 'dp_goal', traceWitness: 'd_goal', higherCopy: 't_probe' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.trajectory, [
    { from: 'dp_goal', to: 't_probe', kind: 'phrasal', relation: 'AbarMove', index: '1', fromWitness: 'd_goal' }
  ]);
});

test('a trajectory missing one endpoint draws nothing rather than guessing', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'AbarMove', anchors: { lowerCopy: 'dp_goal', traceWitness: 'd_goal' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.equal(lens.trajectory, undefined);
});

const copyTree = {
  id: 'cp',
  label: 'CP',
  children: [
    {
      id: 'high',
      label: 'DP',
      children: [
        { id: 'high_d', label: 'D', word: 'Which' },
        { id: 'high_n', label: 'N', word: 'picture' }
      ]
    },
    {
      id: 'low',
      label: 'DP',
      silent: true,
      children: [
        { id: 'low_d', label: 'D', silent: true },
        // Authored as pronounced inside an otherwise silent copy: the selective case.
        { id: 'low_n', label: 'N', word: 'picture' }
      ]
    }
  ]
};

const copyStage = (anchors) => [{
  statement: 'Reconstruction.',
  stageRecord: 'One copy is interpreted and the other neglected at LF.',
  relations: [{ relation: 'LFReconstruction', anchors }],
  workspaceForest: [copyTree]
}];


test('the Sigma polarity relation is retained only as internal historical provenance', async () => {
  const activeNames = Object.values(RECOGNIZED_RELATIONS).flat();
  assert.equal(activeNames.includes('NegativePolarityAnswer'), false);
  assert.deepEqual(HISTORICAL_RELATIONS.negativePolarity, ['NegativePolarityAnswer']);

  const labSource = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(labSource, /NegativePolarityAnswer|Sigma-to-Pol|negativePolarityTree/);

  // The adapter can still reconstruct the retired source convention for provenance.
  const stages = valuesStage([{
    relation: 'NegativePolarityAnswer',
    anchors: { polarityHead: 't_probe', proposition: 'tp', propositionPredicate: 'dp_goal' }
  }]);
  assert.deepEqual(unregisteredRelationNames(stages), []);
  const lens = hydrateLabLensFromCurrentContract(stages, valuesTree, { label: 'x', nodes: [] });
  assert.equal(lens.lf.operatorMarks.length, 2);
});

test('bounding-node crossings keep every authored boundary and assume no category', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'BoundingNodeCrossing',
    anchors: { domain: 'tp', boundary: ['dp_goal', 't_probe'] }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.boundingNodeCrossing.boundaryNodes, ['dp_goal', 't_probe']);
  assert.equal(lens.boundingNodeCrossing.domain, 'tp');
});

test('focus marking needs no operator anchor and follows the authored focus', () => {
  const subject = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'FocusMarking',
    anchors: { focus: 't_probe', background: 'dp_goal', domain: 'tp' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(subject.focus, {
    strongEdges: [{ from: 'tp', to: 't_probe' }],
    weakEdges: [{ from: 'tp', to: 'dp_goal' }],
    stage: 0,
    relationIndex: 0
  });

  const object = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'FocusMarking',
    anchors: { focus: 'dp_goal', background: 't_probe', domain: 'tp' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(object.focus.strongEdges, [{ from: 'tp', to: 'dp_goal' }]);
});

test('theta-grid marks retain their exact authored relation moment', () => {
  const stages = valuesStage([{
    relation: 'ThetaAssignment',
    anchors: { predicate: 't_probe', theme: 'dp_goal' }
  }]);
  const lens = hydrateLabLensFromCurrentContract(stages, valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(
    { stage: lens.theta.stage, relationIndex: lens.theta.relationIndex },
    { stage: 0, relationIndex: 0 }
  );

});

test('intervention diagnostics retain their own authored relation moment', () => {
  const stages = valuesStage([
    { relation: 'AbarMove', anchors: { lowerCopy: 't_probe', pronouncedCopy: 'dp_goal' } },
    { relation: 'Intervention', anchors: { landing: 'tp', intervener: 't_probe', target: 'dp_goal' } }
  ]);
  const lens = hydrateLabLensFromCurrentContract(stages, valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(
    { stage: lens.intervention.stage, relationIndex: lens.intervention.relationIndex },
    { stage: 0, relationIndex: 1 }
  );

});

test('a bounding-node crossing fails closed without one unambiguous dependency path', () => {
  // Exactly one rendered path: the cuts have something to interrupt.
  assert.equal(bindCrossingDependencyPath(1), 'bound');

  // No path: drawing boundary-only cuts would restate the rejected
  // non-crossing design, so nothing is drawn.
  assert.equal(bindCrossingDependencyPath(0), 'no-dependency');

  // Several paths: binding the boundaries to one of them would invent a claim
  // the relation never authored. Left undecided, so nothing is drawn.
  assert.equal(bindCrossingDependencyPath(2), 'ambiguous');
  assert.equal(bindCrossingDependencyPath(5), 'ambiguous');
});

/**
 * Structural contract: authored trees are binary. A non-tree claim such as
 * multidominance is expressed by a relation overlay over a binary forest, never
 * by giving a node three or more children.
 */
const parseLabFixtures = (source) => {
  const file = ts.createSourceFile('lab.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fixtures = new Map();
  const build = (expr) => {
    if (!expr) return undefined;
    if (ts.isStringLiteralLike(expr)) return expr.text;
    if (ts.isNumericLiteral(expr)) return Number(expr.text);
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(expr)) return fixtures.get(expr.text);
    if (ts.isArrayLiteralExpression(expr)) return expr.elements.map(build);
    if (ts.isObjectLiteralExpression(expr)) {
      return Object.fromEntries(expr.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : property.name.getText(file);
        return [[name, build(property.initializer)]];
      }));
    }
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
      const name = expr.expression.text;
      const args = expr.arguments.map(build);
      if (name === 'leaf') {
        const [id, label, word, extra = {}] = args;
        return { id, label, ...(word ? { word } : {}), ...extra };
      }
      if (name === 'node') {
        const [id, label, children, extra = {}] = args;
        return { id, label, children, ...extra };
      }
      if (name === 'silentLexicalNode') {
        const [id, label, surface, extra = {}] = args;
        return {
          id,
          label,
          children: [{ id: `${id}__silent`, label: surface, silent: true, ...extra }],
          silent: true,
          ...extra
        };
      }
      if (name === 'nullHead') {
        const [id, label] = args;
        return { id, label, children: [{ id: `${id}__null`, label: '∅', silent: true }] };
      }
      if (name === 'offsetTokenIndices') {
        const [tree, offset] = args;
        return offsetFixtureTokenIndices(tree, offset);
      }
    }
    return undefined;
  };

  file.statements.forEach((statement) => {
    if (!ts.isVariableStatement(statement)) return;
    statement.declarationList.declarations.forEach((declaration) => {
      if (!ts.isIdentifier(declaration.name)) return;
      const value = build(declaration.initializer);
      if (value && typeof value === 'object' && 'id' in value) fixtures.set(declaration.name.text, value);
    });
  });
  return fixtures;
};

test('every authored lab fixture is structurally binary', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  assert.ok(fixtures.size > 30, `expected the fixture set to parse, got ${fixtures.size}`);

  const violations = [];
  fixtures.forEach((root, fixtureName) => {
    const walk = (current) => {
      const children = current.children || [];
      if (children.length > 2) {
        violations.push(`${fixtureName}:${current.id} (${current.label}) has ${children.length} children`);
      }
      children.forEach(walk);
    };
    walk(root);
  });
  assert.deepEqual(violations, []);
});

test('every authored lab fixture node carries an id and a label', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const incomplete = [];
  fixtures.forEach((root, fixtureName) => {
    const walk = (current) => {
      if (!current.id || !String(current.id).trim()) incomplete.push(`${fixtureName}: node without id`);
      if (!current.label || !String(current.label).trim()) incomplete.push(`${fixtureName}:${current.id} has no label`);
      (current.children || []).forEach(walk);
    };
    walk(root);
  });
  assert.deepEqual(incomplete, []);
});

test('every authored verbal projection belongs to a shell with an authored verbal head', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const headless = [];
  fixtures.forEach((root, fixtureName) => {
    const containsVerbalHead = (current) => (
      current.label === 'V'
      || current.label === 'v'
      || (current.children || []).some(containsVerbalHead)
    );
    const walk = (current, parent = null) => {
      const parentSuppliesHead = (
        (current.label === "V'" && parent?.label === 'VP' && (parent.children || []).some((child) => child.label === 'V'))
        || (current.label === "v'" && parent?.label === 'vP' && (parent.children || []).some((child) => child.label === 'v'))
      );
      if (
        ['VP', "V'", 'vP', "v'"].includes(current.label)
        && !containsVerbalHead(current)
        && !parentSuppliesHead
      ) {
        headless.push(`${fixtureName}:${current.id} (${current.label})`);
      }
      (current.children || []).forEach((child) => walk(child, current));
    };
    walk(root);
  });
  assert.deepEqual(headless, []);
});

test('sideward movement ends as one externally merged tree and retains both movement endpoints', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const final = fixtures.get('sidewardFinalTree');
  assert.ok(final, 'the sideward derivation has no final tree');
  assert.equal(final.id, 'coordp_sideward_sw');
  assert.deepEqual(final.children.map((child) => child.id), ['tp_primary_sw', 'coordbar_sideward_sw']);

  const find = (root, id) => root.id === id
    ? root
    : (root.children || []).reduce((found, child) => found || find(child, id), null);
  const landing = find(final, 'dp_tamer_landing_sw');
  const sourceCopy = find(final, 'dp_tamer_source_sw');
  assert.ok(landing, 'the pronounced sideward landing is missing from the final tree');
  assert.ok(sourceCopy, 'the silent sideward source is missing from the final tree');
  assert.equal(landing.silent, undefined);
  assert.equal(sourceCopy.silent, true);

  const pronounced = [];
  const walk = (current) => {
    if (!(current.children || []).length && current.word && current.silent !== true) {
      pronounced.push(current.word);
    }
    (current.children || []).forEach(walk);
  };
  walk(final);
  assert.deepEqual(
    pronounced,
    ['Hinter', 'jedem', 'Löwen', 'steht', 'eine', 'Dompteuse', 'und', 'krault', 'ihm', 'den', 'Rücken']
  );

  const card = source.slice(
    source.indexOf("archetype: 'M3. Multi-workspace / sideward'"),
    source.indexOf("archetype: 'M3B. Multi-workspace / sideward'")
  );
  assert.match(card, /workspaceForest: \[sidewardPrimaryBaseTree, sidewardAdditionalBaseTree\]/);
  assert.match(card, /workspaceForest: \[sidewardPrimaryTree, sidewardAdditionalTree\]/);
  assert.match(card, /workspaceForest: \[sidewardFinalTree\]/);
  assert.equal((card.match(/relation: 'SidewardMovement'/g) || []).length, 1);
});

test('the sideward parasitic-gap derivation retains sideward and ordinary wh paths in one final tree', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const final = fixtures.get('sidewardPgFinalTree');
  assert.ok(final, 'the second sideward derivation has no final tree');
  assert.equal(final.id, 'cp_final_swpg');

  const find = (root, id) => root.id === id
    ? root
    : (root.children || []).reduce((found, child) => found || find(child, id), null);
  assert.equal(find(final, 'dp_paper_adj_swpg')?.silent, true);
  assert.equal(find(final, 'dp_paper_matrix_swpg')?.silent, true);
  assert.equal(find(final, 'dp_paper_high_swpg')?.silent, undefined);

  const start = source.indexOf("archetype: 'M3B. Multi-workspace / sideward'");
  const card = source.slice(start, source.indexOf("archetype: 'N1. Merge / Pair Merge'", start));
  assert.equal((card.match(/relation: 'SidewardMovement'/g) || []).length, 1);
  assert.equal((card.match(/relation: 'AbarMove'/g) || []).length, 1);
  assert.match(card, /workspaceForest: \[sidewardPgMatrixBaseTree, sidewardPgAdjunctBaseTree\]/);
  assert.match(card, /workspaceForest: \[sidewardPgMatrixMovedTree, sidewardPgAdjunctMovedTree\]/);
  assert.match(card, /workspaceForest: \[sidewardPgFinalTree\]/);
});

test('multi-stage trajectory cards rely on production Replay persistence, not Lab flags', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const titles = [
    'Identity / Copy Chain (four occurrences)',
    'Remnant Movement',
    'Roll-up Movement',
    'Smuggling',
    'Sideward Movement',
    'Sideward Movement (parasitic-gap derivation)'
  ];
  titles.forEach((title) => {
    const start = source.indexOf(`title: '${title}'`);
    assert.notEqual(start, -1, `${title} is missing`);
    const nextCard = source.indexOf('\n  {', start + 1);
    const card = source.slice(start, nextCard === -1 ? source.length : nextCard);
    assert.doesNotMatch(card, /accumulatedTrajectories|stageScopedTrajectories/);
  });
});

test('the four-occurrence chain has four complete positions and three ordered links', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const finalTree = fixtures.get('fourOccurrenceIdentityTree');
  assert.ok(finalTree, 'four-occurrence final tree is missing');

  const find = (root, id) => {
    if (!root) return undefined;
    if (root.id === id) return root;
    for (const child of root.children || []) {
      const match = find(child, id);
      if (match) return match;
    }
    return undefined;
  };
  const leaves = (root) => {
    if (!root?.children?.length) return [root];
    return root.children.flatMap(leaves);
  };

  const occurrenceIds = [
    'dp_chain4_high',
    'dp_chain4_edge_mid',
    'dp_chain4_edge_low',
    'dp_chain4_base'
  ];
  const occurrences = occurrenceIds.map((id) => find(finalTree, id));
  assert.ok(occurrences.every(Boolean), 'one of the four DP occurrences is missing');
  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.lineageId),
    Array(4).fill('chain4-book')
  );

  const pronounced = leaves(occurrences[0]);
  assert.deepEqual(pronounced.map((leaf) => leaf.word), ['Which', 'book']);
  assert.ok(pronounced.every((leaf) => leaf.silent !== true));

  occurrences.slice(1).forEach((occurrence) => {
    const traceLeaves = leaves(occurrence);
    assert.equal(traceLeaves.length, 2, `${occurrence.id} does not retain both moved terminals`);
    assert.deepEqual(traceLeaves.map((leaf) => leaf.label), ['D', 'N']);
    assert.deepEqual(traceLeaves.map((leaf) => leaf.word), ['t_1', 't_1']);
    assert.ok(traceLeaves.every((leaf) => leaf.silent === true));
  });

  const start = source.indexOf("title: 'Identity / Copy Chain (four occurrences)'");
  const nextCard = source.indexOf('\n  {', start + 1);
  const card = source.slice(start, nextCard);
  assert.equal((card.match(/relation: 'AbarMove'/g) || []).length, 3);
  assert.equal((card.match(/relation: 'Identity'/g) || []).length, 1);
  assert.equal((card.match(/\bstage\(/g) || []).length, 6);
  assert.doesNotMatch(card, /accumulatedTrajectories|stageScopedTrajectories/);
});

test('phrasal movement without an authored trace witness draws nothing', () => {
  assert.equal(trajectoryRequiresWitness('phrasal'), true);
  assert.equal(trajectoryRequiresWitness('head'), false);
  assert.equal(trajectoryRequiresWitness('lowering'), false);

  const withoutWitness = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'AbarMove', anchors: { lowerCopy: 'dp_goal', pronouncedCopy: 't_probe' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.equal(withoutWitness.trajectory, undefined, 'witness-free phrasal movement is refused');

  const withWitness = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'AbarMove', anchors: { lowerCopy: 'dp_goal', traceWitness: 'd_goal', pronouncedCopy: 't_probe' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.equal(withWitness.trajectory.length, 1);
  assert.equal(withWitness.trajectory[0].fromWitness, 'd_goal');
});

test('head movement and head-sized lowering keep witness-free head endpoints', () => {
  const lens = hydrateLabLensFromCurrentContract(valuesStage([
    { relation: 'HeadMove', anchors: { source: 't_probe', target: 'dp_goal' } },
    { relation: 'Lowering', anchors: { source: 't_probe', target: 'dp_goal' } }
  ]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(lens.trajectory.map((path) => path.kind), ['head', 'lowering']);
  lens.trajectory.forEach((path) => assert.equal(path.fromWitness, undefined));
});

test('phrase lowering takes phrasal endpoints and requires its authored trace witness', () => {
  const phraseLoweringTree = {
    id: 'xp_lowering_root',
    label: 'XP',
    children: [
      {
        id: 'dp_lowering_source',
        label: 'DP',
        silent: true,
        children: [{
          id: 'd_lowering_witness',
          label: 'D',
          silent: true,
          children: [{ id: 't_lowering_witness', label: 't', silent: true }]
        }]
      },
      {
        id: 'dp_lowering_target',
        label: 'DP',
        children: [{ id: 'd_lowering_target', label: 'D', word: 'them' }]
      }
    ]
  };
  const phraseLoweringStage = [{
    statement: 'The phrase lowers.',
    stageRecord: 'Lowering relates the higher phrase copy to its lower landing.',
    relations: [{
      relation: 'Lowering',
      anchors: {
        source: 'dp_lowering_source',
        traceWitness: 'd_lowering_witness',
        target: 'dp_lowering_target'
      }
    }],
    workspaceForest: [phraseLoweringTree]
  }];

  const lens = hydrateLabLensFromCurrentContract(
    phraseLoweringStage,
    phraseLoweringTree,
    { label: 'x', nodes: [] }
  );
  assert.deepEqual(lens.trajectory, [{
    from: 'dp_lowering_source',
    to: 'dp_lowering_target',
    kind: 'phrasal-lowering',
    relation: 'Lowering',
    index: '1',
    fromWitness: 'd_lowering_witness'
  }]);

  delete phraseLoweringStage[0].relations[0].anchors.traceWitness;
  const refused = hydrateLabLensFromCurrentContract(
    phraseLoweringStage,
    phraseLoweringTree,
    { label: 'x', nodes: [] }
  );
  assert.equal(refused.trajectory, undefined);
});

test('every authored phrasal relation moment in the live lab names its trace witness', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const relationBlocks = [...source.matchAll(/relation: '([^']+)',\s*\n?\s*anchors: \{[\s\S]{0,500}?\}/g)]
    .map((match) => ({ relation: match[1], block: match[0] }));
  const phrasalBlocks = relationBlocks.filter(({ block }) =>
    block.includes('lowerCopy')
    && /(?:pronouncedCopy|higherCopy|landing)/.test(block)
    && !(block.includes("relation: 'Identity'") && !block.includes('traceWitness'))
  );
  assert.ok(phrasalBlocks.length >= 20, `expected the phrasal relation moments to be found, got ${phrasalBlocks.length}`);
  const missing = phrasalBlocks.filter(({ block }) => !block.includes('traceWitness'));
  assert.deepEqual(missing, [], 'every phrasal movement moment must author a traceWitness');
});

const boxAround = (x, y, w, h) => ({ x, y, width: w, height: h });
// Starts inside the region and escapes upward and to the left, as a dependency
// leaving a constituent does.
const outwardPath = [
  { x: 50, y: 50 }, { x: 45, y: 20 }, { x: 20, y: -40 }, { x: -60, y: -260 }
];

test('a boundary crossing is the exact point where the path leaves the region', () => {
  const region = boxAround(0, 0, 100, 100);
  const exit = findBoundaryExit(outwardPath, region);
  assert.equal(exit.ok, true);
  // Exact edge intersection, not a sampled point: y is exactly the top edge.
  assert.equal(Math.round(exit.point.y), 0);
  assert.equal(exit.edge, 'top');
  assert.ok(exit.point.x > 0 && exit.point.x < 100);
});

test('a boundary that does not contain the origin is refused', () => {
  // Same height, unrelated position: the path never starts inside it.
  const elsewhere = boxAround(400, 0, 100, 100);
  const result = findBoundaryExit(outwardPath, elsewhere);
  assert.equal(result.ok, false);
  assert.match(result.reason, /origin is not inside/);
});

test('an outside-enter-exit path is refused, not treated as an escape', () => {
  const region = boxAround(0, 0, 100, 100);
  const enters = [
    { x: -50, y: 50 }, { x: 50, y: 50 }, { x: 150, y: 50 }
  ];
  const result = findBoundaryExit(enters, region);
  assert.equal(result.ok, false);
  assert.match(result.reason, /origin is not inside/);
});

test('a path that leaves and re-enters is refused', () => {
  const region = boxAround(0, 0, 100, 100);
  const wandering = [
    { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 50, y: 60 }, { x: 150, y: 60 }
  ];
  const result = findBoundaryExit(wandering, region);
  assert.equal(result.ok, false);
  assert.match(result.reason, /more than once|re-enters/);
});

test('a path that never leaves the region is refused', () => {
  const region = boxAround(-500, -500, 2000, 2000);
  const result = findBoundaryExit(outwardPath.slice(0, 2), region);
  assert.equal(result.ok, false);
  assert.match(result.reason, /never leaves/);
});

test('coincident crossings are refused rather than stacked', () => {
  // Two nested regions sharing the edge the path leaves by: one visible mark
  // would silently stand for two authored boundaries.
  const outer = boxAround(0, 0, 100, 100);
  const inner = boxAround(0, 0, 100, 100);
  const result = findBoundaryCrossings(outwardPath, [outer, inner]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /coincide/);
});

test('distinct nested boundaries give distinct ordered crossings', () => {
  const inner = boxAround(0, 0, 100, 100);
  const outer = boxAround(-400, -200, 800, 400);
  const result = findBoundaryCrossings(outwardPath, [inner, outer]);
  assert.equal(result.ok, true);
  assert.equal(result.crossings.length, 2);
  const gap = Math.hypot(
    result.crossings[0].point.x - result.crossings[1].point.x,
    result.crossings[0].point.y - result.crossings[1].point.y
  );
  assert.ok(gap >= MIN_CROSSING_SEPARATION, 'crossings are separable');
  assert.ok(result.crossings[0].segmentIndex <= result.crossings[1].segmentIndex, 'inner is left first');
});

/**
 * Coverage is measured per visual design and per meaningfully different render.
 *
 * A context signature records what the drawing actually had to cope with: which
 * anchor roles were authored, how many instances, the categories of the anchored
 * nodes, and their depths in the tree. Two cards that differ only in wording
 * produce the same signature and count once.
 */
const describeDesignContexts = (source) => {
  const fixtures = parseLabFixtures(source);
  const heads = [...source.matchAll(/archetype: '([^']+)',\s*\n\s*title: '([^']+)'/g)]
    .map((match) => ({ title: match[2], at: match.index }));

  const locate = (root, id) => {
    let hit = null;
    const walk = (node, depth) => {
      if (node.id === id) hit = { depth, label: node.label };
      (node.children || []).forEach((child) => walk(child, depth + 1));
    };
    walk(root, 0);
    return hit;
  };

  const contexts = new Map();
  heads.forEach((head, index) => {
    const body = source.slice(head.at, index + 1 < heads.length ? heads[index + 1].at : source.length);
    if (/\n\s*inactive: /.test(body)) return;
    const fixtureName = (body.match(/\n\s*data: (\w+),/) || [])[1];
    const tree = fixtureName ? fixtures.get(fixtureName) : undefined;

    Object.entries(ACTIVE_VISUAL_DESIGNS).forEach(([design, entry]) => {
      const instances = [...body.matchAll(/relation: '([A-Za-z]+)',\s*\n?\s*anchors: \{([\s\S]{0,600}?)\}/g)]
        .filter((match) => entry.relations.includes(match[1]));
      if (instances.length === 0) return;

      const roles = new Set();
      const categories = [];
      const depths = [];
      instances.forEach((match) => {
        [...match[2].matchAll(/(\w+):\s*(?:'([^']+)'|\[([^\]]*)\])/g)].forEach((anchor) => {
          roles.add(anchor[1]);
          const ids = anchor[2]
            ? [anchor[2]]
            : (anchor[3] || '').split(',').map((value) => value.trim().replace(/'/g, ''));
          ids.filter(Boolean).forEach((id) => {
            const found = tree ? locate(tree, id) : null;
            if (found) { categories.push(found.label); depths.push(found.depth); }
          });
        });
      });

      const signature = JSON.stringify({
        roles: [...roles].sort(),
        instances: instances.length,
        categories: [...categories].sort(),
        depths: [...depths].sort((a, b) => a - b)
      });
      if (!contexts.has(design)) contexts.set(design, new Map());
      if (!contexts.get(design).has(signature)) contexts.get(design).set(signature, head.title);
    });
  });
  return contexts;
};

test('every active visual design has two meaningfully different render contexts', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const contexts = describeDesignContexts(source);

  const missing = Object.keys(ACTIVE_VISUAL_DESIGNS).filter((design) => !contexts.has(design));
  assert.deepEqual(missing, [], 'every registered design must appear in the active lab');

  const thin = [...contexts.entries()]
    .filter(([, signatures]) => signatures.size < 2)
    .map(([design, signatures]) => `${design}: ${[...signatures.values()].join(', ') || 'none'}`);
  assert.deepEqual(thin, [], 'each design needs two contexts that differ in roles, instance count, or geometry');
});

test('LF reconstruction preserves the lower reflexive preterminal and is not frozen', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const tree = fixtures.get('lfReconstructionTree');

  const find = (root, id) => {
    if (!root) return undefined;
    if (root.id === id) return root;
    for (const child of root.children || []) {
      const match = find(child, id);
      if (match) return match;
    }
    return undefined;
  };

  const reflexive = find(tree, 'dp_himself_low_lf');
  assert.equal(reflexive?.label, 'DP');
  assert.equal(reflexive?.silent, true);
  assert.equal(reflexive?.children?.length, 1);
  assert.equal(reflexive.children[0].label, 'D');
  assert.equal(reflexive.children[0].silent, true);
  assert.equal(reflexive.children[0].children?.[0]?.label, 'himself');
  assert.equal(reflexive.children[0].children?.[0]?.silent, true);
  assert.equal('frozen' in ACTIVE_VISUAL_DESIGNS.lfInterpretation, false);

  const reconstructionContexts = describeDesignContexts(source).get('lfInterpretation');
  assert.equal(reconstructionContexts?.size, 2);
  assert.deepEqual(
    [...reconstructionContexts.values()].sort(),
    ['LF Reconstruction', 'LF Reconstruction (predicate AP)']
  );
});

test('no fixture uses a phrasal category as a terminal', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const PHRASAL = /^(DP|NP|VP|vP|PP|AP|AdvP|QP|CP|TP|IP|CoordP)$/;

  const shortcuts = [];
  fixtures.forEach((root, fixtureName) => {
    const walk = (node) => {
      const isTerminal = !node.children || node.children.length === 0;
      if (isTerminal && node.word && PHRASAL.test(String(node.label))) {
        shortcuts.push(`${fixtureName}:${node.id} (${node.label} as terminal for "${node.word}")`);
      }
      (node.children || []).forEach(walk);
    };
    walk(root);
  });
  assert.deepEqual(shortcuts, []);
});

test('every pronounced word still reaches the surface after expansion', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  // Expanding a category-as-terminal must not drop or duplicate surface material:
  // each fixture's pronounced tokens must still form a gap-free index sequence.
  fixtures.forEach((root, fixtureName) => {
    const tokens = [];
    const walk = (node) => {
      if (Number.isInteger(node.tokenIndex) && node.silent !== true && node.word) {
        tokens.push(node.tokenIndex);
      }
      (node.children || []).forEach(walk);
    };
    walk(root);
    if (tokens.length === 0) return;
    const sorted = [...tokens].sort((a, b) => a - b);
    assert.deepEqual(sorted, [...new Set(sorted)], `${fixtureName} has a duplicated token index`);
    sorted.forEach((value, index) => {
      assert.equal(value, index, `${fixtureName} token indices must be gap-free`);
    });
  });
});

test('boundary crossings depend on reading the path outward from the origin', () => {
  const region = { x: 0, y: 0, width: 100, height: 100 };
  // Runs from inside the region outward through the top edge.
  const outward = [{ x: 50, y: 50 }, { x: 50, y: 20 }, { x: 50, y: -40 }];
  const inward = [...outward].reverse();

  assert.equal(findBoundaryExit(outward, region).ok, true);
  // Read backwards the origin is outside, so the escape is not recognised.
  const backwards = findBoundaryExit(inward, region);
  assert.equal(backwards.ok, false);
  assert.match(backwards.reason, /origin is not inside/);

  // Orienting a copy restores the correct reading without touching the drawing.
  const origin = outward[0];
  const oriented = orientPathFromOrigin(inward, origin);
  assert.deepEqual(oriented[0], origin);
  assert.equal(findBoundaryExit(oriented, region).ok, true);
  assert.equal(inward[0].y, -40, 'the caller\'s array is left untouched');
});

test('an escape is counted through the top or a side, never through the bottom', () => {
  const region = { x: 0, y: 0, width: 100, height: 100 };
  const throughTop = [{ x: 50, y: 50 }, { x: 50, y: -30 }];
  const top = findBoundaryExit(throughTop, region);
  assert.equal(top.ok, true);
  assert.equal(top.edge, 'top');

  const throughSide = [{ x: 50, y: 50 }, { x: 170, y: 50 }];
  const side = findBoundaryExit(throughSide, region);
  assert.equal(side.ok, true);
  assert.equal(side.edge, 'right');

  // Dipping below the subtree and travelling away is routing, not an escape.
  const underneath = [{ x: 50, y: 50 }, { x: 50, y: 190 }, { x: -60, y: 190 }];
  const under = findBoundaryExit(underneath, region);
  assert.equal(under.ok, false);
  assert.match(under.reason, /bottom/);
});

test('reconstruction reads explicit LF roles and never infers them from PF roles', () => {
  // PF roles alone say nothing about interpretation, so they license no marking.
  const pfOnly = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'LFReconstruction',
    anchors: { pronouncedCopy: 't_probe', reconstructedCopy: 'dp_goal' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.equal(pfOnly.lf?.strikeNodes, undefined);

  // The explicit roles drive the sourced marks: strike/ghost on the neglected
  // copy plus one shared index across the two copies. The source draws no
  // connector between them, so no path of any kind is compiled.
  const explicit = hydrateLabLensFromCurrentContract(valuesStage([{
    relation: 'LFReconstruction',
    anchors: { neglectedCopy: 'dp_goal', interpretedCopy: 't_probe' }
  }]), valuesTree, { label: 'x', nodes: [] });
  assert.deepEqual(explicit.lf.strikeNodes, ['dp_goal']);
  assert.equal(explicit.lf.paths, undefined);
  assert.deepEqual(explicit.coindex, [{
    nodes: ['dp_goal', 't_probe'],
    index: 'i',
    stage: 0,
    relationIndex: 0
  }]);
});

test('the live reconstruction card authors explicit LF roles only', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf("relation: 'LFReconstruction'"), source.indexOf("relation: 'LFReconstruction'") + 320);
  assert.match(block, /neglectedCopy:\s*'dp_picture_high_lf'/);
  assert.match(block, /interpretedCopy:\s*'dp_picture_low_lf'/);
  assert.doesNotMatch(block, /pronouncedCopy|reconstructedCopy/);
});

test('the live LF reconstruction card authors A-bar movement before LF copy selection', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const start = source.indexOf("title: 'LF Reconstruction'");
  const end = source.indexOf("title: 'LF Reconstruction (predicate AP)'", start);
  const card = source.slice(start, end);
  const movementAt = card.indexOf("relation: 'AbarMove'");
  const reconstructionAt = card.indexOf("relation: 'LFReconstruction'");

  assert.ok(start >= 0 && end > start, 'the canonical LF reconstruction card must exist');
  assert.equal((card.match(/relation: 'AbarMove'/g) || []).length, 1);
  assert.equal((card.match(/relation: 'LFReconstruction'/g) || []).length, 1);
  assert.ok(movementAt >= 0 && movementAt < reconstructionAt);
  assert.match(card, /lowerCopy:\s*'dp_picture_low_lf'/);
  assert.match(card, /traceWitness:\s*'d_which_picture_low_lf'/);
  assert.match(card, /pronouncedCopy:\s*'dp_picture_high_lf'/);
});

test('the live control card describes the sourced directed dependency', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const cardStart = source.indexOf("title: 'Control Dependency'");
  const cardBlock = source.slice(cardStart, cardStart + 650);
  assert.match(cardBlock, /dotted directed control dependency/);
  assert.doesNotMatch(cardBlock, /non-arrow/);
});

test('a trajectory never overshoots below the occurrence it leaves', () => {
  // Source below target, as in ordinary upward movement.
  const startY = 2704;
  const endY = 227;
  for (let index = 0; index < 6; index += 1) {
    const control = trajectoryControlY(startY, endY, index);
    assert.ok(control <= Math.max(startY, endY), `control point ${control} dipped below the source`);
    assert.ok(control >= Math.min(startY, endY), `control point ${control} rose above the target`);
  }
});

test('concurrent chains separate upward inside the envelope, never below it', () => {
  const startY = 1000;
  const endY = 200;
  const first = trajectoryControlY(startY, endY, 0);
  const second = trajectoryControlY(startY, endY, 1);
  assert.equal(first, startY, 'the first chain sits on the source level');
  assert.ok(second < first, 'the next chain separates upward');
  assert.ok(second >= endY, 'separation stays inside the envelope');

  // Even far more chains than fit cannot escape the envelope.
  const many = trajectoryControlY(startY, endY, 500);
  assert.equal(many, endY);
});

test('downward movement keeps the same envelope rule', () => {
  // Lowering runs the other way: the envelope is still between the endpoints.
  const control = trajectoryControlY(200, 900, 0);
  assert.equal(control, 900);
  assert.ok(control <= Math.max(200, 900));
});

test('a constrained path yields one distinct side exit per nested boundary', () => {
  // Mirrors the repaired island geometry: leave the source, travel left inside
  // the envelope, then rise. Nested regions are left through their side edges.
  const path = [
    { x: 600, y: 280 }, { x: 400, y: 275 }, { x: 250, y: 260 }, { x: 60, y: 40 }
  ];
  const inner = { x: 300, y: 100, width: 400, height: 250 };
  const outer = { x: 150, y: 50, width: 600, height: 320 };
  const result = findBoundaryCrossings(path, [inner, outer]);
  assert.equal(result.ok, true);
  assert.equal(result.crossings.length, 2);
  // Each exit lands exactly on its own region's left edge.
  assert.equal(Math.round(result.crossings[0].point.x), 300);
  assert.equal(Math.round(result.crossings[1].point.x), 150);
  const gap = Math.hypot(
    result.crossings[0].point.x - result.crossings[1].point.x,
    result.crossings[0].point.y - result.crossings[1].point.y
  );
  assert.ok(gap >= MIN_CROSSING_SEPARATION);
});

/*
 * Integration proofs for the three RED blockers. These read what the browser
 * actually produced, not what the source says it should produce.
 */
const PROOF_DIR = new URL('../fixtures/visual-relations/reconstruction/', import.meta.url);

const witnessTree = {
  id: 'cp_w',
  label: 'CP',
  children: [
    {
      id: 'dp_high_w',
      label: 'DP',
      children: [{ id: 'd_high_w', label: 'D', word: 'Which' }]
    },
    {
      id: 'dp_low_w',
      label: 'DP',
      silent: true,
      children: [{ id: 'd_low_w', label: 'D', word: 't₁', silent: true }]
    }
  ]
};

const witnessStage = (anchors) => [{
  statement: 'Move the object.',
  stageRecord: 'AbarMove relates the two occurrences.',
  relations: [{ relation: 'AbarMove', anchors }],
  workspaceForest: [witnessTree]
}];

test('the live adapter resolves the trace witness strictly, not first-id-wins', () => {
  const draw = (anchors) => hydrateLabLensFromCurrentContract(
    witnessStage(anchors), witnessTree, { label: 'x', nodes: [] }
  ).trajectory;

  // The accepted shape still draws.
  assert.equal(
    draw({ lowerCopy: 'dp_low_w', traceWitness: 'd_low_w', pronouncedCopy: 'dp_high_w' })?.[0].fromWitness,
    'd_low_w'
  );

  // An array is not one unambiguous node, even though its first entry resolves.
  assert.equal(draw({
    lowerCopy: 'dp_low_w', traceWitness: ['d_low_w', 'dp_low_w'], pronouncedCopy: 'dp_high_w'
  }), undefined);

  // Two witness roles leave the origin ambiguous.
  assert.equal(draw({
    lowerCopy: 'dp_low_w', traceWitness: 'd_low_w', lowerWitness: 'dp_low_w', pronouncedCopy: 'dp_high_w'
  }), undefined);

  // An id the tree does not contain.
  assert.equal(draw({
    lowerCopy: 'dp_low_w', traceWitness: 'd_nowhere', pronouncedCopy: 'dp_high_w'
  }), undefined);

  // A real node that sits outside the authored lower copy.
  assert.equal(draw({
    lowerCopy: 'dp_low_w', traceWitness: 'd_high_w', pronouncedCopy: 'dp_high_w'
  }), undefined);

  // An unresolvable lower copy cannot vouch for any witness.
  assert.equal(draw({
    lowerCopy: 'dp_missing_w', traceWitness: 'd_low_w', pronouncedCopy: 'dp_high_w'
  }), undefined);
});

test('a witness-free kind is still refused when it authors a broken witness', () => {
  const lens = hydrateLabLensFromCurrentContract(
    [{
      statement: 'Raise the head.',
      stageRecord: 'HeadMove relates the two head positions.',
      relations: [{
        relation: 'HeadMove',
        anchors: { lowerCopy: 'dp_low_w', traceWitness: 'd_nowhere', pronouncedCopy: 'dp_high_w' }
      }],
      workspaceForest: [witnessTree]
    }],
    witnessTree,
    { label: 'x', nodes: [] }
  );
  assert.equal(lens.trajectory, undefined);
});

test('a path that leaves through the bottom and later escapes upward is refused', () => {
  const region = { x: 0, y: 0, width: 100, height: 100 };
  // Out through the floor, back in through the floor, then away through the top:
  // the upward departure is real, but the dependency did not stay outside, so
  // there is no single point at which it left this constituent.
  const reentry = [
    { x: 50, y: 50 }, { x: 50, y: 160 }, { x: 20, y: 160 }, { x: 20, y: 50 }, { x: 20, y: -40 }
  ];
  const result = findBoundaryExit(reentry, region);
  assert.equal(result.ok, false);
  assert.match(result.reason, /more than once/);

  // The same shape is refused for the whole boundary set, not just one region.
  const both = findBoundaryCrossings(reentry, [region, { x: -10, y: -10, width: 130, height: 130 }]);
  assert.equal(both.ok, false);
});

/**
 * Minimal PNG reader: enough to turn a capture into pixels so "nonblank" is a
 * measurement rather than a claim. Two identical blank shells hash the same, so
 * a hash comparison is only evidence once the images are known to contain the
 * card.
 */
const decodePng = (buffer) => {
  assert.deepEqual(
    Array.from(buffer.subarray(0, 8)),
    [137, 80, 78, 71, 13, 10, 26, 10],
    'not a PNG'
  );
  let offset = 8;
  let header = null;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12]
      };
    } else if (type === 'IDAT') {
      data.push(body);
    } else if (type === 'IEND') break;
    offset += 12 + length;
  }
  assert.ok(header, 'no IHDR');
  assert.equal(header.depth, 8, 'expected 8-bit samples');
  assert.equal(header.interlace, 0, 'expected a non-interlaced capture');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
  assert.ok(channels, `unsupported colour type ${header.colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(header.height * stride);
  let cursor = 0;
  for (let row = 0; row < header.height; row += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const out = pixels.subarray(row * stride, (row + 1) * stride);
    const prior = row === 0 ? null : pixels.subarray((row - 1) * stride, row * stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? out[index - channels] : 0;
      const up = prior ? prior[index] : 0;
      const upLeft = prior && index >= channels ? prior[index - channels] : 0;
      let value = line[index];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
      }
      out[index] = value & 0xff;
    }
  }
  return { ...header, channels, stride, pixels };
};

test('the reconstruction pixel proof compares two real, nonblank captures', async () => {
  const baseline = await readFile(new URL('reconstruction-accepted-baseline.png', PROOF_DIR));
  const candidate = await readFile(new URL('reconstruction-candidate.png', PROOF_DIR));

  const a = decodePng(baseline);
  const b = decodePng(candidate);
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.ok(a.width > 400 && a.height > 400, `capture is ${a.width}x${a.height}`);

  /*
   * The card is dark on dark, so "nonblank" cannot mean "not black". Count
   * pixels that differ from the modal colour: a blank shell is one flat fill
   * plus its rounded border, which lands far below this threshold.
   */
  const inkFraction = (image) => {
    const counts = new Map();
    const total = image.width * image.height;
    for (let index = 0; index < total; index += 1) {
      const at = index * image.channels;
      const key = (image.pixels[at] << 16) | (image.pixels[at + 1] << 8) | image.pixels[at + 2];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const modal = Math.max(...counts.values());
    return (total - modal) / total;
  };

  const baselineInk = inkFraction(a);
  const candidateInk = inkFraction(b);
  assert.ok(baselineInk > 0.02, `baseline is a blank shell: ink ${baselineInk}`);
  assert.ok(candidateInk > 0.02, `candidate is a blank shell: ink ${candidateInk}`);

  // Pixel-for-pixel identity across every channel.
  let differing = 0;
  for (let index = 0; index < a.pixels.length; index += 1) {
    if (a.pixels[index] !== b.pixels[index]) differing += 1;
  }
  assert.equal(differing, 0, `${differing} sample(s) differ between accepted and candidate`);
});

/*
 * Provenance bundle checks. These read the bundle the recovery harness
 * produced, not the harness's own summary, so a bundle that was never
 * regenerated, a capture of the inner mount instead of the card, a blank
 * capture, or a quietly edited card, CSS or overlay set all fail here.
 */
const BUNDLE = new URL('../fixtures/visual-relations/lf-provenance/', import.meta.url);

const readBundle = async (name) => JSON.parse(await readFile(new URL(name, BUNDLE), 'utf8'));

test('the LF provenance bundle cites a timestamped transcript record for every historical excerpt', async () => {
  const manifest = await readBundle('manifest.json');
  const historical = manifest.excerpts.filter((entry) => entry.group === 'historical');
  assert.ok(historical.length >= 4, `expected the recovered excerpts, got ${historical.length}`);

  const required = [
    '01-card-definition.tsx.txt',
    '02-adapter-reconstruction-branch-original.ts.txt',
    '03-adapter-reconstruction-branch-pre-rename.ts.txt',
    '04-strike-renderer.tsx.txt'
  ];
  required.forEach((name) => {
    const entry = historical.find((candidate) => candidate.name === name);
    assert.ok(entry, `missing historical excerpt ${name}`);
    assert.ok(Number.isInteger(entry.origin.record), `${name} cites no transcript record`);
    assert.match(entry.origin.timestamp, /^\d{4}-\d{2}-\d{2}T/, `${name} cites no timestamp`);
    assert.match(entry.origin.uuid, /^[0-9a-f-]{36}$/, `${name} cites no message uuid`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(entry.bytes > 100, `${name} is suspiciously short`);
  });
  assert.match(manifest.transcriptSha256, /^[0-9a-f]{64}$/);
});

test('every recovered excerpt still hashes to the value the bundle recorded', async () => {
  const manifest = await readBundle('manifest.json');
  const digests = await Promise.all(manifest.excerpts.map(async (entry) => {
    const body = await readFile(new URL(`${entry.group}/${entry.name}`, BUNDLE), 'utf8');
    return { name: entry.name, expected: entry.sha256, actual: createHash('sha256').update(body, 'utf8').digest('hex') };
  }));
  digests.forEach((entry) => {
    assert.equal(entry.actual, entry.expected, `${entry.name} no longer matches its recorded hash`);
  });
});

test('the accepted renderer and card copy match their recovered originals', async () => {
  const manifest = await readBundle('manifest.json');
  const renderer = manifest.comparisons.find((entry) => entry.tier === 1);
  assert.equal(renderer.mode, 'byte-for-byte');
  assert.equal(renderer.identical, true, 'the strike renderer no longer matches the recovered original');

  const card = manifest.comparisons.find((entry) => entry.tier === 2);
  assert.equal(card.structureOutsideAnchorsIdentical, true, 'card copy or layout changed outside the anchors object');
  assert.equal(card.anchorsIdenticalUnderRoleMapping, true, 'anchors differ by more than the role-name correction');

  // The one permitted semantic mapping, named and bounded.
  assert.deepEqual(
    manifest.roleMapping.map((pair) => `${pair.historical}->${pair.current}`).sort(),
    ['pronouncedCopy->interpretedCopy', 'reconstructedCopy->neglectedCopy']
  );
});

test('no session write ever opened one of the protected LF CSS rule bodies', async () => {
  const manifest = await readBundle('manifest.json');
  assert.deepEqual(manifest.cssProvenance.writesOpeningARuleBody, []);
  assert.ok(manifest.cssProvenance.writesOpeningARuleBody.length === 0);
  assert.ok(manifest.writesToProductFiles.length > 0, 'edit provenance was not collected');

  // And the live rules still hash to what the bundle captured.
  const recorded = manifest.excerpts.find((entry) => entry.name === '05-lf-css.css.txt');
  assert.ok(recorded, 'the CSS excerpt is missing from the bundle');
  const page = await readFile(new URL('../docs/design/babel-visual-relations-research.production-only-audit.html', import.meta.url), 'utf8');
  const rules = ['.babel-lf-copy-label', '.babel-lf-strike-shadow', '.babel-lf-strike'].map((selector) => {
    const start = page.indexOf(`    ${selector} {`);
    assert.ok(start >= 0, `${selector} is no longer in the page`);
    const end = page.indexOf('    }\n', start) + '    }\n'.length;
    return page.slice(start, end);
  }).join('').replace(/\s+$/, '');
  assert.equal(
    createHash('sha256').update(`${rules}\n`, 'utf8').digest('hex'),
    recorded.sha256,
    'the LF strike CSS changed since the bundle was built'
  );
});

test('the pixel proof captures the whole card, not the inner mount, and neither capture is blank', async () => {
  const report = await readBundle('pixel-report.json');

  // Inner-mount-only captures are the failure this test exists for.
  assert.equal(report.capturedSelector.baseline, '.babel-render-card');
  assert.equal(report.capturedSelector.candidate, '.babel-render-card');
  assert.equal(report.fullCard.cardIsLargerThanMount, true);
  assert.ok(
    report.fullCard.baseline.width > report.fullCard.innerMount.width
    && report.fullCard.baseline.height > report.fullCard.innerMount.height,
    'the captured box is not bigger than the tree pane'
  );
  assert.equal(report.fullCard.dimensionsIdentical, true);

  // Blank captures: two empty shells hash the same and prove nothing.
  assert.ok(report.nonblank.baseline.ink > 0.02, `baseline ink ${report.nonblank.baseline.ink}`);
  assert.ok(report.nonblank.candidate.ink > 0.02, `candidate ink ${report.nonblank.candidate.ink}`);
  assert.ok(report.nonblank.baseline.distinctColours > 200);
  assert.ok(report.nonblank.candidate.distinctColours > 200);
});

test('the drawing is pixel-identical and the only difference is the renamed roles in the props panel', async () => {
  const report = await readBundle('pixel-report.json');

  assert.equal(report.pixels.byRegion.treePane, 0, 'the rendered tree moved');
  assert.equal(report.pixels.byRegion.everywhereElse, 0, 'something outside the props panel changed');
  assert.equal(
    report.pixels.differing,
    report.pixels.byRegion.propsPanel,
    'differing pixels fall outside the props panel'
  );
  assert.equal(report.propsPanel.differenceExplainedByRoleMappingAlone, true);
  assert.equal(report.propsPanel.detail.parsedAsJson, true);
  assert.deepEqual(
    report.propsPanel.detail.renamedKeysFound.sort(),
    ['pronouncedCopy -> interpretedCopy', 'reconstructedCopy -> neglectedCopy']
  );

  // No extra UI: same marks, same header text, same overlay classes.
  assert.equal(report.cardFacts.overlayCensusMatches, true, 'the overlay class census changed');
  assert.equal(report.cardFacts.strikeGeometryMatches, true);
  assert.equal(report.cardFacts.titleMatches, true);
  assert.equal(report.cardFacts.statusMatches, true);
  assert.equal(report.cardFacts.archetypeMatches, true);
  assert.equal(report.cardFacts.lensLabelMatches, true);
  assert.equal(report.cardFacts.replayMatches, true);
  assert.equal(report.cardFacts.treeLabelsMatch, true);
});

test('the captured card carries no LF surface beyond the accepted one', async () => {
  const candidate = await readBundle('captures/candidate-facts.json');
  const baseline = await readBundle('captures/recovered-baseline-facts.json');
  const lfClasses = (facts) => Object.keys(facts.overlayClassCensus)
    .filter((name) => name.startsWith('babel-lf-')).sort();

  // Nothing on the candidate that the recovered accepted card did not draw.
  assert.deepEqual(lfClasses(candidate), lfClasses(baseline));

  /*
   * And the accepted vocabulary itself is fixed: strike plus its shadow, the
   * struck copy's label class, ghosting, the relation layer, and the covert
   * path the accepted lens has always drawn. A rejected design would introduce
   * a class outside this set.
   */
  const ACCEPTED_LF_SURFACE = [
    'babel-lf-arrowhead',
    'babel-lf-copy-label',
    'babel-lf-ghost-label',
    'babel-lf-path',
    'babel-lf-path-qr',
    'babel-lf-relation-layer',
    'babel-lf-strike',
    'babel-lf-strike-shadow'
  ];
  lfClasses(candidate).forEach((name) => {
    assert.ok(ACCEPTED_LF_SURFACE.includes(name), `unapproved LF class on the card: ${name}`);
  });
  assert.equal(candidate.strikes, 1);
  assert.ok(candidate.ghosts > 0);
  assert.ok(candidate.propsChars > 400);
});

/*
 * The seven visual corrections. Geometry rules are unit-tested here; what the
 * card actually drew is measured from the browser into
 * fixtures/visual-relations/seven/after.json and asserted
 * below, because a rule that holds in the abstract can still miss the label it
 * was aimed at.
 */
const SEVEN = new URL('../fixtures/visual-relations/seven/after.json', import.meta.url);
const readSeven = async () => JSON.parse(await readFile(SEVEN, 'utf8'));
const card = (cards, title) => {
  const found = cards.find((entry) => entry.title === title);
  assert.ok(found, `card not measured: ${title}`);
  return found;
};
const centre = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
const labelled = (entry, text) => entry.labels.filter((label) => label.text === text);

test('a binding domain ellipse contains the whole constituent it names', () => {
  const rect = { x: 164, y: -52, width: 1094, height: 981 };
  const ellipse = containingEllipse(rect, 46, 34);
  assert.equal(ellipseContainsRect(ellipse, rect), true);

  // The naive ellipse on the raw half-extents cuts the corners off, which is
  // the shape that let the V escape the circle.
  const naive = {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    rx: rect.width / 2,
    ry: rect.height / 2
  };
  assert.equal(ellipseContainsRect(naive, rect), false);

  // Containment holds whatever the aspect ratio.
  [[10, 900], [900, 10], [300, 300]].forEach(([width, height]) => {
    const box = { x: -20, y: 40, width, height };
    assert.equal(ellipseContainsRect(containingEllipse(box, 12, 12), box), true);
  });
});

test('phrasal movement meets the phrase shell and head movement meets the heads', async () => {
  const cards = await readSeven();

  const phrasal = card(cards, 'Phrasal Movement');
  const [, ...phrasalEnds] = /M ([\d.]+) ([\d.]+) C .* ([\d.]+) ([\d.]+)$/.exec(phrasal.marks.trajectory[0].d);
  const origin = { x: Number(phrasalEnds[0]), y: Number(phrasalEnds[1]) };
  const landing = { x: Number(phrasalEnds[2]), y: Number(phrasalEnds[3]) };
  const shells = labelled(phrasal, 'DP').filter((label) => label.cls.includes('category-label'));
  assert.ok(shells.length >= 2, 'the phrasal card has both DP shells');
  const words = phrasal.labels.filter((label) => label.cls.includes('terminal-label'));

  // Both ends of the historical captured chain meet a phrase shell, not a word.
  [['origin', origin], ['landing', landing]].forEach(([role, point]) => {
    const nearestShell = shells
      .map((shell) => ({ shell, gap: Math.abs(centre(shell).x - point.x) }))
      .sort((a, b) => a.gap - b.gap)[0];
    assert.ok(nearestShell.gap < 4, `phrasal ${role} is ${nearestShell.gap} from a DP shell centre`);
    const drop = point.y - (nearestShell.shell.y + nearestShell.shell.h);
    assert.ok(drop >= 0 && drop < 12, `phrasal ${role} is ${drop} below its shell`);
    const nearestWord = words
      .map((word) => Math.hypot(centre(word).x - point.x, centre(word).y - point.y))
      .sort((a, b) => a - b)[0];
    assert.ok(nearestWord > 40, `phrasal ${role} is only ${nearestWord} from a word`);
  });

  // The two ends are different shells, not the same one twice.
  assert.ok(Math.hypot(origin.x - landing.x, origin.y - landing.y) > 100);

  const head = card(cards, 'Head Movement');
  const headMatch = /M ([\d.]+) ([\d.]+) C .* ([\d.]+) ([\d.]+)$/.exec(head.marks.trajectory[0].d);
  const headEnd = { x: Number(headMatch[3]), y: Number(headMatch[4]) };
  const headWords = head.labels.filter((label) => label.cls.includes('terminal-label'));
  const nearestWord = headWords
    .map((word) => ({ word, gap: Math.hypot(centre(word).x - headEnd.x, word.y + word.h - headEnd.y) }))
    .sort((a, b) => a.gap - b.gap)[0];
  assert.ok(
    nearestWord.gap < 24,
    `head movement lands ${nearestWord.gap} from the nearest head word (${nearestWord.word.text})`
  );
});

test('the blocked diagnostic points at the visible occurrences and is marked at the intervener', async () => {
  const cards = await readSeven();
  const entry = card(cards, 'Intervention / Superiority');
  const d = entry.marks.interventionPath[0].d;
  const points = d.match(/[-\d.]+ [-\d.]+/g).map((pair) => {
    const [x, y] = pair.split(' ').map(Number);
    return { x, y };
  });
  assert.equal(points.length, 4, 'the diagnostic is a four-point elbow');
  const start = points[0];
  const end = points[points.length - 1];

  const who = labelled(entry, 'Who')[0];
  const what = labelled(entry, 'what')[0];
  assert.ok(who && what, 'both wh occurrences are on the canvas');

  // The arrow ends beneath the visible Who, not at a shell or a blank point.
  assert.ok(Math.abs(end.x - centre(who).x) < 4, `arrow x ${end.x} vs Who ${centre(who).x}`);
  assert.ok(end.y > who.y + who.h && end.y < who.y + who.h + 40, `arrow y ${end.y} is not just below Who`);
  // And it starts beneath the visible what.
  assert.ok(Math.abs(start.x - centre(what).x) < 4, `start x ${start.x} vs what ${centre(what).x}`);

  // No shell was reused: neither endpoint sits on a DP category label.
  entry.labels.filter((label) => label.cls.includes('category-label')).forEach((shell) => {
    const box = centre(shell);
    assert.ok(
      Math.hypot(box.x - end.x, box.y - end.y) > 30,
      `the arrow ended on the ${shell.text} shell`
    );
  });

  // The blocking mark sits on the lane, at the intervener, clear of its label.
  const marks = entry.marks.interventionX.map((line) => ({
    x: (line.line[0] + line.line[2]) / 2, y: (line.line[1] + line.line[3]) / 2
  }));
  assert.equal(marks.length, 2, 'the X is two strokes');
  assert.ok(Math.abs(marks[0].x - marks[1].x) < 1 && Math.abs(marks[0].y - marks[1].y) < 1);
  const lane = points[1].y;
  assert.ok(Math.abs(marks[0].y - lane) < 1, 'the X is not on the lane');
  const trace = entry.labels.find((label) => label.text.startsWith('t'));
  assert.ok(trace, 'the intervener occurrence is on the canvas');
  assert.ok(Math.abs(marks[0].x - centre(trace).x) < 30, 'the X is not at the intervener');
  assert.ok(marks[0].y > trace.y + trace.h, 'the X covers the intervener label');
});

test('the control dependency stops clear of the controller label and paints behind the tree', async () => {
  const cards = await readSeven();
  const entry = card(cards, 'Control Dependency');
  const d = entry.marks.controlDep[0].d;
  const points = d.match(/[-\d.]+ [-\d.]+/g).map((pair) => {
    const [x, y] = pair.split(' ').map(Number);
    return { x, y };
  });
  const end = points[points.length - 1];

  const controller = entry.labels
    .filter((label) => label.text === 'DP' && label.cls.includes('category-label'))
    .map((label) => ({ label, gap: Math.abs(centre(label).x - end.x) }))
    .sort((a, b) => a.gap - b.gap)[0].label;

  // The path must not reach into the glyph box.
  assert.ok(
    end.y > controller.y + controller.h,
    `the dependency ends at ${end.y}, inside the DP box (${controller.y}..${controller.y + controller.h})`
  );
  assert.ok(end.y - (controller.y + controller.h) >= 30, 'no room for the arrowhead below the label');

  // Layer order decides who wins where they do overlap.
  const layerIndex = entry.layerOrder.indexOf('babel-control-relation-layer');
  const firstNode = entry.layerOrder.findIndex((name) => name === 'node-group');
  assert.ok(layerIndex >= 0, 'the control layer is on the canvas');
  assert.ok(layerIndex < firstNode, 'the control layer paints over the node labels');
});

test('plain coreference marks both anchored DPs and nothing else', async () => {
  const cards = await readSeven();
  const entry = card(cards, 'Plain Coreference');
  const badges = entry.marks.coindexLayer || [];
  assert.equal(badges.length, 2, 'coreference must mark both anchors');
  assert.ok(badges.every((badge) => badge.text === badges[0].text), 'both anchors share one index');

  // The minimal convention: no path, no domain.
  assert.equal(entry.marks.trajectory, undefined);
  assert.equal(entry.marks.bindingDomain, undefined);
  assert.equal(entry.marks.controlDomain, undefined);
  assert.equal(entry.marks.controlDep, undefined);

  // Each badge sits beside a DP shell rather than floating.
  const shells = labelled(entry, 'DP');
  badges.forEach((badge) => {
    const nearest = shells
      .map((shell) => Math.hypot(centre(shell).x - centre(badge.box).x, centre(shell).y - centre(badge.box).y))
      .sort((a, b) => a - b)[0];
    assert.ok(nearest < 120, `a coindex badge is ${nearest} from the nearest DP`);
  });
});

test('the coreference lens turns exactly two coindices on and off', async () => {
  const report = JSON.parse(await readFile(
    new URL('../fixtures/visual-relations/seven/coreference-lens.json', import.meta.url),
    'utf8'
  ));
  const cards = Object.keys(report);
  assert.ok(cards.length >= 2, 'both coreference contexts were measured');

  cards.forEach((title) => {
    const { on, off, again } = report[title];
    assert.equal(on.lensActive, 'true');
    assert.equal(off.lensActive, 'false');

    // The whole of this card's relation lens is the shared index, so the
    // control has to change what is on the canvas.
    assert.equal(on.coindices, 2, `${title}: lens on should mark both anchors`);
    assert.equal(off.coindices, 0, `${title}: lens off should mark neither`);
    assert.equal(again.coindices, 2, `${title}: the mark must come back`);
    assert.deepEqual(on.text, again.text);
    assert.ok(on.text.every((index) => index === on.text[0]), `${title}: one shared index`);

    // Toggling must not disturb the tree or introduce any other mark. The badge
    // count is subtracted because the badges are themselves text in the mount.
    assert.equal(
      on.treeLabels - on.coindices,
      off.treeLabels - off.coindices,
      `${title}: the tree itself changed with the lens`
    );
    assert.equal(on.treeLabels - off.treeLabels, 2, `${title}: the lens added exactly two marks`);
    [on, off, again].forEach((state) => {
      assert.deepEqual(state.otherMarks, {
        trajectory: 0, bindingDomain: 0, controlDomain: 0, controlDependency: 0
      }, `${title}: coreference drew something beyond the coindex`);
    });
  });
});

/*
 * Bounding-node slashes: the source plate (CAS LX 522 slide 24) lays them over
 * the tree, cutting the branch into each bounding node. So the proof is edge
 * attachment, not path intersection — and it must also show they stay off the
 * movement arrow.
 */
const segmentDistance = (point, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
};
const segmentsCross = (a, b, c, d) => {
  const orient = (p, q, r) => Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
};

test('each bounding-node slash cuts the branch into its own authored boundary', async () => {
  const cards = await readSeven();
  ['Bounding-Node Crossing (wh-island)', 'Bounding-Node Crossing (complex NP)'].forEach((title) => {
    const entry = card(cards, title);
    const slashes = entry.marks.islandSlash || [];
    const branches = entry.boundaryBranches || [];
    assert.equal(slashes.length, 2, `${title}: one slash per authored boundary`);
    assert.equal(branches.length, 2, `${title}: both branches published`);

    const unmatched = new Set(branches.map((branch) => branch.node));
    slashes.forEach((slash) => {
      const a = { x: slash.line[0], y: slash.line[1] };
      const b = { x: slash.line[2], y: slash.line[3] };
      // The slash must actually cross the parent-to-boundary edge.
      const hit = branches.find((branch) => segmentsCross(a, b, branch.from, branch.to));
      assert.ok(hit, `${title}: a slash crosses no authored boundary branch`);
      assert.ok(unmatched.has(hit.node), `${title}: two slashes cut the ${hit.node} branch`);
      unmatched.delete(hit.node);

      // And it must sit on that edge, not merely reach it from far away.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const offEdge = segmentDistance(mid, hit.from, hit.to);
      assert.ok(offEdge < 6, `${title}: the ${hit.node} slash is centred ${offEdge} off its branch`);
    });
    assert.equal(unmatched.size, 0, `${title}: an authored boundary has no slash`);
  });
});

test('bounding-node slashes stay off the movement arrow and read at tree scale', async () => {
  const cards = await readSeven();
  ['Bounding-Node Crossing (wh-island)', 'Bounding-Node Crossing (complex NP)'].forEach((title) => {
    const entry = card(cards, title);
    const slashes = entry.marks.islandSlash || [];

    // Re-derive the drawn trajectory and require every slash to miss it. The
    // source marks the tree; a mark riding the arrow was the earlier mistake.
    const [, sx, sy, c1x, c1y, c2x, c2y, ex, ey] =
      /M ([\d.]+) ([\d.]+) C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)/
        .exec(entry.marks.trajectory[0].d).map(Number);
    const at = (t) => {
      const u = 1 - t;
      return {
        x: u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
        y: u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey
      };
    };
    const samples = Array.from({ length: 401 }, (unused, index) => at(index / 400));

    const labelHeight = entry.labels.find((label) => label.cls.includes('category-label')).h;
    slashes.forEach((slash) => {
      const a = { x: slash.line[0], y: slash.line[1] };
      const b = { x: slash.line[2], y: slash.line[3] };
      const touches = samples.some((point, index) =>
        index > 0 && segmentsCross(a, b, samples[index - 1], point));
      assert.equal(touches, false, `${title}: a slash rides the movement arrow`);

      // Long enough to read against the labels it sits among.
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      assert.ok(
        length > labelHeight * 6,
        `${title}: a slash is only ${length} long against a ${labelHeight} label`
      );

      // Consistent angle, as on the plate.
      const degrees = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
      assert.ok(degrees > 35 && degrees < 65, `${title}: a slash sits at ${degrees} degrees`);
    });

    // Distinguishable from one another.
    const mids = slashes.map((slash) => ({
      x: (slash.line[0] + slash.line[2]) / 2, y: (slash.line[1] + slash.line[3]) / 2
    }));
    assert.ok(Math.hypot(mids[0].x - mids[1].x, mids[0].y - mids[1].y) >= MIN_CROSSING_SEPARATION);
  });
});

test('the binding domain circle contains the whole constituent it names', async () => {
  const cards = await readSeven();
  const entry = card(cards, 'Binding / Principle A');
  const mark = entry.marks.bindingDomain?.[0];
  assert.ok(mark, 'the binding card draws a domain mark');
  assert.equal(mark.tag, 'ellipse', 'the accepted presentation is a circle, not a hull or capsules');

  const [cx, cy, rx, ry] = mark.ellipse;
  const ellipse = { cx, cy, rx, ry };

  // The V-prime constituent, whole: the domain the card names.
  ["V'", 'V', 'saw', 'D', 'himself'].forEach((text) => {
    labelled(entry, text).forEach((label) => {
      const rect = { x: label.x, y: label.y, width: label.w, height: label.h };
      assert.equal(
        ellipseContainsRect(ellipse, rect),
        true,
        `${text} at ${label.x},${label.y} is outside the binding circle`
      );
    });
  });

  // One mark: no capsules, no connector, no second path.
  assert.equal(entry.marks.bindingDomain.length, 1);
});

test('an identity family carries its chain number on every occurrence', async () => {
  const identity = JSON.parse(await readFile(
    new URL('../fixtures/visual-relations/reopen/probes-identity.json', import.meta.url),
    'utf8'
  ));
  assert.equal(identity.length, 2, 'both Identity contexts were measured');

  identity.forEach((entry) => {
    assert.equal(entry.lensActive, 'true');
    assert.equal(entry.bareT, 0, `${entry.title}: a trace is still a bare t`);
    const isTrace = (text) => /^t[0-9\u2080-\u2089]*$/i.test(text);
    const traces = entry.terminals.filter((terminal) => isTrace(terminal.text));
    assert.ok(traces.length >= 2, `${entry.title}: traces were measured`);
    // Every trace carries a number, and it is the same one across the family.
    const numbers = new Set(traces.map((trace) => trace.text.replace(/^t/i, '')));
    numbers.forEach((suffix) => assert.match(suffix, /^[0-9\u2080-\u2089]+$/));
    assert.equal(numbers.size, 1, `${entry.title}: occurrences disagree on the index`);
  });

  // Both cards use the same convention, so they read alike.
  const suffixes = identity.map((entry) => entry.terminals
    .filter((terminal) => /^t[0-9\u2080-\u2089]+$/i.test(terminal.text))[0].text.replace(/^t/i, ''));
  assert.equal(new Set(suffixes).size, 1, 'the two Identity cards number their chains differently');
});

/*
 * The three source-faithful movement cards: remnant, roll-up, smuggling.
 */
const NEW_CARDS = new URL('../fixtures/visual-relations/new-cards/', import.meta.url);

test('no lab card shows a movement arrow it did not author', async () => {
  const cards = JSON.parse(await readFile(new URL('authored-only.json', NEW_CARDS), 'utf8'));
  assert.ok(cards.length > 35, `expected the whole lab to be measured, got ${cards.length}`);

  /*
   * TreeVisualizer can infer an arrow from the difference between two
   * derivation frames. This surface draws authored relations and nothing else,
   * so an inferred arrow is a duplicate in a geometry no source uses.
   */
  const withArrows = cards.filter((card_) => card_.inferredArrows > 0);
  assert.deepEqual(withArrows.map((c) => c.title), []);

  // Only cards that author movement are cleaned, and the count is published.
  cards.forEach((entry) => {
    if (entry.authoredTrajectories > 0) {
      assert.match(String(entry.dropped), /^\d+$/, `${entry.title}: no drop count published`);
    } else {
      assert.equal(entry.dropped, null, `${entry.title} has no trajectory but was cleaned`);
    }
  });

  // The rule is load-bearing: at least one card really did have one to drop.
  assert.ok(
    cards.some((entry) => Number(entry.dropped) > 0),
    'nothing was dropped, so this check proves nothing'
  );
});

test('the three movement cards keep their ordered stages and licensed enclosures', async () => {
  const cards = JSON.parse(await readFile(new URL('authored-only.json', NEW_CARDS), 'utf8'));
  const byTitle = Object.fromEntries(cards.map((entry) => [entry.title, entry]));

  const remnant = byTitle['Remnant Movement'];
  const rollUp = byTitle['Roll-up Movement'];
  const smuggling = byTitle.Smuggling;
  assert.ok(remnant && rollUp && smuggling, 'all three cards are on the page');

  // One relation per movement step, and the steps really are ordered frames.
  assert.equal(remnant.authoredTrajectories, 2, 'evacuation plus remnant movement');
  assert.equal(remnant.replay, 'Stage 2/2');
  assert.equal(rollUp.authoredTrajectories, 3, 'three turns of the snowball');
  assert.equal(rollUp.replay, 'Stage 4/4', 'base generation and all three movements must be present');
  assert.equal(smuggling.authoredTrajectories, 2, 'carrier plus passenger');
  assert.equal(smuggling.replay, 'Stage 2/2');

  /*
   * The rectangle is one drawing with two licences, and they sit at opposite
   * ends of a chain. Collapsing them would lose which occurrence the source is
   * pointing at.
   */
  assert.deepEqual(remnant.enclosures, ['remnant-landing']);
  assert.deepEqual(smuggling.enclosures, ['carrier-chunk']);
  assert.deepEqual(rollUp.enclosures, [], 'roll-up encloses nothing');

  // Each card's caption is the authored statement, not a synthesised recipe.
  [remnant, rollUp, smuggling].forEach((entry) => {
    assert.doesNotMatch(entry.caption, /^Establish /, `${entry.title}: synthesised caption`);
    assert.ok(entry.caption.length > 20, `${entry.title}: caption is "${entry.caption}"`);
  });
});

/*
 * Source-fidelity regressions for the rebuilt cards, measured from the browser
 * into rebuild-evidence.json rather than asserted from the source text.
 */
const parseOrthogonal = (d) => {
  const points = (d.match(/[-\d.]+ [-\d.]+/g) || []).map((pair) => {
    const [x, y] = pair.split(' ').map(Number);
    return { x, y };
  });
  return points;
};

test('the rebuilt cards author no literal t and render no bare t terminal', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  assert.equal(evidence.length, 3);
  evidence.forEach((card_) => {
    const bare = card_.terminals.filter((text) => /^t(?:NP|v)?$/i.test(text));
    assert.deepEqual(bare, [], `${card_.title} renders a bare trace token`);
  });

  // And none is authored: the three fixtures never write a 't' surface form.
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const blocks = [
    ['remnantStepOneTree', 'rawCases'],
    ['rollUpBaseTree', 'rawCases'],
    ['smugglingStepOneTree', 'rawCases']
  ];
  const remnant = source.slice(source.indexOf('const remnantMovementTree'), source.indexOf('const rollUpStepOneTree'));
  const rollUp = source.slice(source.indexOf('const rollUpStepOneTree'), source.indexOf('const smugglingStepOneTree'));
  const smuggling = source.slice(
    source.indexOf('const smugglingStepOneTree'),
    source.indexOf('/* Source-backed completion batch')
  );
  [remnant, rollUp, smuggling].forEach((block, index) => {
    assert.ok(block.length > 500, `fixture block ${index} not found`);
    assert.doesNotMatch(block, /'t'|'t[A-Z]+'/, `fixture block ${index} authors a literal trace token`);
  });
});

test('the rebuilt trajectories are green, axis-aligned, and lane-correct per source', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const byTitle = Object.fromEntries(evidence.map((entry) => [entry.title, entry]));

  // Babel's visual language: every relation stroke is the green family.
  evidence.flatMap((entry) => entry.paths).forEach((path) => {
    assert.match(path.stroke, /^rgba?\(52, 211, 153/, `${path.rel} stroke is ${path.stroke}`);
  });

  /*
   * Remnant and the carrier route below the tree: their lanes must cross empty
   * canvas, and the remnant's long visible leg is the rise to the boxed landing
   * — the leg the source aligns vertically. Only roll-up keeps the
   * leave-at-own-level rule, whose lanes cross the gaps its own movements
   * opened. Scrambling is not in this list: it is ordinary phrasal movement and
   * is drawn as a curve.
   */
  /*
   * Only the families whose sources draw a bracket. The evacuation step is
   * ordinary phrasal movement and is checked as a curve elsewhere.
   */
  const kinds = {
    RemnantMovement: { acrossUp: false },
    RollUpMovement: { acrossUp: true },
    Smuggling: { acrossUp: false }
  };
  evidence.flatMap((entry) => entry.paths).forEach((path) => {
    if (!(path.rel in kinds)) return;
    const points = parseOrthogonal(path.d);
    assert.ok(points.length >= 3, `${path.rel} is not a polyline`);
    // Axis-aligned throughout: this is the source geometry, not a Bezier.
    assert.ok(isOrthogonalPath(points), `${path.rel} has a diagonal segment`);
    assert.doesNotMatch(path.d, /C /, `${path.rel} is a curve`);
    const first = points[0];
    const second = points[1];
    if (kinds[path.rel].acrossUp) {
      /*
       * The lane runs in the gutter just under the row it leaves, not down to
       * the foot of the tree. Shlonsky's lanes cross bare paper because his
       * landings are empty slots; a laid-out tree has siblings on that row, so
       * the first clear gutter is the nearest equivalent. Bounded, and small
       * relative to the rise that follows.
       */
      const drop = second.y - first.y;
      const rise = first.y - points[points.length - 1].y;
      assert.ok(drop >= 0 && drop < 140, `${path.rel} drops ${drop} before crossing`);
      assert.ok(drop < rise / 2, `${path.rel} drops ${drop} against a rise of ${rise}`);
    } else {
      // The bracket kinds drop below the material they leave before crossing.
      assert.ok(second.y > first.y, `${path.rel} should descend before crossing`);
    }
    /*
     * The last leg rises into the landing. Comparing the arrowhead's own height
     * to the origin's would be the wrong test for a boxed landing: the box is
     * tall, the arrow meets it underneath, and that meeting point can sit lower
     * than a shallow origin while the landing itself is far above it.
     */
    const tip = points[points.length - 1];
    const elbow = points[points.length - 2];
    assert.ok(tip.y < elbow.y, `${path.rel} does not turn up into its landing`);
    assert.equal(tip.x, elbow.x, `${path.rel} does not rise vertically`);
  });

  // The carrier path carries the source's weight; ordinary movement does not.
  const smugglingPaths = byTitle.Smuggling.paths;
  assert.equal(smugglingPaths.find((p) => p.rel === 'Smuggling').width, '7px');
  assert.equal(smugglingPaths.find((p) => p.rel === 'AMove').width, '2.1px');

  // AMove stays an ordinary curve: the passenger's raising is not a bracket.
  assert.match(smugglingPaths.find((p) => p.rel === 'AMove').d, /C /);

  /*
   * The straight lanes are only faithful when they cross empty canvas: no
   * orthogonal path may touch any rendered label. Measured from sampled path
   * geometry against every text box on the card, not inferred from the lane
   * arithmetic. The Bezier kinds keep the lab-wide curve convention and are
   * exempt here.
   */
  evidence.forEach((entry) => {
    /*
     * A path leaving a vacated occurrence starts on that occurrence's own copy
     * mark, because the mark is what the renderer draws there. That contact is
     * the departure, not a crossing, so it is measured by its own test and
     * excluded here.
     */
    const departures = new Set(entry.paths
      .map((path) => (path.d.match(/^M ([\d.]+) ([\d.]+)/) || []).slice(1).map(Number).map(Math.round).join(',')));
    const orthogonalCollisions = (entry.collisions || [])
      .filter((collision) => collision.rel !== 'AMove')
      .filter((collision) => !departures.has((collision.at || []).join(',')));
    assert.deepEqual(
      orthogonalCollisions,
      [],
      `${entry.title}: an orthogonal path crosses a rendered label`
    );
  });
});

test('the remnant movements have distinct origins and the carrier chunk is green', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const byTitle = Object.fromEntries(evidence.map((entry) => [entry.title, entry]));

  /*
   * The derivation accumulates: the fronting panel still draws the evacuation
   * that made the phrase a remnant, so the final frame carries both chains.
   */
  const remnantPaths = byTitle['Remnant Movement'].paths;
  assert.deepEqual(remnantPaths.map((path) => path.rel), ['Scrambling', 'RemnantMovement']);

  // The landing enclosure is the remnant's, an outline, not a filled chunk.
  const remnantEnclosures = byTitle['Remnant Movement'].enclosures;
  assert.deepEqual(remnantEnclosures.map((e) => e.licence), ['remnant-landing']);
  assert.equal(remnantEnclosures[0].fill, 'none');

  // The carrier chunk is the green gradient with a green border — never gray.
  const carrier = byTitle.Smuggling.enclosures.find((e) => e.licence === 'carrier-chunk');
  assert.ok(carrier, 'the smuggling card shades its lower carrier');
  assert.match(carrier.fill, /babel-carrier-gradient/);
  assert.match(carrier.stroke, /^rgba?\(52, 211, 153/, `carrier stroke is ${carrier.stroke}`);

  // Roll-up encloses nothing: its snowball is shown by the brackets alone.
  assert.deepEqual(byTitle['Roll-up Movement'].enclosures, []);
});

test('remnant stage 1 draws Scrambling alone; stage 2 draws Scrambling and RemnantMovement', async () => {
  const evidence = JSON.parse(await readFile(new URL('stage-evidence.json', NEW_CARDS), 'utf8'));
  const frames = evidence.remnant;
  assert.equal(frames.length, 2, 'both remnant stages were captured');

  /*
   * The derivation accumulates. Panel one is the evacuation on its own; panel
   * two is the fronting *and* the evacuation that made it a remnant, because
   * the second step does not undo the first. Both are in the structure panel
   * two shows, so both are drawn there.
   */
  assert.match(frames[0].stage, /Stage 1\//);
  assert.deepEqual(frames[0].relations, ['Scrambling']);
  assert.equal(frames[0].paths.length, 1, 'stage 1 draws more than the evacuation');
  assert.equal(frames[0].origins.length, 1);

  assert.match(frames[1].stage, /Stage 2\//);
  assert.deepEqual(frames[1].relations, ['Scrambling', 'RemnantMovement']);
  assert.equal(frames[1].paths.length, 2, 'stage 2 does not draw both movements');

  /*
   * Two movements, two places to leave from. One apparent shell for both would
   * be the drawing claiming a single operation.
   */
  const origins = frames[1].origins.map((origin) => origin.join(','));
  assert.equal(new Set(origins).size, 2, 'stage 2 draws both arrows from one place');
  const [carried, fronting] = frames[1].origins;
  const spread = Math.hypot(carried[0] - fronting[0], carried[1] - fronting[1]);
  assert.ok(spread > 80, `the two movements depart only ${spread} apart`);

  /*
   * The evacuation leaves the same occurrence in both panels — the object's own
   * gap. Its screen position differs because the second panel has moved the VP
   * around it, so the check is against each panel's own anchor rather than
   * against the other panel's coordinates.
   */
  frames.forEach((frame) => {
    assert.ok(Math.abs(frame.origins[0][0] - frame.anchors.dp_obj_gap[0]) < 2,
      `${frame.stage}: the evacuation does not depart from the object gap`);
  });
});

test('the roll-up card is an ordinary DP with three ordered overlays', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const rollUp = evidence.find((entry) => entry.title === 'Roll-up Movement');
  assert.ok(rollUp, 'the roll-up card was measured');

  // Three ordered events, all still drawn in the accumulated frame.
  assert.equal(rollUp.paths.length, 3);
  rollUp.paths.forEach((path) => assert.equal(path.rel, 'RollUpMovement'));

  /*
   * The tree is a Hebrew DP, not a diagram: every word of the sentence is
   * pronounced exactly once, and every other occurrence is a copy mark. The
   * source contributes the arrow convention and nothing else.
   */
  const words = ['ha-sfarim', 'ha-adumim', 'ha-gdolim', 'ha-ele'];
  words.forEach((word) => {
    assert.equal(
      rollUp.terminals.filter((text) => text === word).length, 1,
      `${word} is pronounced ${rollUp.terminals.filter((text) => text === word).length} times`
    );
  });
  rollUp.terminals.forEach((text) => {
    assert.ok(words.includes(text) || /^t[₀-₉\d]+$/.test(text),
      `${text} is neither a word of the sentence nor a copy mark`);
  });

  /*
   * The landings are nested — each step carries the previous one — so their
   * arrivals must not collapse into one column. Ranked outward, the largest
   * constituent's arrow runs furthest out.
   */
  const arrivals = rollUp.paths.map((path) => {
    const points = path.d.match(/[-\d.]+ [-\d.]+/g).map((pair) => Number(pair.split(' ')[0]));
    return points[points.length - 1];
  });
  assert.equal(new Set(arrivals).size, 3, 'two roll-up arrows rise in the same column');
  assert.deepEqual(rollUp.collisions, [], 'a roll-up arrow crosses a label');
});

test('an assumed movement leaves a copy without drawing a second arrow', () => {
  /*
   * A derivation can take a movement for granted and draw only the ones it is
   * about. Babel already has what that needs — one lineage, one pronounced
   * occurrence, the rest silent — so such a family gets a chain number and reads
   * as copies without a second arrow appearing.
   */
  const tree = {
    id: 'tp_assume',
    label: 'TP',
    children: [
      { id: 'dp_subj_assume', label: 'DP', children: [{ id: 'd_subj_assume', label: 'D', word: 'she' }] },
      {
        id: 'vbar_assume',
        label: "V'",
        children: [
          { id: 'v_high_assume', label: 'V', word: 'read', lineageId: 'assume-v' },
          {
            id: 'dp_obj_assume',
            label: 'DP',
            lineageId: 'assume-dp',
            children: [{ id: 'd_obj_assume', label: 'D', word: 'it', lineageId: 'assume-dp-d' }]
          },
          { id: 'v_low_assume', label: 'V', word: 'read', silent: true, lineageId: 'assume-v' }
        ]
      }
    ]
  };
  const stages = [{
    statement: 'The object moves; the verb has already raised.',
    stageRecord: 'AbarMove relates the object copies.',
    relations: [{
      relation: 'AbarMove',
      anchors: { lowerCopy: 'dp_obj_assume', traceWitness: 'd_obj_assume', pronouncedCopy: 'dp_subj_assume' }
    }],
    workspaceForest: [tree]
  }];
  const lens = hydrateLabLensFromCurrentContract(stages, tree, { label: 'assumed', nodes: [] });

  assert.equal(lens.trajectory.length, 1, 'only the authored movement is drawn');
  assert.deepEqual(lens.copyChains, [{ index: '2', nodes: ['v_low_assume'] }]);
  // The assumed chain takes a number of its own, distinct from the drawn one.
  assert.notEqual(lens.copyChains[0].index, lens.trajectory[0].index);
});


test('the remnant derivation accumulates rather than replacing its first step', async () => {
  const evidence = JSON.parse(await readFile(new URL('stage-evidence.json', NEW_CARDS), 'utf8'));
  const [evacuation, remnant] = evidence.remnant;
  const spoken = (frame) => frame.terminals.filter((word) => !/^t[₀-₉\d]*$/.test(word) && word !== '∅').sort();
  const traces = (frame) => frame.terminals.filter((word) => /^t[₀-₉\d]*$/.test(word)).sort();

  /*
   * The second step does not undo the first. Panel one draws the evacuation;
   * panel two draws it again, alongside the fronting it made possible, because
   * both chains are in the structure the panel shows.
   */
  assert.deepEqual(evacuation.relations, ['Scrambling']);
  assert.deepEqual(remnant.relations, ['Scrambling', 'RemnantMovement']);

  const words = ['Auf', 'Buch', 'Tisch', 'das', 'den', 'er', 'gelegt', 'hat', 'nicht'];
  assert.deepEqual(spoken(evacuation), words);
  assert.deepEqual(spoken(remnant), words);
  assert.deepEqual(traces(evacuation), ['t₁', 't₁']);
  assert.deepEqual(traces(remnant), ['t₁', 't₁', 't₂', 't₂', 't₂', 't₂']);
});


test('relations are overlays: they never write tree DOM', async () => {
  const integrity = JSON.parse(await readFile(new URL('tree-integrity.json', NEW_CARDS), 'utf8'));
  const titles = Object.keys(integrity.lensOn);
  assert.deepEqual(titles, ['Remnant Movement', 'Roll-up Movement', 'Smuggling']);

  /*
   * The tree belongs to TreeVisualizer. Every relation code path runs again on
   * a lens toggle and on every frame of a replay, so if any of them repositioned
   * a node group or redrew a dominance branch, one of these snapshots would
   * differ. Byte-identical is the whole claim.
   */
  titles.forEach((title) => {
    const reference = integrity.lensOn[title];
    assert.ok(reference.transforms.length > 20, `${title} has too few nodes to be a real tree`);
    assert.ok(reference.branches.length > 20, `${title} has too few dominance branches`);
    ['lensOff', 'lensBack', 'afterReplay'].forEach((phase) => {
      assert.deepEqual(integrity[phase][title].transforms, reference.transforms,
        `${title}: a node group moved between lensOn and ${phase}`);
      assert.deepEqual(integrity[phase][title].branches, reference.branches,
        `${title}: a dominance branch was redrawn between lensOn and ${phase}`);
    });
    // And the overlays stay outside the tree: their own layer, no lab marks on it.
    assert.equal(reference.overlaysOutsideLayers, 0, `${title} draws an overlay outside a relation layer`);
    assert.deepEqual(reference.writtenOnTree, [], `${title} carries lab marks on tree elements`);
  });
});

test('no lab code repositions a tree node or redraws a dominance branch', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');

  /*
   * The deleted failure was a post-render layout pass that moved the real node
   * groups into authored coordinates. Nothing may reintroduce it: relation code
   * reads the tree and writes only into its own layers.
   */
  assert.doesNotMatch(source, /path\.branch/, 'lab code selects dominance branches');
  assert.doesNotMatch(source, /sourceLayout|SOURCE_LAYOUTS|ROLLUP_STAIRCASE/, 'the source-plate path is back');
  assert.doesNotMatch(source, /data-source-plate/, 'the plate still marks tree elements');

  /*
   * Node groups may be read — an overlay layer is inserted before the first one
   * so it paints underneath — but never written.
   */
  const groupUses = (source.match(/^.*\.node-group.*$/gm) || []).filter((line) => !line.trim().startsWith('*'));
  assert.deepEqual(
    groupUses.filter((line) => !/querySelector/.test(line)), [],
    'a .node-group reference does something other than query'
  );
  assert.doesNotMatch(source, /nodeGroup\w*\.setAttribute|group\.setAttribute\('transform'/,
    'lab code writes a transform onto a tree node');
});

test('the roll-up fixture is a complete ordinary DP at every stage', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('const rollUpBaseTree'), source.indexOf('const smugglingStepOneTree'));
  assert.ok(block.length > 500, 'the roll-up fixtures were not found');

  /*
   * Shlonsky's page uses 1P/2P/3P and XP/YP/ZP as stand-ins because the figure
   * is about geometry, not about a language. A Babel fixture is about a
   * language: real categories, real heads, real words.
   */
  [/'[123]P'/, /'[XYZ]P'/, /Card#P/, /'[123]'/].forEach((pattern) => {
    assert.doesNotMatch(block, pattern, `the fixture reuses the source's schematic label ${pattern}`);
  });
  const categories = new Set((block.match(/node\('[^']+', ("[^"]+"|'[^']+')/g) || [])
    .map((match) => match.split(', ').pop().slice(1, -1)));
  assert.deepEqual([...categories].sort(), ["A'", 'AP', "Dem'", 'DemP', 'NP']);

  /*
   * One licensed pronunciation per lineage, in every stage: a word may have any
   * number of occurrences, but only one of them is spoken. Silent copies keep
   * their words as unpronounced lexical material, so pronunciation is read off
   * the parsed trees rather than counted in the source text.
   */
  const fixtures = parseLabFixtures(source);
  const pronouncedWords = (root) => {
    const words = [];
    const walk = (node_) => {
      if ((node_.children || []).length === 0 && node_.word && node_.silent !== true) {
        words.push(node_.word);
      }
      (node_.children || []).forEach(walk);
    };
    walk(root);
    return words;
  };
  ['rollUpBaseTree', 'rollUpStepOneTree', 'rollUpStepTwoTree', 'rollUpMovementTree'].forEach((name) => {
    const spoken = pronouncedWords(fixtures.get(name));
    assert.equal(new Set(spoken).size, spoken.length, `${name} pronounces a word twice`);
    spoken.forEach((word) => assert.ok(
      ['ha-sfarim', 'ha-adumim', 'ha-gdolim', 'ha-ele'].includes(word),
      `${name} pronounces ${word}, which is not in the sentence`
    ));
  });
  // And the final tree is the whole sentence, in order.
  assert.deepEqual(
    pronouncedWords(fixtures.get('rollUpMovementTree')),
    ['ha-sfarim', 'ha-adumim', 'ha-gdolim', 'ha-ele']
  );

  // Each authored movement names a genuine shell at both ends plus a silent
  // head-leaf witness authored inside the vacated copy itself.
  const anchors = source.slice(source.indexOf("archetype: 'L2. Trajectory / roll-up'"), source.indexOf("archetype: 'L3"));
  const chains = [
    ['np_ru', 'n_books_ru', 'np_ru_hi', 'rollUpStepOneTree'],
    ['ap_red_ru', 'a_red_trace_ru', 'ap_red_ru_hi', 'rollUpStepTwoTree'],
    ['ap_big_ru', 'a_big_trace_ru', 'ap_big_ru_hi', 'rollUpMovementTree']
  ];
  const findNode = (root, id) => root.id === id
    ? root
    : (root.children || []).reduce((found, child) => found || findNode(child, id), null);
  chains.forEach(([lower, witness, higher, stageTree]) => {
    assert.match(anchors, new RegExp(`lowerCopy: '${lower}'`));
    assert.match(anchors, new RegExp(`traceWitness: '${witness}'`));
    assert.match(anchors, new RegExp(`pronouncedCopy: '${higher}'`));
    const stageRoot = fixtures.get(stageTree);
    const lowerNode = findNode(stageRoot, lower);
    assert.ok(lowerNode, `${lower} is not in ${stageTree}`);
    assert.ok(findNode(stageRoot, higher), `${higher} is not in ${stageTree}`);
    const witnessNode = findNode(lowerNode, witness);
    assert.ok(witnessNode, `${witness} is not authored inside ${lower}`);
    assert.equal((witnessNode.children || []).length, 0, `${witness} is not a leaf`);
    assert.equal(witnessNode.silent, true, `${witness} is not silent`);
  });
});

test('every roll-up vacated position is a complete headed copy with leaf traces', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const stageNames = ['rollUpBaseTree', 'rollUpStepOneTree', 'rollUpStepTwoTree', 'rollUpMovementTree'];

  const silentTerminals = (root) => {
    const found = [];
    const walk = (node_, parent) => {
      if ((node_.children || []).length === 0 && node_.silent === true && node_.label !== '∅') {
        found.push({ node: node_, parent });
      }
      (node_.children || []).forEach((child) => walk(child, node_));
    };
    walk(root, null);
    return found;
  };

  /*
   * One vacated position per snowball step, each holding the complete headed
   * skeleton of the moved constituent: the NP copy carries its silent N head,
   * each AP copy carries its silent A head and complement chain. The counts
   * grow with the copies' own content — never a bare category over a compacted
   * word, and never a trace at a landing.
   */
  assert.deepEqual(
    stageNames.map((name) => silentTerminals(fixtures.get(name)).length),
    [0, 1, 3, 6],
    'a vacated roll-up position lost or gained silent structure'
  );

  const finalTraces = silentTerminals(fixtures.get('rollUpMovementTree'));
  finalTraces.forEach(({ node: trace }) => {
    assert.equal((trace.children || []).length, 0, `${trace.id} is not a trace leaf`);
    assert.ok(
      ['N', 'A'].includes(trace.label),
      `${trace.id} is not a leaf bearing a proper preterminal category`
    );
    assert.ok(trace.word, `${trace.id} carries no lexical material`);
    assert.ok(trace.lineageId, `${trace.id} is not tied to a chain by lineage`);
  });

  // No trace occupies a landing: every pronounced landing copy contains at
  // least one pronounced terminal, and no vacated-copy root is a landing id.
  const find = (root, id) => root.id === id
    ? root
    : (root.children || []).reduce((found, child) => found || find(child, id), null);
  const final = fixtures.get('rollUpMovementTree');
  ['np_ru_hi', 'ap_red_ru_hi', 'ap_big_ru_hi'].forEach((landing) => {
    const landingNode = find(final, landing);
    assert.ok(landingNode, `${landing} missing from the final tree`);
    assert.notEqual(landingNode.silent, true, `${landing} is a silenced landing`);
    const pronounced = [];
    const walk = (node_) => {
      if ((node_.children || []).length === 0 && node_.word && node_.silent !== true) pronounced.push(node_.id);
      (node_.children || []).forEach(walk);
    };
    walk(landingNode);
    assert.ok(pronounced.length > 0, `${landing} contains no pronounced terminal`);
  });
  ['np_ru', 'ap_red_ru', 'ap_big_ru'].forEach((vacated) => {
    const vacatedNode = find(final, vacated);
    assert.ok(vacatedNode, `${vacated} missing from the final tree`);
    assert.equal(vacatedNode.silent, true, `${vacated} is not silent at its vacated position`);
  });
});

test('each roll-up mover contains the constituent assembled by the preceding step', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const find = (root, id) => root.id === id
    ? root
    : (root.children || []).reduce((found, child) => found || find(child, id), null);

  const base = fixtures.get('rollUpBaseTree');
  const stepOne = fixtures.get('rollUpStepOneTree');
  const stepTwo = fixtures.get('rollUpStepTwoTree');
  const final = fixtures.get('rollUpMovementTree');

  assert.deepEqual(find(base, 'abar_red_ru').children.map((child) => child.id), ['a_red_ru', 'np_ru']);
  assert.deepEqual(find(stepOne, 'ap_red_ru').children.map((child) => child.id), ['np_ru_hi', 'abar_red_ru']);
  assert.ok(find(stepOne, 'ap_red_ru').children.some((child) => find(child, 'np_ru')),
    'the first landing does not retain its lower NP occurrence');

  assert.deepEqual(find(stepTwo, 'ap_big_ru').children.map((child) => child.id), ['ap_red_ru_hi', 'abar_big_ru']);
  assert.ok(find(stepTwo, 'ap_red_ru_hi').children.some((child) => find(child, 'np_ru')),
    'the second mover does not carry the first movement history');

  assert.deepEqual(final.children.map((child) => child.id), ['ap_big_ru_hi', 'dembar_ru']);
  assert.ok(find(final, 'ap_big_ru_hi').children.some((child) => find(child, 'ap_red_ru')),
    'the final mover does not carry the second lower occurrence');
});

test('successive roll-up stages reveal each moved constituent only at its relation moment', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const stages = [
    {
      statement: 'The nominal hierarchy is base-generated.',
      stageRecord: 'The complete DemP exists before movement.',
      relations: [],
      workspaceForest: [fixtures.get('rollUpBaseTree')]
    },
    {
      statement: 'The NP raises into the inner AP.',
      stageRecord: 'The first RollUpMovement applies.',
      relations: [{
        relation: 'RollUpMovement',
        anchors: { lowerCopy: 'np_ru', traceWitness: 'n_books_ru', pronouncedCopy: 'np_ru_hi' }
      }],
      workspaceForest: [fixtures.get('rollUpStepOneTree')]
    },
    {
      statement: 'The inner AP raises past the outer adjective.',
      stageRecord: 'The second RollUpMovement applies.',
      relations: [{
        relation: 'RollUpMovement',
        anchors: { lowerCopy: 'ap_red_ru', traceWitness: 'a_red_trace_ru', pronouncedCopy: 'ap_red_ru_hi' }
      }],
      workspaceForest: [fixtures.get('rollUpStepTwoTree')]
    },
    {
      statement: 'The complete nominal constituent raises into Spec,DemP.',
      stageRecord: 'The third RollUpMovement applies.',
      relations: [{
        relation: 'RollUpMovement',
        anchors: { lowerCopy: 'ap_big_ru', traceWitness: 'a_big_trace_ru', pronouncedCopy: 'ap_big_ru_hi' }
      }],
      workspaceForest: [fixtures.get('rollUpMovementTree')]
    }
  ];
  const replayPlan = buildDerivationReplayPlan({ derivationStages: stages });
  const steps = buildPlaybackStepsFromDerivationFrames(
    adaptDerivationStagesForReplay(stages),
    undefined,
    'ha-sfarim ha-adumim ha-gdolim ha-ele',
    replayPlan
  );

  for (const stageNumber of [2, 3, 4]) {
    const stageSteps = steps.filter((step) =>
      String(step.replayProgressLabel || '').startsWith(`Stage ${stageNumber}/4`)
    );
    assert.deepEqual(
      stageSteps.map((step) => step.replayKind),
      ['relation', 'macro'],
      `stage ${stageNumber} reconstructs part of an already-built mover before RollUpMovement`
    );
    assert.equal(stageSteps[0].operation, 'RollUpMovement');
    assert.equal(stageSteps[0].replayRelationIdentity?.stageIndex, stageNumber - 1);
    assert.equal(stageSteps[0].replayRelationIdentity?.relationIndex, 0);
  }
});

test('every remnant trace sits in the vacated structure, none at a landing', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const remnant = evidence.find((entry) => entry.title === 'Remnant Movement');

  /*
   * Checked by ancestry, not by counting. A trace at a landing would say the
   * phrase both arrived and did not, so the question is not how many traces
   * there are but which structure each one hangs in.
   */
  const ancestry = (tree) => {
    const paths = new Map();
    const walk = (node_, above) => {
      const here = [...above, node_.id];
      paths.set(node_.id, here);
      (node_.children || []).forEach((child) => walk(child, here));
    };
    walk(tree, []);
    return paths;
  };
  const final = fixtures.get('remnantMovementTree');
  const where = ancestry(final);
  const traceLeaves = [];
  const collect = (node_) => {
    if (node_.silent === true && (node_.children || []).length === 0 && node_.label !== '∅') {
      traceLeaves.push(node_.id);
    }
    (node_.children || []).forEach(collect);
  };
  collect(final);

  assert.equal(traceLeaves.length, 6, `the frame has ${traceLeaves.length} trace leaves`);
  traceLeaves.forEach((id) => {
    const line = where.get(id);
    assert.ok(line.includes('vp_rt_low'), `${id} is not inside the vacated VP`);
    assert.ok(!line.includes('vp_rt_high'), `${id} is inside the landing`);
  });

  // The object's two hang in its own argument position; the phrase's four do not.
  const objectTraces = traceLeaves.filter((id) => where.get(id).includes('dp_obj_gap'));
  assert.deepEqual(objectTraces.sort(), ['d_das_gap__silent', 'n_buch_gap__silent']);
  objectTraces.forEach((id) => assert.ok(where.get(id).includes('vbar_rt_arg')));
  const phraseTraces = traceLeaves.filter((id) => !where.get(id).includes('dp_obj_gap'));
  assert.deepEqual(phraseTraces.sort(),
    ['d_den_low__silent', 'n_tisch_low__silent', 'p_auf_low__silent', 'v_gelegt_low__silent']);
  phraseTraces.forEach((id) => assert.ok(where.get(id).includes('vbar_rt_low')));

  // Nothing silent anywhere under the landing, in the fixture or on screen.
  const landingSilent = [];
  const scan = (node_) => {
    if (node_.silent === true) landingSilent.push(node_.id);
    (node_.children || []).forEach(scan);
  };
  scan(fixtures.get('remnantMovementTree').children.find((child) => child.id === 'vp_rt_high'));
  assert.deepEqual(landingSilent, [], 'the landing holds silent material');

  const [box] = remnant.enclosures;
  const inside = remnant.terminalLabels.filter((label) =>
    label.x >= box.rect[0] && label.x <= box.rect[0] + box.rect[2]
    && label.y >= box.rect[1] && label.y <= box.rect[1] + box.rect[3]);
  assert.deepEqual(inside.map((label) => label.text).sort(), ['Auf', 'Tisch', 'den', 'gelegt']);
  assert.deepEqual(inside.filter((label) => /^t[₀-₉\d]*$/.test(label.text)), [],
    'a trace is drawn inside the landing enclosure');

  // And the rendered indices agree with the two chains.
  assert.deepEqual(remnant.terminalLabels.filter((label) => /^t[₀-₉\d]*$/.test(label.text))
    .map((label) => `${label.id}=${label.text}`).sort(), [
    'd_das_gap__silent=t₁',
    'd_den_low__silent=t₂',
    'n_buch_gap__silent=t₁',
    'n_tisch_low__silent=t₂',
    'p_auf_low__silent=t₂',
    'v_gelegt_low__silent=t₂'
  ]);
});

test('every remnant trace is a leaf under its own preterminal', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const PRETERMINALS = new Set(['D', 'N', 'P', 'V', 'C', 'T', 'Neg']);
  const PHRASES = new Set(['VP', "V'", 'PP', 'DP', 'NP', 'CP', "C'", 'TP', "T'", 'NegP', "Neg'"]);

  ['remnantStepOneTree', 'remnantMovementTree'].forEach((name) => {
    const tree = fixtures.get(name);
    const parents = new Map();
    const walk = (node_) => (node_.children || []).forEach((child) => {
      parents.set(child.id, node_);
      walk(child);
    });
    walk(tree);
    const nodes = [];
    const gather = (node_) => {
      nodes.push(node_);
      (node_.children || []).forEach(gather);
    };
    gather(tree);

    /*
     * A trace is a terminal. No phrase, bar level or preterminal may stand in
     * for one: the silent occurrence keeps every node the pronounced one has,
     * and only what the preterminals dominate changes.
     */
    nodes.filter((node_) => PHRASES.has(node_.label)).forEach((node_) => {
      assert.ok((node_.children || []).length > 0,
        `${name}:${node_.id} is a ${node_.label} standing in for a trace`);
    });
    const isTraceLeaf = (node_) => node_.silent === true
      && (node_.children || []).length === 0 && node_.label !== '∅';
    const traceLeaves = nodes.filter(isTraceLeaf);
    assert.ok(traceLeaves.length > 0, `${name} has no trace leaves`);
    traceLeaves.forEach((node_) => {
      const parent = parents.get(node_.id);
      assert.ok(parent && PRETERMINALS.has(parent.label),
        `${name}:${node_.id} is a trace whose parent is ${parent && parent.label}, not a preterminal`);
    });
  });

  /*
   * Each lower copy keeps the branching of the occurrence it copies; only the
   * lexical terminals differ in whether they are spoken.
   */
  /*
   * Structure down to the preterminals. Below that the two occurrences are
   * meant to differ — that is the whole point of a trace — so the comparison
   * stops where pronunciation starts.
   */
  const shape = (node_) => (PRETERMINALS.has(node_.label) ? []
    : (node_.children || []).map((child) => `${child.label}(${shape(child).join(',')})`));
  const findIn = (tree, id) => (tree.id === id ? tree
    : (tree.children || []).reduce((found, child) => found || findIn(child, id), null));
  const stepOne = fixtures.get('remnantStepOneTree');
  const final = fixtures.get('remnantMovementTree');
  /*
   * The vacated VP is the moved phrase minus the gap it carried away: the
   * landing keeps the object's hole, the position it left does not, because the
   * object had already gone before the phrase moved.
   */
  /*
   * The vacated VP is the phrase plus the argument position the object left;
   * the landing is the phrase alone, because the object never travelled with it.
   */
  assert.deepEqual(shape(findIn(final, 'vbar_rt_low')), shape(findIn(final, 'vbar_rt')),
    'the vacated phrase and its landing are not the same constituent');
  assert.deepEqual(shape(findIn(stepOne, 'dp_obj_gap')), shape(findIn(stepOne, 'dp_obj_high')),
    'the object gap does not keep the shape of the DP it copies');

  // Two chains, two lineages, carried by the phrase nodes rather than the words.
  assert.equal(findIn(final, 'dp_obj_high').lineageId, 'rt-obj');
  assert.equal(findIn(stepOne, 'dp_obj_gap').lineageId, 'rt-obj');
  assert.equal(findIn(final, 'vp_rt_high').lineageId, 'rt-vp');
  assert.equal(findIn(final, 'vp_rt_low').lineageId, 'rt-vp');
});

test('both multi-step cards accumulate their overlays by stage', async () => {
  const evidence = JSON.parse(await readFile(new URL('stage-evidence.json', NEW_CARDS), 'utf8'));

  /*
   * Both figures accumulate, for the same reason: a step does not undo the one
   * before it. The remnant card ends with the evacuation and the fronting drawn
   * together; the roll-up card ends with all three turns. What a stage may not
   * do is draw a step whose landing its own tree does not yet contain, which is
   * what a flat "draw them all" would do.
   */
  assert.deepEqual(evidence.remnant.map((frame) => frame.relations),
    [['Scrambling'], ['Scrambling', 'RemnantMovement']]);
  assert.deepEqual(evidence.rollUp.map((frame) => frame.relations), [
    [],
    ['RollUpMovement'],
    ['RollUpMovement', 'RollUpMovement'],
    ['RollUpMovement', 'RollUpMovement', 'RollUpMovement']
  ]);

  // Each new step departs from somewhere the previous one did not.
  evidence.rollUp.forEach((frame) => {
    const origins = frame.origins.map((origin) => origin.join(','));
    assert.equal(new Set(origins).size, origins.length, `${frame.stage} draws two arrows from one place`);
  });

  /*
   * The complete workspace is present from base generation onward. Movement
   * changes occurrence structure; it never invents a lexical head in a later
   * stage.
   */
  const spoken = (frame) => frame.terminals.filter((text) => !/^t[₀-₉\d]*$/.test(text) && text !== '∅');
  assert.deepEqual(evidence.rollUp.map((frame) => spoken(frame).length), [4, 4, 4, 4]);
  assert.deepEqual(spoken(evidence.rollUp[3]).sort(),
    ['ha-adumim', 'ha-ele', 'ha-gdolim', 'ha-sfarim']);
});

test('the remnant fixture is a German clause a parser could emit', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);

  ['remnantStepOneTree', 'remnantMovementTree'].forEach((name) => {
    const tree = fixtures.get(name);
    assert.ok(tree, `${name} was not found`);
    const nodes = [];
    const walk = (node_) => {
      nodes.push(node_);
      (node_.children || []).forEach(walk);
    };
    walk(tree);

    nodes.forEach((node_) => {
      const kids = node_.children || [];
      assert.ok(kids.length <= 2, `${name}:${node_.id} branches ${kids.length} ways`);
      assert.ok(node_.id && node_.label, `${name} has an unlabelled node`);
    });
    const categories = [...new Set(nodes
      .filter((node_) => (node_.children || []).length > 0 || typeof node_.word === 'string')
      .map((node_) => node_.label))].sort();
    const ordinary = ["C'", 'C', 'CP', 'D', 'DP', 'N', 'NP', "Neg'", 'Neg', 'NegP', 'P', 'PP',
      "T'", 'T', "V'", 'V', 'VP', 'TP'].sort();
    assert.deepEqual(categories.filter((label) => !ordinary.includes(label)), [],
      `${name} uses a category outside the ordinary X-bar inventory`);

    // No authored trace terminals: a gap is a silent phrase, not a written `t`.
    nodes.forEach((node_) => {
      if (typeof node_.word !== 'string') return;
      assert.doesNotMatch(node_.word, /^t([₀-₉\d]+|NP|VP|DP|v)?$/,
        `${name}:${node_.id} authors the bare trace token ${node_.word}`);
    });

    // Every word of the sentence is pronounced exactly once, in every stage.
    const spoken = nodes.filter((node_) => node_.word && node_.silent !== true).map((node_) => node_.word);
    assert.deepEqual([...spoken].sort(),
      ['Auf', 'Buch', 'Tisch', 'das', 'den', 'er', 'gelegt', 'hat', 'nicht']);
  });

  /*
   * Stage 1 evacuates a genuine phrase from inside the phrase that later moves;
   * stage 2 moves that phrase. Both ends of both movements are authored nodes.
   */
  const card = source.slice(source.indexOf("archetype: 'L1. Trajectory / remnant'"), source.indexOf("archetype: 'L2"));
  assert.match(card, /relation: 'RemnantMovement'[\s\S]*?lowerCopy: 'dp_obj_gap'[\s\S]*?pronouncedCopy: 'dp_obj_high'[\s\S]*?phase: 'evacuation'/);
  assert.match(card, /relation: 'RemnantMovement'[\s\S]*?lowerCopy: 'vp_rt_low'[\s\S]*?pronouncedCopy: 'vp_rt_high'[\s\S]*?phase: 'fronting'/);
  const find = (tree, id) => {
    if (tree.id === id) return tree;
    return (tree.children || []).reduce((found, child) => found || find(child, id), null);
  };
  const stepOne = fixtures.get('remnantStepOneTree');
  assert.equal(stepOne.id, 'cbar_rt');
  assert.equal(stepOne.label, "C'");
  assert.equal(fixtures.get('remnantMovementTree').id, 'cp_rt');
  assert.ok(find(find(stepOne, 'vp_rt_low'), 'dp_obj_gap'), 'the evacuation does not start inside the VP');
  assert.equal(find(find(stepOne, 'vp_rt_low'), 'dp_obj_high'), null, 'the landing is inside the VP it left');
  assert.equal(find(find(fixtures.get('remnantMovementTree'), 'vp_rt_high'), 'vp_rt_low'), null,
    'the fronted VP contains its own lower shell');

  // The Russian and the one-word German examples are both gone.
  assert.doesNotMatch(source, /čju|mašinu|kupil|gelesen|Gelesen/i);
});

test('every node has exactly one visible native dominance branch', async () => {
  const audit = JSON.parse(await readFile(new URL('branch-audit.json', NEW_CARDS), 'utf8'));
  assert.deepEqual(Object.keys(audit), ['Remnant Movement', 'Roll-up Movement', 'Smuggling']);

  /*
   * A node with no incoming branch reads as floating: `was` hung under a T that
   * nothing connected to T'. The cause was a fixture that wrapped a T leaf in a
   * second node of the same label, and the fix belongs there — a relation may
   * never draw a dominance line the tree did not.
   */
  const roots = { 'Remnant Movement': 'cp_rt', 'Roll-up Movement': 'demp_ru', Smuggling: 'tp_smuggle' };
  Object.entries(audit).forEach(([title, card]) => {
    assert.deepEqual(card.orphans, [roots[title]], `${title} has a node with no incoming branch`);
    assert.deepEqual(card.invisible, [], `${title} has a branch that is drawn but not visible`);
    assert.deepEqual(card.duplicated, [], `${title} has a node dominated twice`);
    assert.equal(card.branches, card.nodes - 1, `${title} is not a single connected tree`);
  });
});

test('roll-up arrows stay inside the tree and land on their shells', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const rollUp = evidence.find((entry) => entry.title === 'Roll-up Movement');
  const { envelope } = rollUp;
  const PAD = 24;

  /*
   * A roll-up arrow is a local statement: this constituent came from there.
   * Routing it out to a lane beside the whole tree and pointing up at empty
   * canvas says nothing about which shell it arrived at, which is what the
   * far-left lanes did. Every point of every path now stays within the drawn
   * tree, give or take stroke padding.
   */
  rollUp.paths.forEach((path) => {
    const points = path.d.match(/[-\d.]+ [-\d.]+/g).map((pair) => {
      const [x, y] = pair.split(' ').map(Number);
      return { x, y };
    });
    points.forEach((point) => {
      assert.ok(point.x >= envelope.x - PAD && point.x <= envelope.right + PAD,
        `${path.rel} runs to x=${point.x}, outside [${envelope.x}, ${envelope.right}]`);
      assert.ok(point.y >= envelope.y - PAD && point.y <= envelope.bottom + PAD,
        `${path.rel} runs to y=${point.y}, outside [${envelope.y}, ${envelope.bottom}]`);
    });

    // Elbow shape: out at its own level, along, then up into the landing.
    assert.ok(points[1].y - points[0].y >= 0 && points[1].y - points[0].y < 140,
      `${path.rel} drops ${points[1].y - points[0].y} before running level`);
    assert.equal(points[1].y, points[2].y, `${path.rel} does not run level`);
    assert.ok(points[2].x < points[0].x, `${path.rel} does not travel back toward its landing`);
    assert.ok(isOrthogonalPath(points), `${path.rel} contains a diagonal segment`);
    assert.ok(points.at(-1).y < points.at(-2).y, `${path.rel} does not turn up into its landing`);
    assert.equal(points.at(-1).x, points.at(-2).x, `${path.rel} does not finish vertically`);
  });

  /*
   * Each arrowhead enters at the exact horizontal centre of its landing label,
   * and the horizontal lane turns there into one uninterrupted vertical rise.
   */
  const landings = [
    { arrival: rollUp.paths[0], node: 'np_ru_hi' },
    { arrival: rollUp.paths[1], node: 'ap_red_ru_hi' },
    { arrival: rollUp.paths[2], node: 'ap_big_ru_hi' }
  ];
  landings.forEach(({ arrival, node: nodeId }) => {
    const landing = rollUp.nodes.find((entry) => entry.id === nodeId);
    assert.ok(landing, `${nodeId} is not on the card`);
    const points = arrival.d.match(/[-\d.]+ [-\d.]+/g).map((pair) => pair.split(' ').map(Number));
    assert.equal(points.length, 4, `${nodeId} should use one horizontal run and one final rise`);
    const [tipX, tipY] = points.at(-1);
    assert.equal(points.at(-2)[0], tipX, `${nodeId} has a sideways jog before its arrowhead`);
    assert.ok(Math.abs(tipX - landing.x) < 2, `arrowhead at x=${tipX} is not centred under ${nodeId} at ${landing.x}`);
    assert.ok(Math.abs(tipY - landing.y) < 60, `arrowhead at y=${tipY} is not level with ${nodeId} at ${landing.y}`);
  });

  assert.deepEqual(rollUp.collisions, [], 'a roll-up arrow crosses a label');
});

test('every card keeps its relation overlays inside the mount', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  evidence.forEach((card) => {
    assert.deepEqual(card.nodes.filter((node_) => !node_.inMount).map((node_) => node_.id), [],
      `${card.title} draws a node outside its own viewport`);
    assert.ok(card.paths.length > 0, `${card.title} draws no relation`);
  });
});

test('the remnant frame draws both chains, with fronting centred under its trace footprint', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const remnant = evidence.find((entry) => entry.title === 'Remnant Movement');
  assert.deepEqual(remnant.paths.map((path) => path.rel), ['Scrambling', 'RemnantMovement']);

  const points = (path) => path.d.match(/[-\d.]+ [-\d.]+/g).map((pair) => {
    const [x, y] = pair.split(' ').map(Number);
    return { x, y };
  });
  const at = (id) => remnant.nodes.find((node_) => node_.id === id);
  const [scrambling, fronting] = remnant.paths.map(points);

  /*
   * Two chains, two origins, and neither ends on a trace: the object's arrow
   * leaves its gap for the DP that is spoken above `nicht`. The fronting
   * remains authored from vp_rt_low, while its visible departure leg is
   * centred under the four terminal traces that make up that moved occurrence.
   */
  assert.ok(Math.abs(scrambling[0].x - at('dp_obj_gap').x) < 90, 'the evacuation does not leave its gap');
  assert.ok(Math.abs(scrambling[scrambling.length - 1].x - at('dp_obj_high').x) < 90,
    'the evacuation does not reach the pronounced object');
  const remnantTraceXs = ['p_auf_low', 'd_den_low', 'n_tisch_low', 'v_gelegt_low']
    .map((nodeId) => at(nodeId).x);
  const traceFootprintMidpoint = (Math.min(...remnantTraceXs) + Math.max(...remnantTraceXs)) / 2;
  assert.ok(Math.abs(fronting[0].x - traceFootprintMidpoint) < 90,
    `the fronting departure at ${fronting[0].x} is not centred under the trace footprint at ${traceFootprintMidpoint}`);
  assert.ok(
    Math.abs(fronting[0].x - traceFootprintMidpoint)
      < Math.abs(at('vp_rt_low').x - traceFootprintMidpoint),
    'the fronting departure is still closer to the VP label than to its moved trace footprint'
  );
  const [box] = remnant.enclosures;
  const tip = fronting[fronting.length - 1];
  assert.ok(tip.x > box.rect[0] && tip.x < box.rect[0] + box.rect[2], 'the fronting misses the boxed landing');
  assert.ok(Math.abs(scrambling[0].x - fronting[0].x) > 500, 'both arrows depart from the same place');
  assert.deepEqual(remnant.collisions, []);
});

test('the remnant lower copies keep every category node, tracing only the words', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const findIn = (tree, id) => (tree.id === id ? tree
    : (tree.children || []).reduce((found, child) => found || findIn(child, id), null));
  const final = fixtures.get('remnantMovementTree');
  const stepOne = fixtures.get('remnantStepOneTree');

  /*
   * The occurrence a phrase leaves behind is the phrase, not a stand-in for it.
   * So the VP the fronting vacated still has its VP, V', PP, DP and NP, and a
   * trace under each of P, D, N and V — the four words that travelled.
   */
  const traceUnder = (root) => {
    const found = [];
    const walk = (node_) => {
      (node_.children || []).forEach((child) => {
        if (child.silent === true && (child.children || []).length === 0 && child.label !== '∅') {
          found.push(node_.label);
        }
        walk(child);
      });
    };
    walk(root);
    return found.sort();
  };
  assert.deepEqual(traceUnder(findIn(final, 'vbar_rt_low')), ['D', 'N', 'P', 'V']);
  assert.deepEqual(traceUnder(findIn(final, 'dp_obj_gap')), ['D', 'N']);
  assert.deepEqual(traceUnder(findIn(stepOne, 'dp_obj_gap')), ['D', 'N']);
  // Both gaps sit in the structure the derivation vacated, never at a landing.
  assert.ok(findIn(findIn(final, 'vp_rt_low'), 'dp_obj_gap'), 'the object gap left its argument position');
  assert.equal(findIn(findIn(final, 'vp_rt_high'), 'dp_obj_gap'), null, 'a gap was carried into the landing');

  // Nothing silent at all in the landing.
  const silentIn = (root) => {
    const found = [];
    const walk = (node_) => {
      if (node_.silent === true) found.push(node_.id);
      (node_.children || []).forEach(walk);
    };
    walk(root);
    return found;
  };
  assert.deepEqual(silentIn(findIn(final, 'vp_rt_high')), []);

  /*
   * The arrows relate constituents. Each names a phrase at both ends, and the
   * witness is a leaf inside the lower one — evidence, not an endpoint.
   */
  const card = source.slice(source.indexOf("archetype: 'L1. Trajectory / remnant'"), source.indexOf("archetype: 'L2"));
  assert.match(card, /lowerCopy: 'dp_obj_gap',\s*traceWitness: 'd_das_gap',\s*pronouncedCopy: 'dp_obj_high'/);
  assert.match(card, /lowerCopy: 'vp_rt_low',\s*traceWitness: 'v_gelegt_low',\s*pronouncedCopy: 'vp_rt_high'/);
  ['dp_obj_gap', 'dp_obj_high', 'vp_rt_low', 'vp_rt_high'].forEach((id) => {
    const node_ = findIn(stepOne, id) || findIn(final, id);
    assert.ok(['DP', 'VP'].includes(node_.label), `${id} is not a phrase`);
  });
});

test('both remnant relations stay shell-authored while their routes use licensed geometry', async () => {
  const evidence = JSON.parse(await readFile(new URL('stage-evidence.json', NEW_CARDS), 'utf8'));
  const [evacuation, remnant] = evidence.remnant;
  const ends = (d) => {
    const points = d.match(/[-\d.]+ [-\d.]+/g).map((pair) => pair.split(' ').map(Number));
    return { start: points[0], tip: points[points.length - 1] };
  };
  const meets = (point, anchor) => Math.abs(point[0] - anchor[0]) < 2;

  /*
   * A constituent movement relates two phrase occurrences. Scrambling can draw
   * directly shell to shell. The remnant relation is still authored VP to VP,
   * while its visible departure leg is centred over the terminal traces in the
   * vacated VP; the separate footprint test verifies that route geometry.
   */
  assert.equal(evacuation.paths.length, 1);
  const first = ends(evacuation.paths[0]);
  assert.ok(meets(first.start, evacuation.anchors.dp_obj_gap));
  assert.ok(meets(first.tip, evacuation.anchors.dp_obj_high));

  assert.equal(remnant.paths.length, 2);
  const carried = ends(remnant.paths[0]);
  const fronting = ends(remnant.paths[1]);
  assert.ok(meets(carried.start, remnant.anchors.dp_obj_gap), 'the carried gap is not where the first arrow starts');
  assert.ok(meets(carried.tip, remnant.anchors.dp_obj_high));
  assert.ok(meets(fronting.tip, remnant.anchors.vp_rt_high));
  assert.ok(Array.isArray(remnant.anchors.vp_rt_low), 'the remnant source VP does not resolve');
  assert.ok(Math.abs(fronting.start[0] - remnant.anchors.vp_rt_low[0]) > 100,
    'the visible remnant route regressed to the off-centre VP label');
});

const FULL_AUDIT = new URL('../fixtures/visual-relations/full-audit/', import.meta.url);

test('every card in the lab renders one connected tree, wholly inside its card', async () => {
  const audit = JSON.parse(await readFile(new URL('measurements.json', FULL_AUDIT), 'utf8'));
  assert.ok(audit.cards.length >= 41, `only ${audit.cards.length} cards were measured`);

  /*
   * Two failures this catches, both seen in this lab: a fixture that wraps a
   * head in a second node of the same label, which leaves a word hanging with
   * no branch above it; and a tree too wide for its column, which loses its
   * leftmost word off the edge. Neither shows up in a structural assertion
   * about the fixture — only in what the renderer actually drew.
   */
  audit.cards.forEach((card) => {
    assert.equal(card.branches, card.nodes - 1, `${card.title}: ${card.nodes} nodes but ${card.branches} branches`);
    assert.equal(card.orphans.length, 1, `${card.title}: ${card.orphans.length} nodes without a parent branch`);
    assert.deepEqual(card.clipped, [], `${card.title}: nodes drawn outside the card`);
  });
});

test('no card lets a relation write on the tree it describes', async () => {
  const audit = JSON.parse(await readFile(new URL('measurements.json', FULL_AUDIT), 'utf8'));

  // Overlays live in their own layers and leave no mark on any tree element.
  audit.cards.forEach((card) => {
    assert.equal(card.labMarksOnTree, 0, `${card.title} carries lab classes on tree elements`);
    card.overlayLayers.forEach((layer) => assert.match(layer, /-relation-layer/));
  });

  // And the tree survives a lens toggle unchanged, on every card at once.
  const unstable = audit.drift.filter((entry) => !entry.stableOff || !entry.stableBack);
  assert.deepEqual(unstable.map((entry) => entry.title), []);
});

test('every authored fixture pronounces each chain exactly once', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const offenders = [];
  const licensedMultiplePronunciationFixtures = new Set([
    'partialCopyMovementTree',
    'partialCopyDeletionTree',
    'resumptivePartialCopyDeletionTree',
    'resumptivePartialCopyRealizationTree'
  ]);

  fixtures.forEach((root, name) => {
    if (licensedMultiplePronunciationFixtures.has(name)) return;
    const families = new Map();
    const walk = (node_) => {
      const lineage = String(node_.lineageId || '').trim();
      if (lineage) families.set(lineage, [...(families.get(lineage) || []), node_]);
      (node_.children || []).forEach(walk);
    };
    walk(root);
    /*
     * An occurrence is pronounced when something under it is actually spoken.
     * A phrase whose terminals are all traces is not itself flagged silent in
     * this lab's convention — the traces carry that — so counting flags rather
     * than spoken material would call every trace-filled copy pronounced.
     */
    const speaks = (node_) => ((node_.children || []).length === 0
      ? node_.silent !== true && node_.label !== '∅'
      : (node_.children || []).some(speaks));
    /*
     * Only maximal occurrences count, and only when they say the same thing.
     * A lineage can legitimately tag a phrase and its own head, or link an affix
     * to the host it lowers onto — neither is two pronunciations of one phrase,
     * which is the thing that would be wrong.
     */
    const said = (node_) => ((node_.children || []).length === 0
      ? (speaks(node_) ? node_.word || node_.label : '')
      : (node_.children || []).map(said).filter(Boolean).join(' '));
    families.forEach((members, lineage) => {
      if (members.length < 2) return;
      const ids = new Set(members.map((member) => member.id));
      const contains = (node_, target) => (node_.children || [])
        .some((child) => child.id === target || contains(child, target));
      const maximal = members.filter((member) =>
        !members.some((other) => other !== member && contains(other, member.id) && ids.has(other.id)));
      const spoken = maximal.map(said).filter(Boolean);
      if (new Set(spoken).size < spoken.length) {
        offenders.push(`${name}:${lineage} pronounces ${JSON.stringify(spoken)}`);
      }
    });
  });
  assert.deepEqual(offenders, []);
});

test('no phrase or bar level in the lab stands in for a trace', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const PHRASES = /^(?:[A-Za-z#]+P|[A-Za-z#]+')$/;
  const offenders = [];

  fixtures.forEach((root, name) => {
    const check = (node_) => {
      /*
       * A trace is a terminal. A childless VP, V', DP or NP is a category
       * rendering as a `t` — which is how the remnant landing came to read as
       * if a head, not a phrase, had moved. Every phrase keeps its own
       * structure; only what its preterminals dominate goes silent.
       */
      if (PHRASES.test(node_.label) && (node_.children || []).length === 0) {
        offenders.push(`${name}:${node_.id} is a childless ${node_.label}`);
      }
      (node_.children || []).forEach(check);
    };
    check(root);
  });
  assert.deepEqual(offenders, []);
});

test('explicit trace notation stays authored and silent', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const offenders = [];

  /*
   * Most movement traces are derived from silence and lineage. When a source
   * convention explicitly requires `t`, it must still be a silent leaf under a
   * real preterminal; the shared index remains renderer-derived.
   */
  fixtures.forEach((root, name) => {
    const walk = (node_, parent = null) => {
      const traceWord = typeof node_.word === 'string'
        && /^t([₀-₉\d]+|NP|VP|DP|v)?$/.test(node_.word);
      if (traceWord && (node_.silent !== true || String(node_.label || '').endsWith('P'))) {
        offenders.push(`${name}:${node_.id} has a pronounced or phrasal trace surface`);
      }
      const isTraceLeaf = (node_.children || []).length === 0
        && /^t([₀-₉\d]+|NP|VP|DP|v)?$/.test(String(node_.label || ''));
      // The bare category 'P' is the preposition preterminal, not a phrase.
      const parentIsPhrasal = Boolean(parent)
        && parent.label !== 'P'
        && parent.label.endsWith('P');
      if (isTraceLeaf && (!parent || parentIsPhrasal || node_.silent !== true)) {
        offenders.push(`${name}:${node_.id} is not a silent trace leaf under a preterminal`);
      }
      (node_.children || []).forEach((child) => walk(child, node_));
    };
    walk(root);
  });
  assert.deepEqual(offenders, []);
});

test('no fixture uses a phrase label as a terminal', async () => {
  const source = await readFile(new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url), 'utf8');
  const fixtures = parseLabFixtures(source);
  const PHRASES = /^(?:[A-Za-z#]+P|[A-Za-z#]+')$/;
  const offenders = [];

  /*
   * A DP that carries a word directly skips the D it needs. The distinction
   * matters because the copy machinery hangs traces under preterminals; a
   * phrase used as a terminal has nowhere to put one.
   */
  fixtures.forEach((root, name) => {
    const walk = (node_) => {
      if (typeof node_.word === 'string' && PHRASES.test(node_.label)) {
        offenders.push(`${name}:${node_.id} is a ${node_.label} carrying "${node_.word}"`);
      }
      (node_.children || []).forEach(walk);
    };
    walk(root);
  });
  assert.deepEqual(offenders, []);
});

test('silence that an analysis displays is left alone; a raised head is not', async () => {
  const audit = JSON.parse(await readFile(new URL('measurements.json', FULL_AUDIT), 'utf8'));
  const words = (title) => audit.cards.find((card) => card.title === title).terminals;

  /*
   * Four analyses put unpronounced material on screen on purpose, and each
   * would be a different claim if the renderer replaced it with a trace: PRO is
   * a pronoun, a covert quantifier landing is the quantifier, an ellipsis site
   * is recoverable structure, and an identity card is about two occurrences
   * being the same rather than one having moved.
   */
  assert.ok(words('Control Dependency').includes('PRO'), 'PRO was turned into a trace');
  assert.ok(words('Control Dependency (object control)').includes('PRO'), 'PRO was turned into a trace');
  ['QR / Covert Scope', 'QR / Inverse Scope'].forEach((title) => {
    assert.equal(words(title).filter((word) => word === 'every').length, 2,
      `${title} lost a quantifier occurrence`);
  });
  assert.equal(words('Identity / Copy Chain (passive)').filter((word) => word === 'The').length, 2,
    'the identity card turned its lower copy into a trace');
  assert.ok(words('Ellipsis / Silent Structure').filter((word) => /^t[₀-₉\d]*$/.test(word)).length === 0,
    'the ellipsis site was replaced by traces');

  /*
   * A head that has raised is the other case: no analysis disputes the
   * occurrence it left, and printing the word twice reads as saying it twice.
   */
  assert.equal(words('Control Dependency (object control)').filter((word) => word === 'persuaded').length, 1,
    'the object-control card spells its verb twice');
});

test('quantifier raising co-indexes the two occurrences its plate co-indexes', async () => {
  const audit = JSON.parse(await readFile(new URL('measurements.json', FULL_AUDIT), 'utf8'));

  /*
   * The controlling plate writes QR as `[every book]ᵢ [TP … tᵢ]`: a covert path
   * plus a shared subscript. The path alone shows a quantifier phrase in two
   * places and leaves the reader to infer they are one; the index is what says
   * so. Three QR cards, three different trees and scope domains, all indexed
   * from the relation's own anchors rather than from any one card's ids.
   */
  ['QR / Covert Scope', 'QR / Inverse Scope', 'QR / Clause-Bounded Scope'].forEach((title) => {
    const card = audit.cards.find((entry) => entry.title === title);
    assert.ok(card, `${title} was not measured`);
    assert.equal(card.marks.coindex, 2, `${title} does not co-index its two quantifier occurrences`);
  });

  // The device is shared with coreference, and neither borrowed the other's arrow.
  assert.equal(audit.cards.find((entry) => entry.title === 'Plain Coreference').marks.coindex, 2);
  assert.equal(audit.cards.find((entry) => entry.title === 'Plain Coreference').marks.trajectory, 0,
    'the coreference card borrowed a movement arrow');
});

test('the two remnant operations are dispatched to different relation families', () => {
  /*
   * The evacuation is ordinary phrasal movement of a DP and the fronting is
   * remnant movement. Drawing both with the remnant's bracket and box would say
   * they are the same kind of operation, which is the one thing the derivation
   * exists to distinguish. Dispatch is by exact relation name.
   */
  assert.equal(trajectoryKindForRelation('Scrambling'), 'phrasal');
  assert.equal(trajectoryKindForRelation('RemnantMovement'), 'remnant');
  assert.equal(trajectoryIsOrthogonal('phrasal'), false, 'the ordinary family took the bracket');
  assert.equal(trajectoryIsOrthogonal('remnant'), true);
  // Both still meet phrase shells and both still need a witness.
  ['phrasal', 'remnant'].forEach((kind) => {
    assert.equal(trajectoryMeetsPhraseShell(kind), true);
    assert.equal(trajectoryRequiresWitness(kind), true);
  });
});

test('the remnant card draws one curve and one bracket, and the bracket stays outside the box', async () => {
  const evidence = JSON.parse(await readFile(new URL('rebuild-evidence.json', NEW_CARDS), 'utf8'));
  const remnant = evidence.find((entry) => entry.title === 'Remnant Movement');
  assert.deepEqual(remnant.paths.map((path) => path.rel), ['Scrambling', 'RemnantMovement']);
  const [scrambling, fronting] = remnant.paths;

  // The ordinary movement is a curve; the remnant movement is axis-aligned.
  assert.match(scrambling.d, /C /, 'the evacuation is not drawn as an ordinary phrasal curve');
  assert.doesNotMatch(scrambling.d, / L /, 'the evacuation borrowed the remnant bracket');
  assert.doesNotMatch(fronting.d, /C /, 'the remnant movement is not the source-faithful bracket');
  const corners = fronting.d.match(/[-\d.]+ [-\d.]+/g).map((pair) => {
    const [x, y] = pair.split(' ').map(Number);
    return { x, y };
  });
  corners.slice(1).forEach((point, index) => {
    const previous = corners[index];
    assert.ok(point.x === previous.x || point.y === previous.y, 'the remnant bracket has a diagonal leg');
  });

  /*
   * The arrowhead meets the outside of the enclosure. An arrow that entered the
   * box would run behind the words it is pointing at, and the box would no
   * longer read as the thing that arrived.
   */
  const [box] = remnant.enclosures;
  const [left, top, width, height] = box.rect;
  const tip = corners[corners.length - 1];
  assert.ok(tip.x > left && tip.x < left + width, 'the arrowhead is not under the enclosure');
  assert.ok(tip.y > top + height && tip.y - (top + height) < 12,
    `the arrowhead is ${(tip.y - (top + height)).toFixed(1)} from the enclosure boundary`);

  // And no point of the bracket is inside the box.
  const samples = [];
  corners.slice(1).forEach((point, index) => {
    const previous = corners[index];
    for (let step = 0; step <= 40; step += 1) {
      samples.push({
        x: previous.x + ((point.x - previous.x) * step) / 40,
        y: previous.y + ((point.y - previous.y) * step) / 40
      });
    }
  });
  const inside = samples.filter((point) => point.x > left && point.x < left + width
    && point.y > top && point.y < top + height);
  assert.deepEqual(inside, [], 'the remnant bracket crosses the interior of the landing box');

  // Only the remnant movement is boxed; the evacuation gets no enclosure.
  assert.deepEqual(remnant.enclosures.map((entry) => entry.licence), ['remnant-landing']);
});

test('the design registry does not claim the two remnant operations share a drawing', () => {
  const design = (key) => ACTIVE_VISUAL_DESIGNS[key].relations;

  /*
   * The registry is the written record of which relations share a mark, so it
   * has to agree with what is drawn. Scrambling is ordinary phrasal movement;
   * saying it shares the bracket or the enclosure would restate, in metadata,
   * the confusion the card was corrected to remove.
   */
  assert.ok(design('phrasalTrajectory').includes('Scrambling'),
    'the evacuation is not registered as ordinary phrasal movement');
  assert.ok(!design('phrasalTrajectory').includes('RemnantMovement'),
    'remnant movement is registered as an ordinary phrasal trajectory');
  assert.ok(design('orthogonalBracket').includes('RemnantMovement'));
  assert.ok(!design('orthogonalBracket').includes('Scrambling'),
    'the evacuation is registered as taking the remnant bracket');
  assert.ok(!design('constituentEnclosure').includes('Scrambling'),
    'the evacuation is registered as taking an enclosure');

  // Every registered relation dispatches to the family its entry claims.
  design('phrasalTrajectory').forEach((relation) =>
    assert.equal(trajectoryKindForRelation(relation), relation === 'HeadMove' ? 'head' : 'phrasal',
      `${relation} does not draw as an ordinary phrasal trajectory`));
  design('orthogonalBracket').forEach((relation) =>
    assert.equal(trajectoryIsOrthogonal(trajectoryKindForRelation(relation)), true,
      `${relation} is registered on the bracket but does not draw one`));

  // No relation appears in both the curve family and the bracket family.
  const shared = design('phrasalTrajectory').filter((relation) => design('orthogonalBracket').includes(relation));
  assert.deepEqual(shared, [], 'a relation is registered as drawn two different ways');
});

test('the audit row reports the counts the lab actually renders', async () => {
  const audit = JSON.parse(await readFile(new URL('measurements.json', FULL_AUDIT), 'utf8'));
  const matrix = await readFile(new URL('audit-matrix.md', FULL_AUDIT), 'utf8');

  /*
   * The receipt is only worth anything if its numbers come from the render.
   * Every row's structural inventory is checked against the measurement it
   * claims to describe, so a hand-edited or stale count fails here.
   */
  audit.cards.forEach((card) => {
    const row = matrix.split('\n').find((line) => line.startsWith(`| `) && line.split(' | ')[1] === card.title);
    assert.ok(row, `${card.title} has no audit row`);
    assert.ok(row.includes(`${card.nodes} nodes / ${card.branches} branches`),
      `${card.title}: the audit row does not report ${card.nodes}/${card.branches}`);
    const traces = card.terminals.filter((word) => /^t[₀-₉\d]*$/.test(word));
    if (traces.length) {
      assert.ok(row.includes(`${traces.length} trace displays`),
        `${card.title}: the audit row does not report ${traces.length} traces`);
    }
  });

  // And the remnant row states the two-family split rather than a shared mark.
  const remnantRow = matrix.split('\n').find((line) => line.split(' | ')[1] === 'Remnant Movement');
  assert.match(remnantRow, /6 trace displays \(2× t₁ \+ 4× t₂\)/);
  assert.match(remnantRow, /evacuation is ordinary DP phrasal movement, drawn as a curve/);
  assert.doesNotMatch(remnantRow, /same overlay kinds/);
});

/*
 * Large authored anchor arrays: the deterministic Lab layout policy.
 *
 * The policy is general and name-agnostic — it keys on array size, never on
 * what a relation name looks like — and it never truncates, samples a first
 * element, or overwrites an earlier mark. Unresolved anchors fail closed with
 * a contract diagnostic instead of being given a guessed endpoint.
 */

const chainNodeIds = ['occ_1', 'occ_2', 'occ_3', 'occ_4', 'occ_5', 'occ_6', 'occ_7', 'occ_8'];
const largeChainTree = {
  id: 'cp_large_chain',
  label: 'CP',
  children: chainNodeIds.map((id, index) => ({
    id,
    label: 'DP',
    lineageId: 'large-chain',
    ...(index > 0 ? { silent: true } : {}),
    children: [{
      id: `${id}_d`,
      label: 'D',
      ...(index === 0 ? { word: 'which' } : { silent: true }),
      lineageId: 'large-chain-d'
    }]
  }))
};

const largeChainStage = (relations) => [{
  statement: 'A deep chain is authored.',
  stageRecord: 'Identity relates every occurrence of the chain.',
  relations,
  workspaceForest: [largeChainTree]
}];

test('a large chain anchor family compiles every occurrence in authored order', () => {
  const { sets, diagnostics } = compileLargeAnchorSets(
    largeChainStage([{ relation: 'Identity', anchors: { occurrences: chainNodeIds } }]),
    largeChainTree
  );
  assert.equal(diagnostics.length, 0);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].relation, 'Identity');
  assert.equal(sets[0].stageIndex, 0);
  assert.equal(sets[0].relationIndex, 0);
  assert.equal(sets[0].instanceIndex, 0);
  const role = sets[0].roles.find((entry) => entry.role === 'occurrences');
  assert.ok(role.large);
  assert.deepEqual(role.anchors.map((anchor) => anchor.nodeId), chainNodeIds);
  assert.deepEqual(role.anchors.map((anchor) => anchor.arrayIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(role.anchors.every((anchor) => anchor.resolved));
});

test('repeated instances of one relation in one stage each keep their own ordered set', () => {
  const firstHalf = chainNodeIds.slice(0, 5);
  const secondHalf = chainNodeIds.slice(3);
  const { sets } = compileLargeAnchorSets(
    largeChainStage([
      { relation: 'Identity', anchors: { occurrences: firstHalf } },
      { relation: 'Identity', anchors: { occurrences: secondHalf } }
    ]),
    largeChainTree
  );
  assert.equal(sets.length, 2);
  assert.deepEqual(sets.map((set) => set.relationIndex), [0, 1]);
  assert.deepEqual(sets.map((set) => set.instanceIndex), [0, 1]);
  assert.deepEqual(sets[0].roles[0].anchors.map((anchor) => anchor.nodeId), firstHalf);
  assert.deepEqual(sets[1].roles[0].anchors.map((anchor) => anchor.nodeId), secondHalf);
});

const multiParentTree = {
  id: 'root_multi_parent',
  label: 'CoordP',
  children: [
    ...['vp_mp_1', 'vp_mp_2', 'vp_mp_3', 'vp_mp_4', 'vp_mp_5', 'vp_mp_6'].map((id) => ({
      id,
      label: 'VP',
      children: [{ id: `${id}_v`, label: 'V', word: 'share' }]
    })),
    { id: 'dp_shared_mp', label: 'DP', children: [{ id: 'd_shared_mp', label: 'D', word: 'it' }] }
  ]
};

const multiParentStage = (relations) => [{
  statement: 'Six parents share one object.',
  stageRecord: 'Multidominance relates the shared object to each parent.',
  relations,
  workspaceForest: [multiParentTree]
}];

test('a large multi-parent family preserves role grouping and every parent anchor', () => {
  const parents = ['vp_mp_1', 'vp_mp_2', 'vp_mp_3', 'vp_mp_4', 'vp_mp_5', 'vp_mp_6'];
  const { sets, diagnostics } = compileLargeAnchorSets(
    multiParentStage([{
      relation: 'Multidominance',
      anchors: { parents, shared: 'dp_shared_mp' }
    }]),
    multiParentTree
  );
  assert.equal(diagnostics.length, 0);
  assert.equal(sets.length, 1);
  // Role order follows the authored anchors object; the scalar role is carried
  // as context but only the large array is marked large.
  assert.deepEqual(sets[0].roles.map((role) => role.role), ['parents', 'shared']);
  assert.deepEqual(sets[0].roles.map((role) => role.large), [true, false]);
  assert.deepEqual(sets[0].roles[0].anchors.map((anchor) => anchor.nodeId), parents);
});

test('an unresolved anchor in a large array fails closed with a diagnostic, never a guess', () => {
  const parents = ['vp_mp_1', 'vp_mp_2', 'vp_mp_missing', 'vp_mp_4', 'vp_mp_5', 'vp_mp_6'];
  const stages = multiParentStage([{
    relation: 'Multidominance',
    anchors: { parents, shared: 'dp_shared_mp' }
  }]);
  const { sets, diagnostics } = compileLargeAnchorSets(stages, multiParentTree);
  const anchors = sets[0].roles[0].anchors;
  // Nothing is dropped: the unresolved anchor stays in the plan, marked.
  assert.equal(anchors.length, 6);
  assert.deepEqual(anchors.map((anchor) => anchor.resolved), [true, true, false, true, true, true]);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0], /vp_mp_missing/);
  assert.match(diagnostics[0], /fails closed/);

  // The hydrated lens surfaces the same diagnostic and carries the plan.
  const lens = hydrateLabLensFromCurrentContract(stages, multiParentTree, { label: 'x', nodes: [] });
  assert.equal(lens.anchorSets.length, 1);
  assert.ok(lens.diagnostics.some((note) => /vp_mp_missing/.test(note) && /fails closed/.test(note)));

  // And the geometry planner refuses to place it rather than inventing a rect.
  const rects = new Map(
    ['vp_mp_1', 'vp_mp_2', 'vp_mp_4', 'vp_mp_5', 'vp_mp_6']
      .map((id, index) => [id, { x: index * 100, y: 40, width: 60, height: 20 }])
  );
  const plan = planAnchorSetLayout(lens.anchorSets, (nodeId) => rects.get(nodeId) || null, {});
  assert.equal(plan.badges.length, 5);
  assert.equal(plan.failed.length, 1);
  assert.equal(plan.failed[0].nodeId, 'vp_mp_missing');
  assert.match(plan.failed[0].reason, /fails closed/);
});

test('arrays below the threshold never activate the policy', () => {
  const parents = ['vp_mp_1', 'vp_mp_2', 'vp_mp_3', 'vp_mp_4'];
  assert.ok(parents.length < LARGE_ANCHOR_ARRAY_THRESHOLD);
  const { sets } = compileLargeAnchorSets(
    multiParentStage([{ relation: 'Multidominance', anchors: { parents, shared: 'dp_shared_mp' } }]),
    multiParentTree
  );
  assert.equal(sets.length, 0);
});

test('an open relation with a large array gets ordered marks but no semantic connector', () => {
  const stages = largeChainStage([{
    relation: 'CompletelyOpenRelation',
    anchors: { members: chainNodeIds }
  }]);
  const lens = hydrateLabLensFromCurrentContract(stages, largeChainTree, { label: 'x', nodes: [] });
  assert.equal(lens.anchorSets.length, 1);
  assert.deepEqual(
    lens.anchorSets[0].roles[0].anchors.map((anchor) => anchor.nodeId),
    chainNodeIds
  );
  // No semantic drawing is invented for the open name: no trajectory, no lf
  // path, no agreement path — the array's size licenses organization only.
  assert.equal(lens.trajectory, undefined);
  assert.equal(lens.lf, undefined);
  assert.equal(lens.agreementPaths, undefined);
  const plan = planAnchorSetLayout(
    lens.anchorSets,
    (nodeId) => ({ x: chainNodeIds.indexOf(nodeId) * 80, y: 10, width: 50, height: 18 }),
    {}
  );
  // Rails and badges carry no direction: the plan has no arrow field at all.
  plan.rails.forEach((rail) => assert.deepEqual(
    Object.keys(rail).sort(),
    ['lane', 'role', 'setIndex', 'x1', 'x2']
  ));
});

test('the Phillips island path arrays stay with their sourced design, not the general plan', () => {
  const pathTree = {
    id: 'cp_pg_paths',
    label: 'CP',
    children: ['a_pg', 'b_pg', 'c_pg', 'd_pg', 'e_pg', 'f_pg', 'g_pg'].map((id) => ({
      id,
      label: 'XP',
      children: [{ id: `${id}_head`, label: 'X', word: 'x' }]
    }))
  };
  const { sets } = compileLargeAnchorSets([{
    statement: 'Paths.',
    stageRecord: 'ParasiticGap paths.',
    relations: [{
      relation: 'ParasiticGap',
      anchors: {
        primaryPath: ['a_pg', 'b_pg', 'c_pg', 'd_pg', 'e_pg', 'f_pg', 'g_pg'],
        secondaryPath: ['a_pg', 'b_pg', 'c_pg', 'd_pg', 'e_pg']
      }
    }],
    workspaceForest: [pathTree]
  }], pathTree);
  assert.equal(sets.length, 0);
});

test('span lanes are deterministic and reuse a lane only when spans cannot collide', () => {
  const spans = [
    { start: 0, end: 100 },
    { start: 40, end: 160 },
    { start: 120, end: 220 },
    { start: 300, end: 400 },
    { start: 90, end: 130 }
  ];
  const lanes = allocateSpanLanes(spans, 10);
  // First-fit in the caller's order: overlapping spans take new lanes — the
  // third span's padded extent still touches the first's, so it may not share
  // its lane — the far-right span reuses lane 0, and the last span collides
  // with every earlier lane's occupant.
  assert.deepEqual(lanes, [0, 1, 2, 0, 3]);
  // Determinism: the same input always yields the same allocation.
  assert.deepEqual(allocateSpanLanes(spans, 10), lanes);
});

test('the anchor-set planner stacks same-node marks deterministically and never overwrites', () => {
  const sets = [
    {
      relation: 'Identity',
      instanceIndex: 0,
      roles: [{
        role: 'occurrences',
        large: true,
        anchors: [
          { nodeId: 'shared_node', arrayIndex: 0, resolved: true },
          { nodeId: 'other_node', arrayIndex: 1, resolved: true }
        ]
      }]
    },
    {
      relation: 'Identity',
      instanceIndex: 1,
      roles: [{
        role: 'occurrences',
        large: true,
        anchors: [
          { nodeId: 'shared_node', arrayIndex: 0, resolved: true },
          { nodeId: 'third_node', arrayIndex: 1, resolved: true }
        ]
      }]
    }
  ];
  const rects = {
    shared_node: { x: 0, y: 0, width: 40, height: 16 },
    other_node: { x: 100, y: 0, width: 40, height: 16 },
    third_node: { x: 200, y: 0, width: 40, height: 16 }
  };
  const plan = planAnchorSetLayout(sets, (nodeId) => rects[nodeId] || null, { badgeOffsetY: 10 });
  assert.equal(plan.badges.length, 4, 'every resolved anchor is placed');
  const sharedBadges = plan.badges.filter((badge) => badge.nodeId === 'shared_node');
  assert.deepEqual(sharedBadges.map((badge) => badge.stackIndex), [0, 1]);
  assert.ok(sharedBadges[1].y > sharedBadges[0].y, 'stacked marks do not overwrite each other');
  // Geometry derives from the real rects the caller measured.
  assert.equal(plan.badges.find((badge) => badge.nodeId === 'other_node').x, 120);
  // Two same-role rails from two instances span their own anchors.
  assert.equal(plan.rails.length, 2);
});
