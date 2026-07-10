export const createParseNormalizationHelpers = ({
  ParseApiError,
  normalizeKey,
  normalizeOpenChainType,
  normalizeChainType,
  normalizeMovementOperation,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  tokenizeSentenceSurfaceOrder,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  materializeImplicitPhrasalTraceShellsInDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  collectNodeReferencesById,
  normalizeSyntaxTreeWithIds,
  buildNodeIndexFromTree,
  buildNodeLabelIndexFromTree,
  assignDerivationStepIds,
  normalizeVisualRelationEvents,
  validateAndCommitSurfaceOrder,
  validateSpelloutConsistency,
  buildCanonicalVisualRelationEvents,
  stripMovementIndicesFromTree,
  collectOvertTerminalNodes,
  resolveNodeSurface,
  materializeCommittedTraceShells,
  collectDerivationFrameNodeIds,
  runSemanticValidation,
  validatePronouncedCopiesAgainstCommittedTree,
  deriveImplicitDerivationChainId,
  deriveChainTypeFromOperation,
  mergeChainTypes,
  normalizeMovementStemFromId,
  subtreeContainsNamedCovertCategoryLeaf
}) => {
  const deriveChainsFromCommittedAnalysis = (derivationSteps, visualRelationEvents, nodeIds) => {
    if (!Array.isArray(visualRelationEvents) || visualRelationEvents.length === 0) return [];
    const steps = Array.isArray(derivationSteps) ? derivationSteps : [];
    const chainsById = new Map();

    visualRelationEvents.forEach((event, eventIndex) => {
      const stepIndex = Number.isInteger(event?.stepIndex) ? event.stepIndex : -1;
      const step = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
      const chainId = deriveImplicitDerivationChainId(step, event, eventIndex);
      const pronouncedCopy = String(event?.toNodeId || '').trim();
      const sourceCopy = String(event?.traceNodeId || event?.fromNodeId || '').trim();
      if (!chainId || !pronouncedCopy || !nodeIds.has(pronouncedCopy)) return;

      const existing = chainsById.get(chainId) || {
        chainId,
        type: normalizeMovementOperation(event?.operation) || normalizeOptionalStepText(event?.operation),
        family: deriveChainTypeFromOperation(event?.operation),
        copies: [],
        pronouncedCopy,
        silentCopies: [],
        features: [],
        note: normalizeOptionalStepText(event?.note) || normalizeOptionalStepText(step?.note)
      };

      existing.family = mergeChainTypes(existing.family, deriveChainTypeFromOperation(event?.operation));
      if (!existing.type) {
        existing.type = normalizeMovementOperation(event?.operation) || normalizeOptionalStepText(event?.operation);
      }
      existing.pronouncedCopy = pronouncedCopy;
      if (nodeIds.has(pronouncedCopy)) existing.copies.push(pronouncedCopy);
      if (sourceCopy && nodeIds.has(sourceCopy) && sourceCopy !== pronouncedCopy) {
        existing.silentCopies.push(sourceCopy);
      }
      normalizeOptionalStringArray(step?.preFeatures)?.forEach((feature) => existing.features.push(feature));
      normalizeOptionalStringArray(step?.postFeatures)?.forEach((feature) => existing.features.push(feature));
      if (!existing.note) {
        existing.note = normalizeOptionalStepText(event?.note) || normalizeOptionalStepText(step?.note);
      }
      chainsById.set(chainId, existing);
    });

    return Array.from(chainsById.values()).map((entry) => ({
      chainId: entry.chainId,
      type: entry.type,
      family: entry.family,
      copies: Array.from(new Set(entry.copies.filter(Boolean))),
      pronouncedCopy: entry.pronouncedCopy,
      silentCopies: Array.from(new Set(entry.silentCopies.filter(Boolean))),
      features: entry.features.length > 0 ? Array.from(new Set(entry.features)) : undefined,
      note: entry.note
    }));
  };

  const dedupeChainNodeIds = (values, nodeIds) => Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter((nodeId) => nodeId && (!nodeIds || nodeIds.has(nodeId)))
  ));

  const nodeHasCommittedOvertYield = (node) =>
    Boolean(
      node
      && collectOvertTerminalNodes(node)
        .map((terminal) => resolveNodeSurface(terminal))
        .map((surface) => String(surface || '').trim())
        .filter(Boolean)
        .length > 0
    );

  const canonicalizeChainEntry = (entry, nodeIds, nodeById) => {
    if (!entry || typeof entry !== 'object') return null;
    const chainId = normalizeOptionalStepText(entry.chainId);
    if (!chainId) return null;

    const pronouncedCopy = (() => {
      const candidate = String(entry.pronouncedCopy || '').trim();
      if (!candidate || (nodeIds && !nodeIds.has(candidate))) return undefined;
      if (nodeById && !nodeHasCommittedOvertYield(nodeById.get(candidate) || null)) return undefined;
      return candidate;
    })();

    const explicitCopies = dedupeChainNodeIds(entry.copies, nodeIds);
    const explicitSilentCopies = dedupeChainNodeIds(entry.silentCopies, nodeIds)
      .filter((nodeId) => nodeId !== pronouncedCopy);
    const explicitSilentSet = new Set(explicitSilentCopies);
    const copies = dedupeChainNodeIds(
      [
        ...explicitCopies.filter((nodeId) => !explicitSilentSet.has(nodeId)),
        pronouncedCopy
      ],
      nodeIds
    );
    const silentCopies = dedupeChainNodeIds(
      explicitSilentCopies.length > 0
        ? explicitSilentCopies
        : copies.filter((nodeId) => nodeId !== pronouncedCopy),
      nodeIds
    ).filter((nodeId) => nodeId !== pronouncedCopy);
    const features = Array.from(new Set(
      (normalizeOptionalStringArray(entry.features) || []).filter(Boolean)
    ));

    return {
      chainId,
      type: normalizeOpenChainType(entry.type) || normalizeChainType(entry.type),
      family: normalizeChainType(entry.family || entry.type),
      copies,
      pronouncedCopy,
      silentCopies,
      features: features.length > 0 ? features : undefined,
      note: normalizeOptionalStepText(entry.note)
    };
  };

  const buildCanonicalChains = ({ derivationSteps, visualRelationEvents, nodeIds, nodeById }) => (
    deriveChainsFromCommittedAnalysis(derivationSteps, visualRelationEvents, nodeIds)
      .map((entry) => canonicalizeChainEntry(entry, nodeIds, nodeById))
      .filter(Boolean)
  );

  // Keep low-level visualRelationEvents aligned with the chain view compiled from stages.
  const backfillVisualRelationEventChainIds = ({ visualRelationEvents, chains, derivationSteps }) => {
    const events = Array.isArray(visualRelationEvents) ? visualRelationEvents : [];
    const chainEntries = Array.isArray(chains) ? chains : [];
    if (events.length === 0 || chainEntries.length === 0) return events;

    const chainIdSet = new Set(
      chainEntries
        .map((entry) => normalizeOptionalStepText(entry?.chainId))
        .filter(Boolean)
    );
    const steps = Array.isArray(derivationSteps) ? derivationSteps : [];
    const preparedChains = chainEntries
      .map((entry) => {
        const chainId = normalizeOptionalStepText(entry?.chainId);
        if (!chainId) return null;
        const copySet = new Set(dedupeChainNodeIds(entry?.copies));
        const silentCopySet = new Set(dedupeChainNodeIds(entry?.silentCopies));
        const pronouncedCopy = normalizeOptionalStepText(entry?.pronouncedCopy);
        if (pronouncedCopy) copySet.add(pronouncedCopy);
        return {
          chainId,
          type: normalizeOpenChainType(entry?.type) || normalizeChainType(entry?.family || entry?.type),
          family: normalizeChainType(entry?.family || entry?.type),
          copySet,
          silentCopySet,
          pronouncedCopy
        };
      })
      .filter(Boolean);

    const scoreChainCandidate = (event, candidate, eventIndex) => {
      const operationType = deriveChainTypeFromOperation(normalizeMovementOperation(event?.operation));
      const targetNodeId = normalizeOptionalStepText(event?.toNodeId);
      const traceNodeId = normalizeOptionalStepText(event?.traceNodeId);
      const sourceNodeId = normalizeOptionalStepText(event?.fromNodeId);
      const stepIndex = Number.isInteger(event?.stepIndex) ? event.stepIndex : -1;
      const step = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
      const implicitChainId = deriveImplicitDerivationChainId(step, event, eventIndex);

      const targetIsPronounced = Boolean(targetNodeId && candidate.pronouncedCopy === targetNodeId);
      const targetIsSilent = Boolean(targetNodeId && candidate.silentCopySet.has(targetNodeId));
      const targetIsCopy = Boolean(targetNodeId && candidate.copySet.has(targetNodeId));
      if (!targetIsPronounced && !targetIsSilent && !targetIsCopy) return Number.NEGATIVE_INFINITY;

      const lowerMatchesSilent = Boolean(
        (traceNodeId && candidate.silentCopySet.has(traceNodeId))
        || (sourceNodeId && candidate.silentCopySet.has(sourceNodeId))
      );
      const lowerMatchesCopy = Boolean(
        (traceNodeId && candidate.copySet.has(traceNodeId))
        || (sourceNodeId && candidate.copySet.has(sourceNodeId))
        || (traceNodeId && candidate.pronouncedCopy === traceNodeId)
        || (sourceNodeId && candidate.pronouncedCopy === sourceNodeId)
      );
      if (!lowerMatchesSilent && !lowerMatchesCopy) return Number.NEGATIVE_INFINITY;

      let score = 0;
      if (targetIsPronounced) score += 10;
      else if (targetIsCopy) score += 8;
      else if (targetIsSilent) score += 6;

      if (lowerMatchesSilent) score += 7;
      else if (lowerMatchesCopy) score += 4;

      if (operationType && candidate.type && operationType === candidate.type) score += 3;
      if (implicitChainId && candidate.chainId === implicitChainId) score += 5;
      return score;
    };

    return events.map((event, eventIndex) => {
      const explicitChainId = normalizeOptionalStepText(event?.chainId);
      if (explicitChainId) return event;

      let bestCandidate = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      let isTied = false;

      preparedChains.forEach((candidate) => {
        const score = scoreChainCandidate(event, candidate, eventIndex);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          isTied = false;
          return;
        }
        if (score === bestScore && score > Number.NEGATIVE_INFINITY) {
          isTied = true;
        }
      });

      if (bestCandidate && !isTied) {
        return { ...event, chainId: bestCandidate.chainId };
      }

      const stepIndex = Number.isInteger(event?.stepIndex) ? event.stepIndex : -1;
      const step = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
      const implicitChainId = deriveImplicitDerivationChainId(step, event, eventIndex);
      if (implicitChainId && chainIdSet.has(implicitChainId)) {
        return { ...event, chainId: implicitChainId };
      }

      return event;
    });
  };

  const buildFrameNodeById = (frame) => {
    const after = frame?.after && typeof frame.after === 'object' && !Array.isArray(frame.after)
      ? frame.after
      : {};
    const frameNodeById = new Map();
    (Array.isArray(after.workspaceForest) ? after.workspaceForest : []).forEach((root) => {
      collectNodeReferencesById(root).forEach((node, nodeId) => {
        if (typeof nodeId === 'string' && nodeId.trim()) {
          frameNodeById.set(nodeId, node);
        }
      });
    });
    return frameNodeById;
  };

  const normalizeDerivationAnchorRoleKey = (value) =>
    String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');

  const getFrameChange = (frame) => (
    frame?.change && typeof frame.change === 'object' && !Array.isArray(frame.change)
      ? frame.change
      : null
  );

  const VISUAL_RELATION_TRAJECTORY_SOURCE_ROLES = new Set(
    ['source', 'from', 'origin', 'lower', 'sourcecopy', 'lowercopy']
      .map((role) => normalizeDerivationAnchorRoleKey(role))
  );
  const VISUAL_RELATION_TRAJECTORY_TARGET_ROLES = new Set(
    ['landing', 'target', 'to', 'destination', 'higher', 'highercopy', 'moved', 'operator']
      .map((role) => normalizeDerivationAnchorRoleKey(role))
  );
  const VISUAL_RELATION_TRAJECTORY_WITNESS_ROLES = new Set(
    ['trace', 'residue', 'gap', 'copy', 'sourcecopy', 'lowercopy']
      .map((role) => normalizeDerivationAnchorRoleKey(role))
  );

  const normalizeVisualRelationAnchorValues = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => normalizeVisualRelationAnchorValues(item));
    }
    if (value && typeof value === 'object') {
      const nodeId = normalizeOptionalStepText(value.nodeId || value.id || value.refId);
      const displayValue = normalizeOptionalStepText(value.value || value.text || nodeId);
      return nodeId || displayValue
        ? [{ nodeId, value: displayValue || nodeId }]
        : [];
    }
    const text = normalizeOptionalStepText(value);
    return text ? [{ nodeId: text, value: text }] : [];
  };

  const resolveVisualRelationAnchors = (anchors, frameNodeById) => {
    if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) return [];
    return Object.entries(anchors).flatMap(([role, rawValue]) => {
      const normalizedRole = normalizeOptionalStepText(role);
      if (!normalizedRole) return [];
      return normalizeVisualRelationAnchorValues(rawValue)
        .map((anchorValue) => {
          const nodeId = normalizeOptionalStepText(anchorValue.nodeId);
          const value = normalizeOptionalStepText(anchorValue.value || nodeId);
          const node = nodeId ? frameNodeById.get(nodeId) : null;
          const resolvedNodeId = normalizeOptionalStepText(node?.id) || nodeId;
          const authoredNodeId = nodeId && resolvedNodeId && nodeId !== resolvedNodeId ? nodeId : '';
          return {
            role: normalizedRole,
            ...(resolvedNodeId ? { nodeId: resolvedNodeId } : {}),
            ...(authoredNodeId ? { authoredNodeId } : {}),
            ...(value ? { value } : {}),
            ...(node?.label ? { label: String(node.label) } : {}),
            resolved: Boolean(node),
            visibleInStage: Boolean(node)
          };
        });
    });
  };

  const firstResolvedRelationAnchorNodeId = (anchors, roleKeys) => {
    for (const anchor of anchors) {
      const roleKey = normalizeDerivationAnchorRoleKey(anchor?.role);
      if (!roleKeys.has(roleKey)) continue;
      const nodeId = normalizeOptionalStepText(anchor?.nodeId);
      if (nodeId) return nodeId;
    }
    return '';
  };

  const firstResolvedRelationAnchorNodeIdMatching = (anchors, predicate) => {
    for (const anchor of anchors) {
      const roleKey = normalizeDerivationAnchorRoleKey(anchor?.role);
      if (!roleKey || !predicate(roleKey)) continue;
      const nodeId = normalizeOptionalStepText(anchor?.nodeId);
      if (nodeId) return nodeId;
    }
    return '';
  };

  const isTrajectorySourceAnchorRole = (roleKey) => (
    (
      /(?:source|from|origin|lower|base|trace|gap|residue|copy)/.test(roleKey)
      || /(?:embeddedphaseedge|objectcopy|thetaposition)/.test(roleKey)
    )
    && !/(?:higher|raised|moved|landing|target|destination|operator|highest|matrixphaseedge|phaseedgecopy|attract|probe|trigger)/.test(roleKey)
  );

  const isTrajectoryTargetAnchorRole = (roleKey) => (
    /(?:landing|target|destination|higher|raised|moved|operator|highest|phaseedgecopy|matrixphaseedge|edgecopy|highersubject|highestcopy)/.test(roleKey)
    && !/(?:lower|base|trace|gap|residue|source|from|origin|attract|probe|trigger)/.test(roleKey)
  );

  const relationHasTrajectoryShape = ({ relation, sourceNodeId, targetNodeId, witnessNodeId }) => {
    if (!targetNodeId || (!sourceNodeId && !witnessNodeId)) return false;
    const relationKey = normalizeKey(relation);
    return (
      !relationKey
      || /move|movement|raise|raising|lower|lowering|front|displac|extract|copy|trace|gap|chain|dependency|wh|abar|clitic|affix|scrambl|rollup|sideward|head/.test(relationKey)
    );
  };

  const buildResolvedVisualRelationsFromDerivationFrames = (frames) => {
    const resolvedRelations = [];
    (Array.isArray(frames) ? frames : []).forEach((frame, frameIndex) => {
      const change = getFrameChange(frame);
      const details = change?.details && typeof change.details === 'object' && !Array.isArray(change.details)
        ? change.details
        : {};
      const visualRelations = Array.isArray(details.derivationStageVisualRelations)
        ? details.derivationStageVisualRelations
        : [];
      if (visualRelations.length === 0) return;

      const frameNodeById = buildFrameNodeById(frame);
      const stageId = normalizeOptionalStepText(frame?.stepId || frame?.frameId) || `d${frameIndex + 1}`;
      const evidence = normalizeOptionalStepText(details.stageRecord || details.note || frame?.note || change?.statement);

      visualRelations.forEach((visualRelation, relationIndex) => {
        if (!visualRelation || typeof visualRelation !== 'object') return;
        const relation = normalizeOptionalStepText(
          visualRelation.relation
          || visualRelation.kind
          || visualRelation.type
          || visualRelation.label
        ) || 'visual relation';
        const anchors = resolveVisualRelationAnchors(visualRelation.anchors, frameNodeById);
        const sourceNodeId = firstResolvedRelationAnchorNodeId(anchors, VISUAL_RELATION_TRAJECTORY_SOURCE_ROLES)
          || firstResolvedRelationAnchorNodeIdMatching(anchors, isTrajectorySourceAnchorRole);
        const targetNodeId = firstResolvedRelationAnchorNodeId(anchors, VISUAL_RELATION_TRAJECTORY_TARGET_ROLES)
          || firstResolvedRelationAnchorNodeIdMatching(anchors, isTrajectoryTargetAnchorRole);
        const witnessNodeId = firstResolvedRelationAnchorNodeId(anchors, VISUAL_RELATION_TRAJECTORY_WITNESS_ROLES);
        const hasUnresolvedAnchors = anchors.some((anchor) => !anchor.resolved);
        const hasTrajectoryShape = relationHasTrajectoryShape({
          relation,
          sourceNodeId,
          targetNodeId,
          witnessNodeId
        });
        const renderable = hasTrajectoryShape && !hasUnresolvedAnchors;
        const renderStatus = renderable
          ? 'trajectory-compatible'
          : hasTrajectoryShape
            ? 'trajectory-anchor-unresolved'
            : hasUnresolvedAnchors
              ? 'anchors-unresolved'
              : 'anchors-resolved-not-rendered';
        const relationId = normalizeOptionalStepText(
          visualRelation.relationId
          || visualRelation.visualRelationId
          || visualRelation.id
        ) || `${stageId}:visualRelation:${relationIndex + 1}`;

        resolvedRelations.push({
          relationId,
          stageId,
          stageIndex: frameIndex,
          relation,
          anchors,
          ...(sourceNodeId ? { sourceNodeId } : {}),
          ...(targetNodeId ? { targetNodeId } : {}),
          ...(witnessNodeId ? { witnessNodeId } : {}),
          renderFamily: hasTrajectoryShape ? 'trajectory' : 'unknown',
          renderable,
          renderStatus,
          ...(evidence ? { evidence } : {})
        });
      });
    });
    return resolvedRelations;
  };

  const collectCompiledVisualRelationEvents = (frames) => (
    (Array.isArray(frames) ? frames : [])
      .flatMap((frame) => Array.isArray(frame?.visualRelationEvents) ? frame.visualRelationEvents : [])
  );

  const normalizeParseResult = (
    value,
    framework = 'xbar',
    sentence = '',
    modelRoute = 'gemini',
    enforceDerivationRouteContract = false,
    options = {}
  ) => {
    const parsed = value;
    if (!parsed || typeof parsed !== 'object') {
      throw new ParseApiError('BAD_MODEL_RESPONSE', 'Malformed parse result from model.', 502);
    }
    const payloadIntegrityFlags = Array.isArray(options?.payloadIntegrityFlags)
      ? options.payloadIntegrityFlags.slice()
      : [];
    const sentenceTokens = tokenizeSentenceSurfaceOrder(sentence);
    const rawDerivationStages = Array.isArray(parsed.derivationStages) ? parsed.derivationStages : [];
    const usesDerivationStages = rawDerivationStages.length > 0;
    const rawDerivationFrames = normalizeDerivationStagesToDerivationFrames(rawDerivationStages, {
      integrityFlags: payloadIntegrityFlags
    });
    if (usesDerivationStages) {
      payloadIntegrityFlags.push('derivation_stages_compiled_to_derivation_frames');
    }
    const rawVisualRelationEvents = collectCompiledVisualRelationEvents(rawDerivationFrames);
    const derivationFrames = materializeImplicitPhrasalTraceShellsInDerivationFrames(
      normalizeDerivationFrames(rawDerivationFrames, framework, sentenceTokens, {
        integrityFlags: payloadIntegrityFlags
      })
    );
    const derivationPrimaryBundle = derivationFrames.length > 0
      ? buildCanonicalDerivationFromDerivationFrames(derivationFrames, sentenceTokens, framework)
      : null;
    if (!derivationPrimaryBundle?.tree) {
      throw new ParseApiError(
        'BAD_MODEL_RESPONSE',
        derivationFrames.length > 0
          ? 'Derivation frames never produced a committed final structure whose overt terminals match the input sentence.'
          : 'Derivation analysis failed to produce a committed tree from derivationStages.',
        502
      );
    }
    const treeSource = derivationPrimaryBundle.tree;
    const nodeReferences = collectNodeReferencesById(treeSource);
    const { tree: rawTree, nodeIds } = normalizeSyntaxTreeWithIds(treeSource, nodeReferences, framework, sentenceTokens);
    const nodeById = buildNodeIndexFromTree(rawTree);
    const labelIndex = buildNodeLabelIndexFromTree(rawTree);
    const normalizedRawVisualRelationEvents = normalizeVisualRelationEvents(rawVisualRelationEvents, nodeIds, [], nodeById, labelIndex);
    const { tree, surfaceOrder } = validateAndCommitSurfaceOrder(undefined, rawTree, sentence);
    const visualRelationEvents = buildCanonicalVisualRelationEvents({
      tree,
      derivationSteps: [],
      rawVisualRelationEvents: normalizedRawVisualRelationEvents
    });
    const committedTree = derivationPrimaryBundle.tree;
    stripMovementIndicesFromTree(tree);
    if (committedTree !== tree) {
      stripMovementIndicesFromTree(committedTree);
    }
    const postStripOvertTerminals = collectOvertTerminalNodes(committedTree);
    const cleanSurfaceOrder = postStripOvertTerminals
      .map((node) => resolveNodeSurface(node))
      .map((token) => String(token || '').trim())
      .filter(Boolean);
    const committedSurfaceOrder = cleanSurfaceOrder.length > 0
      ? cleanSurfaceOrder
      : surfaceOrder;
    const visualRelationEventsForCommittedTree = Array.isArray(derivationPrimaryBundle?.visualRelationEvents) && derivationPrimaryBundle.visualRelationEvents.length > 0
      ? derivationPrimaryBundle.visualRelationEvents
      : visualRelationEvents;
    materializeCommittedTraceShells(committedTree, visualRelationEventsForCommittedTree);
    const authoritativeVisualRelationEvents = visualRelationEventsForCommittedTree;
    const derivationDerivedSteps = Array.isArray(derivationPrimaryBundle?.derivationSteps)
      ? derivationPrimaryBundle.derivationSteps
      : [];
    const identifiedDerivationSteps = assignDerivationStepIds(derivationDerivedSteps);
    validateSpelloutConsistency(
      identifiedDerivationSteps,
      tokenizeSentenceSurfaceOrder(sentence),
      committedSurfaceOrder
    );
    const committedNodeById = buildNodeIndexFromTree(committedTree);
    const finalNodeIds = new Set(committedNodeById.keys());
    const derivationNodeIds = collectDerivationFrameNodeIds(derivationFrames);
    const chainNodeIds = new Set([...finalNodeIds, ...derivationNodeIds]);
    const canonicalChainEntries = buildCanonicalChains({
      derivationSteps: identifiedDerivationSteps,
      visualRelationEvents: authoritativeVisualRelationEvents,
      nodeIds: chainNodeIds,
      nodeById: committedNodeById
    });
    const authoritativeVisualRelationEventsWithChainIds = backfillVisualRelationEventChainIds({
      visualRelationEvents: authoritativeVisualRelationEvents,
      chains: canonicalChainEntries,
      derivationSteps: identifiedDerivationSteps
    });
    runSemanticValidation('chain-consistency', () => {
      validatePronouncedCopiesAgainstCommittedTree({
        chains: canonicalChainEntries,
        tree: committedTree,
        visualRelationEvents: authoritativeVisualRelationEventsWithChainIds
      });
    });
    const resolvedVisualRelations = buildResolvedVisualRelationsFromDerivationFrames(derivationFrames);
    const derivationStages = derivationFrames.map((frame, index) => {
      const details = frame?.change?.details && typeof frame.change.details === 'object' && !Array.isArray(frame.change.details)
        ? frame.change.details
        : {};
      const stageRecord = normalizeOptionalStepText(details.stageRecord);
      const visualRelations = Array.isArray(details.derivationStageVisualRelations)
        ? details.derivationStageVisualRelations.map((relation) => ({
            relation: normalizeOptionalStepText(relation?.relation),
            anchors: relation?.anchors && typeof relation.anchors === 'object' && !Array.isArray(relation.anchors)
              ? relation.anchors
              : {}
          }))
        : [];
      return {
        statement: normalizeOptionalStepText(frame?.change?.statement) || `Derivation stage ${index + 1}`,
        stageRecord,
        visualRelations,
        workspaceForest: frame?.after?.workspaceForest || []
      };
    });
    const provenance = {
      modelRoute,
      framework,
      timestamp: new Date().toISOString(),
      treeSource: 'derivationStages',
      promptVersion: normalizeOptionalStepText(process.env.BABEL_PROMPT_VERSION),
      parserVersion: normalizeOptionalStepText(process.env.BABEL_PARSER_VERSION || process.env.VERCEL_GIT_COMMIT_SHA),
      uiVersion: normalizeOptionalStepText(process.env.BABEL_UI_VERSION || process.env.VERCEL_GIT_COMMIT_SHA),
      payloadIntegrityFlags: payloadIntegrityFlags.length > 0
        ? Array.from(new Set(payloadIntegrityFlags))
        : undefined,
      hasDerivationStages: derivationStages.length > 0,
      hasResolvedVisualRelations: resolvedVisualRelations.length > 0
    };

    return {
      tree: committedTree,
      rootLabel: normalizeOptionalStepText(committedTree?.label),
      surfaceOrder: committedSurfaceOrder,
      derivationStages,
      resolvedVisualRelations,
      derivationSteps: identifiedDerivationSteps,
      chains: canonicalChainEntries,
      provenance
    };
  };

  const normalizeParseBundle = (
    value,
    framework = 'xbar',
    sentence = '',
    modelRoute = 'gemini',
    enforceDerivationRouteContract = false,
    options = {}
  ) => {
    const parsed = value;
    if (enforceDerivationRouteContract) {
      const topLevelFields = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.keys(parsed)
        : [];
      if (
        topLevelFields.length !== 1
        || !Object.prototype.hasOwnProperty.call(parsed || {}, 'derivationStages')
      ) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'The authored payload must contain exactly one top-level field: derivationStages.',
          502
        );
      }
    }
    const analysesSource = Array.isArray(parsed?.analyses)
      ? parsed.analyses.slice(0, 2)
      : parsed
        ? [parsed]
        : [];

    const analyses = analysesSource
      .map((analysis) => normalizeParseResult(
        analysis,
        framework,
        sentence,
        modelRoute,
        enforceDerivationRouteContract,
        options
      ))
      .slice(0, 2);

    if (analyses.length === 0) {
      throw new ParseApiError('BAD_MODEL_RESPONSE', 'No valid analyses returned by model.', 502);
    }

    const ambiguityDetected = analyses.length > 1 || Boolean(parsed?.ambiguityDetected);

    return {
      analyses,
      ambiguityDetected,
      ambiguityNote: ambiguityDetected ? String(parsed?.ambiguityNote || '').trim() || undefined : undefined
    };
  };

  return {
    deriveChainsFromCommittedAnalysis,
    backfillVisualRelationEventChainIds,
    normalizeParseResult,
    normalizeParseBundle
  };
};
