/**
 * Pure geometry binding: a compiled plan frame plus the renderer's real
 * post-layout node positions in, positioned drawing primitives out.
 *
 * The renderer (TreeVisualizer) owns layout and supplies `positionFor`; this
 * module never reads a DOM and never guesses a position. A plan item whose
 * node has no measured position fails closed into `failed` with a reason —
 * nothing is drawn at an invented location. The fallback canvas prints no
 * relation names, no role names, no node ids, and no values: its marks are
 * numerals and neutral frames only.
 */
import type { Point, Rect } from './overlayGeometry.ts';
import { allocateSpanLanes, planAnchorSetLayout } from './overlayGeometry.ts';
import {
  ELBOW_ENDPOINT_RADIUS,
  barCapPath,
  blockedEdgeDoubleSlash,
  caseAssignmentPath,
  checkMarkPath,
  domainBracketPath,
  dottedCollectionControls,
  dottedCollectionPath,
  ellipsisSlashPath,
  featureSharingVinePath,
  fongComponentArcPath,
  fongComponentLabelPoint,
  fongEdgeOutlineRect,
  nestedUnderArcPath,
  orthogonalElbowPath,
  pairMergeArcPath,
  pathNodeEllipse,
  pathNodeSquare,
  phaseArcPath,
  routedAgreementControls,
  routedAgreementPath,
  sampleCubic,
  sampleQuadratic,
  sweepingCurveControl,
  sweepingCurvePath,
  transferAccessLanePath,
  vineConvergence
} from './markGeometry.ts';
import type {
  RelationPlanItem,
  RelationRenderPlan
} from './renderPlanCompiler.ts';

export type BoundTrajectory = {
  type: 'trajectory-path';
  trajectoryKind: string;
  from: Point;
  to: Point;
  /** Deterministic ordinal among trajectories sharing this route. */
  ordinal: number;
  /** The exact ready-to-draw movement path; the renderer draws it verbatim. */
  d: string;
  /** The quadratic's control point, for exact bounds computation. */
  control: Point;
  /** Inset start/end points actually used by the path. */
  start: Point;
  end: Point;
  itemIndex: number;
};

export type BoundIndexBadge = {
  type: 'index-badge';
  nodeId: string;
  x: number;
  y: number;
  index: string;
  stackIndex: number;
  itemIndex: number;
};

export type BoundDomainEllipse = {
  type: 'domain-ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  outcome: 'licensed' | 'failed';
  itemIndex: number;
};

export type BoundGhostSet = {
  type: 'ghost-set';
  nodeIds: string[];
  itemIndex: number;
};

export type BoundFallbackMark = {
  type: 'fallback-mark';
  nodeId: string;
  x: number;
  y: number;
  frame: 'circle' | 'box';
  /** 1-based array position numeral, or null for scalar witnesses. */
  numeral: number | null;
  instance: number;
  backward: boolean;
  stackIndex: number;
  itemIndex: number;
};

/**
 * A fallback connector with COMPLETE geometry. The accepted design draws two
 * distinct shapes and the contract preserves that distinction so the
 * renderer cannot collapse them:
 * - `counter-lane` (row 2, two scalar witnesses): a quiet undirected
 *   connector running along its allocated lane below the terminal row, with
 *   short stems into the two visible instance marks;
 * - `direct` (row 3 fan spokes): a thin straight line from the hub's
 *   visible mark to the spoke's visible mark.
 * `d` is the ready-to-draw path anchored at the rendered mark centers; the
 * renderer draws exactly this path and adds nothing.
 */
export type BoundSegment = {
  type: 'segment';
  route: 'counter-lane' | 'direct';
  d: string;
  from: Point;
  to: Point;
  /** Allocated lane for counter-lane connectors; null for direct spokes. */
  lane: number | null;
  /** The lane's actual Y, for downstream vertical allocation (counter-lane only). */
  laneY?: number;
  directed: false;
  itemIndex: number;
};

export type BoundAnchorSetBadge = {
  type: 'anchor-set-badge';
  nodeId: string;
  x: number;
  y: number;
  numeral: number;
  stackIndex: number;
  badgeSize: 'standard' | 'compact';
  itemIndex: number;
};

export type BoundAnchorSetRail = {
  type: 'anchor-set-rail';
  x1: number;
  x2: number;
  lane: number;
  /** Final rail Y from the one vertical allocation law (set at finalize). */
  y: number;
  itemIndex: number;
};

/**
 * A family-specific accepted shape: explicit path data plus its accepted
 * decorations, computed in this module from the pure mark geometry. The
 * renderer draws exactly what is declared here — it never restyles a family
 * from its name.
 */
export type BoundShapePath = {
  type: 'shape-path';
  shapeStyle: string;
  d: string;
  stroke: 'solid' | 'dashed' | 'dotted';
  arrowhead: boolean;
  arrowheadBoth?: boolean;
  /** Filled circular endpoints (dependent-Case / checking elbows). */
  endpointDots?: Point[];
  /** Accepted terminal decoration: bar cap, licensed check, or blocking ✗. */
  tip?: { kind: 'bar' | 'check' | 'cross'; d?: string; at: Point };
  originDot?: Point;
  label?: string;
  labelAt?: Point;
  badge?: { text: string; at: Point };
  blocked?: boolean;
  /**
   * Set when the collision router could not find a clearance route within
   * its budget; the mark keeps its least-obstructive route rather than
   * being suppressed, and this flag makes the compromise diagnosable.
   */
  routing?: 'constrained';
  itemIndex: number;
};

export type BoundDomainRegion = {
  type: 'domain-region';
  domainStyle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  outcome?: 'licensed' | 'blocked';
  itemIndex: number;
};

export type BoundPlaque = {
  type: 'plaque';
  plaqueStyle: string;
  x: number;
  y: number;
  /** Local marker dimensions; the renderer uses the same values it was routed around. */
  width: number;
  height: number;
  anchorPoints: Point[];
  title?: string;
  rows: Array<{ label: string; value: string }>;
  itemIndex: number;
};

export type BoundTextBadge = {
  type: 'text-badge';
  badgeStyle: string;
  nodeId: string;
  x: number;
  y: number;
  text: string;
  shape: 'circle' | 'square' | 'plain';
  stackIndex: number;
  outcome?: 'licensed' | 'blocked';
  itemIndex: number;
};

export type BoundStrike = {
  type: 'strike';
  x1: number;
  x2: number;
  y: number;
  ghostNodeIds: string[];
  itemIndex: number;
};

export type BoundEnclosure = {
  type: 'enclosure';
  licence: string;
  x: number;
  y: number;
  width: number;
  height: number;
  itemIndex: number;
};

export type BoundBranchEmphasis = {
  type: 'branch-emphasis';
  strongEdges: Array<{ from: Point; to: Point }>;
  weakEdges: Array<{ from: Point; to: Point }>;
  itemIndex: number;
};

export type BoundSharedBranch = {
  type: 'shared-branch';
  from: Point;
  to: Point;
  itemIndex: number;
};

/**
 * A Phillips path-status node ring: the primary path's ellipse or the
 * secondary path's square, enclosing the node's own label position.
 */
export type BoundPathNodeRing = {
  type: 'path-node-ring';
  role: 'primary' | 'secondary';
  nodeId: string;
  ellipse?: { cx: number; cy: number; rx: number; ry: number };
  rect?: Rect;
  itemIndex: number;
};

export type BoundPrimitive =
  | BoundTrajectory
  | BoundIndexBadge
  | BoundDomainEllipse
  | BoundGhostSet
  | BoundFallbackMark
  | BoundSegment
  | BoundAnchorSetBadge
  | BoundAnchorSetRail
  | BoundShapePath
  | BoundPathNodeRing
  | BoundDomainRegion
  | BoundPlaque
  | BoundTextBadge
  | BoundStrike
  | BoundEnclosure
  | BoundBranchEmphasis
  | BoundSharedBranch;

export type BoundFrame = {
  stageIndex: number;
  primitives: BoundPrimitive[];
  failed: Array<{ itemIndex: number; nodeId: string; reason: string }>;
};

/**
 * The Replay-lens presentation of authored-silence ghosting, pure and
 * testable. Silent material must never look pronounced: even at its most
 * emphasized, ghost opacity stays below overt material (1.0), and the
 * active emphasis is carried by a glow rather than by brightness alone.
 * During another relation's moment the ghost quiets below its neutral
 * presentation, exactly like every other mark.
 */
export type GhostLensPresentation = { opacity: number; filter: string | null };
export const ghostLensPresentation = (
  emphasis: 'active' | 'quiet' | null
): GhostLensPresentation => {
  if (emphasis === 'active') {
    return { opacity: 0.72, filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.85))' };
  }
  if (emphasis === 'quiet') return { opacity: 0.22, filter: null };
  return { opacity: 0.5, filter: null };
};

/**
 * Complete overlay bounds over the bound primitives, pure and testable —
 * marker glyph extents and labels included, no DOM measurement. Marker pads
 * use a NOMINAL scale so camera fitting is zoom-independent (counter-scaled
 * markers only shrink in world units as zoom grows).
 */
export type OverlayBounds = { minX: number; minY: number; maxX: number; maxY: number };
export const boundOverlayBounds = (
  frame: BoundFrame,
  options: { markerScale?: number } = {}
): OverlayBounds | null => {
  const k = Math.max(0.1, options.markerScale ?? 1);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  const point = (x: number, y: number, pad = 0) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    any = true;
    minX = Math.min(minX, x - pad);
    minY = Math.min(minY, y - pad);
    maxX = Math.max(maxX, x + pad);
    maxY = Math.max(maxY, y + pad);
  };
  const pathPoints = (d: string, pad = 0) => {
    const numbers = d.match(/-?\d+(?:\.\d+)?/g) || [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      point(Number(numbers[index]), Number(numbers[index + 1]), pad);
    }
  };
  /**
   * Conservative text half-width from the ACTUAL string: monospace glyph
   * advance ~0.62em plus breathing room. Bounds must grow with authored
   * text; a constant unrelated to length never suffices.
   */
  const textHalfWidth = (text: string | number | null | undefined, fontSize: number): number => {
    const value = text === null || text === undefined ? '' : String(text);
    if (!value) return 0;
    return (value.length * fontSize * 0.65) / 2 + fontSize * 0.6;
  };
  /**
   * Conservative [leftExtent, rightExtent] of a text run measured FROM its
   * anchor point, honoring the renderer's actual `text-anchor`. A long
   * start-anchored index extends fully to the right of its origin; an
   * end-anchored Phase-edge label extends fully to the left.
   */
  const textSpanFromAnchor = (
    text: string | number | null | undefined,
    fontSize: number,
    anchor: 'start' | 'middle' | 'end'
  ): [number, number] => {
    const value = text === null || text === undefined ? '' : String(text);
    if (!value) return [0, 0];
    const width = value.length * fontSize * 0.65 + fontSize * 0.6;
    if (anchor === 'start') return [0, width];
    if (anchor === 'end') return [width, 0];
    return [width / 2, width / 2];
  };
  /** Include an anchored text run drawn inside a counter-scaled marker. */
  const anchoredText = (
    markerX: number,
    markerY: number,
    text: string | number | null | undefined,
    fontSize: number,
    anchor: 'start' | 'middle' | 'end',
    localOffsetX = 0
  ) => {
    const [left, right] = textSpanFromAnchor(text, fontSize, anchor);
    if (left === 0 && right === 0) return;
    point(markerX + (localOffsetX - left) * k, markerY - fontSize * k);
    point(markerX + (localOffsetX + right) * k, markerY + fontSize * k);
  };
  /** Exact axis extrema of a quadratic Bézier (closed form, clamped). */
  const quadraticExtreme = (p0: number, p1: number, p2: number): [number, number] => {
    let lo = Math.min(p0, p2);
    let hi = Math.max(p0, p2);
    const denominator = p0 - 2 * p1 + p2;
    if (denominator !== 0) {
      const t = (p0 - p1) / denominator;
      if (t > 0 && t < 1) {
        const u = 1 - t;
        const at = u * u * p0 + 2 * u * t * p1 + t * t * p2;
        lo = Math.min(lo, at);
        hi = Math.max(hi, at);
      }
    }
    return [lo, hi];
  };
  frame.primitives.forEach((primitive) => {
    switch (primitive.type) {
      case 'trajectory-path': {
        // Exact quadratic extrema of the rendered path, plus conservative
        // arrowhead/stroke/glow clearance.
        const clearance = 18;
        const [loX, hiX] = quadraticExtreme(primitive.start.x, primitive.control.x, primitive.end.x);
        const [loY, hiY] = quadraticExtreme(primitive.start.y, primitive.control.y, primitive.end.y);
        point(loX, loY, clearance);
        point(hiX, hiY, clearance);
        return;
      }
      case 'index-badge':
        // Renderer: start-anchored 13px text at local x=8.
        point(primitive.x, primitive.y, 10 * k);
        anchoredText(primitive.x, primitive.y, primitive.index, 13, 'start', 8);
        return;
      case 'text-badge':
        point(primitive.x, primitive.y, Math.max(18, textHalfWidth(primitive.text, 12) + 10) * k);
        return;
      case 'fallback-mark':
        // Frame glyph (r=10/18-box) with the centered instance numeral,
        // the start-anchored external position at local x=12, and the
        // start-anchored backward cue at local x=-16 — each with its
        // renderer anchor and font.
        point(primitive.x, primitive.y, 14 * k);
        anchoredText(primitive.x, primitive.y, primitive.instance, 11, 'middle');
        if (primitive.numeral !== null) {
          anchoredText(primitive.x, primitive.y, primitive.numeral, 9, 'start', 12);
        }
        if (primitive.backward) {
          anchoredText(primitive.x, primitive.y, '\u25c2', 10, 'start', -16);
        }
        return;
      case 'anchor-set-badge':
        point(primitive.x, primitive.y, Math.max(16, textHalfWidth(primitive.numeral, 10) + 8) * k);
        return;
      case 'anchor-set-rail':
        point(primitive.x1, primitive.y, 10);
        point(primitive.x2, primitive.y, 10);
        return;
      case 'segment':
        pathPoints(primitive.d, 8);
        return;
      case 'shape-path':
        pathPoints(primitive.d, 10);
        if (primitive.labelAt) {
          point(
            primitive.labelAt.x,
            primitive.labelAt.y,
            Math.max(24, textHalfWidth(primitive.label, 11) + 8) * k
          );
        }
        if (primitive.badge) {
          point(
            primitive.badge.at.x,
            primitive.badge.at.y,
            Math.max(20, textHalfWidth(primitive.badge.text, 11) + 10) * k
          );
        }
        if (primitive.tip) point(primitive.tip.at.x, primitive.tip.at.y, 16 * k);
        return;
      case 'plaque':
        point(primitive.x, primitive.y);
        point(primitive.x + primitive.width * k, primitive.y + primitive.height * k);
        return;
      case 'domain-region': {
        point(primitive.x, primitive.y, 12);
        point(primitive.x + primitive.width, primitive.y + primitive.height, 12);
        // Renderer text: transfer-edge draws end-anchored 12px at
        // (x - 8, y + height/2) — extending LEFT; other labeled/blocked
        // regions draw start-anchored 12px at (x + width, y).
        const regionText = primitive.outcome === 'blocked' ? '\u2717' : primitive.label;
        if (regionText) {
          if (primitive.domainStyle === 'transfer-edge') {
            anchoredText(primitive.x - 8, primitive.y + primitive.height / 2, regionText, 12, 'end');
          } else {
            anchoredText(primitive.x + primitive.width, primitive.y, regionText, 12, 'start');
          }
        }
        return;
      }
      case 'domain-ellipse':
        point(primitive.cx - primitive.rx, primitive.cy - primitive.ry, 8);
        point(primitive.cx + primitive.rx, primitive.cy + primitive.ry, 8);
        return;
      case 'strike':
        point(primitive.x1, primitive.y, 6);
        point(primitive.x2, primitive.y, 6);
        return;
      case 'enclosure':
        point(primitive.x, primitive.y, 6);
        point(primitive.x + primitive.width, primitive.y + primitive.height, 6);
        return;
      case 'branch-emphasis':
        primitive.strongEdges.concat(primitive.weakEdges).forEach((edge) => {
          point(edge.from.x, edge.from.y, 4);
          point(edge.to.x, edge.to.y, 4);
        });
        return;
      case 'shared-branch':
        point(primitive.from.x, primitive.from.y, 4);
        point(primitive.to.x, primitive.to.y, 4);
        return;
      case 'path-node-ring':
        if (primitive.ellipse) {
          point(primitive.ellipse.cx - primitive.ellipse.rx, primitive.ellipse.cy - primitive.ellipse.ry, 4);
          point(primitive.ellipse.cx + primitive.ellipse.rx, primitive.ellipse.cy + primitive.ellipse.ry, 4);
        }
        if (primitive.rect) {
          point(primitive.rect.x, primitive.rect.y, 4);
          point(primitive.rect.x + primitive.rect.width, primitive.rect.y + primitive.rect.height, 4);
        }
        return;
      case 'ghost-set':
        return;
      default:
        return;
    }
  });
  return any ? { minX, minY, maxX, maxY } : null;
};

/**
 * The one terminal-attachment law, pure and shared by every provider: a
 * terminal endpoint is NEVER inferred. If the anchored node is itself the
 * display terminal, it is the endpoint; otherwise exactly one display
 * terminal may exist inside the exact anchored subtree. Zero fails closed
 * as always; MORE than one fails closed as an ambiguity — never resolved
 * by traversal order or current visibility — so full-frame allocation and
 * step-visible drawing can never disagree about an endpoint.
 */
export type TerminalResolution<T> =
  | { terminal: T; reason: 'anchor-terminal' | 'unique' }
  | { terminal: null; reason: 'none' | 'ambiguous'; count: number };
export const resolveUniqueDisplayTerminal = <T>(
  anchor: T,
  childrenOf: (node: T) => readonly T[],
  isDisplayTerminal: (node: T) => boolean
): TerminalResolution<T> => {
  if (isDisplayTerminal(anchor)) return { terminal: anchor, reason: 'anchor-terminal' };
  const terminals: T[] = [];
  const walk = (node: T) => {
    if (isDisplayTerminal(node)) terminals.push(node);
    childrenOf(node).forEach(walk);
  };
  childrenOf(anchor).forEach(walk);
  if (terminals.length === 1) return { terminal: terminals[0], reason: 'unique' };
  if (terminals.length === 0) return { terminal: null, reason: 'none', count: 0 };
  return { terminal: null, reason: 'ambiguous', count: terminals.length };
};

export type BindGeometryOptions = {
  /** Nominal label box, in tree units, centred on the node position. */
  labelWidth?: number;
  labelHeight?: number;
  badgeGap?: number;
  laneGap?: number;
  /** Counter-scale applied to screen-stable marker contents at bind time. */
  markerScale?: number;
  /**
   * Measured baseline Y for counter-lane fallback connectors (typically just
   * below the rendered terminal row). When absent, the binder derives it
   * from the connectors' own measured mark centers — never from semantic
   * guessing.
   */
  connectorBaselineY?: number;
  /**
   * Preferred base Y for large-array rails. The finalized base is
   * max(railBaseY, deepest allocated connector lane + safe gap) — ONE
   * deterministic vertical law owned here, so connectors and rails can
   * never overlap at any lane count.
   */
  railBaseY?: number;
  railLaneGap?: number;
};

/**
 * Position provider contract. `attachment` distinguishes what the plan is
 * asking for:
 * - `'terminal'` — the visible materialized terminal inside the exact
 *   anchored preterminal/witness subtree (never an unrelated descendant);
 * - `'shell'` — the anchored node itself;
 * - `'position'` (default) — the anchored node's own laid-out position, for
 *   badges and organizational marks.
 * Returning null fails the requesting mark closed; the binder never invents
 * a location.
 */
export type PlanPositionProvider = (
  nodeId: string,
  attachment?: 'terminal' | 'shell' | 'position' | 'parent'
) => Point | null;

export const bindRelationPlanFrame = (
  plan: RelationRenderPlan,
  stageIndex: number,
  positionFor: PlanPositionProvider,
  options: BindGeometryOptions = {}
): BoundFrame => {
  const frame = plan.frames[stageIndex];
  const labelWidth = options.labelWidth ?? 80;
  const labelHeight = options.labelHeight ?? 28;
  const badgeGap = options.badgeGap ?? 22;
  const laneGap = options.laneGap ?? 24;
  const markerScale = Math.max(0.1, options.markerScale ?? 1);
  const primitives: BoundPrimitive[] = [];
  const failed: BoundFrame['failed'] = [];
  /*
   * Policy diagnostics are NOT binding failures: an anchor-set entry that
   * never resolved at its authoring stage is, per the accepted large-array
   * policy, a diagnostic while every resolved participant still renders.
   * They live in their own channel so the per-item binding transaction
   * (which rolls back on real missing-geometry failures) never mistakes
   * accepted policy for a broken mark; they merge into `failed` at the end.
   */
  const policyFailed: BoundFrame['failed'] = [];
  if (!frame) return { stageIndex, primitives, failed };

  const rectFor = (nodeId: string): Rect | null => {
    const point = positionFor(nodeId);
    if (!point) return null;
    return {
      x: point.x - labelWidth / 2,
      y: point.y - labelHeight / 2,
      width: labelWidth,
      height: labelHeight
    };
  };
  const requirePoint = (
    itemIndex: number,
    nodeId: string,
    attachment: 'terminal' | 'shell' | 'position' = 'position'
  ): Point | null => {
    const point = positionFor(nodeId, attachment);
    if (!point) {
      failed.push({
        itemIndex,
        nodeId,
        reason: attachment === 'terminal'
          ? 'no visible materialized terminal for the anchored endpoint; mark fails closed'
          : 'no measured position for the anchored node; mark fails closed'
      });
    }
    return point;
  };

  /** Same-node badge stacking, deterministic in frame item order. */
  const stackCounts = new Map<string, number>();
  const nextStackIndex = (nodeId: string): number => {
    const stackIndex = stackCounts.get(nodeId) ?? 0;
    stackCounts.set(nodeId, stackIndex + 1);
    return stackIndex;
  };
  /** Per-route ordinal for coincident trajectories, deterministic in item order. */
  const styleOrdinals = new Map<string, number>();
  const nextStyleOrdinal = (style: string): number => {
    const ordinal = styleOrdinals.get(style) ?? 0;
    styleOrdinals.set(style, ordinal + 1);
    return ordinal;
  };
  /*
   * Geometry-aware curve routing. Routed curves are bound at their base
   * route first and registered here; after every primitive of the frame is
   * bound, the router measures which curves actually come close to each
   * other or cross a plate, and re-routes ONLY those. Far-apart curves keep
   * their base geometry untouched, whatever their style.
   */
  type RoutableCurve = {
    primitive: BoundShapePath;
    sample: (ordinal: number) => Point[];
    rebuild: (ordinal: number) => void;
  };
  const routableCurves: RoutableCurve[] = [];
  const registerRoutedCurve = (
    itemIndex: number,
    sample: (ordinal: number) => Point[],
    build: (ordinal: number) => Omit<BoundShapePath, 'type' | 'itemIndex'>
  ) => {
    const primitive: BoundShapePath = { type: 'shape-path', itemIndex, ...build(0) };
    primitives.push(primitive);
    routableCurves.push({
      primitive,
      sample,
      rebuild: (ordinal) => {
        const carrier = primitive as unknown as Record<string, unknown>;
        Object.keys(carrier).forEach((key) => {
          if (key !== 'type' && key !== 'itemIndex') delete carrier[key];
        });
        Object.assign(carrier, build(ordinal));
      }
    });
  };
  /** World-space plate rectangles, including the marker counter-scale. */
  const plaqueRects: Rect[] = [];
  const intersects = (left: Rect, right: Rect, gap = 0): boolean => !(
    left.x + left.width + gap <= right.x
    || right.x + right.width + gap <= left.x
    || left.y + left.height + gap <= right.y
    || right.y + right.height + gap <= left.y
  );

  const segmentSpans: Array<{ start: number; end: number }> = [];
  const pendingSegments: Array<Omit<BoundSegment, 'lane' | 'd'>> = [];

  const bindPlanItem = (item: RelationPlanItem, itemIndex: number) => {
    if (item.kind === 'trajectory') {
      // Endpoint attachment comes from the semantic plan: the departure is
      // the witness (or source) resolved per sourceAttachment, the landing is
      // the target resolved per targetAttachment. A head target therefore
      // binds to its pronounced terminal, never the preterminal shell.
      const from = requirePoint(
        itemIndex,
        item.witnessNodeId || item.sourceNodeId,
        item.sourceAttachment
      );
      const to = requirePoint(itemIndex, item.targetNodeId, item.targetAttachment);
      if (!from || !to) return;
      /*
       * The complete production movement path is pure binder geometry:
       * coincident routes fan by ordinal, endpoints inset toward each
       * other, and the belly deepens with horizontal span. The renderer
       * draws this path verbatim, and overlay bounds use its exact
       * extrema — no duplicated or guessed curve math anywhere else.
       */
      const ordinal = nextStyleOrdinal(`trajectory:${item.sourceNodeId}->${item.targetNodeId}`);
      const fanOffset = ordinal * 20;
      const direction = Math.sign(to.x - from.x) || 1;
      const start = { x: from.x + 8 * direction, y: from.y + fanOffset };
      const end = { x: to.x - 8 * direction, y: to.y + fanOffset };
      const control = {
        x: (start.x + end.x) / 2,
        y: Math.max(start.y, end.y) + Math.max(42, Math.abs(end.x - start.x) * 0.2) + fanOffset
      };
      primitives.push({
        type: 'trajectory-path',
        trajectoryKind: item.trajectoryKind,
        from,
        to,
        ordinal,
        d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
        control,
        start,
        end,
        itemIndex
      });
      return;
    }

    if (item.kind === 'coindex') {
      item.nodeIds.forEach((nodeId) => {
        const point = requirePoint(itemIndex, nodeId);
        if (!point) return;
        const stackIndex = nextStackIndex(nodeId);
        primitives.push({
          type: 'index-badge',
          nodeId,
          x: point.x + labelWidth / 2,
          y: point.y + stackIndex * badgeGap * markerScale,
          index: item.index,
          stackIndex,
          itemIndex
        });
      });
      return;
    }

    if (item.kind === 'binding-domain') {
      const memberPoints = item.domainMemberNodeIds
        .map((nodeId) => positionFor(nodeId))
        .filter((point): point is Point => Boolean(point));
      if (memberPoints.length === 0) {
        failed.push({
          itemIndex,
          nodeId: item.domainNodeId,
          reason: 'no measured positions inside the domain; mark fails closed'
        });
        return;
      }
      const xs = memberPoints.map((point) => point.x);
      const ys = memberPoints.map((point) => point.y);
      const minX = Math.min(...xs) - labelWidth / 2;
      const maxX = Math.max(...xs) + labelWidth / 2;
      const minY = Math.min(...ys) - labelHeight;
      const maxY = Math.max(...ys) + labelHeight;
      const halfWidth = (maxX - minX) / 2;
      const halfHeight = (maxY - minY) / 2;
      primitives.push({
        type: 'domain-ellipse',
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        rx: halfWidth * Math.SQRT2,
        ry: halfHeight * Math.SQRT2,
        outcome: item.outcome,
        itemIndex
      });
      [item.binderNodeId, item.boundNodeId].forEach((nodeId) => {
        const point = requirePoint(itemIndex, nodeId);
        if (!point) return;
        const stackIndex = nextStackIndex(nodeId);
        primitives.push({
          type: 'index-badge',
          nodeId,
          x: point.x + labelWidth / 2,
          y: point.y + stackIndex * badgeGap,
          index: item.index,
          stackIndex,
          itemIndex
        });
      });
      return;
    }

    if (item.kind === 'ellipsis-site') {
      primitives.push({ type: 'ghost-set', nodeIds: item.ghostNodeIds, itemIndex });
      if (item.familyId === 'ellipsis.licensing') {
        // The licensing composition's separate tall slash spans the authored
        // domain subtree, alongside (not replacing) the authored-silent
        // ghosting.
        const ghostPoints = item.siteSubtreeNodeIds
          .map((nodeId) => positionFor(nodeId))
          .filter((point): point is Point => Boolean(point));
        if (ghostPoints.length > 0) {
          const xs = ghostPoints.map((point) => point.x);
          const ys = ghostPoints.map((point) => point.y);
          primitives.push({
            type: 'shape-path',
            shapeStyle: 'ellipsis-slash',
            d: ellipsisSlashPath({
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(...xs) - Math.min(...xs),
              height: Math.max(...ys) - Math.min(...ys)
            }),
            stroke: 'solid',
            arrowhead: false,
            itemIndex
          });
        }
      }
      return;
    }

    if (item.kind === 'directed-path') {
      const from = requirePoint(itemIndex, item.fromNodeId);
      const to = requirePoint(itemIndex, item.toNodeId);
      if (!from || !to) return;
      const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const below = (point: Point, dy: number): Point => ({ x: point.x, y: point.y + dy });
      const push = (shape: Omit<BoundShapePath, 'type' | 'itemIndex'>) =>
        primitives.push({ type: 'shape-path', itemIndex, ...shape });
      /** A sweeping curve whose belly the collision router may deepen. */
      const registerSweep = (
        start: Point,
        end: Point,
        build: (ordinal: number) => Omit<BoundShapePath, 'type' | 'itemIndex'>
      ) =>
        registerRoutedCurve(
          itemIndex,
          (ordinal) => sampleQuadratic(start, sweepingCurveControl(start, end, ordinal * 26), end),
          build
        );

      switch (item.pathStyle) {
        case 'dependent-case': {
          // The accepted elbow: down from the probe, across to the goal, with
          // filled circular endpoints and never an arrowhead.
          const upper = below(from, labelHeight);
          const lower = { x: to.x - 14, y: to.y };
          push({
            shapeStyle: 'dependent-case',
            d: orthogonalElbowPath(upper, lower),
            stroke: 'solid',
            arrowhead: false,
            endpointDots: [upper, lower],
            ...(item.label ? { label: item.label, labelAt: below(upper, 18) } : {}),
            ...(item.secondaryLabel
              ? { badge: { text: item.secondaryLabel, at: below(lower, 24) } }
              : {})
          });
          return;
        }
        case 'ellipsis-checking': {
          // Aelbrecht's dotted checking elbow with filled dots at both ends.
          const upper = below(from, labelHeight);
          const lower = { x: to.x - 14, y: to.y };
          push({
            shapeStyle: 'ellipsis-checking',
            d: orthogonalElbowPath(upper, lower),
            stroke: 'dotted',
            arrowhead: false,
            endpointDots: [upper, lower],
            ...(item.label ? { label: item.label, labelAt: below(upper, 18) } : {}),
            ...(item.secondaryLabel
              ? { badge: { text: item.secondaryLabel, at: below(lower, 24) } }
              : {})
          });
          return;
        }
        case 'accord': {
          // Hoyt's dashed orthogonal dependency path between the indexed
          // polarity features.
          const upper = below(from, labelHeight);
          const lower = { x: to.x, y: to.y + labelHeight };
          push({
            shapeStyle: 'accord',
            d: orthogonalElbowPath(upper, lower),
            stroke: 'dashed',
            arrowhead: true,
            ...(item.label ? { label: item.label, labelAt: below(upper, 18) } : {})
          });
          return;
        }
        case 'anti-locality': {
          // The dashed comparison curve; blocked movement ends in the source
          // bar cap, licensed movement carries the check.
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: 'anti-locality',
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'dashed',
            arrowhead: false,
            blocked: item.outcome === 'blocked',
            // The bar cap and the licensed check are authored judgments; an
            // instance with no recognized outcome draws the comparison curve
            // with no judgment mark at all.
            ...(item.outcome === 'blocked'
              ? { tip: { kind: 'bar' as const, d: barCapPath(end), at: end } }
              : item.outcome === 'licensed'
                ? { tip: { kind: 'check' as const, d: checkMarkPath(below(midpoint, 30)), at: below(midpoint, 30) } }
                : {})
          }));
          return;
        }
        case 'agree-multiple':
        case 'agree-cyclic': {
          const start = below(from, 24);
          const end = below(to, 24);
          registerRoutedCurve(
            itemIndex,
            (ordinal) => {
              const [c1, c2] = routedAgreementControls(start, end, ordinal);
              return sampleCubic(start, c1, c2, end);
            },
            (ordinal) => ({
              shapeStyle: item.pathStyle,
              d: routedAgreementPath(start, end, ordinal),
              stroke: 'solid',
              arrowhead: true,
              ...(item.pathStyle === 'agree-cyclic' && item.label
                ? { badge: { text: item.label, at: below(midpoint, 40 + ordinal * 26) } }
                : {}),
              ...(item.pathStyle === 'agree-multiple' && item.label
                ? { label: item.label, labelAt: below(midpoint, 40 + ordinal * 26) }
                : {}),
              ...(item.secondaryLabel
                ? { label: item.secondaryLabel, labelAt: below(midpoint, 62 + ordinal * 26) }
                : {})
            })
          );
          return;
        }
        case 'case-assignment': {
          push({
            shapeStyle: 'case-assignment',
            d: caseAssignmentPath(below(from, 8), to),
            stroke: 'solid',
            arrowhead: true,
            ...(item.label ? { label: item.label, labelAt: below(midpoint, 26) } : {})
          });
          return;
        }
        case 'case-agree': {
          // The quieter dotted collection curve feeding the Case path.
          const start = below(from, 16);
          const end = below(to, 16);
          registerRoutedCurve(
            itemIndex,
            (ordinal) => {
              const [c1, c2] = dottedCollectionControls(start, end, ordinal);
              return sampleCubic(start, c1, c2, end);
            },
            (ordinal) => ({
              shapeStyle: 'case-agree',
              d: dottedCollectionPath(start, end, ordinal),
              stroke: 'dotted',
              arrowhead: false,
              ...(item.label ? { label: item.label, labelAt: below(midpoint, 46 + ordinal * 22) } : {})
            })
          );
          return;
        }
        case 'blocked-access': {
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: 'blocked-access',
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'dashed',
            arrowhead: false,
            blocked: true,
            originDot: start,
            tip: { kind: 'cross', at: below(midpoint, 30) }
          }));
          return;
        }
        case 'blocked-extraction': {
          // Oseki's double-ended diagnostic with the authored star label.
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: 'blocked-extraction',
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'dashed',
            arrowhead: true,
            arrowheadBoth: true,
            blocked: true,
            ...(item.label ? { label: item.label, labelAt: below(midpoint, 34) } : {})
          }));
          return;
        }
        case 'intervention': {
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: 'intervention',
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'dashed',
            arrowhead: true,
            blocked: true,
            tip: { kind: 'cross', at: below(midpoint, 30) }
          }));
          return;
        }
        case 'covert-qr':
        case 'f-projection': {
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: item.pathStyle,
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'dashed',
            arrowhead: true,
            ...(item.label ? { label: item.label, labelAt: below(midpoint, 30) } : {})
          }));
          return;
        }
        case 'right-roof': {
          // The extraposition path with the accepted midpoint check or X,
          // drawn only from the authored judgment.
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: 'right-roof',
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'solid',
            arrowhead: true,
            ...(item.outcome === 'blocked'
              ? { blocked: true, tip: { kind: 'cross' as const, at: below(midpoint, 30) } }
              : item.outcome === 'licensed'
                ? { tip: { kind: 'check' as const, d: checkMarkPath(below(midpoint, 30)), at: below(midpoint, 30) } }
                : {})
          }));
          return;
        }
        case 'improper-candidate': {
          // A rejected landing candidate: dashed, into the forbidden region,
          // with the blocking X.
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: 'improper-candidate',
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'dashed',
            arrowhead: true,
            blocked: true,
            tip: { kind: 'cross', at: below(midpoint, 30) }
          }));
          return;
        }
        default: {
          // Control's sourced directed dependency curve.
          const start = below(from, 24);
          const end = below(to, 24);
          registerSweep(start, end, (ordinal) => ({
            shapeStyle: item.pathStyle,
            d: sweepingCurvePath(start, end, ordinal * 26),
            stroke: 'solid',
            arrowhead: true,
            ...(item.label ? { label: item.label, labelAt: below(midpoint, 30) } : {}),
            ...(item.outcome === 'blocked' ? { blocked: true, tip: { kind: 'cross', at: below(midpoint, 30) } } : {})
          }));
        }
      }
      return;
    }

    if (item.kind === 'undirected-link') {
      if (item.linkStyle === 'pair-merge') {
        // The unheaded Pair-Merge arc over both anchored labels.
        item.pairs.forEach((pair) => {
          const memberRect = rectFor(pair.fromNodeId);
          const hostRect = rectFor(pair.toNodeId);
          if (!memberRect || !hostRect) {
            failed.push({
              itemIndex,
              nodeId: !memberRect ? pair.fromNodeId : pair.toNodeId,
              reason: 'no measured position for the anchored node; mark fails closed'
            });
            return;
          }
          primitives.push({
            type: 'shape-path',
            shapeStyle: 'pair-merge',
            d: pairMergeArcPath(memberRect, hostRect),
            stroke: 'solid',
            arrowhead: false,
            itemIndex
          });
        });
        return;
      }
      if (item.linkStyle === 'feature-sharing') {
        // The accepted vine geometry: one cubic per bearer converging on the
        // shared feature point beneath them.
        const bearerIds = [
          ...new Set(item.pairs.flatMap((pair) => [pair.fromNodeId, pair.toNodeId]))
        ];
        const bearerRects = bearerIds
          .map((nodeId) => ({ nodeId, rect: rectFor(nodeId) }))
          .filter((entry): entry is { nodeId: string; rect: Rect } => {
            if (entry.rect) return true;
            failed.push({
              itemIndex,
              nodeId: entry.nodeId,
              reason: 'no measured position for the anchored node; mark fails closed'
            });
            return false;
          });
        if (bearerRects.length < 2) return;
        const convergence = vineConvergence(bearerRects.map((entry) => entry.rect));
        bearerRects.forEach((entry) => {
          const start = {
            x: entry.rect.x + entry.rect.width / 2,
            y: entry.rect.y + entry.rect.height + 22
          };
          primitives.push({
            type: 'shape-path',
            shapeStyle: 'feature-sharing-vine',
            d: featureSharingVinePath(start, convergence),
            stroke: 'solid',
            arrowhead: false,
            itemIndex
          });
        });
        if (item.label) {
          primitives.push({
            type: 'shape-path',
            shapeStyle: 'feature-sharing-label',
            d: `M ${convergence.x} ${convergence.y} L ${convergence.x} ${convergence.y}`,
            stroke: 'solid',
            arrowhead: false,
            label: item.label,
            labelAt: { x: convergence.x, y: convergence.y + 28 },
            itemIndex
          });
        }
        return;
      }
      if (item.linkStyle === 'strong-npi') {
        // Two nested, unheaded licensing curves beneath the authored labels;
        // the outer nest dips deeper.
        item.pairs.forEach((pair, pairIndex) => {
          const from = requirePoint(itemIndex, pair.fromNodeId);
          const to = requirePoint(itemIndex, pair.toNodeId);
          if (!from || !to) return;
          const baseY = Math.max(from.y, to.y) + labelHeight + 12;
          primitives.push({
            type: 'shape-path',
            shapeStyle: 'strong-npi',
            d: nestedUnderArcPath(from.x, to.x, baseY, 44 + pairIndex * 30),
            stroke: 'solid',
            arrowhead: false,
            ...(pairIndex === 0 && item.label
              ? { label: item.label, labelAt: { x: (from.x + to.x) / 2, y: baseY + 60 } }
              : {}),
            itemIndex
          });
        });
        return;
      }
      // Predication's dotted interpretive paths and the gapping pair rails.
      item.pairs.forEach((pair) => {
        const from = requirePoint(itemIndex, pair.fromNodeId);
        const to = requirePoint(itemIndex, pair.toNodeId);
        if (!from || !to) return;
        primitives.push({
          type: 'shape-path',
          shapeStyle: item.linkStyle,
          d: `M ${from.x} ${from.y + 30} L ${to.x} ${to.y + 30}`,
          stroke: 'dotted',
          arrowhead: false,
          ...(pair.label || item.label
            ? {
                label: pair.label || item.label,
                labelAt: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + 48 }
              }
            : {}),
          itemIndex
        });
      });
      return;
    }

    if (item.kind === 'fong-component') {
      // Fong's tilted component arc, labelled at its accepted endpoint.
      const headRect = rectFor(item.headNodeId);
      if (!headRect) {
        failed.push({
          itemIndex,
          nodeId: item.headNodeId,
          reason: 'no measured position for the component head; mark fails closed'
        });
        return;
      }
      const labelAt = fongComponentLabelPoint(headRect);
      primitives.push({
        type: 'shape-path',
        shapeStyle: 'fong-component-arc',
        d: fongComponentArcPath(headRect),
        stroke: 'solid',
        arrowhead: false,
        label: item.componentLabel,
        labelAt,
        itemIndex
      });
      return;
    }

    if (item.kind === 'blocked-access-lane') {
      const source = requirePoint(itemIndex, item.sourceNodeId);
      const target = requirePoint(itemIndex, item.targetNodeId);
      if (!source || !target) return;
      const domainBottom = item.domainMemberNodeIds
        .map((nodeId) => positionFor(nodeId))
        .filter((point): point is Point => Boolean(point))
        .reduce((bottom, point) => Math.max(bottom, point.y + labelHeight), Math.max(source.y, target.y));
      const start = { x: source.x, y: source.y + labelHeight / 2 + 12 };
      const end = { x: target.x, y: target.y + labelHeight / 2 + 12 };
      const lane = transferAccessLanePath(start, end, domainBottom);
      primitives.push({
        type: 'shape-path',
        shapeStyle: 'transfer-access',
        d: lane.d,
        stroke: 'dashed',
        arrowhead: false,
        blocked: true,
        originDot: start,
        tip: { kind: 'cross', at: { x: (start.x + end.x) / 2, y: lane.laneY } },
        itemIndex
      });
      return;
    }

    if (item.kind === 'path-status') {
      const ringFor = (nodeId: string, role: 'primary' | 'secondary') => {
        const labelRect = rectFor(nodeId);
        if (!labelRect) {
          failed.push({
            itemIndex,
            nodeId,
            reason: 'no measured position for the path node; mark fails closed'
          });
          return;
        }
        primitives.push({
          type: 'path-node-ring',
          role,
          nodeId,
          ...(role === 'primary'
            ? { ellipse: pathNodeEllipse(labelRect) }
            : { rect: pathNodeSquare(labelRect) }),
          itemIndex
        });
      };
      item.primaryNodeIds.forEach((nodeId) => ringFor(nodeId, 'primary'));
      item.secondaryNodeIds.forEach((nodeId) => ringFor(nodeId, 'secondary'));
      if (item.outcome === 'blocked' && item.blockedEdgeNodeId) {
        const child = positionFor(item.blockedEdgeNodeId, 'shell');
        const parent = positionFor(item.blockedEdgeNodeId, 'parent');
        // A branch with no measurable direction (missing parent, or parent
        // coinciding with the child) cannot carry the slash honestly.
        const measurableBranch = Boolean(child && parent)
          && Math.hypot((child!.x - parent!.x), (child!.y - parent!.y)) > 1;
        if (child && parent && measurableBranch) {
          blockedEdgeDoubleSlash(parent, child).forEach((slash) => {
            primitives.push({
              type: 'shape-path',
              shapeStyle: 'blocked-edge-slash',
              d: `M ${slash.x1.toFixed(1)} ${slash.y1.toFixed(1)} L ${slash.x2.toFixed(1)} ${slash.y2.toFixed(1)}`,
              stroke: 'solid',
              arrowhead: false,
              blocked: true,
              itemIndex
            });
          });
        } else {
          failed.push({
            itemIndex,
            nodeId: item.blockedEdgeNodeId,
            reason: 'no measured branch geometry for the blocked edge; the slash fails closed'
          });
        }
      }
      return;
    }

    if (item.kind === 'domain-mark') {
      if (item.domainStyle === 'transfer-edge') {
        // The accepted Phase-edge outline box around the edge label.
        const edgeRect = rectFor(item.rootNodeId || item.memberNodeIds[0] || '');
        if (!edgeRect) {
          failed.push({
            itemIndex,
            nodeId: item.rootNodeId || item.memberNodeIds[0] || '(none)',
            reason: 'no measured position for the phase edge; mark fails closed'
          });
          return;
        }
        const outline = fongEdgeOutlineRect(edgeRect);
        primitives.push({
          type: 'domain-region',
          domainStyle: 'transfer-edge',
          x: outline.x,
          y: outline.y,
          width: outline.width,
          height: outline.height,
          ...(item.label ? { label: item.label } : {}),
          itemIndex
        });
        return;
      }
      /*
       * Members declared subtree-derived are presentational and may shrink
       * to the currently measurable subset (mid-assembly reality). Members
       * NOT declared derived are the authored claim itself (Improper
       * Movement's forbidden region): every one is required, and a missing
       * one is diagnosed — never a silently smaller region.
       */
      const membersAreDerived = (item.subtreeDerived || [])
        .some((declaration) => declaration.field === 'memberNodeIds');
      const memberPoints = item.memberNodeIds
        .map((nodeId) => (membersAreDerived ? positionFor(nodeId) : requirePoint(itemIndex, nodeId)))
        .filter((point): point is Point => Boolean(point));
      if (memberPoints.length === 0) {
        failed.push({
          itemIndex,
          nodeId: item.rootNodeId || item.memberNodeIds[0] || '(none)',
          reason: 'no measured positions inside the domain; mark fails closed'
        });
        return;
      }
      const xs = memberPoints.map((point) => point.x);
      const ys = memberPoints.map((point) => point.y);
      const domainRect: Rect = {
        x: Math.min(...xs) - labelWidth / 2,
        y: Math.min(...ys) - labelHeight,
        width: Math.max(...xs) - Math.min(...xs) + labelWidth,
        height: Math.max(...ys) - Math.min(...ys) + labelHeight * 2
      };

      if (item.domainStyle === 'phase') {
        // The accepted phase arc, apexed above the phase head — never a
        // rectangle.
        const headRect = (item.rootNodeId ? rectFor(item.rootNodeId) : null) || domainRect;
        primitives.push({
          type: 'shape-path',
          shapeStyle: 'phase-arc',
          d: phaseArcPath(headRect, domainRect, null, true),
          stroke: 'solid',
          arrowhead: false,
          itemIndex
        });
        return;
      }
      if (item.domainStyle === 'idiom') {
        // The interpretation bracket beneath the domain.
        primitives.push({
          type: 'shape-path',
          shapeStyle: 'idiom-bracket',
          d: domainBracketPath(domainRect.x, domainRect.x + domainRect.width, domainRect.y + domainRect.height + 20),
          stroke: 'solid',
          arrowhead: false,
          itemIndex
        });
        return;
      }
      if (item.domainStyle === 'argument-domain') {
        // Argument-sharing draws its stretched ovals, not boxes.
        primitives.push({
          type: 'domain-ellipse',
          cx: domainRect.x + domainRect.width / 2,
          cy: domainRect.y + domainRect.height / 2,
          rx: (domainRect.width / 2) * Math.SQRT2,
          ry: (domainRect.height / 2) * Math.SQRT2,
          outcome: 'licensed',
          itemIndex
        });
        return;
      }
      primitives.push({
        type: 'domain-region',
        domainStyle: item.domainStyle,
        x: domainRect.x,
        y: domainRect.y,
        width: domainRect.width,
        height: domainRect.height,
        ...(item.label ? { label: item.label } : {}),
        ...(item.outcome ? { outcome: item.outcome } : {}),
        itemIndex
      });
      return;
    }

    if (item.kind === 'node-plaque') {
      const anchorPoints = item.anchorNodeIds
        .map((nodeId) => requirePoint(itemIndex, nodeId))
        .filter((point): point is Point => Boolean(point));
      if (anchorPoints.length === 0) return;
      const anchor = anchorPoints[0];
      const rows = item.rows.slice(0, 8);
      const width = Math.max(
        96,
        ...(item.title ? [item.title.length * 7 + 24] : []),
        ...rows.map((row) => (`${row.label}: ${row.value}`).length * 6.4 + 24)
      );
      const height = 20 + rows.length * 15;
      let x = anchor.x + labelWidth / 2;
      let y = anchor.y + labelHeight;
      let worldRect: Rect = {
        x,
        y,
        width: width * markerScale,
        height: height * markerScale
      };
      // Nearby plates, not only plates with the same exact anchor, stack
      // below one another. This uses their actual screen-stable footprint.
      for (let attempt = 0; attempt < plaqueRects.length + 1; attempt += 1) {
        const blockers = plaqueRects.filter((rect) => intersects(worldRect, rect, 10 * markerScale));
        if (blockers.length === 0) break;
        y = Math.max(...blockers.map((rect) => rect.y + rect.height)) + 14 * markerScale;
        worldRect = { ...worldRect, y };
      }
      primitives.push({
        type: 'plaque',
        plaqueStyle: item.plaqueStyle,
        x,
        y,
        width,
        height,
        anchorPoints,
        ...(item.title ? { title: item.title } : {}),
        rows: item.rows,
        itemIndex
      });
      plaqueRects.push(worldRect);
      return;
    }

    if (item.kind === 'node-badges') {
      item.badges.forEach((badge) => {
        const point = requirePoint(itemIndex, badge.nodeId);
        if (!point) return;
        const stackIndex = nextStackIndex(badge.nodeId);
        primitives.push({
          type: 'text-badge',
          badgeStyle: item.badgeStyle,
          nodeId: badge.nodeId,
          x: point.x + labelWidth / 2,
          y: point.y + stackIndex * badgeGap * markerScale,
          text: badge.text,
          shape: badge.shape,
          stackIndex,
          ...(item.outcome ? { outcome: item.outcome } : {}),
          itemIndex
        });
      });
      return;
    }

    if (item.kind === 'strike-ghost') {
      item.strikeNodeIds.forEach((nodeId) => {
        const point = requirePoint(itemIndex, nodeId);
        if (!point) return;
        primitives.push({
          type: 'strike',
          x1: point.x - labelWidth / 2,
          x2: point.x + labelWidth / 2,
          y: point.y,
          ghostNodeIds: item.ghostNodeIds,
          itemIndex
        });
      });
      return;
    }

    if (item.kind === 'enclosure') {
      const point = requirePoint(itemIndex, item.nodeId, 'shell');
      if (!point) return;
      primitives.push({
        type: 'enclosure',
        licence: item.licence,
        x: point.x - labelWidth,
        y: point.y - labelHeight,
        width: labelWidth * 2,
        height: labelHeight * 3,
        itemIndex
      });
      return;
    }

    if (item.kind === 'branch-emphasis') {
      const bindEdges = (edges: Array<{ fromNodeId: string; toNodeId: string }>) =>
        edges.flatMap((edge) => {
          const from = requirePoint(itemIndex, edge.fromNodeId);
          const to = requirePoint(itemIndex, edge.toNodeId);
          return from && to ? [{ from, to }] : [];
        });
      const strongEdges = bindEdges(item.strongEdges);
      const weakEdges = bindEdges(item.weakEdges);
      if (strongEdges.length === 0 && weakEdges.length === 0) return;
      primitives.push({ type: 'branch-emphasis', strongEdges, weakEdges, itemIndex });
      return;
    }

    if (item.kind === 'shared-node') {
      const shared = requirePoint(itemIndex, item.sharedNodeId, 'shell');
      if (!shared) return;
      item.parentNodeIds.forEach((parentNodeId) => {
        const parent = requirePoint(itemIndex, parentNodeId, 'shell');
        if (!parent) return;
        primitives.push({ type: 'shared-branch', from: parent, to: shared, itemIndex });
      });
      return;
    }

    if (item.kind === 'fallback') {
      const markPoints = new Map<string, Point>();
      const markCenters = new Map<string, Point>();
      item.drawing.marks.forEach((mark) => {
        const point = requirePoint(itemIndex, mark.witness);
        if (!point) return;
        markPoints.set(mark.witness, point);
        const stackIndex = nextStackIndex(mark.witness);
        markCenters.set(mark.witness, {
          x: point.x,
          y: point.y + labelHeight + stackIndex * badgeGap * markerScale
        });
        primitives.push({
          type: 'fallback-mark',
          nodeId: mark.witness,
          x: point.x,
          y: point.y + labelHeight + stackIndex * badgeGap * markerScale,
          frame: mark.frame,
          numeral: mark.position,
          instance: mark.instance,
          backward: mark.backward,
          stackIndex,
          itemIndex
        });
      });
      /*
       * Connector endpoints are the RENDERED mark centers — label offset and
       * same-node stack offset included — never raw node positions.
       */
      const markCenterOf = (witnessId: string): Point | null => {
        const center = markCenters.get(witnessId);
        if (center) return center;
        // A witness that was among the drawing's marks already recorded its
        // missing position in the mark loop; re-requiring it here would
        // duplicate the diagnostic.
        if (item.drawing.marks.some((mark) => mark.witness === witnessId)) return null;
        return requirePoint(itemIndex, witnessId);
      };
      if (item.drawing.link) {
        const first = markCenterOf(item.drawing.link.endpoints[0]);
        const second = markCenterOf(item.drawing.link.endpoints[1]);
        if (first && second) {
          const left = first.x <= second.x ? first : second;
          const right = left === first ? second : first;
          pendingSegments.push({
            type: 'segment',
            route: 'counter-lane',
            from: left,
            to: right,
            directed: false,
            itemIndex
          });
          segmentSpans.push({
            start: Math.min(left.x, right.x),
            end: Math.max(left.x, right.x)
          });
        }
      }
      if (item.drawing.fan) {
        const hub = markCenterOf(item.drawing.fan.hub);
        item.drawing.fan.spokes.forEach((spoke) => {
          const target = markCenterOf(spoke);
          if (!hub || !target) return;
          // Direct thin spoke between the visible marks, trimmed clear of
          // both mark glyphs — never rerouted through a counter lane.
          const trim = 10 * markerScale;
          const length = Math.hypot(target.x - hub.x, target.y - hub.y) || 1;
          const unit = { x: (target.x - hub.x) / length, y: (target.y - hub.y) / length };
          const start = { x: hub.x + unit.x * trim, y: hub.y + unit.y * trim };
          const end = { x: target.x - unit.x * trim, y: target.y - unit.y * trim };
          primitives.push({
            type: 'segment',
            route: 'direct',
            d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
            from: hub,
            to: target,
            lane: null,
            directed: false,
            itemIndex
          });
        });
      }
      return;
    }

    if (item.kind === 'anchor-set') {
      const layout = planAnchorSetLayout(
        [{
          relation: item.set.relation,
          instanceIndex: item.set.instanceIndex,
          roles: item.set.roles
        }],
        rectFor,
        { badgeOffsetY: badgeGap * markerScale, railGap: laneGap }
      );
      const unresolvedAtAuthoring = new Set(
        item.set.roles.flatMap((roleGroup) =>
          roleGroup.anchors
            .filter((anchor) => !anchor.resolved)
            .map((anchor) => String(anchor.nodeId || '').trim()))
      );
      layout.failed.forEach((failure) => {
        const channel = unresolvedAtAuthoring.has(String(failure.nodeId || '').trim())
          ? policyFailed
          : failed;
        channel.push({ itemIndex, nodeId: failure.nodeId, reason: failure.reason });
      });
      (item.showBadges ? layout.badges : []).forEach((badge) => {
        primitives.push({
          type: 'anchor-set-badge',
          nodeId: badge.nodeId,
          x: badge.x,
          y: badge.y,
          numeral: badge.arrayIndex + 1,
          stackIndex: badge.stackIndex,
          badgeSize: item.badgeSize,
          itemIndex
        });
      });
      layout.rails.forEach((rail) => {
        primitives.push({
          type: 'anchor-set-rail',
          x1: rail.x1,
          x2: rail.x2,
          lane: rail.lane,
          y: 0,
          itemIndex
        });
      });
      return;
    }
  };

  /*
   * ATOMIC PER-ITEM BINDING. One plan item is one visual assertion: either
   * every geometry dependency it requires resolves and the COMPLETE set of
   * primitives is emitted, or the item emits nothing and only its truthful
   * `failed` diagnostics remain. A lone index badge is not a two-node
   * coreference. Each item runs inside a transaction over every piece of
   * mutable binder state; any failure recorded while binding the item rolls
   * all of it back — primitives, routed-curve registrations, segment lanes,
   * plaque occupancy, and the stacking/ordinal counters the next valid item
   * must not inherit. Independent plan items still bind or fail
   * independently.
   */
  const restoreMap = <K, V>(target: Map<K, V>, snapshot: Map<K, V>) => {
    target.clear();
    snapshot.forEach((value, key) => target.set(key, value));
  };
  frame.items.forEach((item: RelationPlanItem, itemIndex) => {
    const txn = {
      primitives: primitives.length,
      failed: failed.length,
      routable: routableCurves.length,
      spans: segmentSpans.length,
      pending: pendingSegments.length,
      plaques: plaqueRects.length,
      stacks: new Map(stackCounts),
      ordinals: new Map(styleOrdinals)
    };
    bindPlanItem(item, itemIndex);
    if (failed.length > txn.failed) {
      primitives.length = txn.primitives;
      routableCurves.length = txn.routable;
      segmentSpans.length = txn.spans;
      pendingSegments.length = txn.pending;
      plaqueRects.length = txn.plaques;
      restoreMap(stackCounts, txn.stacks);
      restoreMap(styleOrdinals, txn.ordinals);
    }
  });

  /*
   * Collision routing over measured geometry, deterministic in item order.
   * Two curves conflict only when their sampled base routes actually come
   * within clearance of each other — coincident or crossing curves route
   * apart with within-cluster ordinals; far-apart curves of any style keep
   * ordinal 0 and are never shifted. Plates are treated as obstacles: a
   * curve crossing one deepens its route until clear when a lawful route
   * exists within the try budget; otherwise the mark keeps its
   * least-obstructive route and is flagged `routing: 'constrained'` instead
   * of being suppressed. Domain regions are containment semantics, not
   * occluders — a path may lawfully live inside its own domain — so they
   * are not obstacles.
   */
  const CURVE_CLEARANCE = 24;
  const OBSTACLE_MARGIN = 6;
  const PLAQUE_ROUTING_WIDTH = 150;
  if (routableCurves.length > 0) {
    const baseSamples = routableCurves.map((curve) => curve.sample(0));
    const parent = routableCurves.map((_curve, index) => index);
    const findRoot = (index: number): number => {
      let root = index;
      while (parent[root] !== root) root = parent[root];
      let cursor = index;
      while (parent[cursor] !== root) {
        const next = parent[cursor];
        parent[cursor] = root;
        cursor = next;
      }
      return root;
    };
    const near = (left: Point[], right: Point[]): boolean => {
      const limitSquared = CURVE_CLEARANCE * CURVE_CLEARANCE;
      return left.some((p) => right.some((q) => {
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        return dx * dx + dy * dy < limitSquared;
      }));
    };
    for (let i = 0; i < routableCurves.length; i += 1) {
      for (let j = i + 1; j < routableCurves.length; j += 1) {
        if (near(baseSamples[i], baseSamples[j])) parent[findRoot(i)] = findRoot(j);
      }
    }
    const obstacles = primitives.flatMap((primitive) =>
      primitive.type === 'plaque'
        ? [{
            x: primitive.x - OBSTACLE_MARGIN,
            y: primitive.y - OBSTACLE_MARGIN,
            width: Math.max(PLAQUE_ROUTING_WIDTH, primitive.width * markerScale) + OBSTACLE_MARGIN * 2,
            height: primitive.height * markerScale + OBSTACLE_MARGIN * 2
          }]
        : []);
    const insideObstacle = (point: Point): boolean =>
      obstacles.some((rect) =>
        point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height);
    const usedByCluster = new Map<number, Set<number>>();
    routableCurves.forEach((curve, index) => {
      const root = findRoot(index);
      const used = usedByCluster.get(root) ?? new Set<number>();
      usedByCluster.set(root, used);
      let base = 0;
      while (used.has(base)) base += 1;
      const clears = (ordinal: number): boolean =>
        !curve.sample(ordinal).some(insideObstacle);
      let chosen = base;
      let cleared = clears(base);
      for (let bump = 1; !cleared && bump <= 3; bump += 1) {
        const candidate = base + bump;
        if (used.has(candidate)) continue;
        if (clears(candidate)) {
          chosen = candidate;
          cleared = true;
        }
      }
      used.add(chosen);
      if (chosen !== 0) curve.rebuild(chosen);
      if (!cleared) curve.primitive.routing = 'constrained';
    });
  }

  /*
   * Path labels are screen-stable markers too. Stack only labels whose
   * measured boxes actually collide with another label or plate; unrelated
   * labels keep their source-backed position.
   */
  const labelRects: Rect[] = [];
  primitives.forEach((primitive) => {
    if (primitive.type !== 'shape-path' || !primitive.label || !primitive.labelAt) return;
    const width = Math.max(16, primitive.label.length * 7) * markerScale;
    const height = 16 * markerScale;
    const base = primitive.labelAt;
    const candidates = [0, 1, -1, 2, -2, 3, -3];
    let chosen = base;
    for (const lane of candidates) {
      const candidate = { x: base.x, y: base.y + lane * (height + 8 * markerScale) };
      const rect = {
        x: candidate.x - width / 2,
        y: candidate.y - height,
        width,
        height
      };
      if (![...plaqueRects, ...labelRects].some((occupied) => intersects(rect, occupied, 4 * markerScale))) {
        chosen = candidate;
        labelRects.push(rect);
        break;
      }
    }
    primitive.labelAt = chosen;
  });

  /*
   * Deterministic lanes for counter-lane fallback connectors, in item
   * order, rendered as COMPLETE geometry: the allocated lane picks the
   * connector's own below-row Y, and the path descends from each rendered
   * mark, turns into the lane, and rises into the other mark. Colliding
   * spans therefore occupy visibly distinct lanes; the renderer draws `d`
   * verbatim and cannot discard the routing.
   */
  const lanes = allocateSpanLanes(segmentSpans, laneGap);
  const measuredBaseline = options.connectorBaselineY
    ?? (pendingSegments.length > 0
      ? Math.max(...pendingSegments.flatMap((segment) => [segment.from.y, segment.to.y])) + 46 * markerScale
      : 0);
  pendingSegments.forEach((segment, index) => {
    const lane = lanes[index];
    const laneY = measuredBaseline + lane * laneGap;
    const stem = 6 * markerScale;
    const corner = 9 * markerScale;
    const d = [
      `M ${segment.from.x.toFixed(1)} ${(segment.from.y + stem).toFixed(1)}`,
      `L ${segment.from.x.toFixed(1)} ${(laneY - corner).toFixed(1)}`,
      `Q ${segment.from.x.toFixed(1)} ${laneY.toFixed(1)} ${(segment.from.x + corner).toFixed(1)} ${laneY.toFixed(1)}`,
      `L ${(segment.to.x - corner).toFixed(1)} ${laneY.toFixed(1)}`,
      `Q ${segment.to.x.toFixed(1)} ${laneY.toFixed(1)} ${segment.to.x.toFixed(1)} ${(laneY - corner).toFixed(1)}`,
      `L ${segment.to.x.toFixed(1)} ${(segment.to.y + stem).toFixed(1)}`
    ].join(' ');
    primitives.push({ ...segment, lane, laneY, d });
  });
  /*
   * The one vertical allocation law: rails sit a safe gap below the deepest
   * ACTUALLY allocated connector lane (or at the caller's measured base,
   * whichever is deeper).
   */
  const deepestConnectorLaneY = primitives.reduce((deepest, primitive) =>
    (primitive.type === 'segment' && primitive.route === 'counter-lane'
      ? Math.max(deepest, primitive.laneY ?? 0)
      : deepest), 0);
  const railLaneGap = options.railLaneGap ?? 60;
  const effectiveRailBase = Math.max(
    options.railBaseY ?? 0,
    deepestConnectorLaneY > 0 ? deepestConnectorLaneY + 90 : 0
  );
  primitives.forEach((primitive) => {
    if (primitive.type === 'anchor-set-rail') {
      primitive.y = effectiveRailBase + primitive.lane * railLaneGap;
    }
  });

  failed.push(...policyFailed);

  return { stageIndex, primitives, failed };
};
