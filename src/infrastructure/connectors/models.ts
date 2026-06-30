export type AIProviderType = '9ROUTE' | 'ANTHROPIC' | 'OPENAI' | 'GROQ' | 'MISTRAL' | 'DEEPSEEK' | 'COHERE' | 'TAVILY' | 'GEMINI';

export type TaskCapability = 'REASONING' | 'FAST_INFERENCE' | 'CODING' | 'EMBEDDING' | 'WEB_SEARCH';

export interface AIRequest {
    readonly id: string;
    readonly prompt: string;
    readonly systemPrompt?: string;
    readonly requiredCapability: TaskCapability;
    readonly maxTokens?: number;
    readonly temperature?: number;
    readonly image?: string; // base64 string
}

export interface AIResponse {
    readonly requestId: string;
    readonly provider: AIProviderType;
    readonly content: string;
    readonly usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    readonly latencyMs: number;
}

export interface RouterConfig {
    readonly primaryProvider: AIProviderType;
    readonly fallbackProviders: ReadonlyArray<AIProviderType>;
    readonly timeoutMs: number;
    readonly maxRetries: number;
}
