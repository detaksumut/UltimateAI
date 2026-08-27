/**
 * PackageLoader.ts
 *
 * Reads from Registry and strictly verifies compatibility and checksums.
 * Rejects corrupt or incompatible packages.
 */

import { IExecutionPackage } from '../contracts/IExecutionPackage';
import { PackageRegistry } from './PackageRegistry';
import * as crypto from 'crypto';

export class PackageLoader {
  constructor(private registry: PackageRegistry) {}
  
  public load(workflowId: string): IExecutionPackage {
    const pkg = this.registry.get(workflowId);
    if (!pkg) {
      throw new Error(`PackageLoader Error: Package for workflow '${workflowId}' not found in registry.`);
    }
    
    // Compatibility Verification
    if (pkg.format !== 'UltimateAINative') {
      throw new Error(`PackageLoader Error: Incompatible format '${pkg.format}'. Expected 'UltimateAINative'.`);
    }
    if (pkg.schema_version !== '1.0' && pkg.package_version !== '1.0') {
      throw new Error(`PackageLoader Error: Incompatible version. Expected 1.0.`);
    }
    
    // Checksum Verification
    // Assuming the checksum was generated against the stringified plan.
    const planStr = JSON.stringify(pkg.plan);
    const computedChecksum = crypto.createHash('sha256').update(planStr).digest('hex');
    
    if (computedChecksum !== pkg.metadata.artifact_checksum) {
      throw new Error(`PackageLoader Error: Checksum mismatch! The execution plan is corrupt or tampered with.`);
    }
    
    return pkg;
  }
}
