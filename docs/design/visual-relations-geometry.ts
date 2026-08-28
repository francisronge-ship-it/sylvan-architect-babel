/**
 * Pure geometry for relation overlays.
 *
 * No DOM, no rendering, no lab imports: everything here is exact arithmetic on
 * points and rectangles so the drawing rules can be tested adversarially rather
 * than eyeballed in a screenshot.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const rectContains = (point: Point, rect: Rect): boolean =>
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height;

/**
 * Exact point where the segment `from` → `to` leaves `rect`.
 *
 * Assumes `from` is inside and `to` is outside; returns the intersection with
 * whichever rectangle edge is met first. Solved per edge rather than by
 * sampling, so the result is the true crossing and not the nearest sample.
 */
export const segmentRectExit = (from: Point, to: Point, rect: Rect): Point | null => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  const candidates: number[] = [];
  const consider = (t: number) => {
    if (!Number.isFinite(t) || t <= 0 || t > 1) return;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    const slack = 1e-9;
    if (x >= left - slack && x <= right + slack && y >= top - slack && y <= bottom + slack) {
      candidates.push(t);
    }
  };

  if (dx !== 0) {
    consider((left - from.x) / dx);
    consider((right - from.x) / dx);
  }
  if (dy !== 0) {
    consider((top - from.y) / dy);
    consider((bottom - from.y) / dy);
  }
  if (candidates.length === 0) return null;
  const t = Math.min(...candidates);
  return { x: from.x + dx * t, y: from.y + dy * t };
};

export type BoundaryExit =
  | { ok: true; point: Point; segmentIndex: number; edge: RectEdge }
  | { ok: false; reason: string };

export type RectEdge = 'top' | 'bottom' | 'left' | 'right';

/** Which edge of `rect` the point sits on, within tolerance. */
export const edgeAt = (point: Point, rect: Rect, tolerance = 0.5): RectEdge | null => {
  if (Math.abs(point.y - rect.y) <= tolerance) return 'top';
  if (Math.abs(point.y - (rect.y + rect.height)) <= tolerance) return 'bottom';
  if (Math.abs(point.x - rect.x) <= tolerance) return 'left';
  if (Math.abs(point.x - (rect.x + rect.width)) <= tolerance) return 'right';
  return null;
};

/**
 * Orient a sampled path so it runs from the authored origin outward.
 *
 * Boundary logic reads the path from the lower occurrence toward the landing.
 * If the renderer ever hands back the reverse, a reversed *copy* is used for the
 * calculation; the drawn trajectory is never touched.
 */
export const orientPathFromOrigin = (path: Point[], origin: Point): Point[] => {
  if (path.length < 2) return path;
  const first = Math.hypot(path[0].x - origin.x, path[0].y - origin.y);
  const last = Math.hypot(path[path.length - 1].x - origin.x, path[path.length - 1].y - origin.y);
  return last < first ? [...path].reverse() : path;
};

/**
 * Where a dependency leaves one authored boundary region.
 *
 * A bounding-node cut asserts that the dependency escaped that node, so the
 * geometry has to show exactly that:
 *
 *   - the dependency must *start inside* the region, which is the geometric
 *     counterpart of the boundary dominating the origin;
 *   - it must leave exactly once;
 *   - it must never re-enter, because a path that wanders out and back in has
 *     no single escape point to mark.
 *
 * Anything else is refused rather than approximated.
 */
export const findBoundaryExit = (path: Point[], region: Rect): BoundaryExit => {
  if (path.length < 2) return { ok: false, reason: 'path has no segments' };
  if (region.width <= 0 || region.height <= 0) return { ok: false, reason: 'region is degenerate' };
  if (!rectContains(path[0], region)) return { ok: false, reason: 'origin is not inside the boundary' };

  /*
   * Every departure is recorded, whichever edge it uses. Skipping the downward
   * ones would let a path leave through the bottom, come back in, and leave
   * again later: the second departure would then look like the only one and get
   * marked as the escape, when in truth the dependency wandered out and back.
   * Counting all of them means such a path has two exits and is refused.
   */
  const exits: Array<{ point: Point; segmentIndex: number; edge: RectEdge }> = [];

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (!rectContains(previous, region) || rectContains(current, region)) continue;
    const point = segmentRectExit(previous, current, region);
    if (!point) return { ok: false, reason: 'exit segment does not meet the region edge' };
    const edge = edgeAt(point, region);
    if (!edge) return { ok: false, reason: 'exit does not land on a region edge' };
    exits.push({ point, segmentIndex: index, edge });
  }

  if (exits.length === 0) return { ok: false, reason: 'dependency never leaves the boundary' };
  if (exits.length > 1) return { ok: false, reason: 'dependency leaves the boundary more than once' };
  /*
   * A single downward departure is still not an escape. Leaving a constituent
   * means clearing it upward or to the side; dropping below it is routing, and
   * marking that point would put the cut where every nested subtree's bottom
   * edge coincides.
   */
  if (exits[0].edge === 'bottom') {
    return { ok: false, reason: 'dependency leaves through the bottom, which is routing rather than an escape' };
  }
  return { ok: true, point: exits[0].point, segmentIndex: exits[0].segmentIndex, edge: exits[0].edge };
};

export type BoundaryCrossings =
  | { ok: true; crossings: Array<{ point: Point; segmentIndex: number }> }
  | { ok: false; reason: string };

/** Two crossings closer than this are not visually separable and are refused. */
export const MIN_CROSSING_SEPARATION = 8;

/**
 * Every authored boundary must yield exactly one outward crossing, and the
 * crossings must be distinguishable from one another. Coincident exits would
 * stack several cuts in one place, which reads as a single mark and silently
 * loses one of the authored boundaries.
 */
export const findBoundaryCrossings = (path: Point[], regions: Rect[]): BoundaryCrossings => {
  if (regions.length === 0) return { ok: false, reason: 'no authored boundary' };
  const crossings: Array<{ point: Point; segmentIndex: number }> = [];
  for (const region of regions) {
    const exit = findBoundaryExit(path, region);
    if (exit.ok !== true) return { ok: false, reason: exit.reason };
    crossings.push({ point: exit.point, segmentIndex: exit.segmentIndex });
  }
  for (let a = 0; a < crossings.length; a += 1) {
    for (let b = a + 1; b < crossings.length; b += 1) {
      const gap = Math.hypot(
        crossings[a].point.x - crossings[b].point.x,
        crossings[a].point.y - crossings[b].point.y
      );
      if (gap < MIN_CROSSING_SEPARATION) {
        return { ok: false, reason: 'boundary crossings coincide and cannot be drawn apart' };
      }
    }
  }
  return { ok: true, crossings };
};

/**
 * Whether a bounding-node crossing may be drawn at all. Zero rendered paths
 * leaves nothing to interrupt; several leaves the binding ambiguous, and
 * choosing one would invent a claim the relation never authored.
 */
export const bindCrossingDependencyPath = (
  renderedPathCount: number
): 'bound' | 'no-dependency' | 'ambiguous' => {
  if (renderedPathCount === 1) return 'bound';
  return renderedPathCount === 0 ? 'no-dependency' : 'ambiguous';
};

/**
 * Vertical position of a trajectory's control points.
 *
 * A movement path runs from its lower occurrence up to its landing, so it has no
 * business dipping below the occurrence it starts from: an overshoot puts the
 * curve outside every constituent it is supposed to leave, and the boundary it
 * crosses can then only be read off the bottom edge of each subtree, where all
 * of them coincide.
 *
 * The control points are therefore clamped to the source-to-target vertical
 * envelope. Concurrent chains are still separated, but by moving *up* inside the
 * envelope rather than sagging below it. Endpoints are not touched.
 */
export const trajectoryControlY = (
  startY: number,
  endY: number,
  index = 0,
  step = 16
): number => {
  const bottom = Math.max(startY, endY);
  const top = Math.min(startY, endY);
  const stacked = bottom - index * step;
  return Math.min(bottom, Math.max(top, stacked));
};

/**
 * The smallest axis-aligned ellipse that contains `rect` plus padding.
 *
 * A binding domain has to hold the whole constituent it names, label glyphs
 * included. An ellipse drawn on the rectangle's own half-extents cuts its
 * corners off, which is how the V ended up outside the circle; a rectangle of
 * half-extents (w, h) sits inside an ellipse only when (w/rx)² + (h/ry)² ≤ 1, so
 * the radii are the padded half-extents scaled by √2.
 */
export const containingEllipse = (
  rect: Rect,
  padX = 0,
  padY = 0
): { cx: number; cy: number; rx: number; ry: number } => {
  const halfWidth = rect.width / 2 + padX;
  const halfHeight = rect.height / 2 + padY;
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    rx: halfWidth * Math.SQRT2,
    ry: halfHeight * Math.SQRT2
  };
};

/** Whether a rectangle lies wholly inside an ellipse. */
export const ellipseContainsRect = (
  ellipse: { cx: number; cy: number; rx: number; ry: number },
  rect: Rect
): boolean => {
  if (ellipse.rx <= 0 || ellipse.ry <= 0) return false;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height }
  ];
  return corners.every((corner) => {
    const dx = (corner.x - ellipse.cx) / ellipse.rx;
    const dy = (corner.y - ellipse.cy) / ellipse.ry;
    return dx * dx + dy * dy <= 1 + 1e-9;
  });
};

/** Do two axis-aligned rectangles overlap at all? */
export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Convex hull of a point set, counter-clockwise (Andrew's monotone chain).
 *
 * Used to draw a domain mark that hugs what it names. An ellipse or a bounding
 * box over a constituent's extent encloses the empty canvas between its
 * branches; a hull over the anchored objects' own rectangles follows their
 * outline, so the mark covers the relation and very little else.
 */
export const convexHull = (points: Point[]): Point[] => {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (sequence: Point[]) => {
    const chain: Point[] = [];
    sequence.forEach((point) => {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) {
        chain.pop();
      }
      chain.push(point);
    });
    return chain;
  };
  const lower = build(sorted);
  const upper = build([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

/** The four corners of a rectangle, optionally grown by a margin. */
export const rectCorners = (rect: Rect, margin = 0): Point[] => [
  { x: rect.x - margin, y: rect.y - margin },
  { x: rect.x + rect.width + margin, y: rect.y - margin },
  { x: rect.x + rect.width + margin, y: rect.y + rect.height + margin },
  { x: rect.x - margin, y: rect.y + rect.height + margin }
];

/** Whether a point lies inside a polygon, boundary counting as inside. */
export const polygonContainsPoint = (polygon: Point[], point: Point): boolean => {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = (a.y > point.y) !== (b.y > point.y);
    if (straddles) {
      const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (point.x <= x) inside = !inside;
    }
  }
  if (inside) return true;
  // On an edge, within a hair, still counts.
  return polygon.some((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y) < 1e-6;
    const distance = Math.abs(
      (b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)
    ) / length;
    const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length * length);
    return distance < 1e-6 && along >= -1e-9 && along <= 1 + 1e-9;
  });
};

/** Area enclosed by a polygon. */
export const polygonArea = (polygon: Point[]): number => {
  let total = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    total += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
  }
  return Math.abs(total / 2);
};

/**
 * The orthogonal movement path the roll-up and smuggling sources draw.
 *
 * Neither figure uses a sweeping curve. Both run the dependency straight down
 * out of the moved constituent, straight across to the landing's column, then
 * straight up into the landing — an L, or a bracket when the drop and the rise
 * are both visible. Reproducing that shape matters: the long horizontal segment
 * is what shows the constituent travelling past the material it crosses, and the
 * short vertical rise is what shows where it lands.
 *
 * `laneY` is the depth of the horizontal run. It is the caller's business, since
 * only the caller knows how deep the tree is under the moved constituent.
 */
export const orthogonalTrajectory = (
  start: Point,
  end: Point,
  laneY: number
): string => [
  `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
  `L ${start.x.toFixed(1)} ${laneY.toFixed(1)}`,
  `L ${end.x.toFixed(1)} ${laneY.toFixed(1)}`,
  `L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
].join(' ');

/**
 * The corner points of that path, in travel order, so a check can assert the
 * segments really are axis-aligned rather than trusting the string.
 */
export const orthogonalTrajectoryPoints = (
  start: Point,
  end: Point,
  laneY: number
): Point[] => [
  { x: start.x, y: start.y },
  { x: start.x, y: laneY },
  { x: end.x, y: laneY },
  { x: end.x, y: end.y }
];

/** Every segment of a polyline runs along an axis, within tolerance. */
export const isOrthogonalPath = (points: Point[], tolerance = 0.01): boolean => {
  if (points.length < 2) return false;
  for (let index = 1; index < points.length; index += 1) {
    const dx = Math.abs(points[index].x - points[index - 1].x);
    const dy = Math.abs(points[index].y - points[index - 1].y);
    if (dx > tolerance && dy > tolerance) return false;
  }
  return true;
};

/**
 * A rectangle drawn around a constituent: the remnant's landing enclosure and
 * the smuggling carrier's chunk share this geometry, though not their licensing.
 * The padding is uniform so the box reads as an enclosure rather than a frame
 * fitted to one particular tree.
 */
export const enclosureRect = (rect: Rect, padX: number, padY: number): Rect => ({
  x: rect.x - padX,
  y: rect.y - padY,
  width: rect.width + padX * 2,
  height: rect.height + padY * 2
});

/**
 * Deterministic lane allocation for horizontal spans.
 *
 * Spans are processed strictly in the order given; each takes the lowest lane
 * none of whose occupants it overlaps once both are padded by `minGap`. Same
 * input always yields the same lanes — no randomness, no dependence on
 * anything but the caller's own ordering — so a layout that routed cleanly
 * once routes cleanly forever.
 */
export const allocateSpanLanes = (
  spans: Array<{ start: number; end: number }>,
  minGap = 0
): number[] => {
  const lanes: Array<Array<{ start: number; end: number }>> = [];
  return spans.map((span) => {
    const start = Math.min(span.start, span.end) - minGap;
    const end = Math.max(span.start, span.end) + minGap;
    let laneIndex = lanes.findIndex((lane) =>
      lane.every((occupant) => end < occupant.start || start > occupant.end));
    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push([]);
    }
    lanes[laneIndex].push({ start, end });
    return laneIndex;
  });
};

/**
 * Layout plan for large authored anchor arrays.
 *
 * The planner is pure: the caller measures real node rectangles after tree
 * layout and passes them in through `rectFor`; nothing here reads the DOM or
 * guesses an endpoint. Every resolved anchor with a measurable rectangle is
 * placed — the plan never truncates, never keeps only a first element, and
 * never overwrites an earlier mark: marks that share a node stack in
 * deterministic traversal order. Anchors that cannot be placed are returned in
 * `failed` with a concrete reason instead of being silently dropped or given
 * an invented position.
 *
 * Rails are organizational, not semantic: a rail underlines that a role group
 * belongs together, in the authored order, and carries no arrowhead and no
 * relation-specific styling. Rails whose spans would collide receive distinct
 * lanes from `allocateSpanLanes`, again in traversal order.
 */
export type AnchorSetLayoutInput = Array<{
  relation: string;
  instanceIndex: number;
  roles: Array<{
    role: string;
    large: boolean;
    anchors: Array<{ nodeId: string; arrayIndex: number; resolved: boolean }>;
  }>;
}>;

export type AnchorSetBadge = {
  setIndex: number;
  role: string;
  nodeId: string;
  arrayIndex: number;
  /** How many earlier badges already sit on this node; 0 is the first. */
  stackIndex: number;
  x: number;
  y: number;
};

export type AnchorSetRail = {
  setIndex: number;
  role: string;
  lane: number;
  x1: number;
  x2: number;
};

export type AnchorSetLayout = {
  badges: AnchorSetBadge[];
  rails: AnchorSetRail[];
  failed: Array<{ setIndex: number; role: string; nodeId: string; reason: string }>;
};

export const planAnchorSetLayout = (
  sets: AnchorSetLayoutInput,
  rectFor: (nodeId: string) => Rect | null,
  config: { badgeOffsetY?: number; railGap?: number } = {}
): AnchorSetLayout => {
  const badgeOffsetY = config.badgeOffsetY ?? 14;
  const railGap = config.railGap ?? 12;
  const badges: AnchorSetBadge[] = [];
  const failed: AnchorSetLayout['failed'] = [];
  const stackCounts = new Map<string, number>();
  const railSpans: Array<{ setIndex: number; role: string; start: number; end: number }> = [];

  sets.forEach((set, setIndex) => {
    set.roles.forEach((roleGroup) => {
      if (!roleGroup.large) return;
      const placed: AnchorSetBadge[] = [];
      roleGroup.anchors.forEach((anchor) => {
        if (!anchor.resolved) {
          failed.push({
            setIndex,
            role: roleGroup.role,
            nodeId: anchor.nodeId,
            reason: 'anchor does not resolve in its stage; mark fails closed'
          });
          return;
        }
        const rect = rectFor(anchor.nodeId);
        if (!rect) {
          failed.push({
            setIndex,
            role: roleGroup.role,
            nodeId: anchor.nodeId,
            reason: 'no measured geometry for the anchored node; mark fails closed'
          });
          return;
        }
        const stackIndex = stackCounts.get(anchor.nodeId) ?? 0;
        stackCounts.set(anchor.nodeId, stackIndex + 1);
        const badge: AnchorSetBadge = {
          setIndex,
          role: roleGroup.role,
          nodeId: anchor.nodeId,
          arrayIndex: anchor.arrayIndex,
          stackIndex,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height + badgeOffsetY * (stackIndex + 1)
        };
        placed.push(badge);
        badges.push(badge);
      });
      if (placed.length >= 2) {
        railSpans.push({
          setIndex,
          role: roleGroup.role,
          start: Math.min(...placed.map((badge) => badge.x)),
          end: Math.max(...placed.map((badge) => badge.x))
        });
      }
    });
  });

  const lanes = allocateSpanLanes(railSpans, railGap);
  const rails: AnchorSetRail[] = railSpans.map((span, index) => ({
    setIndex: span.setIndex,
    role: span.role,
    lane: lanes[index],
    x1: span.start,
    x2: span.end
  }));

  return { badges, rails, failed };
};
