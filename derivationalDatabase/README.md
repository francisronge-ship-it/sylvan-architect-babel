# W17a durable-record envelope

This package implements the model-invisible, persistence-free core of W17:
a canonical native-JSON envelope for an already-normalized derivation.

The envelope:

- preserves every JSON scalar and every array order exactly;
- canonicalizes object-key order only for hashing and serialization;
- binds the derivation and four evidence records to externally supplied
  source references and canonical SHA-256 hashes;
- records the adopted contract artifact, contract version, engine version,
  framework identity,
  optional prior-record reference, and caller provenance;
- contains no provider transport, browser storage, server persistence,
  benchmark, publication, visual, or rendering dependency.

`normalizedDerivation` is deliberately opaque here. Its contract-specific
validator belongs to a later W17 adapter tied to the adopted contract artifact.
This envelope therefore does not roll out model-facing wording or encode a
live-field migration. A caller must validate the derivation against the
contract named by `contractVersion` before creating the envelope.

The envelope also does not implement legacy mapping, session-memory export,
supersession actions, legal tombstones, final-tree export formats, licensing
decisions, or database writes. `supersedesRecordId` is evidence supplied by the
caller; this package neither resolves nor mutates history. `providerNotice` is
dated source evidence, not a license or publication authorization.

Raw provider bytes have no dedicated field in this carrier. They remain
eligible only for the separate explicit-submission or benchmark-archive
boundaries. Because artifact values and provenance are intentionally opaque,
the caller remains responsible for keeping raw bytes outside them. Hashes prove
content integrity, not source authenticity; the caller must verify every
external source reference.
