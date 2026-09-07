/**
 * DeviceInspectTool.mjs
 * READ_ONLY tool exposing JIN Device Intelligence to the agent runtime.
 * Scopes: overview | memory | process | storage | runtime | diagnosis.
 * LOCAL ONLY — no external calls, no destructive actions.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { deviceIntelligenceRuntimeInstance } from '../device/DeviceIntelligenceRuntime.mjs';

const SCOPES = new Set(['overview', 'memory', 'process', 'storage', 'runtime', 'diagnosis']);

export class DeviceInspectTool extends ToolContract {
  constructor() {
    super({
      name: 'device.inspect',
      version: '1.0.0',
      description: 'Inspect the local machine (Windows/Node): RAM, CPU, disk, running processes, and the UltimateAI runtime (Vite/Local Router/backend/Ollama). Read + analyze only.',
      inputSchema: { scope: 'string' },
      outputSchema: { scope: 'string', service: 'string', summary: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 15000,
      maxRetries: 1
    });
  }

  async execute(params = {}, signal = null) {
    const scope = SCOPES.has(params?.scope) ? params.scope : 'overview';

    // Action-journal metadata (E): from the agent path when present, else LOCAL.
    const meta = {
      userIntent: params?.userIntent || params?.userUtterance || params?.query || 'API (LOKAL)',
      action: `INSPECT_${scope.toUpperCase()}`,
      scope,
      artifactReference: params?.artifactReference || null,
      riskLevel: 'LOW'
    };

    switch (scope) {
      case 'memory':
        return { scope, service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getMemoryReport(meta)) };
      case 'process':
        return { scope, service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getProcessReport(meta)) };
      case 'storage':
        return { scope, service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.getStorageReport(meta, { mode: 'FAST' })) };
      case 'runtime':
        return { scope, service: 'DEVICE_INTELLIGENCE', runtime: await deviceIntelligenceRuntimeInstance.getUltimateAIRuntimeReport(meta) };
      case 'diagnosis':
        return { scope, service: 'DEVICE_INTELLIGENCE', ...(await deviceIntelligenceRuntimeInstance.runDiagnosis(meta)) };
      case 'overview':
      default: {
        const { text, ...diagnosis } = await deviceIntelligenceRuntimeInstance.composeHumanAnswer('overview', meta);
        return { scope, service: 'DEVICE_INTELLIGENCE', ...diagnosis, text };
      }
    }
  }
}

export const deviceInspectToolInstance = new DeviceInspectTool();
export default deviceInspectToolInstance;