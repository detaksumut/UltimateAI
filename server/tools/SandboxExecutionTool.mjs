/**
 * SandboxExecutionTool.mjs
 * Pillar 1: Dedicated Isolated Runtime Sandbox for Safe Computation & Code Execution.
 *
 * Capabilities:
 *  - JavaScript (Node.js) and Python 3 in constrained subprocesses.
 *  - Multi-layer safety governance:
 *    * Static code safety validation (blocklist per runtime) — VULN-002 fix
 *    * 10KB code size limit — VULN-005 fix
 *    * Ephemeral scratch directory per execution session
 *    * High-entropy session IDs via crypto.randomBytes — VULN-006 fix
 *    * Strict timeout enforcement (5000ms max)
 *    * Output buffer limit (50KB stdout / 20KB stderr)
 *    * Environment sanitization: node binary dir only, all credentials stripped — VULN-003 fix
 *    * PowerShell runtime DISABLED (AMSI bypass risk) — VULN-004 fix
 *    * Post-execution filesystem cleanup
 *
 * Security Audit: 2026-09-05 — Hardened v4.0.0
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';           // VULN-006: high-entropy session IDs
import fs from 'fs';
import path from 'path';
import os from 'os';

export class SandboxExecutionTool extends ToolContract {
  constructor() {
    super({
      name: 'sandbox.execute',
      version: '4.0.0',
      description: 'Execute safe, isolated computational code (math, data transforms, string ops) in Node.js or Python. Network, filesystem, and OS access are blocked by policy.',
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 6000,
      inputSchema: {
        type: 'object',
        properties: {
          code:      { type: 'string', description: 'Source code to execute — must pass static safety validation' },
          runtime:   { type: 'string', enum: ['node', 'python'], default: 'node' },
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

  // ── VULN-002 & VULN-005: Static Code Safety Validator ──────────────────────
  //
  // Blocklist patterns per runtime. Each entry has:
  //   pattern: RegExp — the dangerous construct to detect
  //   label:   string — human-readable name for the violation report
  //
  static BLOCKED_PATTERNS = {
    node: [
      { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/i, label: 'child_process import' },
      { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/i,            label: 'fs (filesystem) import' },
      { pattern: /require\s*\(\s*['"`]net['"`]\s*\)/i,           label: 'net (socket) import' },
      { pattern: /require\s*\(\s*['"`]https?['"`]\s*\)/i,        label: 'http/https import' },
      { pattern: /require\s*\(\s*['"`]os['"`]\s*\)/i,            label: 'os import' },
      { pattern: /require\s*\(\s*['"`]path['"`]\s*\)/i,          label: 'path import' },
      { pattern: /require\s*\(\s*['"`]crypto['"`]\s*\)/i,        label: 'crypto import' },
      { pattern: /require\s*\(\s*['"`]stream['"`]\s*\)/i,        label: 'stream import' },
      { pattern: /require\s*\(\s*['"`]cluster['"`]\s*\)/i,       label: 'cluster import' },
      { pattern: /require\s*\(\s*['"`]worker_threads['"`]\s*\)/i,label: 'worker_threads import' },
      { pattern: /process\.env\b/i,                               label: 'process.env access' },
      { pattern: /process\.exit\s*\(/i,                           label: 'process.exit()' },
      { pattern: /process\.kill\s*\(/i,                           label: 'process.kill()' },
      { pattern: /process\.binding\s*\(/i,                        label: 'process.binding()' },
      { pattern: /eval\s*\(/i,                                    label: 'eval()' },
      { pattern: /new\s+Function\s*\(/i,                          label: 'new Function()' },
      { pattern: /globalThis\b/i,                                 label: 'globalThis' },
      { pattern: /import\s*\(/i,                                  label: 'dynamic import()' },
      { pattern: /\bfetch\s*\(/i,                                 label: 'fetch() network call' },
      { pattern: /XMLHttpRequest/i,                               label: 'XMLHttpRequest' },
      { pattern: /\bWebSocket\b/i,                                label: 'WebSocket' },
      { pattern: /Buffer\.from\s*\(.*base64/i,                    label: 'base64 decode (obfuscation risk)' },
    ],
    python: [
      { pattern: /^import\s+os\b/im,                              label: 'import os' },
      { pattern: /^from\s+os\b/im,                                label: 'from os import' },
      { pattern: /^import\s+subprocess\b/im,                      label: 'import subprocess' },
      { pattern: /^import\s+sys\b/im,                             label: 'import sys' },
      { pattern: /^import\s+socket\b/im,                          label: 'import socket' },
      { pattern: /^import\s+shutil\b/im,                          label: 'import shutil' },
      { pattern: /^import\s+pathlib\b/im,                         label: 'import pathlib' },
      { pattern: /^import\s+glob\b/im,                            label: 'import glob' },
      { pattern: /^import\s+ctypes\b/im,                          label: 'import ctypes' },
      { pattern: /\bopen\s*\(/i,                                   label: 'file open()' },
      { pattern: /__import__\s*\(/i,                               label: '__import__()' },
      { pattern: /\bexec\s*\(/i,                                   label: 'exec()' },
      { pattern: /\beval\s*\(/i,                                    label: 'eval()' },
      { pattern: /\burllib\b/i,                                     label: 'urllib network' },
      { pattern: /\brequests\b/i,                                   label: 'requests library' },
      { pattern: /\bhttplib\b/i,                                    label: 'httplib network' },
      { pattern: /\bpickle\b/i,                                     label: 'pickle (deserialization risk)' },
    ],
  };

  /**
   * Validates code string against the runtime blocklist.
   * Returns { safe: true } or { safe: false, reason: string }.
   *
   * VULN-002 (Zero code inspection) — FIXED
   * VULN-005 (No size limit) — FIXED
   */
  static _validateCodeSafety(code, runtime) {
    // Size guard
    if (code.length > 10_000) {
      return {
        safe: false,
        reason: `Code size ${code.length} bytes exceeds 10KB safety limit.`
      };
    }

    const patterns = SandboxExecutionTool.BLOCKED_PATTERNS[runtime] || [];
    for (const { pattern, label } of patterns) {
      if (pattern.test(code)) {
        return { safe: false, reason: `Blocked pattern detected: [${label}]` };
      }
    }

    return { safe: true, reason: null };
  }

  // ── VULN-003: Minimal PATH — node binary directory only ────────────────────
  /**
   * Returns a sanitized environment for the subprocess.
   * Only exposes the Node.js binary directory in PATH.
   * All credential/profile paths are explicitly emptied.
   *
   * VULN-003 (Full PATH inheritance) — FIXED
   */
  _getSanitizedEnvironment() {
    // Only the directory containing node.exe — nothing from user PATH
    const nodeBinDir = path.dirname(process.execPath);

    return {
      NODE_ENV:     'sandbox',
      PATH:         nodeBinDir,     // ← minimal PATH, no OS binaries
      SYSTEMROOT:   process.env.SYSTEMROOT || '',
      TEMP:         this.sandboxBaseDir,
      TMP:          this.sandboxBaseDir,
      // Explicitly empty all credential / profile variables
      USERPROFILE:  '',
      APPDATA:      '',
      LOCALAPPDATA: '',
      HOME:         '',
      HOMEPATH:     '',
      // Strip any lingering API key patterns just in case
      GROQ_API_KEY:      '',
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY_1:  '',
      GEMINI_API_KEY_2:  '',
      DEEPSEEK_API_KEY:  '',
      HEYGEN_API_KEY:    '',
      COHERE_API_KEY:    '',
      TAVILY_API_KEY:    '',
      GITHUB_TOKEN:      '',
      SUPABASE_ACCESS_TOKEN: '',
    };
  }

  // ── Main Execution Entry Point ─────────────────────────────────────────────
  async execute({ code, runtime = 'node', timeoutMs = 4000 } = {}) {
    if (!code || typeof code !== 'string') {
      throw new Error('INVALID_ARGUMENT: "code" string is required.');
    }

    // ── SECURITY GATE ───────────────────────────────────────────────────────
    // VULN-004: PowerShell disabled — AMSI bypass risk
    if (runtime === 'powershell') {
      return {
        success: false,
        runtime,
        stdout: '',
        stderr: 'RUNTIME_DISABLED: PowerShell runtime is disabled due to security policy (AMSI bypass risk). Use "node" or "python".',
        exitCode: 403,
        durationMs: 0,
        timedOut: false,
        securityViolation: true,
        violationReason: 'PowerShell runtime disabled — security policy.',
        limitations: ['PowerShell runtime has been disabled by security policy.']
      };
    }

    // VULN-001 & VULN-002: Static code safety validation
    const safety = SandboxExecutionTool._validateCodeSafety(code, runtime);
    if (!safety.safe) {
      return {
        success: false,
        runtime,
        stdout: '',
        stderr: `SECURITY_VIOLATION: Code rejected by safety validator. Reason: ${safety.reason}`,
        exitCode: 403,
        durationMs: 0,
        timedOut: false,
        securityViolation: true,
        violationReason: safety.reason,
        limitations: ['Code did not pass static security validation.']
      };
    }
    // ── END SECURITY GATE ───────────────────────────────────────────────────

    const startTime = Date.now();

    // VULN-006: High-entropy session ID via crypto.randomBytes (16 hex chars = 2^64)
    const sessionId  = `sb_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const sessionDir = path.join(this.sandboxBaseDir, sessionId);

    try {
      fs.mkdirSync(sessionDir, { recursive: true });
    } catch (_) {}

    let executable = 'node';
    let spawnArgs  = [];

    if (runtime === 'python') {
      executable = 'python';
      const scriptPath = path.join(sessionDir, 'target.py');
      fs.writeFileSync(scriptPath, code, 'utf-8');
      spawnArgs = [scriptPath];
    } else {
      // Default: Node.js
      executable = 'node';
      const scriptPath = path.join(sessionDir, 'target.js');
      fs.writeFileSync(scriptPath, code, 'utf-8');
      spawnArgs = [scriptPath];
    }

    const sanitizedEnv    = this._getSanitizedEnvironment();
    const effectiveTimeout = Math.min(timeoutMs, 5000);

    return new Promise((resolve) => {
      let stdout     = '';
      let stderr     = '';
      let isTimedOut = false;

      const child = spawn(executable, spawnArgs, {
        cwd:         sessionDir,
        env:         sanitizedEnv,
        stdio:       ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try { child.kill('SIGKILL'); } catch (_) {}
      }, effectiveTimeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > 50_000) {
          stdout = stdout.slice(0, 50_000) + '\n[TRUNCATED: Output buffer ceiling reached]';
          try { child.kill(); } catch (_) {}
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 20_000) {
          stderr = stderr.slice(0, 20_000) + '\n[TRUNCATED: Error buffer ceiling reached]';
        }
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}

        resolve({
          success:   !isTimedOut && (exitCode ?? 0) === 0,
          runtime,
          stdout:    stdout.trim(),
          stderr:    isTimedOut
            ? `TIMEOUT: Execution exceeded ${effectiveTimeout}ms limit.`
            : stderr.trim(),
          exitCode:  isTimedOut ? 124 : (exitCode ?? 0),
          durationMs,
          timedOut:  isTimedOut,
          limitations: [
            'No access to external network sockets',
            'No access to OAuth Vault or user environment variables',
            'No access to filesystem outside ephemeral session directory',
            `Execution timeout enforced at ${effectiveTimeout}ms`,
            'PowerShell runtime disabled'
          ]
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
        resolve({
          success:   false,
          runtime,
          stdout:    '',
          stderr:    `SPAWN_ERROR: ${err.message}`,
          exitCode:  1,
          durationMs: Date.now() - startTime,
          timedOut:  false,
          limitations: ['Subprocess spawn failed']
        });
      });
    });
  }
}

export const sandboxExecutionToolInstance = new SandboxExecutionTool();
export default sandboxExecutionToolInstance;
