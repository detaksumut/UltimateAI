import { AIRequest, AIResponse, AIProviderType, RouterConfig } from './models';
import { DefaultRouterConfig, CapabilityRouterMap } from './config';
import { DirectFallbackProvider, BaseProvider } from './providers';

export class RouterManager {
    public async routeTask(request: AIRequest, config: RouterConfig = DefaultRouterConfig): Promise<AIResponse> {
        console.log(`\n=== [Router] Initiating Task ${request.id} (${request.requiredCapability}) ===`);
        return this.executeFailover(request);
    }

    private async executeFailover(request: AIRequest): Promise<AIResponse> {
        const fallbacks = CapabilityRouterMap[request.requiredCapability];
        if (!fallbacks || fallbacks.length === 0) {
            throw new Error(`[Router] No fallback providers available for capability: ${request.requiredCapability}`);
        }

        console.log(`[Router] 🔄 Initiating Auto-Failover to Direct APIs: [${fallbacks.join(', ')}]`);
        
        // Try each fallback sequentially until one succeeds
        let lastError = null;
        for (const providerType of fallbacks) {
            try {
                console.log(`[Router] Failover attempt: ${providerType}...`);
                const provider = new DirectFallbackProvider(providerType);
                const result = await provider.execute(request);
                console.log(`[Router] ✅ Failover Success via ${providerType}!`);
                return result;
            } catch (err: any) {
                lastError = err.message;
                console.error(`[Router] ❌ Failover attempt ${providerType} failed: ${err.message}`);
            }
        }

        throw new Error(`[Router] CRITICAL: All failover routes exhausted. Last error: ${lastError}`);
    }
}
