/**
 * ProviderCertification.mjs (Hardened Edition)
 * Live Runtime Verification & Health Matrix for 9Router AI Providers.
 * Status Matrix: NOT_CONFIGURED | CONFIGURED_UNVERIFIED | AUTHENTICATED_LIVE | DEGRADED | FAILED.
 */

import { providerRegistryInstance } from './ProviderRegistry.mjs';
import { PROVIDER_STATUS } from '../telemetry/CanonicalVocabulary.mjs';

export { PROVIDER_STATUS };
export const CERTIFICATION_STATUS = PROVIDER_STATUS; // Backward compatibility alias

export class ProviderCertification {
  static async certifyAllProviders() {
    const results = {};
    const providers = ['gemini', 'openai', 'claude', 'deepseek'];

    for (const name of providers) {
      const provider = providerRegistryInstance.get(name);
      if (!provider || !provider.isConfigured()) {
        results[name] = {
          status: PROVIDER_STATUS.NOT_CONFIGURED,
          configured: false,
          authenticated: false,
          reachable: false,
          streamMode: 'N/A'
        };
        continue;
      }

      // Test real probe connection
      try {
        const startTime = Date.now();
        const testResponse = await provider.sendChat({
          messages: [{ role: 'user', content: 'Ping. Reply with: PONG' }],
          stream: false,
          temperature: 0.1
        });

        const latencyMs = Date.now() - startTime;
        const isLive = Boolean(testResponse && testResponse.length > 0);

        // Check if latency indicates a degraded connection (>3000ms)
        let status = CERTIFICATION_STATUS.AUTHENTICATED_LIVE;
        if (latencyMs > 3000) {
          status = CERTIFICATION_STATUS.DEGRADED;
        } else if (!isLive) {
          status = CERTIFICATION_STATUS.CONFIGURED_UNVERIFIED;
        }

        results[name] = {
          status,
          configured: true,
          authenticated: isLive,
          reachable: isLive,
          streamMode: 'UPSTREAM_NATIVE',
          latencyMs,
          sampleReply: testResponse.substring(0, 50),
          lastCheck: new Date().toISOString()
        };
      } catch (err) {
        results[name] = {
          status: CERTIFICATION_STATUS.FAILED,
          configured: true,
          authenticated: false,
          reachable: false,
          streamMode: 'LOCAL_SYNTHETIC',
          error: err.message,
          lastCheck: new Date().toISOString()
        };
      }
    }

    return results;
  }
}

export default ProviderCertification;
