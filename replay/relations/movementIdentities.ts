/**
 * Exact movement identities for production classification.
 *
 * This module replaces the substring/regex "move-like" fallback. A label is
 * movement-classified only when its folded key — lowercase letters, all other
 * characters removed — is a declared member of this set. VR §3 permits folding
 * and nothing else: no regex, no substring matching, no similarity. An
 * unlisted name never matches, partially or otherwise, so an authored
 * non-movement relation (CliticCluster, AffixRealization, FocusShift, …) can
 * never be drawn as a movement arrow again.
 *
 * Membership is deliberate, name by name:
 * - compiler and derivation-step operation labels the pipeline itself uses
 *   (Move, InternalMerge, chain labels);
 * - the accepted registered trajectory relation names from the visual
 *   grammar (AbarMove, AMove, HeadMove, Lowering, Scrambling, Smuggling,
 *   RemnantMovement, RollUpMovement, AcrossTheBoardMovement,
 *   SidewardMovement, OperatorVariableBinding);
 * - declared observed identities: exact, unambiguous standard movement terms
 *   that committed model-output fixtures author ('wh-movement',
 *   'auxiliary-head-movement', 'phrasal-movement'). These are declared
 *   identities, not patterns — a new coinage falls to the neutral fallback.
 */

import {
  findRelationRegistryEntry,
  productionRelationRegistry
} from '../relationDispatch/index.js';
import { PRODUCTION_RENDER_FAMILIES } from './renderFamilies.ts';

export const foldMovementIdentityKey = (value?: string): string =>
  String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');

export const MOVEMENT_OPERATION_IDENTITIES: ReadonlySet<string> = new Set([
  // Pipeline operation labels.
  'move',
  'movement',
  'internalmerge',
  'remerge',
  // Chain labels.
  'achain',
  'whchain',
  'abarchain',
  'headchain',
  // Accepted registered trajectory relation names (folded).
  'headmove',
  'headmovement',
  'amove',
  'amovement',
  'abarmove',
  'abarmovement',
  'operatorvariablebinding',
  'lowering',
  'scrambling',
  'smuggling',
  'remnantmovement',
  'rollupmovement',
  'acrosstheboardmovement',
  'sidewardmovement',
  // Declared observed identities from committed fixtures — exact standard
  // terms of art, each individually defensible; never a pattern.
  'whmovement',
  'auxiliaryheadmovement',
  'phrasalmovement'
]);

/** Exact folded membership; the only lawful movement classification. */
export const isMovementIdentity = (label?: string): boolean => {
  const key = foldMovementIdentityKey(label);
  return key.length > 0 && MOVEMENT_OPERATION_IDENTITIES.has(key);
};

/**
 * Authored relations use the production registry's exact identity policy.
 * This is deliberately narrower than `isMovementIdentity`, which also knows
 * Replay's own operation labels and folded legacy operation spellings.
 */
export const registeredTrajectoryDisplayKind = (
  label?: string
): 'head' | 'phrasal' | '' => {
  const entry = findRelationRegistryEntry(
    productionRelationRegistry,
    String(label || '')
  );
  if (!entry) return '';
  const family = PRODUCTION_RENDER_FAMILIES[entry.id];
  if (family?.family !== 'trajectory') return '';
  return family.trajectoryKind === 'head' || family.trajectoryKind === 'lowering'
    ? 'head'
    : 'phrasal';
};

export const isRegisteredTrajectoryRelation = (label?: string): boolean =>
  Boolean(registeredTrajectoryDisplayKind(label));

export const isRegisteredFrontingTrajectoryRelation = (label?: string): boolean =>
  isRegisteredTrajectoryRelation(label) && isFrontingMovementIdentity(label);

/**
 * Exact head/phrasal kind per movement identity. Generic labels (move,
 * movement, internalmerge, remerge, achain) carry no kind — structure decides
 * — and unlisted names carry none either: no text pattern ever assigns a
 * kind.
 */
export const MOVEMENT_IDENTITY_KINDS: Readonly<Record<string, 'head' | 'phrasal'>> = {
  headmove: 'head',
  headmovement: 'head',
  headchain: 'head',
  auxiliaryheadmovement: 'head',
  lowering: 'head',
  amove: 'phrasal',
  amovement: 'phrasal',
  abarmove: 'phrasal',
  abarmovement: 'phrasal',
  abarchain: 'phrasal',
  whchain: 'phrasal',
  whmovement: 'phrasal',
  phrasalmovement: 'phrasal',
  operatorvariablebinding: 'phrasal',
  scrambling: 'phrasal',
  smuggling: 'phrasal',
  remnantmovement: 'phrasal',
  rollupmovement: 'phrasal',
  acrosstheboardmovement: 'phrasal',
  sidewardmovement: 'phrasal'
};

export const movementIdentityKind = (label?: string): 'head' | 'phrasal' | '' =>
  MOVEMENT_IDENTITY_KINDS[foldMovementIdentityKey(label)] || '';

/**
 * Exact fronting-type (A-bar-flavored) movement identities, replacing the old
 * fronting regex. Used by replay step sequencing (e.g. pre-fronting casing and
 * landing-step synthesis exclusions).
 */
export const FRONTING_MOVEMENT_IDENTITIES: ReadonlySet<string> = new Set([
  'abarmove',
  'abarmovement',
  'abarchain',
  'whchain',
  'whmovement',
  'phrasalmovement',
  'operatorvariablebinding',
  'scrambling',
  'rollupmovement',
  'sidewardmovement'
]);

export const isFrontingMovementIdentity = (label?: string): boolean =>
  FRONTING_MOVEMENT_IDENTITIES.has(foldMovementIdentityKey(label));
