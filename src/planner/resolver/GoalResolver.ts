// src/planner/resolver/GoalResolver.ts

/**
 * GoalResolver is an internal service of the Planner subsystem.
 * Its responsibility is to turn a {@link PlanningRequest} into a
 * goal representation that can be consumed by the CapabilityResolver.
 *
 * Currently the implementation is a thin skeleton – it extracts the
 * raw intent string from the request and returns it as a simple immutable
 * object. Future work will include semantic analysis, intent parsing, and
 * AI‑driven reasoning (TODO).
 */
import { PlanningRequest } from "../models/PlanningRequest";

/** Minimal immutable representation of a planning goal. */
export interface Goal {
  /** The original intent supplied by the user. */
  readonly intent: string;
  /** TODO: add structured fields after semantic analysis. */
}

/**
 * Service class that resolves a {@link PlanningRequest} into a {@link Goal}.
 * It is designed for dependency‑injection – no global state or singletons.
 */
export class GoalResolver {
  /**
   * Resolve the planning request into a goal.
   * @param request - the incoming planning request
   * @returns an immutable {@link Goal} object
   */
  public resolve(request: PlanningRequest): Goal {
    // TODO: Perform semantic analysis & AI reasoning on request.intent.
    // For now we simply forward the intent as the goal representation.
    return { intent: request.intent };
  }
}
