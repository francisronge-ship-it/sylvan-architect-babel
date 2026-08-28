import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);

const readArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? String(args[index + 1] || '') : fallback;
};

const runRoot = path.resolve(repoRoot, readArg(
  'run',
  '.artifacts/contract-qualification/plumbing-smoke'
));
const outputRoot = path.resolve(runRoot, readArg('out', 'review'));
const browserArgument = readArg('browser').trim();
if (!browserArgument) throw new Error('Provide --browser with an existing browser executable.');
const browserPath = path.resolve(browserArgument);
if (!fs.existsSync(browserPath)) throw new Error('Provide --browser with an existing browser executable.');
if (fs.existsSync(outputRoot) && fs.readdirSync(outputRoot).length > 0) {
  throw new Error(`Review output is not empty: ${outputRoot}`);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(() => resolve(port));
  });
  server.on('error', reject);
});

const waitForServer = async (url) => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await wait(150);
  }
  throw new Error(`Vite did not become ready at ${url}.`);
};

const stopOwnedProcess = async (child, timeoutMs = 5000) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    wait(timeoutMs).then(() => false)
  ]);
  if (stopped || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGKILL');
  await Promise.race([exited, wait(2000)]);
};

const collectFiles = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  visit(root);
  return files.sort();
};

const reviewPlan = readJson(path.join(runRoot, 'review-plan.json'));
const runReceiptBytes = fs.readFileSync(path.join(runRoot, 'run-receipt.json'));
if (!Array.isArray(reviewPlan.entries) || reviewPlan.entries.length === 0) {
  throw new Error('Review plan contains no successful analyses.');
}

fs.mkdirSync(outputRoot, { recursive: true });
const port = await findFreePort();
const appUrl = `http://127.0.0.1:${port}`;
const vite = spawn(
  process.execPath,
  [
    path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort'
  ],
  { cwd: repoRoot, stdio: 'ignore' }
);

try {
  await waitForServer(appUrl);
  for (const entry of reviewPlan.entries) {
    const bundlePath = path.join(runRoot, entry.bundle);
    const destination = path.join(
      outputRoot,
      entry.attemptId,
      `analysis-${entry.analysisIndex + 1}`
    );
    fs.mkdirSync(destination, { recursive: true });
    const capture = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'scripts', 'captureReplayArtifact.mjs'),
        '--bundle', bundlePath,
        '--analysis-index', String(entry.analysisIndex),
        '--out', destination,
        '--browser', browserPath,
        '--app-url', appUrl
      ],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    if (capture.status !== 0 || capture.signal || capture.error) {
      throw new Error(
        `Capture failed for ${entry.attemptId} analysis ${entry.analysisIndex + 1}: `
        + `${capture.error?.message || capture.stderr || capture.signal || capture.status}`
      );
    }
  }
} finally {
  await stopOwnedProcess(vite);
}

const rows = reviewPlan.entries.map((entry) => {
  const viewer = path.relative(
    outputRoot,
    path.join(
      outputRoot,
      entry.attemptId,
      `analysis-${entry.analysisIndex + 1}`,
      'replay-viewer.html'
    )
  ).split(path.sep).join('/');
  return `<tr>
    <td>${escapeHtml(entry.attemptId)}</td>
    <td>${escapeHtml(entry.sentence)}</td>
    <td>${escapeHtml(entry.framework)}</td>
    <td>${escapeHtml(entry.model.label)}</td>
    <td>Parse ${entry.analysisIndex + 1}</td>
    <td><a href="${escapeHtml(viewer)}">Open Replay</a></td>
  </tr>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Babel contract qualification review</title>
  <style>
    body { margin: 0; padding: 32px; color: #dffcf2; background: #06110e; font: 15px/1.5 system-ui, sans-serif; }
    main { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 26px; letter-spacing: 0; }
    p { color: #9cc7b9; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { padding: 12px; border-bottom: 1px solid #17483b; text-align: left; vertical-align: top; }
    th { color: #73e3be; font-size: 12px; text-transform: uppercase; }
    a { color: #7df1c9; font-weight: 750; }
  </style>
</head>
<body><main>
  <h1>Contract qualification review</h1>
  <p>Provider-free plumbing proof. These are fixture responses, not qualification items or model results.</p>
  <table>
    <thead><tr><th>Attempt</th><th>Sentence</th><th>Framework</th><th>Model setting</th><th>Analysis</th><th>Viewer</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main></body>
</html>`;
fs.writeFileSync(path.join(outputRoot, 'index.html'), html, 'utf8');

const artifactFiles = collectFiles(outputRoot)
  .filter((filePath) => path.basename(filePath) !== 'review-receipt.json')
  .map((filePath) => {
    const bytes = fs.readFileSync(filePath);
    return {
      path: path.relative(outputRoot, filePath).split(path.sep).join('/'),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes)
    };
  });
const receiptBase = {
  schemaVersion: 1,
  runReceiptSha256: sha256(runReceiptBytes),
  providerCallsMade: false,
  analysisCount: reviewPlan.entries.length,
  artifacts: artifactFiles
};
const reviewReceipt = {
  ...receiptBase,
  receiptSha256: sha256(Buffer.from(JSON.stringify(receiptBase), 'utf8'))
};
fs.writeFileSync(
  path.join(outputRoot, 'review-receipt.json'),
  `${JSON.stringify(reviewReceipt, null, 2)}\n`,
  'utf8'
);

console.log(path.relative(repoRoot, path.join(outputRoot, 'index.html')));
console.log(reviewReceipt.receiptSha256);
