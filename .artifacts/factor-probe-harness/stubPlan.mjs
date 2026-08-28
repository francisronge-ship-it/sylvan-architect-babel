import fs from 'node:fs';
import path from 'node:path';

import {
  AUTHORED_STAGE_FIELDS,
  FACTOR_KEYS,
  SETTLED_FIELD_IDENTITIES,
  canonicalJson,
  sha256
} from './factorProbeHarness.mjs';

const assignment = (factor, level) => {
  const material = {
    factor,
    kind: 'provider-free-stub-marker',
    level
  };
  return {
    level,
    materialId: `stub:${factor}:${level}`,
    materialSha256: sha256(canonicalJson(material))
  };
};

const baseAssignments = () => Object.fromEntries(
  FACTOR_KEYS.map((factor) => [factor, assignment(factor, 'baseline-marker')])
);

const makeArtifacts = (repoRoot) => ({
  contentsPromptSha256: sha256(fs.readFileSync(path.join(repoRoot, 'server/babelParser/prompts.js'))),
  contractSha256: sha256(canonicalJson({
    authoredStageFields: AUTHORED_STAGE_FIELDS,
    settledFieldIdentities: SETTLED_FIELD_IDENTITIES
  })),
  engineSha256: sha256(fs.readFileSync(path.join(repoRoot, 'server/babelParser.js'))),
  systemInstructionSha256: sha256(
    fs.readFileSync(path.join(repoRoot, 'server/babelParser/systemInstruction.js'))
  )
});

export const buildStubPlan = (repoRoot) => {
  const sourceRef = 'fixtures/raw/mia-laughed.xbar.json';
  const sourceBytes = fs.readFileSync(path.join(repoRoot, sourceRef));
  const sourceSha256 = sha256(sourceBytes);
  const artifacts = makeArtifacts(repoRoot);
  const runnerIdentity = {
    host: 'local-provider-free-stub',
    model: 'externally-supplied-stub-model',
    provider: 'externally-supplied-stub-provider',
    reasoning: {
      identity: 'externally-supplied-stub-reasoning',
      parameters: {}
    },
    suppliedBy: 'provider-free-stub-runner'
  };
  const input = {
    fixtureRole: 'provider-free-development-fixture',
    framework: 'xbar',
    sentence: 'Mia laughed.',
    sourceRef,
    sourceSha256
  };
  const makeRun = ({
    factors = baseAssignments(),
    id,
    role = 'factor-arm',
    stub = {
      kind: 'fixture-payload-json',
      sourceRef,
      sourceSha256
    }
  }) => ({
    artifacts,
    factors,
    id,
    input,
    role,
    runnerIdentity,
    stub
  });

  const baselineRun = makeRun({
    id: 'baseline',
    role: 'baseline'
  });
  const selfPairRun = makeRun({
    id: 'baseline-self-pair',
    role: 'self-pair'
  });
  const factorRuns = FACTOR_KEYS.map((factor) => {
    const factors = baseAssignments();
    factors[factor] = assignment(factor, 'probe-marker');
    return makeRun({
      factors,
      id: `factor-${factor}`
    });
  });
  const diagnosticCompileFailure = makeRun({
    id: 'diagnostic-contract-envelope',
    role: 'diagnostic',
    stub: {
      kind: 'fixture-file-bytes',
      sourceRef,
      sourceSha256
    }
  });
  const diagnosticParseFailure = makeRun({
    id: 'diagnostic-invalid-json',
    role: 'diagnostic',
    stub: {
      kind: 'inline-utf8',
      text: '{"derivationStages":'
    }
  });
  const assignmentsWith = (...factors) => {
    const assignments = baseAssignments();
    factors.forEach((factor) => {
      assignments[factor] = assignment(factor, 'probe-marker');
    });
    return assignments;
  };
  const smallFactorKeys = [
    'fieldNameWording',
    'carrier',
    'incompleteLeafRule',
    'ambiguityCriterion',
    'xbarNaryEscape'
  ];
  const sequenceSpecs = [
    {
      addedFactor: null,
      factors: smallFactorKeys,
      id: 'interaction-small-factor-combo',
      role: 'interaction-arm'
    },
    {
      addedFactor: 'restructuring',
      factors: [...smallFactorKeys, 'restructuring'],
      id: 'sequence-restructuring',
      role: 'sequence-arm'
    },
    {
      addedFactor: 'values',
      factors: [...smallFactorKeys, 'restructuring', 'values'],
      id: 'sequence-values',
      role: 'sequence-arm'
    },
    {
      addedFactor: 'priorAnchors',
      factors: [...smallFactorKeys, 'restructuring', 'values', 'priorAnchors'],
      id: 'sequence-priorAnchors',
      role: 'sequence-arm'
    },
    {
      addedFactor: 'dormantSkeletonUse',
      factors: [...FACTOR_KEYS],
      id: 'sequence-dormantSkeletonUse',
      role: 'sequence-arm'
    }
  ];
  const sequenceRuns = sequenceSpecs.map(({ factors, id, role }) => makeRun({
    factors: assignmentsWith(...factors),
    id,
    role
  }));

  return {
    comparisons: [
      {
        baselineRunId: baselineRun.id,
        factors: [],
        id: 'compare-baseline-self-pair',
        mode: 'self-pair',
        targetRunId: selfPairRun.id
      },
      ...FACTOR_KEYS.map((factor) => ({
        baselineRunId: baselineRun.id,
        factors: [factor],
        id: `compare-${factor}`,
        mode: 'single-factor',
        targetRunId: `factor-${factor}`
      })),
      {
        baselineRunId: baselineRun.id,
        factors: smallFactorKeys,
        id: 'compare-interaction-small-factor-combo',
        mode: 'multi-factor',
        targetRunId: 'interaction-small-factor-combo'
      },
      ...sequenceSpecs.slice(1).map((spec, index) => {
        return {
          baselineRunId: sequenceSpecs[index].id,
          factors: [spec.addedFactor],
          id: `compare-${spec.id}`,
          mode: 'single-factor',
          targetRunId: spec.id
        };
      })
    ],
    contract: {
      authoredStageFields: [...AUTHORED_STAGE_FIELDS],
      productionContractMutationAllowed: false,
      settledFieldIdentities: { ...SETTLED_FIELD_IDENTITIES }
    },
    intent: 'attribution-only-provider-neutral-probe',
    planId: 'slice4-provider-free-stub',
    runs: [
      baselineRun,
      selfPairRun,
      ...factorRuns,
      ...sequenceRuns,
      diagnosticCompileFailure,
      diagnosticParseFailure
    ],
    schemaVersion: 1
  };
};
