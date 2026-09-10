// electron/runtime.js — Process Manager for Express Backend
// ────────────────────────────────────────────────────────────
// Manages child processes, health checks, auto-restart, and graceful shutdown.
// ────────────────────────────────────────────────────────────

const { fork } = require('child_process');
const path = require('path');
const http = require('http');

const MAX_RETRIES = 3;
const HEALTH_INTERVAL_MS = 30_000; // 30 seconds
const STARTUP_TIMEOUT_MS = 15_000; // 15 seconds

class RuntimeManager {
  constructor({ appPath, userDataPath, isDev }) {
    this.appPath = appPath;
    this.userDataPath = userDataPath;
    this.isDev = isDev;

    this.expressProcess = null;
    this.expressPort = 3001;
    this.healthInterval = null;

    this._expressRetries = 0;
    this._stopping = false;
  }

  // ── Start All Services ──────────────────────────────────────────────────
  async start() {
    this._stopping = false;
    await this._startExpress();
  }

  // ── Start Express ───────────────────────────────────────────────────────
  async _startExpress() {
    return new Promise(async (resolve, reject) => {
      // Phase 5.1 Requirement: Detect backend already running -> Reuse it
      const alreadyRunning = await this._ping(this.expressPort, '/api/projects');
      if (alreadyRunning) {
        console.log('[Runtime] Backend already running on port', this.expressPort, '- reusing.');
        resolve();
        return;
      }

      const serverPath = path.join(this.appPath, 'server.js');

      const env = {
        ...process.env,
        PORT: String(this.expressPort),
        NODE_ENV: this.isDev ? 'development' : 'production',
        ULTIMATEAI_DATA_PATH: this.userDataPath,
      };

      try {
        this.expressProcess = fork(serverPath, [], {
          cwd: this.appPath,
          env,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          windowsHide: true,
        });

        this.expressProcess.on('error', (err) => {
          console.error('[Runtime] Express error:', err.message);
        });

        this.expressProcess.on('exit', (code) => {
          console.warn('[Runtime] Express exited with code', code);
          if (!this._stopping && this._expressRetries < MAX_RETRIES) {
            this._expressRetries++;
            console.log(`[Runtime] Restarting Express (attempt ${this._expressRetries}/${MAX_RETRIES})...`);
            setTimeout(() => this._startExpress().catch(console.error), 1000);
          }
        });

        // Wait for Express to be ready
        this._waitForService(this.expressPort, '/api/projects', STARTUP_TIMEOUT_MS)
          .then(() => {
            this._expressRetries = 0; // Reset on success
            resolve();
          })
          .catch(reject);
      } catch (err) {
        reject(new Error(`Failed to start Express: ${err.message}`));
      }
    });
  }

  // ── Health Check Loop ───────────────────────────────────────────────────
  startHealthCheck(onHealthChange) {
    let lastHealthy = true;

    this.healthInterval = setInterval(async () => {
      const expressOk = await this._ping(this.expressPort, '/api/projects');
      const healthy = expressOk;

      if (healthy !== lastHealthy) {
        lastHealthy = healthy;
        onHealthChange?.(healthy);
      }
    }, HEALTH_INTERVAL_MS);
  }

  // ── Stop All Services ───────────────────────────────────────────────────
  async stop() {
    this._stopping = true;

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    // Graceful shutdown: Express
    if (this.expressProcess) {
      this.expressProcess.kill('SIGTERM');
      await this._waitForExit(this.expressProcess, 5000);
      this.expressProcess = null;
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────
  getStatus() {
    return {
      express: this.expressProcess && !this.expressProcess.killed ? 'running' : 'stopped',
      expressPort: this.expressPort,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  _ping(port, urlPath) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 3000 }, (res) => {
        resolve(res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  _waitForService(port, urlPath, timeoutMs) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const check = async () => {
        if (Date.now() > deadline) {
          reject(new Error(`Service on port ${port} did not start within ${timeoutMs}ms`));
          return;
        }
        const ok = await this._ping(port, urlPath);
        if (ok) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  _waitForExit(proc, timeoutMs) {
    return new Promise((resolve) => {
      if (!proc || proc.killed) { resolve(); return; }
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, timeoutMs);
      proc.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

module.exports = { RuntimeManager };
