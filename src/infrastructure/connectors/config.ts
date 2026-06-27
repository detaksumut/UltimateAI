import { AIProviderType, TaskCapability, RouterConfig } from './models';

// Capability Mapping to determine which fallback to use if 9Route fails
export const CapabilityRouterMap: Record<TaskCapability, ReadonlyArray<AIProviderType>> = {
    REASONING: ['OPENAI', 'GROQ', 'ANTHROPIC', 'GEMINI'],
    FAST_INFERENCE: ['GROQ', 'MISTRAL', 'OPENAI'],
    CODING: ['DEEPSEEK', 'OPENAI', 'ANTHROPIC', 'GEMINI'],
    EMBEDDING: ['COHERE', 'OPENAI'],
    WEB_SEARCH: ['TAVILY']
};

export const DefaultRouterConfig: RouterConfig = {
    primaryProvider: '9ROUTE',
    fallbackProviders: [], // will be populated dynamically based on task
    timeoutMs: 15000,      // 15 seconds before giving up on primary
    maxRetries: 2
};
