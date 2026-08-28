/**
 * FALLBACK PROTOTYPES — accepted design, disposable cards.
 *
 * The fallback design is accepted (Francis, 2026-08-07) and its dispatcher is
 * production law in replay/relations/fallbackTopology.ts. These cards
 * stay research fixtures for visual judgment only.
 *
 * Draws the corrected unknown-relation fallback as disposable prototype cards
 * inside the current Lab, using Babel's own card chrome, palette, typography,
 * and Replay presentation. Everything on the tree is a renderer overlay:
 * `workspaceForest` is never touched, no ghost node is added, and no relation
 * name, role name, or node ID is printed on the canvas — Replay already
 * carries the words.
 *
 * Timing is the corrected rule: an instance exists only from its authored
 * relation stage onward. A card pinned to an earlier frame renders that frame
 * exactly as Babel always would, with no fallback mark at all.
 */
import React, { useEffect, useMemo, useRef } from 'react';

import TreeVisualizer from '../../components/TreeVisualizer';
import { toRendererStages } from './visual-relations-lab-adapter.ts';
import {
  FALLBACK_PROTOTYPE_CARDS,
  fallbackDrawing,
  type FallbackDrawing,
  type FallbackPrototypeCard
} from './visual-relations-fallback-prototypes-data.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Replay auto-advance budgets, mirroring the Lab's own card behavior. */
const FBPROTO_MAX_REPLAY_CLICKS = 80;
const FBPROTO_MAX_REPLAY_WAITS = 150;
const FBPROTO_DISABLED_GRACE_POLLS = 6;

type LocalRect = { x: number; y: number; width: number; height: number };
type LocalPoint = { x: number; y: number };

/**
 * Only the marks the accepted Lab does not already own. Colours, weights and
 * typography are Babel's: the plaque shell fill and emerald frame, the feature
 * text colour, and the trajectory stroke with its teal glow. Instance marks
 * are framed monospace chips so they never read as an ordinary co-index, which
 * Babel draws as an italic serif subscript.
 */
const FBPROTO_CSS = `
.babel-fbproto-lane {
  margin-top: 18px;
}
.babel-fbproto-mark-frame {
  fill: rgba(2, 18, 13, 0.86);
  stroke: rgba(94, 234, 157, 0.72);
  filter: drop-shadow(0 0 5px rgba(20, 184, 166, 0.2));
}
.babel-fbproto-mark-number {
  fill: #ecfdf5;
  font-family: "JetBrains Mono", monospace;
  font-weight: 800;
}
.babel-fbproto-mark-position {
  fill: #6ee7b7;
  font-family: "JetBrains Mono", monospace;
  font-weight: 800;
  paint-order: stroke;
  stroke: rgba(1, 8, 5, 0.9);
}
.babel-fbproto-mark-backward {
  fill: rgba(167, 243, 208, 0.95);
  filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.5));
}
.babel-fbproto-connector-shadow {
  fill: none;
  stroke: rgba(2, 12, 8, 0.85);
  stroke-linecap: round;
}
.babel-fbproto-connector {
  fill: none;
  stroke: #34d399;
  stroke-linecap: round;
  filter: drop-shadow(0 0 5px rgba(52, 211, 153, 0.42));
}
.babel-fbproto-connector-hit.babel-fbproto-instance {
  fill: none;
  stroke: transparent;
  stroke-linecap: round;
  pointer-events: stroke;
}
.babel-fbproto-instance {
  pointer-events: auto;
  cursor: pointer;
}
.babel-fbproto-hot .babel-fbproto-mark-frame {
  stroke: #6ee7b7;
  filter: drop-shadow(0 0 7px rgba(52, 211, 153, 0.65));
}
.babel-fbproto-hot.babel-fbproto-connector {
  stroke: #6ee7b7;
  filter: drop-shadow(0 0 8px rgba(52, 211, 153, 0.6));
}
`;

function FallbackPrototypeCardView({ card }: { card: FallbackPrototypeCard }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [archetype, title] = card.title.split(' · ');
  const relation = card.derivationStages[card.relationStageIndex]?.relations[0];
  const drawing = useMemo<FallbackDrawing | null>(
    () => (relation ? fallbackDrawing(relation) : null),
    [relation]
  );
  const rendererStages = useMemo(
    () => toRendererStages(card.derivationStages),
    [card.derivationStages]
  );

  useEffect(() => {
    const host = cardRef.current;
    if (!host || !drawing) return;

    let cancelled = false;
    let clicks = 0;
    let waits = 0;
    let syncBlocked = false;

    const fixStandaloneLogoPath = () => {
      host.querySelectorAll<HTMLImageElement>('img[src="/babellogo.png"]').forEach((image) => {
        image.src = '../../public/babellogo.png';
      });
    };

    const findAnchorElement = (id: string): SVGGraphicsElement | null =>
      host.querySelector<SVGGraphicsElement>(
        `.category-label[data-category-node-id="${id}"], .category-label[data-category-node-id^="${id}::"], [data-node-id="${id}"], [data-node-id^="${id}::"]`
      );

    const findTreeViewportGroup = (svg: SVGSVGElement) =>
      Array.from(svg.children).find((child): child is SVGGElement =>
        child.tagName.toLowerCase() === 'g' && Boolean(child.querySelector('.terminal-label')));

    const localRectForElements = (
      space: SVGGraphicsElement,
      elements: SVGGraphicsElement[]
    ): LocalRect | null => {
      const matrix = space.getScreenCTM();
      if (!matrix || !elements.length) return null;
      const points: LocalPoint[] = [];
      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width && !rect.height) return;
        [
          [rect.left, rect.top],
          [rect.right, rect.top],
          [rect.right, rect.bottom],
          [rect.left, rect.bottom]
        ].forEach(([x, y]) => {
          const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
          points.push({ x: point.x, y: point.y });
        });
      });
      if (!points.length) return null;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      };
    };

    const witnessRect = (space: SVGGraphicsElement, id: string): LocalRect | null => {
      const element = findAnchorElement(id);
      return element ? localRectForElements(space, [element]) : null;
    };

    /**
     * Every node ID in the authored subtree rooted at `id`. Read from the
     * authored tree, never from ID spelling: sibling IDs do not share prefixes,
     * so a prefix query would silently miss the words under a witness.
     */
    const subtreeIds = (id: string): string[] => {
      const find = (current: typeof card.data): typeof card.data | null => {
        if (current.id === id) return current;
        for (const child of current.children || []) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      };
      const collect = (current: typeof card.data): string[] => [
        ...(current.id ? [current.id] : []),
        ...(current.children || []).flatMap(collect)
      ];
      const root = find(card.data);
      return root ? collect(root) : [id];
    };

    /** Whole-subtree box, so a below-lane connector drops clear of the words. */
    const witnessSpanRect = (space: SVGGraphicsElement, id: string): LocalRect | null => {
      const elements = subtreeIds(id).flatMap((nodeId) => Array.from<SVGGraphicsElement>(
        host.querySelectorAll<SVGGraphicsElement>(
          `[data-node-id="${nodeId}"], [data-node-id^="${nodeId}::"], .category-label[data-category-node-id="${nodeId}"]`
        )
      ));
      return localRectForElements(space, elements) || witnessRect(space, id);
    };

    const contentRect = (space: SVGGElement): LocalRect | null => localRectForElements(
      space,
      Array.from(space.querySelectorAll<SVGGraphicsElement>('.category-label, .terminal-label'))
    );

    /**
     * Tree-local mark scale derived from the labels that are actually visible.
     * The frame remains legible on a dense tree, but never keeps an oversized
     * fixed screen diameter while TreeVisualizer scales the tree underneath it.
     */
    const unitScale = (space: SVGGraphicsElement): number => {
      const matrix = space.getScreenCTM();
      const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
      if (!Number.isFinite(scale) || scale <= 0) return 1;

      const labelHeights = Array.from<SVGGraphicsElement>(
        space.querySelectorAll<SVGGraphicsElement>('.category-label, .terminal-label')
      )
        .map((label) => label.getBoundingClientRect().height)
        .filter((height) => Number.isFinite(height) && height > 0)
        .sort((a, b) => a - b);
      const medianLabelHeight = labelHeights.length
        ? labelHeights[Math.floor(labelHeights.length / 2)]
        : 10;
      const targetDiameterPx = Math.min(13, Math.max(9, medianLabelHeight * 1.15));

      // Existing geometry is authored around an 18px frame diameter.
      return (1 / scale) * (targetDiameterPx / 18);
    };

    const svgElement = (name: string, className: string): SVGElement => {
      const element = document.createElementNS(SVG_NS, name);
      element.setAttribute('class', className);
      return element;
    };

    /**
     * One instance mark: a framed instance number, optionally with its authored
     * array position and the backward cue. Placed beside the witness label so it
     * covers no label, terminal, feature, or branch.
     */
    type Placement = { mark: FallbackDrawing['marks'][number]; cx: number; cy: number; radius: number };

    /**
     * Where a mark can sit beside its witness. Computed for every mark before
     * anything is drawn, so connectors can join marks that are already known to
     * stand in free space.
     */
    const placeMark = (
      space: SVGGElement,
      mark: FallbackDrawing['marks'][number],
      k: number,
      occupied: LocalRect[]
    ): Placement | null => {
      const rect = witnessRect(space, mark.witness);
      if (!rect) return null;

      const radius = 9 * k;
      /*
       * The mark sits beside its witness, on the first side that is actually
       * free. Dense trees leave no room on the right of every node, and a mark
       * that covered a neighbouring label would be worse than useless. Side
       * carries no meaning: it is chosen deterministically from the layout.
       */
      const gap = 15 * k + (mark.backward ? 7 * k : 0);
      const extent = radius + (mark.position !== null ? 7 * k : 0);
      const candidates: LocalPoint[] = [
        { x: rect.x + rect.width + gap, y: rect.y + rect.height / 2 },
        { x: rect.x - gap - (mark.backward ? 0 : 0), y: rect.y + rect.height / 2 },
        { x: rect.x + rect.width / 2, y: rect.y - gap },
        { x: rect.x + rect.width + gap, y: rect.y - gap },
        { x: rect.x - gap, y: rect.y - gap }
      ];
      const hits = (point: LocalPoint) => {
        const box: LocalRect = {
          x: point.x - radius - (mark.backward ? 7 * k : 0),
          y: point.y - radius,
          width: extent + radius + (mark.backward ? 7 * k : 0),
          height: radius * 2
        };
        return occupied.some((other) =>
          box.x < other.x + other.width - 0.5
          && box.x + box.width > other.x + 0.5
          && box.y < other.y + other.height - 0.5
          && box.y + box.height > other.y + 0.5);
      };
      const spot = candidates.find((point) => !hits(point)) || candidates[0];
      const cx = spot.x;
      const cy = spot.y;
      occupied.push({
        x: cx - radius - (mark.backward ? 7 * k : 0),
        y: cy - radius,
        width: extent + radius + (mark.backward ? 7 * k : 0),
        height: radius * 2
      });
      return { mark, cx, cy, radius };
    };

    const drawMark = (layer: SVGGElement, placement: Placement, k: number) => {
      const { mark, cx, cy, radius } = placement;

      const group = svgElement('g', 'babel-fbproto-instance') as SVGGElement;
      group.setAttribute('data-fbproto-instance', String(mark.instance));
      group.setAttribute('data-fbproto-frame', mark.frame);
      if (mark.position !== null) group.setAttribute('data-fbproto-position', String(mark.position));
      if (mark.backward) group.setAttribute('data-fbproto-backward', 'true');

      if (mark.backward) {
        // Small backward cue: this instance also has an authored witness one
        // Replay frame back. It points, it does not connect.
        const cue = svgElement('path', 'babel-fbproto-mark-backward');
        const tipX = cx - radius - 5 * k;
        const baseX = cx - radius - 0.5 * k;
        cue.setAttribute('d', [
          `M ${tipX.toFixed(1)} ${cy.toFixed(1)}`,
          `L ${baseX.toFixed(1)} ${(cy - 4.6 * k).toFixed(1)}`,
          `L ${baseX.toFixed(1)} ${(cy + 4.6 * k).toFixed(1)}`,
          'Z'
        ].join(' '));
        group.appendChild(cue);
      }

      if (mark.frame === 'box') {
        const frame = svgElement('rect', 'babel-fbproto-mark-frame');
        frame.setAttribute('x', (cx - radius).toFixed(1));
        frame.setAttribute('y', (cy - radius).toFixed(1));
        frame.setAttribute('width', (radius * 2).toFixed(1));
        frame.setAttribute('height', (radius * 2).toFixed(1));
        frame.setAttribute('rx', (2.5 * k).toFixed(1));
        frame.style.strokeWidth = `${(1.5 * k).toFixed(2)}px`;
        group.appendChild(frame);
      } else {
        const frame = svgElement('circle', 'babel-fbproto-mark-frame');
        frame.setAttribute('cx', cx.toFixed(1));
        frame.setAttribute('cy', cy.toFixed(1));
        frame.setAttribute('r', radius.toFixed(1));
        frame.style.strokeWidth = `${(1.5 * k).toFixed(2)}px`;
        group.appendChild(frame);
      }

      const number = svgElement('text', 'babel-fbproto-mark-number');
      number.setAttribute('x', cx.toFixed(1));
      number.setAttribute('y', cy.toFixed(1));
      number.setAttribute('text-anchor', 'middle');
      number.setAttribute('dominant-baseline', 'central');
      number.style.fontSize = `${(11 * k).toFixed(1)}px`;
      number.textContent = String(mark.instance);
      group.appendChild(number);

      if (mark.position !== null) {
        const position = svgElement('text', 'babel-fbproto-mark-position');
        position.setAttribute('x', (cx + radius + 1.5 * k).toFixed(1));
        position.setAttribute('y', (cy + radius * 0.75).toFixed(1));
        position.setAttribute('text-anchor', 'start');
        position.style.fontSize = `${(9 * k).toFixed(1)}px`;
        position.style.strokeWidth = `${(2.4 * k).toFixed(2)}px`;
        position.textContent = String(mark.position);
        group.appendChild(position);
      }

      layer.appendChild(group);
    };

    /**
     * Association fan: thin plain lines from the single witness's mark to each
     * array witness's mark, in authored order. Joining the marks keeps the lines
     * in the free space the placement pass already found, and makes the grouping
     * legible without labelling anything.
     */
    const drawFan = (layer: SVGGElement, placements: Map<string, Placement>, k: number) => {
      if (!drawing.fan) return;
      const hub = placements.get(drawing.fan.hub);
      if (!hub) return;
      drawing.fan.spokes.forEach((witness) => {
        const target = placements.get(witness);
        if (!target) return;
        const dx = target.cx - hub.cx;
        const dy = target.cy - hub.cy;
        const length = Math.hypot(dx, dy) || 1;
        const unit = { x: dx / length, y: dy / length };
        const hubPoint: LocalPoint = {
          x: hub.cx + unit.x * (hub.radius + 2 * k),
          y: hub.cy + unit.y * (hub.radius + 2 * k)
        };
        const end: LocalPoint = {
          x: target.cx - unit.x * (target.radius + 2 * k),
          y: target.cy - unit.y * (target.radius + 2 * k)
        };
        const d = `M ${hubPoint.x.toFixed(1)} ${hubPoint.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
        const shadow = svgElement('path', 'babel-fbproto-connector-shadow');
        shadow.setAttribute('d', d);
        shadow.style.strokeWidth = `${(3.6 * k).toFixed(2)}px`;
        layer.appendChild(shadow);
        const line = svgElement('path', 'babel-fbproto-connector babel-fbproto-instance');
        line.setAttribute('d', d);
        line.setAttribute('data-fbproto-instance', String(drawing.instance));
        line.setAttribute('data-fbproto-connector', 'fan');
        line.style.strokeWidth = `${(1.5 * k).toFixed(2)}px`;
        layer.appendChild(line);
        const hit = svgElement('path', 'babel-fbproto-connector-hit babel-fbproto-instance');
        hit.setAttribute('d', d);
        hit.setAttribute('data-fbproto-instance', String(drawing.instance));
        hit.setAttribute('data-fbproto-connector', 'fan-hit');
        hit.style.strokeWidth = `${(28 * k).toFixed(2)}px`;
        layer.appendChild(hit);
      });
    };

    /**
     * Counter-lane link: one undirected curve in the reserved lane below the
     * terminal row, where no registered above-tree convention draws.
     */
    const drawLink = (layer: SVGGElement, space: SVGGElement, k: number) => {
      if (!drawing.link) return;
      const first = witnessSpanRect(space, drawing.link.endpoints[0]);
      const second = witnessSpanRect(space, drawing.link.endpoints[1]);
      const content = contentRect(space);
      if (!first || !second || !content) return;

      const left = first.x <= second.x ? first : second;
      const right = left === first ? second : first;
      const laneY = content.y + content.height + 34 * k;
      const startX = left.x + left.width / 2;
      const endX = right.x + right.width / 2;
      const d = [
        `M ${startX.toFixed(1)} ${(left.y + left.height + 6 * k).toFixed(1)}`,
        `L ${startX.toFixed(1)} ${(laneY - 8 * k).toFixed(1)}`,
        `Q ${startX.toFixed(1)} ${laneY.toFixed(1)} ${(startX + 9 * k).toFixed(1)} ${laneY.toFixed(1)}`,
        `L ${(endX - 9 * k).toFixed(1)} ${laneY.toFixed(1)}`,
        `Q ${endX.toFixed(1)} ${laneY.toFixed(1)} ${endX.toFixed(1)} ${(laneY - 8 * k).toFixed(1)}`,
        `L ${endX.toFixed(1)} ${(right.y + right.height + 6 * k).toFixed(1)}`
      ].join(' ');

      const shadow = svgElement('path', 'babel-fbproto-connector-shadow');
      shadow.setAttribute('d', d);
      shadow.style.strokeWidth = `${(4.4 * k).toFixed(2)}px`;
      layer.appendChild(shadow);
      const line = svgElement('path', 'babel-fbproto-connector babel-fbproto-instance');
      line.setAttribute('d', d);
      line.setAttribute('data-fbproto-instance', String(drawing.instance));
      line.setAttribute('data-fbproto-connector', 'link');
      line.style.strokeWidth = `${(1.9 * k).toFixed(2)}px`;
      layer.appendChild(line);
      const hit = svgElement('path', 'babel-fbproto-connector-hit babel-fbproto-instance');
      hit.setAttribute('d', d);
      hit.setAttribute('data-fbproto-instance', String(drawing.instance));
      hit.setAttribute('data-fbproto-connector', 'link-hit');
      hit.style.strokeWidth = `${(28 * k).toFixed(2)}px`;
      layer.appendChild(hit);
    };

    /** Hovering any part of an instance lights the whole instance. */
    const linkInstanceSelection = (layer: SVGGElement) => {
      const parts = Array.from(layer.querySelectorAll<SVGElement>('[data-fbproto-instance]'));
      parts.forEach((element) => {
        const instance = element.getAttribute('data-fbproto-instance');
        const setHot = (on: boolean) => parts.forEach((other) => {
          if (other.getAttribute('data-fbproto-instance') === instance) {
            other.classList.toggle('babel-fbproto-hot', on);
          }
        });
        element.addEventListener('mouseenter', () => setHot(true));
        element.addEventListener('mouseleave', () => setHot(false));
      });
    };

    /** Which authored stage the card is currently showing, 0-based. */
    const displayedStageIndex = (): number | null => {
      const match = (host.textContent || '').match(/Derivation Step stage-(\d+)/);
      if (match) return Number(match[1]) - 1;
      const counter = (host.textContent || '').match(/Stage\s+(\d+)\s*\/\s*\d+/);
      return counter ? Number(counter[1]) - 1 : null;
    };

    const drawFallbackMarks = () => {
      host.querySelectorAll('.babel-fbproto-layer').forEach((element) => element.remove());
      const svg = host.querySelector<SVGSVGElement>('.babel-render-mount svg');
      const treeGroup = svg ? findTreeViewportGroup(svg) : null;
      if (!svg || !treeGroup) return;

      /*
       * The corrected timing rule. An instance exists only from its authored
       * relation stage onward, so an earlier frame renders exactly as Babel
       * always would: no mark, no cue, no highlight.
       */
      const stageIndex = displayedStageIndex();
      if (stageIndex === null || stageIndex < card.relationStageIndex) return;

      const layer = svgElement('g', 'babel-fbproto-layer') as SVGGElement;
      layer.setAttribute('data-fbproto-row', String(drawing.row));
      const k = unitScale(treeGroup);
      // Marks must clear every label and every mark already placed.
      const occupied: LocalRect[] = Array.from<SVGGraphicsElement>(
        treeGroup.querySelectorAll<SVGGraphicsElement>('.category-label, .terminal-label')
      )
        .map((element) => localRectForElements(treeGroup, [element]))
        .filter((box): box is LocalRect => Boolean(box));
      const placements = new Map<string, Placement>();
      drawing.marks.forEach((mark) => {
        const placement = placeMark(treeGroup, mark, k, occupied);
        if (placement) placements.set(mark.witness, placement);
      });
      drawLink(layer, treeGroup, k);
      drawFan(layer, placements, k);
      placements.forEach((placement) => drawMark(layer, placement, k));
      linkInstanceSelection(layer);
      treeGroup.appendChild(layer);
    };

    const observerOptions: MutationObserverInit = {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src']
    };
    let observer: MutationObserver | null = null;

    const sync = () => {
      if (syncBlocked) return;
      syncBlocked = true;
      observer?.disconnect();
      try {
        fixStandaloneLogoPath();
        drawFallbackMarks();
      } finally {
        observer?.observe(host, observerOptions);
        syncBlocked = false;
      }
    };

    /** Walk Replay to the deterministic frame this card demonstrates. */
    const advanceToPinnedFrame = () => {
      if (cancelled) return;
      sync();
      const buttonByLabel = (label: string) =>
        Array.from<HTMLButtonElement>(host.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent?.trim() === label);
      const nextButton = buttonByLabel('Next');
      const stageIndex = displayedStageIndex();

      if (stageIndex !== null && stageIndex > card.pinnedStageIndex) {
        const prevButton = buttonByLabel('Prev');
        if (prevButton && !prevButton.disabled && clicks < FBPROTO_MAX_REPLAY_CLICKS) {
          clicks += 1;
          prevButton.click();
          window.setTimeout(advanceToPinnedFrame, 45);
        }
        return;
      }

      if (nextButton && !nextButton.disabled) {
        if (clicks >= FBPROTO_MAX_REPLAY_CLICKS) return;
        clicks += 1;
        waits = 0;
        nextButton.click();
        window.setTimeout(advanceToPinnedFrame, 45);
        return;
      }

      if (nextButton) {
        if (clicks > 0 || waits >= FBPROTO_DISABLED_GRACE_POLLS) return;
      }

      waits += 1;
      if (waits < FBPROTO_MAX_REPLAY_WAITS) {
        window.setTimeout(advanceToPinnedFrame, 80);
      }
    };

    observer = new MutationObserver(sync);
    observer.observe(host, observerOptions);
    sync();
    window.requestAnimationFrame(() => {
      sync();
      window.requestAnimationFrame(sync);
    });
    const timer = window.setTimeout(advanceToPinnedFrame, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [card, drawing]);

  return (
    <article
      className="babel-render-card"
      data-lab-case={card.title}
      data-card-state="prototype"
      data-fallback-prototype={card.id}
      ref={cardRef}
    >
      <header className="babel-render-card-header">
        <div>
          <span className="babel-render-archetype">{archetype}. FALLBACK / TOPOLOGY</span>
          <h3>{title}</h3>
        </div>
      </header>
      <div className="babel-render-mount" data-archetype={card.id}>
        <TreeVisualizer
          data={card.data}
          animated
          derivationStages={rendererStages}
          sentence={card.sentence}
          disableRelationOverlay
        />
      </div>
    </article>
  );
}

export function FallbackPrototypesSection() {
  return (
    <section
      id="fallback-prototypes"
      className="babel-render-grid babel-fbproto-lane"
      data-fallback-prototypes="accepted-design"
    >
      <style>{FBPROTO_CSS}</style>
      {FALLBACK_PROTOTYPE_CARDS.map((card) => (
        <React.Fragment key={card.id}>
          <FallbackPrototypeCardView card={card} />
        </React.Fragment>
      ))}
    </section>
  );
}
