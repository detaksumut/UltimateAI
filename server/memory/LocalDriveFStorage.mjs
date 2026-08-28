/**
 * LocalDriveFStorage.mjs
 * Direct On-Premise Local Storage Adapter for Drive F:\ (Air-Gapped Privacy).
 * 
 * Target Base: F:\UltimateAI_Memory
 * Automatically writes memory logs, state, and artifacts locally without cloud leakage.
 */

import fs from 'fs';
import path from 'path';

export class LocalDriveFStorage {
  constructor(basePath = 'F:\\UltimateAI_Memory') {
    this.basePath = basePath;
    this.isAvailable = false;
    this._checkAvailability();
  }

  _checkAvailability() {
    try {
      if (fs.existsSync('F:\\')) {
        this.isAvailable = true;
        this._ensureDirectories();
      }
    } catch (_) {
      this.isAvailable = false;
    }
  }

  _ensureDirectories() {
    if (!this.isAvailable) return;
    const dirs = [
      path.join(this.basePath, '01_Logs'),
      path.join(this.basePath, '02_Documentation'),
      path.join(this.basePath, '03_AgentState'),
      path.join(this.basePath, '04_Outputs'),
      path.join(this.basePath, '05_Vault')
    ];

    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (_) {}
    }
  }

  /**
   * Save a state, artifact, or memory record to drive F:
   */
  writeRecord(category = '03_AgentState', fileName = 'state.json', data = {}) {
    this._checkAvailability();
    if (!this.isAvailable) return null;

    try {
      const targetDir = path.join(this.basePath, category);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, fileName);
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');

      return {
        success: true,
        path: filePath,
        savedAt: new Date().toISOString()
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Append a line to logs in F:\UltimateAI_Memory\01_Logs
   */
  appendLog(logName = 'jin_runtime.log', message = '') {
    this._checkAvailability();
    if (!this.isAvailable) return;

    try {
      const logDir = path.join(this.basePath, '01_Logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

      const logPath = path.join(logDir, logName);
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf-8');
    } catch (_) {}
  }
}

export const localDriveFStorageInstance = new LocalDriveFStorage();
export default localDriveFStorageInstance;
