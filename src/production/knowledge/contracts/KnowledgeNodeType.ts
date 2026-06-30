/**
 * Represents the conceptual domain object stored as a node in the graph.
 */
export enum KnowledgeNodeType {
  ARTIFACT_NODE = "ARTIFACT_NODE",     // Represents an execution artifact
  CAPABILITY_NODE = "CAPABILITY_NODE", // Represents a capability (e.g., PLANNING)
  CONTEXT_NODE = "CONTEXT_NODE"        // Represents a broader context (e.g., a workflow or trace)
}
