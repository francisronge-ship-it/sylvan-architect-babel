import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);

const readArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  return args[index + 1] || fallback;
};

const renderDir = path.resolve(readArg('render-dir'));
const outDir = path.resolve(readArg('out'));
const browserPath = readArg('browser', process.env.BABEL_CHROME_BIN || '');
const cols = Math.max(1, Number(readArg('cols', '2')) || 2);
const framesPerSheet = Math.max(1, Number(readArg('frames-per-sheet', '12')) || 12);
const viewportWidth = Math.max(800, Number(readArg('width', '1800')) || 1800);
const viewportHeight = Math.max(800, Number(readArg('height', '1200')) || 1200);

if (!renderDir || !fs.existsSync(renderDir)) {
  console.error('Missing --render-dir.');
  process.exit(1);
}
if (!outDir) {
  console.error('Missing --out.');
  process.exit(1);
}
if (!browserPath || !fs.existsSync(browserPath)) {
  console.error('Missing browser executable. Pass --browser or set BABEL_CHROME_BIN.');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));

const replayCount = (() => {
  const summaryPath = path.join(renderDir, 'render-summary.json');
  if (fs.existsSync(summaryPath)) {
    const summary = readJson(summaryPath);
    if (Number.isInteger(summary.replayCount) && summary.replayCount > 0) return summary.replayCount;
  }
  return fs.readdirSync(renderDir)
    .filter((name) => /^replay-\d+\.png$/i.test(name))
    .length;
})();

if (replayCount < 1) {
  console.error(`No replay frames found in ${renderDir}.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pad = (value) => String(value).padStart(2, '0');
const fileUrl = (filePath) => pathToFileURL(filePath).href;

const buildHtml = (sheetIndex, frames) => {
  const rows = Math.ceil(frames.length / cols);
  const title = `${path.basename(renderDir)} frames ${frames[0] + 1}-${frames.at(-1) + 1}`;
  const cellWidth = Math.floor((viewportWidth - 80 - (cols - 1) * 18) / cols);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #06110e;
      color: #dffcf2;
      font-family: system-ui, sans-serif;
    }
    h1 {
      margin: 0 0 18px;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${cols}, ${cellWidth}px);
      gap: 18px;
      align-items: start;
    }
    figure {
      margin: 0;
      border: 1px solid #1c6b58;
      background: #071713;
    }
    figcaption {
      padding: 8px 10px;
      color: #8ffff0;
      font-weight: 800;
      font-size: 14px;
      border-bottom: 1px solid #164438;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="grid">
    ${frames.map((frameIndex) => {
      const imagePath = path.join(renderDir, `replay-${pad(frameIndex)}.png`);
      return `<figure>
        <figcaption>Frame ${frameIndex + 1} / ${replayCount}</figcaption>
        <img src="${fileUrl(imagePath)}" alt="Frame ${frameIndex + 1}">
      </figure>`;
    }).join('\n')}
  </div>
</body>
</html>`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = (url) => new Promise((resolve, reject) => {
  const req = http.get(url, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`${url} returned HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        return;
      }
      resolve(JSON.parse(body));
    });
  });
  req.on('error', reject);
  req.setTimeout(5000, () => req.destroy(new Error(`Timed out fetching ${url}`)));
});

const waitFor = async (fn, timeoutMs, label) => {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await wait(120);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
};

const findFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(() => resolve(port));
  });
  server.on('error', reject);
});

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolve(message.result);
    });
  }

  command(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

const captureSheet = async (htmlPath, pngPath) => {
  const browserDebugPort = await findFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-contact-sheet-'));
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${browserDebugPort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${viewportWidth},${viewportHeight}`,
    fileUrl(htmlPath)
  ], { stdio: 'ignore' });

  try {
    const target = await waitFor(async () => {
      const targets = await fetchJson(`http://127.0.0.1:${browserDebugPort}/json/list`);
      return Array.isArray(targets) && targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    }, 10000, 'browser target');

    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.command('Page.enable');
    await client.command('Emulation.setDeviceMetricsOverride', {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(600);
    const result = await client.command('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      fromSurface: true
    });
    fs.writeFileSync(pngPath, Buffer.from(result.data, 'base64'));
    client.close();
  } finally {
    browser.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Disposable browser profile cleanup can briefly lag behind browser exit.
    }
  }
};

const pngs = [];
for (let start = 0, sheetIndex = 1; start < replayCount; start += framesPerSheet, sheetIndex += 1) {
  const frames = Array.from(
    { length: Math.min(framesPerSheet, replayCount - start) },
    (_, index) => start + index
  );
  const stem = `contact-sheet-${pad(sheetIndex)}`;
  const htmlPath = path.join(outDir, `${stem}.html`);
  const pngPath = path.join(outDir, `${stem}.png`);
  fs.writeFileSync(htmlPath, buildHtml(sheetIndex, frames), 'utf8');
  await captureSheet(htmlPath, pngPath);
  pngs.push(pngPath);
}

const summary = {
  renderDir,
  outDir,
  replayCount,
  framesPerSheet,
  cols,
  sheets: pngs
};
fs.writeFileSync(path.join(outDir, 'contact-sheets.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`Wrote ${pngs.length} contact sheet(s) to ${path.relative(process.cwd(), outDir)}`);
