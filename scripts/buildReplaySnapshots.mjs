import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReplaySnapshotProjection } from '../replay/replaySnapshot.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normalizedDir = path.join(repoRoot, 'fixtures', 'normalized');
const snapshotDir = path.join(repoRoot, 'fixtures', 'replay-snapshots');
const fixtureNames = fs.readdirSync(normalizedDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

if (fixtureNames.length === 0) {
  throw new Error(`No normalized fixtures found in ${normalizedDir}`);
}

fs.mkdirSync(snapshotDir, { recursive: true });
for (const fixtureName of fixtureNames) {
  const fixturePath = path.join(normalizedDir, fixtureName);
  const bundle = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const snapshot = buildReplaySnapshotProjection(bundle);
  const snapshotName = fixtureName.replace(/\.json$/, '.playback.json');
  fs.writeFileSync(
    path.join(snapshotDir, snapshotName),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8'
  );
  console.log(`${snapshotName}: ${snapshot.stepCount} steps`);
}
