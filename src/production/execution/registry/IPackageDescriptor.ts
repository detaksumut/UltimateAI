/**
 * IPackageDescriptor.ts
 *
 * Defines metadata about an Execution Package for the Registry.
 */

export interface IPackageDescriptor {
  readonly package_id: string;
  readonly version: string;
  readonly checksum: string;
  readonly created_at: string;
  readonly compatibility: string;
}

export interface IRegistryStore {
  saveDescriptor(descriptor: IPackageDescriptor): void;
  getDescriptor(packageId: string): IPackageDescriptor | undefined;
  
  // The actual payload retrieval
  fetchPayload(packageId: string): any; 
  storePayload(packageId: string, payload: any): void;
}
