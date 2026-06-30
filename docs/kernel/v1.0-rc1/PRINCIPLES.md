# UltimateAI Architectural Principles
*The definitive laws governing the UltimateAI Cognitive Operating System.*

## Foundation Principles
1. **Immutability of Truth (Principle 16 & 21):** Artifacts (like `LearnedKnowledge`) are never modified once created. They only evolve through successors, maintaining a perfect historical audit trail.
2. **Every Decision Leaves an Artifact (Principle 24):** No runtime makes a choice silently. Every AI thought and deterministic validation produces a formal, auditable receipt (e.g., `ValidationReport`, `EvolutionHypothesis`).
3. **Runtime Collaboration Through Contracts (Principle 25):** Runtimes NEVER call each other's internal implementations. They communicate purely by exchanging their respective immutable artifacts.
4. **Runtime Owns Its Lifecycle (Principle 26):** Each runtime is strictly responsible for its own artifacts. No runtime can create, modify, or delete artifacts belonging to the lifecycle of another runtime. 
5. **Events Never Control Execution (Principle 27):** Runtime events are purely for observability (fire-and-forget). They must never block, alter, or control the execution flow of the Coordinator or Runtime.

## System & Registration
6. **Capabilities, Not Implementations (Principle 28):** The Kernel and Coordinator only request capabilities. The Resolver determines the implementation.
7. **Runtime Is Discoverable (Principle 29):** All runtimes must be discovered via the `RuntimeRegistry`. The Kernel cannot call any runtime directly.
8. **Capabilities Are Stable, Implementations Evolve (Principle 30):** The capability contract is a long-term API. Runtime implementations can be added, replaced, or scaled without altering the Kernel.

## Cognitive Boundaries
9. **Reasoning Never Creates Knowledge (Principle 31):** The Reasoning Runtime only consumes knowledge. It must never create `LearnedKnowledge`, mutate existing knowledge, or alter the graph. All learning must exclusively pass through the Learning Runtime.
10. **Context Before Intelligence (Principle 32):** The AI Engine must never directly access the raw Repository or Graph. Retrieval and Context Building must always deterministically pre-process the knowledge to ensure strict grounding.
11. **Knowledge Before Inference (Principle 33):** All inference must strictly originate from a `KnowledgeBundle` built deterministically *before* AI reasoning begins.
12. **Conclusions Are Advisory (Principle 34):** The `ReasoningConclusion` is purely a recommendation. The calling runtime (Planning, Execution, etc.) retains ultimate decision-making authority over its domain, preventing the Reasoning Runtime from becoming a "God Runtime".

## Operational Reality
13. **Strategy Before Tactics (Principle 35):** The Planning Runtime produces the high-level strategy (Blueprint). The ExecutionPlanner is strictly a tactical scheduler that translates the immutable blueprint into an operational task graph.
14. **Execution Produces Facts, Never Interpretation (Principle 36):** The Execution Runtime only generates an objective log of what physically occurred (durations, bytes, outputs). Interpretation and learning are the sole responsibility of the Knowledge Runtime.
15. **Every Action Is Logged (Principle 37):** No physical action or tool invocation can occur without producing a corresponding deterministic entry in the append-only `ExecutionLog`.

## The Closed Loop
16. **Facts Flow Forward (Principle 38):** Execution generates facts ➜ Knowledge reconstructs them ➜ Learning synthesizes them ➜ Evolution manages them ➜ Reasoning utilizes them. No runtime may skip or bypass this sequential flow.
17. **Artifacts Are the Language of the System (Principle 39):** Runtimes communicate exclusively through strictly contracted, auditable artifacts. Internal state is never shared horizontally between runtimes.
18. **The Kernel Owns the Primary Cognitive Loop (Principle 40):** The Production Kernel is the sole orchestrator of the main runtime sequence. Runtimes cannot alter the global flow.
19. **Integration Does Not Change Ownership (Principle 41):** Connecting runtimes via the Kernel does not change their domain boundaries. Execution still owns the Log, Learning still owns LearnedKnowledge. The Kernel merely passes the artifacts.
20. **The Kernel Orchestrates, Never Thinks (Principle 42):** The Kernel generates no knowledge, reasoning, or execution plans of its own. It only requests capabilities and manages the sequence.

## Architecture Governance
21. **Constitution Before Code (Principle 43):** Any change that affects runtime boundaries, artifacts, contracts, architectural principles, or the cognitive loop must first be reflected in the architecture documentation before implementation begins. The architecture documentation is the authoritative source of truth; code must conform to it.

## Traceability
22. **Every Artifact Is Traceable (Principle 45):** Every artifact produced by the Cognitive Platform must carry immutable identity and trace metadata that allows complete end-to-end reconstruction of its origin.
23. **The Constitution Is Executable (Principle 46):** Architectural principles are not enforced solely by documentation. They must be continuously verified through automated tooling, static analysis, and continuous integration.

## Observability
24. **Every Runtime Is Observable (Principle 47):** Every runtime execution MUST emit immutable telemetry events that enable deterministic reconstruction of execution history, artifact lineage, runtime health, and production metrics without affecting runtime behavior.

## Reliability
25. **Every Execution Is Recoverable (Principle 48):** Every execution MUST support deterministic recovery through immutable checkpoints, declarative recovery policies, and observable reliability events without violating architectural boundaries.

## Workflow Orchestration
26. **Every Workflow Is Deterministic (Principle 49):** A workflow MUST produce the same execution graph from the same definition. Execution order may vary only where parallelism is explicitly declared and does not violate dependency constraints.

## Execution Scheduling
27. **Every Execution Is Scheduled (Principle 50):** Every executable unit MUST be dispatched exclusively through the Execution Scheduler. No component may execute work directly outside the scheduling pipeline.

## Data & Persistence
28. **Every Output Is an Immutable Artifact (Principle 51):** Every execution output MUST be represented as an immutable artifact with a unique identity, deterministic lineage, verifiable provenance, and explicit versioning. Artifacts may be superseded by newer versions but must never be modified in place.

## Knowledge & Intelligence
29. **Knowledge Emerges from Relationships (Principle 52):** Artifacts become knowledge only when their relationships are explicitly represented. The Knowledge Graph MUST model relationships without duplicating artifact payloads, preserving the Artifact Repository as the single source of truth.
30. **Memory Is Context Selection (Principle 53):** Memory MUST retrieve context through explicit retrieval strategies and deterministic ranking. Storage alone is not memory; memory is the process of selecting the most relevant context for the current execution.
