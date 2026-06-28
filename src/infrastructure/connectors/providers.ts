import { AIRequest, AIResponse, AIProviderType } from './models';

// Abstract base class for providers
export abstract class BaseProvider {
    abstract readonly type: AIProviderType;
    abstract execute(request: AIRequest): Promise<AIResponse>;
}

export class NineRouteProvider extends BaseProvider {
    readonly type: AIProviderType = '9ROUTE';
    
    async execute(request: AIRequest): Promise<AIResponse> {
        console.log(`[9Route] Executing request ${request.id}`);
        
        try {
            // Using standard OpenAI compatible endpoint format
            const response = await fetch(`${process.env.NINE_ROUTER_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.NINE_ROUTER_API_KEY}`,
                },
                body: JSON.stringify({
                    model: process.env.NINE_ROUTER_MODEL || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: request.systemPrompt || 'You are an AI assistant.' },
                        { role: 'user', content: request.prompt }
                    ],
                    temperature: 0.2, // Low temp for generation/coding
                    max_tokens: 3000
                }),
            });

            if (!response.ok) {
                throw new Error(`9Route API Error: ${response.status} ${response.statusText}`);
            }

            const json = await response.json();
            const content = json.choices?.[0]?.message?.content || '';

            return {
                requestId: request.id,
                provider: this.type,
                content: content,
                usage: { 
                    promptTokens: json.usage?.prompt_tokens || 0, 
                    completionTokens: json.usage?.completion_tokens || 0, 
                    totalTokens: json.usage?.total_tokens || 0 
                },
                latencyMs: 1000 // Mocked latency stat
            };
        } catch (error: any) {
            console.error(`[9Route Error] ${error.message}`);
            throw error;
        }
    }
}

export class DirectFallbackProvider extends BaseProvider {
    constructor(public readonly type: AIProviderType) {
        super();
    }
    
    async execute(request: AIRequest): Promise<AIResponse> {
        console.log(`[${this.type} DIRECT] Executing failover request ${request.id}`);
        
        let model = process.env.FALLBACK_MODEL_ANTHROPIC || 'anthropic/claude-3-haiku'; // Default OpenRouter fast model
        if (this.type === 'DEEPSEEK') model = process.env.FALLBACK_MODEL_DEEPSEEK || 'deepseek/deepseek-coder';
        if (this.type === 'GEMINI') model = process.env.FALLBACK_MODEL_GEMINI || 'google/gemini-1.5-flash';
        if (this.type === 'GROQ') model = process.env.FALLBACK_MODEL_GROQ || 'meta-llama/llama-3.1-8b-instruct';
        if (this.type === 'OPENAI') model = process.env.FALLBACK_MODEL_OPENAI || 'openai/gpt-4o-mini';
        
        try {
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) throw new Error("OPENROUTER_API_KEY not found in .env");

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: typeof request.systemPrompt === 'string' ? request.systemPrompt : JSON.stringify(request.systemPrompt || 'You are an AI assistant.') },
                        { role: 'user', content: typeof request.prompt === 'string' ? request.prompt : JSON.stringify(request.prompt || '') }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Fallback API Error: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const json = await response.json();
            const content = json.choices?.[0]?.message?.content || '';

            return {
                requestId: request.id,
                provider: this.type,
                content: content,
                usage: { 
                    promptTokens: json.usage?.prompt_tokens || 0, 
                    completionTokens: json.usage?.completion_tokens || 0, 
                    totalTokens: json.usage?.total_tokens || 0 
                },
                latencyMs: 1500
            };
        } catch (error: any) {
            console.error(`[${this.type} Fallback Error] ${error.message}`);
            throw error;
        }
    }
}
