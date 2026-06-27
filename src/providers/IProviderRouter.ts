import { IProvider } from './IProvider';

export interface IProviderRouter {
  route(capability: string): IProvider;
}
