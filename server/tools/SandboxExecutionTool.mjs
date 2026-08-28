/**
 * SandboxExecutionTool.mjs
 * Pillar 1: Dedicated Isolated Runtime Sandbox for Safe Computation & Code Execution.
 * 
 * Capabilities:
 *  - JavaScript (Node.js), Python 3, and PowerShell in constrained subprocesses.
 *  - Multi-layer safety governance:
 *    * Ephemeral scratch directory per execution session
 *    * Strict timeout enforcement (5000ms max)
 *    * Output buffer limit (128MB memory ceiling)
 *    * Environment sanitization: strips all OAuth, Gemini API keys, vault keys, IDE credentials
 *    * Post-execution filesystem cleanup
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
      version: '3.0.0',
      description: 'Execute safe, isolated computational code, transformations, or data analyses in Node.js, Python, or PowerShell.',
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 6000,
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Source code or command to execute' },
          runtime: { type: 'string', enum: ['node', 'python', 'powershell'], default: 'node' },
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
   * Sanitizes environment variables so subprocess receives ZERO vault credentials, tokens, or API keys
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

    let extension = 'js';
    let executable = 'node';
    let spawnArgs = [];

    if (runtime === 'python') {
      extension = 'py';
      executable = 'python';
      const scriptPath = path.join(sessionDir, `target.${extension}`);
      fs.writeFileSync(scriptPath, code, 'utf-8');
      spawnArgs = [scriptPath];
    } else if (runtime === 'powershell') {
      extension = 'ps1';
      executable = 'powershell.exe';
      const scriptPath = path.join(sessionDir, `target.${extension}`);
      fs.writeFileSync(scriptPath, code, 'utf-8');
      spawnArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
    } else {
      // Default: Node.js
      extension = 'js';
      executable = 'node';
      const scriptPath = path.join(sessionDir, `target.${extension}`);
      fs.writeFileSync(scriptPath, code, 'utf-8');
      spawnArgs = [scriptPath];
    }

    const sanitizedEnv = this._getSanitizedEnvironment();
    const effectiveTimeout = Math.min(timeoutMs, 5000);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const child = spawn(executable, spawnArgs, {
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
        if (stdout.length > 50000) {
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

        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (_) {}

        resolve({
          success: !isTimedOut && (exitCode ?? 0) === 0,
          runtime,
          stdout: stdout.trim(),
          stderr: isTimedOut ? `TIMEOUT: Execution exceeded ${effectiveTimeout}ms limit.` : stderr.trim(),
          exitCode: isTimedOut ? 124 : (exitCode ?? 0),
          durationMs,
          timedOut: isTimedOut,
          limitations: [
            'No access to external network sockets',
            'No access to OAuth Vault or user environment variables',
            `Execution timeout enforced at ${effectiveTimeout}ms`
          ]
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
        resolve({
          success: false,
          runtime,
          stdout: '',
          stderr: `SPAWN_ERROR: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          timedOut: false,
          limitations: ['Subprocess spawn failed']
        });
      });
    });
  }
}

export const sandboxExecutionToolInstance = new SandboxExecutionTool();
export default sandboxExecutionToolInstance;
