import { AIProviderType, TaskCapability, RouterConfig } from './models';

// Capability Mapping to determine providers to use for capabilities
export const CapabilityRouterMap: Record<TaskCapability, ReadonlyArray<AIProviderType>> = {
    REASONING:      ['ANTHROPIC', 'GROQ', 'DEEPSEEK', 'GEMINI'],
    FAST_INFERENCE: ['GROQ', 'DEEPSEEK', 'ANTHROPIC', 'GEMINI'],
    CODING:         ['DEEPSEEK', 'ANTHROPIC', 'GROQ', 'GEMINI'],
    EMBEDDING:      ['COHERE'],
    WEB_SEARCH:     ['TAVILY']
};

export const DefaultRouterConfig: RouterConfig = {
    primaryProvider: 'GEMINI',
    fallbackProviders: [], // will be populated dynamically based on task
    timeoutMs: 120000,     // 120 seconds for task execution
    maxRetries: 2
};
