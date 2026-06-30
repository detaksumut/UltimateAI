# Architecture Decisions Record (ADR)

*Logs major shifts in architectural strategy.*

### 1. The Kernel Loop Strategy
**Context:** How should the primary user request loop be managed?
**Decision:** The Production Kernel uses an imperative, explicit orchestration flow rather than an implicit Event-Bus chain.
**Reason:** Ensures traceability, auditability, and clear lifecycle boundaries. Event bus remains for observability only.

### 2. Double-Reasoning Pipeline
**Context:** When should Reasoning be involved?
**Decision:** Once before Execution (Advising the Blueprint), and once after Evolution (Forming the final conclusion).
**Reason:** Separates risk-assessment of actions from synthesis of new knowledge.

### 3. Execution Artifact Separation
**Context:** How to store massive build outputs without clogging the ExecutionLog?
**Decision:** Split into `IExecutionLogger` (append-only JSON facts) and `IExecutionArtifactStore` (physical file binaries).
**Reason:** Keeps the Log blazing fast for the Knowledge Runtime to reconstruct.
