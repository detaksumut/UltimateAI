// src/production/execution/tool/SecurityPolicy.ts

/**
 * Defines the permissions and limits for a specific tool invocation.
 */
export interface SecurityPolicy {
  readonly allowedTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly requireUserApproval: boolean;
  readonly maxDurationMs: number;
}
