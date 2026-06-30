import { IArtifact } from "../../artifact/contracts/IArtifact";
import { ContextRanking } from "./ContextRanking";

export interface RetrievedContext {
  /** The full artifact payload from the Artifact Repository */
  artifact: IArtifact;
  
  /** The score and reasoning for this artifact's selection */
  ranking: ContextRanking;
  
  /** The node IDs forming the traversal path (useful for debugging/observability) */
  knowledgePath: string[];
}
