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
        
        try {
            // --- NATIVE GEMINI ROUTE ---
            if (this.type === 'GEMINI') {
                const geminiKeys = Object.keys(process.env)
                    .filter(k => k.startsWith('GEMINI_API_KEY'))
                    .map(k => process.env[k])
                    .filter(k => k && k.length > 10) as string[];

                if (geminiKeys.length === 0) throw new Error("No valid GEMINI_API_KEY found in .env");
                
                const fallbackModels = ['gemini-flash-latest', 'gemini-pro', 'gemini-2.5-flash'];
                let lastError = null;
                
                console.log(`[GEMINI NATIVE] Initiating robust internal failover (Keys: ${geminiKeys.length}, Models: ${fallbackModels.length})...`);
                
                for (const geminiKey of geminiKeys) {
                    for (const modelName of fallbackModels) {
                        try {
                            console.log(`[GEMINI NATIVE] Attempting model ${modelName}...`);
                            
                            const parts: any[] = [{ text: (request.systemPrompt || '') + "\n\n---\n\n" + request.prompt }];
                            if (request.image) {
                                // Extract base64 data, removing data:image/...;base64, if present
                                const base64Data = request.image.includes('base64,') ? request.image.split('base64,')[1] : request.image;
                                parts.push({
                                    inlineData: {
                                        mimeType: "image/jpeg",
                                        data: base64Data
                                    }
                                });
                            }

                            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: parts }],
                                    generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
                                })
                            });

                            if (!response.ok) {
                                const errorBody = await response.text();
                                lastError = new Error(`Google API Error (${response.status}): ${errorBody}`);
                                
                                // Catch 429 (Rate Limit), 503 (Overloaded), 404 (Model not found)
                                if ([429, 503, 500, 404, 502].includes(response.status)) {
                                    console.warn(`[GEMINI NATIVE] Warning: ${response.status} on ${modelName}. Trying next fallback...`);
                                    continue; 
                                }
                                throw lastError; 
                            }
                            
                            const json = await response.json();
                            const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            return { requestId: request.id, provider: 'GEMINI_NATIVE', content: content, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latencyMs: 1000 };
                        } catch (err: any) {
                            lastError = err;
                        }
                    }
                }
                
                throw new Error(`All Gemini keys and fallback models exhausted. Last error: ${lastError?.message}`);
            }

            // --- NATIVE OPENAI COMPATIBLE ROUTES (GROQ, DEEPSEEK) ---
            if (this.type === 'GROQ' || this.type === 'DEEPSEEK') {
                let nativeUrl = '';
                let nativeKey = '';
                let nativeModel = '';
                
                if (this.type === 'GROQ') {
                    nativeKey = process.env.GROQ_API_KEY || '';
                    if (!nativeKey || nativeKey.length < 10) throw new Error("GROQ_API_KEY is missing or invalid in .env");
                    nativeUrl = 'https://api.groq.com/openai/v1/chat/completions';
                    nativeModel = 'llama-3.1-8b-instant';
                } else if (this.type === 'DEEPSEEK') {
                    nativeKey = process.env.DEEPSEEK_API_KEY || '';
                    if (!nativeKey || nativeKey.length < 10) throw new Error("DEEPSEEK_API_KEY is missing or invalid in .env");
                    nativeUrl = 'https://api.deepseek.com/chat/completions';
                    nativeModel = 'deepseek-coder';
                }
                
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
                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`Native API Error (${response.status}): ${errorBody}`);
                }
                const json = await response.json();
                const content = json.choices?.[0]?.message?.content || '';
                return { requestId: request.id, provider: `${this.type}_NATIVE`, content: content, usage: { promptTokens: json.usage?.prompt_tokens || 0, completionTokens: json.usage?.completion_tokens || 0, totalTokens: json.usage?.total_tokens || 0 }, latencyMs: 1000 };
            }

            // --- NATIVE ANTHROPIC ROUTE ---
            if (this.type === 'ANTHROPIC') {
                const anthropicKey = process.env.ANTHROPIC_API_KEY;
                if (!anthropicKey || anthropicKey.length < 10) throw new Error("ANTHROPIC_API_KEY is missing or invalid in .env");
                
                console.log(`[ANTHROPIC NATIVE] Routing directly to Anthropic API...`);
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
                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`Anthropic API Error (${response.status}): ${errorBody}`);
                }
                const json = await response.json();
                const content = json.content?.[0]?.text || '';
                return { requestId: request.id, provider: 'ANTHROPIC_NATIVE', content: content, usage: { promptTokens: json.usage?.input_tokens || 0, completionTokens: json.usage?.output_tokens || 0, totalTokens: 0 }, latencyMs: 1000 };
            }

            throw new Error(`Unsupported AI Provider Type for Direct Fallback: ${this.type}`);

        } catch (error: any) {
            console.error(`[${this.type} Fallback Error] ${error.message}`);
            throw new Error(`[Router] CRITICAL: Native Fallback failed. Please check your ${this.type} API Key in .env. Last error: ${error.message}`);
        }
    }
}
