import { tokenizeSentenceSurfaceOrder } from './surfaceTokens.js';

export const buildDerivationStagesFirstContentsPrompt = (
  sentence,
  framework = 'xbar'
) => {
  const tokens = tokenizeSentenceSurfaceOrder(sentence);
  const tokenText = tokens.join(' | ');
  const tokenIndexText = tokens.map((token, index) => `${index}:${token}`).join(' | ');
  const frameworkName = framework === 'xbar'
    ? 'X-Bar Theory (Government and Binding)'
    : 'The Minimalist Program (Bare Phrase Structure)';
  const instructions = [
    `Analyze the sentence: "${sentence}" using ${frameworkName}.`,
    `Return raw JSON only: one top-level object with a "derivationStages" array.`,
    `Return one forward derivation; do not wrap it in an "analyses" array.`,
    `derivationStages is the structural source of truth for this analysis.`,
    `Build the derivation forward; do not start from a completed final tree and backfill stages.`,
    `Input tokens, in required surface order: ${tokenIndexText}.`,
    `Use exactly these overt input tokens as pronounced terminals: ${tokenText}.`,
    `The last derivationStage must be the final converged structure for exactly this token sequence: ${tokenText}.`,
    `Every tokenIndex may appear on at most one non-silent terminal in each derivationStage.`,
    `Follow the system derivationStages contract. Do not add fields outside that contract.`
  ].filter(Boolean);
  return instructions.join(' ');
};

export const buildSingleParseContentsPrompt = (
  sentence,
  framework = 'xbar',
  modelRoute = 'pro'
) => buildDerivationStagesFirstContentsPrompt(sentence, framework);

export const buildParseContentsPrompt = (
  sentence,
  framework = 'xbar',
  modelRoute = 'pro'
) => {
  const basePrompt = buildSingleParseContentsPrompt(sentence, framework, modelRoute);
  return basePrompt;
};
