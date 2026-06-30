export interface MemoryPolicy {
  /** Maximum number of artifacts to return */
  maxContextArtifacts: number;
  
  /** Maximum graph traversal depth (e.g., for LINEAGE) */
  maxDepth: number;
  
  /** Minimum score required to be included in the results (0.0 to 1.0) */
  minimumScore: number;
  
  /** Whether to allow fetching context across different workflow instances */
  allowCrossWorkflow: boolean;
}
