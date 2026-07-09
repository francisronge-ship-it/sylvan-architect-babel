export const createParseNormalizationHelpers = ({
  ParseApiError,
  normalizeKey,
  normalizeOpenChainType,
  normalizeChainType,
  normalizeMovementOperation,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  getLabelProfile,
  tokenizeSentenceSurfaceOrder,
  normalizeSurfaceToken,
  compileNoteBindingsFromDerivationFrames,
  buildExplanationFromNoteBindings,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  materializeImplicitPhrasalTraceShellsInDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  collectNodeReferencesById,
  normalizeSyntaxTreeWithIds,
  buildNodeIndexFromTree,
  buildParentIndexFromTree,
  buildNodeLabelIndexFromTree,
  assignDerivationStepIds,
  normalizeVisualRelationEvents,
  validateAndCommitSurfaceOrder,
  validateSpelloutConsistency,
  buildCanonicalVisualRelationEvents,
  stripMovementIndicesFromTree,
  collectOvertTerminalNodes,
  resolveNodeSurface,
  resolveHeadMovementLandingNode,
  materializeCommittedTraceShells,
  buildGroundedExplanation,
  harmonizeExplanationWithDerivation,
  collectDerivationFrameNodeIds,
  normalizeCommitmentFacts,
  ensureStructuredEntryIds,
  runSemanticValidation,
  validatePronouncedCopiesAgainstCommittedTree,
  validateNoteBindingsAgainstStructuredAnalysis,
  auditNoteConsistency,
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

  const stableStringifyForCommitmentKey = (value) => {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringifyForCommitmentKey(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const entries = Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringifyForCommitmentKey(value[key])}`);
      return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
  };

  const normalizeCommitmentParticipantsForMerge = (participants = []) => (
    (Array.isArray(participants) ? participants : [])
      .filter((participant) => participant && typeof participant === 'object')
      .map((participant) => ({
        role: normalizeOptionalStepText(participant.role),
        nodeId: normalizeOptionalStepText(participant.nodeId),
        label: normalizeOptionalStepText(participant.label),
        value: normalizeOptionalStepText(participant.value)
      }))
      .filter((participant) => participant.role || participant.nodeId || participant.label || participant.value)
      .sort((left, right) => stableStringifyForCommitmentKey(left).localeCompare(stableStringifyForCommitmentKey(right)))
  );

  const buildCommitmentFactStructuralKey = (entry) => {
    if (!entry || typeof entry !== 'object') return '';
    const canonical = { ...entry };
    delete canonical.factId;
    if (Array.isArray(canonical.stepIds)) {
      canonical.stepIds = Array.from(new Set(canonical.stepIds.map((value) => normalizeOptionalStepText(value)).filter(Boolean))).sort();
    }
    if (Array.isArray(canonical.nodeIds)) {
      canonical.nodeIds = Array.from(new Set(canonical.nodeIds.map((value) => String(value || '').trim()).filter(Boolean))).sort();
    }
    if (Array.isArray(canonical.participants)) {
      canonical.participants = normalizeCommitmentParticipantsForMerge(canonical.participants);
    }
    return stableStringifyForCommitmentKey(canonical);
  };

  const mergeCommitmentFactEntries = (existing, incoming) => {
    if (!existing) return incoming;
    if (!incoming) return existing;
    const merged = { ...existing };
    Object.entries(incoming).forEach(([field, value]) => {
      if (value === undefined) return;
      if (field === 'factId') {
        if (!merged.factId) merged.factId = value;
        return;
      }
      if (field === 'stepIds' || field === 'nodeIds') {
        const mergedValues = Array.from(new Set([
          ...((Array.isArray(merged[field]) ? merged[field] : []).map((item) => field === 'stepIds' ? normalizeOptionalStepText(item) : String(item || '').trim()).filter(Boolean)),
          ...((Array.isArray(value) ? value : []).map((item) => field === 'stepIds' ? normalizeOptionalStepText(item) : String(item || '').trim()).filter(Boolean))
        ]));
        if (mergedValues.length > 0) merged[field] = mergedValues;
        return;
      }
      if (field === 'participants') {
        const mergedParticipants = normalizeCommitmentParticipantsForMerge([
          ...(Array.isArray(merged.participants) ? merged.participants : []),
          ...(Array.isArray(value) ? value : [])
        ]);
        if (mergedParticipants.length > 0) merged.participants = mergedParticipants;
        return;
      }
      if (Array.isArray(value)) {
        const combined = Array.from(new Set([
          ...(Array.isArray(merged[field]) ? merged[field] : []),
          ...value
        ].filter((item) => item !== undefined)));
        if (combined.length > 0) merged[field] = combined;
        return;
      }
      if (merged[field] === undefined || merged[field] === null || merged[field] === '') {
        merged[field] = value;
      }
    });
    return merged;
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

  const normalizeFrameFactNodeId = (value, nodeIds) => {
    const nodeId = String(value || '').trim();
    return nodeId && nodeIds.has(nodeId) ? nodeId : undefined;
  };

  const normalizeDerivationAnchorRoleKey = (value) =>
    String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');

  const derivationAnchorRoleMatchesAny = (roleKey, normalizedMatchers = []) =>
    normalizedMatchers.some((matcher) => roleKey === matcher);

  const getFrameChange = (frame) => (
    frame?.change && typeof frame.change === 'object' && !Array.isArray(frame.change)
      ? frame.change
      : null
  );

  const buildFrameParentById = (frame) => {
    const after = frame?.after && typeof frame.after === 'object' && !Array.isArray(frame.after)
      ? frame.after
      : {};
    const parentById = new Map();
    (Array.isArray(after.workspaceForest) ? after.workspaceForest : []).forEach((root) => {
      buildParentIndexFromTree(root).forEach((parentId, nodeId) => {
        if (typeof nodeId === 'string' && nodeId.trim()) {
          parentById.set(nodeId, parentId);
        }
      });
    });
    return parentById;
  };

  const getFrameNodeLineageId = (node) =>
    normalizeOptionalStepText(
      node?.lineageId
      || node?.lineage
      || node?.copyLineageId
      || node?.movementLineageId
      || (
        node?.identity
        && typeof node.identity === 'object'
        && !Array.isArray(node.identity)
          ? (node.identity.lineageId || node.identity.lineage)
          : undefined
      )
    ) || '';

  const buildFrameLineageWitnessIndex = (frame) => {
    const frameNodeById = buildFrameNodeById(frame);
    const lineageById = new Map();
    frameNodeById.forEach((node, nodeId) => {
      const lineageId = getFrameNodeLineageId(node);
      if (!lineageId) return;
      const existing = lineageById.get(lineageId) || {
        lineageId,
        pronouncedNodeIds: [],
        silentNodeIds: []
      };
      if (nodeHasCommittedOvertYield(node)) existing.pronouncedNodeIds.push(nodeId);
      else existing.silentNodeIds.push(nodeId);
      lineageById.set(lineageId, existing);
    });
    return lineageById;
  };

  const findFrameDominantMovementLineage = (frame) => {
    let bestLineageId = '';
    let bestScore = -1;
    buildFrameLineageWitnessIndex(frame).forEach((entry, lineageId) => {
      if (entry.pronouncedNodeIds.length === 0 || entry.silentNodeIds.length === 0) return;
      const score = entry.pronouncedNodeIds.length + entry.silentNodeIds.length;
      if (score > bestScore) {
        bestScore = score;
        bestLineageId = lineageId;
      }
    });
    return bestLineageId;
  };

  const sameNodeIdSet = (left = [], right = []) => {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((value) => rightSet.has(value));
  };

  const findFrameNovelMovementLineage = (frame, previousFrame = null) => {
    const currentLineages = buildFrameLineageWitnessIndex(frame);
    const previousLineages = previousFrame ? buildFrameLineageWitnessIndex(previousFrame) : new Map();
    let bestLineageId = '';
    let bestScore = -1;
    currentLineages.forEach((entry, lineageId) => {
      if (entry.pronouncedNodeIds.length === 0 || entry.silentNodeIds.length === 0) return;
      const previousEntry = previousLineages.get(lineageId);
      const isNewAtThisCheckpoint = !previousEntry
        || !sameNodeIdSet(entry.pronouncedNodeIds, previousEntry.pronouncedNodeIds)
        || !sameNodeIdSet(entry.silentNodeIds, previousEntry.silentNodeIds);
      if (!isNewAtThisCheckpoint) return;
      const score = entry.pronouncedNodeIds.length + entry.silentNodeIds.length;
      if (score > bestScore) {
        bestScore = score;
        bestLineageId = lineageId;
      }
    });
    return bestLineageId;
  };

  const extractQuotedChangeSurfaceForms = (change) => {
    const statement = normalizeOptionalStepText(change?.statement);
    if (!statement) return [];
    return Array.from(statement.matchAll(/["']([^"']+)["']/g))
      .map((match) => normalizeSurfaceToken(match?.[1]))
      .filter(Boolean);
  };

  const findFrameChangeDetailLineageId = (change) => {
    const details = change?.details && typeof change.details === 'object'
      ? change.details
      : null;
    return normalizeOptionalStepText(
      details?.itemLineageId
      || details?.lineageId
      || details?.movement?.itemLineageId
      || details?.movement?.lineageId
      || details?.movement?.chainId
      || details?.movement?.continuityId
      || details?.headMovement?.itemLineageId
      || details?.headMovement?.lineageId
      || details?.headMovement?.chainId
      || details?.headMovement?.continuityId
    ) || '';
  };

  const inferFrameChangeMovementOperation = (frame, previousFrame = null) => {
    const change = getFrameChange(frame);
    if (!change) return '';
    const frameNodeById = buildFrameNodeById(frame);
    const details = change?.details && typeof change.details === 'object'
      ? change.details
      : null;
    const explicitOperation = normalizeMovementOperation(
      details?.operation
      || details?.type
      || details?.kind
    );
    const sourceNodeId = findFrameChangeAnchorNodeId(frame, ['source', 'from', 'origin', 'lower', 'sourcecopy', 'lowercopy']);
    const landingNodeId = findFrameChangeAnchorNodeId(frame, ['landing', 'target', 'to', 'destination']);
    const traceNodeId = findFrameChangeAnchorNodeId(frame, ['trace', 'residue', 'lowercopy', 'copy', 'sourcecopy']);
    const targetHeadNodeId = findFrameChangeAnchorNodeId(frame, ['targethead']);
    const hostNodeId = findFrameChangeAnchorNodeId(frame, ['host', 'container']);
    const targetProjectionNodeId = findFrameChangeAnchorNodeId(frame, ['targetprojection', 'edge']);
    const statementText = normalizeOptionalStepText(change.statement);
    const movementText = [
      statementText,
      normalizeOptionalStepText(details?.note),
      normalizeOptionalStepText(details?.movement?.type),
      normalizeOptionalStepText(details?.headMovement?.clauseType)
    ].filter(Boolean).join(' ');
    const statement = String(statementText || '').toLowerCase();
    const movementContext = String(movementText || '').toLowerCase();
    const sourceLabel = String(frameNodeById.get(sourceNodeId)?.label || '').trim();
    const landingLabel = String(frameNodeById.get(landingNodeId)?.label || '').trim();
    const traceLabel = String(frameNodeById.get(traceNodeId)?.label || '').trim();
    const hostLabel = String(frameNodeById.get(hostNodeId)?.label || '').trim();
    const sourceProfile = sourceLabel ? getLabelProfile(sourceLabel) : null;
    const landingProfile = landingLabel ? getLabelProfile(landingLabel) : null;
    const traceProfile = traceLabel ? getLabelProfile(traceLabel) : null;
    const hostProfile = hostLabel ? getLabelProfile(hostLabel) : null;
    const hasDirectMovementCue = Boolean(
      sourceNodeId
      || landingNodeId
      || traceNodeId
      || targetHeadNodeId
      || (
        hostNodeId
        && (
          explicitOperation === 'HeadMove'
          || /\bhead movement\b|\bmove the .* head\b|\bt[- ]?to[- ]?c\b|\bto c\b/.test(movementContext)
          || sourceProfile?.isHeadLikeStructural
          || traceProfile?.isHeadLikeStructural
          || hostProfile?.isHeadLikeStructural
        )
        && (sourceNodeId || traceNodeId || targetHeadNodeId)
      )
    );
    const statementMentionsMovement = /(?:move|raise|lowering|front|displac|extract|shift|scrambl|roll[- ]?up|remerge|internal merge)/i.test(statement);
    const lineageMovementId = findFrameNovelMovementLineage(frame, previousFrame);
    const hasConcreteMovementCue = hasDirectMovementCue
      || (
        lineageMovementId
        && Boolean(explicitOperation || statementMentionsMovement)
      );
    if (!hasConcreteMovementCue) return '';
    if (explicitOperation) return explicitOperation;
    if (
      targetHeadNodeId
      || sourceProfile?.isHeadLikeStructural
      || landingProfile?.isHeadLikeStructural
      || traceProfile?.isHeadLikeStructural
      || hostProfile?.isHeadLikeStructural
      || /\bhead movement\b|\bmove the .* head\b|\bt[- ]?to[- ]?c\b|\bto c\b/.test(movementContext)
    ) {
      return 'HeadMove';
    }
    if (
      /(?:wh|a[- ]?bar|topicaliz|focus|front)/i.test(movementContext)
      || String(targetProjectionNodeId || '').trim().toLowerCase().includes('cp')
      || String(hostNodeId || '').trim().toLowerCase().includes('cp')
    ) {
      return 'AbarMove';
    }
    return 'A-Move';
  };

  const findFrameHeadMoveHostNodeIdFromSurfaceCue = (frame) => {
    const change = getFrameChange(frame);
    if (!change) return undefined;
    const surfaceForms = extractQuotedChangeSurfaceForms(change);
    if (surfaceForms.length === 0) return undefined;
    const frameNodeById = buildFrameNodeById(frame);
    const parentById = buildFrameParentById(frame);
    const matchingLandingIds = new Set();

    frameNodeById.forEach((node) => {
      const children = Array.isArray(node?.children) ? node.children : [];
      if (children.length > 0) return;
      const surface = normalizeSurfaceToken(resolveNodeSurface(node) || node.word || node.label);
      if (!surface || !surfaceForms.includes(surface)) return;
      const landingNode = resolveHeadMovementLandingNode(node, frameNodeById, parentById) || null;
      const landingNodeId = String(landingNode?.id || '').trim();
      if (landingNodeId) matchingLandingIds.add(landingNodeId);
    });

    return matchingLandingIds.size === 1
      ? Array.from(matchingLandingIds)[0]
      : undefined;
  };

  const findFrameChangeAnchorNodeId = (frame, roleMatchers = []) => {
    const change = getFrameChange(frame);
    const anchors = Array.isArray(change?.anchors) ? change.anchors : [];
    const normalizedMatchers = roleMatchers.map((matcher) => normalizeDerivationAnchorRoleKey(matcher)).filter(Boolean);
    if (normalizedMatchers.length === 0) return undefined;
    for (const anchor of anchors) {
      const roleKey = normalizeDerivationAnchorRoleKey(anchor?.role);
      if (!roleKey) continue;
      if (!derivationAnchorRoleMatchesAny(roleKey, normalizedMatchers)) continue;
      const nodeId = String(anchor?.nodeId || '').trim();
      if (nodeId) return nodeId;
    }
    return undefined;
  };

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

  const deriveFrameChangeKind = (frame, previousFrame = null) => {
    const change = getFrameChange(frame);
    const details = change?.details && typeof change.details === 'object'
      ? change.details
      : null;
    const explicitKind = normalizeOptionalStepText(details?.kind || details?.family || details?.type);
    if (explicitKind) {
      const normalizedExplicitKind = normalizeKey(explicitKind);
      if (/(?:^|[-_])(?:move|movement|headmove|abarmove|amove)(?:$|[-_])/i.test(normalizedExplicitKind)) {
        return inferFrameChangeMovementOperation(frame, previousFrame) ? explicitKind : 'transition';
      }
      return explicitKind;
    }
    const sourceNodeId = findFrameChangeAnchorNodeId(frame, ['source', 'from', 'origin', 'lower', 'sourcecopy', 'lowercopy']);
    const landingNodeId = findFrameChangeAnchorNodeId(frame, ['landing', 'target', 'to', 'destination']);
    const targetHeadNodeId = findFrameChangeAnchorNodeId(frame, ['targethead']);
    const traceNodeId = findFrameChangeAnchorNodeId(frame, ['trace', 'residue', 'lowercopy', 'copy', 'sourcecopy']);
    return (sourceNodeId || landingNodeId || targetHeadNodeId || traceNodeId || inferFrameChangeMovementOperation(frame, previousFrame))
      ? 'movement'
      : 'transition';
  };

  const buildFrameChangeCommitmentFact = ({ frame, previousFrame, nodeIds, stepIds }) => {
    const change = getFrameChange(frame);
    if (!change) return null;
    const frameNodeById = buildFrameNodeById(frame);
    const details = change.details && typeof change.details === 'object' && !Array.isArray(change.details)
      ? change.details
      : {};
    const sourceNodeId = normalizeFrameFactNodeId(findFrameChangeAnchorNodeId(frame, ['source', 'from', 'origin', 'lower', 'sourcecopy', 'lowercopy']), nodeIds);
    const authoredLandingNodeId = normalizeFrameFactNodeId(findFrameChangeAnchorNodeId(frame, ['landing', 'target', 'to', 'destination']), nodeIds);
    const authoredHostNodeId = normalizeFrameFactNodeId(findFrameChangeAnchorNodeId(frame, ['host', 'container']), nodeIds);
    const authoredTargetHeadNodeId = normalizeFrameFactNodeId(findFrameChangeAnchorNodeId(frame, ['targethead']), nodeIds);
    const traceNodeId = normalizeFrameFactNodeId(findFrameChangeAnchorNodeId(frame, ['trace', 'residue', 'lowercopy', 'copy', 'sourcecopy']), nodeIds);
    const movementOperation = inferFrameChangeMovementOperation(frame, previousFrame);
    const recoveredHostNodeId = !authoredHostNodeId && !authoredTargetHeadNodeId && movementOperation === 'HeadMove'
      ? normalizeFrameFactNodeId(findFrameHeadMoveHostNodeIdFromSurfaceCue(frame), nodeIds)
      : undefined;
    const hostNodeId = authoredHostNodeId || authoredTargetHeadNodeId || recoveredHostNodeId;
    const landingNodeId = authoredLandingNodeId
      || (movementOperation === 'HeadMove' ? hostNodeId : undefined);
    const continuityIds = Array.isArray(change.continuityIds)
      ? change.continuityIds.map((value) => normalizeOptionalStepText(value)).filter(Boolean)
      : [];
    const lineageChainId = movementOperation
      ? findFrameNovelMovementLineage(frame, previousFrame)
      : '';
    const chainId = normalizeOptionalStepText(details?.chainId || details?.continuityId)
      || findFrameChangeDetailLineageId(change)
      || (continuityIds.length === 1 ? continuityIds[0] : '')
      || lineageChainId;
    const participants = normalizeCommitmentParticipantsForMerge(
      (Array.isArray(change.anchors) ? change.anchors : []).map((anchor) => {
        if (!anchor || typeof anchor !== 'object') return null;
        const nodeId = normalizeFrameFactNodeId(anchor.nodeId, nodeIds);
        const role = normalizeOptionalStepText(anchor.role);
        const label = nodeId ? normalizeOptionalStepText(frameNodeById.get(nodeId)?.label) : undefined;
        const value = normalizeOptionalStepText(anchor.value || anchor.text);
        if (!nodeId && !role && !value) return null;
        return {
          ...(role ? { role } : {}),
          ...(nodeId ? { nodeId } : {}),
          ...(label ? { label } : {}),
          ...(value ? { value } : {})
        };
      }).filter(Boolean)
    );
    const nodeIdSet = Array.from(new Set([
      ...participants.map((participant) => String(participant?.nodeId || '').trim()).filter(Boolean),
      sourceNodeId,
      landingNodeId,
      hostNodeId,
      traceNodeId
    ].filter(Boolean)));
    const frameStepId = normalizeOptionalStepText(frame?.stepId);
    const normalizedStepIds = Array.from(new Set([
      ...(frameStepId ? [frameStepId] : []),
      ...((Array.isArray(stepIds) ? stepIds : []).map((value) => normalizeOptionalStepText(value)).filter(Boolean))
    ]));
    const fact = {
      kind: deriveFrameChangeKind(frame, previousFrame),
      ...(normalizeOptionalStepText(details?.family) ? { family: normalizeOptionalStepText(details.family) } : {}),
      ...(normalizeOptionalStepText(details?.frameworkLabel) ? { frameworkLabel: normalizeOptionalStepText(details.frameworkLabel) } : {}),
      ...(normalizeOptionalStepText(details?.subtype) ? { subtype: normalizeOptionalStepText(details.subtype) } : {}),
      ...(normalizeOptionalStepText(change.statement) ? { statement: normalizeOptionalStepText(change.statement) } : {}),
      ...(normalizedStepIds.length > 0 ? { stepIds: normalizedStepIds } : {}),
      ...(nodeIdSet.length > 0 ? { nodeIds: nodeIdSet } : {}),
      ...(participants.length > 0 ? { participants } : {}),
      ...(chainId ? { chainId } : {}),
      ...(sourceNodeId ? { sourceNodeId } : {}),
      ...(landingNodeId ? { landingNodeId } : {}),
      ...(hostNodeId ? { hostNodeId } : {}),
      ...(traceNodeId ? { traceNodeId } : {})
    };
    return fact;
  };

  const splitFrameAnalyticNoteClaims = (value) => {
    const note = normalizeOptionalStepText(value);
    if (!note) return [];
    return note
      .split(/(?<=[.!?])\s+|;\s+/u)
      .map((claim) => normalizeOptionalStepText(claim))
      .filter(Boolean);
  };

  const buildFrameGroundedAnalyticNoteFacts = ({ frame, baseFact }) => {
    const change = getFrameChange(frame);
    const noteText = normalizeOptionalStepText(change?.details?.note);
    if (!noteText || !baseFact || typeof baseFact !== 'object') return [];

    const baseStatement = normalizeOptionalStepText(baseFact.statement);
    const baseNodeIds = Array.isArray(baseFact.nodeIds)
      ? Array.from(new Set(baseFact.nodeIds.map((nodeId) => String(nodeId || '').trim()).filter(Boolean)))
      : [];
    const baseParticipants = normalizeCommitmentParticipantsForMerge(baseFact.participants);
    const baseChainId = normalizeOptionalStepText(baseFact.chainId);
    const hasGroundedWitness = baseNodeIds.length > 0 || baseParticipants.length > 0 || Boolean(baseChainId);
    if (!hasGroundedWitness) return [];

    return splitFrameAnalyticNoteClaims(noteText)
      .filter((claim) => normalizeKey(claim) !== normalizeKey(baseStatement))
      .map((claim, claimIndex) => ({
        kind: 'analytic',
        frameworkLabel: 'derivation-stage-prose',
        subtype: 'grounded-local-claim',
        statement: claim,
        ...(Array.isArray(baseFact.stepIds) && baseFact.stepIds.length > 0 ? { stepIds: [...baseFact.stepIds] } : {}),
        ...(baseNodeIds.length > 0 ? { nodeIds: [...baseNodeIds] } : {}),
        ...(baseParticipants.length > 0 ? { participants: [...baseParticipants] } : {}),
        ...(baseChainId ? { chainId: baseChainId } : {}),
        sourceField: 'change.details.note',
        claimIndex: claimIndex + 1
      }));
  };

  const compileFrameChangeCommitments = ({ derivationFrames, nodeIds, stepIds }) => {
    const frames = Array.isArray(derivationFrames) ? derivationFrames : [];
    const mergedFactsByKey = new Map();
    frames.forEach((frame, index) => {
      const compiledFact = buildFrameChangeCommitmentFact({
        frame,
        previousFrame: index > 0 ? frames[index - 1] : null,
        nodeIds,
        stepIds: [normalizeOptionalStepText(frame?.stepId)].filter(Boolean)
      });
      const normalizedBaseFacts = normalizeCommitmentFacts(compiledFact ? [compiledFact] : [], nodeIds, stepIds);
      const analyticNoteFacts = normalizeCommitmentFacts(
        buildFrameGroundedAnalyticNoteFacts({
          frame,
          baseFact: normalizedBaseFacts[0] || null
        }),
        nodeIds,
        stepIds
      );
      const normalizedFacts = [...normalizedBaseFacts, ...analyticNoteFacts];
      normalizedFacts.forEach((entry) => {
        const structuralKey = buildCommitmentFactStructuralKey(entry);
        if (!structuralKey) return;
        const existing = mergedFactsByKey.get(structuralKey);
        mergedFactsByKey.set(structuralKey, mergeCommitmentFactEntries(existing, entry));
      });
    });

    const mergedFacts = Array.from(mergedFactsByKey.values());
    const identifiedFacts = ensureStructuredEntryIds(mergedFacts, 'factId', 'fact');
    return {
      derivationFrames: frames,
      frameCommitmentFacts: identifiedFacts
    };
  };

  const mergeCommitmentFacts = (...sources) => {
    const mergedByKey = new Map();
    sources.flat().forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const structuralKey = buildCommitmentFactStructuralKey(entry);
      if (!structuralKey) return;
      const existing = mergedByKey.get(structuralKey);
      mergedByKey.set(structuralKey, mergeCommitmentFactEntries(existing, entry));
    });
    return ensureStructuredEntryIds(Array.from(mergedByKey.values()), 'factId', 'fact');
  };

  const enrichMovementCommitmentFactsFromEvents = (facts, visualRelationEvents, nodeById) => {
    const normalizedFacts = Array.isArray(facts) ? facts : [];
    const normalizedEvents = Array.isArray(visualRelationEvents) ? visualRelationEvents : [];
    if (normalizedFacts.length === 0 || normalizedEvents.length === 0) return normalizedFacts;

    const buildParticipantsFromEvent = (event) => normalizeCommitmentParticipantsForMerge([
      event?.sourceNodeId || event?.fromNodeId
        ? {
            role: 'source',
            nodeId: String(event.sourceNodeId || event.fromNodeId).trim(),
            label: normalizeOptionalStepText(nodeById?.get(String(event.sourceNodeId || event.fromNodeId).trim())?.label)
          }
        : null,
      event?.landingNodeId || event?.toNodeId
        ? {
            role: 'landing',
            nodeId: String(event.landingNodeId || event.toNodeId).trim(),
            label: normalizeOptionalStepText(nodeById?.get(String(event.landingNodeId || event.toNodeId).trim())?.label)
          }
        : null,
      event?.hostNodeId
        ? {
            role: 'host',
            nodeId: String(event.hostNodeId).trim(),
            label: normalizeOptionalStepText(nodeById?.get(String(event.hostNodeId).trim())?.label)
          }
        : null,
      event?.traceNodeId
        ? {
            role: 'trace',
            nodeId: String(event.traceNodeId).trim(),
            label: normalizeOptionalStepText(nodeById?.get(String(event.traceNodeId).trim())?.label)
          }
        : null
    ]);

    return normalizedFacts.map((fact) => {
      if (!fact || typeof fact !== 'object' || fact.kind !== 'movement') return fact;
      const factStepIds = new Set((Array.isArray(fact.stepIds) ? fact.stepIds : []).map((value) => normalizeOptionalStepText(value)).filter(Boolean));
      const matchingEvents = normalizedEvents.filter((event) => {
        const eventChainId = normalizeOptionalStepText(event?.chainId);
        const eventStepId = normalizeOptionalStepText(event?.stepId);
        if (fact.chainId && eventChainId && fact.chainId === eventChainId) return true;
        if (eventStepId && factStepIds.has(eventStepId)) return true;
        return false;
      });
      if (matchingEvents.length === 0) return fact;
      const preferredEvent = [...matchingEvents].sort((left, right) => {
        const leftComplete = String(left?.serializationStatus || '') === 'complete' ? 1 : 0;
        const rightComplete = String(right?.serializationStatus || '') === 'complete' ? 1 : 0;
        return rightComplete - leftComplete;
      })[0];
      const eventNodeIds = Array.from(new Set([
        String(preferredEvent?.sourceNodeId || preferredEvent?.fromNodeId || '').trim(),
        String(preferredEvent?.landingNodeId || preferredEvent?.toNodeId || '').trim(),
        String(preferredEvent?.hostNodeId || '').trim(),
        String(preferredEvent?.traceNodeId || '').trim()
      ].filter(Boolean)));
      const mergedNodeIds = Array.from(new Set([
        ...((Array.isArray(fact.nodeIds) ? fact.nodeIds : []).map((value) => String(value || '').trim()).filter(Boolean)),
        ...eventNodeIds
      ]));
      const mergedParticipants = normalizeCommitmentParticipantsForMerge([
        ...(Array.isArray(fact.participants) ? fact.participants : []),
        ...buildParticipantsFromEvent(preferredEvent)
      ]);
      return {
        ...fact,
        ...(mergedNodeIds.length > 0 ? { nodeIds: mergedNodeIds } : {}),
        ...(mergedParticipants.length > 0 ? { participants: mergedParticipants } : {}),
        ...(fact.sourceNodeId ? {} : (preferredEvent?.sourceNodeId || preferredEvent?.fromNodeId ? { sourceNodeId: String(preferredEvent.sourceNodeId || preferredEvent.fromNodeId).trim() } : {})),
        ...(fact.landingNodeId ? {} : (preferredEvent?.landingNodeId || preferredEvent?.toNodeId ? { landingNodeId: String(preferredEvent.landingNodeId || preferredEvent.toNodeId).trim() } : {})),
        ...(fact.hostNodeId ? {} : (preferredEvent?.hostNodeId ? { hostNodeId: String(preferredEvent.hostNodeId).trim() } : {})),
        ...(fact.traceNodeId ? {} : (preferredEvent?.traceNodeId ? { traceNodeId: String(preferredEvent.traceNodeId).trim() } : {})),
        ...(fact.chainId ? {} : (preferredEvent?.chainId ? { chainId: normalizeOptionalStepText(preferredEvent.chainId) } : {}))
      };
    });
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
    let derivationFrames = materializeImplicitPhrasalTraceShellsInDerivationFrames(
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
    const chainIds = new Set(canonicalChainEntries.map((entry) => entry.chainId).filter(Boolean));
    const identifiedStepIds = new Set(
      (identifiedDerivationSteps || [])
        .map((step) => normalizeOptionalStepText(step?.stepId))
        .filter(Boolean)
    );
    const rawStepIds = new Set(
      (identifiedDerivationSteps || [])
        .map((step) => normalizeOptionalStepText(step?.stepId))
        .filter(Boolean)
    );
    const {
      derivationFrames: derivationFramesWithCompiledChanges,
      frameCommitmentFacts
    } = compileFrameChangeCommitments({
      derivationFrames,
      nodeIds: chainNodeIds,
      stepIds: rawStepIds
    });
    derivationFrames = derivationFramesWithCompiledChanges;
    const resolvedVisualRelations = buildResolvedVisualRelationsFromDerivationFrames(derivationFrames);
    // This remains an open compiler view for note support and UI display. It is
    // derived solely from derivationStages and is never read from model input.
    const commitmentFacts = enrichMovementCommitmentFactsFromEvents(
      mergeCommitmentFacts(frameCommitmentFacts),
      authoritativeVisualRelationEventsWithChainIds,
      committedNodeById
    );
    const noteSupportIds = new Set(
      commitmentFacts
        .map((entry) => normalizeOptionalStepText(entry?.factId))
        .filter(Boolean)
    );
    const compiledDerivationFrameNoteBindings = compileNoteBindingsFromDerivationFrames(derivationFrames, {
      stepIds: identifiedStepIds,
      nodeIds: finalNodeIds,
      chainIds,
      commitmentFacts,
      commitmentFactIds: new Set(commitmentFacts.map((entry) => normalizeOptionalStepText(entry?.factId)).filter(Boolean)),
      supportIds: noteSupportIds
    });
    const noteBindings = compiledDerivationFrameNoteBindings;
    const notesSource = compiledDerivationFrameNoteBindings.length > 0
      ? 'derivationStages'
      : 'none';
    const derivationStages = derivationFrames.map((frame, index) => {
      const details = frame?.change?.details && typeof frame.change.details === 'object' && !Array.isArray(frame.change.details)
        ? frame.change.details
        : {};
      const stageRecord = normalizeOptionalStepText(details.stageRecord)
        || normalizeOptionalStepText(details.note || frame?.note || frame?.change?.statement);
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
    const groundedExplanation = harmonizeExplanationWithDerivation(
      buildGroundedExplanation({
        tree: committedTree,
        derivationSteps: identifiedDerivationSteps,
        visualRelationEvents: authoritativeVisualRelationEventsWithChainIds,
        framework
      }),
      identifiedDerivationSteps,
      authoritativeVisualRelationEventsWithChainIds,
      committedTree,
      framework
    );
    const coherentExplanation = noteBindings.length > 0
      ? buildExplanationFromNoteBindings(noteBindings)
      : groundedExplanation;
    auditNoteConsistency(() => {
      if (noteBindings.length === 0) return;
      validateNoteBindingsAgainstStructuredAnalysis({
        noteBindings,
        visualRelationEvents: authoritativeVisualRelationEventsWithChainIds,
        chains: canonicalChainEntries,
        commitmentFacts
      });
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
      hasCommitmentFacts: commitmentFacts.length > 0,
      hasDerivationStages: derivationStages.length > 0,
      hasResolvedVisualRelations: resolvedVisualRelations.length > 0,
      notesSource,
      notesCompiledFromDerivationStages: usesDerivationStages && compiledDerivationFrameNoteBindings.length > 0
    };

    return {
      tree: committedTree,
      rootLabel: normalizeOptionalStepText(committedTree?.label),
      explanation: coherentExplanation,
      surfaceOrder: committedSurfaceOrder,
      derivationStages,
      resolvedVisualRelations,
      noteBindings,
      derivationSteps: identifiedDerivationSteps,
      chains: canonicalChainEntries,
      commitmentFacts,
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

  const validateFinalProNoteBindings = (bundle) => {
    const analysis = bundle?.analyses?.[0];
    if (!analysis) return bundle;
    const noteBindings = Array.isArray(analysis.noteBindings) ? analysis.noteBindings : [];
    if (noteBindings.length > 0) return bundle;
    throw new ParseApiError(
      'BAD_MODEL_RESPONSE',
      'Pro analyses must include non-empty noteBindings compiled from derivationStages.',
      422
    );
  };

  return {
    deriveChainsFromCommittedAnalysis,
    backfillVisualRelationEventChainIds,
    normalizeParseResult,
    normalizeParseBundle,
    validateFinalProNoteBindings
  };
};
