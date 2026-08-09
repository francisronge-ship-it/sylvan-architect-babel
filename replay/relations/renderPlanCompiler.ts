/**
 * Production render-plan compiler for authored visual relations.
 *
 * React-free and geometry-free: `DerivationStage[]` in, a typed
 * `RelationRenderPlan` out. Every relation instance dispatches through
 * the exact-identity production registry; registered entries compile to their
 * accepted finite render families, unregistered names take the accepted
 * topology-only fallback. Anchors resolve against the relation's own stage
 * forest; `priorAnchors` resolve only against the immediately preceding
 * authored stage. Anything that does not resolve fails closed with a
 * diagnostic — no substitute endpoint is ever chosen.
 *
 * Appearance and persistence: an item first appears at its authored stage and
 * never leaks backward. Registered families carry exact per-design
 * persistence metadata. An unregistered fallback persists from introduction
 * onward: making an unknown authored claim disappear would itself invent
 * semantics. Large-anchor organization inherits its parent instance's
 * persistence.
 *
 * Composition: every instance compiles (no first-instance sampling), ordering
 * is deterministic (layer order, then stage, then authored relation index).
 * There is no semantic conflict suppression: marks identical in every
 * semantic respect coalesce with all contributing instances retained in
 * `coalescedRefs`; distinct authored claims all survive and the geometry
 * binder routes them apart. Babel never judges two authored claims
 * incompatible merely because they share a visual channel.
 */
import type {
  DerivationStage,
  DerivationStageRelation,
  SyntaxNode
} from '../../types.ts';
import {
  dispatchRelation,
  findRelationRegistryEntry,
  productionRelationRegistry
} from '../relationDispatch/index.js';
import { fallbackDrawing, type FallbackDrawing } from './fallbackTopology.ts';
import {
  LARGE_ANCHOR_ARRAY_THRESHOLD,
  compileLargeAnchorSets,
  type LargeAnchorSet
} from './largeAnchorSets.ts';
import {
  FULL_ARRAY_OWNED_ROLES,
  PRODUCTION_RENDER_FAMILIES,
  TRAJECTORY_SOURCE_ROLES,
  TRAJECTORY_TARGET_ROLES,
  TRAJECTORY_WITNESS_ROLES,
  WITNESS_REQUIRED_TRAJECTORY_KINDS,
  type ProductionRenderFamily,
  type RenderPersistence
} from './renderFamilies.ts';

export type PlanRelationRef = {
  stageIndex: number;
  relationIndex: number;
  relation: string;
  anchors: Record<string, string | string[]>;
  priorAnchors?: Record<string, string | string[]>;
  values?: Record<string, string | string[]>;
};

export type PlanDiagnostic = {
  stageIndex: number;
  relationIndex: number;
  relation: string;
  kind:
    | 'anchor-unresolved'
    | 'prior-anchor-unresolved'
    | 'prior-anchor-without-prior-stage'
    | 'witness-missing'
    | 'witness-outside-source'
    | 'signature-incomplete'
    | 'endpoint-missing'
    | 'illegal-configuration'
    | 'value-unrecognized'
    | 'large-array-anchor-unresolved'
    | 'ambiguous-package-ownership'
    | 'anchor-vanished';
  detail: string;
};

type PlanItemBase = {
  relationRef: PlanRelationRef;
  /** Registry entry id; absent only on fallback and anchor-set items. */
  familyId?: string;
  appearsAtStage: number;
  persistence: RenderPersistence;
  /** Replacement grouping key for replace-previous-instance families. */
  replacementGroup?: string;
  /**
   * The thread key of the earlier state this instance authored itself as
   * continuing (via `priorAnchors`); proves replacement across differing
   * participant sets.
   */
  replacementPredecessorGroup?: string;
  /** True when the instance authors resolved previous-stage witnesses. */
  backward: boolean;
  /** Resolved previous-stage witness node ids, in authored order. */
  priorWitnessNodeIds: string[];
  /**
   * Fields whose contents are SUBTREE SNAPSHOTS derived from an anchored
   * root — presentation geometry, not authored dependencies. Persistence
   * refreshes each declared field from the CURRENT frame's exact root at
   * materialization (never lineage retargeting), and the dependency law
   * excludes exactly these declared fields. Direct authored arrays (e.g.
   * Improper Movement's forbiddenRegion, Right Roof's compact roof,
   * Transfer's edge) carry NO declaration and stay hard dependencies.
   */
  subtreeDerived?: Array<{ field: string; rootNodeId: string; mode: 'all' | 'authored-silent' }>;
  /**
   * Relation instances whose identical mark was visually coalesced into this
   * one. Every contributing authored instance is retained here — coalescing
   * merges pixels, never provenance.
   */
  coalescedRefs?: PlanRelationRef[];
};

/**
 * Endpoint attachment, explicit in the semantic plan: `terminal` endpoints
 * resolve to the visible materialized terminal inside the exact anchored
 * preterminal or witness subtree; `shell` endpoints resolve to the anchored
 * node itself. Head-sized trajectories run terminal-to-terminal;
 * phrase-sized trajectories run trace-terminal-to-phrase-shell.
 */
export type TrajectoryEndpointAttachment = 'terminal' | 'shell';

export type TrajectoryPlanItem = PlanItemBase & {
  kind: 'trajectory';
  trajectoryKind: NonNullable<ProductionRenderFamily['trajectoryKind']>;
  sourceNodeId: string;
  targetNodeId: string;
  witnessNodeId?: string;
  sourceAttachment: TrajectoryEndpointAttachment;
  targetAttachment: TrajectoryEndpointAttachment;
};

export type CoindexPlanItem = PlanItemBase & {
  kind: 'coindex';
  nodeIds: string[];
  index: string;
};

export type BindingDomainPlanItem = PlanItemBase & {
  kind: 'binding-domain';
  binderNodeId: string;
  boundNodeId: string;
  domainNodeId: string;
  domainMemberNodeIds: string[];
  /** Authored judgment only; absent when the model authored none. */
  outcome?: 'licensed' | 'failed';
  index: string;
};

export type EllipsisSitePlanItem = PlanItemBase & {
  kind: 'ellipsis-site';
  siteNodeId: string;
  antecedentNodeId?: string;
  /** Only material the model authored silent ghosts. */
  ghostNodeIds: string[];
  /** The whole site subtree, for domain-region marks like the tall slash. */
  siteSubtreeNodeIds: string[];
};

export type DirectedPathStyle =
  | 'control'
  | 'agree-multiple'
  | 'agree-cyclic'
  | 'case-assignment'
  | 'case-agree'
  | 'dependent-case'
  | 'accord'
  | 'anti-locality'
  | 'blocked-access'
  | 'blocked-extraction'
  | 'intervention'
  | 'f-projection'
  | 'ellipsis-checking'
  | 'right-roof'
  | 'improper-candidate'
  | 'covert-qr';

export type DirectedPathPlanItem = PlanItemBase & {
  kind: 'directed-path';
  fromNodeId: string;
  toNodeId: string;
  pathStyle: DirectedPathStyle;
  label?: string;
  secondaryLabel?: string;
  outcome?: 'licensed' | 'blocked';
};

export type UndirectedLinkStyle =
  | 'predication'
  | 'feature-sharing'
  | 'pair-merge'
  | 'strong-npi'
  | 'gapping-pair';

export type UndirectedLinkPlanItem = PlanItemBase & {
  kind: 'undirected-link';
  pairs: Array<{ fromNodeId: string; toNodeId: string; label?: string }>;
  linkStyle: UndirectedLinkStyle;
  label?: string;
};

export type DomainMarkStyle =
  | 'phase'
  | 'transfer-edge'
  | 'adjunct-domain'
  | 'idiom'
  | 'forbidden-region'
  | 'scope'
  | 'argument-domain'
  | 'right-roof'
  | 'control-domain';

/** Fong's Transfer/PIC tilted component arc around one component head. */
export type FongComponentPlanItem = PlanItemBase & {
  kind: 'fong-component';
  headNodeId: string;
  componentLabel: 'Phase' | 'SOD';
};

/** The blocked post-Transfer access attempt: dashed lane under the domain. */
export type BlockedAccessLanePlanItem = PlanItemBase & {
  kind: 'blocked-access-lane';
  sourceNodeId: string;
  targetNodeId: string;
  domainMemberNodeIds: string[];
};

/** Phillips island path-status: path-following circles/squares plus the
 * double-slashed blocked edge. */
export type PathStatusPlanItem = PlanItemBase & {
  kind: 'path-status';
  primaryNodeIds: string[];
  secondaryNodeIds: string[];
  blockedEdgeNodeId?: string;
  /** Authored judgment only; absent when the model authored none. */
  outcome?: 'licensed' | 'blocked';
};

export type DomainMarkPlanItem = PlanItemBase & {
  kind: 'domain-mark';
  rootNodeId?: string;
  memberNodeIds: string[];
  domainStyle: DomainMarkStyle;
  label?: string;
  outcome?: 'licensed' | 'blocked';
};

export type NodePlaqueStyle =
  | 'feature'
  | 'realization'
  | 'correspondence'
  | 'cooper-storage'
  | 'linearization'
  | 'dislocation-lane'
  | 'theta-grid'
  | 'fission'
  | 'impoverishment'
  | 'spellout-label'
  | 'ellipsis-licensing';

export type NodePlaquePlanItem = PlanItemBase & {
  kind: 'node-plaque';
  anchorNodeIds: string[];
  plaqueStyle: NodePlaqueStyle;
  title?: string;
  rows: Array<{ label: string; value: string }>;
};

export type NodeBadgeStyle =
  | 'gap-notation'
  | 'path-status'
  | 'split-antecedence'
  | 'shared-object'
  | 'idiom-chunk'
  | 'boundary-cut'
  | 'improper-hosts'
  | 'phase-edge'
  | 'theta-role'
  | 'intervener'
  | 'facilitator'
  | 'gapping-ordinal';

export type NodeBadgesPlanItem = PlanItemBase & {
  kind: 'node-badges';
  badges: Array<{ nodeId: string; text: string; shape: 'circle' | 'square' | 'plain' }>;
  badgeStyle: NodeBadgeStyle;
  outcome?: 'licensed' | 'blocked';
};

export type StrikeGhostPlanItem = PlanItemBase & {
  kind: 'strike-ghost';
  strikeNodeIds: string[];
  ghostNodeIds: string[];
};

export type EnclosurePlanItem = PlanItemBase & {
  kind: 'enclosure';
  nodeId: string;
  licence: 'remnant-landing' | 'carrier-chunk' | 'copy-occurrence';
};

export type BranchEmphasisPlanItem = PlanItemBase & {
  kind: 'branch-emphasis';
  strongEdges: Array<{ fromNodeId: string; toNodeId: string }>;
  weakEdges: Array<{ fromNodeId: string; toNodeId: string }>;
};

export type SharedNodePlanItem = PlanItemBase & {
  kind: 'shared-node';
  parentNodeIds: string[];
  sharedNodeId: string;
};

export type FallbackPlanItem = PlanItemBase & {
  kind: 'fallback';
  drawing: FallbackDrawing;
};

export type AnchorSetPlanItem = PlanItemBase & {
  kind: 'anchor-set';
  set: LargeAnchorSet;
  /** Fallback already numbers its own witnesses; in that case add only the rail. */
  showBadges: boolean;
  badgeSize: 'standard' | 'compact';
};

export type RelationPlanItem =
  | TrajectoryPlanItem
  | CoindexPlanItem
  | BindingDomainPlanItem
  | EllipsisSitePlanItem
  | DirectedPathPlanItem
  | UndirectedLinkPlanItem
  | DomainMarkPlanItem
  | FongComponentPlanItem
  | BlockedAccessLanePlanItem
  | PathStatusPlanItem
  | NodePlaquePlanItem
  | NodeBadgesPlanItem
  | StrikeGhostPlanItem
  | EnclosurePlanItem
  | BranchEmphasisPlanItem
  | SharedNodePlanItem
  | FallbackPlanItem
  | AnchorSetPlanItem;

export type RelationRenderPlan = {
  planVersion: 1;
  registryId: string;
  registryVersion: string;
  stageCount: number;
  /** One frame per derivation stage; items in deterministic layer order. */
  frames: Array<{ stageIndex: number; items: RelationPlanItem[] }>;
  diagnostics: PlanDiagnostic[];
  unregistered: Array<{ relation: string; count: number }>;
};

/** Deterministic layer order: lower draws first (further back). */
const LAYER_ORDER: Record<RelationPlanItem['kind'], number> = {
  'domain-mark': 0,
  'binding-domain': 1,
  'ellipsis-site': 2,
  enclosure: 3,
  'strike-ghost': 4,
  'branch-emphasis': 5,
  'shared-node': 6,
  'path-status': 7,
  trajectory: 8,
  'fong-component': 9,
  'blocked-access-lane': 10,
  'directed-path': 11,
  'undirected-link': 12,
  coindex: 13,
  'node-badges': 14,
  'node-plaque': 15,
  fallback: 16,
  'anchor-set': 17
};

const flattenAnchorIds = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : [value])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const collectForest = (forest: SyntaxNode[] | undefined): Map<string, SyntaxNode> => {
  const nodes = new Map<string, SyntaxNode>();
  const walk = (node: SyntaxNode) => {
    const id = String(node.id || '').trim();
    if (id) nodes.set(id, node);
    (Array.isArray(node.children) ? node.children : []).forEach(walk);
  };
  (Array.isArray(forest) ? forest : []).forEach(walk);
  return nodes;
};

/**
 * Only material the model itself authored as silent may take silence/ghost
 * styling. An ellipsis relation styles the already-authored silent
 * occurrence; it never makes an overt subtree silent.
 */
const collectAuthoredSilentSubtreeIds = (node?: SyntaxNode): string[] => {
  if (!node) return [];
  const ids: string[] = [];
  const walk = (current: SyntaxNode) => {
    const id = String(current.id || '').trim();
    if (id && current.silent === true) ids.push(id);
    (Array.isArray(current.children) ? current.children : []).forEach(walk);
  };
  walk(node);
  return ids;
};

const collectSubtreeIds = (node?: SyntaxNode): string[] => {
  if (!node) return [];
  const ids: string[] = [];
  const walk = (current: SyntaxNode) => {
    const id = String(current.id || '').trim();
    if (id) ids.push(id);
    (Array.isArray(current.children) ? current.children : []).forEach(walk);
  };
  walk(node);
  return ids;
};

const firstRole = (
  anchors: Record<string, string | string[]>,
  roles: readonly string[]
): { role: string; nodeId: string } | null => {
  for (const role of roles) {
    const ids = flattenAnchorIds(anchors?.[role]);
    if (ids.length > 0) return { role, nodeId: ids[0] };
  }
  return null;
};

const scalarValue = (
  values: Record<string, string | string[]> | undefined,
  key: string,
  fallback = ''
): string => {
  const value = values?.[key];
  return String(Array.isArray(value) ? value[0] || fallback : value || fallback);
};

const listValue = (
  values: Record<string, string | string[]> | undefined,
  key: string
): string[] => {
  const value = values?.[key];
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

/** Verbatim `values` rows in authored order. Literals are never parsed. */
const verbatimRows = (
  values: Record<string, string | string[]> | undefined
): Array<{ label: string; value: string }> =>
  Object.entries(values || {}).flatMap(([label, value]) =>
    (Array.isArray(value) ? value : [value]).map((entryValue) => ({
      label,
      value: String(entryValue ?? '')
    })));

/**
 * Lowering head/phrase split by anchored topology and authored roles, never a
 * category-name pattern.
 */
const loweringIsPhraseSized = (
  relation: DerivationStageRelation,
  nodes: Map<string, SyntaxNode>,
  sourceNodeId: string,
  targetNodeId: string
): boolean => {
  const dominatesInternalStructure = (nodeId: string): boolean => {
    const anchorNode = nodes.get(nodeId);
    return Boolean(anchorNode) && (anchorNode?.children || [])
      .some((child) => Array.isArray(child.children) && child.children.length > 0);
  };
  const authorsPhrasalRoles = ['lowerCopy', 'pronouncedCopy', 'landing']
    .some((role) => relation.anchors?.[role] !== undefined)
    || TRAJECTORY_WITNESS_ROLES.some((role) => relation.anchors?.[role] !== undefined);
  return authorsPhrasalRoles
    || dominatesInternalStructure(sourceNodeId)
    || dominatesInternalStructure(targetNodeId);
};

/**
 * Read an authored outcome value, recognizing only the exact supported
 * spellings. An unknown or missing value yields undefined — never the
 * opposite judgment — and unknown non-empty values are reported by the
 * caller as `value-unrecognized`.
 */
const recognizedOutcome = <T extends string>(
  raw: string,
  recognized: readonly T[]
): T | undefined => (recognized as readonly string[]).includes(raw) ? raw as T : undefined;

export type CompilePlanOptions = {
  registry?: typeof productionRelationRegistry;
  families?: Record<string, ProductionRenderFamily>;
};

  /**
 * The single dependency law shared by compiler persistence and geometry
 * binding: every node id the item's complete authored claim requires.
 * A mark's persistence is validated against the node ids THAT MARK
 * actually depends on, never the relation's complete authored anchor set:
 * an extra open role vanishing must not veto a valid specialized core.
 * What counts as derived is DECLARED PER ITEM via `subtreeDerived` —
 * never inferred from a field's name: an Improper Movement forbidden
 * region stores authored members in the same field a Phase arc stores a
 * subtree snapshot in, and only the item knows which it holds. Prior
 * witnesses are provenance for the backward cue, resolved against the
 * PRECEDING stage, and are never current-frame dependencies.
 */
export const planItemDependencyNodeIds = (item: RelationPlanItem): string[] => {
  const ids = new Set<string>();
  const derivedFields = new Set(
    (item.subtreeDerived || []).map((declaration) => declaration.field)
  );
  /*
   * Every refresh ROOT is itself a hard current-frame dependency: the
   * derived field contents and the declaration metadata are excluded from
   * walking, but the anchored root the geometry derives from must exist
   * in every frame the mark draws in — and it is not guaranteed to be
   * duplicated in another `*NodeId` field (blocked-access lanes carry
   * their transfer domain only here).
   */
  (item.subtreeDerived || []).forEach((declaration) => {
    const rootNodeId = String(declaration.rootNodeId || '').trim();
    if (rootNodeId) ids.add(rootNodeId);
  });
  const walk = (value: unknown, key: string) => {
    if (
      key === 'relationRef'
      || key === 'coalescedRefs'
      || key === 'subtreeDerived'
      || key === 'priorWitnessNodeIds'
      || derivedFields.has(key)
    ) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, key));
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) =>
        walk(childValue, childKey));
      return;
    }
    if (typeof value === 'string' && value && (/nodeids?$/i.test(key) || key === 'witness')) {
      ids.add(value);
    }
  };
  if (item.kind === 'anchor-set') {
    /*
     * An anchor-set rail draws ONLY the roles flagged `large`; the stored
     * non-large roles are provenance the drawing never uses, so their
     * anchors are not this mark's dependencies. A vanished scalar
     * annotation must not take a valid five-member rail with it. And
     * persistence is governed by anchors that RESOLVED at the authoring
     * stage: a member that never resolved already failed closed there
     * (with its `large-array-anchor-unresolved` diagnostic and no
     * geometry), so its continued absence is not a newly vanished
     * dependency — the unchanged partial rail persists exactly as it
     * rendered.
     */
    item.set.roles
      .filter((roleGroup) => roleGroup.large)
      .forEach((roleGroup) => roleGroup.anchors.forEach((anchor) => {
        if (!anchor.resolved) return;
        const nodeId = String(anchor.nodeId || '').trim();
        if (nodeId) ids.add(nodeId);
      }));
    return Array.from(ids);
  }
  Object.entries(item).forEach(([key, value]) => walk(value, key));
  return Array.from(ids);
};

export const compileRelationRenderPlan = (
  stages: DerivationStage[],
  options: CompilePlanOptions = {}
): RelationRenderPlan => {
  const registry = options.registry ?? productionRelationRegistry;
  const families = options.families ?? PRODUCTION_RENDER_FAMILIES;
  const stageList = Array.isArray(stages) ? stages : [];
  const diagnostics: PlanDiagnostic[] = [];
  const unregisteredCounts = new Map<string, number>();
  const items: RelationPlanItem[] = [];

  /** Deterministic chain-index allocation, sequential by first appearance. */
  const chainIndexByKey = new Map<string, string>();
  const chainIndexFor = (key: string): string => {
    if (!chainIndexByKey.has(key)) {
      chainIndexByKey.set(key, String(chainIndexByKey.size + 1));
    }
    return chainIndexByKey.get(key)!;
  };
  /**
   * Chain identity, tightened to what authored data proves:
   * - Primary: the shared authored `lineageId` of the anchored occurrences.
   *   A lineage-keyed chain keeps its identity as its occurrence list grows
   *   or is reordered, because the lineage — not the list — is the key.
   * - Fallback (no shared lineage): the family tag plus the sorted anchored
   *   participant set. This is stable under harmless anchor-array
   *   reordering, but a no-lineage chain that GROWS is a new participant
   *   set — the compiler cannot prove it is the same chain and does not
   *   pretend to. Unrelated no-lineage chains are never merged.
   * Display numerals are allocated in first-encounter order within one
   * compilation; identity keys are stable, but reordering relations or
   * stages can renumber which chain gets which numeral.
   */
  const stableChainKey = (
    tag: string,
    nodes: Map<string, SyntaxNode>,
    ids: string[]
  ): string => {
    const lineageSets = ids.map((id) => {
      const lineages = new Set<string>();
      const anchorNode = nodes.get(id);
      if (anchorNode) {
        const walk = (current: SyntaxNode) => {
          const lineageId = String(current.lineageId || '').trim();
          if (lineageId) lineages.add(lineageId);
          (Array.isArray(current.children) ? current.children : []).forEach(walk);
        };
        walk(anchorNode);
      }
      return lineages;
    });
    const shared = lineageSets.length > 0
      ? Array.from(lineageSets[0])
        .filter((lineageId) => lineageSets.every((set) => set.has(lineageId)))
        .sort()
        .join('|')
      : '';
    return shared
      ? `lineage:${shared}`
      : `${tag}:${Array.from(new Set(ids)).sort().join(',')}`;
  };

  stageList.forEach((stage, stageIndex) => {
    const nodes = collectForest(stage?.workspaceForest);
    const priorNodes = stageIndex > 0
      ? collectForest(stageList[stageIndex - 1]?.workspaceForest)
      : null;
    const relations = Array.isArray(stage?.relations) ? stage.relations : [];
    const fallbackInstanceCounts = new Map<string, number>();
    /*
     * PF composition provenance: a VocabularyInsertion row joins a
     * PFRealization plate only when its own resolved target anchor is among
     * that package's explicitly authored targets. Multiple packages in one
     * stage stay separate; an insertion with no resolving target, or no
     * matching package, never contaminates another plate.
     */
    const stageNodeSetForPf = collectForest(stage?.workspaceForest);
    const pfPackages = relations.flatMap((candidate, candidateIndex) => {
      const candidateEntry = findRelationRegistryEntry(registry, candidate.relation);
      if (!candidateEntry || families[candidateEntry.id]?.family !== 'realization-plate') return [];
      return [{
        relationIndex: candidateIndex,
        targets: new Set(Object.values(candidate.anchors || {}).flatMap(flattenAnchorIds))
      }];
    });
    const vocabularyAssignments = new Map<number, number>();
    relations.forEach((candidate, candidateIndex) => {
      const candidateEntry = findRelationRegistryEntry(registry, candidate.relation);
      if (!candidateEntry || families[candidateEntry.id]?.family !== 'vocabulary-insertion') return;
      const viTarget = flattenAnchorIds(candidate.anchors?.terminal || candidate.anchors?.target)[0];
      if (!viTarget || !stageNodeSetForPf.has(viTarget)) return;
      /*
       * Ownership must be provable, never first-win: an insertion joins a
       * package only when exactly one package's authored anchors contain its
       * target. A target shared by several packages is ambiguous authored
       * data — the insertion keeps its own standalone plate and the
       * ambiguity is diagnosed instead of silently resolved.
       */
      const owningPackages = pfPackages.filter((pfPackage) => pfPackage.targets.has(viTarget));
      if (owningPackages.length === 1) {
        vocabularyAssignments.set(candidateIndex, owningPackages[0].relationIndex);
      } else if (owningPackages.length > 1) {
        diagnostics.push({
          stageIndex,
          relationIndex: candidateIndex,
          relation: candidate.relation,
          kind: 'ambiguous-package-ownership',
          detail: `insertion target ${viTarget} is anchored by ${owningPackages.length} PF packages `
            + `(relation indices ${owningPackages.map((pfPackage) => pfPackage.relationIndex).join(', ')}); `
            + 'the row stays standalone instead of joining the first package'
        });
      }
    });

    relations.forEach((relation, relationIndex) => {
      const relationRef: PlanRelationRef = {
        stageIndex,
        relationIndex,
        relation: relation.relation,
        anchors: relation.anchors,
        ...(relation.priorAnchors ? { priorAnchors: relation.priorAnchors } : {}),
        ...(relation.values ? { values: relation.values } : {})
      };
      const pushDiagnostic = (kind: PlanDiagnostic['kind'], detail: string) => {
        diagnostics.push({ stageIndex, relationIndex, relation: relation.relation, kind, detail });
      };

      /*
       * priorAnchors resolve only against the immediately preceding stage,
       * and the authored block proves something only as a WHOLE: a block
       * with any unresolved witness is retained verbatim in the relationRef
       * and diagnosed, but it draws no backward continuity cue and proves
       * no replacement continuity — a subset of a prior block never
       * silently stands in for the whole authored claim.
       */
      const priorWitnessNodeIds: string[] = [];
      let priorAnchorBlockComplete = false;
      if (relation.priorAnchors) {
        if (!priorNodes) {
          pushDiagnostic(
            'prior-anchor-without-prior-stage',
            'priorAnchors authored at stage 0 have no preceding stage to resolve against'
          );
        } else {
          let unresolvedPriorAnchors = 0;
          Object.entries(relation.priorAnchors).forEach(([role, value]) => {
            flattenAnchorIds(value).forEach((nodeId) => {
              if (priorNodes.has(nodeId)) {
                priorWitnessNodeIds.push(nodeId);
              } else {
                unresolvedPriorAnchors += 1;
                pushDiagnostic(
                  'prior-anchor-unresolved',
                  `${role} -> ${nodeId} does not resolve in the preceding stage; the incomplete `
                    + 'block draws no backward cue and proves no continuity'
                );
              }
            });
          });
          if (unresolvedPriorAnchors > 0) {
            priorWitnessNodeIds.length = 0;
          } else {
            priorAnchorBlockComplete = priorWitnessNodeIds.length > 0;
          }
        }
      }
      const backward = priorWitnessNodeIds.length > 0;

      const dispatch = dispatchRelation({
        registry,
        relation,
        stageIndex,
        relationIndex
      }) as {
        outcome: 'unregistered' | 'signature-incomplete' | 'resolved';
        registryEntryId?: string;
        signatureIssues: Array<Record<string, unknown>>;
      };

      /**
       * Neutral, name-free presentation of resolved witnesses through the
       * accepted fallback topology. Used for unregistered names and for
       * preserving evidence a specialized branch cannot or may not consume.
       */
      const pushNeutralFallback = (
        anchorSource: Record<string, string | string[]>,
        includePriorCue: boolean
      ) => {
        const resolvedAnchors: Record<string, string | string[]> = {};
        Object.entries(anchorSource || {}).forEach(([role, value]) => {
          const ids = flattenAnchorIds(value);
          const resolved = ids.filter((nodeId) => {
            if (nodes.has(nodeId)) return true;
            pushDiagnostic(
              'anchor-unresolved',
              `${role} -> ${nodeId} does not resolve in its stage; its fallback mark fails closed`
            );
            return false;
          });
          if (resolved.length === 0) return;
          resolvedAnchors[role] = Array.isArray(value) ? resolved : resolved[0];
        });
        const instanceNumber = (fallbackInstanceCounts.get(relation.relation) ?? 0) + 1;
        fallbackInstanceCounts.set(relation.relation, instanceNumber);
        const drawing = fallbackDrawing(
          {
            relation: relation.relation,
            anchors: resolvedAnchors,
            ...(includePriorCue && priorWitnessNodeIds.length > 0
              ? { priorAnchors: { resolved: priorWitnessNodeIds } }
              : {})
          },
          instanceNumber
        );
        items.push({
          kind: 'fallback',
          relationRef,
          appearsAtStage: stageIndex,
          persistence: 'from-stage-onward',
          backward,
          priorWitnessNodeIds,
          drawing
        });
      };

      if (dispatch.outcome === 'unregistered') {
        unregisteredCounts.set(
          relation.relation,
          (unregisteredCounts.get(relation.relation) ?? 0) + 1
        );
        pushNeutralFallback(relation.anchors || {}, true);
        return;
      }

      let extraOpenRoles: string[] = [];
      if (dispatch.outcome === 'signature-incomplete') {
        pushDiagnostic(
          'signature-incomplete',
          dispatch.signatureIssues
            .map((issue) => `${issue.kind}:${issue.field ?? ''}:${issue.role ?? ''}`)
            .join(', ') || 'signature incomplete'
        );
        const anchorIssues = dispatch.signatureIssues
          .filter((issue) => issue.field === 'anchors' || issue.field === undefined);
        const onlyExtraOpenRoles = anchorIssues.length > 0
          && dispatch.signatureIssues.every((issue) => issue.kind === 'unexpected-role');
        if (!onlyExtraOpenRoles) {
          /*
           * A missing or invalid required role refuses only the specialized
           * claim. The authored instance and its resolved witnesses remain
           * inspectable through the neutral presentation.
           */
          pushNeutralFallback(relation.anchors || {}, true);
          return;
        }
        /*
         * Extra open roles never veto the valid specialized core. The core
         * compiles below; every additional resolved participant keeps a
         * neutral mark and its provenance.
         */
        extraOpenRoles = dispatch.signatureIssues
          .filter((issue) => issue.kind === 'unexpected-role')
          .map((issue) => String(issue.role || ''))
          .filter(Boolean);
        const extraAnchors: Record<string, string | string[]> = {};
        extraOpenRoles.forEach((role) => {
          if (relation.anchors?.[role] !== undefined) extraAnchors[role] = relation.anchors[role];
        });
        if (Object.keys(extraAnchors).length > 0) {
          pushNeutralFallback(extraAnchors, false);
        }
      }

      const familyId = String(dispatch.registryEntryId);
      const family = families[familyId];
      if (!family) {
        pushDiagnostic(
          'signature-incomplete',
          `registry entry ${familyId} has no production render family`
        );
        return;
      }
      /*
       * Replacement grouping. Replacement is licensed only when two states
       * provably belong to the same authored relation thread:
       * - a family with a declared replacement scope role (Cooper storage
       *   per-scope ledgers) threads by that authored scope anchor;
       * - any other replace-previous-instance family threads by its complete
       *   authored participant set — a later instance over the same nodes is
       *   a restatement of the same claim and replaces it;
       * - a later instance whose authored `priorAnchors` name exactly an
       *   earlier instance's participants has authored its own continuity
       *   with that state, and replaces it even though its current
       *   participant set differs (a grown linearization domain).
       * An instance over a different participant set with no authored
       * continuity is an independent claim and both persist. Nothing global
       * to the family ever replaces across unrelated participants.
       */
      const participantSetKey = (source: Record<string, string | string[]> | undefined): string =>
        Array.from(new Set(
          Object.values(source || {}).flatMap(flattenAnchorIds)
        )).sort().join(',');
      const replacementScopeId = family.replacementScopeRole
        ? flattenAnchorIds(relation.anchors?.[family.replacementScopeRole])[0] || ''
        : '';
      const replacementThread = replacementScopeId
        ? `${familyId}:scope:${replacementScopeId}`
        : `${familyId}:participants:${participantSetKey(relation.anchors)}`;
      /*
       * Replacement continuity across changed participants requires PROOF:
       * only a complete prior-anchor block whose every authored witness
       * resolved in the immediately preceding stage may name a predecessor
       * thread. An incomplete block is authored data that failed to verify —
       * it is diagnosed and retained verbatim, but it never erases an
       * earlier claim.
       */
      const replacementPredecessor = !replacementScopeId
        && family.persistence === 'replace-previous-instance'
        && priorAnchorBlockComplete
        ? `${familyId}:participants:${participantSetKey(relation.priorAnchors)}`
        : '';
      const base: PlanItemBase = {
        relationRef,
        familyId,
        appearsAtStage: stageIndex,
        persistence: family.persistence,
        ...(family.persistence === 'replace-previous-instance'
          ? {
              replacementGroup: replacementThread,
              ...(replacementPredecessor
                ? { replacementPredecessorGroup: replacementPredecessor }
                : {})
            }
          : {}),
        backward,
        priorWitnessNodeIds
      };

      const requireResolved = (role: string, nodeId: string): boolean => {
        if (nodeId && nodes.has(nodeId)) return true;
        pushDiagnostic(
          'anchor-unresolved',
          `${role} -> ${nodeId || '(missing)'} does not resolve in its stage; the mark fails closed`
        );
        return false;
      };
      const resolvedIds = (role: string, value: string | string[] | undefined): string[] =>
        flattenAnchorIds(value).filter((nodeId) => requireResolved(role, nodeId));
      const anchors = relation.anchors || {};
      const values = relation.values;

      switch (family.family) {
        case 'trajectory': {
          if (family.trajectoryKind === 'atb') {
            const target = firstRole(anchors, TRAJECTORY_TARGET_ROLES);
            const sources = flattenAnchorIds(anchors.sources);
            const witnesses = flattenAnchorIds(anchors.traceWitnesses);
            if (!target || !requireResolved(target.role, target.nodeId)) return;
            if (sources.length === 0 || sources.length !== witnesses.length) {
              pushDiagnostic('endpoint-missing', 'ATB requires positionally paired sources and traceWitnesses');
              return;
            }
            sources.forEach((sourceNodeId, pairIndex) => {
              const witnessNodeId = witnesses[pairIndex];
              if (!requireResolved('sources', sourceNodeId)) return;
              if (!requireResolved('traceWitnesses', witnessNodeId)) return;
              const sourceSubtree = collectSubtreeIds(nodes.get(sourceNodeId));
              if (!sourceSubtree.includes(witnessNodeId)) {
                pushDiagnostic(
                  'witness-outside-source',
                  `traceWitnesses[${pairIndex}] -> ${witnessNodeId} is not inside sources[${pairIndex}]`
                );
                return;
              }
              items.push({
                ...base,
                kind: 'trajectory',
                trajectoryKind: 'atb',
                sourceNodeId,
                targetNodeId: target.nodeId,
                witnessNodeId,
                sourceAttachment: 'terminal',
                targetAttachment: 'shell'
              });
            });
            return;
          }

          const source = firstRole(anchors, TRAJECTORY_SOURCE_ROLES);
          const target = firstRole(anchors, TRAJECTORY_TARGET_ROLES);
          if (!source || !target) {
            pushDiagnostic('endpoint-missing', 'trajectory requires one source-role and one target-role anchor');
            return;
          }
          if (!requireResolved(source.role, source.nodeId)) return;
          if (!requireResolved(target.role, target.nodeId)) return;

          let trajectoryKind = family.trajectoryKind as NonNullable<ProductionRenderFamily['trajectoryKind']>;
          if (trajectoryKind === 'lowering'
            && loweringIsPhraseSized(relation, nodes, source.nodeId, target.nodeId)) {
            trajectoryKind = 'phrasal';
          }

          const witness = firstRole(anchors, TRAJECTORY_WITNESS_ROLES);
          const witnessRequired = WITNESS_REQUIRED_TRAJECTORY_KINDS.has(trajectoryKind);
          if (witness) {
            if (!requireResolved(witness.role, witness.nodeId)) return;
            const sourceSubtree = collectSubtreeIds(nodes.get(source.nodeId));
            if (!sourceSubtree.includes(witness.nodeId)) {
              pushDiagnostic(
                'witness-outside-source',
                `${witness.role} -> ${witness.nodeId} is not the source occurrence or inside it`
              );
              return;
            }
          } else if (witnessRequired) {
            pushDiagnostic(
              'witness-missing',
              `${trajectoryKind} trajectories require an authored trace witness; none was authored`
            );
            return;
          }

          const headSized = trajectoryKind === 'head'
            || trajectoryKind === 'lowering'
            || trajectoryKind === 'operator-variable';
          items.push({
            ...base,
            kind: 'trajectory',
            trajectoryKind,
            sourceNodeId: source.nodeId,
            targetNodeId: target.nodeId,
            ...(witness ? { witnessNodeId: witness.nodeId } : {}),
            sourceAttachment: 'terminal',
            targetAttachment: headSized ? 'terminal' : 'shell'
          });

          /*
           * Accepted auxiliary marks travel with their trajectory: the
           * remnant's landing is boxed, the smuggling carrier's lower chunk
           * is shaded.
           */
          if (trajectoryKind === 'remnant') {
            items.push({
              ...base,
              kind: 'enclosure',
              nodeId: target.nodeId,
              licence: 'remnant-landing'
            });
          }
          if (trajectoryKind === 'smuggling') {
            items.push({
              ...base,
              kind: 'enclosure',
              nodeId: source.nodeId,
              licence: 'carrier-chunk'
            });
          }
          return;
        }

        case 'occurrence-identity': {
          const occurrenceIds = Object.values(anchors)
            .flatMap(flattenAnchorIds)
            .filter((nodeId, index, all) => all.indexOf(nodeId) === index)
            .filter((nodeId) => requireResolved('occurrences', nodeId));
          if (occurrenceIds.length < 2) return;
          items.push({
            ...base,
            kind: 'coindex',
            nodeIds: occurrenceIds,
            index: chainIndexFor(stableChainKey('identity', nodes, occurrenceIds))
          });
          return;
        }

        case 'coindex': {
          const nodeIds = Object.values(anchors)
            .flatMap(flattenAnchorIds)
            .filter((nodeId, index, all) => all.indexOf(nodeId) === index)
            .filter((nodeId) => requireResolved('anchors', nodeId));
          if (nodeIds.length < 2) return;
          items.push({
            ...base,
            kind: 'coindex',
            nodeIds,
            index: chainIndexFor(stableChainKey('coindex', nodes, nodeIds))
          });
          return;
        }

        case 'control': {
          const controller = flattenAnchorIds(anchors.controller)[0];
          const controllee = flattenAnchorIds(anchors.controllee)[0];
          const domain = flattenAnchorIds(anchors.domain)[0];
          if (!requireResolved('controller', controller)) return;
          if (!requireResolved('controllee', controllee)) return;
          if (!requireResolved('domain', domain)) return;
          const index = chainIndexFor(stableChainKey('control', nodes, [controller, controllee]));
          items.push({
            ...base,
            kind: 'domain-mark',
            rootNodeId: domain,
            memberNodeIds: collectSubtreeIds(nodes.get(domain)),
            subtreeDerived: [{ field: 'memberNodeIds', rootNodeId: domain, mode: 'all' }],
            domainStyle: 'control-domain'
          });
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: controller,
            toNodeId: controllee,
            pathStyle: 'control'
          });
          items.push({ ...base, kind: 'coindex', nodeIds: [controller, controllee], index });
          return;
        }

        case 'predication': {
          const predicand = flattenAnchorIds(anchors.predicand)[0];
          if (!requireResolved('predicand', predicand)) return;
          const predicates = [
            ...flattenAnchorIds(anchors.predicate),
            ...flattenAnchorIds(anchors.predicates)
          ].filter((nodeId) => requireResolved('predicate', nodeId));
          if (predicates.length === 0) return;
          items.push({
            ...base,
            kind: 'undirected-link',
            pairs: predicates.map((predicate) => ({ fromNodeId: predicand, toNodeId: predicate })),
            linkStyle: 'predication'
          });
          return;
        }

        case 'binding-domain': {
          const binder = flattenAnchorIds(anchors.binder)[0];
          const bound = flattenAnchorIds(anchors.bound)[0];
          const domain = flattenAnchorIds(anchors.domain)[0];
          if (!requireResolved('binder', binder)) return;
          if (!requireResolved('bound', bound)) return;
          if (!requireResolved('domain', domain)) return;
          const bindingOutcomeRaw = scalarValue(values, 'outcome');
          const bindingOutcome = recognizedOutcome(bindingOutcomeRaw, ['licensed', 'failed'] as const);
          if (bindingOutcomeRaw && !bindingOutcome) {
            pushDiagnostic('value-unrecognized', `outcome -> "${bindingOutcomeRaw}" is not a recognized Binding judgment`);
          }
          items.push({
            ...base,
            kind: 'binding-domain',
            binderNodeId: binder,
            boundNodeId: bound,
            domainNodeId: domain,
            domainMemberNodeIds: collectSubtreeIds(nodes.get(domain)),
            subtreeDerived: [{ field: 'domainMemberNodeIds', rootNodeId: domain, mode: 'all' }],
            ...(bindingOutcome ? { outcome: bindingOutcome } : {}),
            index: chainIndexFor(stableChainKey('binding', nodes, [binder, bound]))
          });
          return;
        }

        case 'split-antecedence': {
          const antecedents = resolvedIds('antecedents', anchors.antecedents);
          const dependent = flattenAnchorIds(anchors.dependent)[0];
          if (antecedents.length < 2 || !requireResolved('dependent', dependent)) return;
          const antecedentIndices = listValue(values, 'antecedentIndices');
          const dependentIndex = scalarValue(values, 'dependentIndex')
            || antecedents.map((_unused, index) => antecedentIndices[index] || String(index + 1)).join('⊕');
          items.push({
            ...base,
            kind: 'node-badges',
            badgeStyle: 'split-antecedence',
            badges: [
              ...antecedents.map((nodeId, index) => ({
                nodeId,
                text: antecedentIndices[index] || String(index + 1),
                shape: 'plain' as const
              })),
              { nodeId: dependent, text: dependentIndex, shape: 'plain' as const }
            ]
          });
          return;
        }

        case 'parasitic-gap': {
          const filler = flattenAnchorIds(anchors.filler || anchors.operator)[0];
          const realGap = flattenAnchorIds(anchors.realGap || anchors.gap)[0];
          const parasitic = [
            ...flattenAnchorIds(anchors.parasiticGaps),
            ...flattenAnchorIds(anchors.parasiticGap)
          ].filter((nodeId, index, all) => all.indexOf(nodeId) === index);
          if (filler && realGap && parasitic.length > 0) {
            const coindexIds = [filler, realGap, ...parasitic]
              .filter((nodeId) => requireResolved('parasitic-gap', nodeId));
            if (coindexIds.length === 2 + parasitic.length) {
              const index = chainIndexFor(stableChainKey('parasitic-gap', nodes, coindexIds));
              items.push({ ...base, kind: 'coindex', nodeIds: coindexIds, index });
              items.push({
                ...base,
                kind: 'node-badges',
                badgeStyle: 'gap-notation',
                badges: [
                  { nodeId: realGap, text: 't', shape: 'plain' },
                  ...parasitic.map((nodeId) => ({ nodeId, text: 'pg', shape: 'plain' as const }))
                ]
              });
            }
          }
          const primaryPath = resolvedIds('primaryPath', anchors.primaryPath);
          const secondaryPath = resolvedIds('secondaryPath', anchors.secondaryPath);
          // The composition owns its path arrays outright, so every authored
          // path node renders even when only one of the two paths is present.
          // Phillips figure 4, plate-exact: circles enclose the primary path's
          // node labels, squares the secondary path's, and the blocked
          // finite-relative-clause edge takes the double slash.
          if (primaryPath.length > 0 || secondaryPath.length > 0) {
            const blockedEdge = flattenAnchorIds(anchors.blockedEdge)[0];
            const pathOutcomeRaw = scalarValue(values, 'outcome');
            const pathOutcome = recognizedOutcome(pathOutcomeRaw, ['licensed', 'blocked'] as const);
            if (pathOutcomeRaw && !pathOutcome) {
              pushDiagnostic('value-unrecognized', `outcome -> "${pathOutcomeRaw}" is not a recognized path-status judgment`);
            }
            items.push({
              ...base,
              kind: 'path-status',
              primaryNodeIds: primaryPath,
              secondaryNodeIds: secondaryPath,
              ...(blockedEdge && nodes.has(blockedEdge) ? { blockedEdgeNodeId: blockedEdge } : {}),
              ...(pathOutcome ? { outcome: pathOutcome } : {})
            });
          }
          return;
        }

        case 'pair-merge': {
          const member = flattenAnchorIds(anchors.pairMember || anchors.adjunct)[0];
          const host = flattenAnchorIds(anchors.host)[0];
          if (!requireResolved('pairMember', member)) return;
          if (!requireResolved('host', host)) return;
          items.push({
            ...base,
            kind: 'undirected-link',
            pairs: [{ fromNodeId: member, toNodeId: host }],
            linkStyle: 'pair-merge'
          });
          return;
        }

        case 'shared-node': {
          const parents = resolvedIds('parents', anchors.parents);
          const shared = flattenAnchorIds(anchors.shared)[0];
          if (parents.length < 2 || !requireResolved('shared', shared)) return;
          /*
           * Multidominance legality gate: at least one authored parent must
           * dominate the shared node in the authored tree; a shared node that
           * none of its claimed parents dominates asserts dominance no
           * analysis proposes and fails closed.
           */
          const dominated = parents.some((parent) =>
            collectSubtreeIds(nodes.get(parent)).includes(shared));
          if (!dominated) {
            pushDiagnostic(
              'illegal-configuration',
              'no authored parent dominates the shared node; the multidominance overlay fails closed'
            );
            return;
          }
          items.push({ ...base, kind: 'shared-node', parentNodeIds: parents, sharedNodeId: shared });
          return;
        }

        case 'argument-sharing': {
          const domains = resolvedIds('domains', anchors.domains);
          const shared = flattenAnchorIds(anchors.shared)[0];
          if (domains.length < 2 || !requireResolved('shared', shared)) return;
          domains.forEach((domain) => {
            items.push({
              ...base,
              kind: 'domain-mark',
              rootNodeId: domain,
              memberNodeIds: collectSubtreeIds(nodes.get(domain)),
              subtreeDerived: [{ field: 'memberNodeIds', rootNodeId: domain, mode: 'all' }],
              domainStyle: 'argument-domain'
            });
          });
          items.push({
            ...base,
            kind: 'node-badges',
            badgeStyle: 'shared-object',
            badges: [{ nodeId: shared, text: '⊙', shape: 'plain' }]
          });
          return;
        }

        case 'idiom-chunks': {
          const domainRole = Object.keys(anchors)
            .find((role) => ['domain', 'interpretationDomain'].includes(role));
          const domain = domainRole ? flattenAnchorIds(anchors[domainRole])[0] : '';
          const chunks = Object.entries(anchors)
            .filter(([role]) => role !== domainRole)
            .flatMap(([, value]) => flattenAnchorIds(value))
            .filter((nodeId, index, all) => all.indexOf(nodeId) === index)
            .filter((nodeId) => requireResolved('chunk', nodeId));
          if (!requireResolved('domain', domain) || chunks.length < 2) return;
          items.push({
            ...base,
            kind: 'domain-mark',
            rootNodeId: domain,
            memberNodeIds: collectSubtreeIds(nodes.get(domain)),
            subtreeDerived: [{ field: 'memberNodeIds', rootNodeId: domain, mode: 'all' }],
            domainStyle: 'idiom'
          });
          items.push({
            ...base,
            kind: 'node-badges',
            badgeStyle: 'idiom-chunk',
            badges: chunks.map((nodeId) => ({ nodeId, text: '', shape: 'plain' as const }))
          });
          return;
        }

        case 'feature-plaque': {
          const anchorEntries = Object.entries(anchors);
          if (anchorEntries.length === 0) {
            pushDiagnostic('endpoint-missing', 'a feature plaque needs at least one participant anchor');
            return;
          }
          const [role, value] = anchorEntries[0];
          const participant = flattenAnchorIds(value)[0];
          if (!requireResolved(role, participant)) return;
          const rows = verbatimRows(values);
          /*
           * The plaque exists to show authored feature rows (the accepted
           * Agree/FeatureBundle convention authors the rows on FeatureBundle,
           * with Agree often carrying only probe/goal). An instance with no
           * authored values draws no plaque — an empty box would be an
           * invented claim — and its resolved participants instead keep the
           * neutral topology-only presentation so the authored relation stays
           * visible without an invented connector semantics. The plaque never
           * takes its title from a role name; only authored values label it.
           */
          if (rows.length === 0) {
            pushNeutralFallback(anchors, false);
            return;
          }
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [participant],
            plaqueStyle: 'feature',
            rows
          });
          return;
        }

        case 'agreement-paths': {
          const probe = flattenAnchorIds(anchors.probe)[0];
          if (!requireResolved('probe', probe)) return;
          if (family.agreementMode === 'multiple') {
            const goals = [
              ...flattenAnchorIds(anchors.goals),
              ...flattenAnchorIds(anchors.goal)
            ].filter((nodeId) => requireResolved('goals', nodeId));
            if (goals.length === 0) return;
            goals.forEach((goal) => {
              items.push({
                ...base,
                kind: 'directed-path',
                fromNodeId: probe,
                toNodeId: goal,
                pathStyle: 'agree-multiple',
                ...(scalarValue(values, 'outcome') ? { label: scalarValue(values, 'outcome') } : {})
              });
            });
            return;
          }
          const goal = flattenAnchorIds(anchors.goal || anchors.searchDomain)[0];
          if (!requireResolved('goal', goal)) return;
          // The cycle numeral is an authored claim; a relation's position in
          // the stage's relation list is not evidence of its cycle number, so
          // an unauthored cycle draws the path with no numeral at all.
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: probe,
            toNodeId: goal,
            pathStyle: 'agree-cyclic',
            ...(scalarValue(values, 'cycle') ? { label: scalarValue(values, 'cycle') } : {}),
            ...(scalarValue(values, 'outcome') ? { secondaryLabel: scalarValue(values, 'outcome') } : {})
          });
          return;
        }

        case 'feature-sharing': {
          const bearers = resolvedIds('bearers', anchors.bearers);
          if (bearers.length < 2) return;
          items.push({
            ...base,
            kind: 'undirected-link',
            pairs: bearers.slice(0, -1).map((bearer, index) => ({
              fromNodeId: bearer,
              toNodeId: bearers[index + 1]
            })),
            linkStyle: 'feature-sharing',
            ...(scalarValue(values, 'feature') || scalarValue(values, 'value')
              ? { label: [scalarValue(values, 'feature'), scalarValue(values, 'value')].filter(Boolean).join(': ') }
              : {})
          });
          return;
        }

        case 'case-assignment': {
          const assigner = flattenAnchorIds(anchors.assigner)[0];
          const bearer = flattenAnchorIds(anchors.bearer)[0];
          if (!requireResolved('assigner', assigner)) return;
          if (!requireResolved('bearer', bearer)) return;
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: assigner,
            toNodeId: bearer,
            pathStyle: 'case-assignment',
            ...(scalarValue(values, 'feature') || scalarValue(values, 'value')
              ? { label: [scalarValue(values, 'feature'), scalarValue(values, 'value')].filter(Boolean).join(': ') }
              : {})
          });
          /*
           * The accepted Case card composes the solid Case path with the
           * quieter dotted collection curves of the same-stage Agree
           * relations whose probe is this bearer. Each collection curve is
           * the COMPANION's mark: it carries the companion Agree instance's
           * own relationRef (so Replay reveals it at that Agree's relation
           * moment, never earlier) and the companion's family persistence —
           * only its dotted-collection styling comes from the Case
           * composition.
           */
          relations.forEach((companion, companionIndex) => {
            const companionEntry = findRelationRegistryEntry(registry, companion.relation);
            if (!companionEntry || families[companionEntry.id]?.family !== 'feature-plaque') return;
            const companionProbe = flattenAnchorIds(companion.anchors?.probe)[0];
            const companionGoal = flattenAnchorIds(companion.anchors?.goal)[0];
            if (companionProbe !== bearer || !companionGoal || !nodes.has(companionGoal)) return;
            const companionFamily = families[companionEntry.id];
            items.push({
              relationRef: {
                stageIndex,
                relationIndex: companionIndex,
                relation: companion.relation,
                anchors: companion.anchors,
                ...(companion.priorAnchors ? { priorAnchors: companion.priorAnchors } : {}),
                ...(companion.values ? { values: companion.values } : {})
              },
              familyId: String(companionEntry.id),
              appearsAtStage: stageIndex,
              persistence: companionFamily.persistence,
              backward: false,
              priorWitnessNodeIds: [],
              kind: 'directed-path',
              fromNodeId: bearer,
              toNodeId: companionGoal,
              pathStyle: 'case-agree',
              ...(scalarValue(companion.values, 'feature') || scalarValue(companion.values, 'value')
                ? { label: [scalarValue(companion.values, 'feature'), scalarValue(companion.values, 'value')].filter(Boolean).join(': ') }
                : {})
            });
          });
          return;
        }

        case 'dependent-case': {
          const probe = flattenAnchorIds(anchors.probe)[0];
          const goal = flattenAnchorIds(anchors.goal)[0];
          if (!requireResolved('probe', probe)) return;
          if (!requireResolved('goal', goal)) return;
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: probe,
            toNodeId: goal,
            pathStyle: 'dependent-case',
            ...(scalarValue(values, 'probeLabel') ? { label: scalarValue(values, 'probeLabel') } : {}),
            ...(scalarValue(values, 'goalLabel') ? { secondaryLabel: scalarValue(values, 'goalLabel') } : {})
          });
          return;
        }

        case 'accord': {
          const source = flattenAnchorIds(anchors.source)[0];
          const goal = flattenAnchorIds(anchors.goal)[0];
          if (!requireResolved('source', source)) return;
          if (!requireResolved('goal', goal)) return;
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: source,
            toNodeId: goal,
            pathStyle: 'accord',
            ...(scalarValue(values, 'feature') || scalarValue(values, 'index') || scalarValue(values, 'value')
              ? { label: `${scalarValue(values, 'feature')}${scalarValue(values, 'index')}${scalarValue(values, 'value') ? `: ${scalarValue(values, 'value')}` : ''}` }
              : {})
          });
          return;
        }

        case 'boundary-cuts': {
          const domain = flattenAnchorIds(anchors.domain)[0];
          const boundary = resolvedIds('boundary', anchors.boundary);
          if (!requireResolved('domain', domain) || boundary.length === 0) return;
          items.push({
            ...base,
            kind: 'node-badges',
            badgeStyle: 'boundary-cut',
            badges: boundary.map((nodeId) => ({ nodeId, text: '∥', shape: 'plain' as const }))
          });
          return;
        }

        case 'phase-arc': {
          const phase = flattenAnchorIds(anchors.phase)[0];
          if (!requireResolved('phase', phase)) return;
          const edge = flattenAnchorIds(anchors.edge)[0];
          if (edge && !requireResolved('edge', edge)) return;
          /*
           * Fong's Transfer/PIC composition owns the phase presentation when
           * a same-stage TransferDomain names this phase head: drawing the
           * plain phase arc as well would double-mark the one phase.
           */
          const transferOwnsPhase = relations.some((companion) => {
            const companionEntry = findRelationRegistryEntry(registry, companion.relation);
            if (!companionEntry || families[companionEntry.id]?.family !== 'transfer-domain') return false;
            return flattenAnchorIds(companion.anchors?.phase)[0] === phase;
          });
          if (transferOwnsPhase) return;
          items.push({
            ...base,
            kind: 'domain-mark',
            rootNodeId: phase,
            memberNodeIds: collectSubtreeIds(nodes.get(phase)),
            subtreeDerived: [{ field: 'memberNodeIds', rootNodeId: phase, mode: 'all' }],
            domainStyle: 'phase'
          });
          if (edge) {
            items.push({
              ...base,
              kind: 'node-badges',
              badgeStyle: 'phase-edge',
              badges: [{ nodeId: edge, text: 'edge', shape: 'plain' }]
            });
          }
          return;
        }

        case 'transfer-domain': {
          const phase = flattenAnchorIds(anchors.phase)[0];
          const edge = flattenAnchorIds(anchors.edge)[0];
          const spellOut = flattenAnchorIds(anchors.spellOutDomain || anchors.complement)[0];
          if (!requireResolved('phase', phase)) return;
          if (!requireResolved('edge', edge)) return;
          if (spellOut && !requireResolved('spellOutDomain', spellOut)) return;
          /*
           * Fong Defs. 1–2, plate-exact: a tilted component arc labelled
           * Phase around the phase head, the rectangular Phase-edge outline
           * around the edge, and a second tilted component arc labelled SOD
           * around the spell-out domain head.
           */
          items.push({
            ...base,
            kind: 'fong-component',
            headNodeId: phase,
            componentLabel: 'Phase'
          });
          items.push({
            ...base,
            kind: 'domain-mark',
            rootNodeId: edge,
            memberNodeIds: [edge],
            domainStyle: 'transfer-edge',
            label: 'Phase edge'
          });
          if (spellOut) {
            items.push({
              ...base,
              kind: 'fong-component',
              headNodeId: spellOut,
              componentLabel: 'SOD'
            });
          }
          return;
        }

        case 'blocked-access': {
          const source = flattenAnchorIds(anchors.source)[0];
          const target = flattenAnchorIds(anchors.target)[0];
          const domain = flattenAnchorIds(anchors.spellOutDomain || anchors.domain)[0];
          if (!requireResolved('source', source)) return;
          if (!requireResolved('target', target)) return;
          if (domain && !requireResolved('spellOutDomain', domain)) return;
          items.push({
            ...base,
            kind: 'blocked-access-lane',
            sourceNodeId: source,
            targetNodeId: target,
            domainMemberNodeIds: domain ? collectSubtreeIds(nodes.get(domain)) : [],
            ...(domain
              ? { subtreeDerived: [{ field: 'domainMemberNodeIds', rootNodeId: domain, mode: 'all' as const }] }
              : {})
          });
          return;
        }

        case 'anti-locality': {
          const source = flattenAnchorIds(anchors.source || anchors.lowerCopy)[0];
          const witness = flattenAnchorIds(anchors.traceWitness)[0];
          const landing = flattenAnchorIds(anchors.landing || anchors.pronouncedCopy)[0];
          if (!requireResolved('source', source)) return;
          if (!requireResolved('traceWitness', witness)) return;
          if (!requireResolved('landing', landing)) return;
          if (!collectSubtreeIds(nodes.get(source)).includes(witness)) {
            pushDiagnostic('witness-outside-source', `traceWitness -> ${witness} is not inside the source`);
            return;
          }
          const antiLocalityOutcomeRaw = scalarValue(values, 'outcome');
          const antiLocalityOutcome = recognizedOutcome(antiLocalityOutcomeRaw, ['licensed', 'blocked'] as const);
          if (!antiLocalityOutcome) {
            pushDiagnostic(
              'value-unrecognized',
              `outcome -> "${antiLocalityOutcomeRaw || '(missing)'}" is not a recognized AntiLocality judgment; the path draws without a judgment mark`
            );
          }
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: witness,
            toNodeId: landing,
            pathStyle: 'anti-locality',
            ...(antiLocalityOutcome ? { outcome: antiLocalityOutcome } : {})
          });
          const facilitator = flattenAnchorIds(anchors.facilitator)[0];
          if (facilitator && requireResolved('facilitator', facilitator)) {
            items.push({
              ...base,
              kind: 'node-badges',
              badgeStyle: 'facilitator',
              badges: [{ nodeId: facilitator, text: '', shape: 'plain' }]
            });
          }
          return;
        }

        case 'improper-movement': {
          const source = flattenAnchorIds(anchors.source)[0];
          const witness = flattenAnchorIds(anchors.traceWitness)[0];
          const landing = flattenAnchorIds(anchors.licensedLanding)[0];
          if (!requireResolved('source', source)) return;
          if (!requireResolved('traceWitness', witness)) return;
          if (!requireResolved('licensedLanding', landing)) return;
          if (!collectSubtreeIds(nodes.get(source)).includes(witness)) {
            pushDiagnostic('witness-outside-source', `traceWitness -> ${witness} is not inside the source`);
            return;
          }
          const forbidden = resolvedIds('forbiddenRegion', anchors.forbiddenRegion);
          if (forbidden.length > 0) {
            items.push({
              ...base,
              kind: 'domain-mark',
              memberNodeIds: forbidden,
              domainStyle: 'forbidden-region'
            });
          }
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: witness,
            toNodeId: landing,
            pathStyle: 'anti-locality',
            outcome: 'licensed'
          });
          const licensedHosts = resolvedIds('licensedLandingHosts', anchors.licensedLandingHosts);
          const rejectedHosts = resolvedIds('rejectedLandingHosts', anchors.rejectedLandingHosts);
          // The accepted drawing shows the rejected candidate paths too, each
          // from the same witness into the forbidden region's host.
          rejectedHosts.forEach((rejectedHost) => {
            items.push({
              ...base,
              kind: 'directed-path',
              fromNodeId: witness,
              toNodeId: rejectedHost,
              pathStyle: 'improper-candidate',
              outcome: 'blocked'
            });
          });
          if (licensedHosts.length > 0 || rejectedHosts.length > 0) {
            items.push({
              ...base,
              kind: 'node-badges',
              badgeStyle: 'improper-hosts',
              badges: [
                ...licensedHosts.map((nodeId) => ({ nodeId, text: '✓', shape: 'plain' as const })),
                ...rejectedHosts.map((nodeId) => ({ nodeId, text: '✗', shape: 'plain' as const }))
              ]
            });
          }
          return;
        }

        case 'right-roof': {
          const roof = flattenAnchorIds(anchors.roof)[0];
          const source = flattenAnchorIds(anchors.source)[0];
          const witness = flattenAnchorIds(anchors.traceWitness)[0];
          const landing = flattenAnchorIds(anchors.landing)[0];
          if (!requireResolved('roof', roof)) return;
          if (!requireResolved('source', source)) return;
          if (!requireResolved('traceWitness', witness)) return;
          if (!requireResolved('landing', landing)) return;
          if (!collectSubtreeIds(nodes.get(source)).includes(witness)) {
            pushDiagnostic('witness-outside-source', `traceWitness -> ${witness} is not inside the source`);
            return;
          }
          const roofOutcomeRaw = scalarValue(values, 'outcome');
          const roofOutcome = recognizedOutcome(roofOutcomeRaw, ['licensed', 'blocked'] as const);
          if (roofOutcomeRaw && !roofOutcome) {
            pushDiagnostic('value-unrecognized', `outcome -> "${roofOutcomeRaw}" is not a recognized RightRoof judgment`);
          }
          items.push({
            ...base,
            kind: 'domain-mark',
            rootNodeId: roof,
            // The accepted drawing outlines only the minimal roof label, not
            // the whole subtree.
            memberNodeIds: [roof],
            domainStyle: 'right-roof',
            ...(roofOutcome ? { outcome: roofOutcome } : {})
          });
          // The accepted drawing keeps the extraposition path itself: from the
          // trace witness to the landing, carrying the authored licensed check
          // or blocking X at its midpoint.
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: witness,
            toNodeId: landing,
            pathStyle: 'right-roof',
            ...(roofOutcome ? { outcome: roofOutcome } : {})
          });
          return;
        }

        case 'blocked-extraction': {
          const source = flattenAnchorIds(anchors.source || anchors.extractionSource)[0];
          const target = flattenAnchorIds(anchors.target || anchors.landingSite)[0];
          const domain = flattenAnchorIds(anchors.adjunctDomain || anchors.domain)[0];
          if (!requireResolved('source', source)) return;
          if (!requireResolved('target', target)) return;
          if (!requireResolved('domain', domain)) return;
          items.push({
            ...base,
            kind: 'domain-mark',
            rootNodeId: domain,
            memberNodeIds: collectSubtreeIds(nodes.get(domain)),
            subtreeDerived: [{ field: 'memberNodeIds', rootNodeId: domain, mode: 'all' }],
            domainStyle: 'adjunct-domain'
          });
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: source,
            toNodeId: target,
            pathStyle: 'blocked-extraction',
            outcome: 'blocked',
            ...(scalarValue(values, 'label') ? { label: scalarValue(values, 'label') } : {})
          });
          return;
        }

        case 'intervention': {
          const probe = flattenAnchorIds(anchors.landing || anchors.probe)[0];
          const intervener = flattenAnchorIds(anchors.intervener)[0];
          const target = flattenAnchorIds(anchors.target)[0];
          if (!requireResolved('probe', probe)) return;
          if (!requireResolved('intervener', intervener)) return;
          if (!requireResolved('target', target)) return;
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: probe,
            toNodeId: target,
            pathStyle: 'intervention',
            outcome: 'blocked'
          });
          items.push({
            ...base,
            kind: 'node-badges',
            badgeStyle: 'intervener',
            badges: [{ nodeId: intervener, text: '', shape: 'plain' }]
          });
          return;
        }

        case 'ellipsis-site': {
          const site = flattenAnchorIds(anchors.site || anchors.domain)[0];
          const antecedent = flattenAnchorIds(anchors.antecedent)[0];
          if (!requireResolved('site', site)) return;
          if (antecedent && !requireResolved('antecedent', antecedent)) return;
          items.push({
            ...base,
            kind: 'ellipsis-site',
            siteNodeId: site,
            ...(antecedent ? { antecedentNodeId: antecedent } : {}),
            ghostNodeIds: collectAuthoredSilentSubtreeIds(nodes.get(site)),
            siteSubtreeNodeIds: collectSubtreeIds(nodes.get(site)),
            subtreeDerived: [
              { field: 'ghostNodeIds', rootNodeId: site, mode: 'authored-silent' },
              { field: 'siteSubtreeNodeIds', rootNodeId: site, mode: 'all' }
            ]
          });
          return;
        }

        case 'ellipsis-licensing': {
          const licensor = flattenAnchorIds(anchors.licensor)[0];
          const domain = flattenAnchorIds(anchors.domain)[0];
          if (!requireResolved('licensor', licensor)) return;
          if (!requireResolved('domain', domain)) return;
          items.push({
            ...base,
            kind: 'ellipsis-site',
            siteNodeId: domain,
            ghostNodeIds: collectAuthoredSilentSubtreeIds(nodes.get(domain)),
            siteSubtreeNodeIds: collectSubtreeIds(nodes.get(domain)),
            subtreeDerived: [
              { field: 'ghostNodeIds', rootNodeId: domain, mode: 'authored-silent' },
              { field: 'siteSubtreeNodeIds', rootNodeId: domain, mode: 'all' }
            ]
          });
          const checker = flattenAnchorIds(anchors.checker)[0];
          const checkerFeature = scalarValue(values, 'checkerFeature');
          const licensorFeature = scalarValue(values, 'licensorFeature');
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [licensor],
            plaqueStyle: 'ellipsis-licensing',
            ...(licensorFeature ? { title: licensorFeature } : {}),
            rows: verbatimRows(values)
          });
          if (checker && requireResolved('checker', checker)) {
            items.push({
              ...base,
              kind: 'directed-path',
              fromNodeId: checker,
              toNodeId: licensor,
              pathStyle: 'ellipsis-checking',
              ...(checkerFeature ? { label: checkerFeature } : {}),
              ...(licensorFeature ? { secondaryLabel: licensorFeature } : {})
            });
          }
          return;
        }

        case 'copy-pronunciation': {
          const occurrences = [
            ...flattenAnchorIds(anchors.higherCopy),
            ...flattenAnchorIds(anchors.lowerCopy),
            ...flattenAnchorIds(anchors.occurrences)
          ].filter((nodeId, index, all) => all.indexOf(nodeId) === index)
            .filter((nodeId) => requireResolved('occurrences', nodeId));
          if (occurrences.length === 0) return;
          occurrences.forEach((nodeId) => {
            items.push({ ...base, kind: 'enclosure', nodeId, licence: 'copy-occurrence' });
          });
          return;
        }

        case 'partial-copy-deletion': {
          const lowerCopy = flattenAnchorIds(anchors.lowerCopy)[0];
          const deleted = flattenAnchorIds(anchors.deletedSubconstituent || anchors.deleted)[0];
          if (!requireResolved('lowerCopy', lowerCopy)) return;
          items.push({ ...base, kind: 'enclosure', nodeId: lowerCopy, licence: 'copy-occurrence' });
          if (deleted && requireResolved('deleted', deleted)) {
            items.push({
              ...base,
              kind: 'strike-ghost',
              strikeNodeIds: [deleted],
              ghostNodeIds: collectSubtreeIds(nodes.get(deleted)),
              subtreeDerived: [{ field: 'ghostNodeIds', rootNodeId: deleted, mode: 'all' }]
            });
          }
          return;
        }

        case 'realization-plate': {
          const targets = Object.values(anchors)
            .flatMap(flattenAnchorIds)
            .filter((nodeId, index, all) => all.indexOf(nodeId) === index)
            .filter((nodeId) => requireResolved('target', nodeId));
          if (targets.length === 0) return;
          // Only this package's own validated insertions contribute rows, in
          // authored order.
          const packageRows = relations.flatMap((companion, companionIndex) =>
            vocabularyAssignments.get(companionIndex) === relationIndex
              ? verbatimRows(companion.values)
              : []);
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: targets,
            plaqueStyle: 'realization',
            rows: [...verbatimRows(values), ...packageRows]
          });
          return;
        }

        case 'vocabulary-insertion': {
          // An insertion consumed by its explicitly-targeted package carries
          // no separate plate; any other insertion keeps its own.
          if (vocabularyAssignments.has(relationIndex)) return;
          const target = flattenAnchorIds(anchors.terminal || anchors.target)[0];
          if (!requireResolved('terminal', target)) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [target],
            plaqueStyle: 'realization',
            rows: verbatimRows(values)
          });
          return;
        }

        case 'phrasal-spellout': {
          const phrase = flattenAnchorIds(anchors.phrase || anchors.domain)[0];
          if (!requireResolved('phrase', phrase)) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [phrase],
            plaqueStyle: 'spellout-label',
            title: scalarValue(values, 'exponent'),
            rows: verbatimRows(values)
          });
          return;
        }

        case 'pf-correspondence': {
          const anchor = flattenAnchorIds(anchors.word || anchors.terminal)[0];
          if (!requireResolved('word', anchor)) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [anchor],
            plaqueStyle: 'correspondence',
            rows: verbatimRows(values)
          });
          return;
        }

        case 'fission': {
          const outputs = resolvedIds('outputs', anchors.outputs);
          if (outputs.length === 0) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: outputs,
            plaqueStyle: 'fission',
            rows: verbatimRows(values)
          });
          return;
        }

        case 'impoverishment': {
          const terminal = flattenAnchorIds(anchors.terminal)[0];
          if (!requireResolved('terminal', terminal)) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [terminal],
            plaqueStyle: 'impoverishment',
            rows: verbatimRows(values)
          });
          return;
        }

        case 'local-dislocation': {
          const sequence = resolvedIds('sequence', anchors.sequence);
          if (sequence.length === 0) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: sequence,
            plaqueStyle: 'dislocation-lane',
            rows: verbatimRows(values)
          });
          return;
        }

        case 'cyclic-linearization': {
          const order = resolvedIds('order', anchors.order);
          if (order.length === 0) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: order,
            plaqueStyle: 'linearization',
            ...(scalarValue(values, 'outcome') ? { title: scalarValue(values, 'outcome') } : {}),
            rows: verbatimRows(values)
          });
          return;
        }

        case 'qr': {
          const pronounced = firstRole(anchors, ['pronouncedQP', 'source']);
          const lf = firstRole(anchors, ['lfQP', 'target']);
          if (!pronounced || !lf) {
            pushDiagnostic('endpoint-missing', 'QuantifierRaising requires pronounced and LF occurrence anchors');
            return;
          }
          if (!requireResolved(pronounced.role, pronounced.nodeId)) return;
          if (!requireResolved(lf.role, lf.nodeId)) return;
          const scopeDomain = flattenAnchorIds(anchors.scopeDomain || anchors.domain)[0];
          if (scopeDomain && requireResolved('scopeDomain', scopeDomain)) {
            items.push({
              ...base,
              kind: 'domain-mark',
              rootNodeId: scopeDomain,
              memberNodeIds: collectSubtreeIds(nodes.get(scopeDomain)),
              subtreeDerived: [{ field: 'memberNodeIds', rootNodeId: scopeDomain, mode: 'all' }],
              domainStyle: 'scope'
            });
          }
          items.push({
            ...base,
            kind: 'directed-path',
            fromNodeId: pronounced.nodeId,
            toNodeId: lf.nodeId,
            pathStyle: 'covert-qr'
          });
          items.push({
            ...base,
            kind: 'coindex',
            nodeIds: [pronounced.nodeId, lf.nodeId],
            index: chainIndexFor(stableChainKey('qr', nodes, [pronounced.nodeId, lf.nodeId]))
          });
          return;
        }

        case 'lf-reconstruction': {
          const neglected = flattenAnchorIds(anchors.neglectedCopy)[0];
          const interpreted = flattenAnchorIds(anchors.interpretedCopy)[0];
          if (!requireResolved('neglectedCopy', neglected)) return;
          if (!requireResolved('interpretedCopy', interpreted)) return;
          // The sourced convention links the copies by shared subscript alone:
          // strike/ghost on the neglected copy, retained interpreted copy, and
          // no connector of any kind.
          items.push({
            ...base,
            kind: 'strike-ghost',
            strikeNodeIds: [neglected],
            ghostNodeIds: collectSubtreeIds(nodes.get(neglected)),
            subtreeDerived: [{ field: 'ghostNodeIds', rootNodeId: neglected, mode: 'all' }]
          });
          items.push({
            ...base,
            kind: 'coindex',
            nodeIds: [neglected, interpreted],
            index: chainIndexFor(stableChainKey('lf', nodes, [neglected, interpreted]))
          });
          return;
        }

        case 'cooper-storage': {
          const scope = flattenAnchorIds(anchors.scope)[0];
          if (!requireResolved('scope', scope)) return;
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [scope],
            plaqueStyle: 'cooper-storage',
            rows: verbatimRows(values)
          });
          return;
        }

        case 'strong-npi': {
          const exhaustifier = flattenAnchorIds(anchors.exhaustifier)[0];
          const npi = flattenAnchorIds(anchors.npi)[0];
          const focusOperator = flattenAnchorIds(anchors.focusOperator)[0];
          const focusAssociate = flattenAnchorIds(anchors.focusAssociate)[0];
          if (!requireResolved('exhaustifier', exhaustifier)) return;
          if (!requireResolved('npi', npi)) return;
          if (!requireResolved('focusOperator', focusOperator)) return;
          if (!requireResolved('focusAssociate', focusAssociate)) return;
          items.push({
            ...base,
            kind: 'undirected-link',
            pairs: [
              { fromNodeId: exhaustifier, toNodeId: npi },
              { fromNodeId: focusOperator, toNodeId: focusAssociate }
            ],
            linkStyle: 'strong-npi',
            ...(scalarValue(values, 'feature') ? { label: scalarValue(values, 'feature') } : {})
          });
          return;
        }

        case 'focus-prominence': {
          const domain = flattenAnchorIds(anchors.domain)[0];
          const focus = flattenAnchorIds(anchors.focus)[0];
          const background = flattenAnchorIds(anchors.background)[0];
          if (!requireResolved('domain', domain)) return;
          if (!requireResolved('focus', focus)) return;
          if (!requireResolved('background', background)) return;
          items.push({
            ...base,
            kind: 'branch-emphasis',
            strongEdges: [{ fromNodeId: domain, toNodeId: focus }],
            weakEdges: [{ fromNodeId: domain, toNodeId: background }]
          });
          return;
        }

        case 'f-projection': {
          const accentBearer = flattenAnchorIds(anchors.accentBearer)[0];
          const projections = resolvedIds('projections', anchors.projections);
          if (!requireResolved('accentBearer', accentBearer) || projections.length === 0) return;
          const hops = [accentBearer, ...projections];
          hops.slice(0, -1).forEach((fromNodeId, index) => {
            items.push({
              ...base,
              kind: 'directed-path',
              fromNodeId,
              toNodeId: hops[index + 1],
              pathStyle: 'f-projection',
              ...(index === 0 && scalarValue(values, 'accent') ? { label: scalarValue(values, 'accent') } : {})
            });
          });
          return;
        }

        case 'theta-grid': {
          const predicate = flattenAnchorIds(anchors.predicate)[0];
          if (!requireResolved('predicate', predicate)) return;
          const roleEntries = Object.entries(anchors)
            .filter(([role]) => role.toLowerCase() !== 'predicate');
          const roleBadges = roleEntries.flatMap(([role, value], index) => {
            const nodeId = flattenAnchorIds(value)[0];
            if (!requireResolved(role, nodeId)) return [];
            return [{ role, nodeId, ordinal: index + 1 }];
          });
          items.push({
            ...base,
            kind: 'node-plaque',
            anchorNodeIds: [predicate],
            plaqueStyle: 'theta-grid',
            rows: roleBadges.map(({ role }) => ({ label: role, value: '' }))
          });
          if (roleBadges.length > 0) {
            items.push({
              ...base,
              kind: 'node-badges',
              badgeStyle: 'theta-role',
              badges: roleBadges.map(({ nodeId, ordinal }) => ({
                nodeId,
                text: String(ordinal),
                shape: 'plain' as const
              }))
            });
          }
          return;
        }

        case 'gapping-alignment': {
          const antecedent = flattenAnchorIds(anchors.antecedent)[0];
          const gap = flattenAnchorIds(anchors.gap)[0];
          const correlates = resolvedIds('correlates', anchors.correlates);
          const remnants = resolvedIds('remnants', anchors.remnants);
          if (!requireResolved('antecedent', antecedent)) return;
          if (!requireResolved('gap', gap)) return;
          if (correlates.length === 0 || correlates.length !== remnants.length) {
            pushDiagnostic('endpoint-missing', 'GappingAlignment requires positionally paired correlates and remnants');
            return;
          }
          const labels = listValue(values, 'labels');
          items.push({
            ...base,
            kind: 'node-badges',
            badgeStyle: 'gapping-ordinal',
            badges: correlates.flatMap((correlate, index) => [
              { nodeId: correlate, text: labels[index] || String(index + 1), shape: 'plain' as const },
              { nodeId: remnants[index], text: labels[index] || String(index + 1), shape: 'plain' as const }
            ])
          });
          return;
        }

        default: {
          pushDiagnostic(
            'signature-incomplete',
            `family ${family.family} has no compiler branch`
          );
        }
      }
    });
  });

  /*
   * Large-anchor organization: additive, inheriting the parent instance's
   * compiled persistence. Full-array exemption derives from live production
   * ownership only.
   */
  const isFullArrayOwned = (relationName: string, role: string): boolean => {
    const ownedEntry = findRelationRegistryEntry(registry, relationName);
    if (!ownedEntry) return false;
    if (!families[ownedEntry.id]) return false;
    return (FULL_ARRAY_OWNED_ROLES[ownedEntry.id] || []).includes(role);
  };
  const largeSets = compileLargeAnchorSets(stageList, isFullArrayOwned);
  largeSets.diagnostics.forEach((detail) => {
    diagnostics.push({
      stageIndex: -1,
      relationIndex: -1,
      relation: '',
      kind: 'large-array-anchor-unresolved',
      detail
    });
  });
  largeSets.sets.forEach((set) => {
    const stage = stageList[set.stageIndex];
    const relations = Array.isArray(stage?.relations) ? stage.relations : [];
    const relationIndex = set.relationIndex;
    const parentRelation = relationIndex >= 0 ? relations[relationIndex] : undefined;
    const parentItem = items.find((item) =>
      item.relationRef.stageIndex === set.stageIndex
      && item.relationRef.relationIndex === relationIndex);
    items.push({
      kind: 'anchor-set',
      relationRef: {
        stageIndex: set.stageIndex,
        relationIndex,
        relation: set.relation,
        anchors: parentRelation?.anchors ?? {},
        ...(parentRelation?.priorAnchors ? { priorAnchors: parentRelation.priorAnchors } : {}),
        ...(parentRelation?.values ? { values: parentRelation.values } : {})
      },
      appearsAtStage: set.stageIndex,
      persistence: parentItem?.persistence ?? 'stage-only',
      backward: parentItem?.backward ?? false,
      priorWitnessNodeIds: parentItem?.priorWitnessNodeIds ?? [],
      showBadges: parentItem?.kind !== 'fallback',
      badgeSize: parentItem?.familyId === 'pf.cyclic-linearization' ? 'compact' : 'standard',
      set
    });
  });

  /* Materialize into per-stage frames per persistence, before coalescing. */
  const stageCount = stageList.length;
  const frames = Array.from({ length: stageCount }, (_unused, stageIndex) => ({
    stageIndex,
    items: [] as RelationPlanItem[]
  }));
  /*
   * Vanished-anchor law: a persistent mark materializes into a later frame
   * only while every authored anchor that resolved at its authoring stage
   * still exists in that frame's forest. When an anchored node is gone, the
   * mark is NOT drawn there — never retargeted through lineage or a nearby
   * node — while its earlier Replay history keeps the correct mark, and a
   * structured diagnostic records the stage, relation, and missing anchors
   * for developers (the canvas itself shows nothing invented).
   */
  const stageNodeMaps = stageList.map((stage) => collectForest(stage?.workspaceForest));
  const stageNodeIdSets = stageNodeMaps.map((nodesById) => new Set(nodesById.keys()));
  const vanishedAnchorIds = (item: RelationPlanItem, frameIndex: number): string[] => {
    if (frameIndex === item.appearsAtStage) return [];
    const frameNodes = stageNodeIdSets[frameIndex];
    if (!frameNodes) return [];
    return planItemDependencyNodeIds(item).filter((nodeId) => !frameNodes.has(nodeId));
  };
  const reportedVanished = new Set<string>();
  const materializeIntoFrame = (item: RelationPlanItem, frameIndex: number) => {
    const missing = vanishedAnchorIds(item, frameIndex);
    if (missing.length > 0) {
      const dedupeKey = [
        frameIndex,
        item.relationRef.stageIndex,
        item.relationRef.relationIndex,
        [...missing].sort().join(',')
      ].join('|');
      if (!reportedVanished.has(dedupeKey)) {
        reportedVanished.add(dedupeKey);
        diagnostics.push({
          stageIndex: frameIndex,
          relationIndex: item.relationRef.relationIndex,
          relation: item.relationRef.relation,
          kind: 'anchor-vanished',
          detail: `persistent mark from stage ${item.appearsAtStage + 1} is not drawn at stage `
            + `${frameIndex + 1}: anchored node(s) ${missing.join(', ')} no longer exist in this `
            + 'stage\'s forest; the mark keeps its earlier history and is never retargeted'
        });
      }
      return;
    }
    /*
     * Each frame owns its own item instance. Persistence used to push ONE
     * shared object into every licensed frame, so a later frame's
     * coalescing pass — which records contributing authored references on
     * the surviving item — leaked FUTURE references backward into earlier
     * frames through the shared object. A frame-local shallow copy makes
     * provenance frame-local: coalescing reassigns `coalescedRefs` on the
     * frame's own copy, and nested authored payloads stay shared read-only.
     *
     * Declared subtree-derived geometry refreshes from the CURRENT frame's
     * exact anchored root: a persistent Phase arc describes the domain as
     * it stands in the frame it draws in, never the authoring-stage
     * snapshot. The root itself is a dependency, so a vanished root fails
     * the mark closed above — this is refresh, never retargeting.
     */
    const frameLocal: RelationPlanItem = { ...item };
    if (frameIndex > item.appearsAtStage && item.subtreeDerived) {
      const frameNodes = stageNodeMaps[frameIndex];
      item.subtreeDerived.forEach((declaration) => {
        const rootNode = frameNodes?.get(declaration.rootNodeId);
        (frameLocal as unknown as Record<string, unknown>)[declaration.field] =
          declaration.mode === 'authored-silent'
            ? collectAuthoredSilentSubtreeIds(rootNode)
            : collectSubtreeIds(rootNode);
      });
    }
    frames[frameIndex].items.push(frameLocal);
  };
  items.forEach((item) => {
    if (item.appearsAtStage >= stageCount) return;
    if (item.persistence === 'stage-only') {
      frames[item.appearsAtStage].items.push({ ...item });
      return;
    }
    if (item.persistence === 'replace-previous-instance') {
      for (let frameIndex = item.appearsAtStage; frameIndex < stageCount; frameIndex += 1) {
        const replacement = items.find((candidate) =>
          candidate !== item
          && candidate.appearsAtStage > item.appearsAtStage
          && candidate.appearsAtStage <= frameIndex
          && (candidate.replacementGroup === item.replacementGroup
            || (Boolean(candidate.replacementPredecessorGroup)
              && candidate.replacementPredecessorGroup === item.replacementGroup)));
        if (replacement) break;
        materializeIntoFrame(item, frameIndex);
      }
      return;
    }
    for (let frameIndex = item.appearsAtStage; frameIndex < stageCount; frameIndex += 1) {
      materializeIntoFrame(item, frameIndex);
    }
  });

  /*
   * Composition without semantic suppression. Babel never decides that two
   * authored linguistic claims are incompatible merely because they share a
   * visual channel: exactly identical marks are visually coalesced with every
   * contributing relation instance retained in `coalescedRefs`; distinct
   * marks all survive, and the geometry binder routes, offsets, or stacks
   * them apart. Replacement happens only through explicitly declared
   * replace-previous-instance family metadata, upstream of this pass.
   */
  /*
   * Two items may paint once only when they are the SAME COMPLETE semantic
   * claim: same registered render family and every meaning-bearing field —
   * anchors, antecedents, labels, values, outcomes, ghost/member sets, the
   * backward cue, all of it. Sharing a route or a site is not identity; an
   * ellipsis claim naming a different antecedent, or a coincident path from
   * a different family, is a distinct authored claim and must survive for
   * collision routing. The key is therefore the canonical serialization of
   * the whole item minus provenance bookkeeping (`relationRef`,
   * `coalescedRefs`) and the appearance stage — a persisted claim and an
   * identical later restatement still paint once in their co-visible frames.
   */
  const COALESCE_EXCLUDED_FIELDS = new Set(['relationRef', 'coalescedRefs', 'appearsAtStage', 'subtreeDerived']);
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((out, key) => {
          out[key] = canonicalize((value as Record<string, unknown>)[key]);
          return out;
        }, {});
    }
    return value;
  };
  const coalesceKeyOf = (item: RelationPlanItem): string => {
    const content: Record<string, unknown> = {};
    Object.entries(item).forEach(([field, value]) => {
      if (COALESCE_EXCLUDED_FIELDS.has(field)) return;
      content[field] = value;
    });
    /*
     * The authored claim itself is meaning-bearing even where a specialized
     * primitive copies none of it onto its own fields: the complete anchor
     * role/value structure, `priorAnchors`, and every authored value belong
     * to the key. Relation IDENTITY is the registered render family (already
     * part of the item content via `familyId`): two registered aliases of
     * one family making the otherwise-identical complete claim are one
     * claim, and either authored Replay moment can activate the one mark.
     * An UNREGISTERED relation has no registered family, so its normalized
     * authored name is its identity — open relations never collapse across
     * different authored names. Only the authored stage/relation coordinates
     * are provenance and stay excluded — a persisted claim and its identical
     * later restatement still paint once.
     */
    content.authoredClaim = {
      ...(item.familyId
        ? {}
        : { relation: String(item.relationRef.relation || '').trim() }),
      anchors: item.relationRef.anchors ?? {},
      priorAnchors: item.relationRef.priorAnchors ?? null,
      values: item.relationRef.values ?? null
    };
    return JSON.stringify(canonicalize(content));
  };
  frames.forEach((frame) => {
    frame.items.sort((left, right) => {
      const layer = LAYER_ORDER[left.kind] - LAYER_ORDER[right.kind];
      if (layer !== 0) return layer;
      if (left.appearsAtStage !== right.appearsAtStage) {
        return left.appearsAtStage - right.appearsAtStage;
      }
      return left.relationRef.relationIndex - right.relationRef.relationIndex;
    });
    const coalesceHolders = new Map<string, RelationPlanItem>();
    frame.items = frame.items.filter((item) => {
      const key = coalesceKeyOf(item);
      const holder = coalesceHolders.get(key);
      if (holder) {
        const alreadyRecorded = (holder.coalescedRefs || []).some((ref) =>
          ref.stageIndex === item.relationRef.stageIndex
          && ref.relationIndex === item.relationRef.relationIndex)
          || (holder.relationRef.stageIndex === item.relationRef.stageIndex
            && holder.relationRef.relationIndex === item.relationRef.relationIndex);
        if (!alreadyRecorded) {
          holder.coalescedRefs = [...(holder.coalescedRefs || []), item.relationRef];
        }
        return false;
      }
      coalesceHolders.set(key, item);
      return true;
    });
  });

  return {
    planVersion: 1,
    registryId: registry.registryId,
    registryVersion: registry.version,
    stageCount,
    frames,
    diagnostics,
    unregistered: Array.from(unregisteredCounts, ([relation, count]) => ({ relation, count }))
  };
};

/**
 * Replay-step timing: which of a frame's items are visible once
 * `introducedRelationCount` of the current stage's authored relations have
 * had their Replay relation moments. Items persisted from earlier stages are
 * always visible; a same-stage item appears only after its own relation's
 * moment — never merely because its anchors became visible during structural
 * microsteps. Pass `null` for the committed (non-replay) view, which shows
 * the complete frame.
 */
/**
 * Replay-step reveal by EXACT played identity. Playback may place relation
 * moments around structural construction in an order that differs from the
 * authored relation-array order, so a count of played moments is not an
 * identity; callers pass the set of authored relation indices whose moments
 * have actually played in this frame (null = the committed, non-animated
 * view). A coalesced mark reveals when any of its contributing authored
 * instances has played.
 */
export const visiblePlanFrameItems = (
  plan: RelationRenderPlan,
  frameIndex: number,
  playedRelationIndices: ReadonlySet<number> | null
): RelationPlanItem[] => {
  const frame = plan.frames[frameIndex];
  if (!frame) return [];
  if (playedRelationIndices === null) return frame.items;
  return frame.items.filter((item) =>
    item.appearsAtStage < frameIndex
    || [item.relationRef, ...(item.coalescedRefs || [])].some((ref) =>
      ref.stageIndex === frameIndex && playedRelationIndices.has(ref.relationIndex)));
};

/** Whether this visible item represents the authored relation moment in focus. */
export const planItemOwnsRelationMoment = (
  item: RelationPlanItem,
  stageIndex: number,
  relationIndex: number
): boolean => [item.relationRef, ...(item.coalescedRefs || [])].some((ref) =>
  ref.stageIndex === stageIndex && ref.relationIndex === relationIndex);

export { LARGE_ANCHOR_ARRAY_THRESHOLD };
