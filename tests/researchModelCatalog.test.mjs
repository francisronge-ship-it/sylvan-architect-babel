import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RESEARCH_MODEL_CATALOG,
  getResearchModel,
  resolveResearchModelSelection
} from '../server/babelParser/researchModelCatalog.js';

test('the initial research catalog contains only the three approved unqualified candidates', () => {
  assert.deepEqual(
    RESEARCH_MODEL_CATALOG.map((entry) => entry.id),
    [
      'openai:gpt-5.6-sol',
      'anthropic:claude-opus-5',
      'anthropic:claude-fable-5'
    ]
  );
  assert.ok(RESEARCH_MODEL_CATALOG.every((entry) => entry.qualificationStatus === 'unqualified'));
  assert.equal(RESEARCH_MODEL_CATALOG.some((entry) => entry.provider === 'google'), false);
  assert.equal(RESEARCH_MODEL_CATALOG.some((entry) => /gemini/i.test(entry.providerModel)), false);
  assert.equal(new Set(RESEARCH_MODEL_CATALOG.map((entry) => entry.id)).size, 3);
  assert.equal(Object.isFrozen(RESEARCH_MODEL_CATALOG), true);
});

test('catalog settings retain each provider native parameter name', () => {
  const openai = resolveResearchModelSelection('openai:gpt-5.6-sol', {
    'reasoning.effort': 'max'
  });
  assert.deepEqual(openai.nativeSettings, { 'reasoning.effort': 'max' });
  assert.equal(openai.requestPolicy.maxOutputTokens, 128000);
  assert.equal(openai.requestPolicy.background, true);

  const opus = resolveResearchModelSelection('anthropic:claude-opus-5', {
    'output_config.effort': 'xhigh'
  });
  assert.deepEqual(opus.nativeSettings, { 'output_config.effort': 'xhigh' });
  assert.equal(opus.requestPolicy.thinking.requestMode, 'explicit-adaptive');

  const fable = resolveResearchModelSelection('anthropic:claude-fable-5');
  assert.deepEqual(fable.nativeSettings, { 'output_config.effort': 'high' });
  assert.equal(fable.requestPolicy.thinking.requestMode, 'implicit-always-on');
  assert.equal(fable.constraints.dataRetention, '30-days-required');
});

test('catalog lookup and settings fail closed without coercion', () => {
  assert.equal(getResearchModel('openai:gpt-5.6-sol')?.providerModel, 'gpt-5.6-sol');
  assert.equal(getResearchModel('GPT 5.6 Sol'), null);
  assert.throws(
    () => resolveResearchModelSelection('openai:gpt-5.6-sol', { effort: 'high' }),
    /Unsupported settings/
  );
  assert.throws(
    () => resolveResearchModelSelection('anthropic:claude-opus-5', {
      'output_config.effort': 'extra-high'
    }),
    /must be one of/
  );
  assert.throws(
    () => resolveResearchModelSelection('anthropic:unknown'),
    /Unknown research model/
  );
});
