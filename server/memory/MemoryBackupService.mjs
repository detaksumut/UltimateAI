/**
 * MemoryBackupService.mjs
 * Phase 8 / Active Memory Core: Automated Snapshot Backup & Log Rotation Service.
 * 
 * Target: F:\UltimateAI_Memory\02_Documentation\Backups\
 * Features:
 *  - Automated timestamped backup of 05_Vault and 03_AgentState
 *  - Integrity verification & Backup Manifest (file count, byte size, hash)
 *  - Retention policy (auto-cleans backups older than retention limit)
 *  - Physical drive limitation warning (when backup resides on the same drive F:)
 *  - Size-based log rotation for 01_Logs/
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class MemoryBackupService {
  constructor(basePath = 'F:\\UltimateAI_Memory', maxBackups = 10, maxLogSizeMb = 5) {
    this.basePath = basePath;
    this.backupDir = path.join(basePath, '02_Documentation', 'Backups');
    this.maxBackups = maxBackups;
    this.maxLogSizeBytes = maxLogSizeMb * 1024 * 1024;
    this.lastBackupStatus = null;
  }

  /**
   * Generates a sha256 hash for a file
   */
  _getFileHash(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (_) {
      return null;
    }
  }

  /**
   * Performs an automated snapshot backup of 05_Vault & 03_AgentState
   */
  performBackup({ secondaryDest = null } = {}) {
    try {
      if (!fs.existsSync(this.basePath)) {
        return { success: false, error: `Base path ${this.basePath} not found` };
      }

      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const targetBackupFolder = path.join(this.backupDir, `backup_${timestamp}`);
      fs.mkdirSync(targetBackupFolder, { recursive: true });

      const vaultSource = path.join(this.basePath, '05_Vault');
      const stateSource = path.join(this.basePath, '03_AgentState');

      const manifest = {
        backupId: `bk_${timestamp}`,
        timestamp: new Date().toISOString(),
        sourceBase: this.basePath,
        primaryDestination: targetBackupFolder,
        secondaryDestination: secondaryDest,
        samePhysicalDriveWarning: 'CRITICAL_NOTE: Source and Primary Backup reside on the same physical volume (Drive F:). For disaster recovery against hardware loss, configure a secondary external location.',
        files: [],
        totalBytes: 0
      };

      // 1. Backup 05_Vault
      if (fs.existsSync(vaultSource)) {
        const vaultTarget = path.join(targetBackupFolder, '05_Vault');
        fs.mkdirSync(vaultTarget, { recursive: true });

        const vaultFiles = fs.readdirSync(vaultSource);
        for (const file of vaultFiles) {
          const srcPath = path.join(vaultSource, file);
          const stat = fs.statSync(srcPath);
          if (stat.isFile()) {
            const destPath = path.join(vaultTarget, file);
            fs.copyFileSync(srcPath, destPath);
            const hash = this._getFileHash(srcPath);
            manifest.files.push({ relPath: `05_Vault/${file}`, bytes: stat.size, sha256: hash });
            manifest.totalBytes += stat.size;
          }
        }
      }

      // 2. Backup 03_AgentState
      if (fs.existsSync(stateSource)) {
        const stateTarget = path.join(targetBackupFolder, '03_AgentState');
        fs.mkdirSync(stateTarget, { recursive: true });

        const stateFiles = fs.readdirSync(stateSource);
        for (const file of stateFiles) {
          const srcPath = path.join(stateSource, file);
          const stat = fs.statSync(srcPath);
          if (stat.isFile()) {
            const destPath = path.join(stateTarget, file);
            fs.copyFileSync(srcPath, destPath);
            const hash = this._getFileHash(srcPath);
            manifest.files.push({ relPath: `03_AgentState/${file}`, bytes: stat.size, sha256: hash });
            manifest.totalBytes += stat.size;
          }
        }
      }

      // 3. Write manifest.json
      const manifestPath = path.join(targetBackupFolder, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      // 4. Optional Secondary Destination sync
      if (secondaryDest) {
        try {
          if (!fs.existsSync(secondaryDest)) fs.mkdirSync(secondaryDest, { recursive: true });
          const secTarget = path.join(secondaryDest, `backup_${timestamp}`);
          fs.cpSync(targetBackupFolder, secTarget, { recursive: true });
        } catch (secErr) {
          manifest.secondaryError = secErr.message;
        }
      }

      // 5. Enforce Retention Policy
      this._enforceRetentionPolicy();

      this.lastBackupStatus = {
        success: true,
        backupId: manifest.backupId,
        timestamp: manifest.timestamp,
        filesCount: manifest.files.length,
        totalBytes: manifest.totalBytes,
        path: targetBackupFolder
      };

      return this.lastBackupStatus;
    } catch (err) {
      this.lastBackupStatus = { success: false, error: err.message, timestamp: new Date().toISOString() };
      return this.lastBackupStatus;
    }
  }

  _enforceRetentionPolicy() {
    try {
      if (!fs.existsSync(this.backupDir)) return;
      const entries = fs.readdirSync(this.backupDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith('backup_'))
        .map(d => ({
          name: d.name,
          fullPath: path.join(this.backupDir, d.name),
          time: fs.statSync(path.join(this.backupDir, d.name)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (entries.length > this.maxBackups) {
        const toDelete = entries.slice(this.maxBackups);
        for (const old of toDelete) {
          fs.rmSync(old.fullPath, { recursive: true, force: true });
        }
      }
    } catch (_) {}
  }

  /**
   * Log rotation for 01_Logs
   */
  rotateLogs() {
    try {
      const logsDir = path.join(this.basePath, '01_Logs');
      if (!fs.existsSync(logsDir)) return { rotatedCount: 0 };

      const archiveDir = path.join(logsDir, 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

      const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
      let rotatedCount = 0;

      for (const logFile of logFiles) {
        const fullPath = path.join(logsDir, logFile);
        const stat = fs.statSync(fullPath);

        if (stat.size > this.maxLogSizeBytes) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const archiveName = `${path.parse(logFile).name}_${timestamp}.log`;
          const destPath = path.join(archiveDir, archiveName);

          fs.renameSync(fullPath, destPath);
          fs.writeFileSync(fullPath, `[${new Date().toISOString()}] Log rotated. Previous archived to ${archiveName}\n`, 'utf-8');
          rotatedCount++;
        }
      }

      return { success: true, rotatedCount };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const memoryBackupServiceInstance = new MemoryBackupService();
export default memoryBackupServiceInstance;
