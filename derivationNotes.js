export const collectDerivationStageRecords = (stages) => (
  (Array.isArray(stages) ? stages : [])
    .map((stage) => String(stage?.stageRecord || '').trim())
    .filter(Boolean)
);
