import { withFailureDetails } from './validationErrors.js';

export const createParseNormalizationHelpers = ({
  ParseApiError,
  normalizeOptionalStepText,
  tokenizeSentenceSurfaceOrder,
  normalizeDerivationStagesToDerivationFrames,
  normalizeDerivationFrames,
  buildCanonicalDerivationFromDerivationFrames,
  collectNodeReferencesById,
  sameTokenSequence,
  collectOvertTerminalNodes,
  resolveNodeSurface
}) => {
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

  const getFrameChange = (frame) => (
    frame?.change && typeof frame.change === 'object' && !Array.isArray(frame.change)
      ? frame.change
      : null
  );

  const resolveVisualRelationAnchors = (anchors, frameNodeById) => (
    Object.entries(anchors).flatMap(([role, rawValue]) => {
      const nodeIds = Array.isArray(rawValue) ? rawValue : [rawValue];
      return nodeIds.map((nodeId) => {
        const node = frameNodeById.get(nodeId);
        return {
          role,
          nodeId,
          value: nodeId,
          ...(node?.label ? { label: String(node.label) } : {}),
          resolved: Boolean(node),
          visibleInStage: Boolean(node)
        };
      });
    })
  );

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
      const stageId = String(frame?.stepId || frame?.frameId || `d${frameIndex + 1}`);
      const evidence = details.stageRecord || change?.statement;

      visualRelations.forEach((visualRelation, relationIndex) => {
        const relation = visualRelation.relation;
        const anchors = resolveVisualRelationAnchors(
          visualRelation.anchors,
          frameNodeById
        );
        const hasUnresolvedAnchors = anchors.some((anchor) => !anchor.resolved);
        resolvedRelations.push({
          relationId: `${stageId}:visualRelation:${relationIndex + 1}`,
          stageId,
          stageIndex: frameIndex,
          relation,
          anchors,
          renderFamily: 'unknown',
          renderable: false,
          renderStatus: hasUnresolvedAnchors
            ? 'anchors-unresolved'
            : 'anchors-resolved-not-rendered',
          ...(evidence ? { evidence } : {})
        });
      });
    });
    return resolvedRelations;
  };

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
      throw new ParseApiError(
        'BAD_MODEL_RESPONSE',
        'The analysis must be a JSON object.',
        502,
        withFailureDetails({}, {
          failureClass: 'contract_misunderstanding',
          ruleId: 'ANALYSIS_OBJECT',
          fieldPath: '$',
          offendingValue: parsed
        })
      );
    }
    const payloadIntegrityFlags = Array.isArray(options?.payloadIntegrityFlags)
      ? options.payloadIntegrityFlags.slice()
      : [];
    const validationIssues = [];
    const sentenceTokens = tokenizeSentenceSurfaceOrder(sentence);
    const rawDerivationStages = parsed.derivationStages;
    const rawDerivationStageCount = Array.isArray(rawDerivationStages) ? rawDerivationStages.length : 0;
    const usesDerivationStages = rawDerivationStageCount > 0;
    const rawDerivationFrames = normalizeDerivationStagesToDerivationFrames(rawDerivationStages, {
      integrityFlags: payloadIntegrityFlags,
      validationIssues
    });
    if (usesDerivationStages) {
      payloadIntegrityFlags.push('derivation_stages_compiled_to_derivation_frames');
    }
    const derivationFrames = normalizeDerivationFrames(
      rawDerivationFrames,
      { integrityFlags: payloadIntegrityFlags }
    );
    const derivationPrimaryBundle = derivationFrames.length > 0
      ? buildCanonicalDerivationFromDerivationFrames(derivationFrames, sentenceTokens)
      : null;
    if (!derivationPrimaryBundle?.tree) {
      const validationIssue = validationIssues[0];
      if (validationIssue) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          `Model output violated ${validationIssue.ruleId}.`,
          502,
          withFailureDetails({}, validationIssue)
        );
      }
      const finalFrame = derivationFrames[derivationFrames.length - 1];
      const finalForest = Array.isArray(finalFrame?.after?.workspaceForest)
        ? finalFrame.after.workspaceForest
        : [];
      const observedRootSurfaceOrders = finalForest.map((root) => (
        collectOvertTerminalNodes(root)
          .map((node) => resolveNodeSurface(node))
          .map((token) => String(token || '').trim())
          .filter(Boolean)
      ));
      const flattenedSurfaceOrder = observedRootSurfaceOrders.flat();
      const hasExactRootSurface = observedRootSurfaceOrders.some((surfaceOrder) => (
        sameTokenSequence(surfaceOrder, sentenceTokens)
      ));
      const incompleteWorkspaceCouldStillSpellOut = (
        finalForest.length > 1
        && sameTokenSequence(flattenedSurfaceOrder, sentenceTokens)
      );
      if (
        observedRootSurfaceOrders.length > 0
        && !hasExactRootSurface
        && !incompleteWorkspaceCouldStillSpellOut
      ) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'No authored tree overt terminals match the input sentence order.',
          502,
          withFailureDetails({}, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'SURFACE_ORDER_EXACT',
            stageIndex: rawDerivationStageCount > 0 ? rawDerivationStageCount - 1 : null,
            fieldPath: rawDerivationStageCount > 0
              ? `$.derivationStages[${rawDerivationStageCount - 1}].workspaceForest`
              : '$.derivationStages',
            offendingValue: {
              expectedSurfaceOrder: sentenceTokens,
              observedRootSurfaceOrders
            }
          })
        );
      }
      throw new ParseApiError(
        'INCOMPLETE_GENERATION',
        derivationFrames.length > 0
          ? 'Derivation frames never produced a committed final structure whose overt terminals match the input sentence.'
          : 'Derivation analysis failed to produce a committed tree from derivationStages.',
        502,
        withFailureDetails({}, {
          failureClass: 'incomplete_generation',
          ruleId: 'GENERATION_DID_NOT_CONVERGE',
          stageIndex: rawDerivationStageCount > 0 ? rawDerivationStageCount - 1 : null,
          fieldPath: '$.derivationStages',
          offendingValue: rawDerivationStages
        })
      );
    }
    const committedTree = derivationPrimaryBundle.tree;
    const committedSurfaceOrder = derivationPrimaryBundle.surfaceOrder;
    const identifiedDerivationSteps = [];
    const resolvedVisualRelations = buildResolvedVisualRelationsFromDerivationFrames(derivationFrames);
    const derivationStages = derivationFrames.map((frame) => {
      const details = frame?.change?.details && typeof frame.change.details === 'object' && !Array.isArray(frame.change.details)
        ? frame.change.details
        : {};
      const stageRecord = details.stageRecord;
      const visualRelations = Array.isArray(details.derivationStageVisualRelations)
        ? details.derivationStageVisualRelations.map((relation) => structuredClone(relation))
        : [];
      return {
        statement: frame?.change?.statement,
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
      surfaceOrder: committedSurfaceOrder,
      derivationStages,
      resolvedVisualRelations,
      derivationSteps: identifiedDerivationSteps,
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
      const hasSingleAnalysisShape = (
        topLevelFields.length !== 1
          ? false
          : Object.prototype.hasOwnProperty.call(parsed || {}, 'derivationStages')
      );
      const hasAmbiguityShape = (
        topLevelFields.length === 1
        && Object.prototype.hasOwnProperty.call(parsed || {}, 'analyses')
        && Array.isArray(parsed.analyses)
        && parsed.analyses.length > 0
        && parsed.analyses.every((analysis) => (
          analysis
          && typeof analysis === 'object'
          && !Array.isArray(analysis)
          && Object.keys(analysis).length === 1
          && Object.prototype.hasOwnProperty.call(analysis, 'derivationStages')
        ))
      );
      if (!hasSingleAnalysisShape && !hasAmbiguityShape) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'The authored payload must be either { derivationStages } or { analyses: [{ derivationStages }, ...] }, with no additional fields.',
          502,
          withFailureDetails({}, {
            failureClass: 'contract_misunderstanding',
            ruleId: 'PAYLOAD_ENVELOPE_EXACT',
            fieldPath: '$',
            offendingValue: parsed
          })
        );
      }
    }
    // ParseBundle is an internal/product envelope. Each analysis inside it still
    // has the same four-field authored derivation-stage contract.
    const analysesSource = Array.isArray(parsed?.analyses)
      ? parsed.analyses
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
      ));

    if (analyses.length === 0) {
      throw new ParseApiError(
        'BAD_MODEL_RESPONSE',
        'No analyses were returned by the model.',
        502,
        withFailureDetails({}, {
          failureClass: 'contract_misunderstanding',
          ruleId: 'ANALYSES_NONEMPTY',
          fieldPath: '$.analyses',
          offendingValue: parsed?.analyses
        })
      );
    }

    const ambiguityDetected = analyses.length > 1 || Boolean(parsed?.ambiguityDetected);

    return {
      analyses,
      ambiguityDetected,
      ambiguityNote: ambiguityDetected ? String(parsed?.ambiguityNote || '').trim() || undefined : undefined
    };
  };

  return {
    normalizeParseResult,
    normalizeParseBundle
  };
};
