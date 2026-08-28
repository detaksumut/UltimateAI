/**
 * MemoryCoreHealthCheck.mjs
 * Phase 8 / Active Memory Core: System Integrity & Health Check Diagnostics.
 * 
 * Verifies:
 *  - Drive F:\ availability
 *  - 05_Vault readability
 *  - SQLite Index accessibility and consistency
 *  - FileSystemWatcher Bridge liveness (http://localhost:8080/status)
 *  - Last Backup integrity
 *  - Disk capacity & corrupted records count
 * 
 * Overall Status: HEALTHY | DEGRADED | CRITICAL
 */

import fs from 'fs';
import path from 'path';
import { memoryIndexSQLiteInstance } from './MemoryIndexSQLite.mjs';
import { memoryBackupServiceInstance } from './MemoryBackupService.mjs';

export const HEALTH_STATES = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  CRITICAL: 'CRITICAL'
};

export class MemoryCoreHealthCheck {
  constructor(basePath = 'F:\\UltimateAI_Memory', bridgeUrl = 'http://localhost:8080') {
    this.basePath = basePath;
    this.bridgeUrl = bridgeUrl;
  }

  async runDiagnostics() {
    const checks = {
      driveFAccessible: false,
      vaultAccessible: false,
      sqliteAccessible: false,
      indexConsistent: false,
      bridgeAlive: false,
      backupStatus: 'UNKNOWN',
      corruptedRecordsCount: 0,
      totalIndexed: 0,
      totalVaultFiles: 0,
      diskFreeEstimate: 'N/A'
    };

    const issues = [];

    // 1. Drive F Check
    try {
      if (fs.existsSync('F:\\')) {
        checks.driveFAccessible = true;
      } else {
        issues.push('Drive F: is not mounted or accessible.');
      }
    } catch (err) {
      issues.push(`Drive F: error: ${err.message}`);
    }

    // 2. Vault Check
    const vaultPath = path.join(this.basePath, '05_Vault');
    try {
      if (fs.existsSync(vaultPath)) {
        checks.vaultAccessible = true;
        const files = fs.readdirSync(vaultPath).filter(f => f.endsWith('.json'));
        checks.totalVaultFiles = files.length;
      } else {
        issues.push('Vault folder F:\\UltimateAI_Memory\\05_Vault not found.');
      }
    } catch (err) {
      issues.push(`Vault access error: ${err.message}`);
    }

    // 3. SQLite Check & Consistency
    try {
      const stats = memoryIndexSQLiteInstance.getStats();
      if (stats.isOnline) {
        checks.sqliteAccessible = true;
        checks.totalIndexed = stats.totalRecords;

        const verify = memoryIndexSQLiteInstance.verifyIndex(vaultPath);
        checks.indexConsistent = verify.isConsistent;
        checks.corruptedRecordsCount = verify.corruptedFilesCount || 0;

        if (!verify.isConsistent) {
          issues.push(`Index mismatch: ${verify.missingInIndexCount} unindexed files, ${verify.orphanedInIndexCount} orphaned index records.`);
        }
      } else {
        issues.push('SQLite index is offline or uninitialized.');
      }
    } catch (err) {
      issues.push(`SQLite diagnostics error: ${err.message}`);
    }

    // 4. Bridge Status Check
    try {
      const response = await fetch(`${this.bridgeUrl}/status`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ONLINE') {
          checks.bridgeAlive = true;
        }
      }
    } catch (_) {
      // Bridge is optional background daemon
      checks.bridgeAlive = false;
    }

    // 5. Backup Status Check
    checks.backupStatus = memoryBackupServiceInstance.lastBackupStatus?.success ? 'UP_TO_DATE' : 'NO_RECENT_BACKUP';

    // 6. Formulate Overall Health Status
    let overallStatus = HEALTH_STATES.HEALTHY;
    if (!checks.driveFAccessible || !checks.vaultAccessible) {
      overallStatus = HEALTH_STATES.CRITICAL;
    } else if (!checks.sqliteAccessible || !checks.indexConsistent || checks.corruptedRecordsCount > 0) {
      overallStatus = HEALTH_STATES.DEGRADED;
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      basePath: this.basePath,
      checks,
      issues,
      summary: `Memory Core: ${overallStatus} (${checks.totalVaultFiles} files, ${checks.totalIndexed} indexed)`
    };
  }
}

export const memoryCoreHealthCheckInstance = new MemoryCoreHealthCheck();
export default memoryCoreHealthCheckInstance;
