/**
 * ToolRegistry.mjs
 * Central Governance Registry of all 9Router Live Tools.
 */

import { webSearchToolInstance } from './WebSearchTool.mjs';
import { documentIntelligenceToolInstance } from './DocumentIntelligenceTool.mjs';
import { memoryVaultToolInstance } from './MemoryVaultTool.mjs';
import { multiLayerSearchToolInstance } from './MultiLayerSearchTool.mjs';
import { webFetchToolInstance } from './WebFetchTool.mjs';
import { sandboxExecutionToolInstance } from './SandboxExecutionTool.mjs';
import { threatFeedToolInstance } from './ThreatFeedTool.mjs';
import { formalSolveToolInstance } from './FormalSolveTool.mjs';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.register(webSearchToolInstance);
    this.register(documentIntelligenceToolInstance);
    this.register(memoryVaultToolInstance);
    this.register(multiLayerSearchToolInstance);
    this.register(webFetchToolInstance);
    this.register(sandboxExecutionToolInstance);
    this.register(threatFeedToolInstance);
    this.register(formalSolveToolInstance);
  }

  register(toolInstance) {
    this.tools.set(toolInstance.name, toolInstance);
  }

  get(name) {
    return this.tools.get(name);
  }

  async executeTool(name, params = {}, signal = null) {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered in ToolRegistry.`);
    }
    return tool.execute(params, signal);
  }

  listTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      permissionLevel: t.permissionLevel,
      timeoutMs: t.timeoutMs
    }));
  }
}

export const toolRegistryInstance = new ToolRegistry();
export default toolRegistryInstance;
