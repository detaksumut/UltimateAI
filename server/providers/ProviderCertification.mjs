/**
 * ProviderCertification.mjs
 * Live Runtime Verification & Health Matrix for Local AI Providers.
 * Gateway: Local Ollama Provider (:11434)
 */

import { providerRegistryInstance } from './ProviderRegistry.mjs';
import { PROVIDER_STATUS } from '../telemetry/CanonicalVocabulary.mjs';

export { PROVIDER_STATUS };
export const CERTIFICATION_STATUS = PROVIDER_STATUS; // Backward compatibility alias

export class ProviderCertification {
  static async certifyAllProviders() {
    const results = {};
    const providers = ['ollama'];

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

      // Local Ollama Health Check
      const health = await provider.healthCheck();
      results[name] = {
        status: health.ok ? PROVIDER_STATUS.AUTHENTICATED_LIVE : PROVIDER_STATUS.FAILED,
        configured: true,
        authenticated: true,
        reachable: health.ok,
        streamMode: 'UPSTREAM_NATIVE',
        providerGateway: 'LOCAL_OLLAMA',
        models: health.models || [],
        lastCheck: new Date().toISOString()
      };
    }

    return results;
  }
}

export default ProviderCertification;
