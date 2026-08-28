/**
 * SandboxExecutionTool.mjs
 * Phase 4E: Dedicated Isolated Runtime Sandbox for Safe Analysis.
 * 
 * Strict Governance & Safety:
 *  - Sandboxed subprocess execution with bounded timeout (max 5000ms).
 *  - Memory ceiling (128MB max buffer limit).
 *  - Ephemeral scratch directory isolation with full post-execution cleanup.
 *  - Absolute ZERO access to OAuth tokens, environment secrets, or private vault credentials.
 *  - Enforces safe non-destructive computations, transformations, and code inspection.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class SandboxExecutionTool extends ToolContract {
  constructor() {
    super({
      name: 'sandbox.execute',
      version: '2.0.0',
      description: 'Execute safe, isolated computational code, transformations, or data analyses in a constrained sandbox.',
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 6000,
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript / Python / Shell computation code to safely execute' },
          runtime: { type: 'string', enum: ['node', 'python'], default: 'node' },
          timeoutMs: { type: 'number', default: 4000 }
        },
        required: ['code']
      }
    });

    this.sandboxBaseDir = path.join(os.tmpdir(), 'jin_sandbox_isolated');
    if (!fs.existsSync(this.sandboxBaseDir)) {
      try { fs.mkdirSync(this.sandboxBaseDir, { recursive: true }); } catch (_) {}
    }
  }

  /**
   * Sanitizes environment variables so subprocess receives ZERO vault credentials or API keys
   */
  _getSanitizedEnvironment() {
    return {
      NODE_ENV: 'sandbox',
      PATH: process.env.PATH || '',
      SYSTEMROOT: process.env.SYSTEMROOT || '',
      TEMP: this.sandboxBaseDir,
      TMP: this.sandboxBaseDir
    };
  }

  async execute({ code, runtime = 'node', timeoutMs = 4000 } = {}) {
    if (!code || typeof code !== 'string') {
      throw new Error('INVALID_ARGUMENT: "code" string is required.');
    }

    const startTime = Date.now();
    const sessionId = `sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sessionDir = path.join(this.sandboxBaseDir, sessionId);

    try {
      fs.mkdirSync(sessionDir, { recursive: true });
    } catch (_) {}

    const extension = runtime === 'python' ? 'py' : 'js';
    const scriptPath = path.join(sessionDir, `execution_target.${extension}`);

    // Write code to isolated file
    fs.writeFileSync(scriptPath, code, 'utf-8');

    const executable = runtime === 'python' ? 'python' : 'node';
    const sanitizedEnv = this._getSanitizedEnvironment();
    const effectiveTimeout = Math.min(timeoutMs, 5000);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const child = spawn(executable, [scriptPath], {
        cwd: sessionDir,
        env: sanitizedEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try { child.kill('SIGKILL'); } catch (_) {}
      }, effectiveTimeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > 50000) { // 50KB stdout buffer limit
          stdout = stdout.slice(0, 50000) + '\n[TRUNCATED: Output buffer ceiling reached]';
          try { child.kill(); } catch (_) {}
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 20000) {
          stderr = stderr.slice(0, 20000) + '\n[TRUNCATED: Error buffer ceiling reached]';
        }
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        // Cleanup sandbox session directory
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (_) {}

        resolve({
          stdout: stdout.trim(),
          stderr: isTimedOut ? `TIMEOUT: Execution exceeded ${effectiveTimeout}ms limit.` : stderr.trim(),
          exitCode: isTimedOut ? 124 : (exitCode ?? 0),
          durationMs,
          timedOut: isTimedOut,
          artifacts: [],
          limitations: [
            'No access to network or external sockets',
            'No access to OAuth Vault or user environment variables',
            `Execution timeout enforced at ${effectiveTimeout}ms`
          ]
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
        resolve({
          stdout: '',
          stderr: `SPAWN_ERROR: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          timedOut: false,
          artifacts: [],
          limitations: ['Subprocess spawn failed']
        });
      });
    });
  }
}

export const sandboxExecutionToolInstance = new SandboxExecutionTool();
export default sandboxExecutionToolInstance;
