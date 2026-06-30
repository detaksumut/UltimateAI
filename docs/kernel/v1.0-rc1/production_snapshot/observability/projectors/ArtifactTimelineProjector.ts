import { IRuntimeEventBus } from "../../runtime/events/RuntimeEventBus";
import { IRuntimeTelemetryEvent } from "../events/IRuntimeTelemetryEvent";
import { ArtifactTimelineDAG, TimelineNode, TimelineEdge } from "../contracts/TimelineNode";

export class ArtifactTimelineProjector {
  private dags = new Map<string, ArtifactTimelineDAG>();

  constructor(eventBus: IRuntimeEventBus) {
    eventBus.subscribe("RuntimeExecutionStarted", (e) => this.handleEvent(e as any));
    eventBus.subscribe("RuntimeExecutionCompleted", (e) => this.handleEvent(e as any));
    eventBus.subscribe("RuntimeExecutionFailed", (e) => this.handleEvent(e as any));
  }

  private handleEvent(event: IRuntimeTelemetryEvent) {
    const { traceId, eventId, causationId, runtimeId, phase, timestamp } = event;
    
    if (!this.dags.has(traceId)) {
      this.dags.set(traceId, {
        traceId,
        nodes: [],
        edges: []
      });
    }

    const dag = this.dags.get(traceId)!;

    const node: TimelineNode = {
      id: eventId,
      type: "Runtime",
      label: `${runtimeId} (${phase})`,
      timestamp,
      metadata: { phase, sequenceNumber: event.sequenceNumber }
    };
    dag.nodes.push(node);

    if (causationId) {
      dag.edges.push({
        from: causationId,
        to: eventId
      });
    }
  }

  getDAG(traceId: string): ArtifactTimelineDAG | undefined {
    return this.dags.get(traceId);
  }
}
