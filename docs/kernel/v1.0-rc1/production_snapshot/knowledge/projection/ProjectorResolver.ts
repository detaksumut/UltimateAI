// src/production/knowledge/projection/ProjectorResolver.ts

import { IKnowledgeProjector } from "./IKnowledgeProjector";
import { TraceableArtifact } from "../../intelligence/contracts/TraceableArtifact";
import { KnowledgeProjectionType } from "./KnowledgeProjectionType";

/**
 * Registry resolving projection types to their concrete stateless projectors.
 * Employs the Open/Closed Principle.
 */
export class ProjectorResolver {
  private readonly registry = new Map<KnowledgeProjectionType, IKnowledgeProjector<any>>();

  /**
   * Registers a projector for a specific projection type.
   */
  public register(projectionType: KnowledgeProjectionType, projector: IKnowledgeProjector<any>): void {
    if (this.registry.has(projectionType)) {
      throw new Error(`A projector is already registered for type: ${projectionType}`);
    }
    this.registry.set(projectionType, projector);
  }

  /**
   * Resolves the appropriate projector based on the artifact's projectionType.
   */
  public resolve<TArtifact extends TraceableArtifact>(artifact: TArtifact): IKnowledgeProjector<TArtifact> {
    if (!artifact.projectionType) {
      throw new Error(`Artifact ${artifact.id} is missing a projectionType.`);
    }

    const projector = this.registry.get(artifact.projectionType);
    if (!projector) {
      throw new Error(`No projector registered for projectionType: ${artifact.projectionType}`);
    }
    
    return projector;
  }
}
