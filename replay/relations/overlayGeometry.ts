/**
 * Pure overlay geometry for the production relation render plan, promoted
 * from the accepted relation-lab geometry.
 * No DOM, no rendering: everything is exact arithmetic on points and
 * rectangles so the drawing rules can be tested adversarially.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Deterministic lane allocation for horizontal spans.
 *
 * Spans are processed strictly in the order given; each takes the lowest lane
 * none of whose occupants it overlaps once both are padded by `minGap`. Same
 * input always yields the same lanes — no randomness, no dependence on
 * anything but the caller's own ordering.
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
 * Layout plan for large authored anchor arrays. The caller measures real node
 * rectangles after layout and passes them in through `rectFor`; nothing here
 * reads a DOM or guesses an endpoint. Every resolved anchor with measurable
 * geometry is placed — the plan never truncates, never keeps only a first
 * element, and never overwrites an earlier mark: marks that share a node
 * stack in deterministic traversal order. Anchors that cannot be placed are
 * returned in `failed` with a concrete reason. Rails are organizational, not
 * semantic: no arrowheads, no relation-specific styling; colliding rail
 * spans receive distinct lanes deterministically.
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
