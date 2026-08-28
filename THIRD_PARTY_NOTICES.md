# Third-Party Notices

The Apache License 2.0 applies only to rights the project can grant. It does not
replace the licenses or rights described below.

## Relation Orchard Bundles

`docs/research/relation-orchard/relation-orchard.bundle.js` includes React,
React DOM, Scheduler, D3 modules, and their bundled dependencies. Exact package
versions, copyright notices, and license texts are preserved in
[`LICENSES/RELATION-ORCHARD-BUNDLE.txt`](LICENSES/RELATION-ORCHARD-BUNDLE.txt).

`docs/design/visual-relations-current-lab.production-only-audit.r96.bundle.js`
is byte-identical to the current Orchard bundle and therefore embeds the same
React and D3 software. Its notices and license texts are preserved in the same
file.

## Fonts

The Relation Orchard distributes six Crimson Pro, JetBrains Mono, and
Quicksand font files under the SIL Open Font License 1.1:

- Crimson Pro: Copyright 2018 The Crimson Pro Project Authors.
- JetBrains Mono: Copyright 2020 The JetBrains Mono Project Authors.
- Quicksand: Copyright 2019 The Quicksand Project Authors. `Quicksand` is a
  Reserved Font Name.

The complete copyright notices and license accompany the fonts at
[`docs/research/relation-orchard/assets/fonts/OFL-1.1.txt`](docs/research/relation-orchard/assets/fonts/OFL-1.1.txt).

## Academic Source Material

The renderer research records cite academic publications and may refer to local
recovery copies under `docs/design/visual-relations-assets/`. Those copied
figures and PDFs are intentionally not part of the release and are not covered
by Babel's Apache license. Copyright remains with their authors or publishers.

## Model and Provider Outputs

Files under `docs/research/assets/` may depict outputs produced by third-party
models and rendered in Babel. The Apache grant extends only to rights the
project holds in those files. The project makes no claim about ownership of the
underlying model output; reusers should consult the relevant provider terms.

## Installed Packages

Packages installed through `package-lock.json` retain their own licenses. They
are not relicensed by Babel; their package distributions include the applicable
license text and notices.
