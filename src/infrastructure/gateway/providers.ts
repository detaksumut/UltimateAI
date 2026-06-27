import { AIRequest, AIResponse, AIProviderType } from './models';

// Abstract base class for providers
export abstract class BaseProvider {
    abstract readonly type: AIProviderType;
    abstract execute(request: AIRequest): Promise<AIResponse>;
}

export class NineRouteProvider extends BaseProvider {
    readonly type: AIProviderType = '9ROUTE';
    
    async execute(request: AIRequest): Promise<AIResponse> {
        // Mock implementation of 9Route HTTP call
        console.log(`[9Route] Executing request ${request.id}`);
        
        // Simulating a network call that MIGHT fail or timeout
        return new Promise((resolve, reject) => {
            const isError = Math.random() < 0.2; // 20% chance of random failure for testing
            if (isError) {
                setTimeout(() => reject(new Error('9Route Timeout or 500 Error')), 1000);
            } else {
                setTimeout(() => resolve({
                    requestId: request.id,
                    provider: this.type,
                    content: '[Response from 9Route Ecosystem]',
                    usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
                    latencyMs: 1200
                }), 1200);
            }
        });
    }
}

export class DirectFallbackProvider extends BaseProvider {
    constructor(public readonly type: AIProviderType) {
        super();
    }
    
    async execute(request: AIRequest): Promise<AIResponse> {
        console.log(`[${this.type} DIRECT] Executing failover request ${request.id}`);
        
        // Mock implementation of direct API call (Groq, Claude, Mistral, etc)
        return new Promise((resolve) => {
            setTimeout(() => resolve({
                requestId: request.id,
                provider: this.type,
                content: `[Direct Response from ${this.type} API]`,
                usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
                latencyMs: 800
            }), 800);
        });
    }
}
