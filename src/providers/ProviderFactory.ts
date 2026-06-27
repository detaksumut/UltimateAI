import { IProviderFactory } from './IProviderFactory';
import { IProvider } from './IProvider';
import { OpenAIProvider } from './concrete/OpenAIProvider';
import { FilesystemProvider } from './concrete/FilesystemProvider';

export class ProviderFactory implements IProviderFactory {
  create(type: string, config: Record<string, any>): IProvider {
    switch (type.toLowerCase()) {
      case 'openai':
      case 'llm':
        return new OpenAIProvider(
          config.id || 'openai-default',
          config.name || 'OpenAI Provider',
          config
        );
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
