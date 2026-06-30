# UltimateAI Execution Scheduler Architecture (v1.3)

## 1. Overview
The Execution Scheduler (Phase 2) takes absolute ownership over the *timing*, *prioritization*, and *resource allocation* of all executable units. While the `WorkflowEngine` determines *what* to run (the structure), the Scheduler dictates *when* and *where* it runs.

## 2. Principle 50
**Every Execution Is Scheduled:** Every executable unit MUST be dispatched exclusively through the Execution Scheduler. No component may execute work directly outside the scheduling pipeline.

## 3. The ExecutionUnit Abstraction
The Scheduler is entirely decoupled from the concept of a `Workflow`, `Stage`, `Job`, or `Task`. It operates strictly on `ExecutionUnit`s. This abstraction allows the Scheduler to be reused for future workloads (e.g., ad-hoc background tasks, multi-agent interactions) without modification.

## 4. Event-Driven State Machine
The Scheduler completely avoids `setInterval` or polling loops. It is an event-driven state machine responding to events like `UnitSubmitted`, `UnitCompleted`, `UnitFailed`, and `ResourceReleased`. 
States include: `READY`, `WAITING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`.

## 5. Strategic Dispatch & Resource Allocation
- **DispatchStrategy**: The mechanism (e.g., Priority-based, FIFO, Fair) that dictates the order in which `READY` units are selected.
- **ResourceManager**: Tracks available slots in a hierarchical model: `Capability` ➡️ `Provider` ➡️ `Worker` ➡️ `Slot`.

## 6. Safe Cancellation
Cancellation triggers a strict flow: `Cancel Request` ➡️ `Checkpoint` ➡️ `Cancel Runtime` ➡️ `Release Resource` ➡️ `Emit Event`. This preserves the reliability layer, allowing workflows to resume correctly even after being halted mid-execution.
