/**
 * MemoryRegistry – in‑memory catalog of memory providers.
 *
 * It maintains two indexes:
 *   1. `providerById` – fast lookup by provider descriptor id.
 *   2. `providersByNamespaceRole` – composite key `${namespace}:${role}` to support discovery.
 */

import { IMemoryRegistry } from "../interfaces/IMemoryRegistry";
import { IMemoryProvider } from "../interfaces/IMemoryProvider";
import { MemoryNamespace } from "../types/MemoryNamespace";
import { MemoryRole } from "../types/MemoryRole";

export class MemoryRegistry implements IMemoryRegistry {
  private readonly providerById: Map<string, IMemoryProvider> = new Map();
  private readonly providersByNamespaceRole: Map<string, IMemoryProvider[]> = new Map();

  public register(provider: IMemoryProvider): void {
    const id = provider.descriptor.id;
    if (this.providerById.has(id)) {
      throw new Error(`Provider with id ${id} is already registered`);
    }
    this.providerById.set(id, provider);
    const key = `${provider.descriptor.namespace}:${provider.descriptor.role}`;
    const list = this.providersByNamespaceRole.get(key) ?? [];
    list.push(provider);
    this.providersByNamespaceRole.set(key, list);
  }

  public unregister(providerId: string): void {
    const provider = this.providerById.get(providerId);
    if (!provider) return;
    this.providerById.delete(providerId);
    const key = `${provider.descriptor.namespace}:${provider.descriptor.role}`;
    const list = this.providersByNamespaceRole.get(key);
    if (list) {
      const filtered = list.filter(p => p.descriptor.id !== providerId);
      if (filtered.length) this.providersByNamespaceRole.set(key, filtered);
      else this.providersByNamespaceRole.delete(key);
    }
  }

  public resolve(providerId: string): IMemoryProvider | undefined {
    return this.providerById.get(providerId);
  }

  public list(): IMemoryProvider[] {
    return Array.from(this.providerById.values());
  }

  public findByNamespaceAndRole(namespace: MemoryNamespace, role: MemoryRole): readonly IMemoryProvider[] {
    const key = `${namespace}:${role}`;
    const providers = this.providersByNamespaceRole.get(key);
    return providers ? Object.freeze([...providers]) : Object.freeze([]);
  }
}
