export const createSemanticValidationHelpers = ({
  ParseApiError,
  buildNodeIndexFromTree,
  collectOvertTerminalNodes,
  subtreeContainsNamedCovertCategoryLeaf
}) => {
  const validatePronouncedCopiesAgainstCommittedTree = ({
    chains = [],
    tree = null,
    visualRelationEvents = []
  }) => {
    if (!tree || !Array.isArray(chains) || chains.length === 0) return;
    const nodeById = buildNodeIndexFromTree(tree);
    const laterMovedCopyIds = new Set(
      (Array.isArray(visualRelationEvents) ? visualRelationEvents : [])
        .flatMap((event) => [String(event?.fromNodeId || '').trim(), String(event?.traceNodeId || '').trim()])
        .filter(Boolean)
    );
    for (const chain of chains) {
      const pronouncedCopyId = String(chain?.pronouncedCopy || '').trim();
      if (!pronouncedCopyId) continue;
      if (laterMovedCopyIds.has(pronouncedCopyId)) continue;
      const copies = Array.isArray(chain?.copies)
        ? chain.copies.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      const silentCopies = Array.isArray(chain?.silentCopies)
        ? chain.silentCopies.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      const distinctOtherCopies = copies.filter((copyId) => copyId && copyId !== pronouncedCopyId);
      const encodesCommittedCopyContrast = silentCopies.length > 0 || distinctOtherCopies.length > 0;
      if (!encodesCommittedCopyContrast) continue;
      const pronouncedNode = nodeById.get(pronouncedCopyId);
      if (!pronouncedNode) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          `Chain ${chain?.chainId || pronouncedCopyId} marks ${pronouncedCopyId} as the pronounced copy, but that copy does not exist in the committed tree.`,
          502
        );
      }
      const overtLeaves = collectOvertTerminalNodes(pronouncedNode);
      if (overtLeaves.length > 0) continue;
      if (subtreeContainsNamedCovertCategoryLeaf(pronouncedNode)) continue;
      throw new ParseApiError(
        'BAD_MODEL_RESPONSE',
        `Chain ${chain?.chainId || pronouncedCopyId} marks ${pronouncedCopyId} as the pronounced copy, but the committed tree leaves that copy silent.`,
        502
      );
    }
  };

  const runSemanticValidation = (label, validator) => {
    try {
      validator();
    } catch (error) {
      if (error instanceof ParseApiError && error.code === 'BAD_MODEL_RESPONSE') {
        const prefix = String(label || '').trim();
        const message = String(error.message || '').trim() || 'Semantic validation warning.';
        const warning = prefix ? `${prefix}: ${message}` : message;
        if (warning) console.warn(`[Babel semantic validation softened in production] ${warning}`);
        return;
      }
      throw error;
    }
  };

  return {
    validatePronouncedCopiesAgainstCommittedTree,
    runSemanticValidation
  };
};
