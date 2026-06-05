import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_RENDER_DIRS = [
  'test-results/provider-route-audit-2026-05-12/render-gemini-current-v195-full-stage-layout-ballast',
  'test-results/provider-route-audit-2026-05-12/render-gpt-current-v195-full-stage-layout-ballast',
  'test-results/provider-route-audit-2026-05-12/render-claude-current-v195-full-stage-layout-ballast',
  'test-results/provider-route-audit-2026-05-12/render-gemini-v196-colour',
  'test-results/provider-route-audit-2026-05-12/render-gpt-v196-colour',
  'test-results/provider-route-audit-2026-05-12/render-claude-v196-colour'
];

const CATEGORY_RE = /^(?:A|ADJ|ADJP|ADVP|ASP|ASPP|C|CP|D|DP|I|IP|INFL|INFLP|N|NP|NEG|NEGP|P|PP|PRT|PRTP|T|TP|V|VP|v|vP|VOICE|VOICEP|PASS|PASSP|PERF|PERFP|VB|VD|VA|VMAIN|VPASS|C\[Q\]\+T|C\+T)(?:')?$/i;
const NULL_RE = /^(?:\u2205|\u00d8|\u03b5|null|epsilon)$/i;
const TRACE_RE = /^(?:t|trace|t\d+|trace\d+|t[_-](?:\{?[A-Za-z0-9]+\}?|\[[A-Za-z0-9]+\]|\([A-Za-z0-9]+\))|trace[_-]?[A-Za-z0-9{}]+|\u27e8[^]+?\u27e9|<[^>]+>)$/i;
const MACRO_OPERATION_RE = /^(?:StageRecord|Checkpoint|Macro)$/i;
const FIRST_APPEARANCE_OK_RE = /^(?:LexicalSelect|Select\b|Move\b|.*movement.*|.*raising.*|.*chain.*|control)$/i;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const fail = (errors, scope, message) => {
  errors.push(`${scope}: ${message}`);
};

const unwrapBundle = (bundleWrapper) => bundleWrapper?.response || bundleWrapper;
const nodeId = (node) => String(node?.id || '').trim();
const nodeLabel = (node) => String(node?.word || node?.label || '').trim();
const childrenOf = (node) => Array.isArray(node?.children) ? node.children : [];
const baseId = (id) => String(id || '').replace(/::__(?:leaf|null|trace).*$/i, '');

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\u27e8|\u27e9$/g, '')
    .replace(/^<|>$/g, '')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

const isNullLike = (value) => NULL_RE.test(String(value || '').trim());
const isTraceLike = (value) => TRACE_RE.test(String(value || '').trim());
const isCategoryLike = (value) => CATEGORY_RE.test(String(value || '').trim());
const isBareTraceCategoryLabel = (value) => {
  const text = String(value || '').trim();
  return /^t(?:$|\d|[_-])/u.test(text) || /^trace\b/i.test(text);
};
const isSilentPronominalDisplay = (label, word = label) => {
  const normalize = (value) => String(value || '').replace(/['\s]/g, '').toUpperCase();
  const normalizedLabel = normalize(label);
  const normalizedWord = normalize(word);
  return (
    normalizedLabel === 'PRO' ||
    normalizedLabel.startsWith('PRO_') ||
    normalizedWord === 'PRO' ||
    normalizedWord.startsWith('PRO_')
  );
};

const buildNodeMap = (root) => {
  const byId = new Map();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    if (id) byId.set(id, node);
    childrenOf(node).forEach(visit);
  };
  visit(root);
  return byId;
};

const findNodePath = (root, targetId) => {
  const target = String(targetId || '').trim();
  if (!root || !target) return null;
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return null;
    const nextPath = path.concat(node);
    if (nodeId(node) === target) return nextPath;
    for (const child of childrenOf(node)) {
      const found = visit(child, nextPath);
      if (found) return found;
    }
    return null;
  };
  return visit(root, []);
};

const collectSuppressedNodeSet = (payload) =>
  new Set(Array.isArray(payload?.replaySuppressAutoRevealNodeIds) ? payload.replaySuppressAutoRevealNodeIds.map(String) : []);

const collectVisibleNodeSet = (payload) => {
  const suppressedIds = collectSuppressedNodeSet(payload);
  return new Set(
    (Array.isArray(payload?.replayVisibleNodeIds) ? payload.replayVisibleNodeIds.map(String) : [])
      .filter((id) => !suppressedIds.has(id))
  );
};

const collectVisibleTerminalRecords = (root, visibleIds) => {
  const output = [];
  const visit = (node, parent = null) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    const children = childrenOf(node);
    if (children.length === 0) {
      if (visibleIds && !visibleIds.has(id)) return;
      const label = nodeLabel(node);
      output.push({
        id,
        label,
        token: normalizeToken(label),
        parentId: nodeId(parent),
        parentLabel: String(parent?.label || '').trim(),
        silent: Boolean(node?.silent)
      });
      return;
    }
    children.forEach((child) => visit(child, node));
  };
  visit(root);
  return output;
};

const collectVisibleYield = (root, visibleIds) =>
  collectVisibleTerminalRecords(root, visibleIds)
    .filter((record) =>
      record.token &&
      !record.silent &&
      !isNullLike(record.label) &&
      !isTraceLike(record.label) &&
      !isCategoryLike(record.label)
    )
    .map((record) => record.token);

const visibleOvertTokenCounts = (payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const counts = new Map();
  collectVisibleYield(payload?.replayCanvasData, visibleIds).forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });
  return counts;
};

const pruneToVisibleTree = (node, visibleIds) => {
  if (!node || typeof node !== 'object') return null;
  const id = nodeId(node);
  const children = childrenOf(node)
    .map((child) => pruneToVisibleTree(child, visibleIds))
    .filter(Boolean);
  if (!visibleIds.has(id) && children.length === 0) return null;
  return {
    id,
    label: String(node?.label || '').trim(),
    word: String(node?.word || '').trim(),
    silent: Boolean(node?.silent),
    visible: visibleIds.has(id),
    children
  };
};

const relationKey = (link) => {
  const chainId = String(link?.chainId || '').trim();
  if (chainId) {
    return [
      chainId,
      String(link?.chainHopIndex ?? '').trim(),
      String(link?.relation || link?.operation || 'relation').trim(),
      String(link?.stepIndex ?? '').trim(),
      String(link?.relationIndex || '').trim()
    ].join('|');
  }
  return [
    'unclaimed-chain',
    String(link?.relation || link?.operation || 'relation').trim(),
    String(link?.sourceNodeId || '').trim(),
    String(link?.targetNodeId || '').trim(),
    String(link?.witnessNodeId || '').trim(),
    String(link?.stepIndex ?? '').trim(),
    String(link?.relationIndex || '').trim()
  ].join('|');
};

const isRenderableRelationLink = (link) =>
  String(link?.renderFamily || '').trim() === 'trajectory' || Boolean(link?.trajectoryKind);

const visibleTreeSignature = (payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const links = Array.isArray(payload?.replayRelationLinks)
    ? payload.replayRelationLinks.map((link) => ({
      key: relationKey(link),
      relation: String(link?.relation || ''),
      source: String(link?.sourceNodeId || ''),
      target: String(link?.targetNodeId || ''),
      witness: String(link?.witnessNodeId || '')
    })).sort((a, b) => a.key.localeCompare(b.key))
    : [];
  return JSON.stringify({
    tree: pruneToVisibleTree(payload?.replayCanvasData || null, visibleIds),
    links
  });
};

const expectedSurfaceTokens = (bundleWrapper) => {
  const bundle = unwrapBundle(bundleWrapper);
  const analysis = Array.isArray(bundle?.analyses) ? bundle.analyses[0] : null;
  if (Array.isArray(analysis?.surfaceOrder) && analysis.surfaceOrder.length > 0) {
    return analysis.surfaceOrder.map(normalizeToken).filter(Boolean);
  }
  return String(bundleWrapper?.request?.sentence || '')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
};

const countTraceLeaves = (node, visibleIds) => {
  let count = 0;
  const visit = (current) => {
    if (!current || typeof current !== 'object') return;
    const id = nodeId(current);
    const children = childrenOf(current);
    if (children.length === 0) {
      if (visibleIds.has(id) && isTraceLike(nodeLabel(current))) count += 1;
      return;
    }
    children.forEach(visit);
  };
  visit(node);
  return count;
};

const countOvertLeaves = (node, visibleIds) => {
  let count = 0;
  const visit = (current) => {
    if (!current || typeof current !== 'object') return;
    const id = nodeId(current);
    const children = childrenOf(current);
    if (children.length === 0) {
      const label = nodeLabel(current);
      if (visibleIds.has(id) && label && !isNullLike(label) && !isTraceLike(label) && !isCategoryLike(label)) count += 1;
      return;
    }
    children.forEach(visit);
  };
  visit(node);
  return count;
};

const assertVisibleNodesResolve = (errors, scope, payload) => {
  const byId = buildNodeMap(payload?.replayCanvasData);
  const visibleIds = Array.isArray(payload?.replayVisibleNodeIds) ? payload.replayVisibleNodeIds : [];
  visibleIds.forEach((rawId) => {
    const id = String(rawId || '').trim();
    if (!id) {
      fail(errors, scope, 'visible node id is empty');
      return;
    }
    if (!byId.has(id) && !byId.has(baseId(id))) {
      fail(errors, scope, `visible node id does not resolve: ${id}`);
    }
  });
};

const assertVisibleAncestorClosure = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const suppressedIds = collectSuppressedNodeSet(payload);
  const visit = (node, visibleAncestorSeen = false, hiddenAfterVisible = []) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    if (id && visibleIds.has(id)) {
      hiddenAfterVisible.forEach((ancestorId) => {
        if (ancestorId) {
          fail(errors, scope, `visible node has hidden ancestor inside visible subtree: ${id} under ${ancestorId}`);
        }
      });
    }
    const selfVisible = Boolean(id && visibleIds.has(id));
    const selfIsAllowedHiddenCarrier = Boolean(
      id
      && (
        suppressedIds.has(id)
        || node?.replayLayoutOnly === true
      )
    );
    const nextVisibleAncestorSeen = visibleAncestorSeen || selfVisible;
    const nextHiddenAfterVisible = (
      id && nextVisibleAncestorSeen && !selfVisible && !selfIsAllowedHiddenCarrier
        ? hiddenAfterVisible.concat(id)
        : hiddenAfterVisible
    );
    childrenOf(node).forEach((child) => visit(child, nextVisibleAncestorSeen, nextHiddenAfterVisible));
  };
  visit(payload?.replayCanvasData);
};

const assertNoEmptyVisibleLeaves = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    const children = childrenOf(node);
    if (children.length === 0 && visibleIds.has(id)) {
      const label = nodeLabel(node);
      if (!label) {
        fail(errors, scope, `visible leaf has no label or word: ${id}`);
      }
      if (isCategoryLike(label) && !String(node?.word || '').trim()) {
        fail(errors, scope, `category is visible as a bare leaf instead of a preterminal branch: ${id}:${label}`);
      }
    }
    children.forEach(visit);
  };
  visit(payload?.replayCanvasData);
};

const assertNoInventedSilentPronominalTerminals = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const visit = (node, parent = null) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    const label = String(node?.label || '').trim();
    const word = String(node?.word || '').trim();
    const children = childrenOf(node);
    if (
      visibleIds.has(id) &&
      isSilentPronominalDisplay(label, word || label) &&
      children.some((child) =>
        visibleIds.has(nodeId(child)) &&
        childrenOf(child).length === 0 &&
        isSilentPronominalDisplay(child?.label, child?.word || child?.label)
      )
    ) {
      fail(errors, scope, `renderer invented silent pronominal preterminal: ${id}`);
    }
    if (
      id.endsWith('::__null') &&
      visibleIds.has(id) &&
      parent &&
      childrenOf(parent).some((sibling) =>
        nodeId(sibling) !== id &&
        isSilentPronominalDisplay(sibling?.label, sibling?.word || sibling?.label)
      )
    ) {
      fail(errors, scope, `synthetic null is visible beside authored PRO: ${id}`);
    }
    children.forEach((child) => visit(child, node));
  };
  visit(payload?.replayCanvasData);
};

const assertNoBareTraceCategories = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const visit = (node, parent = null) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    const rawLabel = String(node?.label || '').trim();
    const surface = nodeLabel(node);
    const children = childrenOf(node);
    if (visibleIds.has(id) && isBareTraceCategoryLabel(rawLabel)) {
      if (children.length > 0) {
        fail(errors, scope, `trace is visible as a non-leaf category: ${id}`);
      }
      if (!parent || isBareTraceCategoryLabel(String(parent?.label || '').trim())) {
        fail(errors, scope, `trace leaf lacks syntactic parent: ${id}`);
      }
    } else if (visibleIds.has(id) && children.length === 0 && isTraceLike(surface)) {
      if (!parent || isBareTraceCategoryLabel(String(parent?.label || '').trim())) {
        fail(errors, scope, `trace leaf lacks syntactic parent: ${id}`);
      }
    }
    children.forEach((child) => visit(child, node));
  };
  visit(payload?.replayCanvasData);
};

const assertNoLexicalSelfPreterminals = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    const label = String(node?.label || '').trim();
    const labelToken = normalizeToken(label);
    const children = childrenOf(node);
    if (
      id
      && visibleIds.has(id)
      && labelToken
      && !isCategoryLike(label)
      && !isTraceLike(label)
      && !isNullLike(label)
    ) {
      children.forEach((child) => {
        const childId = nodeId(child);
        const childSurface = nodeLabel(child);
        if (
          visibleIds.has(childId)
          && childrenOf(child).length === 0
          && normalizeToken(childSurface) === labelToken
        ) {
          fail(errors, scope, `renderer invented lexical self-preterminal: ${id} -> ${childId}`);
        }
      });
    }
    children.forEach(visit);
  };
  visit(payload?.replayCanvasData);
};

const assertNoDuplicateTerminalSiblings = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const parentId = nodeId(node);
    const visibleTerminalChildren = childrenOf(node).filter((child) =>
      visibleIds.has(nodeId(child))
      && childrenOf(child).length === 0
    );
    const traceChildren = visibleTerminalChildren.filter((child) => isTraceLike(nodeLabel(child)));
    if (traceChildren.length > 1) {
      fail(
        errors,
        scope,
        `visible terminal trace siblings under ${parentId || String(node?.label || '').trim()}: ${traceChildren.map(nodeId).join(', ')}`
      );
    }
    const terminalIdentityCounts = new Map();
    visibleTerminalChildren.forEach((child) => {
      const surface = normalizeToken(nodeLabel(child));
      const id = nodeId(child);
      if (!surface && !id) return;
      const key = `${surface || 'terminal'}|${id || 'no-id'}`;
      terminalIdentityCounts.set(key, (terminalIdentityCounts.get(key) || 0) + 1);
    });
    terminalIdentityCounts.forEach((count, key) => {
      if (count > 1) {
        fail(
          errors,
          scope,
          `duplicate visible terminal sibling under ${parentId || String(node?.label || '').trim()}: ${key}`
        );
      }
    });
    const hasOvertChild = visibleTerminalChildren.some((child) => {
      const surface = nodeLabel(child);
      return surface && !isTraceLike(surface) && !isNullLike(surface) && !isCategoryLike(surface);
    });
    const overtChildren = visibleTerminalChildren.filter((child) => {
      const surface = nodeLabel(child);
      return surface && !isTraceLike(surface) && !isNullLike(surface) && !isCategoryLike(surface);
    });
    if (traceChildren.length > 0 && overtChildren.length > 0) {
      fail(
        errors,
        scope,
        `visible trace terminal beside overt terminal under ${parentId || String(node?.label || '').trim()}: ${traceChildren.map(nodeId).join(', ')}`
      );
    }
    const nullChildren = visibleTerminalChildren.filter((child) => isNullLike(nodeLabel(child)));
    if (hasOvertChild && nullChildren.length > 0) {
      fail(
        errors,
        scope,
        `visible null terminal beside overt terminal under ${parentId || String(node?.label || '').trim()}: ${nullChildren.map(nodeId).join(', ')}`
      );
    }
    if (traceChildren.length > 0 && nullChildren.length > 0) {
      fail(
        errors,
        scope,
        `visible null terminal beside trace terminal under ${parentId || String(node?.label || '').trim()}: ${nullChildren.map(nodeId).join(', ')}`
      );
    }
    childrenOf(node).forEach(visit);
  };
  visit(payload?.replayCanvasData);
};

const assertNoUnwrappedNullTerminalSiblings = (errors, scope, payload) => {
  const visibleIds = collectVisibleNodeSet(payload);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const parentId = nodeId(node);
    if (!parentId || !visibleIds.has(parentId)) {
      childrenOf(node).forEach(visit);
      return;
    }
    const children = childrenOf(node);
    const visibleNullTerminals = children.filter((child) =>
      visibleIds.has(nodeId(child))
      && childrenOf(child).length === 0
      && isNullLike(nodeLabel(child))
    );
    if (visibleNullTerminals.length === 0) {
      children.forEach(visit);
      return;
    }
    const hasVisibleNonterminalSibling = children.some((child) => {
      const childId = nodeId(child);
      return childId
        && visibleIds.has(childId)
        && child?.replayLayoutOnly !== true
        && childrenOf(child).length > 0;
    });
    if (hasVisibleNonterminalSibling) {
      fail(
        errors,
        scope,
        `visible unwrapped null terminal beside structural sibling under ${parentId}: ${visibleNullTerminals.map(nodeId).join(', ')}`
      );
    }
    children.forEach(visit);
  };
  visit(payload?.replayCanvasData);
};

const assertNoLayoutOnlyMacroRoot = (errors, scope, payload) => {
  const operation = String(payload?.operation || '').trim();
  const isMacro = payload?.replayKind === 'macro' || MACRO_OPERATION_RE.test(operation);
  const root = payload?.replayCanvasData;
  if (!isMacro || !root || typeof root !== 'object') return;
  const rootLabel = String(root?.label || '').trim();
  if (rootLabel === '__DERIVATION_WORKSPACE__') return;
  if (root?.replayLayoutOnly === true) {
    fail(errors, scope, `macro root is hidden as layout-only: ${nodeId(root) || rootLabel}`);
  }
};

const directChildIds = (node) =>
  childrenOf(node)
    .map((child) => nodeId(child))
    .filter(Boolean);

const subtreeIds = (node) => {
  const ids = [];
  const visit = (current) => {
    if (!current || typeof current !== 'object') return;
    const id = nodeId(current);
    if (id) ids.push(id);
    childrenOf(current).forEach(visit);
  };
  visit(node);
  return ids;
};

const subtreeWasVisible = (node, visibleIds) =>
  subtreeIds(node).some((id) => visibleIds.has(id));

const subtreeIsOnlySilentTraceOrNull = (node) => {
  if (!node || typeof node !== 'object') return false;
  const children = childrenOf(node);
  if (children.length > 0) {
    return children.every((child) => subtreeIsOnlySilentTraceOrNull(child));
  }
  const surface = nodeLabel(node);
  return Boolean(node?.silent === true || isTraceLike(surface) || isNullLike(surface));
};

const collectNodesById = (root) => {
  const byId = new Map();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const id = nodeId(node);
    if (id) byId.set(id, node);
    childrenOf(node).forEach(visit);
  };
  visit(root);
  return byId;
};

const stripReplayNamespaceSuffix = (value) =>
  String(value || '').trim().replace(/::__[^:]+$/, '');

const collectTerminalSurfaces = (node, surfaces = []) => {
  if (!node || typeof node !== 'object') return surfaces;
  const children = childrenOf(node);
  if (children.length === 0) {
    const surface = String(node.word || node.label || '').trim();
    if (surface) surfaces.push(surface);
    return surfaces;
  }
  children.forEach((child) => collectTerminalSurfaces(child, surfaces));
  return surfaces;
};

const collectForestNodesById = (forest) => {
  const byId = new Map();
  (Array.isArray(forest) ? forest : []).forEach((root) => {
    collectNodesById(root).forEach((node, id) => byId.set(id, node));
  });
  return byId;
};

const assertNoStableChildOrderTeleport = (errors, dirName, steps) => {
  let previousNodes = new Map();
  steps.forEach((entry, index) => {
    const payload = entry?.payload || {};
    const currentNodes = collectNodesById(payload?.replayCanvasData);
    if (index > 0) {
      currentNodes.forEach((node, id) => {
        const previousNode = previousNodes.get(id);
        if (!previousNode) return;
        const previousChildren = directChildIds(previousNode);
        const currentChildren = directChildIds(node);
        if (previousChildren.length < 2 || previousChildren.length !== currentChildren.length) return;
        const currentSet = new Set(currentChildren);
        if (!previousChildren.every((childId) => currentSet.has(childId))) return;
        if (previousChildren.join('|') !== currentChildren.join('|')) {
          const allChildrenSilentOrNull = [...previousChildren, ...currentChildren]
            .map((childId) => previousNodes.get(childId) || currentNodes.get(childId))
            .filter(Boolean)
            .every((child) => subtreeIsOnlySilentTraceOrNull(child));
          if (allChildrenSilentOrNull) return;
          fail(
            errors,
            `${dirName} frame ${index + 1}`,
            `stable child order changed for ${id}: ${previousChildren.join(',')} -> ${currentChildren.join(',')}`
          );
        }
      });
    }
    previousNodes = currentNodes;
  });
};

const assertNoSilentSubtreeDrops = (errors, dirName, steps) => {
  let previousNodes = new Map();
  let previousVisibleIds = new Set();
  steps.forEach((entry, index) => {
    const payload = entry?.payload || {};
    const currentNodes = collectNodesById(payload?.replayCanvasData);
    const currentNodeIds = new Set(currentNodes.keys());
    const currentNormalizedNodeIds = new Set(
      Array.from(currentNodes.keys()).map((id) => stripReplayNamespaceSuffix(id))
    );
    const currentTerminalSurfaces = new Set(collectTerminalSurfaces(payload?.replayCanvasData));
    if (index > 0) {
      currentNodes.forEach((currentParent, parentId) => {
        const previousParent = previousNodes.get(parentId);
        if (!previousParent) return;
        const currentChildren = childrenOf(currentParent);
        const currentChildIds = new Set(currentChildren.map((child) => nodeId(child)).filter(Boolean));
        childrenOf(previousParent).forEach((previousChild) => {
          const childId = nodeId(previousChild);
          if (!childId || currentChildIds.has(childId)) return;
          if (currentNodes.has(childId)) return;
          if (currentNodeIds.has(childId) || currentNormalizedNodeIds.has(childId)) return;
          const previousTerminalSurfaces = collectTerminalSurfaces(previousChild);
          if (
            previousTerminalSurfaces.length > 0
            && previousTerminalSurfaces.every((surface) => currentTerminalSurfaces.has(surface))
          ) {
            return;
          }
          if (childrenOf(previousChild).length === 0) return;
          if (!subtreeIsOnlySilentTraceOrNull(previousChild)) return;
          if (!subtreeWasVisible(previousChild, previousVisibleIds)) return;
          if (currentChildren.some((child) => subtreeIsOnlySilentTraceOrNull(child))) return;
          fail(
            errors,
            `${dirName} frame ${index + 1}`,
            `previously visible silent/trace subtree disappeared from ${parentId}: ${childId}`
          );
        });
      });
    }
    previousNodes = currentNodes;
    previousVisibleIds = collectVisibleNodeSet(payload);
  });
};

const replayStageIndex = (payload) => {
  const label = String(payload?.replayProgressLabel || '').trim();
  const match = label.match(/\bStage\s+(\d+)\s*\/\s*\d+/i);
  if (!match) return -1;
  return Number(match[1]) - 1;
};

const assertRenderedChildOrderMatchesAuthoredStages = (errors, dirName, bundleWrapper, steps) => {
  const bundle = unwrapBundle(bundleWrapper);
  const analysis = Array.isArray(bundle?.analyses) ? bundle.analyses[0] : null;
  const stages = Array.isArray(analysis?.derivationStages) ? analysis.derivationStages : [];
  if (stages.length === 0) return;

  steps.forEach((entry, index) => {
    const payload = entry?.payload || {};
    const stageIndex = replayStageIndex(payload);
    const stage = stages[stageIndex];
    if (!stage || !Array.isArray(stage.workspaceForest)) return;
    const authoredNodes = collectForestNodesById(stage.workspaceForest);
    const renderedNodes = collectNodesById(payload?.replayCanvasData);

    renderedNodes.forEach((renderedNode, id) => {
      const authoredNode = authoredNodes.get(id);
      if (!authoredNode) return;
      const authoredChildren = directChildIds(authoredNode);
      const renderedChildren = directChildIds(renderedNode);
      if (authoredChildren.length < 2 || authoredChildren.length !== renderedChildren.length) return;
      const renderedSet = new Set(renderedChildren);
      if (!authoredChildren.every((childId) => renderedSet.has(childId))) return;
      if (authoredChildren.join('|') !== renderedChildren.join('|')) {
        fail(
          errors,
          `${dirName} frame ${index + 1}`,
          `rendered child order differs from authored stage for ${id}: authored ${authoredChildren.join(',')} rendered ${renderedChildren.join(',')}`
        );
      }
    });
  });
};

const assertNoTokenDrops = (errors, dirName, steps) => {
  let previous = new Map();
  steps.forEach((entry, index) => {
    const current = visibleOvertTokenCounts(entry?.payload || {});
    for (const [token, previousCount] of previous.entries()) {
      const currentCount = current.get(token) || 0;
      if (currentCount < previousCount) {
        fail(errors, `${dirName} frame ${index + 1}`, `overt token disappeared: ${token} went from ${previousCount} to ${currentCount}`);
      }
    }
    previous = current;
  });
};

const assertFirstTokenAppearsOnSelection = (errors, dirName, steps) => {
  const seen = new Set();
  steps.forEach((entry, index) => {
    const payload = entry?.payload || {};
    const operation = String(payload.operation || payload.recipe || '').trim();
    const tokens = collectVisibleYield(payload.replayCanvasData, collectVisibleNodeSet(payload));
    tokens.forEach((token) => {
      if (seen.has(token)) return;
      seen.add(token);
      if (!FIRST_APPEARANCE_OK_RE.test(operation)) {
        fail(errors, `${dirName} frame ${index + 1}`, `new overt token "${token}" first appears on non-selection/non-movement operation "${operation}"`);
      }
    });
  });
};

const assertRelationLinksResolveAndPersist = (errors, dirName, steps) => {
  const introduced = new Map();
  const originalOvertCounts = new Map();

  steps.forEach((entry, index) => {
    const payload = entry?.payload || {};
    const byId = buildNodeMap(payload.replayCanvasData);
    const visibleIds = collectVisibleNodeSet(payload);
    const links = Array.isArray(payload.replayRelationLinks) ? payload.replayRelationLinks : [];

    links.forEach((link) => {
      const relation = String(link?.relation || '').trim() || 'relation';
      const key = relationKey(link);
      const renderableLink = isRenderableRelationLink(link);
      const source = String(link?.sourceNodeId || '').trim();
      const target = String(link?.targetNodeId || '').trim();
      const witness = String(link?.witnessNodeId || source).trim();
      const sourceNode = byId.get(source) || byId.get(baseId(source));
      const targetNode = byId.get(target) || byId.get(baseId(target));
      const witnessNode = byId.get(witness) || byId.get(baseId(witness));

      if (!source || !target) {
        fail(errors, `${dirName} frame ${index + 1}`, `${relation} link lacks source or target`);
      }
      if (renderableLink && source && !sourceNode) {
        fail(errors, `${dirName} frame ${index + 1}`, `${relation} source does not resolve: ${source}`);
      }
      if (renderableLink && target && !targetNode) {
        fail(errors, `${dirName} frame ${index + 1}`, `${relation} target does not resolve: ${target}`);
      }
      if (renderableLink && sourceNode?.replayLayoutOnly === true) {
        fail(errors, `${dirName} frame ${index + 1}`, `${relation} source is layout-only: ${source}`);
      }
      if (renderableLink && targetNode?.replayLayoutOnly === true) {
        fail(errors, `${dirName} frame ${index + 1}`, `${relation} target is layout-only: ${target}`);
      }
      if (renderableLink && source && target && source === target) {
        fail(errors, `${dirName} frame ${index + 1}`, `${relation} source and target are identical: ${source}`);
      }

      if (key && !introduced.has(key)) introduced.set(key, index);

      if (!renderableLink) return;

      if (sourceNode && !originalOvertCounts.has(source)) {
        const overtCount = countOvertLeaves(sourceNode, visibleIds);
        if (overtCount > 0) originalOvertCounts.set(source, overtCount);
      }
      const originalOvertCount = originalOvertCounts.get(source);
      if (originalOvertCount === 1 && witnessNode) {
        const traceCount = countTraceLeaves(witnessNode, visibleIds);
        if (traceCount > 1) {
          fail(errors, `${dirName} frame ${index + 1}`, `${relation} single-item source has ${traceCount} visible traces`);
        }
      }
    });

    for (const [key, firstIndex] of introduced.entries()) {
      if (index <= firstIndex) continue;
      const stillPresent = links.some((link) => relationKey(link) === key);
      if (!stillPresent) {
        fail(errors, `${dirName} frame ${index + 1}`, `relation link disappeared after being introduced: ${key}`);
      }
    }
  });
};

const assertNoAdjacentNoopMicroFrames = (errors, dirName, steps) => {
  let previous = null;
  steps.forEach((entry, index) => {
    const payload = entry?.payload || {};
    const signature = visibleTreeSignature(payload);
    const operation = String(payload.operation || '').trim();
    const isMacro = MACRO_OPERATION_RE.test(operation) || payload.replayKind === 'macro';
    if (previous && previous.signature === signature && !previous.isMacro && !isMacro) {
      fail(errors, `${dirName} frame ${index + 1}`, `adjacent non-macro frame has no visible replay change after ${previous.operation || 'unknown operation'}`);
    }
    previous = { signature, isMacro, operation };
  });
};

const assertFinalYieldMatchesAnalysis = (errors, dirName, bundleWrapper, steps) => {
  const expected = expectedSurfaceTokens(bundleWrapper);
  const lastPayload = steps.at(-1)?.payload;
  const actual = collectVisibleYield(lastPayload?.replayCanvasData, collectVisibleNodeSet(lastPayload));
  if (expected.length === 0 || actual.length === 0) return;
  const expectedJoined = expected.join(' ');
  const actualJoined = actual.join(' ');
  if (actualJoined !== expectedJoined) {
    fail(errors, dirName, `final visible yield mismatch: expected "${expectedJoined}", got "${actualJoined}"`);
  }
};

const assertDerivationContract = (errors, dirName, bundleWrapper) => {
  const bundle = unwrapBundle(bundleWrapper);
  const analyses = Array.isArray(bundle?.analyses) ? bundle.analyses : [];
  if (analyses.length < 1) {
    fail(errors, dirName, 'bundle contains no analyses');
    return;
  }
  analyses.forEach((analysis, analysisIndex) => {
    const stages = Array.isArray(analysis?.derivationStages) ? analysis.derivationStages : [];
    stages.forEach((stage, stageIndex) => {
      ['statement', 'stageRecord', 'visualRelations', 'workspaceForest'].forEach((field) => {
        if (!(field in (stage || {}))) {
          fail(errors, dirName, `stage ${stageIndex + 1} missing ${field}`);
        }
      });
      if (!String(stage?.statement || '').trim()) {
        fail(errors, dirName, `stage ${stageIndex + 1} has empty statement`);
      }
      if (!String(stage?.stageRecord || '').trim()) {
        fail(errors, dirName, `stage ${stageIndex + 1} has empty stageRecord`);
      }
      if (!Array.isArray(stage?.visualRelations)) {
        fail(errors, dirName, `stage ${stageIndex + 1} visualRelations is not an array`);
      }
      if (!Array.isArray(stage?.workspaceForest) || stage.workspaceForest.length === 0) {
        fail(errors, dirName, `stage ${stageIndex + 1} workspaceForest is empty`);
      }
    });
  });
};

const verifyRenderDir = (renderDir) => {
  const errors = [];
  const dirName = path.normalize(renderDir);
  const summaryPath = path.join(renderDir, 'render-summary.json');
  const payloadPath = path.join(renderDir, 'replay-payloads.json');
  if (!fs.existsSync(summaryPath)) fail(errors, dirName, 'missing render-summary.json');
  if (!fs.existsSync(payloadPath)) fail(errors, dirName, 'missing replay-payloads.json');
  if (errors.length > 0) return errors;

  const summary = readJson(summaryPath);
  const steps = readJson(payloadPath);
  if (!Array.isArray(steps) || steps.length === 0) {
    fail(errors, dirName, 'replay-payloads.json is empty');
    return errors;
  }
  if (Number(summary.replayCount) !== steps.length) {
    fail(errors, dirName, `render-summary replayCount ${summary.replayCount} does not match payload count ${steps.length}`);
  }
  for (let index = 0; index < steps.length; index += 1) {
    const framePath = path.join(renderDir, `replay-${String(index).padStart(2, '0')}.png`);
    if (!fs.existsSync(framePath)) {
      fail(errors, dirName, `missing screenshot ${path.basename(framePath)}`);
    }
  }
  ['canopy.png', 'notes.png', 'replay-viewer.html'].forEach((fileName) => {
    if (!fs.existsSync(path.join(renderDir, fileName))) {
      fail(errors, dirName, `missing ${fileName}`);
    }
  });

  steps.forEach((entry, index) => {
    const scope = `${dirName} frame ${index + 1}`;
    assertVisibleNodesResolve(errors, scope, entry?.payload || {});
    assertVisibleAncestorClosure(errors, scope, entry?.payload || {});
    assertNoEmptyVisibleLeaves(errors, scope, entry?.payload || {});
    assertNoInventedSilentPronominalTerminals(errors, scope, entry?.payload || {});
    assertNoBareTraceCategories(errors, scope, entry?.payload || {});
    assertNoLexicalSelfPreterminals(errors, scope, entry?.payload || {});
    assertNoDuplicateTerminalSiblings(errors, scope, entry?.payload || {});
    assertNoUnwrappedNullTerminalSiblings(errors, scope, entry?.payload || {});
    assertNoLayoutOnlyMacroRoot(errors, scope, entry?.payload || {});
  });
  assertNoTokenDrops(errors, dirName, steps);
  assertFirstTokenAppearsOnSelection(errors, dirName, steps);
  assertRelationLinksResolveAndPersist(errors, dirName, steps);
  assertNoAdjacentNoopMicroFrames(errors, dirName, steps);
  assertNoStableChildOrderTeleport(errors, dirName, steps);
  assertNoSilentSubtreeDrops(errors, dirName, steps);

  const bundlePath = String(summary.bundle || '').trim();
  if (bundlePath && fs.existsSync(bundlePath)) {
    const bundle = readJson(bundlePath);
    assertDerivationContract(errors, dirName, bundle);
    assertRenderedChildOrderMatchesAuthoredStages(errors, dirName, bundle, steps);
    assertFinalYieldMatchesAnalysis(errors, dirName, bundle, steps);
  }

  return errors;
};

const inputs = process.argv.slice(2);
const renderDirs = inputs.length > 0 ? inputs : DEFAULT_RENDER_DIRS;
const allErrors = renderDirs.flatMap((dir) => verifyRenderDir(dir));

if (allErrors.length > 0) {
  console.error(`Replay regression verification failed with ${allErrors.length} issue(s):`);
  allErrors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Replay regression verification passed for ${renderDirs.length} render artifact(s).`);
