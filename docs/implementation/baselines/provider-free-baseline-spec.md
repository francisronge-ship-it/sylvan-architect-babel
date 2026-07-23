# Provider-free baseline capture

This Slice 1 baseline follows corrected program W0: generated evidence lives under
gitignored `bench-baseline/`; the repository keeps the capture tool, this spec,
and a deterministic semantic receipt. It never stores working-tree path lists or
absolute local paths.

## Runtime and boundary

Use Node 24 or newer. The capture imports `replay/replaySnapshot.ts` through
Node's built-in erasable TypeScript support and refuses older runtimes.

The tool relaunches itself with `scripts/providerFreeNetworkGuard.cjs` preloaded
before importing Babel application modules. The preload denies HTTP, HTTPS, raw
TCP/TLS sockets, UDP sockets, DNS, and `fetch`; every spawned Node process
inherits it. A guard self-test proves every declared surface is denied, and any
later attempted access makes the capture fail. This is an enforced execution
boundary, not provider-call telemetry.

## Capture

Run:

```sh
node scripts/captureProviderFreeBaseline.mjs \
  --packet-dir "<directory-containing-the-six-frozen-artifacts>" \
  --durable-receipt "docs/implementation/baselines/provider-free-baseline.semantic.json"
```

The generated `bench-baseline/provider-free-baseline.json` partitions:

- `semantic`: stable source, packet, raw-byte, fixture-projection, and behavior
  evidence used for the durable comparison;
- `capture`: volatile runtime/repository metadata, enforced-boundary evidence,
  and command receipts;
- `determinism`: hashes from two fresh guarded semantic workers;
- `semanticSha256`: SHA-256 of canonical JSON for `semantic` only.

`capture.verification.receipts` comes from real executions of:

- `npm run build`;
- `npm run verify:all`;
- `npm audit --offline --json`.

Each receipt records the exit status and SHA-256/byte length of its generated
log. A nonzero command, signal, network attempt, or unequal semantic run fails
the capture and prevents the durable receipt from being updated.

## Semantic rules

The semantic receipt declares the sole authored stage fields:
`statement`, `stageRecord`, `visualRelations`, and `workspaceForest`.
It declares the four model-provenance fields excluded from semantic fixture
comparison: `timestamp`, `promptVersion`, `parserVersion`, and `uiVersion`.
No authored data is rewritten.

Every fixture records hashes of raw fixture bytes, normalized fixture bytes,
and replay-snapshot bytes in addition to parsed/canonical projections. Packet
provenance records exactly five normative artifact hashes plus the supporting
dossier hash, using artifact names rather than machine-specific paths.

Stage-rule probes use a self-contained valid one-stage payload and assert the
exact integrity rule reached by each mutation. The legacy multi-stage fixture's
misleading unresolved-`refId` response remains recorded separately as a masking
observation. Existing normalized/render-plan parity and unresolved-anchor
acceptance observations remain part of the baseline.
