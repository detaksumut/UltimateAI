import { IProvider } from './IProvider';

export interface IProviderFactory {
  create(type: string, config: Record<string, any>): IProvider;
}
