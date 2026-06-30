/**
 * Defines the nature of the relationship between two Knowledge Nodes.
 * Split into Deterministic (Structural) and Inferred (Semantic) relations.
 */
export enum KnowledgeRelationType {
  // Structural Relations (System-Generated, Confidence = 1.0)
  DERIVED_FROM = "DERIVED_FROM", // Parent-Child artifact lineage
  GENERATED_BY = "GENERATED_BY", // Artifact to Capability/Provider
  BELONGS_TO = "BELONGS_TO",     // Artifact to Trace/Workflow/Job

  // Semantic Relations (Analytically Inferred, Confidence < 1.0)
  REFERENCES = "REFERENCES",
  SIMILAR_TO = "SIMILAR_TO",
  CONTRADICTS = "CONTRADICTS",
  SUPPORTS = "SUPPORTS"
}
