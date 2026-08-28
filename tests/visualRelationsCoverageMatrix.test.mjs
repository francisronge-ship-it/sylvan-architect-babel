import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  VISUAL_RELATIONS_FIXTURE_COVERAGE,
  VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID,
  summarizeVisualRelationsFixtureCoverage
} from '../docs/design/visual-relations-coverage-matrix.ts';

const expectedFixtureIds = [
  ...Array.from({ length: 62 }, (_unused, index) => `F${String(index + 1).padStart(2, '0')}`),
  'F63',
  'F64',
  'F65',
  'F67'
];

test('coverage matrix contains every Sol fixture and every Fable additive fixture exactly once', () => {
  const actualIds = VISUAL_RELATIONS_FIXTURE_COVERAGE.map((entry) => entry.id);
  assert.deepEqual(actualIds, expectedFixtureIds);
  assert.equal(new Set(actualIds).size, actualIds.length);
  assert.equal(VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID.size, actualIds.length);
});

test('coverage totals preserve the baseline, CE-2, exclusion, and additive tracks', () => {
  assert.deepEqual(summarizeVisualRelationsFixtureCoverage(), {
    total: 66,
    statuses: {
      covered: 43,
      partial: 0,
      fallback: 3,
      missing: 0,
      excluded: 20
    },
    tracks: {
      'baseline-direct': 34,
      'baseline-replay': 2,
      'lab-ce2': 6,
      excluded: 20,
      'fable-additive': 4
    }
  });
});

test('every claimed card title exists in the live Lab', async () => {
  const source = await readFile(
    new URL('../docs/design/visual-relations-current-lab.tsx', import.meta.url),
    'utf8'
  );
  const activeTitles = new Set(
    Array.from(source.matchAll(/^    title: '([^']+)',$/gm), (match) => match[1])
      .filter((title) => !title.endsWith(' (inactive)'))
  );

  VISUAL_RELATIONS_FIXTURE_COVERAGE.forEach((entry) => {
    entry.cardTitles.forEach((title) => {
      assert.ok(activeTitles.has(title), `${entry.id} names missing or inactive Lab card: ${title}`);
    });
  });
});

test('unfinished fixtures state a next action; fallback entries point to production truth', () => {
  VISUAL_RELATIONS_FIXTURE_COVERAGE
    .filter((entry) => entry.status === 'partial' || entry.status === 'missing')
    .forEach((entry) => {
      assert.ok(entry.nextAction, `${entry.id} is unfinished without a next action`);
    });

  // The production topology fallback is implemented and accepted; every
  // fallback-status entry must cite the production tests that prove it and
  // must not carry a stale deferral action.
  const fallbackEntries = VISUAL_RELATIONS_FIXTURE_COVERAGE.filter((entry) => entry.status === 'fallback');
  assert.deepEqual(fallbackEntries.map((entry) => entry.id), ['F07', 'F09', 'F15']);
  fallbackEntries.forEach((entry) => {
    assert.match(entry.basis, /tests\/visualRelation/, `${entry.id} must point to a production test`);
    assert.equal(entry.nextAction, undefined, `${entry.id} carries a stale deferral action`);
  });
  assert.match(
    VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID.get('F09').basis,
    /NO invented 2-by-3 hyperedge/,
    'F09 must state explicitly that no 2-by-3 hyperedge is invented'
  );
  // The ledger must state the persistence law production actually enforces:
  // unregistered fallback persists from-stage-onward (see the fallback
  // persistence test in tests/visualRelationRenderPlan.test.mjs).
  assert.match(
    VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID.get('F07').basis,
    /from-stage-onward/,
    'F07 must state the from-stage-onward fallback persistence law'
  );
  assert.doesNotMatch(
    VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID.get('F07').basis,
    /stage-only/,
    'F07 must not contradict production fallback persistence'
  );
  assert.match(
    VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID.get('F67').basis,
    /tests\/visualRelationFinalRepair\.test\.mjs/,
    'F67 must cite its no-guess regression'
  );
});

test('research requirements distinguish reuse, validation, and new-source work', () => {
  const needs = (id) => VISUAL_RELATIONS_FIXTURE_COVERAGE_BY_ID.get(id).researchNeed;

  assert.equal(needs('F02'), 'none');
  assert.equal(needs('F16'), 'none');
  assert.equal(needs('F23'), 'none');
  assert.equal(needs('F30'), 'none');
  assert.equal(needs('F58'), 'none');
  assert.equal(needs('F61'), 'none');
  assert.equal(needs('F63'), 'none');
  assert.equal(needs('F65'), 'none');
  assert.equal(needs('F35'), 'none');
  assert.equal(needs('F37'), 'none');
  assert.equal(needs('F67'), 'none');
  assert.equal(needs('F31'), 'none');
});
