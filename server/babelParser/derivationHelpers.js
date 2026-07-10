export const createDerivationHelpers = ({
  MOVEMENT_INDEX_SUBSCRIPT_MAP,
  STRUCTURAL_LEAF_LABELS,
  PRIME_CATEGORY_LABEL_RE,
  canonicalizeCovertSurface,
  normalizeSurfaceToken,
  subtreeHasOvertYield,
  getLabelProfile,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  normalizeMovementOperation,
  extractMovementIndex,
  stripMovementIndex
}) => {
  const normalizeMoveLikeOperationKey = (operation) =>
    String(operation || '').trim().toLowerCase().replace(/[^a-z]/g, '');

  const MOVE_LIKE_OPEN_OPERATION_RE = /(?:move|raise|lower|front|displac|extract|shift|scrambl|rollup|sideward|incorpor|clitic|affix|remnant|piedpip|topicaliz|focaliz|extraposit|atb|remerge)/i;
  const HEAD_LIKE_OPEN_OPERATION_RE = /(?:headmove|headmovement|lower|lowering|affix|clitic|incorpor)/i;
  const TRACE_LIKE_SURFACE_RE = /^(?:t|trace|copy|t\d+|trace\d+|copy\d+|(?:t|trace|copy)(?:_[a-z0-9]+)+|[a-z]+_(?:trace|copy)(?:_[a-z0-9]+)*|<[^>]+>|⟨[^⟩]+⟩|\(t\)|\{t\}|\(copy\)|\{copy\})$/i;
  const NULL_LIKE_SURFACE_RE = /^(?:∅|Ø|ε|null|epsilon|pro)(?:[_-][a-z0-9]+)*$/i;
  const ABSTRACT_FEATURE_SURFACE_RE = /^(?:past|present|pres|future|fut|finite|nonfinite|infinitive|inf|perfect|perf|progressive|prog|passive|active|nom(?:inative)?|acc(?:usative)?|dat(?:ive)?|gen(?:itive)?|erg(?:ative)?|abs(?:olutive)?|epp|phi|wh|focus|topic|tense|agreement|agr)$/i;
  const TRACE_ID_RE = /^trace[_-]?(\d+)?$/i;
  const isMoveLikeOperation = (operation) => {
    const key = normalizeMoveLikeOperationKey(operation);
    if (!key) return false;
    if (key === 'move' || key === 'internalmerge' || key === 'headmove' || key === 'amove' || key === 'abarmove') {
      return true;
    }
    return MOVE_LIKE_OPEN_OPERATION_RE.test(key);
  };

  const isHeadLikeOperation = (operation) => {
    const key = normalizeMoveLikeOperationKey(operation);
    return Boolean(key) && HEAD_LIKE_OPEN_OPERATION_RE.test(key);
  };

  const normalizeTraceLikeSurface = (surface) =>
    String(surface || '')
      .trim()
      .replace(/\{([^}]*)\}/g, '$1')
      .replace(/[₀₁₂₃₄₅₆₇₈₉ᵢⱼₐₑₒₓₕₖₗₘₙₚₛₜ]/g, (char) => MOVEMENT_INDEX_SUBSCRIPT_MAP[char] || char);

  const buildNodeIndexFromTree = (tree) => {
    const byId = new Map();
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      const id = String(node.id || '').trim();
      if (id) byId.set(id, node);
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach(visit);
    };
    visit(tree);
    return byId;
  };

  const buildParentIndexFromTree = (tree) => {
    const parents = new Map();
    const visit = (node, parentId = null) => {
      if (!node || typeof node !== 'object') return;
      const id = String(node.id || '').trim();
      if (id && parentId) parents.set(id, parentId);
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach((child) => visit(child, id || parentId));
    };
    visit(tree);
    return parents;
  };

  const buildNodeLabelIndexFromTree = (tree) => {
    const byLabel = new Map();
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      const id = String(node.id || '').trim();
      const label = String(node.label || '').trim();
      if (id && label) {
        if (!byLabel.has(label)) byLabel.set(label, []);
        byLabel.get(label).push(id);
      }
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach(visit);
    };
    visit(tree);
    return byLabel;
  };

  const collectLeafNodes = (node) => {
    const leaves = [];
    const visit = (current) => {
      if (!current || typeof current !== 'object') return;
      const children = Array.isArray(current.children) ? current.children : [];
      if (children.length === 0) {
        leaves.push(current);
        return;
      }
      children.forEach(visit);
    };
    visit(node);
    return leaves;
  };

  const collectSubtreeNodeIds = (node) => {
    const ids = new Set();
    const visit = (current) => {
      if (!current || typeof current !== 'object') return;
      const id = String(current.id || '').trim();
      if (id) ids.add(id);
      const children = Array.isArray(current.children) ? current.children : [];
      children.forEach(visit);
    };
    visit(node);
    return ids;
  };

  const resolveNodeSurface = (node) => {
    const word = String(node?.word || '').trim();
    const label = String(node?.label || '').trim();
    return canonicalizeCovertSurface(word || label);
  };

  const isCovertCategorySurface = (surface) => {
    const canonical = canonicalizeCovertSurface(surface);
    return canonical === '∅' || canonical === 'PRO';
  };

  const isStructuralLeafLabel = (label) => {
    const raw = String(label || '').trim();
    if (!raw) return false;
    if (!STRUCTURAL_LEAF_LABELS.has(raw.toLowerCase())) return false;
    return raw === raw.toUpperCase() || /^[A-Z]/.test(raw) || PRIME_CATEGORY_LABEL_RE.test(raw);
  };

  const traceLikeNodeType = (node) => {
    const rawType = String(node?.type || '').trim().toLowerCase();
    if (!rawType) return '';
    if (rawType === 'trace') return rawType;
    if (rawType.includes('trace')) return rawType;
    if (rawType === 'lower-copy' || rawType === 'lower_copy' || rawType === 'silent-copy' || rawType === 'silent_copy') {
      return rawType;
    }
    return '';
  };

  const resolveOvertLeafSurface = (node) => {
    if (node?.silentFeature === true) return '';
    if (node?.silent === true) return '';
    if (traceLikeNodeType(node)) return '';
    const word = String(node?.word || '').trim();
    if (word) return word;
    const children = Array.isArray(node?.children) ? node.children : [];
    if (children.length > 0) return '';
    const label = String(node?.label || '').trim();
    if (!label) return '';
    if (isStructuralLeafLabel(label)) return '';
    return label;
  };

  const normalizeAbstractFeatureSurface = (surface) =>
    String(surface || '')
      .trim()
      .replace(/^[\[\(\{<⟨]+|[\]\)\}>⟩]+$/g, '')
      .replace(/^[+-]+/, '')
      .trim()
      .toLowerCase();

  const isAbstractFeatureSurface = (surface) => {
    const raw = String(surface || '').trim();
    if (!raw) return false;
    const normalized = normalizeAbstractFeatureSurface(raw);
    if (!normalized) return false;
    if (normalized === 'fin' || normalized === 'nfin' || normalized === 'nonfin') return true;
    return ABSTRACT_FEATURE_SURFACE_RE.test(normalized);
  };

  const isTraceLikeSurface = (surface) => {
    const raw = String(surface || '').trim();
    if (!raw) return false;
    const normalized = normalizeTraceLikeSurface(raw);
    return TRACE_LIKE_SURFACE_RE.test(raw) || TRACE_LIKE_SURFACE_RE.test(normalized);
  };

  const isNullLikeSurface = (surface) => NULL_LIKE_SURFACE_RE.test(canonicalizeCovertSurface(surface));

  const isTraceLikeNode = (node) => Boolean(traceLikeNodeType(node)) || isTraceLikeSurface(resolveNodeSurface(node));
  const isNullLikeNode = (node) => NULL_LIKE_SURFACE_RE.test(resolveNodeSurface(node));

  const nodeMovementIndex = (node) =>
    extractMovementIndex(String(node?.label || '').trim()) ||
    extractMovementIndex(String(node?.word || '').trim()) ||
    null;

  const isIndexedTraceOrNullNode = (node) => {
    const label = stripMovementIndex(String(node?.label || '').trim());
    const surface = stripMovementIndex(resolveNodeSurface(node));
    return isTraceLikeSurface(label) ||
      isTraceLikeSurface(surface) ||
      NULL_LIKE_SURFACE_RE.test(label) ||
      NULL_LIKE_SURFACE_RE.test(surface);
  };

  const subtreeContainsOnlyCovertCategoryLeaves = (node) => {
    const leaves = collectLeafNodes(node);
    if (leaves.length === 0) return false;
    return leaves.every((leaf) => {
      const surface = resolveNodeSurface(leaf);
      return isTraceLikeNode(leaf) || isNullLikeNode(leaf) || isCovertCategorySurface(surface);
    });
  };

  const subtreeContainsNamedCovertCategoryLeaf = (node) => {
    const leaves = collectLeafNodes(node);
    if (leaves.length === 0) return false;
    return leaves.some((leaf) => isCovertCategorySurface(resolveNodeSurface(leaf)));
  };

  const hasSameIndexedAncestor = (nodeId, relationIndex, nodeById, parentById) => {
    let currentId = String(parentById.get(String(nodeId || '').trim()) || '').trim();
    while (currentId) {
      const current = nodeById.get(currentId);
      if (current && nodeMovementIndex(current) === relationIndex) return true;
      currentId = String(parentById.get(currentId) || '').trim();
    }
    return false;
  };

  const findIndexedTraceLeaf = (node, relationIndex) =>
    collectLeafNodes(node).find((leaf) => {
      const index = nodeMovementIndex(leaf);
      if (index && index === relationIndex && isIndexedTraceOrNullNode(leaf)) return true;
      return !index && (isTraceLikeNode(leaf) || isNullLikeNode(leaf));
    }) || null;

  const stripMovementIndicesFromTree = (node) => {
    if (!node || typeof node !== 'object') return node;
    const label = String(node.label || '').trim();
    if (label) {
      const stripped = stripMovementIndex(label);
      if (stripped && stripped !== label) {
        node.label = stripped;
      }
    }
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) => stripMovementIndicesFromTree(child));
    return node;
  };

  const materializeEmptyStructuralLeaves = (node, sentenceTokens, options = {}, withinProtectedSubtree = false) => {
    if (!node || typeof node !== 'object') return node;
    const protectedSubtreeIds = options?.protectedSubtreeIds instanceof Set
      ? options.protectedSubtreeIds
      : new Set();
    const currentId = String(node.id || '').trim();
    const nextWithinProtectedSubtree = withinProtectedSubtree || (currentId && protectedSubtreeIds.has(currentId));
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) => materializeEmptyStructuralLeaves(child, sentenceTokens, options, nextWithinProtectedSubtree));
    if (nextWithinProtectedSubtree) return node;
    if (children.length === 0) {
      const label = String(node.label || '').trim();
      const word = String(node.word || '').trim();
      const treatAsStructuralLeaf = isStructuralLeafLabel(label) || label === 'v';
      if (label && !word && treatAsStructuralLeaf) {
        const normalizedLabel = normalizeSurfaceToken(label);
        if (normalizedLabel && sentenceTokens && sentenceTokens.has(normalizedLabel)) return node;
        node.children = [{ label: '∅', id: `null_${String(node.id || 'anon').trim()}` }];
      }
    }
    return node;
  };

  const promoteSentenceMatchingLeaves = (tree, sentenceTokenSet) => {
    if (!tree || typeof tree !== 'object' || !sentenceTokenSet) return;
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) {
        if (String(node.word || '').trim()) return;
        const label = String(node.label || '').trim();
        if (!label) return;
        const normalized = normalizeSurfaceToken(label);
        if (normalized && sentenceTokenSet.has(normalized) && isStructuralLeafLabel(label)) {
          node.word = label;
        }
        return;
      }
      children.forEach(visit);
    };
    visit(tree);
  };

  const resolveVisualRelationEventStepIndex = (event, derivationSteps) => {
    if (!Array.isArray(derivationSteps) || derivationSteps.length === 0) return undefined;

    const explicitStep = Number(event.stepIndex);
    if (Number.isInteger(explicitStep) && explicitStep >= 0 && explicitStep < derivationSteps.length) {
      return explicitStep;
    }

    const fromNodeId = String(event.fromNodeId || '').trim();
    const toNodeId = String(event.toNodeId || '').trim();
    const traceNodeId = String(event.traceNodeId || '').trim();

    let bestIndex = -1;
    let bestScore = -1;

    derivationSteps.forEach((step, index) => {
      if (!step || typeof step !== 'object') return;
      const stepTarget = String(step.targetNodeId || '').trim();
      const stepSources = Array.isArray(step.sourceNodeIds)
        ? step.sourceNodeIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

      let score = 0;
      if (stepTarget && stepTarget === toNodeId) score += 6;
      if (stepSources.includes(fromNodeId)) score += 5;
      if (stepTarget && stepTarget === fromNodeId) score += 2;
      if (stepSources.includes(toNodeId)) score += 1;
      if (traceNodeId && (stepTarget === traceNodeId || stepSources.includes(traceNodeId))) score += 2;
      if (isMoveLikeOperation(step.operation)) score += 3;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestScore > 0) return bestIndex;

    const fallbackMoveIndex = derivationSteps.findIndex((step) => isMoveLikeOperation(step?.operation));
    if (fallbackMoveIndex >= 0) return fallbackMoveIndex;

    return undefined;
  };

  const resolveMovementNodeReference = (rawRef, nodeIds, labelIndex, exactAnchorsOnly = false) => {
    const ref = String(rawRef || '').trim();
    if (!ref) return '';
    if (nodeIds.has(ref)) return ref;
    if (exactAnchorsOnly) return '';
    const labelMatches = labelIndex.get(ref) || [];
    if (labelMatches.length === 1) return String(labelMatches[0] || '').trim();
    return '';
  };

  const normalizeVisualRelationEvents = (value, nodeIds, derivationSteps, nodeById, labelIndex) => {
    if (!Array.isArray(value)) return undefined;
    const steps = Array.isArray(derivationSteps) ? derivationSteps : [];
    const stepIndexById = new Map();
    steps.forEach((step, index) => {
      const stepId = normalizeOptionalStepText(step?.stepId);
      if (stepId && !stepIndexById.has(stepId)) {
        stepIndexById.set(stepId, index);
      }
    });

    const events = value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const explicitStepId = normalizeOptionalStepText(item.stepId);
        const exactAnchorsOnly = item.exactAnchorsOnly === true;
        const preserveOperationLabel = item.preserveOperationLabel === true || Boolean(normalizeOptionalStepText(item.label));
        let operation = preserveOperationLabel
          ? normalizeOptionalStepText(item.label || item.operation || item.type)
          : normalizeMovementOperation(item.operation || item.type);
        const explicitMovingRef = String(item.movingNodeId || '').trim();
        const explicitSourceRef = String(item.fromNodeId || item.sourceNodeId || item.source || '').trim();
        const explicitLandingRef = String(item.landingNodeId || item.toNodeId || item.targetNodeId || item.target || explicitMovingRef).trim();
        const explicitHostRef = String(item.hostNodeId || item.host || '').trim();
        const explicitTraceRef = String(item.traceNodeId || item.lowerCopyNodeId || item.trace || '').trim();
        let fromNodeId = resolveMovementNodeReference(explicitSourceRef, nodeIds, labelIndex, exactAnchorsOnly);
        let toNodeId = resolveMovementNodeReference(explicitLandingRef, nodeIds, labelIndex, exactAnchorsOnly);
        const movingNodeId = resolveMovementNodeReference(explicitMovingRef, nodeIds, labelIndex, exactAnchorsOnly);
        const hostNodeId = resolveMovementNodeReference(explicitHostRef, nodeIds, labelIndex, exactAnchorsOnly);
        let traceNodeId = resolveMovementNodeReference(explicitTraceRef, nodeIds, labelIndex, exactAnchorsOnly);
        const selfTargetResolvedViaTrace = Boolean(
          fromNodeId
          && toNodeId
          && fromNodeId === toNodeId
          && traceNodeId
          && traceNodeId !== fromNodeId
        );
        if (selfTargetResolvedViaTrace) {
          fromNodeId = traceNodeId;
        } else if (fromNodeId && toNodeId && fromNodeId === toNodeId) {
          toNodeId = '';
        }
        const stepIndexRaw = Number(item.stepIndex);
        const hasDerivationTimeline = steps.length > 0;
        let stepIndex = Number.isInteger(stepIndexRaw) &&
          stepIndexRaw >= 0 &&
          (!hasDerivationTimeline || stepIndexRaw < steps.length)
          ? stepIndexRaw
          : undefined;

        if (stepIndex === undefined && explicitStepId && stepIndexById.has(explicitStepId)) {
          stepIndex = stepIndexById.get(explicitStepId);
        }

        if (stepIndex === undefined) {
          stepIndex = resolveVisualRelationEventStepIndex({
            operation,
            fromNodeId,
            toNodeId,
            traceNodeId
          }, steps);
        }

        const alignedStep = Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < steps.length
          ? steps[stepIndex]
          : undefined;
        operation = operation || (preserveOperationLabel
          ? normalizeOptionalStepText(alignedStep?.operation)
          : normalizeMovementOperation(alignedStep?.operation));
        const diagnostics = [];
        if (explicitMovingRef && !movingNodeId) diagnostics.push(`Saved moving node "${explicitMovingRef}" is not present in the authored tree inventory.`);
        if (explicitSourceRef && !fromNodeId) diagnostics.push(`Saved source node "${explicitSourceRef}" is not present in the authored tree inventory.`);
        if (explicitLandingRef && !toNodeId) diagnostics.push(`Saved landing node "${explicitLandingRef}" is not present in the authored tree inventory.`);
        if (explicitHostRef && !hostNodeId) diagnostics.push(`Saved host node "${explicitHostRef}" is not present in the authored tree inventory.`);
        if (explicitTraceRef && !traceNodeId) diagnostics.push(`Saved trace node "${explicitTraceRef}" is not present in the authored tree inventory.`);
        if (!fromNodeId) diagnostics.push('Source omitted in saved movement.');
        if (!toNodeId) diagnostics.push('Landing omitted in saved movement.');

        const chainId = normalizeOptionalStepText(item.chainId) || normalizeOptionalStepText(alignedStep?.chainId);
        return {
          operation,
          ...(preserveOperationLabel ? { label: operation } : {}),
          ...(movingNodeId ? { movingNodeId } : {}),
          fromNodeId,
          sourceNodeId: fromNodeId || undefined,
          landingNodeId: toNodeId || undefined,
          hostNodeId: hostNodeId || undefined,
          toNodeId,
          traceNodeId: traceNodeId && nodeIds.has(traceNodeId) ? traceNodeId : undefined,
          ...(chainId ? { chainId } : {}),
          ...(explicitStepId ? { stepId: explicitStepId } : {}),
          stepIndex,
          note: typeof item.note === 'string' ? item.note : undefined,
          ...(item.participants && typeof item.participants === 'object' && !Array.isArray(item.participants) ? { participants: item.participants } : {}),
          ...(preserveOperationLabel ? { preserveOperationLabel: true } : {}),
          ...(exactAnchorsOnly ? { exactAnchorsOnly: true } : {}),
          serializationStatus: diagnostics.length > 0 ? 'underspecified' : 'complete',
          diagnostics: diagnostics.length > 0 ? Array.from(new Set(diagnostics)) : undefined
        };
      })
      .filter(Boolean);

    return events.length > 0 ? events : undefined;
  };

  const isNodeDominatedBy = (nodeId, ancestorId, parentById) => {
    const target = String(nodeId || '').trim();
    const ancestor = String(ancestorId || '').trim();
    if (!target || !ancestor) return false;
    let current = target;
    while (current) {
      if (current === ancestor) return true;
      current = String(parentById.get(current) || '').trim();
    }
    return false;
  };

  const isExternalTraceLikeNode = (node, targetNodeId, parentById) => {
    const id = String(node?.id || '').trim();
    if (!id) return false;
    if (isNodeDominatedBy(id, targetNodeId, parentById)) return false;
    return isTraceLikeNode(node) || isNullLikeNode(node);
  };

  const findUniqueTraceLikeLeafOutsideSubtree = (searchRoot, excludedSubtree, parentById) => {
    if (!searchRoot || !excludedSubtree) return null;
    const excludedIds = collectSubtreeNodeIds(excludedSubtree);
    const candidates = collectLeafNodes(searchRoot).filter((leaf) => {
      const id = String(leaf.id || '').trim();
      if (!id || excludedIds.has(id)) return false;
      return isExternalTraceLikeNode(leaf, String(excludedSubtree.id || '').trim(), parentById);
    });
    return candidates.length === 1 ? candidates[0] : null;
  };

  const getMoveLikeTraceSourceFromStep = (step, nodeById, targetNodeId, parentById) => {
    const sourceIds = Array.isArray(step?.sourceNodeIds)
      ? step.sourceNodeIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    for (const sourceId of sourceIds) {
      const sourceNode = nodeById.get(sourceId);
      if (!sourceNode) continue;
      if (isExternalTraceLikeNode(sourceNode, targetNodeId, parentById)) return sourceNode;
      const leafCandidate = collectLeafNodes(sourceNode).find((leaf) =>
        isExternalTraceLikeNode(leaf, targetNodeId, parentById)
      );
      if (leafCandidate) return leafCandidate;
    }
    return null;
  };

  const groundVisualRelationEvent = ({
    event,
    step,
    tree,
    nodeById,
    parentById
  }) => {
    if (!event) return null;
    const fromNodeId = String(event.fromNodeId || '').trim();
    const toNodeId = String(event.toNodeId || '').trim();
    if (!fromNodeId || !toNodeId) return null;

    const fromNode = nodeById.get(fromNodeId);
    const toNode = nodeById.get(toNodeId);
    if (!fromNode || !toNode) return null;

    const op = normalizeMovementOperation(event.operation) || 'Move';

    const explicitTraceId = String(event.traceNodeId || '').trim();
    const explicitTraceNode = explicitTraceId ? nodeById.get(explicitTraceId) : undefined;
    const groundedExplicitTrace = explicitTraceNode && isExternalTraceLikeNode(explicitTraceNode, toNodeId, parentById)
      ? explicitTraceNode
      : null;

    if (isHeadLikeOperation(op)) {
      if (groundedExplicitTrace) {
        return {
          ...event,
          operation: op,
          fromNodeId: String(groundedExplicitTrace.id || '').trim(),
          traceNodeId: String(groundedExplicitTrace.id || '').trim()
        };
      }

      const parentId = String(parentById.get(toNodeId) || '').trim();
      const parentNode = parentId ? nodeById.get(parentId) : undefined;
      const siblingTrace = parentNode
        ? findUniqueTraceLikeLeafOutsideSubtree(parentNode, toNode, parentById)
        : null;
      if (siblingTrace) {
        return {
          ...event,
          operation: op,
          fromNodeId: String(siblingTrace.id || '').trim(),
          traceNodeId: String(siblingTrace.id || '').trim()
        };
      }

      const stepTrace = getMoveLikeTraceSourceFromStep(step, nodeById, toNodeId, parentById);
      if (stepTrace) {
        return {
          ...event,
          operation: op,
          fromNodeId: String(stepTrace.id || '').trim(),
          traceNodeId: String(stepTrace.id || '').trim()
        };
      }

      return null;
    }

    const fromProfile = getLabelProfile(fromNode.label);
    const toProfile = getLabelProfile(toNode.label);
    if (toProfile.isPhrasal && fromProfile.isHeadLikeStructural) {
      const stepTrace = getMoveLikeTraceSourceFromStep(step, nodeById, toNodeId, parentById);
      if (stepTrace) {
        const stepTraceProfile = getLabelProfile(stepTrace.label);
        if (!stepTraceProfile.isHeadLikeStructural) {
          return {
            ...event,
            operation: op,
            fromNodeId: String(stepTrace.id || '').trim(),
            traceNodeId: String(stepTrace.id || '').trim()
          };
        }
      }

      const externalTrace = findUniqueTraceLikeLeafOutsideSubtree(tree, toNode, parentById);
      if (externalTrace) {
        const traceProfile = getLabelProfile(externalTrace.label);
        if (!traceProfile.isHeadLikeStructural) {
          return {
            ...event,
            operation: op,
            fromNodeId: String(externalTrace.id || '').trim(),
            traceNodeId: String(externalTrace.id || '').trim()
          };
        }
      }

      return null;
    }

    if (groundedExplicitTrace) {
      return {
        ...event,
        operation: op,
        traceNodeId: String(groundedExplicitTrace.id || '').trim()
      };
    }

    if (isNodeDominatedBy(fromNodeId, toNodeId, parentById)) {
      const stepTrace = getMoveLikeTraceSourceFromStep(step, nodeById, toNodeId, parentById);
      if (stepTrace) {
        return {
          ...event,
          operation: op,
          fromNodeId: String(stepTrace.id || '').trim(),
          traceNodeId: String(stepTrace.id || '').trim()
        };
      }

      const externalTrace = findUniqueTraceLikeLeafOutsideSubtree(tree, toNode, parentById);
      if (externalTrace) {
        return {
          ...event,
          operation: op,
          fromNodeId: String(externalTrace.id || '').trim(),
          traceNodeId: String(externalTrace.id || '').trim()
        };
      }

      return null;
    }

    return {
      ...event,
      operation: op,
      traceNodeId: undefined
    };
  };

  const isPlausibleRawVisualRelationEvent = (event, nodeById) => {
    const fromNodeId = String(event?.fromNodeId || '').trim();
    const toNodeId = String(event?.toNodeId || '').trim();
    if (!fromNodeId || !toNodeId) return false;
    if (!nodeById.has(fromNodeId) || !nodeById.has(toNodeId)) return false;
    return fromNodeId !== toNodeId;
  };

  const buildCanonicalVisualRelationEvents = ({
    tree,
    derivationSteps,
    rawVisualRelationEvents
  }) => {
    const nodeById = buildNodeIndexFromTree(tree);
    const parentById = buildParentIndexFromTree(tree);
    const steps = Array.isArray(derivationSteps) ? derivationSteps : [];
    const rawEvents = Array.isArray(rawVisualRelationEvents) ? rawVisualRelationEvents : [];
    const canonical = [];
    const seen = new Set();
    const mergeDiagnostics = (...collections) => {
      const merged = [];
      const seenDiagnostics = new Set();
      collections.flat().forEach((value) => {
        const text = normalizeOptionalStepText(value);
        if (!text) return;
        const parts = text
          .split(/,(?=[A-Z"])/g)
          .map((part) => normalizeOptionalStepText(part))
          .filter(Boolean);
        (parts.length > 0 ? parts : [text]).forEach((part) => {
          if (seenDiagnostics.has(part)) return;
          seenDiagnostics.add(part);
          merged.push(part);
        });
      });
      return merged.length > 0 ? merged : undefined;
    };
    const isNodeOrImmediateParentHeadLike = (nodeId) => {
      const normalizedNodeId = String(nodeId || '').trim();
      if (!normalizedNodeId) return false;
      const node = nodeById.get(normalizedNodeId);
      if (node && getLabelProfile(node.label).isHeadLikeStructural) return true;
      const parentId = String(parentById.get(normalizedNodeId) || '').trim();
      if (!parentId) return false;
      const parent = nodeById.get(parentId);
      return Boolean(parent && getLabelProfile(parent.label).isHeadLikeStructural);
    };

    const pushEvent = (event, stepForContext) => {
      if (!event) return;
      const fromNodeId = String(event.fromNodeId || '').trim();
      const toNodeId = String(event.toNodeId || '').trim();
      const stepIndex = Number(event.stepIndex);
      const safeStepIndex = Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < steps.length
        ? stepIndex
        : undefined;
      const preserveOperationLabel = event.preserveOperationLabel === true || Boolean(normalizeOptionalStepText(event.label));
      const explicitOperation = (preserveOperationLabel
        ? normalizeOptionalStepText(event.label || event.operation)
        : normalizeMovementOperation(event.operation)) || 'Move';
      const traceNodeId = (() => {
        const trace = String(event.traceNodeId || '').trim();
        if (trace && nodeById.has(trace)) return trace;
        return undefined;
      })();
      const key = `${fromNodeId || 'missing'}->${toNodeId || 'missing'}@${safeStepIndex ?? 'na'}:${explicitOperation}:${String(event.chainId || '').trim()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const chainId = normalizeOptionalStepText(event.chainId) || normalizeOptionalStepText(stepForContext?.chainId);
      const diagnostics = [];
      if (!fromNodeId) diagnostics.push('Source omitted in saved movement.');
      if (!toNodeId) diagnostics.push('Landing omitted in saved movement.');
      if (fromNodeId && !nodeById.has(fromNodeId)) diagnostics.push(`Saved source node "${fromNodeId}" is not present in the committed tree.`);
      if (toNodeId && !nodeById.has(toNodeId)) diagnostics.push(`Saved landing node "${toNodeId}" is not present in the committed tree.`);
      if (fromNodeId && toNodeId && fromNodeId === toNodeId) diagnostics.push('Source and landing collapse to the same saved node.');
      const sourceHeadLike = isNodeOrImmediateParentHeadLike(fromNodeId);
      const targetHeadLike = isNodeOrImmediateParentHeadLike(toNodeId);
      if (
        explicitOperation === 'HeadMove'
        && fromNodeId
        && toNodeId
        && (
          !sourceHeadLike
          || !targetHeadLike
        )
      ) {
        diagnostics.push('Head-like movement does not connect head-compatible saved nodes.');
      }
      const mergedDiagnostics = mergeDiagnostics(event.diagnostics, diagnostics);
      const headMovementIncoherent = diagnostics.some((message) => /head-like movement does not connect head-compatible saved nodes/i.test(String(message || '')));
      const serializationStatus = normalizeOptionalStepText(event.serializationStatus) === 'incoherent' || headMovementIncoherent
        ? 'incoherent'
        : mergedDiagnostics
          ? 'underspecified'
          : 'complete';
      canonical.push({
        operation: explicitOperation,
        ...(preserveOperationLabel ? { label: explicitOperation } : {}),
        ...(normalizeOptionalStepText(event.movingNodeId) ? { movingNodeId: normalizeOptionalStepText(event.movingNodeId) } : {}),
        fromNodeId: fromNodeId || undefined,
        ...(normalizeOptionalStepText(event.sourceNodeId) ? { sourceNodeId: normalizeOptionalStepText(event.sourceNodeId) } : {}),
        landingNodeId: String(event.landingNodeId || event.toNodeId || '').trim() || undefined,
        ...(normalizeOptionalStepText(event.hostNodeId) ? { hostNodeId: normalizeOptionalStepText(event.hostNodeId) } : {}),
        toNodeId: toNodeId || undefined,
        traceNodeId,
        ...(chainId ? { chainId } : {}),
        ...(normalizeOptionalStepText(event.stepId) ? { stepId: normalizeOptionalStepText(event.stepId) } : {}),
        stepIndex: safeStepIndex,
        note: typeof event.note === 'string' ? event.note : undefined,
        ...(event.participants && typeof event.participants === 'object' && !Array.isArray(event.participants) ? { participants: event.participants } : {}),
        ...(preserveOperationLabel ? { preserveOperationLabel: true } : {}),
        ...(event.exactAnchorsOnly === true ? { exactAnchorsOnly: true } : {}),
        serializationStatus,
        diagnostics: mergedDiagnostics
      });
    };

    rawEvents.forEach((event) => {
        const stepIndex = Number(event?.stepIndex);
        const step = Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < steps.length
          ? steps[stepIndex]
          : undefined;
        pushEvent(event, step);
      });

    return canonical.length > 0 ? canonical : undefined;
  };

  const collectOvertYieldWords = (node, words = []) => {
    if (!node || typeof node !== 'object') return words;
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length === 0) {
      const surface = String(resolveOvertLeafSurface(node) || '').trim();
      if (surface && !isTraceLikeNode(node) && !isNullLikeNode(node)) {
        words.push(surface);
      }
      return words;
    }
    children.forEach((child) => collectOvertYieldWords(child, words));
    return words;
  };

  const getNodeOvertYield = (node) => collectOvertYieldWords(node, []).join(' ').trim();

  const normalizeMovementLabelKey = (label) =>
    String(label || '')
      .trim()
      .replace(/[_\s,.-]+/g, '')
      .toLowerCase();

  const resolveHeadMovementLandingNode = (node, nodeById, parentById) => {
    if (!node) return null;

    let current = node;
    let currentId = String(node.id || '').trim();
    let currentYield = getNodeOvertYield(current);

    while (currentId) {
      const parentId = String(parentById.get(currentId) || '').trim();
      if (!parentId) break;
      const parent = nodeById.get(parentId) || null;
      if (!parent) break;

      const profile = getLabelProfile(parent.label);
      if (!profile.isHeadLikeStructural) break;

      const parentYield = getNodeOvertYield(parent);
      if (!parentYield || !currentYield) break;
      if (normalizeMovementLabelKey(parentYield) !== normalizeMovementLabelKey(currentYield)) break;

      current = parent;
      currentId = parentId;
      currentYield = parentYield;
    }

    return current;
  };

  return {
    isMoveLikeOperation,
    buildNodeLabelIndexFromTree,
    normalizeVisualRelationEvents,
    isAbstractFeatureSurface,
    getNodeOvertYield,
    normalizeTraceLikeSurface,
    isNullLikeSurface,
    buildNodeIndexFromTree,
    buildParentIndexFromTree,
    collectLeafNodes,
    resolveNodeSurface,
    resolveOvertLeafSurface,
    isTraceLikeSurface,
    isTraceLikeNode,
    isNullLikeNode,
    subtreeContainsOnlyCovertCategoryLeaves,
    subtreeContainsNamedCovertCategoryLeaf,
    stripMovementIndicesFromTree,
    materializeEmptyStructuralLeaves,
    promoteSentenceMatchingLeaves,
    buildCanonicalVisualRelationEvents,
    normalizeMovementLabelKey,
    resolveHeadMovementLandingNode
  };
};
