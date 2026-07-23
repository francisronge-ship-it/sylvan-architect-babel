import assert from 'node:assert/strict';
import test from 'node:test';

import { __test__ } from '../server/babelParser.js';
import {
  normalizeSurfaceToken,
  tokenizeSentenceSurfaceOrder
} from '../server/babelParser/surfaceTokens.js';
import { tokenizeReplaySentenceSurface } from '../replay/replayCompiler.ts';

const cases = [
  {
    expected: ['Mia', 'laughed'],
    input: 'Mia laughed.',
    name: 'current declarative fixture'
  },
  {
    expected: ['What', 'did', 'Mia', 'see'],
    input: 'What did Mia see?',
    name: 'current interrogative fixture'
  },
  {
    expected: ['Mia', "'s", 'book'],
    input: 'Mia’s book.',
    name: 'Latin possessive'
  },
  {
    expected: ['Café', 'zargle42'],
    input: 'Cafe\u0301 zargle42.',
    name: 'NFC and nonce form'
  },
  {
    expected: ['أنا', 'أحبّ', 'النحو'],
    input: 'أنا أحبّ النحو',
    name: 'Arabic RTL'
  },
  {
    expected: ['אני', 'אוהב', 'תחביר'],
    input: 'אני אוהב תחביר',
    name: 'Hebrew RTL'
  },
  {
    expected: ['मैं', 'वाक्यविन्यास', 'पढ़ता', 'हूँ'],
    input: 'मैं वाक्यविन्यास पढ़ता हूँ।',
    name: 'Devanagari'
  },
  {
    expected: ['猫', 'が', '寝', 'た'],
    input: '猫が寝た。',
    name: 'Japanese without whitespace'
  },
  {
    expected: ['Mia', 'saw', '👩🏽‍💻', 'today'],
    input: 'Mia saw 👩🏽‍💻 today.',
    name: 'emoji ZWJ sequence'
  },
  {
    expected: ['🙂🚀'],
    input: '🙂🚀',
    name: 'maximal adjacent symbol run'
  },
  {
    expected: ['🙂', '🚀'],
    input: '🙂,🚀',
    name: 'punctuation-separated symbol runs'
  },
  {
    expected: ['1️⃣', '🇸🇪', '🛰️'],
    input: '1️⃣ 🇸🇪 🛰️',
    name: 'keycap flag and variation-selector emoji'
  },
  {
    expected: ['α', '∑∞', 'β'],
    input: 'α ∑∞ β',
    name: 'mathematical symbol run'
  },
  {
    expected: ['\uE000\uE001', 'ta'],
    input: '\uE000\uE001 ta',
    name: 'private-use conlang glyphs'
  }
];

test('parser and replay tokenizers preserve general input surfaces identically', () => {
  for (const fixture of cases) {
    const parserTokens = tokenizeSentenceSurfaceOrder(fixture.input);
    const replayTokens = tokenizeReplaySentenceSurface(fixture.input);
    assert.deepEqual(parserTokens, fixture.expected, fixture.name);
    assert.deepEqual(replayTokens, fixture.expected, `${fixture.name} replay`);
    assert.deepEqual(replayTokens, parserTokens, `${fixture.name} parser/replay parity`);
    assert.ok(
      parserTokens.every((token) =>
        token === token.normalize('NFC') && !token.includes('\uFFFD')
      ),
      `${fixture.name} keeps renderable NFC tokens`
    );
  }
});

test('surface normalization retains symbol-only and private-use tokens', () => {
  assert.equal(normalizeSurfaceToken('🙂'), '🙂');
  assert.equal(normalizeSurfaceToken('👩🏽‍💻'), '👩🏽‍💻');
  assert.equal(normalizeSurfaceToken('🛰️'), '🛰️');
  assert.equal(normalizeSurfaceToken('\uE000\uE001'), '\uE000\uE001');
  assert.equal(normalizeSurfaceToken('Cafe\u0301'), 'café');
  assert.equal(normalizeSurfaceToken('...'), '');
});

test('fallback tokenization preserves word and symbol runs without Segmenter', () => {
  const originalSegmenter = Intl.Segmenter;
  Intl.Segmenter = undefined;
  try {
    assert.deepEqual(
      tokenizeSentenceSurfaceOrder('Cafe\u0301 Mia’s 👩🏽‍💻 🙂🚀 \uE000\uE001'),
      ['Café', 'Mia', "'s", '👩🏽‍💻', '🙂🚀', '\uE000\uE001']
    );
  } finally {
    Intl.Segmenter = originalSegmenter;
  }
});

test('emoji survives the complete final-stage alignment path', () => {
  const payload = {
    derivationStages: [
      {
        statement: 'The emoji enters the derivation.',
        stageRecord: 'The authored emoji is represented as the complete overt derivation surface.',
        visualRelations: [],
        workspaceForest: [
          {
            children: [],
            id: 'emoji_root',
            label: '🙂',
            tokenIndex: 0,
            word: '🙂'
          }
        ]
      }
    ]
  };
  const bundle = __test__.normalizeParseBundle(
    payload,
    'xbar',
    '🙂',
    'fixture',
    true,
    { payloadIntegrityFlags: [] }
  );
  assert.deepEqual(bundle.analyses[0].surfaceOrder, ['🙂']);
  assert.deepEqual(
    bundle.analyses[0].derivationStages[0].workspaceForest[0],
    payload.derivationStages[0].workspaceForest[0]
  );
});

test('symbol alignment still rejects a different authored surface', () => {
  const payload = {
    derivationStages: [
      {
        statement: 'A different emoji enters the derivation.',
        stageRecord: 'The authored rocket is represented as the complete overt derivation surface.',
        visualRelations: [],
        workspaceForest: [
          {
            children: [],
            id: 'rocket_root',
            label: '🚀',
            tokenIndex: 0,
            word: '🚀'
          }
        ]
      }
    ]
  };
  assert.throws(
    () => __test__.normalizeParseBundle(
      payload,
      'xbar',
      '🙂',
      'fixture',
      true,
      { payloadIntegrityFlags: [] }
    ),
    /overt terminals match the input sentence/
  );
});
