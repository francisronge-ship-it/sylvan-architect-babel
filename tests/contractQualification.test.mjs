import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import {
  runQualificationAttempt,
  validateQualificationPlan
} from '../contractQualification/index.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const fixture = JSON.parse(
  fs.readFileSync(new URL('../fixtures/raw/mia-laughed.xbar.json', import.meta.url), 'utf8')
);

const plan = (overrides = {}) => ({
  schemaVersion: 1,
  label: 'plumbing-only',
  purpose: 'Test the qualification runner without selecting qualification items.',
  itemSetStatus: 'unselected',
  contractManifest: 'docs/implementation/contract-qualification/example.json',
  attempts: [
    {
      id: 'attempt-1',
      request: { sentence: fixture.sentence, framework: fixture.framework },
      model: {
        catalogId: 'openai:gpt-5.6-sol',
        nativeSettings: { 'reasoning.effort': 'high' }
      },
      source: {
        kind: 'committed-fixture-payload',
        path: 'fixtures/raw/mia-laughed.xbar.json'
      }
    }
  ],
  ...overrides
});

test('qualification plans distinguish plumbing smoke data from a selected item set', () => {
  const validated = validateQualificationPlan(plan());
  assert.equal(validated.itemSetStatus, 'unselected');
  assert.equal(validated.attempts[0].model.providerModel, 'gpt-5.6-sol');
  assert.equal(validated.attempts[0].model.qualificationStatus, 'unqualified');

  assert.throws(
    () => validateQualificationPlan(plan({ itemSetStatus: 'approved' })),
    /itemSetStatus/
  );
  assert.throws(
    () => validateQualificationPlan({ ...plan(), hiddenDefault: true }),
    /fields must be exactly/
  );
});

test('qualification plans preserve the exact submitted sentence', () => {
  const input = plan();
  input.attempts[0].request.sentence = '  Mia laughed.\n';
  const validated = validateQualificationPlan(input);
  assert.equal(validated.attempts[0].request.sentence, '  Mia laughed.\n');
});

test('a valid saved response preserves raw bytes and prepares every analysis for review', () => {
  const [attempt] = validateQualificationPlan(plan()).attempts;
  const rawText = `  ${JSON.stringify(fixture.payload)}\n`;
  const result = runQualificationAttempt({
    attempt,
    rawOutputBytes: Buffer.from(rawText, 'utf8')
  });

  assert.equal(result.receipt.rawOutput.byteLength, Buffer.byteLength(rawText));
  assert.equal(result.receipt.rawOutput.sha256, sha256(rawText));
  assert.deepEqual(result.receipt.outcome, {
    reviewDisposition: 'unreviewed',
    status: 'valid-pending-review'
  });
  assert.equal(result.bundle.analyses.length, 1);
  assert.equal(result.analysisBundles.length, 1);
  assert.equal(result.replayProjections.length, 1);
  assert.ok(result.replayProjections[0].stepCount > 0);
  assert.equal(result.bundle.modelUsed, 'gpt-5.6-sol');
  assert.equal(result.bundle.analyses[0].provenance.timestamp, undefined);
});

test('JSON repairs and typed failures remain visible in qualification receipts', () => {
  const [attempt] = validateQualificationPlan(plan()).attempts;
  const valid = JSON.stringify(fixture.payload);
  const repaired = runQualificationAttempt({
    attempt,
    rawOutputBytes: Buffer.from(valid.slice(0, -1), 'utf8')
  });
  assert.equal(repaired.receipt.outcome.status, 'valid-pending-review');
  assert.deepEqual(repaired.receipt.ingress.integrityFlags, ['json_delimiter_damage_repaired']);
  assert.equal(
    repaired.receipt.ingress.repairDiagnostics[0].kind,
    'append_closers_at_end_of_output'
  );

  const malformed = runQualificationAttempt({
    attempt,
    rawOutputBytes: Buffer.from('{not-json', 'utf8')
  });
  assert.equal(malformed.receipt.outcome.status, 'failed');
  assert.equal(malformed.receipt.outcome.phase, 'json-ingress');
  assert.equal(malformed.receipt.outcome.failure.class, 'transport_serialization');

  const wrongEnvelope = runQualificationAttempt({
    attempt,
    rawOutputBytes: Buffer.from('{"other":true}', 'utf8')
  });
  assert.equal(wrongEnvelope.receipt.outcome.status, 'failed');
  assert.equal(wrongEnvelope.receipt.outcome.phase, 'normalization');
  assert.equal(wrongEnvelope.receipt.outcome.failure.class, 'contract_misunderstanding');
});

test('non-UTF-8 output fails before JSON parsing without changing the bytes', () => {
  const [attempt] = validateQualificationPlan(plan()).attempts;
  const bytes = Buffer.from([0xff, 0xfe, 0xfd]);
  const result = runQualificationAttempt({ attempt, rawOutputBytes: bytes });
  assert.equal(result.receipt.rawOutput.sha256, sha256(bytes));
  assert.equal(result.receipt.outcome.phase, 'transport');
  assert.equal(result.receipt.outcome.failure.class, 'transport_serialization');
});
