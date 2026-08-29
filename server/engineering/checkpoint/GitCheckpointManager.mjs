/**
 * GitCheckpointManager.mjs
 * Git-backed checkpoint snapshot and rollback engine for safe autonomous repair.
 */

import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);

export class GitCheckpointManager {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.checkpoints = new Map();
  }

  async getCurrentCommit() {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.workspaceRoot });
      return stdout.trim();
    } catch (e) {
      console.warn('[GitCheckpointManager] Unable to get current git commit:', e.message);
      return null;
    }
  }

  async createCheckpoint(incidentId, description = 'Pre-Repair Checkpoint') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const checkpointId = `CHK-${incidentId || 'SYS'}-${timestamp}`;
    const baseCommit = await this.getCurrentCommit();

    // Create a local backup of target files if git is clean
    const checkpointData = {
      checkpointId,
      incidentId,
      baseCommit,
      createdAt: new Date().toISOString(),
      description,
      status: 'ACTIVE'
    };

    this.checkpoints.set(checkpointId, checkpointData);
    console.log(`ðŸ’¾ [CheckpointManager] Created Checkpoint ${checkpointId} (Base: ${baseCommit})`);
    return checkpointData;
  }

  async rollback(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    console.log(`âª [CheckpointManager] Initiating ROLLBACK to ${checkpointId}...`);
    try {
      if (checkpoint.baseCommit) {
        // Discard working directory changes back to base commit
        await execAsync(`git checkout ${checkpoint.baseCommit} -- .`, { cwd: this.workspaceRoot });
        checkpoint.status = 'ROLLED_BACK';
        console.log(`âœ… [CheckpointManager] Rollback to commit ${checkpoint.baseCommit} complete.`);
        return { success: true, checkpointId, status: 'ROLLED_BACK' };
      } else {
        throw new Error('No base git commit recorded for rollback.');
      }
    } catch (err) {
      console.error(`âŒ [CheckpointManager] Rollback failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  getCheckpoint(checkpointId) {
    return this.checkpoints.get(checkpointId);
  }
}

export const gitCheckpointManagerInstance = new GitCheckpointManager();
