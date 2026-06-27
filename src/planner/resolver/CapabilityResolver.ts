// src/planner/resolver/CapabilityResolver.ts

/**
 * CapabilityResolver translates a planning {@link Goal} into the set of
 * capabilities required to achieve that goal. This skeleton currently returns
 * an empty immutable array; future implementations will perform semantic
 * matching against a capability catalog.
 */
import { Goal } from "./GoalResolver";

export class CapabilityResolver {
  /**
   * Resolve the provided {@link Goal} into a list of capability identifiers.
   * @param goal - The planning goal derived from a {@link PlanningRequest}.
   * @returns An immutable array of capability strings.
   */
  public resolve(goal: Goal): readonly string[] {
    // TODO: Implement semantic capability matching based on the goal intent.
    return [] as const;
  }
}
