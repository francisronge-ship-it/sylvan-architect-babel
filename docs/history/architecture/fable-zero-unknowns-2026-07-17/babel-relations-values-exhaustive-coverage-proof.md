# Babel Relations/Values Exhaustive Coverage Proof

Author: Claude Fable 5. Date: 2026-07-23 (final resolution pass: §2 rebuilt — strict `values` types, multiplicity semantics replacing C-GROUP, `priorAnchors` transition witnesses with the transition table; register Map cells re-annotated accordingly; 156 explicit physical rows verified).
Status: normative evidence artifact of the packet (CA/BM/VR/SP). Fable's deliverable; Francis sole contract authority.
Anchor: `/Users/francisronge/Projects/Babel` @ `006b803` (2026-07-22). Inventory of record: `docs/design/visual-relations-exhaustive-inventory.md` (561 lines) [VERIFIED-CURRENT]; row source locations cite its line numbers (`inv:NNN`).

## 1. Register verification method

Expected IDs: `R01.01–R01.15, R02.01–R02.15, R03.01–R03.17, R04.01–R04.07, R05.01–R05.15, R06.01–R06.07, R07.01–R07.06, R08.01–R08.14, R09.01–R09.16, R10.01–R10.12, R11.01–R11.10, R12.01–R12.15, R13.01–R13.07` — section counts 15/15/17/7/15/7/6/14/16/12/10/15/7 = 156; exclusions exactly `R09.12`, `R09.16` (the inventory's two named EXCLUDE rows, inv:269, inv:273); retained = 154. Mechanical check (run on this file; outputs reported in the packet's final audit): count physical register lines `^\| R[0-9]`, extract IDs, assert uniqueness, no gaps against the expected sequence, and the section totals above. Statuses: NOW · CE2 (needs relation information per §2) · E (derived) · FUT-FRAME · FUT-MODAL · EXCL · OUT. Map legend: S states · ι identity · π pronunciation · K name+witnesses · V relation information. Render: inventory grammar numbers G1–G33; FLOOR = neutral conservative form; marks per VR §3 (the semantic visual-grammar registry: a recognized relation whose authored anchors/values satisfy a Francis-approved entry's required signature receives that entry's specialized geometry — trajectories, probe–goal arcs, sharing overlays, regions, correspondence maps, violation marks, realization plates — with every mark's authored license recorded; grammar names such as G1 trajectory or G7 failed-path are the inventory's archetype labels used as render targets, reachable exactly when their registry entry is approved through VR §6's gates and the authored signature is complete; absent a matching entry, or with an incomplete signature, the rendering is the unregistered-relation fallback — VR §4's delivered candidates, index-badge + relation-panel recommended, Francis selecting [R10] — never a guessed specialized drawing).

## 2. Relation information: formal semantics (final)

Field (recommended candidate; enters CE-2 only on passing factor evidence plus Francis's explicit approval of the name and conventions [FRANCIS]): `values: Record<string, string | string[]>` beside `anchors`. Name recommended on the content-shape argument (key→literal symmetry with `anchors`; the name signals short literals under named keys — the built-in prose-dump deterrent); formally open, optional `values`-vs-`info` A/B in the CE-2 arm.

**Types (strict; no silent normalization):** string or array of strings only; number/boolean/null/object values → typed class-3 error naming the key and received type (authored content is never silently rewritten; JSON parsing does not preserve number spelling, so numeric literals arrive as quoted strings to keep their exact decoded form); empty string legal; empty array a typed error; duplicate array entries preserved (positions distinguish). **Order:** preserved and displayed as authored; meaning attaches only through the relation's own semantics or a registry signature — the contract asserts preservation, not interpretation.

**Multiplicity (one elementary commitment):** a relation item ⟨name, anchors, priorAnchors?, values⟩ asserts exactly **one instance** of its relation holding of its assignment. Array-valued roles participate **jointly** in that instance (the instance is natively a hyperedge). Parallel, distributive, paired, and repeated commitments are authored as that many items. Asserted grouping of instances is itself a commitment — a covering relation — never a convention. Exact duplicates (same stage, name, assignment, values) are flagged `duplicate_relation`, displayed with a multiplicity marker, never dropped. Role association holds only within an item. **Worked rule (split/merge events):** the event itself is one joint item — array-valued roles are the participants jointly (fusion: inputs array; fission: outputs array) — while *per-participant content* (which features/exponent went where) is authored as separate per-participant items; neither substitutes for the other: the event item asserts the transition, the content items assert the assignments.

**Transitions (`priorAnchors`):** an optional second anchor block whose open roles resolve deterministically in the **immediately preceding** stage's expanded workspaceForest; meaningful only at stage index ≥ 1; at least one anchor block non-empty; validation mirrors `anchors` against stage k−1; the invention-detector universe is the union of the two adjacent stages' authored ids. Only identity/existence transitions need it — the mechanical scan of this register finds 17 transition-involving rows, of which 12 are state changes on **persisting** nodes (resolved by persistent ids + values literals: R03.01, R08.01, R08.05 feature-variant, R08.08, R08.10, R04.07/R08.14, R12.14, R01.03/R01.08, R08.09, R13.07-E) and ~5 are identity/existence changes needing two-sided witnesses (R08.03 fusion; R08.04 fission; R08.05 node-deletion variant; R06.07/R08.07 obliteration; replacement/reanalysis without id persistence).

**Transition table (authored input → machine resolution → rendering → ambiguity → failure):**

| Family | Authored input | Machine-resolvable identity | Rendered result | Ambiguity | Failure |
| --- | --- | --- | --- | --- | --- |
| Fusion (R08.03) | stage k: `anchors:{output}`, `priorAnchors:{inputs:[a,b]}`, values | output in Sₖ; inputs in Sₖ₋₁ | gated joint-hub boundary figure; else two-sided badges | duplicate keys flagged; missing priorAnchors → output-side only, labeled partial | unresolvable id → typed class-3 error naming stage/role |
| Fission (R08.04) | **one joint split item**: `anchors:{outputs:[c,d]}` (the outputs jointly constitute the split) + `priorAnchors:{input}`; **per-output content** (feature/exponent assignment), when asserted, = separate per-output items, each anchoring one output (optionally `priorAnchors:{input}`) with its values | both sides deterministic | split figure from the joint item; per-output plaques from content items; else badges | content items without the joint item remain valid elementary commitments; duplicate keys flagged | unresolvable id → typed class-3 error |
| Node deletion (R08.05 variant; R06.07/R08.07) | `priorAnchors:{removed}`, `anchors:{site}`, values (rule/status) | removed in Sₖ₋₁; site in Sₖ | deletion mark at boundary; ghost in prior view | no relation authored → disappearance is a state diff labeled derived, never asserted | as above |
| Replacement/reanalysis without id persistence | old in `priorAnchors`, new in `anchors` | deterministic | continuity mark as authored claim | id persisted instead → ordinary state change; both legal | as above |
| Persisting-node state change (valuation, insertion, readjustment, dislocation, zero realization) | same-stage relation on the persisting id; before/after values | persistent id | registry plaque/annotation; else badges + panel | n/a | ordinary validation |
| Movement/copies (R01.*) | same-stage anchors to co-existing occurrences (+ ι) | ids + lineage | gated trajectory | n/a | ordinary |
| Birth / unremarked disappearance | states only; no relation required | state diff | replay reveal (Layer E, labeled derived) | Babel asserts nothing | n/a |

**Adversarial denotation table (re-derived under multiplicity — every former C-GROUP case, zero conventions):**

| Case | Encoding | Denotation | Distinct? |
| --- | --- | --- | --- |
| Bijection (fission content pairing) | one **content** item per pairing: `{exponent:"-s", features:"3sg"}`, `{exponent:"-ed", features:"past"}` (the split event itself is one joint item — transition table) | 2 content instances | ✔ |
| One-to-many | one item per target (source witness repeated across items) | n instances | ✔ |
| Many-to-one (distributive) | one item per source into the shared target | n instances | ✔ |
| **Joint** many-to-one (fusion) | one item: `anchors:{inputs:[a,b]}` (joint) + values output | one instance | ✔ — formally distinct from the distributive rows |
| Many-to-many | one item per pair | pair list | ✔ |
| Duplicate literals | positions within arrays; distinct items otherwise | ✔ | |
| Optional member | key simply absent from an item; asserts nothing | ✔ | |
| Asserted grouping of instances | a covering relation over the shared participants — authored content, not convention | ✔ | |
| Exact duplicate items | flagged `duplicate_relation`; displayed with multiplicity marker | bounded | |
| Hyperedge of hyperedges | chained items sharing witnesses (bounded by design) | ✔ | |

Boundary rules (self-contained; "exact comparison" = decoded-string code-point identity per CA §5.1's fidelity layers): literals compared by exact decoded-string identity, never parsed further, never node IDs (flag `value_matches_node_id`), never stage references; label duplication flagged, never rejected; verbatim notation strings welcome as display literals; structured commitment vs. `stageRecord` prose boundary — each key names one relation-local aspect, each value is its authored literal, argumentation belongs in stageRecord (stated discipline, review-enforced, no mechanical length policing). **Relation-instance reference — bounded exclusion (designed, not adopted):** relations never reference other relations. Attested failure/override/ordering families are self-contained (own participants + content; order = stage placement; grouping = covering relation). The residual case — structurally citing one of several same-stage, same-name, same-witness items differing only in values — is **excluded as unattested, not resolved**. Minimal future mechanism, specified for the record: an optional relation `id` (open string; **derivation-unique**; duplicate → typed error) plus an optional `targets` block (role → relation id, resolved against any earlier-or-same stage; unresolvable → typed error); persistence: ids stored and exported verbatim; rendering: a targeting relation's marks attach to the target's rendered marks; migration: id absence in legacy records is valid (optional field). Adoption would be its own CE factor; nothing in this packet depends on it. Model-facing wording: category description, zero linguistic examples, completeness invitation (mirrors `systemInstruction.js:131` [VERIFIED-CURRENT]); the entire authored-convention surface: "arrays are ordered as authored; the roles of one relation hold jointly; state parallel commitments as separate relations."

**Signature adequacy for the specialized grammars (VR §3), per grammar:** anchors-only — movement trajectory/chain path (`source`+`landing` or one ordered witness array); sharing overlay (`parents` ≥2 + `shared`); domains/regions; intervention gate; control/binding/coindex — expressible now. Values-dependent — Agree valuation plaques (probe/goal + valuation keys as verbatim literals); correspondence maps (one item per correspondence); recognized violation marks (attempted-dependency witnesses + a status key whose recognized literals the registry entry **enumerates and byte-compares** — exact comparison against a declared enumeration, never interpretation); PF realization plates (exponent/context literals) — expressible at CE-2. Transition-dependent — fusion/fission/deletion boundary figures require `priorAnchors` (F-T). No grammar requires prose parsing, new authored syntax, broadcasting, or any convention beyond order preservation; the joint/distributive contrast is exactly the one-instance/many-items distinction above.

## 3. The register — 156 explicit rows

Columns: ID | inventory row (inv line) | required authored facts | map | status | render | fixture/CE | evidence·rationale (source basis; why this status).

### §1 (R01.01–R01.15)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01.01 | A-movement, A-bar movement, Move NP/wh, topicalization, scrambling, object shift, extraposition, raising (106) | both occurrences; one object; pronunciation asymmetry; named dependency; path order if asserted | S+ι+π+K (+ordered anchor array for path) | NOW | G1 marks per VR §3 | F01 | GB/MP displacement core (inv sources 122); occurrences+silence are contract-native |
| R01.02 | Head movement, V-to-v/T/C, T-to-C, incorporation-as-movement (107) | head occurrences; complex head; dependency | S+ι+π+K | NOW | G1 head styling | F01 | complex heads authorable as structure |
| R01.03 | Syntactic lowering; postsyntactic lowering/raising/amalgamation (108) | downward landing; syntax-vs-PF branch claim | S+ι+π+K; branch literal V | NOW/CE2 | G1 typed | — | branch is a literal, not structure |
| R01.04 | Successive-cyclic movement, intermediate copies, escape-hatch (109) | ordered occurrence chain | S+ι; ordered anchor array (authored order preserved) | NOW | G2 | F02 | order authored by array |
| R01.05 | Remnant movement, roll-up, smuggling (110) | two+ chains; containment order | S+ι per chain; one K item per chain | NOW | G2+G8 | F64 | stage states show containment |
| R01.06 | Chain composition (111) | shared occurrence across chains | shared witness in both items | NOW | G2 | F03 | |
| R01.07 | ATB movement, parasitic gaps, multiple-gap dependencies (112) | filler+gaps; identity per analysis (ι never forced) | S+π+K fan (+ι if committed) | NOW | G3 | F04/F05/F65 | parasitic gap may be distinct object |
| R01.08 | Sideward movement, Parallel Merge across workspaces (113) | cross-root occurrences pre-merger | S(forest)+ι+K | NOW | G4 | F06 | forest is native |
| R01.09 | Resumption, prolepsis, nonmovement LDD, SLASH/GAP (114) | dependency w/o movement | K (no ι link) | NOW | G5 | F07 | SLASH-native → R12.01 |
| R01.10 | Null-operator dependency: tough, purpose, relative operators (115) | Op occurrence + dependency | S(π)+ι/K | NOW | G5/G1 | — | |
| R01.11 | Covert wh, Move F, Q-particle movement (116) | covert copy or feature dependency (model's choice) | ι/π copy or K+V | NOW/CE2 | G1/G11 | — | inventory: COMPOSE |
| R01.12 | QR, inverse scope, inverse linking, ACD (117) | LF occurrence; covert path; scope domain | S+ι/π+K | NOW | G1 covert | F63 | lab-validated |
| R01.13 | Right Roof, Upward Boundedness (118) | rightward path + roof boundary | K (path+boundary witnesses) | NOW | G1+G16 | — | |
| R01.14 | Path Containment Condition (119) | two paths' nesting | two K items; interaction E | NOW | G8 | F13 | |
| R01.15 | Strong/weak crossover (120) | path+pronoun+illicit-coindex status | K+V status | NOW/CE2 | G1+G10 | — | status literal is V |

### §2 (R02.01–R02.15)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R02.01 | Copy/occurrence/chain identity, coindexation (128) | ι-class + π states | ι+π | NOW; display E | G9 | F14 | identity is authored, display derived |
| R02.02 | Plain coreference (129) | shared reference | K | NOW | G10 | F15 | |
| R02.03 | Bound-variable binding, Principles A/B/C (130) | binder, bindee, domain witness; status | K+V status | NOW/CE2 | G10+G15 | lab | |
| R02.04 | Control: subject/object, OC/NOC, forward/backward (131) | controller, PRO, domain | S(π-PRO)+K | NOW | G5+G15 | lab | PRO authored silent |
| R02.05 | Partial control (132) | subset reference relation | K+V | CE2 | G10 | — | set literal |
| R02.06 | Split control, split antecedence (133) | antecedents→dependent | K fan (joint, ungrouped) | NOW | G3/G16 | F16 | joint semantics §2 |
| R02.07 | Disjoint reference, obviation, contraindexing, I-within-i (134) | negative reference claim | K+V status | CE2 | G10 conflict | — | |
| R02.08 | Overlap/covaluation, switch-reference overlap (135) | set-algebra relation | K+V | CE2 | G10 | — | |
| R02.09 | Logophoric/de-se/shifted-indexical/judge binding (136) | holder→operator→dependent chain | K ordered anchors | NOW | G5 | — | order authored |
| R02.10 | Donkey anaphora (137) | per chosen analysis | →R02.03 or R06.02 | NOW | per route | — | inventory: COMPOSE |
| R02.11 | Predication, subject–predicate coindexing (138) | predicand–predicate | K | NOW | G5 | — | |
| R02.12 | Secondary predication, depictive/resultative (139) | argument–predicate orientation | K | NOW | G5 | — | |
| R02.13 | pro licensing and identification (140) | null pronoun+licensor+features | S(π)+K+V | CE2 | G5+G11 | — | feature literals |
| R02.14 | Expletive–associate relation (141) | triadic dependency | K | NOW | G5 | — | |
| R02.15 | Temporal/event/world/situation/degree/judge binding (142) | operator–variable at LF | S(LF)+K | NOW | G5 | — | |

### §3 (R03.01–R03.17)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R03.01 | Binary Agree, probe–goal, valuation/checking (150) | probe, goal; before/after values | K+V | CE2 | G11 | F17 | notation §5 N1 |
| R03.02 | Multiple/cyclic/long-distance Agree, negative/modal concord (151) | goals; per-goal values (one item per goal) or joint | K+V (per-goal items or joint array) | CE2 | G11 fan | — | §2 multiplicity distinguishes readings |
| R03.03 | Feature sharing, spec-head, concord, co-superscripting (152) | shared value literal | K+V | CE2 | G11 | — | |
| R03.04 | Failed/partial Agree, candidate search, defective intervention (153) | candidates; outcome literals | K+V | CE2 | G6 | — | outcome is V |
| R03.05 | Domain broadcast/concord (154) | source; targets; value | K+V | CE2 | G11 fan | — | joint or distributive per author |
| R03.06 | Nested accumulation/stacking (155) | ordered contributors | K ordered + V | CE2 | G19 | F31 | |
| R03.07 | Structural/inherent/quirky/abstract/ECM Case (156) | assigner, assignee, Case value | K+V | CE2 | G11 | — | |
| R03.08 | Dependent/coargument Case (157) | casee, competitor, domain; value | K+V | CE2 | G6 | — | |
| R03.09 | Case inheritance/stacking/absorption (158) | ordered sources; values | K+V | CE2 | G19 | — | |
| R03.10 | EPP satisfaction, expletive-associate licensing (159) | head, satisfier | K (+V state) | NOW/CE2 | G11 | — | |
| R03.11 | Theta assignment, theta-grid (160) | predicate; role-named arguments | K (roles as role names) +V optional | NOW | G13 | F19, lab | |
| R03.12 | Argument-role→GF linking/revaluation (161) | mapping instances | K+V (one item per mapping instance) | CE2 | G22 | — | LFG-native →R12.05 |
| R03.13 | LFG constituent–function mapping (162) | f-path equations | non-tree | FUT-FRAME | — | CE#4 | inventory: BLOCKED |
| R03.14 | Syntactic/semantic argument sharing, composition (163) | shared argument witnesses | K | NOW | G5/G18 | — | valence-list native FUT-FRAME |
| R03.15 | Mood-world Agree, polarity valuation, strong-NPI Exh (164) | operator, goals, values | K+V | CE2 | G11 | — | |
| R03.16 | Allocutive/addressee/honorific agreement (165) | clause-internal witnesses; external interlocutor | K (internal) | NOW; external OUT | G11 | CE#4 | no speech-act nodes |
| R03.17 | Switch-reference comparison, multi-source conflict (166) | subject witnesses; comparison result | K+V | CE2 | G6 | — | |

### §4 (R04.01–R04.07)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R04.01 | Label provenance, prominent-head labeling (174) | source head; label outcome | K+V | CE2 | G12 | — | |
| R04.02 | Shared-feature labeling (175) | daughters; shared feature; label | K+V | CE2 | G12 | — | |
| R04.03 | Label failure, relabeling, labeling by evacuation (176) | object; failure/repair state | K+V | CE2 | G12+G14 | — | |
| R04.04 | Pair-Merge host/asymmetric adjunction (177) | host, adjunct; asymmetry claim | S+K | NOW | G17 | — | |
| R04.05 | Pair-member inaccessibility (178) | pair; accessibility state | K+V | CE2 | G14 | — | |
| R04.06 | Idiom-chunk cointerpretation (179) | chunk members | K (joint) | NOW | G17 | — | |
| R04.07 | Conflation transfer (180) | source, target; signature correspondence | K+V (per-correspondence items) | CE2 | G12+G22 | — | |

### §5 (R05.01–R05.15)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R05.01 | Binding/governing/accessibility domain (188) | domain root witness | K (member set E) | NOW | G15 | F22 | lab |
| R05.02 | Phasehood and phase edge (189) | phase head/projection; edge | K | NOW | G16 | F25, lab | |
| R05.03 | Transfer/Spell-Out domain, PIC accessibility (190) | domain; accessibility states | K+V | NOW/CE2 | G16+G14 | — | |
| R05.04 | Island, barrier, bounding node, Subjacency (191) | boundary; attempted dependency (authored) | K | NOW | G15+G7 | F26, lab | Babel never invents the attempt |
| R05.05 | Subject Condition, CED, CNPC, CSC, wh-island (192) | specific domain + attempted path | K | NOW | G15+G7 | F65 | |
| R05.06 | Weak/strong island contrast (193) | domain type literal; path | K+V | CE2 | G15 typed | — | |
| R05.07 | Minimality, Relativized Minimality, intervention (194) | endpoints; intervener | K | NOW | G7 | lab | |
| R05.08 | Superiority, A-over-A, candidate competition (195) | candidates; selected/blocked | K+V | CE2 | G6 | — | |
| R05.09 | Anti-locality (196) | too-short path; domain | K | NOW | G7 | — | |
| R05.10 | Improper movement, freezing, criterial freezing, Strict Cycle (197) | chain; illegal continuation state | K+V | CE2 | G7+G14 | — | |
| R05.11 | Path containment, crossing, tucking-in (198) | two paths | two K items; E interaction | NOW | G8 | F13 | |
| R05.12 | Connectedness (199) | connected set vs. detached | K | NOW | G15 | F24 | |
| R05.13 | Head Movement Constraint (200) | head path; skipped head | K | NOW | G7 | — | |
| R05.14 | Proper government, ECP, gamma marking (201) | trace, governor; γ states | K+V | CE2 | G14 | — | |
| R05.15 | Right Roof/Upward Boundedness (202) | path; roof | K | NOW | G7+G16 | — | duplicate topic of R01.13 kept as inventory lists it twice |

### §6 (R06.01–R06.07)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R06.01 | VP/N/TP ellipsis, sluicing, gapping, stripping, pseudogapping, fragments, NCA (210) | silent full structure | π+S | NOW | G9 | lab | settled silence semantics |
| R06.02 | Recoverability/antecedent identity (211) | antecedent, site | K | NOW | G5 | F57 | |
| R06.03 | Remnant escape (212) | deletion region + trajectory | K composition | NOW | G15+G1 | — | |
| R06.04 | Null anaphor (213) | silent proform + antecedent link | S(π)+K | NOW | G5 | — | |
| R06.05 | Strict/sloppy identity, vehicle change (214) | identity-type claim | K+V | CE2 | G10 | — | |
| R06.06 | Copy pronunciation, Chain Reduction, spell-out choices (215) | π per occurrence; theoretical claim | ι/π (+K claim) | NOW; display E | G9 | F14 | |
| R06.07 | PF pruning, Obliteration, whole-node deletion (216) | deletion state | π+V (+`priorAnchors`: removed) | CE2 | G23 | — | |

### §7 (R07.01–R07.06)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R07.01 | Multidominance, Parallel Merge, shared node/DAG (224) | one node, two mothers | S(tree)+K: canonical position + sharing relation (`parents`+`shared`) | NOW | G18 sharing overlay | F30 | relation-layer solved (VR §5); the forest stays a tree by design (`systemInstruction.js:85`); no DAG mechanism planned |
| R07.02 | Right-node raising (225) | per analysis | →R06.01/R01.07/R07.01 | NOW/route | per route | — | inventory: COMPOSE |
| R07.03 | Across-the-board dependencies (226) | filler; per-conjunct gaps | →R01.07 | NOW | G3 | F04 | |
| R07.04 | Argument sharing in serial verbs/complex predicates (227) | predicates; shared argument | K (joint) | NOW | G18/G5 | — | |
| R07.05 | Determiner sharing (228) | shared functional item | per analysis | NOW/route | G18 | — | |
| R07.06 | Sideward movement between workspaces (229) | →R01.08 | S+ι+K | NOW | G4 | F06 | |

### §8 (R08.01–R08.14)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R08.01 | Vocabulary Insertion, unary PF realization (237) | terminal features; exponent; context | K+V | CE2 | G12 | F34→promote | notation §5 N4 |
| R08.02 | Contextual allomorphy and suppletion (238) | target; conditioners; exponent | K+V | CE2 | G12 | — | |
| R08.03 | Fusion/portmanteau (239) | joint inputs → one exponent | K+V joint (+`priorAnchors`: inputs) | CE2 | G22 | F35→promote | §2 joint semantics + transition table |
| R08.04 | Fission/doubling (240) | one bundle → exponents with feature split | K: one joint split item (`priorAnchors` input; outputs array) + per-output content items; V | CE2 | G22 | F36→promote | §2 worked rule + transition table |
| R08.05 | Impoverishment (241) | before/after feature state | K+V (node-deletion variant: +`priorAnchors`) | CE2 | G14 | — | H&M p.119: feature- and terminal-deletion variants |
| R08.06 | Dissociated node/feature insertion (242) | context; inserted element | K+V | CE2 | G14 | — | |
| R08.07 | Obliteration (243) | deleted terminal state | π+V (+`priorAnchors`: removed) | CE2 | G23 | — | inventory: COMPOSE with R06.07 |
| R08.08 | Readjustment (244) | form rewrite under condition | K+V | CE2 | G12 | — | |
| R08.09 | Morphological Merger (245) | terminals; complex-head result | S+K | NOW | G17/G1 | — | |
| R08.10 | Local Dislocation, string-vacuous rebracketing (246) | adjacency reorder | K+V (one order item per pair) | CE2 | G21 | — | |
| R08.11 | Prosodic inversion, clitic hosting (247) | syntactic witnesses; prosodic host object | K internal; prosodic native OUT | NOW/OUT | G21 | CE#4 | |
| R08.12 | Cyclic linearization, ordering statements, order preservation (248) | ordered pairs per domain | V (one ordering item per ⟨a,b⟩ statement) | CE2 | G20 | F32 | notation §5 N6 |
| R08.13 | Nanosyntax lexicalization, spans (249) | subtree witness; exponent | K+V | CE2 | G22 | F38→promote | PF-tree native OUT |
| R08.14 | Conflation (250) | →R04.07 | K+V | CE2 | G12+G22 | — | |

### §9 (R09.01–R09.16)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R09.01 | QR/covert scope, inverse scope, inverse linking, ACD (258) | →R01.12 | S+ι/π+K | NOW | G1 covert | F63 | |
| R09.02 | Scope without movement: Cooper storage, scope indices (259) | ordered scope literals | K+V | CE2 | G20 | — | |
| R09.03 | LF reconstruction (260) | interpreted lower copy | ι/π+K | NOW | G9 | lab | |
| R09.04 | Operator–variable binding, predicate abstraction (261) | Op; variable | K | NOW | G5 | lab | |
| R09.05 | De re/de dicto, de se, world/time binding (262) | per analysis | →R01.12/R02.15 | NOW | per route | — | COMPOSE |
| R09.06 | SOT feature transmission (263) | ordered chain; values | K ordered+V | CE2 | G19 | — | |
| R09.07 | Speech-time control/temporal anchoring (264) | clause-internal witnesses; NOW/context objects | K internal; external OUT | NOW/OUT | G5 | CE#4 | inventory: BLOCKED faithfully |
| R09.08 | Mood selection, mood-world Agree (265) | →R03.15 | K+V | CE2 | G11 | — | |
| R09.09 | Negative concord/multiple Agree (266) | →R03.02 | K+V | CE2 | G11 | — | |
| R09.10 | Polarity-variable valuation, negative response concord (267) | Pol chain; values | K+V | CE2 | G11 | — | sigma-curve visual X (unsourced; inventory CORRECT) |
| R09.11 | Strong NPI as Exhaustifier Agree (268) | EXH source; goals | K+V | CE2 | G11 | — | |
| R09.12 | Ordinary weak-NPI licensing (269) | — | — | **EXCL** | — | — | inventory's own exclusion: dominance suffices |
| R09.13 | Focus association (only/even/verum) (270) | F-marks; domain | K+V | CE2 | G14 | — | branch-strength visual X (unsourced) |
| R09.14 | Givenness, second-occurrence focus (271) | G/F,G marks | K+V | CE2 | G14 | — | |
| R09.15 | Contrastive topic (272) | CT/FOC marks | K+V | CE2 | G14 | — | |
| R09.16 | Topic-comment/aboutness topic (273) | — | — | **EXCL** | — | — | inventory's own exclusion: TopP geometry |

### §10 (R10.01–R10.12)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R10.01 | Prosodic domain ω/φ/ι (281) | prosodic objects | non-tree | OUT | — | CE#4 | settled tree scope |
| R10.02 | Match Word/Phrase/Clause (282) | syntax–prosody pairing | non-tree side | OUT | — | CE#4 | |
| R10.03 | Align-XP/φ L/R (283) | edge pairing | non-tree side | OUT | — | CE#4 | |
| R10.04 | Wrap-XP (284) | containment pairing | non-tree side | OUT | — | CE#4 | |
| R10.05 | Prosodic mismatch/recursion (285) | non-isomorphic spans | non-tree | OUT | — | CE#4 | |
| R10.06 | Focus boundary, Align-Focus (286) | syntactic focus witness NOW (→R09.13); boundary OUT | split | OUT/CE2 | G14 | CE#4 | |
| R10.07 | Stress-XP, prominence (287) | prominence objects | OUT | — | — | CE#4 | |
| R10.08 | F-projection, focus prominence (288) | OUT | — | OUT | — | CE#4 | |
| R10.09 | Givenness deaccenting, dephrasing (289) | OUT (syntactic G-marks →R09.14) | split | OUT/CE2 | — | CE#4 | |
| R10.10 | Tone association, edge processes (290) | OUT | — | OUT | — | CE#4 | |
| R10.11 | Prosodic host, proclisis/enclisis (291) | OUT (syntactic side →R08.11) | split | OUT/NOW | — | CE#4 | |
| R10.12 | Prosodic Spell-Out/highest phrase (292) | OUT | — | OUT | — | CE#4 | |

### §11 (R11.01–R11.10)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R11.01 | Referential-locus association, R-locus (300) | spatial loci | external plane | FUT-MODAL | G24 spec | F41 | settled far-future |
| R11.02 | Manual agreement path, directional verbs, PAM/AUX (301) | locus vector | FUT-MODAL | — | G24 spec | F42 | |
| R11.03 | Agreement orientation (302) | orientation component | FUT-MODAL | — | G24 spec | — | |
| R11.04 | Nonmanual agreement vector (303) | tier span + loci | FUT-MODAL | — | G25 spec | — | |
| R11.05 | NMM source-domain spreading (304) | labeled tier spans | FUT-MODAL | — | G25 spec | F43 | |
| R11.06 | NMM dependency track (305) | endpoint-aware span | FUT-MODAL | — | G25 spec | F44 | |
| R11.07 | Role/context shift realization (306) | RS span + binding | FUT-MODAL | — | G25 spec | F62 | |
| R11.08 | Prosodic constituent mapping, signed edges (307) | signed prosody | FUT-MODAL | — | G25 spec | — | |
| R11.09 | Articulator-state spreading (308) | stateful tier | FUT-MODAL | — | G25 spec | F45 | |
| R11.10 | Tier synchronization/stacking (309) | multi-tier sync | FUT-MODAL | — | G25 spec | — | |

### §12 (R12.01–R12.15)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R12.01 | HPSG feature-path reentrancy, SLASH percolation (319) | AVM paths | non-tree | FUT-FRAME | G28 spec | F48 | no flattening (settled) |
| R12.02 | TAG substitution/foot/adjunction constraints (320) | composition ports | FUT-FRAME | — | G29 spec | F49 | |
| R12.03 | FB-TAG top/bottom unification (321) | split feature ports | FUT-FRAME | — | G30 spec | F50 | |
| R12.04 | Underspecified dominance/precedence (322) | typed edges | FUT-FRAME | — | G31 spec | F51 | |
| R12.05 | Non-isomorphic projection correspondence (PA, RRG) (323) | parallel projections | FUT-FRAME | — | G32 spec | F52 | |
| R12.06 | STAG/MCTAG synchronized composition (324) | cross-tree links | FUT-FRAME | — | G33 spec | F53 | |
| R12.07 | Interaction-Grammar polarity consumption (325) | polarity states | FUT-FRAME | — | spec | F54 partial→V fragment CE2 | |
| R12.08 | Dynamic-Syntax pointer/requirements/LINK (326) | incremental states | FUT-FRAME | — | spec | F55 | |
| R12.09 | Path-conditioned extraction morphology (327) | per-C realization literals | K+V fragment CE2; f-path native FUT-FRAME | CE2/FUT-FRAME | G12 | F56 partial | |
| R12.10 | Ellipsis licensor-to-domain (C[E]/T[E]) (328) | licensor; deletion domain | K | NOW | G5+G15 | F57 | |
| R12.11 | Ordered gapping remnant–correlate alignment (329) | paired witnesses | K (one item per remnant–correlate pair) | NOW (pairing); literals CE2 | G22 | F58 | §2 multiplicity |
| R12.12 | Coordinate feature resolution (330) | conjunct features; computed result | K+V | CE2 | G6/G11 | F59 partial | |
| R12.13 | RRG co-subordination/operator sharing (331) | layer machinery | FUT-FRAME | — | spec | F60 | |
| R12.14 | Null realization distinct from deletion (332) | zero-exponent state | π+V | CE2 | G23 | F61 | |
| R12.15 | Signed body-anchored reference under shift (333) | modal machinery | FUT-MODAL | — | spec | F62 | |

### §13 (R13.01–R13.07)

| ID | Inventory row (inv) | Required authored facts | Map | St | Render | Fix/CE | Evidence·rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R13.01 | Whole-example ungrammaticality/questionability (343) | zero-witness judgment | formally coherent; excluded while Babel publishes convergent derivations only | EXCL-scope (F46) | G26 spec | F46 | revisit trigger: BM adversarial items |
| R13.02 | Blocked/failed dependency (344) | attempted path; failure state | K+V | NOW/CE2 | G7 | F47 | authored, never inferred |
| R13.03 | Identity/reference conflict (345) | crossed indices claim | K+V | CE2 | G10 | — | |
| R13.04 | Label/feature/Case failure (346) | failure state | K+V | CE2 | G14 | — | |
| R13.05 | Path–region relation (347) | path; region | two K items; E interaction | NOW | G8 | F12 | |
| R13.06 | Path–path relation (348) | two paths | two K items; E | NOW | G8 | F13 | |
| R13.07 | State transition across replay (349) | cross-stage state | E (never authored cross-stage) | E | G23 | F39/F40 | |

## 4. Literature sweep — auditable ledgers (research performed; statuses per source)

**Verification-status vocabulary:** `PAGE-VERIFIED` — content inspected this pass at page/example/rule granularity; `SEARCH-VERIFIED` — specific definitions/figures confirmed this pass via primary-source search snippets; `CITED-KNOWLEDGE` — exact locus given from training knowledge, not re-inspected this pass; `FETCH-FAILED` — retrieval attempted this pass, named precisely, contents not claimed verified.

### 4.1 Source ledger

| Source (class) | Access route, date | Status | What it evidences (register/notation destinations) |
| --- | --- | --- | --- |
| Halle & Marantz 1993, "Distributed Morphology and the Pieces of Inflection," *The View from Building 20*, 111–176 (primary) | MIT-hosted PDF fetched 2026-07-23; full text extracted (34 pp., 145,038 chars) | **PAGE-VERIFIED** | fusion/fission/merger definitions (printed pp. 117–118: "fusion takes two terminal nodes that are sisters under a single category node and fuses them into a single terminal node. Only one Vocabulary item may now be inserted… a subset of the morphosyntactic features"); Georgian fission rule (3) and Vocabulary blocks (5) with Pāṇinian ordering (pp. 118–119); impoverishment as MS feature/terminal deletion ("deletes the Plural terminal node when it follows any 3rd plural Tns-Agr node," p. 119; rules (43), (46)); readjustment ("deletes 3rd singular /-s/ before plural /-t/," p. 119); English past-tense allomorph entries (6)/(8) with /-d/ as the literal default → N4/N5/N6 corrections in §5; register R08.01–.08 |
| Cambridge Handbook of Generative Syntax (handbook; the inventory's own scope authority, inv:14) | module checklist as inventoried | CITED-KNOWLEDGE (module list SEARCH-VERIFIED via inventory) | module axis of the §4.2 matrix; R02–R09 coverage |
| Collins & Stabler 2016, *Syntax* 19(1) (formalization) | caltech PDF; definitions confirmed by search earlier this session | SEARCH-VERIFIED (stage/workspace/Select/Merge/Transfer definitions) | CA §3 formal object; R05.03; numeration rejection |
| Adger 2003 *Core Syntax*; Radford *Minimalist Syntax*; Carnie *Syntax*; Haegeman *GB* (graduate texts) | ToC-level walks | CITED-KNOWLEDGE | topic axis; feature-checking notation N1/N3 loci (Adger ch. 2–4) |
| Chomsky 1995 *MP* ch.4; Chomsky 2008 "On Phases" (*Foundational Issues* 133–166) (primary) | — | CITED-KNOWLEDGE | checking; feature inheritance N2 |
| Pesetsky & Torrego 2007 (*Phrasal and Clausal Architecture*) (primary) | — | CITED-KNOWLEDGE | valuation/sharing arrows N1 |
| Embick & Noyer 2001, *LI* 32(4); Embick 2015 *The Morpheme* (primary) | — | CITED-KNOWLEDGE | Lowering/Local Dislocation definitions; the later `[feats] ↔ /exp/ / context` arrow convention N4 |
| Fox & Pesetsky 2005, *Theoretical Linguistics* 31 (primary) | — | CITED-KNOWLEDGE | ordering statements ⟨a,b⟩ N6 |
| Nunes 2004 (MIT Press) (primary) | — | CITED-KNOWLEDGE | chain reduction/copy deletion N9 |
| Arregi & Nevins 2012 *Morphotactics* (primary) | — | CITED-KNOWLEDGE | impoverishment rule format (modern) N5 |
| Inventory bibliography (Ross; Rizzi; Citko; Selkirk; Zeijlstra; Baker; Neidle–Lee; Sandler; etc., inv:531–552) | as inventoried; plates cached in repo | SEARCH/PLATE-VERIFIED at inventory granularity | per-section register sources |
| Notation practice: qtree/forest/TikZ; TreeForm; 24 cached plates (`docs/design/visual-relations-assets/`) | repo-cached images + research doc | PAGE-VERIFIED (plates present in repo) | VR mark families; N9 display conventions |

### 4.2 Matrix ledger (machine-auditable; modules M1–M10 × topologies T1–T7)

Modules: M1 structure-building/projection · M2 movement/chains · M3 agreement/Case/features · M4 binding/control/reference · M5 ellipsis/silence/pronunciation · M6 domains/locality · M7 PF/DM/linearization · M8 LF/scope · M9 information structure · M10 interfaces/other-framework. Topologies: T1 unary mark · T2 binary edge · T3 n-ary fan · T4 region · T5 order/sequence · T6 correspondence · T7 state transition. Outcome = register IDs covering the cell, or `none-attested` (searched, nothing found), or `OUT/FUT` scope.

| Cell | Outcome |
| --- | --- |
| M1.T1 | R04.03 (label-failure marks) |
| M1.T2 | tree geometry (excluded by inventory admission rule) |
| M1.T3 | none-attested (n-ary structure-building marks beyond geometry) |
| M1.T4 | none-attested |
| M1.T5 | R01.04-style stage order (derivational timing, E) |
| M1.T6 | R04.07 conflation |
| M1.T7 | R04.01–.03 labeling states |
| M2.T1 | R02.01 π-states on copies |
| M2.T2 | R01.01–.03, R01.09–.13 |
| M2.T3 | R01.07 fans |
| M2.T4 | R05.04–.06 (island regions with paths) |
| M2.T5 | R01.04 ordered chains |
| M2.T6 | R07.01 sharing (NOW; relation-layer overlay, VR §5) |
| M2.T7 | R05.10 freezing states |
| M3.T1 | R03.01 feature marks |
| M3.T2 | R03.01 probe–goal |
| M3.T3 | R03.02/.05 multiple Agree fans |
| M3.T4 | R03.05 broadcast domains |
| M3.T5 | R03.06/.09 ordered accumulation |
| M3.T6 | R03.12 role–function maps |
| M3.T7 | R03.01 before/after valuation |
| M4.T1 | R02.01 indices |
| M4.T2 | R02.03/.04/.11/.12 |
| M4.T3 | R02.06 split antecedence |
| M4.T4 | R02.03 binding domains |
| M4.T5 | R02.09 ordered logophoric chains |
| M4.T6 | none-attested |
| M4.T7 | none-attested |
| M5.T1 | R06.01 ghost marks |
| M5.T2 | R06.02 recoverability |
| M5.T3 | R12.11 gapping alignment (fan) |
| M5.T4 | R06.03 deletion regions |
| M5.T5 | none-attested |
| M5.T6 | R06.05 identity-type correspondence |
| M5.T7 | R06.07 PF-deletion states |
| M6.T1 | R05.14 γ-marks |
| M6.T2 | R05.07 intervention paths |
| M6.T3 | R05.08 candidate fans |
| M6.T4 | R05.01–.05 regions |
| M6.T5 | R05.11 path ordering |
| M6.T6 | none-attested |
| M6.T7 | R05.03 accessibility states |
| M7.T1 | R08.05 impoverishment marks |
| M7.T2 | R08.09 merger |
| M7.T3 | R08.04 fission fans |
| M7.T4 | none-attested (PF regions are prosodic → OUT) |
| M7.T5 | R08.10/.12 ordering |
| M7.T6 | R08.01/.03/.13 realization correspondences |
| M7.T7 | R08.05/.07 state changes |
| M8.T1 | R09.13 F-marks (LF side) |
| M8.T2 | R09.04 operator–variable |
| M8.T3 | none-attested |
| M8.T4 | R09.01 scope domains |
| M8.T5 | R09.02 scope orderings |
| M8.T6 | none-attested |
| M8.T7 | R09.03 reconstruction states |
| M9.T1 | R09.13–.15 F/G/CT marks |
| M9.T2 | R09.13 association |
| M9.T3 | none-attested |
| M9.T4 | R09.13 focus domains |
| M9.T5 | none-attested |
| M9.T6 | OUT (prosodic correspondence R10.*) |
| M9.T7 | none-attested |
| M10.T1 | scope-routed: unary interface marks — R10.07 prominence (OUT); R12.07 polarity states (FUT-FRAME) |
| M10.T2 | scope-routed: binary interface edges — R10.02 Match pairing (OUT); R12.02 TAG composition edges (FUT-FRAME) |
| M10.T3 | scope-routed: n-ary interface fans — R11.04 nonmanual vectors (FUT-MODAL); R12.06 synchronized links (FUT-FRAME) |
| M10.T4 | scope-routed: interface regions — R10.01 prosodic domains (OUT); R11.05 NMM spans (FUT-MODAL) |
| M10.T5 | scope-routed: interface ordering — R10.03 alignment edges (OUT); R12.04 underspecified precedence (FUT-FRAME) |
| M10.T6 | scope-routed: interface correspondences — R10.02/R10.12 syntax–prosody maps (OUT); R12.05 projection correspondence (FUT-FRAME) |
| M10.T7 | scope-routed: interface state transitions — R11.09 articulator states (FUT-MODAL); R12.08 Dynamic-Syntax states (FUT-FRAME) |

Every `none-attested` cell records a search outcome, not an omission: no tree-attached convention for that module×topology combination surfaced in the §4.1 sources or the candidate hunt below.

### 4.3 Candidate ledger (first audit = mapping pass; second audit = independent adversarial pass)

| Candidate archetype | Source | Audit-1 outcome | Audit-2 outcome | Destination / reason |
| --- | --- | --- | --- | --- |
| Feature strikethrough/checking marks | Adger ch.3 practice | include | confirmed | R03.01 V display (N3) |
| Feature-geometry trees inside nodes | Harley–Ritter tradition | — | **new candidate, dispositioned** | node-internal content → V literals (verbatim geometry string); no new inter-node archetype |
| Late-adjunction dashed attachment | counter-cyclic merge diagrams | — | new candidate, dispositioned | attachment is S; timing is E; dash is styling — no new authored family |
| Linear-adjacency merger notation | E&N 2001 | include | confirmed | R08.09/.10 |
| Vocabulary entry blocks with Pāṇinian ordering | **H&M 1993 (5)/(6), PAGE-VERIFIED** | include | confirmed | R08.01; N4 variation recorded |
| Numeration indices | Chomsky 1995 | reject | confirmed reject | intentionally unrepresented (CA §3.6.3) |
| Cartographic field maps | cartography | reject | confirmed reject | ordinary projection |
| Crash/converge marks | MP practice | include-scoped | confirmed | R13.01 (excluded-scope) |
| Linearization tables | F&P 2005 | include | confirmed | R08.12 |
| Probe-domain shading; escape-hatch marks | phase literature | include | confirmed | R05.02–.03 |
| Chain-links panel | GB notation | include as styling variant | confirmed | G9 variant |
| Grammatical/ungrammatical side-by-side | pedagogy | reject | confirmed reject | workbench composition |
| Agree directionality diacritics | Zeijlstra vs. standard | include | confirmed | role names + V |
| Spanning/amalgams | Nanosyntax | include | confirmed | R08.13 |
| Derivational-timing overlays | replay practice | include-new (E) | confirmed | VR timing badges |
| Copy-vs-repetition marking | Chomsky 2021 practice | include | confirmed | ι both-ways, F67 |
| Parameter tables | P&P pedagogy | reject | confirmed reject | metadata |
| Speech-act participant nodes | perspectival syntax | reject-scope | confirmed | OUT (CE#4) |
| Prosodic tiers | Selkirk/Truckenbrodt | reject-scope | confirmed | OUT (R10.*) |
| Operation-tree views | MG/TAG | reject | confirmed reject | visualizes refused inference |

**Audit-2 (independent adversarial pass), recorded:** performed as (i) the 70-cell matrix exhaustion above, (ii) the composition hunt (F63, F64, F65, F67), (iii) the new-candidate hunt (two new candidates found — feature geometry, late-adjunction dash — both dispositioned without register change). **Result: no new authored inter-node archetype; the 156-row register stands on evidence, not protection.**

## 5. Authentic notation survey (verification statuses per family)

| # | Family | Attested notation, source, status | Babel machine form | Verbatim display | Babel-invented? |
| --- | --- | --- | --- | --- | --- |
| N1 | Agree/valuation | `[uF]`→`[F:val]` bundles; probe–goal arrows — Adger 2003 ch.3–4; Chomsky 1995 ch.4; P&T 2007 (CITED-KNOWLEDGE) | witnesses + before/after literals | authored bundle text | roles invented (flagged) |
| N2 | Feature inheritance | C→T arrows — Chomsky 2008:143ff. (CITED-KNOWLEDGE) | witnesses + inherited literals | authored | roles invented |
| N3 | Checking/deletion | strikethrough/✓ — Adger practice (CITED-KNOWLEDGE) | state literals | authored | roles invented |
| N4 | DM Vocabulary Insertion | **two attested formats, variation recorded**: entry blocks with subset condition + Pāṇinian/elsewhere ordering — **H&M 1993 (5)/(6), pp. 118–121, PAGE-VERIFIED** ("the Vocabulary entry must contain a subset of the morphosyntactic features of the terminal node"; "/-d/ is thus literally the default entry for [+past] Tns"); the later arrow convention `[feats] ↔ /exp/ / context` — Embick & Noyer 2001; Embick 2015 (CITED-KNOWLEDGE) | features/exponent/context literals | either authored format, verbatim | roles invented; both formats authentic |
| N5 | Fusion / Fission / Impoverishment | **H&M 1993 PAGE-VERIFIED**: fusion = sister terminals → one terminal, one item, subset condition (pp. 117–118); fission = rule (3) splitting a feature into its own terminal (pp. 118–119); impoverishment = MS deletion of features/terminals ("deletes the Plural terminal node…", p. 119; rules (43), (46)); modern rule format Arregi–Nevins 2012 (CITED-KNOWLEDGE) | fusion = joint ungrouped; fission = distributive group; impoverishment = before/after | authored rule text | joint/distributive encoding invented (§2, flagged); operations verified |
| N6 | Readjustment | "readjustment rule… deletes 3rd singular /-s/ before plural /-t/" — **H&M 1993 p. 119, PAGE-VERIFIED** | conditioned rewrite literals | authored | roles invented |
| N7 | Linearization/ordering | ⟨a,b⟩ ordering statements — F&P 2005 (CITED-KNOWLEDGE) | one ordering item per pair | authored pairs | multiplicity encoding is Babel's own |
| N8 | Realization equations / spans | root+affix→form expositions — Embick 2015; Nanosyntax spans (CITED-KNOWLEDGE) | joint inputs+output; subtree+exponent | authored | encoding invented |
| N9 | Chain/copy pronunciation | copy deletion/strike — Nunes 2004 (CITED-KNOWLEDGE); plate conventions (PAGE-VERIFIED in repo assets) | ι+π | strike/ghost per plates | display per plates |
| N10 | Derivational transitions | stage sequences — Collins & Stabler 2016 (SEARCH-VERIFIED) | the stage sequence + per-stage literals | — | — |

Explicit statement: generic role names are Babel's neutral machine convention, never claimed as syntacticians' notation; authenticity lives in preserved verbatim strings and the operation semantics with the statuses above.

## 6. Residual page-level verification: the explicit dependency test

H&M 1993 is PAGE-VERIFIED — exact observed history: the MIT-hosted PDF was fetched 2026-07-23; ordinary in-session extraction attempts stalled or failed; a bundled pypdf runtime then extracted it successfully (34 pp., 145,038 chars), and the quoted loci in §4.1/§5 come from that extraction. **No other primary PDF was fetched this session, and no retrieval failure is claimed for any other source** — the remaining families are CITED-KNOWLEDGE by status, with no attempt recorded. Those loci therefore undergo the **dependency test** below: for each family, the exact unverified proposition, everything that could depend on it, and the verdict. The test's rule: a proposition is architecture-material only if a register mapping, a contract rule, a registry entry's required signature or per-mark licensing map (VR §3), a benchmark content rule, or an implementation step would change if the page-level exemplar differed from the cited expectation.

| Family | Unverified proposition (page-level only) | Potential dependents checked | Verdict |
| --- | --- | --- | --- |
| N1 Agree/valuation | the exact printed form of `[uF]`→`[F:val]` bundles in Adger 2003 ch.3–4 / P&T 2007 | register R03.01–.05 map to *witnesses + before/after literals* — independent of any printed form (verbatim strings are authored, never templated); VR licensing keys on values rows, not notation; no benchmark rule or Sol step reads notation | **not material**: only the VR gate-1 evidence packet (a Francis-judgment aid) would cite the page |
| N2 Feature inheritance | Chomsky 2008's printed arrow convention (pp. 133–166) | same structure as N1 | not material (gate-1 packet only) |
| N3 Checking/deletion | Adger's strikethrough/✓ typography | display styling candidates only; floor rendering never depends on it | not material (styling sheet citation only) |
| N7 Ordering statements | F&P 2005's printed ⟨a,b⟩ table format | R08.12 maps to one ordering item per ⟨a,b⟩ statement — format-independent; the multiplicity semantics are Babel's own (PROOF §2), never claimed as F&P's | not material |
| N8 Realization/spans | Embick 2015 / Nanosyntax printed equation layouts | R08.01/.13 map to literals; layouts are gate-1 styling evidence | not material |
| N9 Copy pronunciation | Nunes 2004's printed strike/ghost exemplars | π/ι mapping is contract-native; the repo's 24 cached plates (PAGE-VERIFIED in-repo) already supply attested display conventions | not material — plates substitute as verified visual evidence |

| F-G motivation | flat n-ary coordination / ternary structures as attested X-bar/GB practice at page level (Jackendoff 1977; pre-Kayne practice — CITED-KNOWLEDGE) | F-G's *motivation* only — adoption runs through its own evidence arm (CA §3.5), and the binarity validation check changes only if F-G adopts | not material to any current rule; page-level verification would enrich the factor's rationale only |
| Fallback-practice basis | generic-connector absence beyond the inspected corpus (24 plates + surveyed conventions) | the VR §4 *recommendation's motivation* only — Francis selects among delivered candidates regardless | not material; every artifact states the corpus scope and claims no field census |

**Result:** no register row, contract rule, renderer license, benchmark content rule, or Sol package input depends on any unverified page. The errand (named loci above; owner: Francis-commissioned library access) enriches VR gate-1 evidence packets only, and those gates are Francis-judgment stages that will consume it when available. This is the explicit dependency test the readiness statement cites.
## 7. Reconciliation (per-ID; mechanically checked)

**Grammars (33):** G1–G23 appear in register render cells; G24–G25 (R11.*) FUT-MODAL spec; G26 (R13.01) excluded-scope spec; G27 diagnostics (R13.02–.04); G28–G33 (R12.01–.06) FUT-FRAME spec. All 33 named.

**7.1 All 62 inventory fixtures, individually dispositioned.** Class: D direct / R Replay-derived / Q quarantined. Destinations name the most accurate register rows; a D fixture that proves a renderer-grammar topology rather than one linguistic row lists its grammar plus exemplar consumer rows (no false one-to-one mapping is forced).

| ID | Class | Disposition | Register destination(s) |
| --- | --- | --- | --- |
| F01 | D | usable now | R01.01, R01.02 (G1 topology) |
| F02 | D | usable now | R01.04 (G2 ordered chain) |
| F03 | D | usable now | R01.06 (G2+G8 shared occurrence) |
| F04 | D | usable now | R01.07 (G3 one-origin/multi-gap) |
| F05 | D | usable now | R01.07 (G3 multi-origin) |
| F06 | D | usable now | R01.08 (G4 cross-root) |
| F07 | D | usable now | R01.09 (G5 open binary relation; floor exemplar) |
| F08 | D | usable now | G5 three-role topology; exemplar consumers R02.14, R02.09 |
| F09 | D | usable now | G5 sources×targets hyperedge; exemplar consumers R03.02, R07.04 |
| F10 | D | usable now | R03.04, R05.08 (G6 competition) |
| F11 | D | usable now | R13.02, R05.04 (G7 blocked path — specialized violation marks render once a Francis-approved registry entry exists and the authored signature is complete; VR §§3, 6) |
| F12 | D | usable now | R13.05 (G8 path–region) |
| F13 | D | usable now | R01.14, R13.06 (G8 path–path) |
| F14 | D | usable now | R02.01, R06.06 (G9 occurrence/pronunciation class) |
| F15 | D | usable now | R02.02, R02.07 (G10 reference styles) |
| F16 | D | usable now | R02.06 (G5+G10 antecedent sum) |
| F17 | Q | promote at CE-2 | R03.01 (feature/value rows) |
| F18 | Q | promote at CE-2 | R08.08/R08.01-family (rewrite plates) |
| F19 | D | usable now | R03.11 (G13 theta grid) |
| F20 | D | usable now | G14 unary-mark topology; exemplar consumers R09.13, R13.04 |
| F21 | D | usable now | R05.03 (G14+G15 subtree state) |
| F22 | D | usable now | R05.01 (G15 region) |
| F23 | D | usable now | R05.01, R05.05 (G15 nested/disjoint regions) |
| F24 | D | usable now | R05.12 (G15 non-constituent set) |
| F25 | D | usable now | R05.02 (G16 domain+edge) |
| F26 | D | usable now | R05.04 (G07+G16 boundary+attempted path) |
| F27 | D | usable now | G16 yield-span topology; exemplar consumers R05.01, R08.13 |
| F28 | D | usable now | R04.04 (G17 host/member pair) |
| F29 | D | usable now | R04.06 (G17 discontinuous brace) |
| F30 | D | usable now | R07.01 (G18 sharing overlay; relation-layer multidominance, VR §5) |
| F31 | D | usable now | R03.06 (G19 ordered accumulation) |
| F32 | D | usable now | R08.12 (G20 conflicting orders) |
| F33 | D | usable now | R08.10 (G21 adjacency before/after) |
| F34 | Q | promote at CE-2 | R08.01 (one-to-one map) |
| F35 | Q | promote at CE-2 | R08.03 (fusion many-to-one) |
| F36 | Q | promote at CE-2 | R08.04 (fission one-to-many) |
| F37 | Q | promote at CE-2 | R08.04/R08.12-family (many-to-many map) |
| F38 | Q | promote at CE-2 | R08.13 (span lexicalization) |
| F39 | R | Layer E, legitimate | R13.07 (state change across stages) |
| F40 | R | Layer E, legitimate | R13.07 (birth/death across stages) |
| F41 | Q | FUT-MODAL | R11.01 |
| F42 | Q | FUT-MODAL | R11.02 |
| F43 | Q | FUT-MODAL | R11.05 |
| F44 | Q | FUT-MODAL | R11.06 |
| F45 | Q | FUT-MODAL | R11.09/R11.10 |
| F46 | Q | excluded-scope | R13.01 |
| F47 | D | usable now | R13.02 (G27 marked conflict target — literal values rows always; specialized conflict marks via a gated registry entry, VR §§3, 6) |
| F48 | Q | FUT-FRAME | R12.01 |
| F49 | Q | FUT-FRAME | R12.02 |
| F50 | Q | FUT-FRAME | R12.03 |
| F51 | Q | FUT-FRAME | R12.04 |
| F52 | Q | FUT-FRAME | R12.05 |
| F53 | Q | FUT-FRAME | R12.06 |
| F54 | Q | partial (V-fragment CE-2; remainder FUT-FRAME) | R12.07 |
| F55 | Q | FUT-FRAME | R12.08 |
| F56 | Q | partial (V-fragment CE-2; remainder FUT-FRAME) | R12.09 |
| F57 | D | usable now | R12.10 (licensor + deletion domain) |
| F58 | D | usable now | R12.11 (ordered remnant/correlate alignment) |
| F59 | Q | partial (V-fragment CE-2; remainder FUT-FRAME) | R12.12 |
| F60 | Q | FUT-FRAME | R12.13 |
| F61 | D | usable now | R12.14 (zero realization vs. deletion) |
| F62 | Q | FUT-MODAL | R11.07/R12.15 |

Class totals from this table: D = 35, R = 2, Q = 25 (promote 7 = F17, F18, F34–F38; partial 3 = F54, F56, F59; FUT-MODAL 6 = F41–F45, F62; FUT-FRAME 8 = F48–F53, F55, F60; excluded 1 = F46).

**7.2 Additive-fixture ledger (proposed; all ratification-gated; the inventory's 62 stand unchanged until then).**

| ID | Purpose (minimal) | Register destination(s) | Why the existing 62 do not supply it | Status |
| --- | --- | --- | --- | --- |
| F63 | ACD composition: covert QR path co-rendering with an ellipsis ghost inside the raised object, one derivation | R01.12 + R06.01 | no existing fixture composes G1-covert with G9 in a single stage sequence | proposed-additive |
| F64 | Remnant movement: two nested chains whose containment order matters | R01.05 | F02/F03 test one chain and a shared occurrence, never nested containment order | proposed-additive |
| F65 | Parasitic gap inside an island: fan dependency × region × authored violation status in one derivation | R01.07 + R05.05 | F04 and F26 each prove one topology; their joint interaction is untested | proposed-additive |
| F67 | Copy vs. repetition: identical strings authored as one ι-class and, separately, as two distinct objects; renderer must show identity only where authored | R02.01 (ι-neutrality) | no fixture tests string-identical occurrences authored both ways | proposed-additive |

**7.3 Mechanical proof (run on this file; outputs in the packet audit):** extract §7.1 IDs; assert exactly F01–F62, no missing, no duplicates; assert class counts D=35/R=2/Q=25 and the quarantine split 7+3+6+8+1; assert each additive ID — exactly the four-member set F63, F64, F65, F67 — has its own ledger row with purpose, destination, and justification; assert no fixture ID carries two contradictory dispositions.

**Counterexample register:** former CE#1 (native multidominance) is **reclassified solved** — the relation layer expresses and draws it (R07.01 NOW; sharing relation + Sharing grammar; VR §5), with no contract correction or DAG mechanism needed; CE#2 Y-model branching (CA §2 — consecutive branch-stating stages); CE#3 joint-vs-distributive ambiguity (resolved by §2's multiplicity semantics); CE#4 external/prosodic/framework-native objects (per-row OUT/FUT justifications in §3 — plain scope decisions, tree-connected witnesses always representable). **Current status: no unresolved counterexample.** The 28 adversarial attempts of this engagement (25 prior + 3 transition cases: multi-step transitions; self-consuming conditioning environments; chained boundary operations) all resolve under §2 (incl. `priorAnchors`); two stated scope boundaries bound the claim (comparative/counterfactual commitments are prose-layer; non-tree objects are explicit exclusions); the falsification procedure — encode → name the loss → locate the layer → smallest general correction → re-test — is standing, and any future failure enters this register.
