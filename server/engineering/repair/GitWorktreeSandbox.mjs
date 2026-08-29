/**
 * GitWorktreeSandbox.mjs
 * Isolated Sandbox Environment for testing patches without affecting live production.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class GitWorktreeSandbox {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.sandboxBaseDir = path.resolve(workspaceRoot, '.sandbox');
    this.activeSandboxes = new Map();
  }

  ensureBaseDir() {
    if (!fs.existsSync(this.sandboxBaseDir)) {
      fs.mkdirSync(this.sandboxBaseDir, { recursive: true });
    }
  }

  async createSandbox(incidentId) {
    this.ensureBaseDir();
    const sandboxId = `sandbox-${incidentId}-${Date.now()}`;
    const sandboxPath = path.join(this.sandboxBaseDir, sandboxId);

    console.log(`ðŸ“¦ [Sandbox] Creating isolated sandbox at ${sandboxPath}...`);

    try {
      // Create isolated working directory
      fs.mkdirSync(sandboxPath, { recursive: true });

      const sandboxInfo = {
        sandboxId,
        incidentId,
        path: sandboxPath,
        createdAt: new Date().toISOString(),
        status: 'READY'
      };

      this.activeSandboxes.set(sandboxId, sandboxInfo);
      return sandboxInfo;
    } catch (err) {
      console.error(`âŒ [Sandbox] Failed to create sandbox:`, err.message);
      throw err;
    }
  }

  async applyPatchToSandbox(sandboxId, relativeFilePath, patchContent) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const sourceFile = path.resolve(this.workspaceRoot, relativeFilePath);
    const targetFile = path.resolve(sandbox.path, relativeFilePath);

    fs.mkdirSync(path.dirname(targetFile), { recursive: true });

    // Copy original file if not present
    if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, targetFile);
    }

    // Apply modified patch
    fs.writeFileSync(targetFile, patchContent, 'utf8');
    console.log(`ðŸ› ï¸ [Sandbox] Applied patch to ${relativeFilePath} inside sandbox ${sandboxId}`);
    return { success: true, targetFile };
  }

  async cleanupSandbox(sandboxId) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (sandbox && fs.existsSync(sandbox.path)) {
      try {
        fs.rmSync(sandbox.path, { recursive: true, force: true });
        this.activeSandboxes.delete(sandboxId);
        console.log(`ðŸ§¹ [Sandbox] Cleaned up sandbox ${sandboxId}`);
      } catch (err) {
        console.warn(`[Sandbox] Cleanup warning for ${sandboxId}:`, err.message);
      }
    }
  }
}

export const gitWorktreeSandboxInstance = new GitWorktreeSandbox();
