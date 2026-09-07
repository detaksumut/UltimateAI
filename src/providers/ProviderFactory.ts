import { IProviderFactory } from './IProviderFactory';
import { IProvider } from './IProvider';
import { FilesystemProvider } from './concrete/FilesystemProvider';

export class ProviderFactory implements IProviderFactory {
  create(type: string, config: Record<string, any>): IProvider {
    switch (type.toLowerCase()) {
      case 'filesystem':
      case 'fs':
        return new FilesystemProvider(
          config.id || 'fs-default',
          config.name || 'Filesystem Provider',
          config
        );
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}
