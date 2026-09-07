/**
 * CleanupPolicy.mjs
 * Builds NON-DESTRUCTIVE cleanup *plans* from classified items.
 *
 * Phase 1 = OBSERVE_ONLY: this module only derives what WOULD be safe to
 * clean later. It never deletes, moves, or modifies anything.
 */

import { devicePolicyInstance, DEVICE_ACTION_LEVELS } from './DevicePolicy.mjs';

export class CleanupPolicy {
  /**
   * @param {Array<{path:string,sizeBytes:number,category:'SAFE'|'REVIEW'|'PROTECTED',reason:string}>} classifiedItems
   * @returns {{ plan: Array<{path:string,sizeBytes:number,action:string,level:string}>, recoverableBytes:number, blockedReason:string }}
   */
  buildPlan(classifiedItems) {
    const safeItems = (classifiedItems || []).filter(i => i.category === 'SAFE' && i.sizeBytes > 0);

    const plan = safeItems.map(item => ({
      path: item.path,
      sizeBytes: item.sizeBytes,
      action: 'delete_whitelisted_tmp',
      level: devicePolicyInstance.guard('cleanup_whitelisted_temp', { path: item.path }).required
    }));

    const recoverableBytes = plan.reduce((sum, p) => sum + p.sizeBytes, 0);

    return {
      plan,
      recoverableBytes,
      totalCandidates: (classifiedItems || []).length,
      executionBlocked: !devicePolicyInstance.isAllowed(DEVICE_ACTION_LEVELS.SAFE_ACTION),
      policy: devicePolicyInstance.describe()
    };
  }
}

export const cleanupPolicyInstance = new CleanupPolicy();
export default cleanupPolicyInstance;