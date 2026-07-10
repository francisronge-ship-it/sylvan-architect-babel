const fs = require('node:fs');
const path = require('node:path');
const {
  collectMovementRelations,
  collectResolvedVisualRelations,
  collectStageRecords,
  countUnresolvedAnchors
} = require('./helpers/currentContract.cjs');

const BASE_URL = process.env.BABEL_BASE_URL || 'http://127.0.0.1:5177';
const OUT_DIR = path.resolve('.artifacts/gemini-novel5-sweep');

const CASES = [
  { id: 'en_yesno', framework: 'xbar', language: 'English', phenomenon: 'yes-no-question', sentence: 'Did the captain repair the bridge?' },
  { id: 'de_wh', framework: 'xbar', language: 'German', phenomenon: 'wh-question', sentence: 'Welches Bild hat Lea gekauft?' },
  { id: 'it_wh', framework: 'xbar', language: 'Italian', phenomenon: 'wh-question', sentence: 'Quale poesia ha scritto Marta?' },
  { id: 'ja_embedded', framework: 'xbar', language: 'Japanese', phenomenon: 'embedded-complement', sentence: 'Sora-wa Mei-ga utatta to omotta.' },
  { id: 'ga_vso', framework: 'xbar', language: 'Irish', phenomenon: 'vso-declarative', sentence: "D'ith Seamas an ubh." }
];

const TRACE_RE = /^(?:t|trace|t\d+|trace\d+|(?:t|trace)(?:_[a-z0-9]+)+|[a-z]+_trace(?:_[a-z0-9]+)*|<[^>]+>|⟨[^⟩]+⟩|\(t\)|\{t\}|∅|Ø|ε|null|epsilon)$/i;
const MOVEMENT_RE = /\b(move(?:ment|d|s|ing)?|internal\s*merge|head[\s-]*move(?:ment)?|raising|raised|trace|copy|a-?bar|a-?move|wh-?move|front(?:ing|ed)?|displac(?:e|ed|ement|ing)|spec(?:ifier)?[, ]*(?:cp|tp|inflp|ip)|epp)\b/i;

const sanitizeText = (value) => String(value || '').replace(/\r/g, '').trim();
const tokenize = (value) => sanitizeText(value).split(/\s+/).filter(Boolean);
const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^<|>$/g, '')
    .replace(/^⟨|⟩$/g, '')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const REQUEST_TIMEOUT_MS = Number(process.env.BABEL_SWEEP_TIMEOUT_MS || 180000);

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function sameSeq(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (normalizeToken(left[index]) !== normalizeToken(right[index])) return false;
  }
  return true;
}

function resolveLeafSurface(node) {
  const word = String(node?.word || '').trim();
  if (word) return word;
  const children = Array.isArray(node?.children) ? node.children : [];
  if (children.length > 0) return '';
  return String(node?.label || '').trim();
}

function collectLeaves(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) {
    const surface = resolveLeafSurface(node);
    if (surface && !TRACE_RE.test(surface)) out.push(surface);
    return out;
  }
  children.forEach((child) => collectLeaves(child, out));
  return out;
}

function countMoveSteps(steps) {
  const moveOps = new Set(['Move', 'InternalMerge', 'HeadMove', 'A-Move', 'AbarMove']);
  return (Array.isArray(steps) ? steps : []).filter((step) => moveOps.has(String(step?.operation || '').trim())).length;
}

function analyze(testCase, bundle) {
  const analysis = bundle?.analyses?.[0] || {};
  const sentenceTokens = tokenize(testCase.sentence);
  const leaves = collectLeaves(analysis.tree);
  const surfaceOrder = Array.isArray(analysis.surfaceOrder) ? analysis.surfaceOrder : [];
  const visualRelations = collectResolvedVisualRelations(analysis);
  const movementRelations = collectMovementRelations(analysis);
  const derivationSteps = Array.isArray(analysis.derivationSteps) ? analysis.derivationSteps : [];
  const stageRecords = collectStageRecords(analysis);
  const notesText = stageRecords.join('\n');
  const issues = [];

  if (!sameSeq(leaves, sentenceTokens)) issues.push('LEAVES_NE_SENTENCE');
  if (!sameSeq(surfaceOrder, sentenceTokens)) issues.push('SURFACE_NE_SENTENCE');
  if (!sameSeq(leaves, surfaceOrder)) issues.push('LEAVES_NE_SURFACE');
  if (movementRelations.length > 0 && !MOVEMENT_RE.test(notesText)) issues.push('MOVEMENT_MISSING_FROM_STAGE_RECORDS');
  if (countMoveSteps(derivationSteps) === 0 && movementRelations.length > 0) issues.push('MOVEMENT_RELATIONS_WITHOUT_MOVE_STEPS');
  if (countUnresolvedAnchors(visualRelations) > 0) issues.push('UNRESOLVED_VISUAL_RELATION_ANCHOR');

  return {
    ok: issues.length === 0,
    issues,
    leaves,
    surfaceOrder,
    visualRelationsCount: visualRelations.length,
    movementRelationsCount: movementRelations.length,
    moveDerivationStepsCount: countMoveSteps(derivationSteps),
    stageRecords
  };
}

async function parseCase(testCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence: testCase.sentence,
        framework: testCase.framework,
        modelRoute: 'gemini'
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === 'AbortError') {
      return {
        status: 598,
        payload: {
          error: {
            code: 'LOCAL_TIMEOUT',
          message: `Local sweep timed out after ${REQUEST_TIMEOUT_MS}ms`
          }
        }
      };
    }
    throw error;
  }
  clearTimeout(timer);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, payload };
}

(async () => {
  ensureOutDir();
  const results = [];

  for (const testCase of CASES) {
    const startedAt = Date.now();
    let finalResult = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const parsed = await parseCase(testCase);
      const elapsedMs = Date.now() - startedAt;

      if (parsed.status === 200) {
        finalResult = {
          ...testCase,
          status: parsed.status,
          elapsedMs,
          ...analyze(testCase, parsed.payload)
        };
        break;
      }

      finalResult = {
        ...testCase,
        status: parsed.status,
        elapsedMs,
        ok: false,
        issues: ['HTTP_FAILURE'],
        error: parsed.payload?.error || null
      };

      if (parsed.status >= 500 && attempt < 2) {
        await sleep(2500);
        continue;
      }
      break;
    }

    results.push(finalResult);
  }

  const summary = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    total: results.length,
    successful: results.filter((item) => item.status === 200).length,
    structurallyClean: results.filter((item) => item.status === 200 && item.ok).length,
    withStructuralIssues: results.filter((item) => item.status === 200 && !item.ok).length,
    hardFailures: results.filter((item) => item.status !== 200).length,
    results
  };

  const outPath = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(outPath);
  console.log(JSON.stringify(summary, null, 2));
})();
