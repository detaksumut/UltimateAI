/**
 * ArtifactBuilderPass.ts
 *
 * Final pass that wraps the thoroughly cleaned and optimized model into an ICompilationArtifact.
 */

import { ICompilerPass } from './ICompilerPass';
import { ICompilationContext } from '../contracts/ICompilationContext';
import * as crypto from 'crypto';

export class ArtifactBuilderPass implements ICompilerPass {
  public readonly name = 'ArtifactBuilderPass';
  
  public execute(context: ICompilationContext): void {
    if (context.diagnostics.status === 'FAIL') return;
    
    const payloadStr = JSON.stringify(context.workflow_model);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');
    
    const target = context.manifest.operational.runtime;
    const type = (target === 'native' || target === 'n8n' || target === 'temporal' || target === 'camunda') ? target : 'native';
    
    context.artifact = {
      workflow_id: context.manifest.business.workflow_id,
      artifact_type: type as any,
      target: target,
      metadata: {
        compiler_version: '1.0.0',
        generated_at: new Date().toISOString(),
        checksum: checksum
      },
      payload: context.workflow_model // Canonical JSON representation
    };
    
    context.diagnostics.messages.push(`ArtifactBuilderPass completed. Artifact checksum: ${checksum}`);
  }
}
