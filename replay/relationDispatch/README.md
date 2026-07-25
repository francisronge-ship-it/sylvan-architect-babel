# Generic relation dispatch boundary

This directory is model-invisible and renderer-neutral.

- `productionRegistry.js` is the versioned production registry. It is born
  empty and contains no approved relation identity, signature, mark, geometry,
  style, or fallback.
- `relationRegistry.js` accepts exact identities plus explicitly declared
  case/whitespace folding. It rejects fuzzy matchers, undeclared licensing
  fields, and renderer-specific entry data.
- `relationDispatch.js` validates only authored structured relation fields. It
  produces literal rows, degradation reasons, and provenance-bearing licensed
  mark descriptors. It never creates paths, connectors, arrows, pairings, or
  other geometry.

Registry entries used by the test suite are fixtures only. A test entry does
not approve a production entry or renderer. Production population and any
renderer or fallback integration remain separately gated.

The literal layer here is relation-local: authored relation names, anchor-role
rows, `priorAnchors` rows, `values` rows, authored-order ordinals, and derived
stage timing. Existing replay transforms own π silence and ι identity displays;
this module does not duplicate or reinterpret them.

Contract validation remains upstream: current-stage anchor resolution,
immediately-previous-stage `priorAnchors` resolution, and strict `values`
typing are not reimplemented here. Registry signatures constrain which
already-authored roles and arities license an entry or mark.
