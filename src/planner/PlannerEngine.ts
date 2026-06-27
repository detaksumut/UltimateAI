// src/planner/PlannerEngine.ts

/**
 * PlannerEngine is the concrete orchestrator that implements the IPlanner
 * contract. It wires together the planning pipeline using dependency injection
 * and follows a deterministic, side‑effect‑free flow.
 *
 * Current flow (skeleton):
 *   1. Resolve a {@link Goal} from the incoming {@link PlanningRequest}
 *      via {@link GoalResolver}.
 *   2. Derive required capabilities from the goal using {@link CapabilityResolver}.
 *   3. Build a placeholder {@link TaskGraph} (empty or simple) based on those
 *      capabilities.
 *   4. Optimise the graph with {@link PlanOptimizer} (no changes for now).
 *   5. Return a {@link PlanningResult} containing the graph.
 *
 * The implementation intentionally contains TODO markers for future work:
 *   • semantic planning – turning natural‑language intent into a structured Goal
 *   • graph construction – mapping capabilities to TaskNode objects with
 *     dependencies
 *   • dependency analysis – inferring ordering & parallelism
 *   • execution strategy – cost/resource optimisation, scheduling, etc.
 *
 * No singleton, global, or mutable static state is used; all collaborators are
 * injected via the constructor, making the engine easy to test and compose.
 */
import { IPlanner } from "./interfaces/IPlanner";
import { PlanningRequest } from "./models/PlanningRequest";
import { PlanningResult } from "./models/PlanningResult";
import { TaskGraph } from "./TaskGraph";
// import { TaskNode } from "./models/TaskNode"; // removed, TaskNode creation moved to TaskGraphBuilder
import { GoalResolver, Goal } from "./resolver/GoalResolver";
import { CapabilityResolver } from "./resolver/CapabilityResolver";
import { PlanOptimizer } from "./optimizer/PlanOptimizer";
import { TaskGraphBuilder } from "./builder/TaskGraphBuilder";

export class PlannerEngine implements IPlanner {
  /**
   * Construct the PlannerEngine with its required collaborators.
   * @param goalResolver - resolves a PlanningRequest into a Goal.
   * @param capabilityResolver - maps a Goal to required capability strings.
   * @param planOptimizer - (currently) a pass‑through optimizer for TaskGraph.
   */
  constructor(
    private readonly goalResolver: GoalResolver,
    private readonly capabilityResolver: CapabilityResolver,
    private readonly taskGraphBuilder: TaskGraphBuilder,
    private readonly planOptimizer: PlanOptimizer,
  ) {}

  /**
   * Execute the planning pipeline.
   * @param request - the planning request containing intent and context.
   * @returns a Promise that resolves to a PlanningResult.
   */
  public async plan(request: PlanningRequest): Promise<PlanningResult> {
    // TODO: semantic planning – analyse request.intent to produce a richer Goal.
    const goal: Goal = this.goalResolver.resolve(request);

    // TODO: capability matching – resolve which capabilities satisfy the Goal.
    const capabilities: readonly string[] = this.capabilityResolver.resolve(goal);

    // TODO: graph construction – delegated to TaskGraphBuilder.
    const rawGraph: TaskGraph = this.taskGraphBuilder.build(capabilities);

    // TODO: dependency analysis, execution strategy, cost/resource optimisation.
    const optimizedGraph: TaskGraph = this.planOptimizer.optimise(rawGraph);

    // Assemble final PlanningResult – no errors for the skeleton implementation.
    const result: PlanningResult = {
      graph: optimizedGraph,
    };

    return result;
  }
}
