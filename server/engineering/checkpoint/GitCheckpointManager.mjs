/**
 * GitCheckpointManager.mjs
 * Safe Git-backed checkpoints for supervised self-repair.
 *
 * A repair runs in a separate worktree; rollback therefore discards that
 * worktree. This manager must never checkout old files over an operator's
 * active working tree.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitCheckpointManager {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.checkpoints = new Map();
  }

  async git(args) {
    return execFileAsync('git', args, {
      cwd: this.workspaceRoot,
      timeout: 20000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });
  }

  async getCurrentCommit() {
    try {
      const { stdout } = await this.git(['rev-parse', 'HEAD']);
      return stdout.trim();
    } catch (err) {
      console.warn('[GitCheckpointManager] Unable to get current git commit:', err.message);
      return null;
    }
  }

  async createCheckpoint(incidentId, description = 'Pre-Repair Checkpoint') {
    const { stdout: statusRaw } = await this.git(['status', '--porcelain', '--untracked-files=no']);
    if (statusRaw.trim()) {
      throw new Error('WORKSPACE_DIRTY: checkpoint refused because tracked working-tree changes exist. Commit or stash them first.');
    }
    const baseCommit = await this.getCurrentCommit();
    if (!baseCommit) throw new Error('CHECKPOINT_FAILED: workspace is not a valid Git repository.');
    const { stdout: branchRaw } = await this.git(['branch', '--show-current']);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const checkpointId = 'CHK-' + String(incidentId || 'SYS').replace(/[^A-Za-z0-9_-]/g, '-') + '-' + timestamp;

    const checkpointData = {
      checkpointId,
      incidentId,
      baseCommit,
      branchName: branchRaw.trim(),
      createdAt: new Date().toISOString(),
      description,
      status: 'ACTIVE',
      workspaceWasClean: true,
      rollbackStrategy: 'DISCARD_ISOLATED_WORKTREE'
    };
    this.checkpoints.set(checkpointId, checkpointData);
    console.log('[CheckpointManager] Created checkpoint', JSON.stringify({ checkpointId, baseCommit, branchName: checkpointData.branchName }));
    return { ...checkpointData };
  }

  async rollback(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) throw new Error('CHECKPOINT_NOT_FOUND: ' + checkpointId);

    const currentCommit = await this.getCurrentCommit();
    const { stdout: statusRaw } = await this.git(['status', '--porcelain', '--untracked-files=no']);
    if (currentCommit !== checkpoint.baseCommit || statusRaw.trim()) {
      return {
        success: false,
        checkpointId,
        status: 'MANUAL_ROLLBACK_REQUIRED',
        error: 'Active workspace has changed since checkpoint. Refusing to overwrite files; inspect the repair branch or use an explicit Git revert.'
      };
    }

    // Nothing was applied to the active tree: failed automatic changes live in
    // a separate worktree and are discarded by GitWorktreeSandbox.cleanupSandbox.
    checkpoint.status = 'ROLLED_BACK';
    return {
      success: true,
      checkpointId,
      status: 'ROLLED_BACK',
      strategy: 'ACTIVE_WORKTREE_UNCHANGED',
      baseCommit: checkpoint.baseCommit
    };
  }

  getCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? { ...checkpoint } : null;
  }
}

export const gitCheckpointManagerInstance = new GitCheckpointManager();
