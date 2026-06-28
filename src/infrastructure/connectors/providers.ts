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
        
        // --- NATIVE GEMINI ROUTE ---
        if (this.type === 'GEMINI' && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
            console.log(`[GEMINI NATIVE] Routing directly to Google API bypassing OpenRouter...`);
            const geminiKey = process.env.GEMINI_API_KEY;
            const modelName = 'gemini-1.5-flash';
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: (request.systemPrompt || '') + "\n\n---\n\n" + request.prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
                })
            });
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Native Gemini API Error: ${response.status} ${response.statusText} - ${errorBody}`);
            }
            const json = await response.json();
            const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return {
                requestId: request.id,
                provider: this.type,
                content: content,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                latencyMs: 1000
            };
        }

        // --- NATIVE OPENAI COMPATIBLE ROUTES (GROQ, DEEPSEEK) ---
        let nativeUrl = '';
        let nativeKey = '';
        let nativeModel = '';
        
        if (this.type === 'GROQ' && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 10) {
            nativeUrl = 'https://api.groq.com/openai/v1/chat/completions';
            nativeKey = process.env.GROQ_API_KEY;
            nativeModel = 'llama-3.1-8b-instant';
        } else if (this.type === 'DEEPSEEK' && process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length > 10) {
            nativeUrl = 'https://api.deepseek.com/chat/completions';
            nativeKey = process.env.DEEPSEEK_API_KEY;
            nativeModel = 'deepseek-coder';
        }
        
        if (nativeUrl && nativeKey) {
            console.log(`[${this.type} NATIVE] Routing directly to Native API...`);
            const response = await fetch(nativeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${nativeKey}`
                },
                body: JSON.stringify({
                    model: nativeModel,
                    messages: [
                        { role: 'system', content: typeof request.systemPrompt === 'string' ? request.systemPrompt : JSON.stringify(request.systemPrompt || '') },
                        { role: 'user', content: typeof request.prompt === 'string' ? request.prompt : JSON.stringify(request.prompt || '') }
                    ],
                    temperature: 0.3
                })
            });
            if (response.ok) {
                const json = await response.json();
                const content = json.choices?.[0]?.message?.content || '';
                return {
                    requestId: request.id,
                    provider: `${this.type}_NATIVE`,
                    content: content,
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    latencyMs: 1000
                };
            }
            console.warn(`[${this.type} NATIVE] Native API failed (${response.status}). Falling back to OpenRouter...`);
        }

        // --- NATIVE ANTHROPIC ROUTE ---
        if (this.type === 'ANTHROPIC' && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10) {
            console.log(`[ANTHROPIC NATIVE] Routing directly to Anthropic API...`);
            const anthropicKey = process.env.ANTHROPIC_API_KEY;
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    system: typeof request.systemPrompt === 'string' ? request.systemPrompt : JSON.stringify(request.systemPrompt || ''),
                    messages: [
                        { role: 'user', content: typeof request.prompt === 'string' ? request.prompt : JSON.stringify(request.prompt || '') }
                    ],
                    max_tokens: 4000,
                    temperature: 0.3
                })
            });
            if (response.ok) {
                const json = await response.json();
                const content = json.content?.[0]?.text || '';
                return {
                    requestId: request.id,
                    provider: 'ANTHROPIC_NATIVE',
                    content: content,
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    latencyMs: 1000
                };
            }
            console.warn(`[ANTHROPIC NATIVE] Native API failed (${response.status}). Falling back to OpenRouter...`);
        }

        // --- OPENROUTER FALLBACK ROUTE ---
        let model = 'anthropic/claude-3-haiku'; // Default OpenRouter fast model
        if (this.type === 'DEEPSEEK') model = 'deepseek/deepseek-coder';
        if (this.type === 'GEMINI') model = 'openai/gpt-4o-mini'; // Fallback to OpenAI because Google strings are unstable
        if (this.type === 'GROQ') model = 'meta-llama/llama-3.1-8b-instruct';
        if (this.type === 'OPENAI') model = 'openai/gpt-4o-mini';
        
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
                    max_tokens: 500
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
