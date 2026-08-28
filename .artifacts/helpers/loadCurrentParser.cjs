const path = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function loadCurrentParser() {
  const parserPath = path.resolve(__dirname, '../../server/babelParser.js');

  try {
    return await import(pathToFileURL(parserPath).href);
  } catch (error) {
    const message = [
      `Failed to load the current Babel parser from ${parserPath}.`,
      'This harness expects the post-rename parser module at server/babelParser.js.',
      `Original error: ${error?.message || String(error)}`
    ].join(' ');
    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
};
