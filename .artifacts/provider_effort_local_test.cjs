#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const loadLocalEnv = require('./helpers/loadLocalEnv.cjs');

const INITIAL_CWD = process.cwd();
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_APP_URL = 'http://127.0.0.1:5177';
const PROVIDERS = ['gemini', 'gpt', 'claude'];
const DEFAULT_SENTENCE = 'Mia laughed.';
const DEFAULT_FRAMEWORK = 'minimalism';
const DEFAULT_EFFORT = 'high';
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 1000;
const DEFAULT_PRICES_PER_1M = Object.freeze({
  gemini: { input: 2, output: 12 },
  gpt: { input: 5, output: 30 },
  claude: { input: 5, output: 25 }
});
const PRICE_ENV_ALIASES = Object.freeze({
  gemini: ['GEMINI', 'GOOGLE'],
  gpt: ['GPT', 'OPENAI'],
  claude: ['CLAUDE', 'ANTHROPIC']
});
const SECRET_ENV_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY'
];

loadLocalEnv();
process.chdir(REPO_ROOT);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const parsed = {
    sentence: DEFAULT_SENTENCE,
    framework: DEFAULT_FRAMEWORK,
    effort: DEFAULT_EFFORT,
    providerEfforts: '',
    providers: PROVIDERS.join(','),
    appUrl: DEFAULT_APP_URL,
    out: '',
    browser: '',
    ffmpeg: '',
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    skipRender: false,
    skipGif: false,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    if (name === 'help' || name === 'h') {
      parsed.help = true;
      continue;
    }
    if (name === 'skip-render' || name === 'no-render') {
      parsed.skipRender = true;
      continue;
    }
    if (name === 'no-gif' || name === 'skip-gif') {
      parsed.skipGif = true;
      continue;
    }
    if (name === 'dry-run') {
      parsed.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    index += 1;
    if (name === 'sentence') parsed.sentence = value;
    else if (name === 'framework') parsed.framework = value;
    else if (name === 'effort') parsed.effort = value;
    else if (name === 'provider-efforts') parsed.providerEfforts = value;
    else if (name === 'providers') parsed.providers = value;
    else if (name === 'app-url') parsed.appUrl = value;
    else if (name === 'out') parsed.out = value;
    else if (name === 'browser') parsed.browser = value;
    else if (name === 'ffmpeg') parsed.ffmpeg = value;
    else if (name === 'width') parsed.width = Number(value) || DEFAULT_WIDTH;
    else if (name === 'height') parsed.height = Number(value) || DEFAULT_HEIGHT;
    else throw new Error(`Unknown option --${name}`);
  }

  parsed.framework = String(parsed.framework || DEFAULT_FRAMEWORK).trim().toLowerCase();
  if (!['minimalism', 'xbar'].includes(parsed.framework)) {
    throw new Error('--framework must be minimalism or xbar.');
  }
  parsed.sentence = String(parsed.sentence || DEFAULT_SENTENCE).trim();
  parsed.effort = String(parsed.effort || DEFAULT_EFFORT).trim().toLowerCase();
  parsed.width = Math.max(800, parsed.width || DEFAULT_WIDTH);
  parsed.height = Math.max(600, parsed.height || DEFAULT_HEIGHT);
  parsed.providerList = parsed.providers
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
  const unknown = parsed.providerList.filter((provider) => !PROVIDERS.includes(provider));
  if (unknown.length > 0) {
    throw new Error(`Unknown provider(s): ${unknown.join(', ')}`);
  }
  if (parsed.providerList.length === 0) {
    throw new Error('At least one provider is required.');
  }
  return parsed;
}

function printHelp() {
  console.log([
    'Babel provider effort local test',
    '',
    'Runs one direct provider generation per selected provider and writes artifacts under .local-tests.',
    'No retries and no payload-transcriber fallback are used.',
    '',
    'Examples:',
    '  npm run local:provider-effort -- --effort high',
    '  npm run local:provider-effort -- --provider-efforts gemini:high,gpt:xhigh,claude:max',
    '  node .artifacts/provider_effort_local_test.cjs --dry-run --skip-render',
    '',
    'Options:',
    '  --sentence "Mia laughed."',
    '  --framework minimalism|xbar',
    '  --effort low|medium|high|xhigh|max',
    '  --provider-efforts gemini:high,gpt:xhigh,claude:max',
    '  --providers gemini,gpt,claude',
    '  --out .local-tests/provider-effort-...',
    '  --app-url http://127.0.0.1:5177',
    '  --browser /path/to/chromium',
    '  --ffmpeg /path/to/ffmpeg',
    '  --skip-render',
    '  --no-gif',
    '  --dry-run'
  ].join('\n'));
}

function slugify(value, fallback = 'run') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function stampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveOutputDir(args, effectiveEfforts) {
  if (args.out) {
    return path.resolve(INITIAL_CWD, args.out);
  }
  const effortSlug = args.providerList
    .map((provider) => `${provider}-${slugify(effectiveEfforts[provider] || args.effort)}`)
    .join('_');
  return path.join(
    REPO_ROOT,
    '.local-tests',
    `provider-effort-${stampForPath()}-${slugify(args.sentence, 'sentence')}-${effortSlug}`
  );
}

function parseProviderEfforts(args, normalizeProviderReasoningEffort) {
  const explicit = new Map();
  if (args.providerEfforts) {
    for (const entry of args.providerEfforts.split(',')) {
      const [provider, effort] = entry.split(':').map((part) => String(part || '').trim().toLowerCase());
      if (!provider || !effort) {
        throw new Error(`Invalid --provider-efforts entry: ${entry}`);
      }
      if (!PROVIDERS.includes(provider)) {
        throw new Error(`Unknown provider in --provider-efforts: ${provider}`);
      }
      explicit.set(provider, effort);
    }
  }

  const efforts = {};
  const requested = {};
  for (const provider of args.providerList) {
    const requestedEffort = explicit.get(provider) || args.effort;
    requested[provider] = requestedEffort;
    efforts[provider] = normalizeProviderReasoningEffort(provider, requestedEffort);
  }
  return { requested, effective: efforts };
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value || ''), 'utf8');
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  mkdirp(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function secretValues() {
  return SECRET_ENV_KEYS
    .map((key) => String(process.env[key] || '').trim())
    .filter((value) => value.length >= 8);
}

function redactSecrets(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  for (const secret of secretValues()) {
    text = text.split(secret).join('[redacted]');
  }
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{12,}/g, '[redacted-anthropic-key]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-openai-key]')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[redacted-google-key]');
}

function sanitizeError(error) {
  const out = {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    status: error?.status,
    statusCode: error?.statusCode,
    code: error?.code,
    stack: error?.stack
  };
  if (error?.details && typeof error.details === 'object') {
    out.details = error.details;
  }
  if (error?.responseBody) {
    out.responseBodyPreview = String(error.responseBody).slice(0, 1200);
  }
  return JSON.parse(redactSecrets(out));
}

function assertKey(provider) {
  const envKey = provider === 'gemini'
    ? 'GEMINI_API_KEY'
    : provider === 'gpt'
      ? 'OPENAI_API_KEY'
      : 'ANTHROPIC_API_KEY';
  const value = String(process.env[envKey] || '').trim();
  if (!value) throw new Error(`${envKey} is not configured.`);
  return value;
}

function providerModel(provider, routeConfig) {
  if (provider === 'gemini') return routeConfig.GEMINI_MODEL;
  if (provider === 'gpt') return routeConfig.OPENAI_MODEL;
  return routeConfig.ANTHROPIC_MODEL;
}

function priceFromEnv(provider, field, fallback) {
  for (const alias of PRICE_ENV_ALIASES[provider] || []) {
    const key = `BABEL_PRICE_${alias}_${field.toUpperCase()}_PER_1M`;
    const value = Number(process.env[key]);
    if (Number.isFinite(value) && value >= 0) {
      return { value, key };
    }
  }
  return { value: fallback, key: null };
}

function estimateCost(provider, generationMeta) {
  const defaults = DEFAULT_PRICES_PER_1M[provider];
  const inputRate = priceFromEnv(provider, 'input', defaults.input);
  const outputRate = priceFromEnv(provider, 'output', defaults.output);
  const inputTokens = Number(generationMeta.promptTokenCount || 0);
  const outputTokens = Number(generationMeta.outputTokenCount || 0);
  const thoughtsTokens = Number(generationMeta.thoughtsTokenCount || 0);
  const billableOutputTokens = provider === 'gemini' ? outputTokens + thoughtsTokens : outputTokens;
  const estimatedUsd = ((inputTokens * inputRate.value) + (billableOutputTokens * outputRate.value)) / 1_000_000;
  return {
    estimatedUsd,
    currency: 'USD',
    inputTokens,
    outputTokens,
    thoughtsTokens,
    billableOutputTokens,
    ratesPerMillionTokens: {
      input: inputRate.value,
      output: outputRate.value
    },
    rateSources: {
      input: inputRate.key || 'script-default',
      output: outputRate.key || 'script-default'
    },
    note: 'Estimated from saved token usage and configurable per-million-token rates; update BABEL_PRICE_* env vars if provider pricing changes.'
  };
}

function makeHttpRequest(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.get(parsed, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await makeHttpRequest(url, 1500)) return true;
    await wait(250);
  }
  return false;
}

async function ensureAppServer(appUrl) {
  if (await waitForUrl(appUrl, 1000)) {
    return { started: false, close: async () => {} };
  }

  const parsed = new URL(appUrl);
  const host = parsed.hostname || '127.0.0.1';
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  const child = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', port, '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  const collect = (chunk) => {
    log = `${log}${chunk.toString('utf8')}`.slice(-4000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  const ready = await waitForUrl(appUrl, 30000);
  if (!ready) {
    child.kill();
    throw new Error(`Vite dev server did not become reachable at ${appUrl}.\n${log}`);
  }
  return {
    started: true,
    close: async () => {
      child.kill();
      await wait(250);
    }
  };
}

function commandResult(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout = `${stdout}${chunk.toString('utf8')}`.slice(-12000);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-12000);
    });
    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function runCommandOrThrow(command, args, label) {
  const result = await commandResult(command, args);
  if (result.code !== 0) {
    const error = new Error(`${label} failed with exit ${result.code}${result.signal ? ` signal ${result.signal}` : ''}`);
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return result;
}

function candidateBrowserPaths() {
  const candidates = [
    process.env.BABEL_CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ].filter(Boolean);
  try {
    const { loadChromium } = require('./helpers/loadPlaywright.cjs');
    const chromium = loadChromium();
    const executablePath = chromium.executablePath?.();
    if (executablePath) candidates.push(executablePath);
  } catch {
    // The caller gets a clear missing-browser error below if rendering is requested.
  }
  candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  );
  return candidates;
}

function resolveBrowserPath(requestedPath = '') {
  const candidates = requestedPath ? [requestedPath] : candidateBrowserPaths();
  for (const candidate of candidates) {
    const resolved = path.resolve(String(candidate || ''));
    if (candidate && fs.existsSync(resolved)) return resolved;
  }
  return '';
}

function resolveFfmpegPath(requestedPath = '') {
  const candidates = [
    requestedPath,
    process.env.BABEL_FFMPEG_BIN,
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac')
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(String(candidate || ''));
    if (fs.existsSync(resolved)) return resolved;
  }
  return '';
}

async function makeReplayGif({ ffmpegPath, renderDir, gifPath }) {
  const firstFrame = path.join(renderDir, 'replay-00.png');
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error('ffmpeg is required for replay GIF creation. Set --ffmpeg or BABEL_FFMPEG_BIN.');
  }
  if (!fs.existsSync(firstFrame)) {
    throw new Error(`No replay frames found at ${firstFrame}`);
  }
  const palettePath = path.join(renderDir, 'replay-palette.png');
  await runCommandOrThrow(
    ffmpegPath,
    ['-y', '-framerate', '1.5', '-i', path.join(renderDir, 'replay-%02d.png'), '-vf', 'palettegen', palettePath],
    'ffmpeg palette generation'
  );
  await runCommandOrThrow(
    ffmpegPath,
    ['-y', '-framerate', '1.5', '-i', path.join(renderDir, 'replay-%02d.png'), '-i', palettePath, '-lavfi', 'paletteuse', gifPath],
    'ffmpeg GIF generation'
  );
}

async function captureRender({ bundlePath, renderDir, appUrl, browserPath, width, height }) {
  if (!browserPath) {
    throw new Error('Chromium/Chrome executable is required for render capture. Set --browser or BABEL_CHROME_BIN.');
  }
  await runCommandOrThrow(
    process.execPath,
    [
      path.join(REPO_ROOT, 'scripts/captureReplayArtifact.mjs'),
      '--bundle',
      bundlePath,
      '--out',
      renderDir,
      '--browser',
      browserPath,
      '--app-url',
      appUrl,
      '--width',
      String(width),
      '--height',
      String(height)
    ],
    'replay/canopy/notes capture'
  );
}

function annotateNormalizedBundle(bundle, { provider, model, requestedEffort, effectiveEffort, generationMeta, timing }) {
  const analyses = Array.isArray(bundle?.analyses) ? bundle.analyses : [];
  const first = analyses[0];
  const nextBundle = {
    ...bundle,
    requestedModelRoute: provider,
    requestedReasoningEffort: effectiveEffort,
    modelUsed: model
  };
  if (first && typeof first === 'object') {
    nextBundle.analyses = [
      {
        ...first,
        provenance: {
          ...(first.provenance || {}),
          modelRoute: provider,
          modelUsed: model,
          requestedReasoningEffort: effectiveEffort,
          originallyRequestedReasoningEffort: requestedEffort,
          providerEffortHarness: true,
          tokenUsage: {
            promptTokenCount: generationMeta.promptTokenCount,
            outputTokenCount: generationMeta.outputTokenCount,
            thoughtsTokenCount: generationMeta.thoughtsTokenCount,
            totalTokenCount: generationMeta.totalTokenCount
          },
          timingMs: {
            providerCall: timing.providerCallMs,
            parseAndNormalize: timing.parseNormalizeMs
          }
        }
      },
      ...analyses.slice(1)
    ];
  }
  return nextBundle;
}

async function runProvider({
  provider,
  args,
  outDir,
  requestedEffort,
  effectiveEffort,
  browserPath,
  ffmpegPath,
  modules,
  serverState
}) {
  const {
    GoogleGenAI,
    routeConfig,
    modelRuntime,
    parserTest
  } = modules;
  const providerDir = path.join(outDir, `${provider}-${effectiveEffort}`);
  const renderDir = path.join(providerDir, 'render');
  mkdirp(providerDir);

  const model = providerModel(provider, routeConfig);
  const systemInstruction = parserTest.buildSystemInstruction(args.framework, provider);
  const prompt = parserTest.buildParseContentsPrompt(args.sentence, args.framework, provider);
  const temperature = routeConfig.resolveRouteTemperature(provider);
  const maxOutputTokens = routeConfig.resolveRouteMaxOutputTokens(provider, args.sentence);
  const request = {
    provider,
    model,
    sentence: args.sentence,
    framework: args.framework,
    requestedEffort,
    effectiveEffort,
    temperature,
    maxOutputTokens,
    noRetries: true,
    noFallbacks: true,
    generatedAt: new Date().toISOString(),
    prompt,
    systemInstruction
  };
  writeJson(path.join(providerDir, 'request.json'), request);

  const status = {
    provider,
    model,
    requestedEffort,
    effectiveEffort,
    ok: false,
    providerDir,
    renderDir
  };

  let generation;
  let generationMeta;
  const providerStartedAt = Date.now();
  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: assertKey(provider) });
      generation = await modelRuntime.generateStructuredContent({
        ai,
        model,
        contents: prompt,
        systemInstruction,
        temperature,
        maxOutputTokens,
        thinkingConfig: routeConfig.buildGeminiThinkingConfig(effectiveEffort)
      });
    } else if (provider === 'gpt') {
      generation = await modelRuntime.generateOpenAIStructuredContent({
        apiKey: assertKey(provider),
        model,
        contents: prompt,
        systemInstruction,
        temperature,
        maxOutputTokens,
        reasoningEffort: effectiveEffort,
        background: routeConfig.OPENAI_BACKGROUND_RESPONSES,
        pollIntervalMs: routeConfig.OPENAI_BACKGROUND_POLL_INTERVAL_MS
      });
    } else {
      generation = await modelRuntime.generateAnthropicStructuredContent({
        apiKey: assertKey(provider),
        model,
        contents: prompt,
        systemInstruction,
        temperature,
        maxOutputTokens,
        effort: effectiveEffort,
        thinking: routeConfig.ANTHROPIC_THINKING_CONFIG
      });
    }
  } catch (error) {
    const sanitized = sanitizeError(error);
    writeJson(path.join(providerDir, 'error.json'), {
      phase: 'provider-call',
      error: sanitized
    });
    status.errorPhase = 'provider-call';
    status.error = sanitized.message;
    writeJson(path.join(providerDir, 'summary.json'), status);
    return status;
  }
  const providerCallMs = Date.now() - providerStartedAt;

  generationMeta = modelRuntime.summarizeGeneration(generation);
  writeText(path.join(providerDir, 'raw-provider-output.txt'), `${generationMeta.rawText || ''}\n`);
  writeJson(path.join(providerDir, 'generation-meta.json'), {
    ...generationMeta,
    providerCallMs,
    model,
    provider,
    requestedEffort,
    effectiveEffort
  });

  const parseStartedAt = Date.now();
  let parsedPayload;
  let normalizedBundle;
  try {
    parsedPayload = parserTest.parseModelJsonDetailed(generationMeta.rawText);
    writeJson(path.join(providerDir, 'parsed-payload.json'), parsedPayload);

    normalizedBundle = parserTest.normalizeParseBundle(
      parsedPayload.payload,
      args.framework,
      args.sentence,
      provider,
      true,
      { payloadIntegrityFlags: parsedPayload.integrityFlags }
    );
    normalizedBundle = annotateNormalizedBundle(normalizedBundle, {
      provider,
      model,
      requestedEffort,
      effectiveEffort,
      generationMeta,
      timing: {
        providerCallMs,
        parseNormalizeMs: Date.now() - parseStartedAt
      }
    });
    writeJson(path.join(providerDir, 'normalized-bundle.json'), normalizedBundle);
  } catch (error) {
    const sanitized = sanitizeError(error);
    writeJson(path.join(providerDir, 'error.json'), {
      phase: 'parse-normalize',
      error: sanitized
    });
    status.errorPhase = 'parse-normalize';
    status.error = sanitized.message;
    status.providerCallMs = providerCallMs;
    writeJson(path.join(providerDir, 'summary.json'), status);
    return status;
  }

  const parseNormalizeMs = Date.now() - parseStartedAt;
  const cost = estimateCost(provider, generationMeta);
  writeJson(path.join(providerDir, 'token-usage.json'), {
    promptTokenCount: generationMeta.promptTokenCount,
    outputTokenCount: generationMeta.outputTokenCount,
    thoughtsTokenCount: generationMeta.thoughtsTokenCount,
    totalTokenCount: generationMeta.totalTokenCount
  });
  writeJson(path.join(providerDir, 'timing.json'), {
    providerCallMs,
    parseNormalizeMs
  });
  writeJson(path.join(providerDir, 'cost.json'), cost);

  const captureBundle = {
    request: {
      sentence: args.sentence,
      framework: args.framework,
      modelRoute: provider,
      reasoningEffort: effectiveEffort
    },
    response: normalizedBundle,
    modelUsed: model,
    generationMeta: {
      finishReason: generationMeta.finishReason,
      textLength: generationMeta.textLength,
      promptTokenCount: generationMeta.promptTokenCount,
      outputTokenCount: generationMeta.outputTokenCount,
      thoughtsTokenCount: generationMeta.thoughtsTokenCount,
      totalTokenCount: generationMeta.totalTokenCount
    }
  };
  const captureBundlePath = path.join(providerDir, 'capture-bundle.json');
  writeJson(captureBundlePath, captureBundle);

  let renderOk = false;
  let gifOk = false;
  if (!args.skipRender) {
    try {
      if (!serverState.current) {
        serverState.current = await ensureAppServer(args.appUrl);
      }
      await captureRender({
        bundlePath: captureBundlePath,
        renderDir,
        appUrl: args.appUrl,
        browserPath,
        width: args.width,
        height: args.height
      });
      renderOk = true;
      copyIfExists(path.join(renderDir, 'canopy.png'), path.join(providerDir, 'canopy.png'));
      copyIfExists(path.join(renderDir, 'notes.png'), path.join(providerDir, 'notes.png'));
      if (!args.skipGif) {
        await makeReplayGif({
          ffmpegPath,
          renderDir,
          gifPath: path.join(providerDir, 'replay.gif')
        });
        gifOk = true;
      }
    } catch (error) {
      const sanitized = sanitizeError(error);
      writeJson(path.join(providerDir, 'render-error.json'), sanitized);
      status.errorPhase = 'render';
      status.error = sanitized.message;
    }
  }

  status.ok = !status.errorPhase;
  status.providerCallMs = providerCallMs;
  status.parseNormalizeMs = parseNormalizeMs;
  status.tokens = {
    input: generationMeta.promptTokenCount,
    output: generationMeta.outputTokenCount,
    thoughts: generationMeta.thoughtsTokenCount,
    total: generationMeta.totalTokenCount
  };
  status.cost = cost;
  status.artifacts = {
    rawProviderText: path.join(providerDir, 'raw-provider-output.txt'),
    parsedPayload: path.join(providerDir, 'parsed-payload.json'),
    normalizedBundle: path.join(providerDir, 'normalized-bundle.json'),
    captureBundle: captureBundlePath,
    render: renderOk ? renderDir : null,
    replayGif: gifOk ? path.join(providerDir, 'replay.gif') : null,
    canopy: renderOk ? path.join(providerDir, 'canopy.png') : null,
    notes: renderOk ? path.join(providerDir, 'notes.png') : null,
    tokenUsage: path.join(providerDir, 'token-usage.json'),
    timing: path.join(providerDir, 'timing.json'),
    cost: path.join(providerDir, 'cost.json')
  };
  writeJson(path.join(providerDir, 'summary.json'), status);
  return status;
}

function reportMarkdown({ args, outDir, results }) {
  const rows = results.map((result) => [
    result.provider,
    result.model,
    `${result.requestedEffort}${result.requestedEffort !== result.effectiveEffort ? ` -> ${result.effectiveEffort}` : ''}`,
    result.ok ? 'ok' : `failed: ${result.errorPhase || 'unknown'}`,
    result.providerCallMs == null ? '' : `${result.providerCallMs} ms`,
    result.tokens?.total == null ? '' : String(result.tokens.total),
    result.cost?.estimatedUsd == null ? '' : `$${result.cost.estimatedUsd.toFixed(6)}`
  ]);
  return [
    '# Provider Effort Local Test',
    '',
    `- Sentence: ${args.sentence}`,
    `- Framework: ${args.framework}`,
    `- Output: ${outDir}`,
    `- Render: ${args.skipRender ? 'skipped' : 'captured'}`,
    `- GIF: ${args.skipRender || args.skipGif ? 'skipped' : 'requested'}`,
    '',
    '| Provider | Model | Effort | Status | Provider time | Total tokens | Estimated cost |',
    '| --- | --- | --- | --- | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
    'Each row represents one direct provider generation. The harness does not run parse fallbacks, payload transcription, route retries, or the 100-case gauntlet.'
  ].join('\n');
}

async function loadModules() {
  const routeConfig = await import(pathToFileURL(path.join(REPO_ROOT, 'server/babelParser/routeConfig.js')).href);
  const modelRuntime = await import(pathToFileURL(path.join(REPO_ROOT, 'server/babelParser/modelRuntime.js')).href);
  const parser = await import(pathToFileURL(path.join(REPO_ROOT, 'server/babelParser.js')).href);
  const { GoogleGenAI } = await import('@google/genai');
  return {
    routeConfig,
    modelRuntime,
    parserTest: parser.__test__,
    GoogleGenAI
  };
}

function dryRunSummary({ args, requestedEfforts, effectiveEfforts, outDir, browserPath, ffmpegPath, routeConfig }) {
  return {
    dryRun: true,
    wouldCallProviders: args.providerList.map((provider) => ({
      provider,
      model: providerModel(provider, routeConfig),
      requestedEffort: requestedEfforts[provider],
      effectiveEffort: effectiveEfforts[provider],
      apiKeyConfigured: Boolean(
        provider === 'gemini'
          ? process.env.GEMINI_API_KEY
          : provider === 'gpt'
            ? process.env.OPENAI_API_KEY
            : process.env.ANTHROPIC_API_KEY
      )
    })),
    outputDir: outDir,
    render: !args.skipRender,
    gif: !args.skipRender && !args.skipGif,
    appUrl: args.appUrl,
    browserConfigured: Boolean(browserPath),
    ffmpegConfigured: Boolean(ffmpegPath)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const modules = await loadModules();
  const { requested, effective } = parseProviderEfforts(args, modules.routeConfig.normalizeProviderReasoningEffort);
  const outDir = resolveOutputDir(args, effective);
  const browserPath = args.skipRender ? '' : resolveBrowserPath(args.browser);
  const ffmpegPath = (args.skipRender || args.skipGif) ? '' : resolveFfmpegPath(args.ffmpeg);

  if (args.dryRun) {
    console.log(JSON.stringify(dryRunSummary({
      args,
      requestedEfforts: requested,
      effectiveEfforts: effective,
      outDir,
      browserPath,
      ffmpegPath,
      routeConfig: modules.routeConfig
    }), null, 2));
    return;
  }

  mkdirp(outDir);
  writeJson(path.join(outDir, 'run-request.json'), {
    sentence: args.sentence,
    framework: args.framework,
    providers: args.providerList,
    requestedEfforts: requested,
    effectiveEfforts: effective,
    appUrl: args.appUrl,
    render: !args.skipRender,
    gif: !args.skipRender && !args.skipGif,
    startedAt: new Date().toISOString()
  });

  const serverState = { current: null };
  const results = [];
  try {
    for (const provider of args.providerList) {
      console.error(`[provider-effort] ${provider} ${requested[provider]} -> ${effective[provider]}`);
      const result = await runProvider({
        provider,
        args,
        outDir,
        requestedEffort: requested[provider],
        effectiveEffort: effective[provider],
        browserPath,
        ffmpegPath,
        modules,
        serverState
      });
      results.push(result);
      console.error(`[provider-effort] ${provider} ${result.ok ? 'ok' : `failed at ${result.errorPhase}`}`);
    }
  } finally {
    if (serverState.current?.started) {
      await serverState.current.close();
    }
  }

  writeJson(path.join(outDir, 'report.json'), {
    ok: results.every((result) => result.ok),
    outDir,
    sentence: args.sentence,
    framework: args.framework,
    results
  });
  writeText(path.join(outDir, 'report.md'), `${reportMarkdown({ args, outDir, results })}\n`);
  console.log(`Wrote provider effort artifacts to ${path.relative(REPO_ROOT, outDir)}`);
  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(redactSecrets(error?.stack || error?.message || String(error)));
  process.exit(1);
});
