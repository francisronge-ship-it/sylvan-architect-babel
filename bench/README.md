# Provider-free benchmark plumbing

This directory is a dry-run infrastructure boundary, separate from the Babel
product and any derivational database.

The caller supplies every run identity and condition: provider, model,
reasoning setting, carrier, framework, partition, request configuration,
factor assignments, item reference, and provenance. This package supplies no
roster, tier policy, carrier choice, sample design, benchmark content, reviewer
allocation, scoring rule, measurement model, claim, or publication default.

`runBenchmarkDryRun` accepts only the bundled provider-free stub boundaries. It
hashes exact raw bytes, records an artifact reference, passes the unmodified
output to an injected stub engine, preserves normative typed failures, and
returns a deterministic comparison receipt. Receipts contain references and
hashes rather than raw or normalized linguistic content.

Provider transports, benchmark items, review workflows, statistical models,
release manifests, publication tooling, and product/database integration
remain separately gated.
