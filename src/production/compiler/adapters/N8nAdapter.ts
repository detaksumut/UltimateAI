/**
 * N8nAdapter.ts
 *
 * Translates the artifact into an n8n JSON representation.
 * Strict translation only (no validation or optimizations).
 */

import { ICompilationAdapter } from './ICompilationAdapter';
import { ICompilationArtifact } from '../contracts/ICompilationArtifact';
import { IWorkflowModel } from '../../automation/contracts/IWorkflowModel';

export class N8nAdapter implements ICompilationAdapter {
  public readonly target = 'n8n';
  
  public adapt(artifact: ICompilationArtifact): any {
    const model: IWorkflowModel = artifact.payload;
    
    // Dumb mapping to n8n format
    const n8nNodes = model.states.map((state, index) => ({
      name: state,
      type: 'n8n-nodes-base.set',
      position: [250 * index, 300]
    }));
    
    const n8nConnections: any = {};
    for (const t of model.transitions) {
      if (!n8nConnections[t.from]) n8nConnections[t.from] = { main: [[]] };
      n8nConnections[t.from].main[0].push({
        node: t.to,
        type: "main",
        index: 0
      });
    }

    return {
      name: `n8n_export_${artifact.workflow_id}`,
      nodes: n8nNodes,
      connections: n8nConnections,
      active: false
    };
  }
}
