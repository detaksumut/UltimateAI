import { IProviderRegistry } from './IProviderRegistry';
import { IProvider } from './IProvider';
import { IProviderDescriptor } from './IProviderDescriptor';

export class ProviderRegistry implements IProviderRegistry {
  private readonly providers = new Map<string, IProvider>();
  private readonly descriptors = new Map<string, IProviderDescriptor>();

  register(provider: IProvider, descriptor: IProviderDescriptor): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider with ID ${provider.id} already registered`);
    }
    this.providers.set(provider.id, provider);
    this.descriptors.set(provider.id, descriptor);
  }

  unregister(id: string): void {
    this.providers.delete(id);
    this.descriptors.delete(id);
  }

  get(id: string): IProvider | undefined {
    return this.providers.get(id);
  }

  getDescriptor(id: string): IProviderDescriptor | undefined {
    return this.descriptors.get(id);
  }

  list(): IProviderDescriptor[] {
    return Array.from(this.descriptors.values());
  }
}
