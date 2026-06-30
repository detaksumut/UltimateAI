# Milestone 2: Known Issues Resolved

This document serves as an immutable registry of technical issues discovered and resolved during the Milestone 2 (Execution Certification) quality gate. This history prevents future regressions in the execution scheduler and reliability layers.

| ID | Bug | Root Cause | Resolution |
| :--- | :--- | :--- | :--- |
| **M2-001** | EventBus race | Task dispatch (`tryDispatch`) executed asynchronously before `TaskQueued` event subscribers were fully processed by the event bus due to `setTimeout` scheduling. | Refactored `tryDispatch` call order and ensured proper event bus execution. |
| **M2-002** | Cancellation timing | `CancellationTest` subscribed to `TaskStarted` instead of `TaskQueued`, causing the cancellation command to arrive after the task was already running. Since mock runtime did not check cancellation tokens, the task completed successfully. | Changed subscription to `TaskQueued` to intercept task in the `READY` queue, and resolved race conditions in scheduler cancellation state transitions. |
| **M2-003** | Trace propagation | `TestEnvironment.runWorkflow` did not pass a valid `traceId` inside `runtimeContext`, causing `ReliabilityInterceptor` checkpoints to crash trying to read `undefined.traceId`. | Refactored the context builder helper inside `TestEnvironment` to properly construct and populate the lineage `traceId`. |
| **M2-004** | Workflow validation | Mock test tasks generated in the test suites lacked structural fields required by `WorkflowValidator` (specifically missing `name` and `dependencies` array). | Standardized dummy workflow generation helper `createDummyWorkflow` to comply with the production `Task` contract. |
| **M2-005** | Constructor mismatch | `ReliabilityInterceptor` constructor parameters were mismatched inside `TestEnvironment` setup, passing the event bus directly instead of `CircuitBreakerRegistry` and `RuntimeResolver`. | Fixed the instantiation structure inside `TestEnvironment` by supplying proper mocks and registries. |
