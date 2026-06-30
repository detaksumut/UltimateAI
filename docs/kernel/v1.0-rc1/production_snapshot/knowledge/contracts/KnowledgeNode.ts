import { KnowledgeIdentity } from "./KnowledgeIdentity";
import { KnowledgeMetadata } from "./KnowledgeMetadata";

/**
 * An immutable node in the Knowledge Graph.
 * It serves strictly as a pointer to an Artifact in the Artifact Repository,
 * NEVER storing the actual payload to prevent data duplication.
 */
export interface KnowledgeNode {
  readonly identity: KnowledgeIdentity;
  
  /** Pointer to the actual artifact in the Artifact Repository */
  readonly artifactId: string;
  
  /** The deterministic hash of the artifact's payload for rapid deduplication */
  readonly contentHash: string;
  
  /** Flexible metadata to assist Memory Intelligence in querying */
  readonly metadata: KnowledgeMetadata;
}
