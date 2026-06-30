# Decision Runtime Baseline

This document locks in the inviolable architectural principles for the UltimateAI Intelligence Layer (The Decision Runtime). As the system evolves from an AI Orchestrator into a Decision Operating System, these rules ensure that the decision-making process remains robust, auditable, and deterministic.

## The 10 Inviolable Principles of the Decision Runtime

### Principle 1: Reasoning never executes.
The Reasoning Engine is strictly for understanding intent, breaking down problems, and establishing priorities. It produces an `ExecutionIntent` but does not run any tasks.

### Principle 2: Planning never mutates.
The Planning Engine translates the `ExecutionIntent` into a concrete `Execution` DAG. Once generated, this baseline execution plan is immutable from the planner's perspective.

### Principle 3: Validation never repairs.
The Execution Validator acts exclusively as a Quality Gate. It strictly observes the DAG and flags structural errors or capability mismatches. It does not attempt to fix the errors it finds.

### Principle 4: Critic never modifies.
The Critic Engine operates as a subjective Architectural Quality Engine. It evaluates the qualitative design of the DAG and outputs structured `CriticRecommendation`s, but it never touches the DAG itself.

### Principle 5: Reflection never mutates.
The Reflection Engine is the Decision Governance layer. It evaluates recommendations against business goals and user constraints to decide whether to `ACCEPT`, `REJECT`, `MODIFIED`, or `DEFER`. It outputs `ReflectionDecision`s but does not execute them.

### Principle 6: Repair is the only graph transformer.
Only the Repair Engine is authorized to mutate the Execution graph. It operates as a 100% deterministic, pure-function graph transformer, acting exclusively on approved `ReflectionDecision`s to produce an immutable `Execution v2`.

### Principle 7: Kernel executes only validated executions.
The Production Kernel is structurally forbidden from executing any DAG that has not successfully passed the Execution Validator.

### Principle 8: Every major decision produces a traceable artifact.
Every engine produces an artifact (`ExecutionIntent`, `Execution`, `ValidationReport`, `CriticEvaluation`, `ReflectionDecision`, `ExecutionChangeSet`). Every artifact implements `TraceableArtifact`, meaning it carries an `id`, `correlationId`, `createdAt`, and `source` to form a comprehensive Decision Ledger.

### Principle 9: Every repaired execution must be validated again.
The `Execution v2` emitted by the Repair Engine must loop back through the Execution Validator before it is ever sent to the Production Kernel.

### Principle 10: Decision Pipeline has exactly one public entry point.
The `IntelligencePipeline.execute()` method is the sole orchestrator. External systems do not invoke internal engines directly; all traffic flows through the End-to-End orchestrated pipeline.

### Principle 11: Knowledge Runtime never changes history. It only appends knowledge.
The Knowledge Graph is strictly append-only. Nodes and Edges must never be deleted or mutated. If history needs to evolve or be corrected, new Nodes and Edges are created with semantic relationships such as `SUPERSEDES` or `DERIVED_FROM`. This guarantees an unbroken, trustworthy historical record.

### Principle 12: Knowledge Runtime answers semantic relationship questions through navigation, never through storage-specific queries.
The Knowledge Runtime is fundamentally traversal-oriented. It does not expose query languages (Cypher, SQL) or storage mechanisms. All exploration occurs via semantic navigation strategies (Breadth-First, Version Chain, Correlation Chain) allowing the underlying storage to change seamlessly.

### Principle 13: Knowledge Runtime reconstructs history; it never rewrites it.
Reconstruction mode does not mutate the graph or generate new knowledge. Even in BRANCH mode, it creates a virtual reconstruction timeline without appending or altering actual nodes and edges.

### Principle 14: Learning never reads the graph directly. It learns through Reconstruction.
The Learning Engine must never depend on storage logic, queries, or raw graph traversals. It strictly receives `KnowledgeSnapshot`, `KnowledgeTimeline`, and `KnowledgePath` artifacts output by the Knowledge Reconstruction Engine. All complexity of reconstructing historical states belongs to the Knowledge Runtime.

### Principle 15: Learning never creates truth. It promotes validated experience into reusable knowledge.
The Learning Engine does not assume its discovered patterns are absolute truths. It rigorously extracts experiences, analyzes patterns, synthesizes candidates, and strictly validates them. Only after validation does it promote an experience into `LearnedKnowledge`, which can then be reused but never blindly trusted as unalterable truth.

### Principle 16: Learned Knowledge is Immutable.
`LearnedKnowledge` is never edited in place. Any evolution, correction, or depreciation of knowledge results in a new version or a new status (e.g., superseded, deprecated). This ensures the entire learning lineage remains perfectly auditable and reproducible.
