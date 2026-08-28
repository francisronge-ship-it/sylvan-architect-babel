import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const defaultOutput = path.join(
  repoRoot,
  'docs/implementation/contract-qualification/incumbent-contract.manifest.json'
);

const explicitSections = {
  captureTool: [
    'scripts/captureContractFingerprint.mjs'
  ],
  authoredContract: [
    'server/babelParser/systemInstruction.js',
    'server/babelParser/prompts.js'
  ],
  requestBoundary: [
    'App.tsx',
    'api/parse.js',
    'server/parseApi.js',
    'server/index.js',
    'services/parseService.ts',
    'types.ts',
    'vite.config.ts'
  ],
  providerBoundary: [
    'server/babelParser/routeConfig.js',
    'server/babelParser/modelRuntime.js',
    'server/babelParser/parseRoutes.js',
    'server/babelParser/generationRecord.js'
  ],
  deterministicIngress: [
    'server/babelParser.js',
    'server/babelParser/constants.js',
    'server/babelParser/derivationCompiler.js',
    'server/babelParser/derivationHelpers.js',
    'server/babelParser/error.js',
    'server/babelParser/inventionDetector.js',
    'server/babelParser/normalizationUtils.js',
    'server/babelParser/parseNormalization.js',
    'server/babelParser/provenance.js',
    'server/babelParser/strictJson.js',
    'server/babelParser/surfaceTokens.js',
    'server/babelParser/syntaxTree.js',
    'server/babelParser/treeBasics.js',
    'server/babelParser/validationErrors.js',
    'legacyCaseMetadata.js'
  ],
  dependencyLock: [
    'package.json',
    'package-lock.json'
  ]
};

const recursiveSections = {
  replayEngine: {
    root: 'replay',
    include: (relativePath) => /\.(?:js|ts)$/.test(relativePath)
  },
  providerFreeFixtures: {
    root: 'fixtures',
    include: (relativePath) => /^(?:raw|normalized|replay-snapshots)\//.test(relativePath)
  },
  providerFreeTests: {
    root: 'tests',
    include: (relativePath) => (
      /\.test\.mjs$/.test(relativePath)
      && !relativePath.startsWith('benchmark')
      && !relativePath.startsWith('derivationalDatabase')
    )
  }
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const listFiles = (relativeRoot, include) => {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  const found = [];
  const visit = (absoluteDirectory) => {
    const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = path.relative(absoluteRoot, absolutePath).split(path.sep).join('/');
      if (include(relativePath)) {
        found.push(path.posix.join(relativeRoot, relativePath));
      }
    }
  };
  visit(absoluteRoot);
  return found;
};

const fileReceipt = (relativePath) => {
  const bytes = fs.readFileSync(path.join(repoRoot, relativePath));
  return {
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
};

const sectionReceipt = (paths) => {
  const files = [...new Set(paths)].sort().map(fileReceipt);
  const digestInput = files.map(({ path: filePath, sha256: digest }) => `${filePath}\0${digest}\n`).join('');
  return {
    sha256: sha256(digestInput),
    fileCount: files.length,
    files
  };
};

const sectionPaths = Object.fromEntries([
  ...Object.entries(explicitSections),
  ...Object.entries(recursiveSections).map(([name, definition]) => [
    name,
    listFiles(definition.root, definition.include)
  ])
]);

const auditedSourcePaths = Object.entries(sectionPaths)
  .filter(([name]) => name !== 'captureTool')
  .flatMap(([, paths]) => paths);

try {
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...auditedSourcePaths], {
    cwd: repoRoot,
    stdio: 'ignore'
  });
} catch {
  throw new Error('Contract fingerprint refused: an audited source differs from HEAD.');
}

const untrackedAuditedPaths = execFileSync(
  'git',
  ['ls-files', '--others', '--exclude-standard', '--', ...auditedSourcePaths],
  { cwd: repoRoot, encoding: 'utf8' }
).trim();
if (untrackedAuditedPaths) {
  throw new Error(
    `Contract fingerprint refused: audited sources are untracked:\n${untrackedAuditedPaths}`
  );
}

const sections = Object.fromEntries(
  Object.entries(sectionPaths).map(([name, paths]) => [name, sectionReceipt(paths)])
);

const overallInput = Object.entries(sections)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, section]) => `${name}\0${section.sha256}\n`)
  .join('');

const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8'
}).trim();

const manifest = {
  schemaVersion: 1,
  label: 'program-1-incumbent-contract',
  repositoryCommit: gitCommit,
  auditedSourcesMatchCommit: true,
  overallSha256: sha256(overallInput),
  sections
};

const outputArgumentIndex = process.argv.indexOf('--out');
const outputPath = outputArgumentIndex >= 0
  ? path.resolve(repoRoot, process.argv[outputArgumentIndex + 1])
  : defaultOutput;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(path.relative(repoRoot, outputPath));
console.log(manifest.overallSha256);
