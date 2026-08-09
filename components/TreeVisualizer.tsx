import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DerivationStage, DerivationStep, SyntaxNode } from '../types';
import { ResolvedRelationLink } from '../relationLinks';
import { buildDerivationReplayPlan } from '../derivationReplayPlan.js';
import RootLogo from './RootLogo';
import {
  DERIVATION_WORKSPACE_ROOT_LABEL,
  MOVEMENT_ARC_STROKE,
  MOVEMENT_ARROW_COLOR,
  STEP_DELAY_MS,
  adaptDerivationStagesForReplay,
  applyPreFrontingSentenceInitialCasing,
  applyVizIds,
  buildAuthoredRelationLinksForFrames,
  buildFirstRevealNodeStepIndex,
  buildMovementArrowsFromLinks,
  buildMovementProtectedNodeIds,
  buildNodeStepIndex,
  buildPlaybackSteps,
  buildPlaybackStepsFromDerivationFrames,
  buildRenderableCommittedCanvasData,
  buildRenderableDerivationCanvasData,
  buildReplayDisplayDetailBlocks,
  buildReplaySupportLines,
  buildResolvedLinkOperatorVariableIndexMap,
  buildResolvedLinkRawTraceAliasMap,
  buildResolvedLinkTraceIndexMap,
  buildTraceDisplayLabel,
  cloneSyntaxTree,
  collectOvertLeafNodeIdsInOrder,
  decoratePlaybackStepsWithTraceIndices,
  extractMovementIndex,
  findParentLabelInForest,
  formatOperationLabel,
  formatPlaybackOperationTitle,
  formatReplayBlockLine,
  formatReplayBlockTitle,
  formatIndexedSurfaceForDisplayValue,
  formatAuthoredWitnessSurface,
  formatTraceSurfaceForDisplayValue,
  getNodeId,
  hidePendingInflSpecifierWrappersInStep,
  isDisplayTraceLabel,
  isFrontingLikeOperationLabel,
  isHeadLikeResolvedRelation,
  isNullLike,
  isOvertLeafNode,
  isRenderableTerminalSurface,
  isStructuralCategorySurface,
  isSyntheticWorkspaceRootNode,
  isTraceLike,
  isUnderTriangulation,
  markTriangulatedNodes,
  maybeLowercaseSentenceInitialFunctionSurface,
  normalizeToken,
  normalizeTraceIndexForDisplay,
  normalizeTrajectoryKind,
  resolveLeafSurface,
  resolveTraceIndexFromNodeContext,
  shouldExpandPreterminalLeaf,
  stepRepresentsMovement,
  tokenizeReplaySentenceSurface,
  type DerivationReplayPlan,
  type HierNode,
  type MovementArrow,
  type VisibleLink
} from '../replay/replayCompiler.ts';
import {
  compileRelationRenderPlan,
  planItemOwnsRelationMoment,
  planItemDependencyNodeIds,
  type RelationRenderPlan
} from '../replay/relations/renderPlanCompiler.ts';
import {
  bindRelationPlanFrame,
  boundOverlayBounds,
  resolveUniqueDisplayTerminal,
  ghostLensPresentation,
  type OverlayBounds,
  type PlanPositionProvider
} from '../replay/relations/geometryBinding.ts';

interface TreeVisualizerProps {
  data: SyntaxNode;
  animated?: boolean;
  derivationSteps?: DerivationStep[];
  derivationStages?: DerivationStage[];
  abstractionMode?: boolean;
  sentence?: string;
  /**
   * Production draws the compiled visual-relations overlay by default. A
   * research surface that layers its own demonstration overlay (the Lab) may
   * disable it to avoid double-drawing; nothing else should.
   */
  disableRelationOverlay?: boolean;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  data,
  animated = false,
  derivationSteps,
  derivationStages,
  abstractionMode = false,
  sentence = '',
  disableRelationOverlay = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalMorphRef = useRef<Map<string, { preText: string; postText: string; step: number; hideBefore: boolean }>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const replayDerivationFrames = useMemo(
    () => adaptDerivationStagesForReplay(derivationStages),
    [derivationStages]
  );
  const hasDerivationFrames = replayDerivationFrames.length > 0;
  const derivationStagesSignature = useMemo(() => {
    const stages = Array.isArray(derivationStages) ? derivationStages : [];
    return stages.map((stage, index) => JSON.stringify({
      index,
      statement: stage.statement,
      stageRecord: stage.stageRecord,
      relations: stage.relations || [],
      workspaceForest: stage.workspaceForest || []
    })).join('|');
  }, [derivationStages]);
  const derivationReplayPlan = useMemo<DerivationReplayPlan | null>(() => {
    if (!Array.isArray(derivationStages) || derivationStages.length === 0) return null;
    return buildDerivationReplayPlan({ derivationStages }) as DerivationReplayPlan;
  }, [derivationStages, derivationStagesSignature]);
  /*
   * The production visual-relations render plan: semantic compilation lives in
   * the React-free replay/relations modules; this component only lays
   * out the tree, supplies real node positions, and draws the bound
   * primitives. The compiled plan owns authored trajectories; the legacy
   * movement adapter remains only as a compatibility path when the plan has
   * no authored trajectory items.
   */
  const relationRenderPlan = useMemo<RelationRenderPlan | null>(() => {
    if (!Array.isArray(derivationStages) || derivationStages.length === 0) return null;
    return compileRelationRenderPlan(derivationStages);
  }, [derivationStages, derivationStagesSignature]);
  const derivationStepsSignature = useMemo(() => {
    const steps = derivationSteps || [];
    return steps
      .map((step, idx) => [
        idx,
        step.operation || '',
        step.targetNodeId || '',
        step.targetLabel || '',
        (step.sourceNodeIds || []).join(','),
        (step.sourceLabels || []).join(','),
        step.recipe || '',
        (step.spelloutOrder || []).join(','),
        (step.detailBlocks || [])
          .map((block) => [
            block.title || '',
            (block.lines || []).join(',')
          ].join(':'))
          .join(';')
      ].join(':'))
      .join('|');
  }, [derivationSteps]);
  const derivationFramesSignature = useMemo(() => {
    const frames = replayDerivationFrames || [];
    return frames.map((frame, index) => JSON.stringify({
      index,
      frameId: frame.frameId,
      stepId: frame.stepId,
      operation: frame.operation,
      recipe: frame.recipe,
      chainId: frame.chainId,
      spelloutOrder: frame.spelloutOrder || [],
      movement: frame.movement || null,
      change: frame.change || null,
      workspaceForest: frame.workspaceForest || []
    })).join('|');
  }, [replayDerivationFrames]);
  const usesDerivationFrames = animated && replayDerivationFrames.length > 0;
  const committedDerivationFrameIndex = hasDerivationFrames
    ? replayDerivationFrames.length - 1
    : -1;
  const committedDerivationFrame = hasDerivationFrames && committedDerivationFrameIndex >= 0
    ? replayDerivationFrames[committedDerivationFrameIndex] || null
    : null;
  const committedDerivationVisualLinks = useMemo(() => {
    if (!hasDerivationFrames || !committedDerivationFrame || committedDerivationFrameIndex < 0) return [];
    return buildAuthoredRelationLinksForFrames(
      replayDerivationFrames,
      derivationReplayPlan,
      committedDerivationFrameIndex,
      committedDerivationFrame.workspaceForest || []
    );
  }, [committedDerivationFrame, committedDerivationFrameIndex, derivationReplayPlan, hasDerivationFrames, replayDerivationFrames]);
  const movementProtectedNodeIds = useMemo(
    () => buildMovementProtectedNodeIds(committedDerivationVisualLinks),
    [committedDerivationVisualLinks]
  );
  const committedDerivationCanvasData = useMemo(() => {
    if (!usesDerivationFrames) return null;
    if (!committedDerivationFrame) {
      return {
        label: DERIVATION_WORKSPACE_ROOT_LABEL,
        children: []
      } as SyntaxNode;
    }
    return buildRenderableDerivationCanvasData(
      committedDerivationFrame.workspaceForest || [],
      committedDerivationVisualLinks
    );
  }, [committedDerivationFrame, committedDerivationVisualLinks, usesDerivationFrames]);
  const committedCanonicalDerivationCanvasData = useMemo(() => {
    if (!usesDerivationFrames) return null;
    return buildRenderableCommittedCanvasData(
      data,
      committedDerivationVisualLinks
    );
  }, [data, committedDerivationVisualLinks, usesDerivationFrames]);
  const playbackSteps = useMemo(() => {
    if (!animated) return [];
    if (!usesDerivationFrames || !committedDerivationFrame) return [];
    const playbackRootData = usesDerivationFrames
      ? committedCanonicalDerivationCanvasData || committedDerivationCanvasData
      : data;
    const clonedData = cloneSyntaxTree(playbackRootData);
    if (!clonedData) return [];
    const hierarchy = d3.hierarchy(clonedData);
    applyVizIds(hierarchy);
    if (abstractionMode) {
      markTriangulatedNodes(hierarchy, movementProtectedNodeIds);
    }
    const visibleNodes = hierarchy.descendants().filter((node) => !isUnderTriangulation(node));
    const workspaceForest = committedDerivationFrame.workspaceForest || [];
    const traceIndexByNodeId = buildResolvedLinkTraceIndexMap(
      workspaceForest,
      committedDerivationVisualLinks,
      Number.MAX_SAFE_INTEGER
    );
    const steps = buildPlaybackStepsFromDerivationFrames(
      replayDerivationFrames,
      derivationSteps,
      sentence,
      derivationReplayPlan
    ).map(hidePendingInflSpecifierWrappersInStep);
    return applyPreFrontingSentenceInitialCasing(
      decoratePlaybackStepsWithTraceIndices(steps, traceIndexByNodeId),
      sentence
    );
  }, [
    animated,
    data,
    derivationSteps,
    derivationReplayPlan,
    derivationStagesSignature,
    usesDerivationFrames,
    replayDerivationFrames,
    derivationFramesSignature,
    committedCanonicalDerivationCanvasData,
    committedDerivationCanvasData,
    committedDerivationFrame,
    committedDerivationVisualLinks,
    abstractionMode,
    movementProtectedNodeIds,
    sentence
  ]);
  const firstFrontingStepIndex = useMemo(
    () => playbackSteps.findIndex((step) => isFrontingLikeOperationLabel(step?.operation)),
    [playbackSteps]
  );
  const firstSentenceReplayToken = useMemo(
    () => String(tokenizeReplaySentenceSurface(sentence)[0] || '').trim(),
    [sentence]
  );
  const firstSentenceReplayDisplayToken = useMemo(
    () => firstSentenceReplayToken
      ? firstSentenceReplayToken.charAt(0).toUpperCase() + firstSentenceReplayToken.slice(1)
      : '',
    [firstSentenceReplayToken]
  );
  const currentStepIndex = animated && playbackSteps.length > 0
    ? Math.min(activeStepIndex, playbackSteps.length - 1)
    : -1;
  const activeDerivationReplayStep = usesDerivationFrames && currentStepIndex >= 0
    ? playbackSteps[currentStepIndex]
    : null;
  const activeDerivationFrameIndex = usesDerivationFrames
    ? (
        Number.isInteger(activeDerivationReplayStep?.replayFrameIndex)
          ? Number(activeDerivationReplayStep?.replayFrameIndex)
          : committedDerivationFrameIndex
      )
    : -1;
  const activeDerivationFrame = usesDerivationFrames && activeDerivationFrameIndex >= 0
    ? replayDerivationFrames[activeDerivationFrameIndex] || null
    : null;
  const activeDerivationRelationLinks = useMemo(() => {
    if (!usesDerivationFrames) return [];
    const stepRelationLinks = Array.isArray(activeDerivationReplayStep?.replayRelationLinks)
      ? activeDerivationReplayStep.replayRelationLinks
      : [];
    return stepRelationLinks;
  }, [activeDerivationReplayStep, usesDerivationFrames]);
  const activeDerivationArrowLinks = useMemo(() => {
    if (!usesDerivationFrames) return [];
    const frameIndex = Number(activeDerivationFrameIndex);
    if (!Number.isInteger(frameIndex) || frameIndex < 0) return activeDerivationRelationLinks;
    return activeDerivationRelationLinks.filter((link) => {
      const stepIndex = Number(link?.stepIndex);
      return Number.isInteger(stepIndex) ? stepIndex <= frameIndex : true;
    });
  }, [activeDerivationFrameIndex, activeDerivationRelationLinks, usesDerivationFrames]);
  const traceDisplayFrame = usesDerivationFrames ? activeDerivationFrame : committedDerivationFrame;
  const traceDisplayFrameIndex = usesDerivationFrames ? activeDerivationFrameIndex : committedDerivationFrameIndex;
  const traceDisplayRelationLinks = usesDerivationFrames
    ? activeDerivationRelationLinks
    : committedDerivationVisualLinks;
  const isFinalDerivationReplayStep = usesDerivationFrames
    && activeStepIndex >= playbackSteps.length - 1;
  const overtSurfaceSet = useMemo(() => {
    const tokens = tokenizeReplaySentenceSurface(sentence)
      .map((token) => normalizeToken(token))
      .filter(Boolean);
    return tokens.length > 0 ? new Set(tokens) : null;
  }, [sentence]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = window as any;
    target.__BABEL_DEV_SET_REPLAY_STEP__ = (nextStep: number) => {
      const requested = Number(nextStep);
      const maxStep = Math.max(playbackSteps.length - 1, 0);
      const bounded = Number.isFinite(requested)
        ? Math.max(0, Math.min(Math.trunc(requested), maxStep))
        : 0;
      setIsAutoPlaying(false);
      setActiveStepIndex(bounded);
    };
    target.__BABEL_DEV_GET_REPLAY_STEP_COUNT__ = () => playbackSteps.length;
    target.__BABEL_DEV_GET_REPLAY_STEP_PAYLOAD__ = (index: number) => {
      const requested = Number(index);
      const bounded = Number.isFinite(requested)
        ? Math.max(0, Math.min(Math.trunc(requested), Math.max(playbackSteps.length - 1, 0)))
        : 0;
      return playbackSteps[bounded] || null;
    };

    return () => {
      delete target.__BABEL_DEV_SET_REPLAY_STEP__;
      delete target.__BABEL_DEV_GET_REPLAY_STEP_COUNT__;
      delete target.__BABEL_DEV_GET_REPLAY_STEP_PAYLOAD__;
    };
  }, [playbackSteps.length]);

  const canvasData = useMemo(() => {
    if (usesDerivationFrames) {
      return activeDerivationReplayStep?.replayCanvasData
        || committedCanonicalDerivationCanvasData
        || committedDerivationCanvasData
        || data;
    }
    if (animated) return data;
    return buildRenderableCommittedCanvasData(data, committedDerivationVisualLinks);
  }, [
    activeDerivationReplayStep,
    animated,
    committedCanonicalDerivationCanvasData,
    committedDerivationCanvasData,
    committedDerivationVisualLinks,
    data,
    usesDerivationFrames
  ]);
  const replayVisibleNodeIdSet = useMemo(() => {
    if (!usesDerivationFrames) return null;
    const nodeIds = activeDerivationReplayStep?.replayVisibleNodeIds;
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) return null;
    return new Set(nodeIds.map((id) => String(id || '').trim()).filter(Boolean));
  }, [activeDerivationReplayStep, usesDerivationFrames]);
  useEffect(() => {
    if (!containerRef.current) return;
    const observeTarget = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    resizeObserver.observe(observeTarget);
    return () => resizeObserver.unobserve(observeTarget);
  }, []);

  useEffect(() => {
    if (!animated || playbackSteps.length === 0) {
      setActiveStepIndex(0);
      setIsAutoPlaying(false);
      return;
    }

    setActiveStepIndex(0);
    setIsAutoPlaying(true);
  }, [animated, playbackSteps, data, derivationFramesSignature]);

  useEffect(() => {
    if (!animated || !isAutoPlaying || isScrubbing || playbackSteps.length === 0) {
      return;
    }

    if (activeStepIndex >= playbackSteps.length - 1) {
      setIsAutoPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveStepIndex((index) => Math.min(index + 1, playbackSteps.length - 1));
    }, STEP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeStepIndex, animated, isAutoPlaying, isScrubbing, playbackSteps]);

  useEffect(() => {
    if (!isScrubbing) return;

    const clearScrubState = () => setIsScrubbing(false);
    window.addEventListener('pointerup', clearScrubState);
    window.addEventListener('pointercancel', clearScrubState);
    window.addEventListener('mouseup', clearScrubState);
    window.addEventListener('touchend', clearScrubState);
    window.addEventListener('touchcancel', clearScrubState);

    return () => {
      window.removeEventListener('pointerup', clearScrubState);
      window.removeEventListener('pointercancel', clearScrubState);
      window.removeEventListener('mouseup', clearScrubState);
      window.removeEventListener('touchend', clearScrubState);
      window.removeEventListener('touchcancel', clearScrubState);
    };
  }, [isScrubbing]);

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const revealThreshold = animated ? activeStepIndex : Number.MAX_SAFE_INTEGER;
    const effectiveRevealThreshold = usesDerivationFrames
      ? Number.MAX_SAFE_INTEGER
      : revealThreshold;
    const svg = d3.select(svgRef.current);
    const layoutDerivationTraceIndexByNodeId = traceDisplayFrame
      ? buildResolvedLinkTraceIndexMap(
          traceDisplayFrame.workspaceForest || [],
          traceDisplayRelationLinks,
          traceDisplayFrameIndex
        )
      : new Map<string, string>();
    const layoutOperatorVariableIndexByNodeId = traceDisplayFrame
      ? buildResolvedLinkOperatorVariableIndexMap(
          traceDisplayFrame.workspaceForest || [],
          traceDisplayRelationLinks,
          traceDisplayFrameIndex
        )
      : new Map<string, string>();
    const layoutRawTraceAliasByIndex = traceDisplayFrame
      ? buildResolvedLinkRawTraceAliasMap(
          traceDisplayFrame.workspaceForest || [],
          traceDisplayRelationLinks,
          traceDisplayFrameIndex
        )
      : new Map<string, string>();
    const layoutVisibleOvertLeafIds = collectOvertLeafNodeIdsInOrder(canvasData)
      .filter((nodeId) => !replayVisibleNodeIdSet || replayVisibleNodeIdSet.has(nodeId));
    const layoutFirstVisibleOvertLeafId = String(layoutVisibleOvertLeafIds[0] || '').trim();
    const maybeCapitalizeLayoutSentenceInitialLeaf = (node: HierNode, value: string): string => {
      const trimmed = String(value || '').trim();
      if (!trimmed || isTraceLike(trimmed) || isNullLike(trimmed)) return trimmed;
      if (Number(node.data?.tokenIndex) !== 0) return trimmed;
      if (!layoutFirstVisibleOvertLeafId || getNodeId(node) !== layoutFirstVisibleOvertLeafId) return trimmed;
      const nodeAncestorIds = new Set<string>();
      let currentAncestor: HierNode | null = node;
      while (currentAncestor) {
        const ancestorId = getNodeId(currentAncestor);
        if (ancestorId) nodeAncestorIds.add(ancestorId);
        currentAncestor = currentAncestor.parent;
      }
      const surfacedByPhraseMovement = activeDerivationArrowLinks.some((link) => {
        if (isHeadLikeResolvedRelation(link)) return false;
        const targetNodeId = String(link?.targetNodeId || '').trim();
        return Boolean(targetNodeId) && nodeAncestorIds.has(targetNodeId);
      });
      if (!surfacedByPhraseMovement) return trimmed;
      return firstSentenceReplayDisplayToken || (trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
    };

    svg.selectAll<SVGPathElement, unknown>('.branch')
      .style('opacity', function () {
        const step = Number((this as SVGPathElement).getAttribute('data-step') || 0);
        return step <= effectiveRevealThreshold ? '0.6' : '0';
      });

    svg.selectAll<SVGGElement, unknown>('.node-group')
      .style('opacity', function () {
        const step = Number((this as SVGGElement).getAttribute('data-step') || 0);
        return step <= effectiveRevealThreshold ? '1' : '0';
      });

    svg.selectAll<SVGPathElement, unknown>('.movement-arrow')
      .style('opacity', function () {
        const step = Number((this as SVGPathElement).getAttribute('data-step') || 0);
        return step <= effectiveRevealThreshold ? '0.95' : '0';
      });

    svg.selectAll<SVGTextElement, HierNode>('.terminal-label')
      .text(function (d) {
        const element = this as SVGTextElement;
        const nodeId = element.getAttribute('data-node-id') || '';
        const fallback = element.getAttribute('data-default-label') || '';
        const storedTraceIndex = normalizeTraceIndexForDisplay(
          element.getAttribute('data-trace-index') || ''
        );
        const morph = terminalMorphRef.current.get(nodeId);
        const rawTraceAlias = extractMovementIndex(fallback);
        const aliasedTraceIndex = rawTraceAlias
          ? layoutRawTraceAliasByIndex.get(String(rawTraceAlias).trim().toLowerCase())
          : undefined;
        const directTraceIndex = layoutDerivationTraceIndexByNodeId.get(nodeId);
        const operatorVariableIndex = resolveTraceIndexFromNodeContext(
          d,
          layoutOperatorVariableIndexByNodeId
        );
        if (!morph) {
          return isTraceLike(fallback)
            ? formatTraceSurfaceForDisplayValue(
                fallback,
                directTraceIndex || storedTraceIndex || aliasedTraceIndex || extractMovementIndex(fallback)
              )
            : formatIndexedSurfaceForDisplayValue(
                maybeCapitalizeLayoutSentenceInitialLeaf(d, fallback),
                operatorVariableIndex
              );
        }
        if (effectiveRevealThreshold < morph.step) {
          return morph.hideBefore ? '' : maybeCapitalizeLayoutSentenceInitialLeaf(d, morph.preText);
        }
        if (!morph.postText && isTraceLike(fallback)) {
          return formatTraceSurfaceForDisplayValue(
            fallback,
            directTraceIndex || storedTraceIndex || aliasedTraceIndex || extractMovementIndex(fallback)
          );
        }
        if (morph.postText && isDisplayTraceLabel(morph.postText)) {
          return morph.postText;
        }
        if (morph.postText && isTraceLike(morph.postText)) {
          return formatTraceSurfaceForDisplayValue(
            morph.postText,
            directTraceIndex || storedTraceIndex || aliasedTraceIndex || extractMovementIndex(morph.postText)
          );
        }
        if (isTraceLike(fallback)) {
          return formatTraceSurfaceForDisplayValue(
            fallback,
            directTraceIndex || storedTraceIndex || aliasedTraceIndex || extractMovementIndex(fallback)
          );
        }
        return formatIndexedSurfaceForDisplayValue(
          maybeCapitalizeLayoutSentenceInitialLeaf(d, morph.postText || fallback),
          operatorVariableIndex
        );
      });
  }, [
    activeDerivationArrowLinks,
    activeDerivationFrame,
    activeDerivationFrameIndex,
    activeDerivationRelationLinks,
    activeStepIndex,
    animated,
    canvasData,
    data,
    dimensions,
    abstractionMode,
    firstSentenceReplayDisplayToken,
    firstSentenceReplayToken,
    replayVisibleNodeIdSet,
    traceDisplayFrame,
    traceDisplayFrameIndex,
    traceDisplayRelationLinks,
    usesDerivationFrames,
    playbackSteps.length
  ]);

  useEffect(() => {
    if (!canvasData || !svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width: containerWidth, height: containerHeight } = dimensions;

    const clonedCanvasData = cloneSyntaxTree(canvasData);
    if (!clonedCanvasData) return;
    const rootHierarchy = d3.hierarchy(clonedCanvasData);
    const maxDepth = rootHierarchy.height;
    applyVizIds(rootHierarchy);

    // Logic for Triangulation (Abstraction Mode)
    if (abstractionMode) {
      markTriangulatedNodes(rootHierarchy, movementProtectedNodeIds);
    }

    const nodeCount = rootHierarchy.descendants().length;
    const width = Math.max(containerWidth * 1.5, nodeCount * 180);
    const height = Math.max(containerHeight, (maxDepth + 2) * 220);
    
    const margin = { top: 120, right: 300, bottom: 400, left: 300 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.attr('width', '100%').attr('height', '100%').append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Overlay markers keep a stable screen size: their world position is
        // carried on data attributes and their local scale counteracts zoom.
        g.selectAll<SVGGElement, unknown>('.vr-overlay-marker').attr('transform', function () {
          const el = this as SVGGElement;
          const x = Number(el.dataset.vrX || 0);
          const y = Number(el.dataset.vrY || 0);
          // Screen-stable, but capped so far-out zoom never lets markers
          // dwarf the tree they annotate.
          return `translate(${x},${y}) scale(${Math.min(1 / (event.transform.k || 1), 3)})`;
        });
      });
    svg.call(zoom as any);

    const treeLayout = d3.tree<SyntaxNode>()
      .size([innerWidth, innerHeight])
      .separation((a, b) => (a.parent === b.parent ? 2.5 : 3.5));

    const treeData = treeLayout(rootHierarchy);
    const alignReplayUnaryTerminalLeaves = (root: d3.HierarchyPointNode<SyntaxNode>) => {
      root.each((node) => {
        const children = Array.isArray(node.children) ? node.children : [];
        const visibleChildren = children.filter((child) =>
          !isSyntheticWorkspaceRootNode(child)
          && (!replayVisibleNodeIdSet || replayVisibleNodeIdSet.has(getNodeId(child)))
          && (child.data as any)?.replayLayoutOnly !== true
        );
        if (visibleChildren.length !== 1) return;
        const child = visibleChildren[0];
        if (!child || (Array.isArray(child.children) && child.children.length > 0)) return;
        if (isSyntheticWorkspaceRootNode(node) || isSyntheticWorkspaceRootNode(child)) return;
        const surface = resolveLeafSurface(child);
        if (!surface) return;
        const isTerminalLeaf =
          isTraceLike(surface)
          || isNullLike(surface)
          || !isStructuralCategorySurface(surface);
        if (!isTerminalLeaf) return;
        child.x = node.x;
      });
    };
    if (usesDerivationFrames) {
      alignReplayUnaryTerminalLeaves(treeData);
    }
    const derivationFrameFitNodes = (() => {
      if (!animated || !usesDerivationFrames || !activeDerivationFrame) return null;
      const fitCanvasData = buildRenderableDerivationCanvasData(
        activeDerivationFrame.workspaceForest || [],
        activeDerivationRelationLinks
      );
      const clonedFitCanvasData = cloneSyntaxTree(fitCanvasData);
      if (!clonedFitCanvasData) return null;
      const fitHierarchy = d3.hierarchy(clonedFitCanvasData);
      applyVizIds(fitHierarchy);
      if (abstractionMode) {
        markTriangulatedNodes(fitHierarchy, movementProtectedNodeIds);
      }
      const fitTreeData = treeLayout(fitHierarchy);
      alignReplayUnaryTerminalLeaves(fitTreeData);
      return fitTreeData.descendants().filter((node) =>
        !isUnderTriangulation(node) && !isSyntheticWorkspaceRootNode(node)
      );
    })();

    // COLOR PALETTE - ABSOLUTE CONSTANTS
    const BRANCH_COLOR = '#593a0e';
    const PURE_WHITE = '#ffffff';
    const TARGET_EMERALD = '#10b981';
    const SILENT_SAGE = '#9caf99';

    // 1. RENDER BRANCHES
    const visibleNodes = treeData.descendants().filter((node) =>
      !isUnderTriangulation(node)
      && !isSyntheticWorkspaceRootNode(node)
      && (!replayVisibleNodeIdSet || replayVisibleNodeIdSet.has(getNodeId(node)))
    );
    const visibleLinks = treeData.links().filter((link) =>
      !isUnderTriangulation(link.target)
      && !isSyntheticWorkspaceRootNode(link.source)
      && !isSyntheticWorkspaceRootNode(link.target)
      && (!replayVisibleNodeIdSet || (
        replayVisibleNodeIdSet.has(getNodeId(link.source))
        && replayVisibleNodeIdSet.has(getNodeId(link.target))
      ))
    ) as VisibleLink[];
    const inferredTimeline = usesDerivationFrames
      ? []
      : buildPlaybackSteps(rootHierarchy, visibleNodes, derivationSteps);
    const timeline = animated && playbackSteps.length > 0 ? playbackSteps : inferredTimeline;
    const nodeStepIndex = buildNodeStepIndex(timeline);
    const firstRevealNodeStepIndex = buildFirstRevealNodeStepIndex(timeline);
    const revealThreshold = animated ? activeStepIndex : Number.MAX_SAFE_INTEGER;
    const derivationTraceIndexByNodeId = traceDisplayFrame
      ? (() => {
          const workspaceForest = traceDisplayFrame.workspaceForest || [];
          return buildResolvedLinkTraceIndexMap(
            workspaceForest,
            traceDisplayRelationLinks,
            traceDisplayFrameIndex
          );
        })()
      : new Map<string, string>();
    const derivationOperatorVariableIndexByNodeId = traceDisplayFrame
      ? (() => {
          const workspaceForest = traceDisplayFrame.workspaceForest || [];
          return buildResolvedLinkOperatorVariableIndexMap(
            workspaceForest,
            traceDisplayRelationLinks,
            traceDisplayFrameIndex
          );
        })()
      : new Map<string, string>();
    const derivationRawTraceAliasByIndex = traceDisplayFrame
      ? (() => {
          const workspaceForest = traceDisplayFrame.workspaceForest || [];
          return buildResolvedLinkRawTraceAliasMap(
            workspaceForest,
            traceDisplayRelationLinks,
            traceDisplayFrameIndex
          );
        })()
      : new Map<string, string>();
    const movementArrows = animated
        ? (
          usesDerivationFrames
            ? buildMovementArrowsFromLinks(
                visibleNodes,
                activeDerivationArrowLinks,
                nodeStepIndex,
                timeline
              )
            : []
        )
      : [];
    const effectiveRevealThreshold = usesDerivationFrames
      ? Number.MAX_SAFE_INTEGER
      : revealThreshold;
    const nodeRevealStepIndex = new Map(firstRevealNodeStepIndex);
    const terminalMorph = new Map<string, { preText: string; postText: string; step: number; hideBefore: boolean }>();
    const normalizeMovementTraceIndex = (index?: string | null): string => {
      return normalizeTraceIndexForDisplay(index);
    };
    const buildTraceLabel = (index?: string | null): string => {
      return buildTraceDisplayLabel(index);
    };
    const formatTraceSurfaceForDisplay = (
      surface: string,
      fallbackIndex?: string | null
    ): string => {
      return formatTraceSurfaceForDisplayValue(surface, fallbackIndex);
    };
    /*
     * Authored witness kind is authoritative; the pure law lives in
     * replayCompiler.formatAuthoredWitnessSurface and is shared with tests.
     */
    const formatReplayIndexedSilentLeaf = (
      surface: string,
      inheritedTraceIndex?: string | null,
      aliasedTraceIndex?: string | null
    ): string => formatAuthoredWitnessSurface(surface, inheritedTraceIndex, aliasedTraceIndex);

    const unrevealedStep = usesDerivationFrames ? Number.MAX_SAFE_INTEGER : 0;
    const getRevealStepForNodeId = (nodeId: string): number =>
      nodeRevealStepIndex.has(nodeId)
        ? (nodeRevealStepIndex.get(nodeId) as number)
        : unrevealedStep;
    const findFirstOvertLeafDescendant = (node: HierNode | null): HierNode | null => {
      if (!node) return null;
      const stack: HierNode[] = [node];
      while (stack.length > 0) {
        const current = stack.shift() as HierNode;
        const children = current.children || [];
        if (children.length === 0) {
          const surface = resolveLeafSurface(current);
          if (isRenderableTerminalSurface(surface, overtSurfaceSet) && !isTraceLike(surface) && !isNullLike(surface)) {
            return current;
          }
          continue;
        }
        stack.unshift(...children);
      }
      return null;
    };

    movementArrows.forEach((arrow) => {
      const sourceId = getNodeId(arrow.source);
      const targetId = getNodeId(arrow.target);
      const sourceStep = getRevealStepForNodeId(sourceId);
      const targetStep = getRevealStepForNodeId(targetId);
      nodeRevealStepIndex.set(sourceId, Math.min(sourceStep, arrow.step));
      nodeRevealStepIndex.set(targetId, Math.max(targetStep, arrow.step));
      if (arrow.traceNode) {
        const traceId = getNodeId(arrow.traceNode);
        const traceStep = getRevealStepForNodeId(traceId);
        nodeRevealStepIndex.set(traceId, Math.min(traceStep, arrow.step));
      }

      const sourceSurface = resolveLeafSurface(arrow.source);
      const targetSurface = resolveLeafSurface(arrow.target);
      const traceAnchor = arrow.traceNode || (isTraceLike(sourceSurface) ? arrow.source : null);
      if (traceAnchor) {
        const traceId = getNodeId(traceAnchor);
        const traceSurface = resolveLeafSurface(traceAnchor);
        const traceRawAlias = extractMovementIndex(traceSurface);
        const targetRawAlias = extractMovementIndex(targetSurface);
        const relationIndex = arrow.index
          || (traceRawAlias ? derivationRawTraceAliasByIndex.get(String(traceRawAlias).trim().toLowerCase()) : undefined)
          || (targetRawAlias ? derivationRawTraceAliasByIndex.get(String(targetRawAlias).trim().toLowerCase()) : undefined)
          || traceRawAlias
          || targetRawAlias
          || null;
        // Additive indexing only: an authored `t` gains its index; any other
        // authored witness surface (∅, silent lexical material) stays exactly
        // as authored.
        const formattedTraceSurface = isTraceLike(traceSurface)
          ? formatTraceSurfaceForDisplay(traceSurface, relationIndex)
          : traceSurface;
        terminalMorph.set(traceId, {
          preText: formattedTraceSurface,
          postText: formattedTraceSurface,
          step: arrow.step,
          hideBefore: false
        });
      }

      if ((arrow.target.children && arrow.target.children.length > 0)) {
        if (normalizeTrajectoryKind(arrow.trajectoryKind) !== 'head') {
          const sentenceInitialLeaf = findFirstOvertLeafDescendant(arrow.target);
          const sentenceInitialSurface = sentenceInitialLeaf
            ? resolveLeafSurface(sentenceInitialLeaf)
            : '';
          const preMovementSentenceInitialSurface =
            firstSentenceReplayToken
            && normalizeToken(sentenceInitialSurface) === normalizeToken(firstSentenceReplayToken)
              ? firstSentenceReplayToken.charAt(0).toLowerCase() + firstSentenceReplayToken.slice(1)
              : sentenceInitialSurface;
          const shouldCapitalizeSentenceInitialLeaf =
            sentenceInitialLeaf
            && (
              Number(sentenceInitialLeaf.data?.tokenIndex) === 0
              || (
                firstSentenceReplayToken
                && normalizeToken(sentenceInitialSurface) === normalizeToken(firstSentenceReplayToken)
              )
            );
          if (sentenceInitialLeaf && shouldCapitalizeSentenceInitialLeaf) {
            terminalMorph.set(getNodeId(sentenceInitialLeaf), {
              preText: preMovementSentenceInitialSurface,
              postText: firstSentenceReplayDisplayToken || (sentenceInitialSurface.charAt(0).toUpperCase() + sentenceInitialSurface.slice(1)),
              step: arrow.step,
              hideBefore: false
            });
          }
        }
      }

      if ((arrow.source.children && arrow.source.children.length > 0) || (arrow.target.children && arrow.target.children.length > 0)) {
        return;
      }

      if (!targetSurface) return;

      const targetIsRenderableTerminal = isRenderableTerminalSurface(targetSurface, overtSurfaceSet)
        || isTraceLike(targetSurface)
        || isNullLike(targetSurface);
      if (!targetIsRenderableTerminal) return;

      terminalMorph.set(targetId, {
        preText: '',
        postText: isTraceLike(targetSurface)
          ? formatTraceSurfaceForDisplay(
              targetSurface,
              arrow.index
                || (() => {
                  const rawAlias = extractMovementIndex(targetSurface);
                  return rawAlias
                    ? derivationRawTraceAliasByIndex.get(String(rawAlias).trim().toLowerCase())
                    : undefined;
                })()
                || extractMovementIndex(targetSurface)
            )
          : targetSurface,
        step: arrow.step,
        hideBefore: true
      });
    });

    terminalMorphRef.current = terminalMorph;

    g.selectAll('.branch')
      .data(visibleLinks)
      .enter()
      .append('path')
      .attr('class', 'branch')
      .attr('data-source-node-id', (d: any) => getNodeId(d.source))
      .attr('data-target-node-id', (d: any) => getNodeId(d.target))
      .attr('fill', 'none')
      .attr('stroke', BRANCH_COLOR)
      .attr('stroke-width', 4)
      .attr('data-step', (d: any) => String(getRevealStepForNodeId(getNodeId(d.target))))
      .attr('opacity', (d: any) => {
        const step = getRevealStepForNodeId(getNodeId(d.target));
        return step <= effectiveRevealThreshold ? 0.6 : 0;
      })
      .style('transition', 'opacity 280ms ease')
      .attr('d', d3.linkVertical().x((d: any) => d.x).y((d: any) => d.y) as any);

    /*
     * One movement authority. When the compiled render plan carries authored
     * trajectories and the production overlay is active, the plan draws every
     * trajectory instance and the legacy one-source/one-target movement
     * adapter is gated off — it stays only as a lossless compatibility path
     * for derivations that author no trajectory relations at all, and it
     * never independently reclassifies movement.
     */
    const planOwnsTrajectories = !disableRelationOverlay
      && Boolean(relationRenderPlan?.frames.some((planFrame) =>
        planFrame.items.some((planItem) => planItem.kind === 'trajectory')));
    if (movementArrows.length > 0 && !planOwnsTrajectories) {
      const defs = g.append('defs');
      defs.append('marker')
        .attr('id', 'movement-arrowhead')
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9)
        .attr('refY', 5)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M 0 0 L 10 5 L 0 10 z')
        .attr('fill', MOVEMENT_ARROW_COLOR);

      const arrowsBySource = new Map<string, MovementArrow[]>();
      const arrowsByTarget = new Map<string, MovementArrow[]>();
      movementArrows.forEach((arrow) => {
        const sourceId = getNodeId(arrow.source);
        const targetId = getNodeId(arrow.target);
        const sourceBucket = arrowsBySource.get(sourceId) || [];
        sourceBucket.push(arrow);
        arrowsBySource.set(sourceId, sourceBucket);
        const targetBucket = arrowsByTarget.get(targetId) || [];
        targetBucket.push(arrow);
        arrowsByTarget.set(targetId, targetBucket);
      });

      const getGroupedOffset = (bucket: MovementArrow[] | undefined, arrow: MovementArrow): number => {
        if (!bucket || bucket.length <= 1) return 0;
        const ordinal = bucket.findIndex((candidate) => candidate === arrow);
        if (ordinal < 0) return 0;
        return (ordinal - ((bucket.length - 1) / 2)) * 18;
      };

      g.selectAll('.movement-arrow')
        .data(movementArrows)
        .enter()
        .append('path')
        .attr('class', 'movement-arrow')
        .attr('fill', 'none')
        .attr('stroke', MOVEMENT_ARROW_COLOR)
        .attr('stroke-width', MOVEMENT_ARC_STROKE)
        .attr('stroke-linecap', 'round')
        .attr('marker-end', 'url(#movement-arrowhead)')
        .attr('data-step', (arrow) => String(arrow.step))
        // Keep replay text and movement visuals synchronized per step.
        .style('transition', 'opacity 80ms linear')
        .attr('opacity', (arrow) => (arrow.step <= effectiveRevealThreshold ? 0.9 : 0))
        .style('filter', 'drop-shadow(0 0 4px rgba(16,185,129,0.35))')
        .attr('d', (arrow) => {
          const sourceOffset = getGroupedOffset(arrowsBySource.get(getNodeId(arrow.source)), arrow);
          const targetOffset = getGroupedOffset(arrowsByTarget.get(getNodeId(arrow.target)), arrow);
          const direction = Math.sign(arrow.target.x - arrow.source.x) || 1;
          const sx = arrow.source.x + 8 * direction + sourceOffset;
          const sy = arrow.source.y + 24;
          const tx = arrow.target.x - 8 * direction + targetOffset;
          const ty = arrow.target.y + 24;
          const controlX = (sx + tx) / 2;
          const controlY = Math.max(sy, ty) + Math.max(42, Math.abs(tx - sx) * 0.2);
          return `M ${sx} ${sy} Q ${controlX} ${controlY}, ${tx} ${ty}`;
        });
    }

    // 2. RENDER NODE GROUPS
    const nodeGroups = g.selectAll('.node-group')
      .data(visibleNodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('data-node-group-id', (d) => getNodeId(d))
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('data-step', (d) => String(getRevealStepForNodeId(getNodeId(d))))
      .attr('opacity', (d) => {
        const step = getRevealStepForNodeId(getNodeId(d));
        return step <= effectiveRevealThreshold ? 1 : 0;
      })
      .style('transition', 'opacity 260ms ease');

    // 3. CATEGORY LABELS (Internal Nodes) - PURE WHITE
    const categories = nodeGroups.filter((d) =>
      (Boolean(d.children) && d.children.length > 0) || shouldExpandPreterminalLeaf(d.data)
    );
    categories.append('text')
      .attr('class', 'category-label')
      .attr('data-category-node-id', (d) => getNodeId(d))
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '42px') // Slightly reduced to balance visuals
      .attr('font-weight', '900')
      .attr('fill', PURE_WHITE)
      .style('fill', PURE_WHITE, 'important')
      .style('font-family', 'Quicksand, sans-serif')
      .style('paint-order', 'stroke')
      .style('stroke', '#020806')
      .style('stroke-width', '10px')
      .text(d => d.data.label);

    // 4. TERMINAL WORDS (Leaf Nodes) - ABSOLUTE EMERALD
    const leafNodes = nodeGroups.filter(d => !d.children || d.children.length === 0);
    const movementTerminalIds = new Set(Array.from(terminalMorphRef.current.keys()));
    const visibleOvertLeafIds = collectOvertLeafNodeIdsInOrder(clonedCanvasData);
    const maybeCapitalizeSurfacedSentenceInitialLeaf = (node: HierNode, value: string): string => {
      const trimmed = String(value || '').trim();
      if (!trimmed || isTraceLike(trimmed) || isNullLike(trimmed)) return trimmed;
      if (Number(node.data?.tokenIndex) !== 0) return trimmed;
      const firstVisibleOvertLeafId = String(visibleOvertLeafIds[0] || '').trim();
      if (!firstVisibleOvertLeafId || getNodeId(node) !== firstVisibleOvertLeafId) return trimmed;
      const nodeAncestorIds = new Set<string>();
      let currentAncestor: HierNode | null = node;
      while (currentAncestor) {
        const ancestorId = getNodeId(currentAncestor);
        if (ancestorId) nodeAncestorIds.add(ancestorId);
        currentAncestor = currentAncestor.parent;
      }
      const surfacedByPhraseMovement = activeDerivationArrowLinks.some((link) => {
        if (isHeadLikeResolvedRelation(link)) return false;
        const targetNodeId = String(link?.targetNodeId || '').trim();
        return Boolean(targetNodeId) && nodeAncestorIds.has(targetNodeId);
      });
      if (!surfacedByPhraseMovement) return trimmed;
      return firstSentenceReplayDisplayToken || (trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
    };
    const getReplayTerminalSurface = (node: HierNode): string => {
      const fallback = resolveLeafSurface(node);
      if (isTraceLike(fallback) || isNullLike(fallback)) return fallback;
      if (!usesDerivationFrames || !animated || isFinalDerivationReplayStep) return fallback;
      const currentPlaybackStep = currentStepIndex >= 0 ? playbackSteps[currentStepIndex] : null;
      if (
        currentPlaybackStep?.operation === 'LexicalSelect' &&
        String(currentPlaybackStep.targetNodeId || '').trim() === getNodeId(node)
      ) {
        const explicitLexicalSurface = String(currentPlaybackStep.sourceLabels?.[0] || '').trim();
        if (explicitLexicalSurface) {
          const shouldForcePreFrontingLowercase =
            (
              Number(node.data?.tokenIndex) === 0
              || normalizeToken(explicitLexicalSurface) === normalizeToken(firstSentenceReplayToken)
            )
            && firstFrontingStepIndex > 0
            && currentStepIndex < firstFrontingStepIndex;
          return shouldForcePreFrontingLowercase
            ? explicitLexicalSurface.charAt(0).toLowerCase() + explicitLexicalSurface.slice(1)
            : explicitLexicalSurface;
        }
      }
      const fallbackParentLabel = activeDerivationFrame
        ? findParentLabelInForest(activeDerivationFrame.workspaceForest || [], getNodeId(node))
        : '';
      const committedParentLabel = findParentLabelInForest([data], getNodeId(node));
      const preFrontingSentenceInitialFunction =
        normalizeToken(fallback) === normalizeToken(firstSentenceReplayToken)
        && firstFrontingStepIndex > 0
        && currentStepIndex < firstFrontingStepIndex;
      if (preFrontingSentenceInitialFunction) {
        return fallback.charAt(0).toLowerCase() + fallback.slice(1);
      }
      const nodeAncestorIds = new Set<string>();
      let currentAncestor: HierNode | null = node;
      while (currentAncestor) {
        const ancestorId = getNodeId(currentAncestor);
        if (ancestorId) nodeAncestorIds.add(ancestorId);
        currentAncestor = currentAncestor.parent;
      }
      const surfacedByPhraseMovement = activeDerivationArrowLinks.some((link) => {
        if (isHeadLikeResolvedRelation(link)) return false;
        const targetNodeId = String(link?.targetNodeId || '').trim();
        return Boolean(targetNodeId) && nodeAncestorIds.has(targetNodeId);
      });
      const sentenceInitialSurface =
        surfacedByPhraseMovement
          ? (firstSentenceReplayDisplayToken || (fallback.charAt(0).toUpperCase() + fallback.slice(1)))
          : '';
      return maybeLowercaseSentenceInitialFunctionSurface({
        surface: fallback,
        sentenceInitialSurface,
        nodeId: getNodeId(node),
        parentLabel: String(node.parent?.data?.label || '').trim() || fallbackParentLabel || committedParentLabel,
        tokenIndex: Number(node.data?.tokenIndex),
        visibleOvertLeafIds,
        isWorkspaceForest: String(clonedCanvasData?.label || '').trim() === DERIVATION_WORKSPACE_ROOT_LABEL
      });
    };
    const isReplayAuthoredWordLeaf = (node: HierNode): boolean => {
      if (!usesDerivationFrames) return false;
      let current: HierNode | null = node;
      while (current) {
        if ((current.data as SyntaxNode)?.silent === true || (current.data as any)?.ghost === true) return false;
        current = current.parent;
      }
      const word = String((node.data as SyntaxNode)?.word || '').trim();
      const surface = resolveLeafSurface(node);
      return Boolean(word)
        && Boolean(surface)
        && !isTraceLike(surface)
        && !isNullLike(surface)
        && !isStructuralCategorySurface(surface);
    };
    const isReplaySilentTerminalLeaf = (node: HierNode): boolean => {
      const surface = resolveLeafSurface(node);
      if (isTraceLike(surface) || isNullLike(surface)) return true;
      let current: HierNode | null = node;
      while (current) {
        if ((current.data as SyntaxNode)?.silent === true || (current.data as any)?.ghost === true) return true;
        current = current.parent;
      }
      return false;
    };
    const abstractLeaves = leafNodes.filter((d) => {
      const nodeId = getNodeId(d);
      const surface = resolveLeafSurface(d);
      return !movementTerminalIds.has(nodeId)
        && !isReplayAuthoredWordLeaf(d)
        && !isOvertLeafNode(d, overtSurfaceSet)
        && !isTraceLike(surface)
        && !isNullLike(surface)
        && !isReplaySilentTerminalLeaf(d);
    });
    const terminals = leafNodes.filter((d) => {
      const nodeId = getNodeId(d);
      const surface = resolveLeafSurface(d);
      const canRenderAsTerminal = !isStructuralCategorySurface(surface)
        || isTraceLike(surface)
        || isNullLike(surface)
        || isOvertLeafNode(d, overtSurfaceSet);
      return (movementTerminalIds.has(nodeId) && canRenderAsTerminal)
        || isReplayAuthoredWordLeaf(d)
        || isReplaySilentTerminalLeaf(d)
        || isOvertLeafNode(d, overtSurfaceSet)
        || isTraceLike(surface)
        || isNullLike(surface);
    });
    const overtTerminals = terminals.filter((d) => {
      return !isRenderedReplaySilentTerminalLeaf(d);
    });
    const silentTerminals = terminals.filter((d) => {
      return isRenderedReplaySilentTerminalLeaf(d);
    });

    function getReplayRenderedTerminalText(d: HierNode): string {
      const nodeId = getNodeId(d);
      const fallback = maybeCapitalizeSurfacedSentenceInitialLeaf(d, getReplayTerminalSurface(d));
      if ((d.data as any)?.ghost === true) return fallback;
      const morph = terminalMorphRef.current.get(nodeId);
      const rawSurface = morph
        ? (
            effectiveRevealThreshold < morph.step
              ? (morph.hideBefore ? '' : (morph.preText || fallback))
              : (morph.postText || fallback)
          )
        : fallback;
      const inheritedTraceIndex = resolveTraceIndexFromNodeContext(
        d,
        derivationTraceIndexByNodeId
      );
      const rawTraceAlias = extractMovementIndex(rawSurface);
      const aliasedTraceIndex = rawTraceAlias
        ? derivationRawTraceAliasByIndex.get(String(rawTraceAlias).trim().toLowerCase())
        : undefined;
      const formatted = formatReplayIndexedSilentLeaf(
        rawSurface,
        inheritedTraceIndex,
        aliasedTraceIndex
      );
      return (isTraceLike(formatted) || isNullLike(formatted))
        ? formatted
        : formatIndexedSurfaceForDisplayValue(
            maybeCapitalizeSurfacedSentenceInitialLeaf(d, formatted),
            resolveTraceIndexFromNodeContext(d, derivationOperatorVariableIndexByNodeId)
          );
    }

    function isRenderedReplaySilentTerminalLeaf(d: HierNode): boolean {
      const rendered = getReplayRenderedTerminalText(d);
      return isReplaySilentTerminalLeaf(d) || isTraceLike(rendered) || isNullLike(rendered);
    }

    const appendTerminalText = (
      selection: d3.Selection<SVGGElement, HierNode, SVGGElement, unknown>,
      fill: string
    ) => selection.append('text')
      .attr('class', 'terminal-label')
      .attr('data-node-id', (d) => getNodeId(d))
      .attr('data-default-label', (d) => maybeCapitalizeSurfacedSentenceInitialLeaf(d, getReplayTerminalSurface(d)))
      .attr('data-trace-index', (d) => {
        const fallback = getReplayTerminalSurface(d);
        const inheritedTraceIndex = resolveTraceIndexFromNodeContext(
          d,
          derivationTraceIndexByNodeId
        );
        const rawTraceAlias = extractMovementIndex(fallback);
        const aliasedTraceIndex = rawTraceAlias
          ? derivationRawTraceAliasByIndex.get(String(rawTraceAlias).trim().toLowerCase())
          : undefined;
        if (!isTraceLike(fallback) && !(isNullLike(fallback) && (inheritedTraceIndex || aliasedTraceIndex))) {
          return '';
        }
        return normalizeTraceIndexForDisplay(
          inheritedTraceIndex || aliasedTraceIndex || extractMovementIndex(fallback)
        );
      })
      .attr('y', 115) // Adjusted vertical offset for smaller font
      .attr('text-anchor', 'middle')
      .attr('font-size', '56px') // Reduced from 84px to be more proportional
      .attr('font-weight', '900')
      .attr('fill', fill)
      .attr('style', `fill: ${fill} !important; font-family: 'Quicksand', sans-serif; font-style: italic; paint-order: stroke; stroke: #020806; stroke-width: 8px;`)
      .style('fill', fill, 'important')
      .text(d => getReplayRenderedTerminalText(d));

    // Pronounced leaves stay emerald; silent and abstract leaves stay muted.
    appendTerminalText(abstractLeaves, SILENT_SAGE);
    appendTerminalText(overtTerminals, TARGET_EMERALD);
    appendTerminalText(silentTerminals, SILENT_SAGE);

    // Vertical dashed connection for leaf nodes
    terminals.append('line')
      .attr('x1', 0).attr('y1', 20).attr('x2', 0).attr('y2', 65)
      .attr('stroke', BRANCH_COLOR).attr('stroke-width', 3).attr('stroke-dasharray', '8,8').attr('opacity', 0.6);
    abstractLeaves.append('line')
      .attr('x1', 0).attr('y1', 20).attr('x2', 0).attr('y2', 65)
      .attr('stroke', BRANCH_COLOR).attr('stroke-width', 3).attr('stroke-dasharray', '8,8').attr('opacity', 0.6);

    // 5. ABSTRACTION MODE (Triangles)
    const triangles = nodeGroups.filter((d: any) => d.isTriangulated);
    triangles.selectAll('text').remove();
    triangles.append('path')
      .attr('d', d => {
        const wordString = (d as any).triangulatedWords;
        const textWidth = wordString.length * 20;
        const half = Math.max(70, textWidth / 2 + 30);
        return `M 0,25 L ${-half},110 L ${half},110 Z`;
      })
      .attr('fill', 'rgba(16, 185, 129, 0.2)')
      .attr('stroke', PURE_WHITE)
      .attr('stroke-width', 3);

    triangles.append('text')
      .attr('y', 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '38px')
      .attr('font-weight', '900')
      .attr('fill', PURE_WHITE)
      .style('fill', PURE_WHITE, 'important')
      .style('font-family', 'Quicksand, sans-serif')
      .style('paint-order', 'stroke')
      .style('stroke', '#020806')
      .style('stroke-width', '9px')
      .text((d) => d.data.label || '');

    triangles.append('text')
      .attr('y', 155)
      .attr('text-anchor', 'middle')
      .attr('font-size', '52px') // Reduced for consistency
      .attr('font-weight', '900')
      .attr('fill', TARGET_EMERALD)
      .attr('style', `fill: ${TARGET_EMERALD} !important; font-family: 'Quicksand', sans-serif; font-style: italic; paint-order: stroke; stroke: #020806; stroke-width: 8px;`)
      .text((d: any) => (d as any).triangulatedWords);

    /*
     * Production visual-relations overlay.
     *
     * Semantics were compiled in replay/relations; here the laid-out
     * node positions bind the current frame's plan to primitives and draw
     * them in the shared zoom group. Authored trajectories are drawn from the
     * compiled plan and gate the legacy adapter so nothing draws twice.
     * Ghost-sets only restyle material the model explicitly authored silent. Marker sizes
     * stay screen-stable via per-marker counter-scaling; line strokes use
     * non-scaling strokes.
     */
    // Complete frame-stable overlay bounds, fed into viewport fitting so no
    // generated geometry on any side of the tree is clipped.
    let overlayFitBounds: OverlayBounds | null = null;
    if (
      !disableRelationOverlay
      && relationRenderPlan
      && usesDerivationFrames
      && Number.isInteger(activeDerivationFrameIndex)
      && activeDerivationFrameIndex >= 0
      && activeDerivationFrameIndex < relationRenderPlan.frames.length
    ) {
      const overlayNodeById = new Map<string, d3.HierarchyPointNode<SyntaxNode>>(
        visibleNodes.map((overlayNode) => [getNodeId(overlayNode as unknown as HierNode), overlayNode])
      );
      const visibleOverlayIds = new Set(overlayNodeById.keys());
      /*
       * Replay may keep an authored node (a pending Infl/T wrapper, an
       * expanded preterminal) out of the directly rendered set while its
       * display material stays visible. The anchored node's laid-out position
       * is still real geometry, so an anchor resolves whenever its own
       * subtree has visible material; an anchor with nothing visible fails
       * closed.
       */
      const laidOutNodeById = new Map<string, d3.HierarchyPointNode<SyntaxNode>>(
        treeData.descendants().map((laidOutNode) => [getNodeId(laidOutNode as unknown as HierNode), laidOutNode])
      );
      const resolveOverlayAnchor = (nodeId: string) => {
        const direct = overlayNodeById.get(nodeId);
        if (direct) return direct;
        const laidOut = laidOutNodeById.get(nodeId);
        if (!laidOut) return undefined;
        const hasVisibleMaterial = laidOut.descendants()
          .some((descendant) => visibleOverlayIds.has(getNodeId(descendant as unknown as HierNode)));
        return hasVisibleMaterial ? laidOut : undefined;
      };
      const isDisplayTerminalNode = (candidate: d3.HierarchyPointNode<SyntaxNode>) => {
        if ((candidate.children || []).length > 0) return false;
        const surface = resolveLeafSurface(candidate as unknown as HierNode);
        return Boolean(surface) && !isStructuralCategorySurface(surface);
      };
      /*
       * ONE terminal law for both providers (see
       * resolveUniqueDisplayTerminal): the anchor itself, else exactly one
       * display terminal in the exact subtree; zero or several fail closed —
       * an ambiguous anchor is recorded as a structured diagnostic, never
       * resolved by traversal order or current visibility.
       */
      const terminalAmbiguities = new Map<string, number>();
      const resolveMaterializedTerminal = (
        anchor: d3.HierarchyPointNode<SyntaxNode> | undefined,
        anchorNodeId: string
      ) => {
        if (!anchor) return undefined;
        const resolution = resolveUniqueDisplayTerminal(
          anchor,
          (candidate) => candidate.children || [],
          isDisplayTerminalNode
        );
        if (resolution.terminal) return resolution.terminal;
        if (resolution.reason === 'ambiguous') {
          terminalAmbiguities.set(anchorNodeId, resolution.count);
        }
        return undefined;
      };
      const positionFor: PlanPositionProvider = (nodeId, attachment = 'position') => {
        const anchor = resolveOverlayAnchor(String(nodeId || '').trim());
        if (!anchor) return null;
        if (attachment === 'terminal') {
          const terminal = resolveMaterializedTerminal(anchor, String(nodeId || '').trim());
          return terminal ? { x: terminal.x, y: terminal.y + 24 } : null;
        }
        if (attachment === 'parent') {
          const parent = anchor.parent;
          return parent ? { x: parent.x, y: parent.y } : null;
        }
        return { x: anchor.x, y: anchor.y };
      };
      /*
       * Replay-step timing: a same-stage relation's marks appear only once
       * its own Replay relation moment has played. Structural microsteps
       * before that moment show persisted earlier-stage marks only. The
       * committed (non-animated) view shows the complete frame.
       */
      /*
       * Reveal and focus by EXACT played identity, never by count: playback
       * may place relation moments around structural construction in a
       * different order than the authored relation array, so each relation
       * step carries its authored {stageIndex, relationIndex} and the plan
       * items are matched against exactly those.
       */
      const playedRelationIndices = animated
        ? playbackSteps.reduce((played, step, stepIdx) => {
            if (stepIdx > currentStepIndex) return played;
            if ((step as any).replayKind !== 'relation') return played;
            const identity = (step as any).replayRelationIdentity;
            if (identity && Number(identity.stageIndex) === activeDerivationFrameIndex) {
              played.add(Number(identity.relationIndex));
            }
            return played;
          }, new Set<number>())
        : null;
      const currentStepIdentity =
        animated && playbackSteps[currentStepIndex]?.replayKind === 'relation'
          ? (playbackSteps[currentStepIndex] as any).replayRelationIdentity
          : null;
      const activeRelationMoment = currentStepIdentity
        ? {
            stageIndex: Number(currentStepIdentity.stageIndex),
            relationIndex: Number(currentStepIdentity.relationIndex)
          }
        : null;
      /*
       * ONE STABLE ALLOCATION PER FRAME. Geometry is bound once from the
       * COMPLETE derivation frame layout — every item, every lane, every
       * stack, every rail — so nothing about an already-visible mark ever
       * jumps as later structural nodes or relation moments appear.
       * Reveal/focus below then draws only the marks whose exact relation
       * moments have played and whose syntax witnesses are visible; hidden
       * future marks RESERVE geometry but are never drawn.
       */
      const frameLayoutById = new Map<string, d3.HierarchyPointNode<SyntaxNode>>(
        (derivationFrameFitNodes ?? treeData.descendants()).map((frameNode) =>
          [getNodeId(frameNode as unknown as HierNode), frameNode as d3.HierarchyPointNode<SyntaxNode>])
      );
      const framePositionFor: PlanPositionProvider = (nodeId, attachment = 'position') => {
        const anchor = frameLayoutById.get(String(nodeId || '').trim());
        if (!anchor) return null;
        if (attachment === 'terminal') {
          // The exact same pure law as the step-visible provider, so the
          // two can never disagree about an endpoint.
          const terminal = resolveMaterializedTerminal(anchor, String(nodeId || '').trim());
          return terminal ? { x: terminal.x, y: terminal.y + 24 } : null;
        }
        if (attachment === 'parent') {
          const parent = anchor.parent;
          return parent ? { x: parent.x, y: parent.y } : null;
        }
        return { x: anchor.x, y: anchor.y };
      };
      const zoomK = svgRef.current ? (d3.zoomTransform(svgRef.current).k || 1) : 1;
      // Screen-stable marker sizing, capped so far-out zoom never lets the
      // markers dwarf the tree they annotate.
      const markerScale = Math.min(1 / zoomK, 3);
      const frameMaxNodeY = d3.max([...frameLayoutById.values()], (frameNode) => frameNode.y) ?? 0;
      const boundFrame = bindRelationPlanFrame(
        relationRenderPlan,
        activeDerivationFrameIndex,
        framePositionFor,
        {
          labelWidth: 150,
          labelHeight: 70,
          badgeGap: 46,
          laneGap: 60,
          markerScale,
          // Frame-stable measured baselines: connector lanes just below the
          // complete frame's terminal row; rails placed by the binder's one
          // vertical allocation law beneath the deepest allocated lane.
          connectorBaselineY: frameMaxNodeY + 130,
          railBaseY: frameMaxNodeY + 240
        }
      );
      const frameItems = relationRenderPlan.frames[activeDerivationFrameIndex]?.items ?? [];
      const revealedItemIndices = new Set<number>();
      frameItems.forEach((planItem, planItemIndex) => {
        const revealed = playedRelationIndices === null
          || planItem.appearsAtStage < activeDerivationFrameIndex
          || [planItem.relationRef, ...(planItem.coalescedRefs || [])].some((ref) =>
            ref.stageIndex === activeDerivationFrameIndex
            && playedRelationIndices.has(ref.relationIndex));
        if (revealed) revealedItemIndices.add(planItemIndex);
      });
      const witnessVisibilityCache = new Map<number, boolean>();
      const itemWitnessesVisible = (planItemIndex: number): boolean => {
        const cached = witnessVisibilityCache.get(planItemIndex);
        if (cached !== undefined) return cached;
        const planItem = frameItems[planItemIndex];
        // A mark never draws on hidden syntax: every node id it depends on
        // must currently resolve against visible structure.
        const visible = Boolean(planItem)
          && planItemDependencyNodeIds(planItem).every((nodeId) => Boolean(resolveOverlayAnchor(nodeId)));
        witnessVisibilityCache.set(planItemIndex, visible);
        return visible;
      };
      const overlay = g.append('g').attr('class', 'vr-overlay-layer');
      // Fail-closed marks are diagnosable, never silent: the layer carries
      // which anchored nodes could not be measured.
      overlay.attr(
        'data-vr-failed',
        boundFrame.failed.map((failure) => failure.nodeId).join(' ')
      );
      // Structured ambiguity diagnostics: anchors whose subtrees held more
      // than one display terminal; their marks failed closed, never guessed.
      overlay.attr(
        'data-vr-terminal-ambiguity',
        [...terminalAmbiguities.entries()]
          .map(([ambiguousNodeId, terminalCount]) => `${ambiguousNodeId}:${terminalCount}`)
          .join(' ')
      );
      const overlayDefs = overlay.append('defs');
      overlayDefs.append('marker')
        .attr('id', 'vr-overlay-arrowhead')
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9)
        .attr('refY', 5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M 0 0 L 10 5 L 0 10 z')
        .attr('fill', '#34d399');
      /*
       * Every primitive draws inside its own host group so the Replay
       * relation lens can emphasize or quiet the WHOLE mark uniformly:
       * during a relation moment the played relation's marks are prominent
       * and every other visible mark stays present but quieter. Emphasis
       * changes nothing about the linguistic claims or persistence.
       */
      let primitiveHost: d3.Selection<SVGGElement, unknown, null, undefined> = overlay;
      const ghostLensRequests: Array<{
        nodeIds: string[];
        emphasis: 'active' | 'quiet' | null;
      }> = [];
      const appendMarker = (markX: number, markY: number) => primitiveHost.append('g')
        .attr('class', 'vr-overlay-marker')
        .attr('data-vr-x', String(markX))
        .attr('data-vr-y', String(markY))
        .attr('transform', `translate(${markX},${markY}) scale(${markerScale})`);
      /*
       * Complete, frame-stable overlay bounds (all four sides, glyph and
       * label extents included) from the FULL allocation — the camera fits
       * once per frame and never re-fits when a relation is revealed.
       * Nominal marker scale keeps the bounds zoom-independent.
       */
      overlayFitBounds = boundOverlayBounds(boundFrame, { markerScale: 1 });

      boundFrame.primitives.forEach((primitive) => {
        /*
         * The Replay relation lens, uniform across every primitive type:
         * during a relation moment the played relation's marks (matched by
         * exact authored identity, including coalesced contributors) are
         * prominent and everything else visible stays present but quiet.
         */
        const planItem = frameItems[primitive.itemIndex];
        if (!planItem) return;
        // Future marks reserve geometry but are never drawn or focusable;
        // no mark draws while any of its syntax witnesses is hidden.
        if (!revealedItemIndices.has(primitive.itemIndex)) return;
        if (!itemWitnessesVisible(primitive.itemIndex)) return;
        const emphasis: 'active' | 'quiet' | null = activeRelationMoment && planItem
          ? (planItemOwnsRelationMoment(
              planItem,
              activeRelationMoment.stageIndex,
              activeRelationMoment.relationIndex
            ) ? 'active' : 'quiet')
          : null;
        const host = overlay.append('g')
          .attr('class', 'vr-item')
          .attr('data-vr-emphasis', emphasis ?? 'none')
          .classed('vr-relation-active', emphasis === 'active')
          .attr('opacity', emphasis === 'quiet' ? 0.3 : null);
        primitiveHost = host;
        if (primitive.type === 'trajectory-path') {
          /*
           * The compiled plan is the one semantic authority for authored
           * trajectories: every instance draws here, per-instance, with the
           * production movement styling and a deterministic fan for
           * coincident routes. The legacy movement adapter is gated off for
           * derivations the plan covers.
           */
          const relationRefs = planItem
            ? [planItem.relationRef, ...(planItem.coalescedRefs || [])]
            : [];
          host.append('path')
            .attr('class', `vr-trajectory movement-arrow vr-trajectory-${primitive.trajectoryKind}`)
            .attr('data-vr-active-relation', emphasis === 'active' ? 'true' : 'false')
            .attr('data-vr-relation-ref-count', String(relationRefs.length))
            .attr('fill', 'none')
            .attr('stroke', MOVEMENT_ARROW_COLOR)
            .attr('stroke-width', emphasis === 'active' ? MOVEMENT_ARC_STROKE * 1.45 : MOVEMENT_ARC_STROKE)
            .attr('stroke-linecap', 'round')
            .attr('marker-end', 'url(#vr-overlay-arrowhead)')
            .style(
              'filter',
              emphasis === 'active'
                ? 'drop-shadow(0 0 7px rgba(52,211,153,0.72))'
                : 'drop-shadow(0 0 4px rgba(16,185,129,0.35))'
            )
            .attr('opacity', emphasis === 'active' ? 1 : 0.78)
            // The binder owns the exact movement path; draw it verbatim.
            .attr('d', primitive.d);
          return;
        }
        if (primitive.type === 'ghost-set') {
          /*
           * Silence styling for material the model itself authored silent —
           * never a rewrite of words or symbols, and never applied to overt
           * material. Ghost lens states are collected here and resolved
           * after the loop so that when several ellipsis claims share ghost
           * material, an active moment always wins over a quiet one.
           */
          ghostLensRequests.push({ nodeIds: primitive.nodeIds, emphasis });
          return;
        }
        if (primitive.type === 'shape-path') {
          /*
           * Family-specific accepted shapes: the binder already computed the
           * exact accepted path data and decorations from the pure mark
           * geometry; this branch draws precisely what is declared and
           * restyles nothing from a name.
           */
          const blocked = primitive.blocked === true;
          const strokeColor = blocked ? '#f87171' : '#34d399';
          host.append('path')
            .attr('class', `vr-shape-path vr-shape-${primitive.shapeStyle}`)
            .attr('d', primitive.d)
            .attr('fill', 'none')
            .attr('stroke', strokeColor)
            .attr('stroke-opacity', 0.85)
            .attr('stroke-width', 1.8)
            .attr('stroke-linecap', 'round')
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('stroke-dasharray', primitive.stroke === 'dashed'
              ? '7 7'
              : primitive.stroke === 'dotted' ? '2 6' : null)
            .attr('marker-end', primitive.arrowhead ? 'url(#vr-overlay-arrowhead)' : null)
            .attr('marker-start', primitive.arrowheadBoth ? 'url(#vr-overlay-arrowhead)' : null);
          (primitive.endpointDots || []).forEach((dot) => {
            host.append('circle')
              .attr('class', 'vr-shape-endpoint')
              .attr('cx', dot.x)
              .attr('cy', dot.y)
              .attr('r', 9)
              .attr('fill', strokeColor)
              .attr('fill-opacity', 0.95);
          });
          if (primitive.originDot) {
            host.append('circle')
              .attr('class', 'vr-shape-origin')
              .attr('cx', primitive.originDot.x)
              .attr('cy', primitive.originDot.y)
              .attr('r', 8)
              .attr('fill', 'none')
              .attr('stroke', strokeColor)
              .attr('stroke-width', 1.6)
              .attr('vector-effect', 'non-scaling-stroke');
          }
          if (primitive.tip) {
            if (primitive.tip.kind === 'cross') {
              const cross = appendMarker(primitive.tip.at.x, primitive.tip.at.y);
              cross.append('text')
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('fill', '#f87171')
                .text('✗');
            } else if (primitive.tip.d) {
              host.append('path')
                .attr('class', `vr-shape-tip vr-tip-${primitive.tip.kind}`)
                .attr('d', primitive.tip.d)
                .attr('fill', 'none')
                .attr('stroke', primitive.tip.kind === 'bar' ? '#f87171' : '#34d399')
                .attr('stroke-width', 2.4)
                .attr('stroke-linecap', 'round')
                .attr('vector-effect', 'non-scaling-stroke');
            }
          }
          if (primitive.label && primitive.labelAt) {
            const labelMarker = appendMarker(primitive.labelAt.x, primitive.labelAt.y);
            labelMarker.append('text')
              .attr('class', 'vr-path-label')
              .attr('text-anchor', 'middle')
              .attr('font-size', '11px')
              .attr('fill', '#a7f3d0')
              .attr('font-family', "'IBM Plex Mono', monospace")
              .text(primitive.label);
          }
          if (primitive.badge) {
            const badgeMarker = appendMarker(primitive.badge.at.x, primitive.badge.at.y);
            badgeMarker.append('circle')
              .attr('r', 12)
              .attr('fill', 'rgba(2,24,15,0.94)')
              .attr('stroke', '#34d399')
              .attr('stroke-width', 1.2);
            badgeMarker.append('text')
              .attr('text-anchor', 'middle')
              .attr('y', 4)
              .attr('font-size', '11px')
              .attr('fill', '#a7f3d0')
              .attr('font-family', "'IBM Plex Mono', monospace")
              .text(primitive.badge.text);
          }
          return;
        }
        if (primitive.type === 'path-node-ring') {
          // Phillips path-following marks: the ellipse or square encloses the
          // node's own label at its rendered position.
          if (primitive.role === 'primary' && primitive.ellipse) {
            host.append('ellipse')
              .attr('class', 'vr-path-node vr-path-node-primary')
              .attr('data-path-node', primitive.nodeId)
              .attr('cx', primitive.ellipse.cx)
              .attr('cy', primitive.ellipse.cy)
              .attr('rx', primitive.ellipse.rx)
              .attr('ry', primitive.ellipse.ry)
              .attr('fill', 'none')
              .attr('stroke', '#34d399')
              .attr('stroke-opacity', 0.85)
              .attr('stroke-width', 1.8)
              .attr('vector-effect', 'non-scaling-stroke');
          } else if (primitive.rect) {
            host.append('rect')
              .attr('class', 'vr-path-node vr-path-node-secondary')
              .attr('data-path-node', primitive.nodeId)
              .attr('x', primitive.rect.x)
              .attr('y', primitive.rect.y)
              .attr('width', primitive.rect.width)
              .attr('height', primitive.rect.height)
              .attr('rx', 2)
              .attr('fill', 'none')
              .attr('stroke', '#34d399')
              .attr('stroke-opacity', 0.85)
              .attr('stroke-width', 1.8)
              .attr('vector-effect', 'non-scaling-stroke');
          }
          return;
        }
        if (primitive.type === 'domain-region') {
          const fillOnly = primitive.domainStyle === 'transfer-spellout';
          const isTransferEdge = primitive.domainStyle === 'transfer-edge';
          host.append('rect')
            .attr('class', `vr-domain-region vr-domain-${primitive.domainStyle}`)
            .attr('data-vr-outcome', primitive.outcome || '')
            .attr('x', primitive.x)
            .attr('y', primitive.y)
            .attr('width', primitive.width)
            .attr('height', primitive.height)
            .attr('rx', isTransferEdge ? 6 : 18)
            .attr('fill', fillOnly || primitive.domainStyle === 'forbidden-region'
              ? 'rgba(52,211,153,0.07)'
              : 'none')
            .attr('stroke', fillOnly ? 'none' : (primitive.outcome === 'blocked' ? '#f87171' : '#34d399'))
            .attr('stroke-opacity', isTransferEdge ? 0.8 : 0.55)
            .attr('stroke-width', 1.6)
            .attr('stroke-dasharray', ['adjunct-domain', 'scope', 'forbidden-region', 'control-domain'].includes(primitive.domainStyle) ? '7 7' : null)
            .attr('vector-effect', 'non-scaling-stroke');
          if (primitive.outcome === 'blocked' || primitive.label) {
            const edgeMarker = isTransferEdge
              ? appendMarker(primitive.x - 8, primitive.y + primitive.height / 2)
              : appendMarker(primitive.x + primitive.width, primitive.y);
            edgeMarker.append('text')
              .attr('text-anchor', isTransferEdge ? 'end' : 'start')
              .attr('font-size', '12px')
              .attr('fill', primitive.outcome === 'blocked' ? '#f87171' : '#a7f3d0')
              .text(primitive.outcome === 'blocked' ? '✗' : primitive.label || '');
          }
          return;
        }
        if (primitive.type === 'plaque') {
          const marker = appendMarker(primitive.x, primitive.y);
          const rows = primitive.rows.slice(0, 8);
          marker.append('rect')
            .attr('class', `vr-plaque vr-plaque-${primitive.plaqueStyle}`)
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', primitive.width)
            .attr('height', primitive.height)
            .attr('rx', 5)
            .attr('fill', 'rgba(2,24,15,0.94)')
            .attr('stroke', '#34d399')
            .attr('stroke-width', 1);
          if (primitive.title) {
            marker.append('text')
              .attr('x', 8)
              .attr('y', 14)
              .attr('font-size', '11px')
              .attr('fill', '#6ee7b7')
              .attr('font-family', "'IBM Plex Mono', monospace")
              .text(primitive.title);
          }
          rows.forEach((row, rowIndex) => {
            marker.append('text')
              .attr('x', 8)
              .attr('y', 28 + rowIndex * 15)
              .attr('font-size', '10px')
              .attr('fill', '#a7f3d0')
              .attr('font-family', "'IBM Plex Mono', monospace")
              .text(row.value ? `${row.label}: ${row.value}` : row.label);
          });
          return;
        }
        if (primitive.type === 'text-badge') {
          const marker = appendMarker(primitive.x, primitive.y);
          if (primitive.shape === 'circle') {
            marker.append('circle')
              .attr('r', 9)
              .attr('fill', 'rgba(2,24,15,0.92)')
              .attr('stroke', primitive.outcome === 'blocked' ? '#f87171' : '#34d399')
              .attr('stroke-width', 1.2);
          } else if (primitive.shape === 'square') {
            marker.append('rect')
              .attr('x', -8).attr('y', -8)
              .attr('width', 16).attr('height', 16)
              .attr('fill', 'rgba(2,24,15,0.92)')
              .attr('stroke', primitive.outcome === 'blocked' ? '#f87171' : '#34d399')
              .attr('stroke-width', 1.2);
          }
          marker.append('text')
            .attr('class', `vr-text-badge vr-badge-${primitive.badgeStyle}`)
            .attr('text-anchor', 'middle')
            .attr('y', 4)
            .attr('font-size', '11px')
            .attr('fill', '#a7f3d0')
            .attr('font-family', "'IBM Plex Mono', monospace")
            .text(primitive.text);
          return;
        }
        if (primitive.type === 'strike') {
          host.append('line')
            .attr('class', 'vr-strike')
            .attr('x1', primitive.x1)
            .attr('x2', primitive.x2)
            .attr('y1', primitive.y)
            .attr('y2', primitive.y)
            .attr('stroke', '#a7f3d0')
            .attr('stroke-opacity', 0.85)
            .attr('stroke-width', 2)
            .attr('vector-effect', 'non-scaling-stroke');
          return;
        }
        if (primitive.type === 'enclosure') {
          host.append('rect')
            .attr('class', `vr-enclosure vr-enclosure-${primitive.licence}`)
            .attr('x', primitive.x)
            .attr('y', primitive.y)
            .attr('width', primitive.width)
            .attr('height', primitive.height)
            .attr('rx', 8)
            .attr('fill', primitive.licence === 'carrier-chunk' ? 'rgba(52,211,153,0.08)' : 'none')
            .attr('stroke', '#34d399')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1.6)
            .attr('vector-effect', 'non-scaling-stroke');
          return;
        }
        if (primitive.type === 'branch-emphasis') {
          primitive.strongEdges.forEach((edge) => {
            host.append('line')
              .attr('class', 'vr-branch-strong')
              .attr('x1', edge.from.x).attr('y1', edge.from.y)
              .attr('x2', edge.to.x).attr('y2', edge.to.y)
              .attr('stroke', '#34d399')
              .attr('stroke-opacity', 0.9)
              .attr('stroke-width', 4)
              .attr('vector-effect', 'non-scaling-stroke');
          });
          primitive.weakEdges.forEach((edge) => {
            host.append('line')
              .attr('class', 'vr-branch-weak')
              .attr('x1', edge.from.x).attr('y1', edge.from.y)
              .attr('x2', edge.to.x).attr('y2', edge.to.y)
              .attr('stroke', '#34d399')
              .attr('stroke-opacity', 0.35)
              .attr('stroke-width', 1.2)
              .attr('stroke-dasharray', '3 5')
              .attr('vector-effect', 'non-scaling-stroke');
          });
          return;
        }
        if (primitive.type === 'shared-branch') {
          host.append('line')
            .attr('class', 'vr-shared-branch')
            .attr('x1', primitive.from.x)
            .attr('y1', primitive.from.y)
            .attr('x2', primitive.to.x)
            .attr('y2', primitive.to.y)
            .attr('stroke', '#34d399')
            .attr('stroke-opacity', 0.7)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '8 5')
            .attr('vector-effect', 'non-scaling-stroke');
          return;
        }
        if (primitive.type === 'segment') {
          // The binder emits COMPLETE connector geometry: the row-2
          // counter-lane path (allocated lane, stems into the rendered mark
          // centers) or the row-3 direct mark-to-mark spoke. Draw exactly
          // that path — the routing decision is not this component's to
          // discard. Quiet, undirected, arrowless.
          host.append('path')
            .attr('class', `vr-fallback-segment vr-fallback-segment-${primitive.route}`)
            .attr('data-vr-lane', primitive.lane === null ? 'direct' : String(primitive.lane))
            .attr('d', primitive.d)
            .attr('fill', 'none')
            .attr('stroke', '#34d399')
            .attr('stroke-opacity', 0.55)
            .attr('stroke-width', 1.6)
            .attr('stroke-linecap', 'round')
            .attr('vector-effect', 'non-scaling-stroke');
          return;
        }
        if (primitive.type === 'domain-ellipse') {
          host.append('ellipse')
            .attr('class', 'vr-domain-ellipse')
            .attr('data-vr-outcome', primitive.outcome)
            .attr('cx', primitive.cx)
            .attr('cy', primitive.cy)
            .attr('rx', primitive.rx)
            .attr('ry', primitive.ry)
            .attr('fill', 'none')
            .attr('stroke', '#34d399')
            .attr('stroke-opacity', 0.7)
            .attr('stroke-width', 1.8)
            .attr('vector-effect', 'non-scaling-stroke');
          return;
        }
        if (primitive.type === 'index-badge') {
          const marker = appendMarker(primitive.x, primitive.y);
          marker.append('text')
            .attr('class', 'vr-index-badge')
            .attr('x', 8)
            .attr('y', 4)
            .attr('font-size', '13px')
            .attr('fill', '#a7f3d0')
            .attr('font-family', "'IBM Plex Mono', monospace")
            .text(primitive.index);
          return;
        }
        if (primitive.type === 'fallback-mark') {
          const marker = appendMarker(primitive.x, primitive.y);
          if (primitive.frame === 'box') {
            marker.append('rect')
              .attr('class', 'vr-fallback-frame')
              .attr('x', -9).attr('y', -9)
              .attr('width', 18).attr('height', 18)
              .attr('fill', 'rgba(2,24,15,0.92)')
              .attr('stroke', '#34d399')
              .attr('stroke-width', 1.2);
          } else {
            marker.append('circle')
              .attr('class', 'vr-fallback-frame')
              .attr('r', 10)
              .attr('fill', 'rgba(2,24,15,0.92)')
              .attr('stroke', '#34d399')
              .attr('stroke-width', 1.2);
          }
          // Accepted numbering contract: the relation INSTANCE number is
          // always centered inside every fallback frame; the authored array
          // POSITION, when present, is a second smaller numeral outside it.
          marker.append('text')
            .attr('class', 'vr-fallback-instance')
            .attr('text-anchor', 'middle')
            .attr('y', 4)
            .attr('font-size', '11px')
            .attr('fill', '#a7f3d0')
            .attr('font-family', "'IBM Plex Mono', monospace")
            .text(String(primitive.instance));
          if (primitive.numeral !== null) {
            marker.append('text')
              .attr('class', 'vr-fallback-position')
              .attr('text-anchor', 'start')
              .attr('x', 12)
              .attr('y', 8)
              .attr('font-size', '9px')
              .attr('fill', '#6ee7b7')
              .attr('font-family', "'IBM Plex Mono', monospace")
              .text(String(primitive.numeral));
          }
          if (primitive.backward) {
            marker.append('text')
              .attr('class', 'vr-backward-cue')
              .attr('x', -16)
              .attr('y', 4)
              .attr('font-size', '10px')
              .attr('fill', '#6ee7b7')
              .text('◂');
          }
          return;
        }
        if (primitive.type === 'anchor-set-badge') {
          const compact = primitive.badgeSize === 'compact';
          const marker = appendMarker(primitive.x, primitive.y);
          marker.append('circle')
            .attr('class', 'vr-anchor-set-badge')
            .attr('r', compact ? 7 : 9)
            .attr('fill', 'rgba(2,24,15,0.92)')
            .attr('stroke', '#34d399')
            .attr('stroke-width', 1.2);
          marker.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', compact ? 3 : 4)
            .attr('font-size', compact ? '8px' : '10px')
            .attr('fill', '#a7f3d0')
            .attr('font-family', "'IBM Plex Mono', monospace")
            .text(String(primitive.numeral));
          return;
        }
        if (primitive.type === 'anchor-set-rail') {
          host.append('line')
            .attr('class', 'vr-anchor-set-rail')
            .attr('x1', primitive.x1)
            .attr('x2', primitive.x2)
            .attr('y1', primitive.y)
            .attr('y2', primitive.y)
            .attr('stroke', '#34d399')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1.4)
            .attr('vector-effect', 'non-scaling-stroke');
        }
      });

      /*
       * Resolve ghost lens states: for material shared by several ellipsis
       * claims, an active moment wins over neutral, which wins over quiet.
       * The presentation itself is the pure, tested law from the binder —
       * active silence glows without ever looking pronounced; quiet silence
       * recedes below its neutral opacity like every other quiet mark.
       */
      const ghostEmphasisByNode = new Map<string, 'active' | 'quiet' | null>();
      const ghostRank = (state: 'active' | 'quiet' | null): number =>
        state === 'active' ? 2 : state === null ? 1 : 0;
      ghostLensRequests.forEach((request) => {
        request.nodeIds.forEach((ghostNodeId) => {
          const current = ghostEmphasisByNode.get(ghostNodeId);
          if (current === undefined || ghostRank(request.emphasis) > ghostRank(current)) {
            ghostEmphasisByNode.set(ghostNodeId, request.emphasis);
          }
        });
      });
      ghostEmphasisByNode.forEach((ghostEmphasis, ghostNodeId) => {
        const presentation = ghostLensPresentation(ghostEmphasis);
        g.selectAll<SVGTextElement, unknown>(
          `.terminal-label[data-node-id="${ghostNodeId}"], .category-label[data-category-node-id="${ghostNodeId}"]`
        )
          .classed('vr-ghost', true)
          .attr('data-vr-ghost-emphasis', ghostEmphasis ?? 'none')
          .attr('opacity', presentation.opacity)
          .style('filter', presentation.filter);
      });
    }

    // Initial viewport fit:
    // Derivation replay should keep one camera per Derivation frame, not refit to each
    // microstep's partial tree. That prevents fake left/right "movement" for
    // newly revealed branches like Teresa -> D -> DP before the real merge step.
    const fitToRenderedBounds = () => {
      if (derivationFrameFitNodes && derivationFrameFitNodes.length > 0) {
        const minNodeX = Math.min(
          d3.min(derivationFrameFitNodes, (node) => node.x) ?? 0,
          overlayFitBounds?.minX ?? Infinity
        );
        const maxNodeX = Math.max(
          d3.max(derivationFrameFitNodes, (node) => node.x) ?? 0,
          overlayFitBounds?.maxX ?? -Infinity
        );
        const minNodeY = Math.min(
          d3.min(derivationFrameFitNodes, (node) => node.y) ?? 0,
          overlayFitBounds?.minY ?? Infinity
        );
        const maxNodeY = Math.max(
          d3.max(derivationFrameFitNodes, (node) => node.y + (!node.children || node.children.length === 0 ? 130 : 0)) ?? 0,
          overlayFitBounds?.maxY ?? -Infinity
        );
        const viewportPadLeft = 40;
        const viewportPadRight = 136;
        const viewportPadTop = 34;
        const viewportPadBottom = animated ? 170 : 250;
        const availableWidth = Math.max(120, containerWidth - viewportPadLeft - viewportPadRight);
        const availableHeight = Math.max(120, containerHeight - viewportPadTop - viewportPadBottom);
        const contentWidth = Math.max(1, (maxNodeX - minNodeX) + 440);
        const contentHeight = Math.max(1, (maxNodeY - minNodeY) + 320);
        const scaleX = availableWidth / contentWidth;
        const scaleY = availableHeight / contentHeight;
        const initialScale = Math.max(0.06, Math.min(scaleX, scaleY, 1));
        const centerX = (minNodeX + maxNodeX) / 2;
        const centerY = (minNodeY + maxNodeY) / 2;
        const initialX = viewportPadLeft + (availableWidth / 2) - centerX * initialScale;
        const initialY = viewportPadTop + (availableHeight / 2) - centerY * initialScale;
        svg.call(zoom.transform as any, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));
        return true;
      }

      const rendered = g.node() as SVGGElement | null;
      if (!rendered) return false;

      const bbox = rendered.getBBox();
      if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
        return false;
      }

      const viewportPadLeft = 40;
      const viewportPadRight = 136;
      const viewportPadTop = 34;
      // Reserve space for bottom overlays (input tray / derivation controls) so terminals remain visible.
      const viewportPadBottom = animated ? 170 : 250;
      const availableWidth = Math.max(120, containerWidth - viewportPadLeft - viewportPadRight);
      const availableHeight = Math.max(120, containerHeight - viewportPadTop - viewportPadBottom);

      const scaleX = availableWidth / bbox.width;
      const scaleY = availableHeight / bbox.height;
      const initialScale = Math.max(0.06, Math.min(scaleX, scaleY, 1));

      const bboxCenterX = bbox.x + bbox.width / 2;
      const bboxCenterY = bbox.y + bbox.height / 2;
      const targetCenterX = viewportPadLeft + availableWidth / 2;
      const targetCenterY = viewportPadTop + availableHeight / 2;
      const initialX = targetCenterX - bboxCenterX * initialScale;
      const initialY = targetCenterY - bboxCenterY * initialScale;

      svg.call(zoom.transform as any, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));
      return true;
    };

    if (!fitToRenderedBounds() && visibleNodes.length > 0) {
      // Fallback fit in case getBBox is unavailable.
      const minNodeX = d3.min(visibleNodes, (node) => node.x) ?? 0;
      const maxNodeX = d3.max(visibleNodes, (node) => node.x) ?? 0;
      const minNodeY = d3.min(visibleNodes, (node) => node.y) ?? 0;
      const maxNodeY = d3.max(visibleNodes, (node) => node.y + (!node.children || node.children.length === 0 ? 130 : 0)) ?? 0;
      const contentWidth = Math.max(1, (maxNodeX - minNodeX) + 440);
      const contentHeight = Math.max(1, (maxNodeY - minNodeY) + 320);
      const fallbackViewportPadLeft = 40;
      const fallbackViewportPadRight = 136;
      const scaleX = Math.max(0.01, (containerWidth - fallbackViewportPadLeft - fallbackViewportPadRight) / contentWidth);
      const scaleY = Math.max(0.01, (containerHeight - 220) / contentHeight);
      const initialScale = Math.max(0.06, Math.min(scaleX, scaleY, 1));
      const centerX = (minNodeX + maxNodeX) / 2;
      const centerY = (minNodeY + maxNodeY) / 2;
      const initialX = fallbackViewportPadLeft + ((containerWidth - fallbackViewportPadLeft - fallbackViewportPadRight) / 2) - centerX * initialScale;
      const initialY = (containerHeight - 140) / 2 - centerY * initialScale;
      svg.call(zoom.transform as any, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));
    }

  }, [
    activeDerivationFrame,
    activeDerivationFrameIndex,
    activeDerivationArrowLinks,
    activeDerivationRelationLinks,
    activeStepIndex,
    canvasData,
    dimensions,
    animated,
    abstractionMode,
    derivationStepsSignature,
    derivationFramesSignature,
    disableRelationOverlay,
    movementProtectedNodeIds,
    replayVisibleNodeIdSet,
    traceDisplayFrame,
    traceDisplayFrameIndex,
    traceDisplayRelationLinks,
    usesDerivationFrames,
    relationRenderPlan
  ]);

  const activeStepRaw = currentStepIndex >= 0 ? playbackSteps[currentStepIndex] : null;
  const activeStep = activeStepRaw;
  const activeRecipeDisplay = stepRepresentsMovement(activeStep)
    ? formatOperationLabel(activeStep?.operation)
    : (String(activeStep?.recipe || '').trim() || `${activeStep?.targetLabel || 'Node'} created`);
  const activeSpelloutDisplay = Array.isArray(activeStep?.spelloutOrder)
    ? activeStep.spelloutOrder.filter(Boolean).join(' | ')
    : '';
  const activeReplaySupportLines = buildReplaySupportLines(activeStep, activeSpelloutDisplay, sentence);
  const activeNoteDisplay = (() => {
    const note = String(activeStep?.note || '').trim();
    if (!note) return '';
    if (note === activeRecipeDisplay) return '';
    const normalizeSurfaceText = (value?: string): string =>
      String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (
      note.toLowerCase().startsWith('committed surface order:')
      && sentence
      && normalizeSurfaceText(note.replace(/^Committed surface order:\s*/i, '')) === normalizeSurfaceText(sentence)
    ) {
      return '';
    }
    return note;
  })();
  const stepPercent = playbackSteps.length > 1
    ? (activeStepIndex / (playbackSteps.length - 1)) * 100
    : 0;
  const operationLabel = formatPlaybackOperationTitle(activeStep);
  const showOperationLabel = Boolean(operationLabel) && operationLabel !== activeRecipeDisplay;
  const replayDisplayDetailBlocksByStepIndex = useMemo(
    () => buildReplayDisplayDetailBlocks(playbackSteps),
    [playbackSteps]
  );
  const activeDisplayDetailBlocks = replayDisplayDetailBlocksByStepIndex.get(activeStepIndex) || [];
  const canStepBackward = animated && playbackSteps.length > 0 && activeStepIndex > 0;
  const canStepForward = animated && playbackSteps.length > 0 && activeStepIndex < playbackSteps.length - 1;
  const activeDerivationStepLabel = String(activeStep?.stepId || '').trim();
  const activeReplayProgressLabel = String(activeStep?.replayProgressLabel || '').trim();
  const activeStageDisplayLabel = activeReplayProgressLabel
    || (activeDerivationStepLabel ? `Derivation Step ${activeDerivationStepLabel}` : '');

  const handlePrevStep = () => {
    setIsScrubbing(false);
    setIsAutoPlaying(false);
    setActiveStepIndex((index) => Math.max(0, index - 1));
  };

  const handleNextStep = () => {
    setIsScrubbing(false);
    setIsAutoPlaying(false);
    setActiveStepIndex((index) => Math.min(playbackSteps.length - 1, index + 1));
  };

  const handleTogglePlayback = () => {
    if (!animated || playbackSteps.length === 0) return;
    setIsScrubbing(false);
    if (activeStepIndex >= playbackSteps.length - 1) {
      setActiveStepIndex(0);
      setIsAutoPlaying(true);
      return;
    }
    setIsAutoPlaying((playing) => !playing);
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden border-2 border-white/5 rounded-[3rem] tree-canvas-bg shadow-2xl relative">
      <div className="absolute top-8 left-10 pointer-events-none z-10 opacity-75 select-none">
        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.6em] flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${abstractionMode ? 'bg-amber-500 shadow-[0_0_15px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_15px_#10b981]'}`}></div>
          {abstractionMode ? 'CONSTITUENT GLYPHING ACTIVE' : (animated ? 'DERIVATION SEQUENCE ACTIVE' : 'ARBORETUM CANOPY')}
        </div>
        {animated && playbackSteps.length > 0 && (
          <div className="mt-2 text-[9px] font-black text-emerald-500/80 uppercase tracking-[0.35em]">
            Replay Frame {activeStepIndex + 1}/{playbackSteps.length}
            {activeStageDisplayLabel ? ` \u00b7 ${activeStageDisplayLabel}` : ''}
            {activeStep?.recipe ? ` - ${activeRecipeDisplay}` : ''}
          </div>
        )}
      </div>
      {animated && playbackSteps.length > 0 && (
        <div
          data-babel-replay-panel="true"
          className="absolute left-8 bottom-24 z-40 w-[min(880px,calc(100%-4rem))] max-h-[44vh] bg-[#020806]/96 border border-[#17362d] rounded-2xl p-4 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={!canStepBackward}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 enabled:hover:text-emerald-300 enabled:hover:border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={handleTogglePlayback}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 hover:bg-emerald-500/20"
            >
              {isAutoPlaying ? 'Pause' : (activeStepIndex >= playbackSteps.length - 1 ? 'Replay' : 'Play')}
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!canStepForward}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 enabled:hover:text-emerald-300 enabled:hover:border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <div className="ml-auto text-right">
              <div className="text-[10px] font-black tracking-[0.14em] text-emerald-400/80">
                Replay {activeStepIndex + 1}/{playbackSteps.length}
                {activeStageDisplayLabel ? ` \u00b7 ${activeStageDisplayLabel}` : ''}
              </div>
              {showOperationLabel && (
                <div className="mt-1 text-[10px] font-black tracking-[0.14em] text-emerald-400/80">
                  {operationLabel}
                </div>
              )}
            </div>
          </div>
          <div className="relative h-8">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-black/50 rounded-full border border-white/5" />
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-2 bg-[#064e3b] rounded-full ${isScrubbing ? '' : 'transition-all duration-150'}`}
              style={{ width: `${stepPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(playbackSteps.length - 1, 0)}
              value={activeStepIndex}
              onPointerDown={() => {
                setIsAutoPlaying(false);
                setIsScrubbing(true);
              }}
              onPointerUp={() => setIsScrubbing(false)}
              onPointerCancel={() => setIsScrubbing(false)}
              onMouseUp={() => setIsScrubbing(false)}
              onTouchEnd={() => setIsScrubbing(false)}
              onBlur={() => setIsScrubbing(false)}
              onChange={(event) => {
                setIsAutoPlaying(false);
                setActiveStepIndex(Number(event.target.value));
              }}
              className="derivation-slider absolute inset-0 w-full h-full z-10"
            />
            <div
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${isScrubbing ? '' : 'transition-all duration-150'}`}
              style={{ left: `${stepPercent}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-[0_0_12px_rgba(167,243,208,0.75)]">
                <RootLogo size={12} blend={false} zoom={1.12} />
              </div>
            </div>
          </div>
          <div className="mt-3 max-h-[calc(44vh-8rem)] overflow-y-auto pr-1 space-y-3">
            <div data-babel-replay-summary="true" className="text-[11px] text-white font-semibold">
              {activeRecipeDisplay}
            </div>
            {activeReplaySupportLines.length > 0 && (
              <div className="space-y-1 text-[10px] tracking-[0.12em] text-emerald-300/90">
                {activeReplaySupportLines.map((line) => (
                  <div key={`${line.label}:${line.value}`} className="leading-relaxed">
                    <span>{line.label}:</span>
                    <span className="ml-2 text-[11px] tracking-normal text-white/92">{line.value}</span>
                  </div>
                ))}
              </div>
            )}
            {activeDisplayDetailBlocks.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                {activeDisplayDetailBlocks.map((block, blockIndex) => (
                  <div key={`${block.title}-${blockIndex}`}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/90 mb-2">
                      {formatReplayBlockTitle(block.title)}
                    </div>
                    <div className="space-y-1">
                      {block.lines.map((line, lineIndex) => (
                        <div key={`${block.title}-${lineIndex}`} className="text-[11px] text-white/90 leading-relaxed whitespace-pre-line">
                          {formatReplayBlockLine(block.title, line, playbackSteps)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeNoteDisplay && (
              <div className="text-[11px] text-white/88">
                {activeNoteDisplay}
              </div>
            )}
          </div>
        </div>
      )}
      <svg ref={svgRef} className="cursor-grab active:cursor-grabbing w-full h-full block" />
      <style>{`
        .derivation-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .derivation-slider::-webkit-slider-runnable-track {
          height: 100%;
          background: transparent;
        }
        .derivation-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 1px;
          height: 1px;
          opacity: 0;
        }
        .derivation-slider::-moz-range-track {
          height: 100%;
          background: transparent;
          border: 0;
        }
        .derivation-slider::-moz-range-thumb {
          width: 1px;
          height: 1px;
          opacity: 0;
          border: 0;
        }
      `}</style>
    </div>
  );
};

export default TreeVisualizer;
export { __TEST_ONLY__ } from '../replay/replayCompiler.ts';
