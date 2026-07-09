export const createStepNormalizationHelpers = ({
  normalizeOptionalStepText,
  normalizeMovementStemFromId
}) => {
  const deriveImplicitDerivationChainId = (step, event, eventIndex = 0) => {
    const explicitEvent = normalizeOptionalStepText(event?.chainId);
    if (explicitEvent) return explicitEvent;
    const explicitStep = normalizeOptionalStepText(step?.chainId);
    if (explicitStep) return explicitStep;
    const sourceStem = normalizeMovementStemFromId(event?.fromNodeId || event?.traceNodeId);
    const targetStem = normalizeMovementStemFromId(event?.toNodeId);
    const fallbackStem = targetStem || sourceStem;
    return fallbackStem ? `chain:${fallbackStem}` : `ch${eventIndex + 1}`;
  };

  return { deriveImplicitDerivationChainId };
};
