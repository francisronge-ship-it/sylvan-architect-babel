# Provider-neutral factor/probe harness

This directory is W3/Slice 4 research infrastructure. It does not modify or
import itself into Babel's product routes, prompts, system instruction, browser
types, or authored contract. It contains no benchmark items, scoring, winner
logic, roster, tier policy, sample sizes, reviewer quantities, or publication
rules.

The harness records six independent assignment axes:

1. `restructuring`
2. `values`
3. `priorAnchors`
4. `fieldNameWording`
5. `carrier`
6. `dormantSkeletonUse`

`values` and `priorAnchors` are settled identities. `fieldNameWording` can
describe externally supplied explanatory wording, but cannot rename either
field. Every run must also declare the settled four-field authored baseline:
`statement`, `stageRecord`, `visualRelations`, and `workspaceForest`.

Factor levels are opaque caller-supplied identities with exact material hashes.
The harness does not interpret a level as better, adopted, or rejected. A
single-factor comparison is accepted only when the input, runner identity, and
engine identity match and exactly one assignment digest differs. Effective
prompt and contract hashes may differ and are archived as arm provenance; the
changed factor's material hash is the attribution boundary.

The runner identity is supplied as data and is not checked against a roster:
provider, model, host, reasoning identity, and exact reasoning parameters are
archived verbatim. Carrier is likewise an opaque factor assignment; transport
is injected by the caller. The included transport is a provider-free stub only.

Raw response bytes are written before parsing and read back for byte-identity
verification. Receipts record the raw-byte hash and relative archive path,
parse outcome, compile outcome, typed failure details where present, authored
four-field fidelity, exact decoded authored-stage hashes, explicitly labeled
compiled-projection field identity, exact factor assignments, runner
provenance, and comparison eligibility. The harness never repairs or
normalizes raw output.
The stub's one payload serialization is explicitly labeled as a transport
fixture transform and verified for decoded authored-data fidelity.

Run the complete local proof:

```bash
node .artifacts/factor-probe-harness/captureProviderFreeProof.mjs
```

The launcher re-executes under Babel's deny-by-default network guard, runs the
harness tests, executes two deterministic stub captures, runs
`npm run verify:all`, and writes ignored output under
`bench-baseline/slice4-factor-probe/`.
