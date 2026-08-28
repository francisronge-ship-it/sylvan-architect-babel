const fs = require('node:fs');

function loadChromium() {
  try {
    return require('playwright').chromium;
  } catch (error) {
    const message = [
      'Playwright is required for this browser harness.',
      'Install it before running capture/sweep scripts, and install a Chromium browser if needed.',
      'You may set BABEL_CHROME_BIN to an existing Chromium/Chrome executable.',
      `Original error: ${error?.message || String(error)}`
    ].join(' ');
    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
}

function resolveChromiumLaunchOptions({ headless = true } = {}) {
  const executablePath = String(
    process.env.BABEL_CHROME_BIN ||
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    ''
  ).trim();

  if (!executablePath) return { headless };

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Configured Chromium executable does not exist: ${executablePath}`);
  }

  return { headless, executablePath };
}

module.exports = {
  loadChromium,
  resolveChromiumLaunchOptions
};
