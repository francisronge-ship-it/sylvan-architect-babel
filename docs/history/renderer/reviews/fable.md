# Fable review: Tier-2 Tasks 10 and 11

Date: 2026-08-25
Model: Fable (`claude -p --model fable`)
Mode: read-only review; no edits or tests

## Verdict

No findings in the areas Fable completed inspecting.

Fable directly verified:

- The Tier-1 alias catalog contains 59 records and 86 exact aliases after the broad `Phrasal Movement` alias was removed.
- Alias dispatch remains exact and malformed registered claims fail closed.
- Construction names remain outside the Tier-1 alias catalog.
- Dedicated `RemnantEscape` runtime machinery is absent while `RemnantMovement` remains.
- The Sluicing, Pseudogapping, and Gapping examples are archived from the public Orchard and use ordinary movement plus Ellipsis in their retained research fixtures.
- The production-only audit contains no archived Sluicing or Pseudogapping links.

## Residual review scope

Fable's initial inspection exhausted its bounded tool turns before directly reviewing the Replay panel, the 70-pair visual verifier, same-anchor plaque stacking, and the specification status. Those areas are assigned to the separate Ox Alpha review and remain covered by the local provider-free and live-browser proofs.

Fable also noted a possible future alias-versus-canonical collision risk. Direct inspection closed that concern: `createRelationRegistry` rejects duplicate normalized identities across all entries, and `tests/relationDispatch.test.mjs` exercises that failure.

No unresolved Fable finding remains.
