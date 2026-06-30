# UltimateAI Observability Architecture (v1.1)

## 1. Overview
The Observability bounded context transforms the theoretical traceability of v1.0 into an actionable, passive, event-driven monitoring system. It guarantees that the Core Cognitive Loop is fully observable without ever mutating its execution flow.

## 2. Event Model

### Runtime Domain vs Telemetry
The `RuntimeEventBus` exposes two distinct namespaces:
- **`RuntimeDomainEvent`**: Used by runtimes to trigger domain-specific side effects.
- **`RuntimeTelemetryEvent`**: Exclusively used to emit passive lifecycle observations.

### Telemetry Event Identity
Every telemetry event carries a comprehensive identity schema:
- `eventId`: Unique identifier of the observation.
- `traceId`: The global identifier of the execution trace.
- `parentTraceId` (Optional): The trace that spawned this trace (if distributed).
- `causationId` (Optional): The specific `eventId` that triggered this execution (enabling deep dependency graphing).
- `sequenceNumber`: A strictly monotonic integer scoped to the `traceId`, starting from `1`. This provides deterministic ordering independent of clock drift.
- `timestamp`: Wall-clock time (purely metadata).
- `runtimeId`: The identity of the executing runtime.
- `phase`: `QUEUED` | `STARTING` | `RUNNING` | `COMPLETED` | `FAILED` | `CANCELLED`.
- `payload`: Artifact metadata or error strings.

## 3. Projectors (Event Sourcing)
Observability relies on **Projectors** that listen to the `EventBus` and reconstruct stateful projections:

### RuntimeHealthProjector
Maintains the real-time health of a runtime:
- `averageDurationMs`
- `successRate`
- `failureCount`
- `lastExecutionStatus`

### RuntimeMetricsProjector
Aggregates quantitative execution data:
- `executionCount`
- `maxDurationMs`
- `artifactsProduced`
- `timeouts`

### ArtifactTimelineProjector
Constructs a Directed Acyclic Graph (DAG).
Nodes (`TimelineNode`) can be of type:
- `Execution`
- `Runtime`
- `Artifact`
- `Decision`
- `Checkpoint`

## 4. Static Report Generator
Instead of requiring an active web server, Observability produces static artifacts at the conclusion of a trace. The `ObservabilityReportBuilder` generates:
- `reports/observability/execution-<traceId>.json` (Source of Truth)
- `reports/observability/execution-<traceId>.md` (Human-readable summary)
- `reports/observability/execution-<traceId>.html` (Static visualizer)
- `reports/observability/timeline-<traceId>.svg` (Visual DAG)

## 5. Principle 47 - Every Runtime Is Observable
*Every runtime execution MUST emit immutable telemetry events that enable deterministic reconstruction of execution history, artifact lineage, runtime health, and production metrics without affecting runtime behavior.*
