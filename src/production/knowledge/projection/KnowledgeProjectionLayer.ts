// src/production/knowledge/projection/KnowledgeProjectionLayer.ts

import { TraceableArtifact } from "../../intelligence/contracts/TraceableArtifact";
import { ProjectorResolver } from "./ProjectorResolver";
import { ProjectionContext } from "./ProjectionContext";
import { KnowledgeProjectionResult } from "./KnowledgeProjectionResult";
import { KnowledgeProjection } from "./KnowledgeProjection";

/**
 * Orchestrator of the Knowledge Projection process.
 * Receives an artifact, resolves its projector, projects it statelessly, 
 * validates the projection, and returns the result.
 */
export class KnowledgeProjectionLayer {
  constructor(private readonly resolver: ProjectorResolver) {}

  public projectArtifact(artifact: TraceableArtifact, context: ProjectionContext): KnowledgeProjectionResult {
    const startTime = Date.now();
    
    // 1. Resolve stateless projector
    const projector = this.resolver.resolve(artifact);
    
    // 2. Project
    const projection = projector.project(artifact, context);
    
    // 3. Light Validation
    const warnings = this.validateProjection(projection);
    
    // 4. Return result
    return {
      projection,
      descriptor: {
        projectionType: projector.metadata.supportedProjection,
        artifactType: artifact.constructor.name,
        projectorVersion: projector.metadata.version
      },
      metrics: {
        durationMs: Date.now() - startTime
      },
      warnings
    };
  }

  /**
   * Checks for orphan nodes, duplicate edges, and self-loops.
   * Does not fail the process, only returns warnings.
   */
  private validateProjection(projection: KnowledgeProjection): string[] {
    const warnings: string[] = [];
    const nodeIds = new Set(projection.nodes.map(n => n.identity.nodeId));
    
    // Check nodes
    if (nodeIds.size !== projection.nodes.length) {
      warnings.push("Duplicate nodeId detected in projection.");
    }

    // Check edges
    const edgeSignatures = new Set<string>();

    for (const edge of projection.edges) {
      // 1. Orphan target
      if (!nodeIds.has(edge.targetNodeId)) {
        warnings.push(`Edge ${edge.id} points to unknown targetNodeId ${edge.targetNodeId}`);
      }
      // 2. Orphan source
      if (!nodeIds.has(edge.sourceNodeId)) {
        warnings.push(`Edge ${edge.id} originates from unknown sourceNodeId ${edge.sourceNodeId}`);
      }
      // 3. Self-loop
      if (edge.sourceNodeId === edge.targetNodeId) {
        warnings.push(`Self-loop detected on nodeId ${edge.sourceNodeId} (relation: ${edge.relation})`);
      }
      // 4. Duplicate Edge
      const sig = `${edge.sourceNodeId}->${edge.targetNodeId}:${edge.relation}`;
      if (edgeSignatures.has(sig)) {
        warnings.push(`Duplicate edge detected: ${sig}`);
      }
      edgeSignatures.add(sig);
    }

    return warnings;
  }
}
