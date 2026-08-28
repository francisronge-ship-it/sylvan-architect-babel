import {
  stripLegacyCaseMetadataFromSyntaxForest
} from '../../legacyCaseMetadata.js';

export const createDerivationCompilerHelpers = ({
  ParseApiError,
  normalizeOptionalStepText,
  collectNodeReferencesById,
  collectOvertTerminalNodes,
  resolveNodeSurface,
  sameTokenSequence,
  deriveCanonicalSurfaceSpans
}) => {
  const REQUIRED_STAGE_FIELDS = Object.freeze([
    'statement',
    'stageRecord',
    'relations',
    'workspaceForest'
  ]);

  const cloneJson = (value) => {
    if (Array.isArray(value)) return value.map((item) => cloneJson(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneJson(item)])
    );
  };

  const recordValidationIssue = (validationIssues, issue) => {
    if (Array.isArray(validationIssues)) validationIssues.push(issue);
  };

  const throwMalformedWorkspace = (message) => {
    throw new ParseApiError('BAD_MODEL_RESPONSE', message, 502);
  };

  const isSubstantiveStageRecordText = (value) => Boolean(normalizeOptionalStepText(value));

  const normalizeRelations = (
    value,
    stageIndex,
    validationIssues
  ) => {
    if (!Array.isArray(value)) {
      recordValidationIssue(validationIssues, {
        failureClass: 'contract_misunderstanding',
        ruleId: 'DERIVATION_STAGE_RELATIONS_ARRAY',
        stageIndex,
        fieldPath: `$.derivationStages[${stageIndex}].relations`,
        offendingValue: value
      });
      return null;
    }

    const normalized = [];
    const isAnchorValue = (anchorValue) => (
      typeof anchorValue === 'string'
        ? Boolean(anchorValue.trim())
        : Array.isArray(anchorValue)
          && anchorValue.length > 0
          && anchorValue.every((item) => typeof item === 'string' && item.trim())
    );
    /*
     * `values` entries are verbatim authored literals: strings or non-empty
     * string arrays. Unlike anchors, an empty string is a legal literal.
     */
    const isValuesValue = (literal) => (
      typeof literal === 'string'
        ? true
        : Array.isArray(literal)
          && literal.length > 0
          && literal.every((item) => typeof item === 'string')
    );
    const isAnchorBlock = (block) => (
      Boolean(block)
      && typeof block === 'object'
      && !Array.isArray(block)
      && Object.entries(block).length > 0
      && Object.entries(block).every(([role, anchorValue]) => (
        role.trim() && isAnchorValue(anchorValue)
      ))
    );
    const RELATION_FIELDS = ['relation', 'anchors', 'priorAnchors', 'values'];
    for (let relationIndex = 0; relationIndex < value.length; relationIndex += 1) {
      const relation = value[relationIndex];
      const fieldPath = `$.derivationStages[${stageIndex}].relations[${relationIndex}]`;
      if (
        !relation
        || typeof relation !== 'object'
        || Array.isArray(relation)
        || Object.keys(relation).some((key) => !RELATION_FIELDS.includes(key))
        || !Object.hasOwn(relation, 'relation')
        || !Object.hasOwn(relation, 'anchors')
        || typeof relation.relation !== 'string'
        || !relation.relation.trim()
        || !isAnchorBlock(relation.anchors)
        || (Object.hasOwn(relation, 'priorAnchors') && !isAnchorBlock(relation.priorAnchors))
        || (Object.hasOwn(relation, 'values') && (
          !relation.values
          || typeof relation.values !== 'object'
          || Array.isArray(relation.values)
          || Object.entries(relation.values).length === 0
          || Object.entries(relation.values).some(([key, literal]) => (
            !key.trim() || !isValuesValue(literal)
          ))
        ))
      ) {
        recordValidationIssue(validationIssues, {
          failureClass: 'contract_misunderstanding',
          ruleId: 'DERIVATION_STAGE_RELATION_EXACT',
          stageIndex,
          fieldPath,
          offendingValue: relation
        });
        return null;
      }
      normalized.push(cloneJson(relation));
    }
    return normalized;
  };

  const normalizeDerivationStagesToDerivationFrames = (value, options = {}) => {
    const validationIssues = Array.isArray(options?.validationIssues)
      ? options.validationIssues
      : [];
    const integrityFlags = Array.isArray(options?.integrityFlags)
      ? options.integrityFlags
      : [];
    if (!Array.isArray(value)) {
      recordValidationIssue(validationIssues, {
        failureClass: 'contract_misunderstanding',
        ruleId: 'DERIVATION_STAGE_FIELDS_EXACT',
        stageIndex: null,
        fieldPath: '$.derivationStages',
        offendingValue: value
      });
      return [];
    }

    return value
      .map((rawStage, stageIndex) => {
        const stage = rawStage;
        const stageId = `d${stageIndex + 1}`;
        if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
          recordValidationIssue(validationIssues, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'DERIVATION_STAGE_OBJECT',
            stageIndex,
            fieldPath: `$.derivationStages[${stageIndex}]`,
            offendingValue: stage
          });
          return null;
        }

        const authoredFields = Object.keys(stage);
        if (
          authoredFields.length !== REQUIRED_STAGE_FIELDS.length
          || REQUIRED_STAGE_FIELDS.some((field) => !Object.hasOwn(stage, field))
        ) {
          integrityFlags.push(`derivation_stage_contract_fields_invalid:${stageId}`);
          recordValidationIssue(validationIssues, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'DERIVATION_STAGE_FIELDS_EXACT',
            stageIndex,
            fieldPath: `$.derivationStages[${stageIndex}]`,
            offendingValue: stage
          });
          return null;
        }

        if (typeof stage.statement !== 'string' || !stage.statement.trim()) {
          integrityFlags.push(`statement_missing_on_derivation_stage:${stageId}`);
          recordValidationIssue(validationIssues, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'DERIVATION_STAGE_STATEMENT_NONEMPTY',
            stageIndex,
            fieldPath: `$.derivationStages[${stageIndex}].statement`,
            offendingValue: stage.statement
          });
          return null;
        }

        if (!isSubstantiveStageRecordText(stage.stageRecord)) {
          integrityFlags.push(`stage_record_missing:${stageId}`);
          recordValidationIssue(validationIssues, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'DERIVATION_STAGE_RECORD_NONEMPTY',
            stageIndex,
            fieldPath: `$.derivationStages[${stageIndex}].stageRecord`,
            offendingValue: stage.stageRecord
          });
          return null;
        }

        const relations = normalizeRelations(
          stage.relations,
          stageIndex,
          validationIssues
        );
        if (!relations) return null;

        if (typeof stage.workspaceForest === 'undefined') {
          integrityFlags.push(`workspace_forest_missing_on_derivation_stage:${stageId}`);
          recordValidationIssue(validationIssues, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'DERIVATION_STAGE_WORKSPACE_FOREST_PRESENT',
            stageIndex,
            fieldPath: `$.derivationStages[${stageIndex}].workspaceForest`,
            offendingValue: stage.workspaceForest
          });
          return null;
        }

        return {
          frameId: stageId,
          stepId: stageId,
          after: {
            workspaceForest: stripLegacyCaseMetadataFromSyntaxForest(
              cloneJson(stage.workspaceForest)
            )
          },
          change: {
            statement: stage.statement,
            details: {
              stageRecord: stage.stageRecord,
              derivationStageRelations: relations,
              derivationStageRelationsContract: true
            }
          }
        };
      })
      .filter(Boolean);
  };

  const expandWorkspaceForest = (
    value,
    priorNodes,
    stageIndex,
    integrityFlags
  ) => {
    if (!Array.isArray(value)) {
      throwMalformedWorkspace(
        `Malformed workspaceForest at derivation stage ${stageIndex + 1}: expected an array.`
      );
    }

    const stageNodeIds = new Set();
    const resolvingRefIds = new Set();

    const expandNode = (rawNode, path) => {
      if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
        throwMalformedWorkspace(`Malformed syntax node at ${path}: expected an object.`);
      }

      if (Object.hasOwn(rawNode, 'refId')) {
        if (
          Object.keys(rawNode).length !== 1
          || typeof rawNode.refId !== 'string'
          || !rawNode.refId.trim()
        ) {
          throwMalformedWorkspace(
            `Malformed syntax node at ${path}: refId objects must contain exactly one non-empty refId.`
          );
        }
        const refId = rawNode.refId.trim();
        const referencedNode = priorNodes.get(refId);
        if (!referencedNode) {
          throwMalformedWorkspace(
            `Malformed syntax node at ${path} (unresolved prior-stage refId: ${refId}).`
          );
        }
        if (resolvingRefIds.has(refId)) {
          throwMalformedWorkspace(
            `Malformed syntax node at ${path} (cyclic prior-stage refId: ${refId}).`
          );
        }
        resolvingRefIds.add(refId);
        try {
          integrityFlags.push(`prior_stage_refid_expanded:${stageIndex + 1}:${refId}`);
          return expandNode(cloneJson(referencedNode), `${path}<${refId}>`);
        } finally {
          resolvingRefIds.delete(refId);
        }
      }

      if (
        typeof rawNode.id !== 'string'
        || !rawNode.id.trim()
        || typeof rawNode.label !== 'string'
        || !rawNode.label.trim()
        || !Array.isArray(rawNode.children)
      ) {
        throwMalformedWorkspace(
          `Malformed syntax node at ${path}: complete nodes require non-empty id, non-empty label, and children.`
        );
      }

      const nodeId = rawNode.id.trim();
      if (stageNodeIds.has(nodeId)) {
        throwMalformedWorkspace(
          `Malformed workspaceForest at derivation stage ${stageIndex + 1}: duplicate active node id ${nodeId}.`
        );
      }
      stageNodeIds.add(nodeId);

      return {
        ...cloneJson(rawNode),
        children: rawNode.children.map((child, childIndex) => (
          expandNode(child, `${path}.children[${childIndex}]`)
        ))
      };
    };

    return value.map((root, rootIndex) => (
      expandNode(root, `derivationStages[${stageIndex}].workspaceForest[${rootIndex}]`)
    ));
  };

  const normalizeDerivationFrames = (value, options = {}) => {
    if (!Array.isArray(value)) return [];
    const integrityFlags = Array.isArray(options?.integrityFlags)
      ? options.integrityFlags
      : [];
    const priorNodes = new Map();

    return value.map((frame, stageIndex) => {
      const rawForest = frame?.after?.workspaceForest;
      const workspaceForest = expandWorkspaceForest(
        rawForest,
        priorNodes,
        stageIndex,
        integrityFlags
      );
      collectNodeReferencesById(workspaceForest).forEach((node, nodeId) => {
        priorNodes.set(nodeId, cloneJson(node));
      });
      return {
        ...frame,
        after: {
          ...(frame?.after || {}),
          workspaceForest
        }
      };
    });
  };

  const getFrameWorkspaceForest = (frame) => (
    Array.isArray(frame?.after?.workspaceForest)
      ? frame.after.workspaceForest
      : []
  );

  const canonicalizeDerivationRootCandidateForSentence = (root, sentenceTokens = []) => {
    if (!root || typeof root !== 'object' || !Array.isArray(sentenceTokens) || sentenceTokens.length === 0) {
      return null;
    }
    const candidate = cloneJson(root);
    try {
      const nodesById = collectNodeReferencesById(candidate);
      const authoredTechnicalFields = new Map(
        Array.from(nodesById, ([nodeId, node]) => [
          nodeId,
          {
            hasSurfaceSpan: Object.hasOwn(node, 'surfaceSpan'),
            hasTokenIndex: Object.hasOwn(node, 'tokenIndex'),
            surfaceSpan: cloneJson(node.surfaceSpan),
            tokenIndex: node.tokenIndex
          }
        ])
      );
      const overtTerminals = collectOvertTerminalNodes(candidate);
      const overtTerminalIds = new Set(
        overtTerminals.map((node) => String(node.id || '').trim())
      );
      const overtSurfaces = overtTerminals
        .map((node) => resolveNodeSurface(node))
        .map((token) => String(token || '').trim())
        .filter(Boolean);
      if (!sameTokenSequence(overtSurfaces, sentenceTokens)) return null;

      nodesById.forEach((node, nodeId) => {
        if (
          !overtTerminalIds.has(nodeId)
          && Object.hasOwn(node, 'tokenIndex')
        ) {
          throw new Error('Non-overt nodes cannot carry tokenIndex.');
        }
      });
      overtTerminals.forEach((node, tokenIndex) => {
        if (
          Object.hasOwn(node, 'tokenIndex')
          && node.tokenIndex !== tokenIndex
        ) {
          throw new Error('Authored tokenIndex does not match surface order.');
        }
        node.tokenIndex = tokenIndex;
      });
      deriveCanonicalSurfaceSpans(candidate);
      collectNodeReferencesById(candidate).forEach((node, nodeId) => {
        const authored = authoredTechnicalFields.get(nodeId);
        if (!authored) return;
        if (
          authored.hasTokenIndex
          && authored.tokenIndex !== node.tokenIndex
        ) {
          throw new Error('Authored tokenIndex changed during alignment.');
        }
        if (
          authored.hasSurfaceSpan
          && JSON.stringify(authored.surfaceSpan) !== JSON.stringify(node.surfaceSpan)
        ) {
          throw new Error('Authored surfaceSpan changed during alignment.');
        }
      });
    } catch {
      return null;
    }
    const overtTerminals = collectOvertTerminalNodes(candidate)
      .map((node) => resolveNodeSurface(node))
      .map((token) => String(token || '').trim())
      .filter(Boolean);
    return sameTokenSequence(overtTerminals, sentenceTokens) ? candidate : null;
  };

  const selectCommittedDerivationRoot = (workspaceForest, sentenceTokens = []) => {
    if (!Array.isArray(workspaceForest) || workspaceForest.length === 0) return null;
    const candidates = workspaceForest
      .map((root) => canonicalizeDerivationRootCandidateForSentence(root, sentenceTokens))
      .filter(Boolean);
    return candidates.length === 1 ? candidates[0] : null;
  };

  const findCommittedFinalDerivationFrame = (derivationFrames, sentenceTokens = []) => {
    if (!Array.isArray(derivationFrames) || derivationFrames.length === 0) return null;
    const frameIndex = derivationFrames.length - 1;
    const frame = derivationFrames[frameIndex];
    const root = selectCommittedDerivationRoot(
      getFrameWorkspaceForest(frame),
      sentenceTokens
    );
    return root ? { frame, frameIndex, root } : null;
  };

  const buildCanonicalDerivationFromDerivationFrames = (
    derivationFrames,
    sentenceTokens = []
  ) => {
    const committedFrame = findCommittedFinalDerivationFrame(
      derivationFrames,
      sentenceTokens
    );
    if (!committedFrame?.root) return null;
    const pronouncedTerminals = collectOvertTerminalNodes(committedFrame.root)
      .map((node) => resolveNodeSurface(node))
      .map((token) => String(token || '').trim())
      .filter(Boolean);
    if (!sameTokenSequence(pronouncedTerminals, sentenceTokens)) return null;

    return {
      tree: committedFrame.root,
      derivationSteps: []
    };
  };

  return {
    normalizeDerivationStagesToDerivationFrames,
    normalizeDerivationFrames,
    canonicalizeDerivationRootCandidateForSentence,
    selectCommittedDerivationRoot,
    findCommittedFinalDerivationFrame,
    buildCanonicalDerivationFromDerivationFrames
  };
};
