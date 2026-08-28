/**
 * Conservative Tier-1 recognition aliases.
 *
 * Every alias names the same complete sourced analysis as its canonical
 * identity. These are exact declarations, never token patterns or fuzzy
 * matches. Construction compositions such as sluicing and pseudogapping do
 * not belong here: their component relations remain independently authored.
 */
export const TIER1_RELATION_ALIAS_RECORDS = Object.freeze([
  { canonical: 'AbarMove', aliases: ['A-bar Movement', 'Phrasal Movement', 'Wh Movement'], rationale: 'Established names for the curated phrasal A-bar trajectory.', evidence: 'A1 Phrasal Movement card and committed movement fixtures' },
  { canonical: 'AMove', aliases: ['A-Movement', 'A Movement'], rationale: 'Hyphenated and spaced names for the curated A-movement trajectory.', evidence: 'Current movement fixtures' },
  { canonical: 'HeadMove', aliases: ['Head Movement'], rationale: 'Expanded name of the curated head-movement analysis.', evidence: 'A2 Head Movement card' },
  { canonical: 'Lowering', aliases: ['Affix Lowering'], rationale: 'Established specific name for the curated lowering analysis.', evidence: 'A3 Lowering card' },
  { canonical: 'OperatorVariableBinding', aliases: ['Operator-Variable Binding', 'Operator / Variable Binding'], rationale: 'Punctuation variants of the same operator-variable analysis.', evidence: 'I1B Operator / Variable Binding card' },
  { canonical: 'RemnantMovement', aliases: ['Remnant Movement'], rationale: 'Spaced name of the curated remnant-movement relation.', evidence: 'L1 Remnant Movement card' },
  { canonical: 'RollUpMovement', aliases: ['Roll-Up Movement', 'Roll Up Movement'], rationale: 'Established punctuation variants of roll-up movement.', evidence: 'L2 Roll-Up Movement card' },
  { canonical: 'Smuggling', aliases: ['Smuggling Movement'], rationale: 'Expanded established name for the curated smuggling trajectory.', evidence: 'L3 Smuggling card and committed fixtures' },
  { canonical: 'AcrossTheBoardMovement', aliases: ['Across-the-Board Movement', 'Across the Board Movement', 'ATB Movement'], rationale: 'Established full and abbreviated names for the same ATB analysis.', evidence: 'M2 Across-the-Board Movement card' },
  { canonical: 'SidewardMovement', aliases: ['Sideward Movement'], rationale: 'Spaced name of the curated sideward-movement relation.', evidence: 'M3 Sideward Movement card' },
  { canonical: 'Identity', aliases: ['Copy Chain', 'Identity / Copy Chain'], rationale: 'Atlas names for one occurrence-identity family.', evidence: 'B Identity / Copy Chain card' },
  { canonical: 'Coreference', aliases: ['Plain Coreference'], rationale: 'Atlas title for the same non-binding coreference analysis.', evidence: 'C4 Plain Coreference card' },
  { canonical: 'Control', aliases: ['Control Dependency'], rationale: 'Atlas title for the same controller-controllee dependency.', evidence: 'C Control Dependency card' },
  { canonical: 'Predication', aliases: ['Primary Predication'], rationale: 'Atlas title for the same predicand-predicate relation.', evidence: 'C5 Predication card' },
  { canonical: 'Binding', aliases: ['Principle A Binding', 'Binding / Principle A'], rationale: 'Specific Atlas names for the curated local anaphor-binding design.', evidence: 'C2 Binding / Principle A card' },
  { canonical: 'SplitAntecedence', aliases: ['Split Antecedence'], rationale: 'Spaced name of the curated split-antecedence relation.', evidence: 'O6 Split Antecedence card' },
  { canonical: 'ParasiticGap', aliases: ['Parasitic Gap'], rationale: 'Spaced name of the curated parasitic-gap composition.', evidence: 'M1 and O2 Parasitic Gap cards' },
  { canonical: 'PairMerge', aliases: ['Pair Merge'], rationale: 'Spaced name of the curated Pair Merge relation.', evidence: 'N1 Pair Merge card' },
  { canonical: 'Multidominance', aliases: ['Multiple Dominance'], rationale: 'Established expanded name for multidominance.', evidence: 'G Multidominance / Sharing card' },
  { canonical: 'ArgumentSharing', aliases: ['Argument Sharing'], rationale: 'Spaced name of the curated argument-sharing relation.', evidence: 'G3 Argument Sharing card' },
  { canonical: 'IdiomChunkCointerpretation', aliases: ['Idiom-Chunk Cointerpretation', 'Idiom Chunk Cointerpretation'], rationale: 'Punctuation variants of the same idiom-chunk interpretation.', evidence: 'N3 Idiom-Chunk Cointerpretation card' },
  { canonical: 'Agree', aliases: ['Feature Valuation', 'Agree / Feature Valuation'], rationale: 'Atlas names for the same probe-goal Agree analysis.', evidence: 'D Agree / Feature Valuation card' },
  { canonical: 'FeatureBundle', aliases: ['Feature Bundle'], rationale: 'Spaced name of the generic authored feature plaque relation.', evidence: 'Committed feature-bundle fixtures' },
  { canonical: 'MultipleAgree', aliases: ['Multiple Agree'], rationale: 'Spaced name of the curated one-probe multiple-goal analysis.', evidence: 'D3 Multiple Agree card' },
  { canonical: 'CyclicAgree', aliases: ['Cyclic Agree'], rationale: 'Spaced name of the curated cyclic search analysis.', evidence: 'D4 Cyclic Agree card' },
  { canonical: 'FeatureSharing', aliases: ['Feature Sharing'], rationale: 'Spaced name of the curated feature-sharing relation.', evidence: 'D5 Feature Sharing card' },
  { canonical: 'CaseAssignment', aliases: ['Case Assignment'], rationale: 'Spaced name of the curated Case-assignment path.', evidence: 'D6 Case Assignment card' },
  { canonical: 'DependentCase', aliases: ['Dependent Case'], rationale: 'Spaced name of the curated dependent-Case analysis.', evidence: 'D7 Dependent Case card' },
  { canonical: 'Accord', aliases: ['Negative Concord', 'Negative Concord / Accord'], rationale: 'Atlas and established names for the curated concord design.', evidence: 'I7 Negative Concord / Accord card' },
  { canonical: 'BoundingNodeCrossing', aliases: ['Bounding-Node Crossing'], rationale: 'Hyphenated name of the curated bounding-node diagnostic.', evidence: 'E1 Bounding-Node Crossing card' },
  { canonical: 'Phase', aliases: ['Phase Boundary'], rationale: 'Atlas title for the curated phase-domain design.', evidence: 'E2 Phase Boundary card' },
  { canonical: 'TransferDomain', aliases: ['Transfer Domain', 'Spell-Out Domain', 'Spell Out Domain'], rationale: 'Established names for the same transferred complement domain.', evidence: 'E4 Transfer / Spell-Out Domain card' },
  { canonical: 'PostTransferAccess', aliases: ['Post-Transfer Access', 'Post-Transfer Access Failure'], rationale: 'Punctuation and Atlas-title variants of the same access judgment.', evidence: 'E4B Post-Transfer Access Failure card' },
  { canonical: 'AntiLocality', aliases: ['Anti-Locality'], rationale: 'Hyphenated name of the curated anti-locality diagnostic.', evidence: 'E5 Anti-Locality card' },
  { canonical: 'ImproperMovement', aliases: ['Improper Movement'], rationale: 'Spaced name of the curated improper-movement judgment.', evidence: 'E6 Improper Movement card' },
  { canonical: 'BlockedExtraction', aliases: ['Blocked Extraction', 'Blocked Extraction Diagnostic'], rationale: 'Atlas names for the same blocked-extraction diagnostic.', evidence: 'N2 Blocked Extraction Diagnostic card' },
  { canonical: 'Intervention', aliases: ['Relativized Minimality', 'Intervention / Relativized Minimality'], rationale: 'Established and Atlas names for the same intervention judgment.', evidence: 'K Intervention / Relativized Minimality card' },
  { canonical: 'IllicitAnalysis', aliases: ['Illicit Analysis'], rationale: 'Spaced name of the authored analysis-verdict relation.', evidence: 'Committed illicit-analysis fixtures' },
  { canonical: 'Ellipsis', aliases: ['Ellipsis / Silent Structure'], rationale: 'Atlas title for the curated silent-domain relation.', evidence: 'F Ellipsis / Silent Structure card' },
  { canonical: 'EllipsisRecoverability', aliases: ['Ellipsis Recoverability'], rationale: 'Spaced name of the curated recoverability identity.', evidence: 'Committed ellipsis fixtures' },
  { canonical: 'EllipsisDeletion', aliases: ['Ellipsis Deletion'], rationale: 'Spaced name of the curated deletion-site relation.', evidence: 'O1B deletion fixture' },
  { canonical: 'CopyOccurrence', aliases: ['Copy Occurrence'], rationale: 'Spaced name of the curated copy-occurrence relation.', evidence: 'Committed copy fixtures' },
  { canonical: 'MultiplePronunciation', aliases: ['Multiple Pronunciation'], rationale: 'Spaced name of the curated multiple-pronunciation relation.', evidence: 'Committed copy fixtures' },
  { canonical: 'PartialCopyDeletion', aliases: ['Partial Copy Deletion'], rationale: 'Spaced name of the curated partial-copy deletion relation.', evidence: 'F5 Partial Copy Deletion card' },
  { canonical: 'PFRealization', aliases: ['PF Realization'], rationale: 'Spaced name of the curated PF-realization mapping.', evidence: 'H PF Realization card' },
  { canonical: 'VocabularyInsertion', aliases: ['Vocabulary Insertion'], rationale: 'Spaced name of the curated Vocabulary Insertion relation.', evidence: 'Committed PF-realization fixtures' },
  { canonical: 'PhrasalSpellOut', aliases: ['Phrasal Spell-Out', 'Phrasal Spell Out'], rationale: 'Established punctuation variants of phrasal spell-out.', evidence: 'H2B Phrasal Spell-Out card' },
  { canonical: 'ManyToManyCorrespondence', aliases: ['Many-to-Many PF Correspondence', 'Many to Many PF Correspondence'], rationale: 'Atlas punctuation variants of the same PF correspondence.', evidence: 'H2C Many-to-Many PF Correspondence card' },
  { canonical: 'LocalDislocation', aliases: ['Local Dislocation', 'String-Vacuous Rebracketing'], rationale: 'Established and Atlas names for the same local rebracketing analysis.', evidence: 'H5 Local Dislocation / String-Vacuous Rebracketing card' },
  { canonical: 'CyclicLinearization', aliases: ['Cyclic Linearization', 'Cyclic Linearization / Edge Movement'], rationale: 'Atlas names for the same cyclic ordering analysis.', evidence: 'H6 Cyclic Linearization / Edge Movement card' },
  { canonical: 'QuantifierRaising', aliases: ['Quantifier Raising', 'QR'], rationale: 'Established full and abbreviated names for the curated QR analysis.', evidence: 'I1 QR / Covert Scope card' },
  { canonical: 'LFReconstruction', aliases: ['LF Reconstruction'], rationale: 'Spaced name of the curated LF-reconstruction relation.', evidence: 'I2 LF Reconstruction card' },
  { canonical: 'CooperStorage', aliases: ['Cooper Storage'], rationale: 'Spaced name of the curated Cooper-storage relation.', evidence: 'I6 Cooper Storage card' },
  { canonical: 'StrongNPILicensing', aliases: ['Strong-NPI Licensing', 'Strong NPI Licensing'], rationale: 'Established punctuation variants of strong-NPI licensing.', evidence: 'I8 Strong-NPI Licensing card' },
  { canonical: 'FocusMarking', aliases: ['Focus Marking', 'Subject Focus Marking'], rationale: 'Atlas and specific names for the curated focus-marking analysis.', evidence: 'I4 Focus Marking card' },
  { canonical: 'FProjection', aliases: ['F-Projection', 'Focus Projection'], rationale: 'Established names for the same focus-projection analysis.', evidence: 'I9 F-Projection card' },
  { canonical: 'ThetaAssignment', aliases: ['Theta Assignment', 'Theta-Role Assignment', 'Theta Role Assignment'], rationale: 'Established punctuation variants of theta-role assignment.', evidence: 'J Theta Roles / Argument Grid card' },
  { canonical: 'GappingAlignment', aliases: ['Gapping Alignment'], rationale: 'Spaced name of the relation-level correspondence primitive, not a construction card.', evidence: 'Committed gapping-alignment research fixture' }
]);

const aliasesByCanonical = new Map(
  TIER1_RELATION_ALIAS_RECORDS.map((record) => [record.canonical, record.aliases])
);

export const expandTier1RelationIdentities = (identities) => [...new Set(
  identities.flatMap((identity) => [identity, ...(aliasesByCanonical.get(identity) ?? [])])
)];
