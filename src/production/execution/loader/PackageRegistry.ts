/**
 * PackageRegistry.ts
 *
 * Persists and retrieves Execution Packages using IRegistryStore.
 */

import { IExecutionPackage } from '../contracts/IExecutionPackage';
import { IPackageDescriptor, IRegistryStore } from './IPackageDescriptor';

export class PackageRegistry {
  constructor(private store: IRegistryStore) {}
  
  public register(pkg: IExecutionPackage): void {
    const descriptor: IPackageDescriptor = {
      package_id: pkg.metadata.workflow_id, // simplified for now
      version: pkg.package_version,
      checksum: pkg.metadata.artifact_checksum,
      created_at: new Date().toISOString(),
      compatibility: pkg.format
    };
    
    this.store.saveDescriptor(descriptor);
    this.store.storePayload(descriptor.package_id, pkg);
  }
  
  public get(packageId: string): IExecutionPackage | undefined {
    const descriptor = this.store.getDescriptor(packageId);
    if (!descriptor) return undefined;
    return this.store.fetchPayload(packageId) as IExecutionPackage;
  }
}

// In-Memory store implementation for Beta 4
export class MemoryRegistryStore implements IRegistryStore {
  private descriptors = new Map<string, IPackageDescriptor>();
  private payloads = new Map<string, any>();
  
  public saveDescriptor(descriptor: IPackageDescriptor): void {
    this.descriptors.set(descriptor.package_id, descriptor);
  }
  public getDescriptor(packageId: string): IPackageDescriptor | undefined {
    return this.descriptors.get(packageId);
  }
  public storePayload(packageId: string, payload: any): void {
    this.payloads.set(packageId, payload);
  }
  public fetchPayload(packageId: string): any {
    return this.payloads.get(packageId);
  }
}
