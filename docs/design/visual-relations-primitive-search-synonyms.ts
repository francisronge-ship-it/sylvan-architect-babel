/**
 * Documentation and Atlas-search terms for Babel's visual vocabulary.
 *
 * Runtime Tier-2 dispatch must not import this catalog. Primitive words name
 * drawings, not authored relation claims.
 */

export type VisualPrimitiveSearchSynonymGroup = {
  concept: string;
  aliases: readonly string[];
};

const primitive = (
  concept: string,
  aliases: readonly string[]
): VisualPrimitiveSearchSynonymGroup => ({ concept, aliases: [concept, ...aliases] });

export const VISUAL_PRIMITIVE_SEARCH_SYNONYMS: readonly VisualPrimitiveSearchSynonymGroup[] = [
  primitive('Movement curve', ['trajectory curve', 'curved movement path', 'movement arrow']),
  primitive('Orthogonal movement', ['elbow movement', 'rectilinear movement', 'drop across rise path']),
  primitive('Cross-workspace crest', ['sideward crest', 'cross root trajectory', 'workspace spanning arc']),
  primitive('Carrier arrow', ['smuggling arrow', 'carrier trajectory', 'heavy movement arrow']),
  primitive('Path states', ['trajectory states', 'path outcome styling', 'licensed blocked path']),
  primitive('Gap label', ['trace label', 'gap notation', 'parasitic gap label']),
  primitive('Coindex', ['coindexation', 'shared index', 'relation index']),
  primitive('Lens emphasis', ['relation lens', 'anchor emphasis', 'lens highlight']),
  primitive('Forest light', ['identity forest light', 'occurrence light', 'identity beams']),
  primitive('Rectangular domain', ['control domain', 'domain rectangle', 'rectangular enclosure']),
  primitive('Control connector', ['control dependency', 'controller link', 'control arrow']),
  primitive('Elliptic domain', ['binding domain', 'domain ellipse', 'binding oval']),
  primitive('Predication connector', ['predication path', 'predicate link', 'predicand connector']),
  primitive('Path-node rings', ['path node markers', 'circular square path nodes', 'path rings']),
  primitive('Copy fork', ['copy branching', 'gap fork', 'parasitic copy fork']),
  primitive('Barrier cut', ['boundary slash', 'island cut', 'barrier slash']),
  primitive('Ghosting', ['ellipsis ghost', 'silent material ghost', 'ghosted pronunciation']),
  primitive('Correspondence curves', ['alignment curves', 'correspondence paths', 'gapping links']),
  primitive('Correspondence index', ['alignment index', 'correlate index', 'equality index']),
  primitive('Strike', ['deletion strike', 'strikethrough', 'deleted material line']),
  primitive('Constituent enclosure', ['constituent box', 'copy enclosure', 'shell enclosure']),
  primitive('Gradient enclosure', ['carrier enclosure', 'forbidden region fill', 'gradient region']),
  primitive('Branch overlay', [
    'pair merge fork',
    'pair merge branch',
    'adjunct domain branch',
    'extraction adjunct branch',
    'restyled tree edge'
  ]),
  primitive('Shared branch', ['multidominance branch', 'shared node branch', 'converging branch']),
  primitive('Crossed domain ovals', ['argument sharing domains', 'serial predicate ovals', 'crossed ovals']),
  primitive('Label box', ['role box', 'argument label box', 'shared role plaque']),
  primitive('Underline', ['chunk underline', 'idiom underline', 'member underline']),
  primitive('Domain bracket', ['interpretation bracket', 'idiom domain bracket', 'constituent bracket']),
  primitive('Plaque shell', ['feature plaque', 'record plaque', 'plaque frame']),
  primitive('Feature vine', ['sharing vine', 'feature convergence', 'feature bearer vine']),
  primitive('Cycle badge', ['cycle marker', 'search cycle badge', 'agree cycle number']),
  primitive('Feature connectors', ['agree connectors', 'feature paths', 'valuation assignment collection paths']),
  primitive('Dependent-case elbow', ['dependent case path', 'case elbow', 'low case connector']),
  primitive('Accord connector', ['accord path', 'concord connector', 'polarity link']),
  primitive('Boxed index', ['index box', 'accord index', 'boxed coindex']),
  primitive('Phase arc', ['phase boundary arc', 'phase dome', 'phase enclosure']),
  primitive('Transfer arcs', ['spell out arcs', 'transfer domain arcs', 'phase transfer arcs']),
  primitive('Overlay annotation', ['domain annotation', 'overlay label', 'relation annotation']),
  primitive('Edge outline', ['phase edge outline', 'edge box', 'edge shell']),
  primitive('Access path', ['post transfer path', 'failed access path', 'access dependency']),
  primitive('Verdict glyph', ['verdict face', 'failure face', 'success face']),
  primitive('Candidate rail', ['landing candidate rail', 'candidate lane', 'host comparison rail']),
  primitive('Blocking cross', ['blocking x', 'failure cross', 'rejected mark']),
  primitive('Licensed check', ['licensed tick', 'success check', 'accepted mark']),
  primitive('Intervention path', ['intervention search', 'blocked probe path', 'minimality path']),
  primitive('Blocked extraction curve', ['extraction diagnostic curve', 'blocked dependency curve', 'adjunct extraction path']),
  primitive('Verdict label', ['analysis label', 'judgment label', 'underlined verdict', 'extraction annotation']),
  primitive('Prominence branches', ['focus branches', 'strong weak branches', 'prominence contrast']),
  primitive('Projection hop', ['focus projection path', 'f projection hop', 'projection arrow']),
  primitive('Feature annotation', ['f mark', 'feature mark', 'projection feature']),
  primitive('Accent annotation', ['accent mark', 'pitch accent', 'h star mark']),
  primitive('Nested association curves', ['nested licensing curves', 'strong npi paths', 'association arcs']),
  primitive('Feature notation', ['licensing notation', 'npi feature mark', 'feature formula']),
  primitive('Ledger frame', ['storage ledger', 'cooper storage plaque', 'state ledger']),
  primitive('Covert path', ['lf path', 'qr trajectory', 'covert movement']),
  primitive('Scope domain', ['lf domain', 'scope box', 'semantic scope region']),
  primitive('Ranked scope hulls', ['nested scope hulls', 'operator domains', 'ranked envelopes']),
  primitive('Variable-binding path', ['operator variable path', 'binding curve', 'semantic binding link']),
  primitive('Role grid', ['theta grid', 'argument grid', 'role table']),
  primitive('PF plate frame', ['pf frame', 'morphology plate', 'realization plate']),
  primitive('PF plate rows', ['pf rows', 'realization rows', 'morphology entries']),
  primitive('Rewrite arrow', ['mapping arrow', 'realization arrow', 'rewrite operator']),
  primitive('Correspondence map', ['pf correspondence', 'many to many map', 'feature exponent map']),
  primitive('Bundle shell', ['feature bundle box', 'fission bundle', 'bundle frame']),
  primitive('Delinking mark', ['impoverishment cross', 'feature delink', 'removed link']),
  primitive('State lanes', ['before after lanes', 'dislocation lanes', 'state rows']),
  primitive('Comparison column layout', ['order columns', 'linearization comparison', 'precedence columns']),
  primitive('Anchor badge', ['array member badge', 'anchor ordinal', 'participation badge']),
  primitive('Anchor rail', ['anchor array rail', 'role rail', 'participation rail'])
];
