import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateProbeCost } from './probeCost.mjs';
import { evaluatePhaseOneCandidateDesigns } from './probeDesign.mjs';
import {
  validateBlindedVerdictRecord,
  validateLossAdjudicationRecord
} from './probeRecords.mjs';
import { buildCarrierParameterizedProbeRequest } from './probeRequest.mjs';

const hash = (digit = '0') => digit.repeat(64);

test('blinded verdict records expose no model or arm identity', () => {
  const record = validateBlindedVerdictRecord({
    schemaVersion: 1,
    comparisonId: 'comparison-1',
    pairId: 'pair-1',
    presentationOrder: ['artifact://opaque-left', 'artifact://opaque-right'],
    verdict: 'tie',
    rationale: 'No preference under the externally supplied rubric.',
    reviewerIdentity: 'external-reviewer',
    rubricRef: 'external://rubric',
    blindingRecordRef: 'artifact://blinding-record'
  });

  assert.ok(Object.isFrozen(record));
  assert.deepEqual(Object.keys(record).sort(), [
    'blindingRecordRef',
    'comparisonId',
    'pairId',
    'presentationOrder',
    'rationale',
    'reviewerIdentity',
    'rubricRef',
    'schemaVersion',
    'verdict'
  ]);
});

test('loss adjudication requires outcome-specific evidence', () => {
  const record = validateLossAdjudicationRecord({
    schemaVersion: 1,
    comparisonId: 'comparison-1',
    pairId: 'pair-1',
    verdictRecordRef: 'artifact://verdict-1',
    outcome: 'not-attributable-to-factor',
    evidence: {
      incumbentDistributionRef: 'artifact://incumbent-distribution',
      nonIncreaseRef: 'artifact://non-increase'
    },
    rationale: 'Both protocol-required evidence branches are supplied externally.',
    adjudicatorIdentity: 'external-adjudicator',
    protocolRef: 'external://quality-protocol'
  });
  assert.ok(Object.isFrozen(record.evidence));

  assert.throws(() => validateLossAdjudicationRecord({
    ...record,
    evidence: {
      incumbentDistributionRef: 'artifact://incumbent-distribution'
    }
  }), /missing=\[nonIncreaseRef\]/u);
});

test('phase-one design evaluation reports every candidate without selecting one', () => {
  const result = evaluatePhaseOneCandidateDesigns({
    schemaVersion: 1,
    declarationRef: 'external://s0-declaration',
    declarationSha256: hash('1'),
    targets: [
      {
        id: 'precision-target',
        metric: 'upperBound',
        direction: 'at-most',
        threshold: 0.05
      },
      {
        id: 'coverage-target',
        metric: 'coverage',
        direction: 'at-least',
        threshold: 0.9
      }
    ],
    candidates: [
      {
        id: 'external-candidate-a',
        quantities: {
          externallySuppliedRuns: 12
        },
        posteriorDraws: [
          {
            drawId: 'draw-a1',
            metrics: {
              coverage: 0.91,
              upperBound: 0.04
            }
          },
          {
            drawId: 'draw-a2',
            metrics: {
              coverage: 0.89,
              upperBound: 0.06
            }
          }
        ]
      },
      {
        id: 'external-candidate-b',
        quantities: {
          externallySuppliedRuns: 24
        },
        posteriorDraws: [
          {
            drawId: 'draw-b1',
            metrics: {
              coverage: 0.95,
              upperBound: 0.03
            }
          }
        ]
      }
    ]
  });

  assert.deepEqual(
    result.evaluations.map(({ candidateId }) => candidateId),
    ['external-candidate-a', 'external-candidate-b']
  );
  assert.deepEqual(result.evaluations[0].summary, {
    allTargetsMetCount: 1,
    allTargetsMetFraction: 0.5
  });
  assert.equal(Object.hasOwn(result, 'selectedCandidate'), false);
  assert.equal(Object.hasOwn(result, 'recommendedCandidate'), false);
  assert.ok(Object.isFrozen(result.evaluations[0].draws));
});

test('design evaluation rejects missing target metrics', () => {
  assert.throws(() => evaluatePhaseOneCandidateDesigns({
    schemaVersion: 1,
    declarationRef: 'external://s0-declaration',
    declarationSha256: hash('2'),
    targets: [{
      id: 'target',
      metric: 'requiredMetric',
      direction: 'at-least',
      threshold: 1
    }],
    candidates: [{
      id: 'candidate',
      quantities: {},
      posteriorDraws: [{
        drawId: 'draw',
        metrics: {}
      }]
    }]
  }), /metrics fields must be exact; missing=\[requiredMetric\]/u);
});

test('cost estimate follows external BM-formula inputs without supplying quantities', () => {
  const result = estimateProbeCost({
    schemaVersion: 1,
    cells: [{
      id: 'external-cell',
      runs: 2,
      tokensPerRun: {
        inputUncached: 10,
        inputCached: 5,
        output: 4,
        reasoning: 3
      },
      pricesPerToken: {
        inputUncached: 0.1,
        inputCached: 0.05,
        output: 0.2,
        reasoning: 0.2
      }
    }],
    human: {
      judgedRuns: 10,
      minutesPerJudgment: 6,
      doubleRatingShare: 0.5,
      disagreementRate: 0.2,
      minutesPerAdjudication: 3,
      calibrationHours: 2,
      auditHours: 1
    }
  });

  assert.equal(result.apiCostUsd, 5.3);
  assert.equal(result.humanHours, 4.6);
  assert.deepEqual(result.cells[0].tokensPerRun, {
    inputUncached: 10,
    inputCached: 5,
    output: 4,
    reasoning: 3
  });
  assert.deepEqual(result.humanComponents, {
    adjudicationHours: 0.1,
    primaryHours: 1.5
  });
  assert.equal(Object.hasOwn(result, 'sampleSize'), false);
  assert.ok(Object.isFrozen(result));
});

test('cost estimate rejects invalid externally supplied proportions', () => {
  assert.throws(() => estimateProbeCost({
    schemaVersion: 1,
    cells: [{
      id: 'external-cell',
      runs: 1,
      tokensPerRun: {
        inputUncached: 0,
        inputCached: 0,
        output: 0,
        reasoning: 0
      },
      pricesPerToken: {
        inputUncached: 0,
        inputCached: 0,
        output: 0,
        reasoning: 0
      }
    }],
    human: {
      judgedRuns: 0,
      minutesPerJudgment: 0,
      doubleRatingShare: 1.1,
      disagreementRate: 0,
      minutesPerAdjudication: 0,
      calibrationHours: 0,
      auditHours: 0
    }
  }), /doubleRatingShare must be at most 1/u);
});

test('carrier-parameterized request preserves external identities and refuses temperature', () => {
  const requestInput = {
    schemaVersion: 1,
    requestId: 'request-1',
    runnerIdentity: {
      provider: 'external-provider',
      model: 'external-model',
      host: 'external-host',
      reasoning: {
        identity: 'external-reasoning',
        parameters: {
          externallySupplied: true
        }
      },
      suppliedBy: 'external-runner'
    },
    carrier: {
      identity: 'external-carrier',
      mediaType: 'application/octet-stream',
      payloadArtifactRef: 'artifact://payload',
      payloadSha256: hash('3')
    },
    sentParameters: {
      externallySuppliedLimit: 100
    },
    temperaturePolicy: {
      mode: 'omitted'
    },
    provenance: {
      declarationRef: 'external://request-declaration'
    }
  };
  const request = buildCarrierParameterizedProbeRequest(requestInput);

  assert.equal(request.executionBoundary, 'external-runner-only');
  assert.equal(request.carrier.identity, 'external-carrier');
  assert.ok(Object.isFrozen(request.runnerIdentity.reasoning.parameters));

  assert.throws(() => buildCarrierParameterizedProbeRequest({
    ...requestInput,
    sentParameters: {
      generationConfig: {
        temperature: 0.2
      }
    }
  }), /prohibited when temperaturePolicy\.mode is omitted/u);

  const requiredDefault = buildCarrierParameterizedProbeRequest({
    ...requestInput,
    requestId: 'request-default-required',
    sentParameters: {
      generationConfig: {
        temperature: 1
      }
    },
    temperaturePolicy: {
      mode: 'default-required',
      documentedDefault: 1,
      documentationRef: 'external://provider-model-page'
    }
  });
  assert.equal(requiredDefault.temperaturePolicy.mode, 'default-required');

  assert.throws(() => buildCarrierParameterizedProbeRequest({
    ...requestInput,
    requestId: 'request-mismatched-default',
    sentParameters: {
      temperature: 0.2
    },
    temperaturePolicy: {
      mode: 'default-required',
      documentedDefault: 1,
      documentationRef: 'external://provider-model-page'
    }
  }), /exactly one temperature equal to the externally documented default/u);
});

test('planning utilities reject extra policy-bearing fields', () => {
  assert.throws(() => validateBlindedVerdictRecord({
    schemaVersion: 1,
    comparisonId: 'comparison-1',
    pairId: 'pair-1',
    presentationOrder: ['artifact://left', 'artifact://right'],
    verdict: 'tie',
    rationale: 'Stub.',
    reviewerIdentity: 'external-reviewer',
    rubricRef: 'external://rubric',
    blindingRecordRef: 'artifact://blinding-record',
    winner: 'left'
  }), /extra=\[winner\]/u);
});
