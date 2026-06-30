# UltimateAI Workflow Engine Architecture (v1.2)

## 1. Overview
The Workflow Engine (Phase 2) replaces the rigid Sequential Loop inside the `ProductionKernel` with a dynamic Directed Acyclic Graph (DAG) orchestration engine. It empowers UltimateAI to define execution sequences declaratively, enabling complex dependency management and safe parallel execution without breaking the architecture boundaries.

## 2. Principle 49
**Every Workflow Is Deterministic:** A workflow MUST produce the same execution graph from the same definition. Execution order may vary only where parallelism is explicitly declared and does not violate dependency constraints.

## 3. Workflow Hierarchy
The orchestration model adopts a strict 4-level hierarchy:

1. **Workflow**: The highest-level definition. Represents a full pipeline.
   - Example: `DeepResearchWorkflow`
2. **Stage**: A sequential phase within a workflow. Stages *never* run in parallel. A workflow moves to the next Stage only when all Jobs in the current Stage complete successfully.
   - Example: `IntelligenceGatheringStage`, `AnalysisStage`, `ReportingStage`
3. **Job**: An independent collection of Tasks within a Stage. Jobs in the same Stage run in *parallel*.
   - Example: `FetchMarketDataJob`, `FetchSocialSentimentJob`
4. **Task**: The atomic execution unit. A Task maps 1-to-1 to a `RuntimeCapability` (not a specific class). Tasks within a Job run according to their defined dependencies (DAG).
   - Example: `ExecutePlanning`, `ExecuteReasoning`

## 4. Execution Context
To prevent parameter bloat, the Workflow Engine uses a single `ExecutionContext` containing:
- `traceId`: The global trace identifier.
- `workflowId`: The specific workflow being executed.
- `runtimeContext`: The underlying data context required by Runtimes.

## 5. Components
### A. Code-Driven Builder
Workflows are constructed using a canonical, type-safe fluent Builder API (e.g., `new WorkflowBuilder()`). This ensures compile-time validation of structure and prevents syntax errors in JSON definitions from propagating to the engine.

### B. Workflow Validator & DAG Resolver
Before execution, a workflow undergoes two strict phases:
1. **WorkflowValidator**: Structural integrity (duplicate IDs, empty stages, orphan tasks).
2. **DAGResolver**: Ensures tasks within a Job form a valid Directed Acyclic Graph (no cyclic dependencies).

### C. Workflow Engine
The engine executes the validated workflow by iterating sequentially through Stages, launching Jobs in parallel via `Promise.all`, and orchestrating Tasks within Jobs based on their DAG topological sort.

## 6. Integration
The Workflow Engine integrates seamlessly with the foundations:
- **Observability**: Emits high-level telemetry (`WorkflowStarted`, `StageStarted`, `JobStarted`).
- **Reliability**: Checkpoints are expanded to track progression through Stages and Jobs. If a failure occurs in Stage 3, resuming the workflow will fast-forward Stages 1 and 2 completely.
