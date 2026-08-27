/**
 * ToolContract.mjs (Enterprise Governance Edition)
 * Comprehensive contract for 9Router tools with permission gates and safety policies.
 */

export const PERMISSION_LEVELS = {
  READ_ONLY: 'READ_ONLY',                         // Auto-allowed: web search, document read, data query
  SAFE_EXECUTE: 'SAFE_EXECUTE',                   // Auto-allowed in sandbox: draft generation, calculation
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED'  // Requires explicit user confirmation modal: delete, upload, write
};

export class ToolContract {
  constructor({
    name,
    version = '1.0.0',
    description,
    inputSchema = {},
    outputSchema = {},
    permissionLevel = PERMISSION_LEVELS.READ_ONLY,
    requiresConfirmation = false,
    timeoutMs = 8000,
    maxRetries = 2,
    allowedDomains = ['*'],
    telemetryPolicy = 'LOG_FULL'
  }) {
    this.name = name;
    this.version = version;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.permissionLevel = permissionLevel;
    this.requiresConfirmation = requiresConfirmation || permissionLevel === PERMISSION_LEVELS.CONFIRMATION_REQUIRED;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.allowedDomains = allowedDomains;
    this.telemetryPolicy = telemetryPolicy;
  }

  async execute(params, signal = null) {
    throw new Error(`Execute method not implemented for tool: ${this.name}`);
  }
}

export default ToolContract;
