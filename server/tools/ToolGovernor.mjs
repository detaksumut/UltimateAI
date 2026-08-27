/**
 * ToolGovernor.mjs
 * Security Supervisor & Execution Governor for 9Router Tools.
 * Enforces Permission Gating, Input Validation, Abort Signals, and Untrusted Data Isolation.
 */

import { PERMISSION_LEVELS } from './ToolContract.mjs';
import { GatewayTelemetry } from '../telemetry/GatewayTelemetry.mjs';

export class ToolGovernor {
  static async governAndExecute(tool, params = {}, options = {}) {
    const startTime = Date.now();
    const toolName = tool.name;

    // 1. Permission Gate Check
    if (tool.permissionLevel === PERMISSION_LEVELS.CONFIRMATION_REQUIRED && !options.userConfirmed) {
      GatewayTelemetry.logEvent('TOOL_PERMISSION_BLOCKED', {
        tool: toolName,
        level: tool.permissionLevel,
        reason: 'EXPLICIT_CONFIRMATION_REQUIRED'
      });
      return {
        status: 'BLOCKED',
        reason: 'CONFIRMATION_REQUIRED',
        message: `Tindakan pada tool "${toolName}" memerlukan persetujuan eksplisit dari operator.`
      };
    }

    // 2. Input Validation
    const validationError = this.validateInputs(tool, params);
    if (validationError) {
      GatewayTelemetry.logEvent('TOOL_INPUT_REJECTED', { tool: toolName, error: validationError });
      return { status: 'INVALID_INPUT', error: validationError };
    }

    // 3. Execution Supervisor with AbortSignal & Timeout
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || tool.timeoutMs || 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external abort signal if present
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    GatewayTelemetry.logEvent('TOOL_EXECUTION_START', { tool: toolName, timeoutMs });

    try {
      const rawResult = await tool.execute(params, controller.signal);
      clearTimeout(timeoutId);

      // 4. Output Sanitization & Untrusted Data Boundary Isolation
      const securedResult = this.applyUntrustedBoundary(tool, rawResult);
      const latencyMs = Date.now() - startTime;

      GatewayTelemetry.logEvent('TOOL_EXECUTION_SUCCESS', { tool: toolName, latencyMs });
      return {
        status: 'SUCCESS',
        result: securedResult,
        latencyMs
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || controller.signal.aborted;
      const latencyMs = Date.now() - startTime;

      GatewayTelemetry.logEvent('TOOL_EXECUTION_FAILED', {
        tool: toolName,
        reason: isTimeout ? 'TIMEOUT_ABORTED' : err.message,
        latencyMs
      });

      return {
        status: isTimeout ? 'TIMEOUT' : 'ERROR',
        error: isTimeout ? `Tool execution exceeded ${timeoutMs}ms limit.` : err.message,
        latencyMs
      };
    }
  }

  static validateInputs(tool, params) {
    if (!params || typeof params !== 'object') {
      return 'Parameter must be an object.';
    }
    // Check required schema fields
    for (const [key, type] of Object.entries(tool.inputSchema || {})) {
      if (type === 'string' && params[key] !== undefined && typeof params[key] !== 'string') {
        return `Field "${key}" must be a string.`;
      }
      if (type === 'number' && params[key] !== undefined && typeof params[key] !== 'number') {
        return `Field "${key}" must be a number.`;
      }
    }
    return null;
  }

  /**
   * Structural Untrusted Data Boundary
   * Ensures retrieved web data is cleanly isolated so the LLM cannot be highjacked by prompt injection.
   */
  static applyUntrustedBoundary(tool, result) {
    if (!result) return result;

    if (tool.name === 'web.search' && result.sources && Array.isArray(result.sources)) {
      const wrappedSources = result.sources.map(src => ({
        ...src,
        // Wrap snippet in strict untrusted XML delimiter
        safePayload: `<<<UNTRUSTED_EXTERNAL_DATA [Source ID: ${src.id}]>>>\n${src.snippet}\n<<<END_UNTRUSTED_EXTERNAL_DATA>>>`
      }));

      return {
        ...result,
        sources: wrappedSources,
        securityPolicy: 'UNTRUSTED_CONTENT_BOUNDARY_ENFORCED'
      };
    }

    return result;
  }
}

export default ToolGovernor;
