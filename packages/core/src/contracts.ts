/**
 * @zandegi/core/contracts — the client-safe slice of core.
 *
 * Apps may import this subpath (AD-2). It carries contract types and pure
 * display predicates only: nothing here reads I/O, and nothing here is
 * server-only policy (safety routing, scoring formulas, verification tiers
 * stay behind the package root).
 *
 * Story 1.4 owns defining the full Goal / Pursuit / Mission / stream contract
 * surface. This file deliberately exposes only what a client already consumes.
 */

export {
  percentageAllowed,
  progressDisplayAllowed,
  type GoalType,
  type ProgressDisplay,
} from "./goal-types";
