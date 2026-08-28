export const createDerivationHelpers = ({
  STRUCTURAL_LEAF_LABELS,
  PRIME_CATEGORY_LABEL_RE,
  canonicalizeCovertSurface
}) => {
  const TRACE_LIKE_SURFACE_RE = /^(?:t|trace|copy|t\d+|trace\d+|copy\d+|(?:t|trace|copy)(?:_[a-z0-9]+)+|[a-z]+_(?:trace|copy)(?:_[a-z0-9]+)*|<[^>]+>|⟨[^⟩]+⟩|\(t\)|\{t\}|\(copy\)|\{copy\})$/i;
  const NULL_LIKE_SURFACE_RE = /^(?:∅|Ø|ε|null|epsilon|pro)(?:[_-][a-z0-9]+)*$/i;
  const ABSTRACT_FEATURE_SURFACE_RE = /^(?:past|present|pres|future|fut|finite|nonfinite|infinitive|inf|perfect|perf|progressive|prog|passive|active|nom(?:inative)?|acc(?:usative)?|dat(?:ive)?|gen(?:itive)?|erg(?:ative)?|abs(?:olutive)?|epp|phi|wh|focus|topic|tense|agreement|agr)$/i;

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

  const isStructuralLeafLabel = (label) => {
    const raw = String(label || '').trim();
    if (!raw || !STRUCTURAL_LEAF_LABELS.has(raw.toLowerCase())) return false;
    return raw === raw.toUpperCase()
      || /^[A-Z]/.test(raw)
      || PRIME_CATEGORY_LABEL_RE.test(raw);
  };

  const traceLikeNodeType = (node) => {
    const rawType = String(node?.type || '').trim().toLowerCase();
    if (
      rawType === 'trace'
      || rawType.includes('trace')
      || rawType === 'lower-copy'
      || rawType === 'lower_copy'
      || rawType === 'silent-copy'
      || rawType === 'silent_copy'
    ) {
      return rawType;
    }
    return '';
  };

  const normalizeTraceLikeSurface = (surface) => (
    String(surface || '')
      .trim()
      .replace(/\{([^}]*)\}/g, '$1')
  );

  const isTraceLikeSurface = (surface) => {
    const raw = String(surface || '').trim();
    if (!raw) return false;
    return TRACE_LIKE_SURFACE_RE.test(raw)
      || TRACE_LIKE_SURFACE_RE.test(normalizeTraceLikeSurface(raw));
  };

  const isNullLikeSurface = (surface) => (
    NULL_LIKE_SURFACE_RE.test(String(surface || '').trim())
  );

  const resolveNodeSurface = (node) => {
    const word = String(node?.word || '').trim();
    const label = String(node?.label || '').trim();
    return canonicalizeCovertSurface(word || label);
  };

  const isTraceLikeNode = (node) => (
    Boolean(traceLikeNodeType(node))
    || isTraceLikeSurface(resolveNodeSurface(node))
  );

  const isNullLikeNode = (node) => (
    isNullLikeSurface(resolveNodeSurface(node))
  );

  const resolveOvertLeafSurface = (node) => {
    if (node?.silentFeature === true || node?.silent === true || traceLikeNodeType(node)) {
      return '';
    }
    const word = String(node?.word || '').trim();
    if (word) return word;
    const children = Array.isArray(node?.children) ? node.children : [];
    if (children.length > 0) return '';
    const label = String(node?.label || '').trim();
    if (!label || isStructuralLeafLabel(label)) return '';
    return label;
  };

  const normalizeAbstractFeatureSurface = (surface) => (
    String(surface || '')
      .trim()
      .replace(/^[\[\(\{<⟨]+|[\]\)\}>⟩]+$/g, '')
      .replace(/^[+-]+/, '')
      .trim()
      .toLowerCase()
  );

  const isAbstractFeatureSurface = (surface) => {
    const raw = String(surface || '').trim();
    if (!raw) return false;
    const normalized = normalizeAbstractFeatureSurface(raw);
    return normalized === 'fin'
      || normalized === 'nfin'
      || normalized === 'nonfin'
      || ABSTRACT_FEATURE_SURFACE_RE.test(normalized);
  };

  const normalizeMovementLabelKey = (label) => (
    String(label || '')
      .trim()
      .replace(/[_\s,.-]+/g, '')
      .toLowerCase()
  );

  return {
    isAbstractFeatureSurface,
    buildNodeIndexFromTree,
    buildParentIndexFromTree,
    collectLeafNodes,
    resolveNodeSurface,
    resolveOvertLeafSurface,
    isTraceLikeSurface,
    isNullLikeSurface,
    isTraceLikeNode,
    isNullLikeNode,
    normalizeMovementLabelKey
  };
};
