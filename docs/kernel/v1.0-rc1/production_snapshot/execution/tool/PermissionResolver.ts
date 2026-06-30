// src/production/execution/tool/PermissionResolver.ts

import { SecurityPolicy } from "./SecurityPolicy";

/**
 * Determines the applicable security policy for a given context and tool request.
 */
export interface IPermissionResolver {
  resolvePolicy(toolName: string, contextPermissions?: readonly string[]): SecurityPolicy;
}
