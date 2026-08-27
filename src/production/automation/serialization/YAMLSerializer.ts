/**
 * YAMLSerializer.ts
 *
 * Converts the canonical IWorkflowModel and IAutomationManifest into YAML format
 * for storage and external exchange. Does NOT interpret or compile.
 */

import { IWorkflowModel } from '../../contracts/IWorkflowModel';
import { IAutomationManifest } from '../../contracts/IAutomationManifest';

export class YAMLSerializer {
  
  public static serializeWorkflow(model: IWorkflowModel): string {
    // A primitive YAML serialization for Milestone 1.
    // In production, use `js-yaml` `dump()`
    let yaml = `workflow:\n  id: ${model.id}\n  version: ${model.version}\n\n`;
    yaml += `trigger:\n  event: ${model.trigger.event}\n\n`;
    
    yaml += `states:\n`;
    for (const s of model.states) {
      yaml += `  - ${s}\n`;
    }
    yaml += `\n`;
    
    yaml += `transitions:\n`;
    for (const t of model.transitions) {
      yaml += `  - from: ${t.from}\n    action: ${t.action}\n    to: ${t.to}\n`;
    }
    
    return yaml;
  }
  
  public static serializeManifest(manifest: IAutomationManifest): string {
    let yaml = `business:\n`;
    yaml += `  workflow_id: ${manifest.business.workflow_id}\n`;
    yaml += `  spec_version: ${manifest.business.spec_version}\n`;
    yaml += `  domain: ${manifest.business.domain}\n`;
    yaml += `  owner: ${manifest.business.owner}\n`;
    yaml += `  visibility: ${manifest.business.visibility}\n\n`;
    
    yaml += `operational:\n`;
    yaml += `  runtime: ${manifest.operational.runtime}\n`;
    
    return yaml;
  }
}
