import { IProvider } from './IProvider';
import { IProviderDescriptor } from './IProviderDescriptor';

export interface IProviderRegistry {
  register(provider: IProvider, descriptor: IProviderDescriptor): void;
  unregister(id: string): void;
  get(id: string): IProvider | undefined;
  getDescriptor(id: string): IProviderDescriptor | undefined;
  list(): IProviderDescriptor[];
}
