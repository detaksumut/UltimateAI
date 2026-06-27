import { test, expect } from '@playwright/test';
import { ProviderRegistry } from '../../src/providers/ProviderRegistry';
import { CapabilityRegistry } from '../../src/providers/CapabilityRegistry';
import { ProviderFactory } from '../../src/providers/ProviderFactory';
import { ProviderRouter } from '../../src/providers/ProviderRouter';
import { OpenAIProvider } from '../../src/providers/concrete/OpenAIProvider';
import { FilesystemProvider } from '../../src/providers/concrete/FilesystemProvider';
import { ProviderContext } from '../../src/providers/types/ProviderContext';

test.describe('Provider Framework Integration Tests', () => {
  let providerRegistry: ProviderRegistry;
  let capabilityRegistry: CapabilityRegistry;
  let factory: ProviderFactory;
  let router: ProviderRouter;

  test.beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    capabilityRegistry = new CapabilityRegistry();
    factory = new ProviderFactory();
    router = new ProviderRouter(capabilityRegistry, providerRegistry);
  });

  test('Dynamic Provider Registration & Discovery', () => {
    // 1. Instantiate OpenAI provider via factory
    const openAI = factory.create('llm', { id: 'openai-1', name: 'OpenAI GPT-4', model: 'gpt-4' });
    const descriptor = {
      id: openAI.id,
      name: openAI.name,
      type: openAI.type,
      version: '1.0.0',
      capabilities: {
        supportedOperations: ['chat', 'embedding'],
        maxTokens: 8192
      },
      isHealthy: true
    };

    // 2. Register
    providerRegistry.register(openAI, descriptor);
    capabilityRegistry.registerCapabilities(openAI.id, descriptor.capabilities);

    // 3. Discovery Assertions
    const registered = providerRegistry.get('openai-1');
    expect(registered).toBeDefined();
    expect(registered?.name).toBe('OpenAI GPT-4');

    const desc = providerRegistry.getDescriptor('openai-1');
    expect(desc?.isHealthy).toBe(true);

    const activeCapabilities = capabilityRegistry.listCapabilities();
    expect(activeCapabilities).toContain('chat');
    expect(activeCapabilities).toContain('embedding');

    const providers = capabilityRegistry.findProvidersForCapability('chat');
    expect(providers).toContain('openai-1');
  });

  test('Capability First Selection & Execution (OpenAI)', async () => {
    // Register OpenAI
    const openAI = factory.create('llm', { id: 'openai-1', name: 'OpenAI GPT-4' });
    const descriptor = {
      id: openAI.id,
      name: openAI.name,
      type: openAI.type,
      version: '1.0.0',
      capabilities: { supportedOperations: ['chat'] },
      isHealthy: true
    };
    providerRegistry.register(openAI, descriptor);
    capabilityRegistry.registerCapabilities(openAI.id, descriptor.capabilities);

    // Select provider dynamically using router for capability 'chat'
    const provider = router.route('chat');
    expect(provider.id).toBe('openai-1');

    // Execute with normalized inputs/outputs
    const response = await provider.execute({
      operation: 'chat',
      params: { prompt: 'Hello world' }
    });

    expect(response.success).toBe(true);
    expect(response.data).toContain('OpenAI simulated response for prompt: "Hello world"');
    expect(response.metadata?.model).toBe('gpt-4');
  });

  test('Capability First Selection & Execution (Filesystem)', async () => {
    // Register Filesystem
    const fsProvider = factory.create('fs', { id: 'fs-1', name: 'Local FileSystem' });
    const descriptor = {
      id: fsProvider.id,
      name: fsProvider.name,
      type: fsProvider.type,
      version: '1.0.0',
      capabilities: { supportedOperations: ['read', 'write'] },
      isHealthy: true
    };
    providerRegistry.register(fsProvider, descriptor);
    capabilityRegistry.registerCapabilities(fsProvider.id, descriptor.capabilities);

    // Route
    const reader = router.route('read');
    expect(reader.id).toBe('fs-1');

    const readRes = await reader.execute({
      operation: 'read',
      params: { path: '/home/user/test.txt' }
    });
    expect(readRes.success).toBe(true);
    expect(readRes.data).toContain('File contents of /home/user/test.txt (simulated)');

    const writer = router.route('write');
    const writeRes = await writer.execute({
      operation: 'write',
      params: { path: '/home/user/test.txt', content: 'test data' }
    });
    expect(writeRes.success).toBe(true);
    expect(writeRes.data.written).toBe(true);
  });

  test('Router selection falls back or throws appropriately based on health', () => {
    // 1. Register two providers for chat: one unhealthy, one healthy
    const openAI = factory.create('llm', { id: 'openai-unhealthy', name: 'Flakey OpenAI' });
    const descriptorUnhealthy = {
      id: openAI.id,
      name: openAI.name,
      type: openAI.type,
      version: '1.0.0',
      capabilities: { supportedOperations: ['chat'] },
      isHealthy: false // Unhealthy
    };
    providerRegistry.register(openAI, descriptorUnhealthy);
    capabilityRegistry.registerCapabilities(openAI.id, descriptorUnhealthy.capabilities);

    const gemini = factory.create('llm', { id: 'gemini-healthy', name: 'Healthy Gemini' });
    const descriptorHealthy = {
      id: gemini.id,
      name: gemini.name,
      type: gemini.type,
      version: '1.0.0',
      capabilities: { supportedOperations: ['chat'] },
      isHealthy: true // Healthy
    };
    providerRegistry.register(gemini, descriptorHealthy);
    capabilityRegistry.registerCapabilities(gemini.id, descriptorHealthy.capabilities);

    // Route should bypass unhealthy 'openai-unhealthy' and select healthy 'gemini-healthy'
    const provider = router.route('chat');
    expect(provider.id).toBe('gemini-healthy');
  });

  test('Provider execution respects Context cancellation', async () => {
    const openAI = factory.create('llm', { id: 'openai-1', name: 'OpenAI GPT-4' });
    const controller = new AbortController();
    controller.abort(); // Cancel immediately

    const providerContext: ProviderContext = {
      cancellationSignal: controller.signal
    };

    const response = await openAI.execute({
      operation: 'chat',
      params: { prompt: 'Test cancellation' }
    }, providerContext);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('CANCELLED');
  });
});
