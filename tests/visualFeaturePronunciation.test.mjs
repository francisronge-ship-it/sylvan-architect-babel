import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';

const repo = fileURLToPath(new URL('..', import.meta.url));

const loadAtlasCases = async (t) => {
  const outfile = join(
    tmpdir(),
    `babel-feature-pronunciation-${process.pid}-${Date.now()}.mjs`
  );
  t.after(() => rm(outfile, { force: true }));
  await build({
    entryPoints: [`${repo}/docs/design/visual-relations-current-lab.tsx`],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent'
  });
  return (await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`)).rawCases;
};

const collectFeaturePronunciationFailures = (
  node,
  inheritedSilent,
  context,
  failures
) => {
  if (!node) return;
  const silent = inheritedSilent || node.silent === true || node.ghost === true;
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length > 0) {
    children.forEach((child) => collectFeaturePronunciationFailures(
      child,
      silent,
      context,
      failures
    ));
    return;
  }

  const surface = String(node.word || node.label || '').trim();
  if (/^\[[^\]]+\]$/.test(surface) && !silent) {
    failures.push(`${context}: ${node.id || '(missing id)'} renders ${surface} as pronounced`);
  }
};

test('Atlas feature notation is silent in every Replay stage', async (t) => {
  const rawCases = await loadAtlasCases(t);
  const failures = [];

  rawCases.forEach((card) => {
    (card.derivationStages || []).forEach((stage, stageIndex) => {
      (stage.workspaceForest || []).forEach((root) => collectFeaturePronunciationFailures(
        root,
        false,
        `${card.title} stage ${stageIndex + 1}`,
        failures
      ));
    });
  });

  assert.deepEqual(failures, []);
});
