export const createSemanticValidationHelpers = ({
  ParseApiError,
  cleanExplanationWhitespace,
  normalizeMovementOperation,
  normalizeChainType,
  normalizeOptionalStepText,
  normalizeKey,
  buildNodeIndexFromTree,
  collectOvertTerminalNodes,
  subtreeContainsNamedCovertCategoryLeaf
}) => {
  const NOTE_TEXT_RAISING_RE = /\braising\b/i;
  const NOTE_TEXT_CONTROL_RE = /\bcontrol\b|\bcontrolled\b/i;
  const NOTE_TEXT_SUBJECT_CONTROL_RE = /\bsubject[- ]control\b/i;
  const NOTE_TEXT_OBJECT_CONTROL_RE = /\bobject[- ]control\b/i;
  const NOTE_TEXT_ECM_RE = /\becm\b|\bexceptional case marking\b/i;
  const NOTE_TEXT_WH_CHAIN_RE = /\bwh-?movement\b|\ba-?bar movement\b|\ba-?bar\b/i;
  const NOTE_TEXT_A_CHAIN_RE = /\ba-?movement\b|\braises?\b|\bundergoes a-?movement\b/i;
  const NOTE_TEXT_HEAD_CHAIN_RE = /\bhead movement\b|\bi-?to-?c\b|\binfl to c\b|\bmoves? to c\b|\bhead-moves?\b/i;
  const NOTE_TEXT_DEPENDENCY_CONTRAST_RE = /\b(?:distinction|contrast|distinguish(?:es|ing)?|differentiat(?:e|es|ing)|versus|vs\.?|rather than|unlike)\b/i;
  const NOTE_TEXT_CASE_RE = /\b(?:nominative|accusative|ergative|absolutive|dative|genitive)\b|\bcase\b/i;
  const NOTE_TEXT_THETA_RE = /\b(?:agent|theme|patient|experiencer|goal|proposition|theta-role|theta role|external argument|internal argument)\b/i;
  const NOTE_TEXT_FEATURE_RE = /\b(?:feature checking|feature valuation|valued feature|unvalued feature|uninterpretable feature|interpretable feature|epp)\b/i;
  const NOTE_TEXT_PHASE_RE = /\b(?:phase head|phase edge|spell-?out domain|transfer(?:red)?|cyclic transfer|phase)\b/i;
  const NOTE_TEXT_MORPHOLOGY_RE = /\b(?:morphological realization|surface exponent|allomorph(?:y|ic)?|portmanteau|morpholog(?:y|ical)|exponence)\b/i;
  const NOTE_TEXT_SELECTION_RE = /\bselects?\b|\bselected as complement\b|\bselected as specifier\b|\bselector\b|\bselectee\b/i;
  const NOTE_TEXT_BINDING_RE = /\b(?:principle [abc]|binding domain|c-command|reflexive|anaphor|bound by|binds?)\b/i;
  const NOTE_TEXT_AGREEMENT_RE = /\b(?:noun class|phi-feature|class 17|default class|default agreement)\b/i;
  const NOTE_TEXT_PREDICATE_CLASS_RE = /\b(?:predicate class|unaccusative|unergative|weather predicate|expletive predicate|raising predicate|control predicate)\b/i;
  const NOTE_TEXT_PROBE_RE = /\b(?:probe direction(?:ality)?|probing domain|probe domain|search domain)\b/i;
  const NOTE_TEXT_NULL_ELEMENT_RE = /\b(?:silent complementizer|null complementizer|covert operator|expletive)\b/i;
  const NOTE_TEXT_DIAGNOSTIC_RE = /\b(?:diagnostic|idiom|agreement asymmetr|default agreement|interpretation only)\b/i;
  const NOTE_TEXT_PARAMETER_RE = /\b(?:parameter(?:ized|ization)?|probe directionality|overt subject movement|agreement domain)\b/i;
  const NOTE_TEXT_INFORMATION_STRUCTURE_RE = /\b(?:information structure|topic|focus|background|comment|contrastive topic|contrastive focus)\b/i;
  const NOTE_TEXT_OPERATOR_SCOPE_RE = /\b(?:operator scope|takes scope|outscopes|wide scope|narrow scope|scope interaction|question operator|scope)\b/i;
  const NOTE_TEXT_VOICE_VALENCY_RE = /\b(?:passive|middle voice|antipassive|causative|applicative|voice|valency)\b/i;
  const NOTE_TEXT_LINEARIZATION_RE = /\b(?:linearization|surface order|word order|verb-second|v2|head-final|head-initial)\b/i;
  const NOTE_TEXT_LOCALITY_RE = /\b(?:locality|island|phase edge|minimal link|subjacency|successive-cyclic)\b/i;
  const NOTE_TEXT_PREDICATION_RE = /\b(?:predication|secondary predication|depictive|resultative|small clause|copular predication)\b/i;
  const NOTE_TEXT_PARTICLE_RE = /\b(?:discourse particle|clause-typing particle|sentence-final particle|question particle|topic particle|focus particle|particle)\b/i;
  const NOTE_TEXT_EVIDENTIALITY_RE = /\b(?:evidential|reported evidential|inferential evidential|direct evidential|indirect evidential|evidentiality)\b/i;
  const NOTE_TEXT_MIRATIVITY_RE = /\b(?:mirative|mirativity|surprise marker)\b/i;
  const NOTE_TEXT_HONORIFICITY_RE = /\b(?:honorific|politeness|deferential|addressee honorific|subject honorific|honorificity)\b/i;
  const NOTE_TEXT_SWITCH_REFERENCE_RE = /\b(?:switch-reference|same-subject marker|different-subject marker|same subject|different subject)\b/i;
  const NOTE_TEXT_LOGOPHORA_RE = /\b(?:logophor|logophoric|logophora)\b/i;
  const NOTE_TEXT_EVENT_STRUCTURE_RE = /\b(?:event structure|lexical aspect|aktionsart|telic|atelic|accomplishment|achievement|activity|state|bounded|unbounded)\b/i;

  const noteNegatesDependency = (text, dependencyRe) => {
    const normalized = cleanExplanationWhitespace(String(text || ''));
    if (!normalized) return false;
    const source = dependencyRe.source;
    const negatedBefore = new RegExp(
      `\\b(?:without(?:\\s+requiring)?|without\\s+positing|not|no)\\b(?:\\s+[a-z-]+){0,3}\\s+${source}`,
      'i'
    );
    const negatedAfter = new RegExp(
      `${source}\\b(?:\\s+[a-z-]+){0,3}\\s+\\b(?:is\\s+)?(?:not|unnecessary|unneeded)\\b`,
      'i'
    );
    return negatedBefore.test(normalized) || negatedAfter.test(normalized);
  };

  const noteMentionsDependencyContrastively = (text, firstRe, secondRe) => {
    const normalized = cleanExplanationWhitespace(String(text || ''));
    if (!normalized) return false;
    if (
      !NOTE_TEXT_DEPENDENCY_CONTRAST_RE.test(normalized)
      && !noteNegatesDependency(normalized, firstRe)
      && !noteNegatesDependency(normalized, secondRe)
    ) {
      return false;
    }
    return firstRe.test(normalized) && secondRe.test(normalized);
  };

  const noteAssertsRaising = (text) => {
    const normalized = cleanExplanationWhitespace(String(text || ''));
    if (!normalized || !NOTE_TEXT_RAISING_RE.test(normalized)) return false;
    if (noteMentionsDependencyContrastively(normalized, NOTE_TEXT_RAISING_RE, NOTE_TEXT_CONTROL_RE)) {
      return false;
    }
    return true;
  };

  const noteAssertsControl = (text) => {
    const normalized = cleanExplanationWhitespace(String(text || ''));
    if (!normalized || !NOTE_TEXT_CONTROL_RE.test(normalized)) return false;
    if (noteMentionsDependencyContrastively(normalized, NOTE_TEXT_CONTROL_RE, NOTE_TEXT_RAISING_RE)) {
      return false;
    }
    return true;
  };

  const noteAssertsEcm = (text) => {
    const normalized = cleanExplanationWhitespace(String(text || ''));
    if (!normalized || !NOTE_TEXT_ECM_RE.test(normalized)) return false;
    if (noteMentionsDependencyContrastively(normalized, NOTE_TEXT_ECM_RE, NOTE_TEXT_CONTROL_RE)) {
      return false;
    }
    return true;
  };

  const hasTrajectoryRelationSupport = ({ visualRelationEvents = [], chains = [] }, kind) => {
    const trajectoryOperationMatchesKind = (operation, expectedKind) => {
      const normalized = normalizeMovementOperation(operation);
      const raw = normalizeKey(operation);
      if (expectedKind === 'AbarMove') {
        return normalized === 'AbarMove' || /abar|wh|front|focus|topic|operator|displac|extract|scrambl|rollup|sideward/.test(raw);
      }
      if (expectedKind === 'A-Move') {
        return normalized === 'A-Move' || /amove|raise|raising/.test(raw);
      }
      if (expectedKind === 'HeadMove') {
        return normalized === 'HeadMove' || /head.*move|head.*raise|head.*lower|lower|lowering|affix|clitic|incorpor/.test(raw);
      }
      return false;
    };
    const chainMatchesKind = (chain, expectedKind) => {
      const family = normalizeChainType(chain?.family || chain?.type);
      const raw = normalizeKey(chain?.type);
      if (expectedKind === 'AbarMove') {
        return family === 'A-bar' || /abar|wh|front|focus|topic|operator|displac|extract|scrambl|rollup|sideward/.test(raw);
      }
      if (expectedKind === 'A-Move') {
        return family === 'A' || /amove|raise|raising/.test(raw);
      }
      if (expectedKind === 'HeadMove') {
        return family === 'head' || /head.*move|head.*raise|head.*lower|lower|lowering|affix|clitic|incorpor/.test(raw);
      }
      return false;
    };
    if (kind === 'AbarMove') {
      return visualRelationEvents.some((event) => trajectoryOperationMatchesKind(event?.operation, kind))
        || chains.some((chain) => chainMatchesKind(chain, kind));
    }
    if (kind === 'A-Move') {
      return visualRelationEvents.some((event) => trajectoryOperationMatchesKind(event?.operation, kind))
        || chains.some((chain) => chainMatchesKind(chain, kind));
    }
    if (kind === 'HeadMove') {
      return visualRelationEvents.some((event) => trajectoryOperationMatchesKind(event?.operation, kind))
        || chains.some((chain) => chainMatchesKind(chain, kind));
    }
    return false;
  };

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

  const validateNoteBindingsAgainstStructuredAnalysis = ({
    noteBindings = [],
    visualRelationEvents = [],
    chains = [],
    commitmentFacts = []
  }) => {
    if (!Array.isArray(noteBindings) || noteBindings.length === 0) return;
    const NOTE_TEXT_BANNED_BOILERPLATE_RE = /\b(?:initial logic and parameters are validated|standard processing applied|final transformation)\b/i;

    const commitmentFactIds = new Set(
      (Array.isArray(commitmentFacts) ? commitmentFacts : [])
        .map((entry) => normalizeOptionalStepText(entry?.factId))
        .filter(Boolean)
    );
    const supportIdsForBinding = (binding) =>
      Array.isArray(binding?.supportIds)
        ? binding.supportIds.map((value) => normalizeOptionalStepText(value)).filter(Boolean)
        : [];
    const explicitCommitmentFactIdsForBinding = (binding) =>
      Array.isArray(binding?.commitmentFactIds)
        ? binding.commitmentFactIds.map((value) => normalizeOptionalStepText(value)).filter(Boolean)
        : [];
    const hasAnyCommitmentFactSupport = (binding) => [
      ...explicitCommitmentFactIdsForBinding(binding),
      ...supportIdsForBinding(binding)
    ].some((id) => commitmentFactIds.has(id));
    const hasBindingLinks = (binding, ...fields) =>
      fields.some((field) => Array.isArray(binding?.[field]) && binding[field].some((value) => normalizeOptionalStepText(value)));
    const hasStructuralAnchor = (binding) =>
      Boolean(normalizeOptionalStepText(binding?.chainId))
      || hasBindingLinks(binding, 'stepIds', 'nodeIds');
    const hasAnyCanonicalSupport = (binding) =>
      hasStructuralAnchor(binding) || hasAnyCommitmentFactSupport(binding);
    const noteMentionsGenericTheoryClaim = (text) =>
      NOTE_TEXT_CASE_RE.test(text)
      || NOTE_TEXT_THETA_RE.test(text)
      || NOTE_TEXT_FEATURE_RE.test(text)
      || NOTE_TEXT_PHASE_RE.test(text)
      || NOTE_TEXT_MORPHOLOGY_RE.test(text)
      || NOTE_TEXT_SELECTION_RE.test(text)
      || NOTE_TEXT_BINDING_RE.test(text)
      || NOTE_TEXT_AGREEMENT_RE.test(text)
      || NOTE_TEXT_PREDICATE_CLASS_RE.test(text)
      || NOTE_TEXT_PROBE_RE.test(text)
      || NOTE_TEXT_NULL_ELEMENT_RE.test(text)
      || NOTE_TEXT_DIAGNOSTIC_RE.test(text)
      || NOTE_TEXT_PARAMETER_RE.test(text)
      || NOTE_TEXT_INFORMATION_STRUCTURE_RE.test(text)
      || NOTE_TEXT_OPERATOR_SCOPE_RE.test(text)
      || NOTE_TEXT_VOICE_VALENCY_RE.test(text)
      || NOTE_TEXT_LOCALITY_RE.test(text)
      || NOTE_TEXT_PREDICATION_RE.test(text)
      || NOTE_TEXT_PARTICLE_RE.test(text)
      || NOTE_TEXT_EVIDENTIALITY_RE.test(text)
      || NOTE_TEXT_MIRATIVITY_RE.test(text)
      || NOTE_TEXT_HONORIFICITY_RE.test(text)
      || NOTE_TEXT_SWITCH_REFERENCE_RE.test(text)
      || NOTE_TEXT_LOGOPHORA_RE.test(text)
      || NOTE_TEXT_EVENT_STRUCTURE_RE.test(text);

    for (const binding of noteBindings) {
      const kind = normalizeKey(binding?.kind);
      const isClosureBinding = kind === 'closure';
      const text = cleanExplanationWhitespace(String(binding?.text || ''));
      if (!text) continue;

      if (NOTE_TEXT_BANNED_BOILERPLATE_RE.test(text)) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'Notes contain stock boilerplate rather than structural explanation.',
          502
        );
      }

      if (
        NOTE_TEXT_WH_CHAIN_RE.test(text)
        && !hasTrajectoryRelationSupport({ visualRelationEvents, chains }, 'AbarMove')
        && !hasStructuralAnchor(binding)
      ) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'A chain note mentions wh/A-bar movement but the structured derivation does not encode an A-bar chain.',
          502
        );
      }
      if (NOTE_TEXT_WH_CHAIN_RE.test(text) && !hasStructuralAnchor(binding)) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'A wh/A-bar note must anchor itself to the encoded derivation with stepIds, nodeIds, or chainId.',
          502
        );
      }

      if (
        NOTE_TEXT_A_CHAIN_RE.test(text)
        && !NOTE_TEXT_CONTROL_RE.test(text)
        && !hasTrajectoryRelationSupport({ visualRelationEvents, chains }, 'A-Move')
        && !hasStructuralAnchor(binding)
      ) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'Notes mention A-movement but the structured derivation does not encode an A-chain.',
          502
        );
      }
      if (NOTE_TEXT_A_CHAIN_RE.test(text) && !NOTE_TEXT_CONTROL_RE.test(text) && !hasStructuralAnchor(binding)) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'An A-movement note must anchor itself to the encoded derivation with stepIds, nodeIds, or chainId.',
          502
        );
      }

      if (
        NOTE_TEXT_HEAD_CHAIN_RE.test(text)
        && !hasTrajectoryRelationSupport({ visualRelationEvents, chains }, 'HeadMove')
        && !hasStructuralAnchor(binding)
      ) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'Notes mention head movement but the structured derivation does not encode a head-movement chain.',
          502
        );
      }
      if (NOTE_TEXT_HEAD_CHAIN_RE.test(text) && !hasStructuralAnchor(binding)) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'A head-movement note must anchor itself to the encoded derivation with stepIds, nodeIds, or chainId.',
          502
        );
      }

      if (NOTE_TEXT_LINEARIZATION_RE.test(text) && !isClosureBinding && !hasAnyCanonicalSupport(binding)) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'Notes mention linearization or word-order facts but are neither anchored to the derivation nor supported by commitment facts or explicit support ids.',
          502
        );
      }

      if (noteMentionsGenericTheoryClaim(text) && !hasAnyCanonicalSupport(binding)) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'Notes mention public theory facts but are not anchored to the derivation and do not cite supporting commitment facts or explicit support ids.',
          502
        );
      }

      if (
        (noteAssertsRaising(text) || noteAssertsControl(text) || noteAssertsEcm(text))
        && !hasAnyCanonicalSupport(binding)
      ) {
        throw new ParseApiError(
          'BAD_MODEL_RESPONSE',
          'Notes mention clausal dependency facts but are not anchored to the frozen derivation and do not cite supporting commitment facts or support ids.',
          502
        );
      }
    }
  };

  const shouldWarnOnSemanticValidationFailure = () => true;
  const shouldStrictlyEnforceNoteConsistency = () => String(process.env.BABEL_STRICT_NOTE_VALIDATION || '').trim() === '1';

  const runSemanticValidation = (label, validator) => {
    try {
      validator();
    } catch (error) {
      if (
        shouldWarnOnSemanticValidationFailure()
        && error instanceof ParseApiError
        && error.code === 'BAD_MODEL_RESPONSE'
      ) {
        const prefix = String(label || '').trim();
        const message = String(error.message || '').trim() || 'Semantic validation warning.';
        const warning = prefix ? `${prefix}: ${message}` : message;
        if (warning) console.warn(`[Babel semantic validation softened in production] ${warning}`);
        return;
      }
      throw error;
    }
  };

  const auditNoteConsistency = (validator) => {
    try {
      validator();
    } catch (error) {
      if (
        error instanceof ParseApiError
        && error.code === 'BAD_MODEL_RESPONSE'
        && !shouldStrictlyEnforceNoteConsistency()
      ) {
        const message = String(error.message || '').trim() || 'Note-support consistency audit failed.';
        if (message) console.warn(`[Babel note-support audit] ${message}`);
        return;
      }
      throw error;
    }
  };

  return {
    validatePronouncedCopiesAgainstCommittedTree,
    validateNoteBindingsAgainstStructuredAnalysis,
    runSemanticValidation,
    auditNoteConsistency
  };
};
