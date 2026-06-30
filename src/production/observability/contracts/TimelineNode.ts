export interface TimelineNode {
  id: string;
  type: "Execution" | "Runtime" | "Artifact" | "Decision" | "Checkpoint";
  label: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TimelineEdge {
  from: string;
  to: string;
}

export interface ArtifactTimelineDAG {
  traceId: string;
  nodes: TimelineNode[];
  edges: TimelineEdge[];
}
