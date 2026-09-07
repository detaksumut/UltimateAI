/**
 * ToolRegistry.mjs (Backward-Compatibility Adapter)
 * 
 * Delegates all tool dispatch and inspection to the single source of truth:
 * CapabilityRegistry (server/grounding/CapabilityRegistry.mjs).
 */

import { capabilityRegistryInstance, CapabilityRegistry } from '../grounding/CapabilityRegistry.mjs';

export class ToolRegistryAdapter {
  constructor() {
    this._registry = capabilityRegistryInstance;
  }

  get(name) {
    return this._registry.get(name);
  }

  getTool(name) {
    return this._registry.get(name);
  }

  listTools() {
    return this._registry.listTools();
  }

  async executeTool(name, params = {}, options = {}) {
    return this._registry.executeCapability(name, params, options);
  }

  hasTool(name) {
    return this._registry.hasCapability(name);
  }
}

export const toolRegistryInstance = new ToolRegistryAdapter();
export const ToolRegistry = ToolRegistryAdapter;
export default toolRegistryInstance;
