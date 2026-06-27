// electron/runtime.js — Process Manager for 9Router + Express
// ────────────────────────────────────────────────────────────
// Manages child processes, health checks, auto-restart, and graceful shutdown.
// ────────────────────────────────────────────────────────────

const { fork, spawn } = require('child_process');
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
    this.nineRouterProcess = null;
    this.expressPort = 3001;
    this.nineRouterPort = 20128;
    this.healthInterval = null;

    this._expressRetries = 0;
    this._nineRouterRetries = 0;
    this._stopping = false;
  }

  // ── Start All Services ──────────────────────────────────────────────────
  async start(onStatus) {
    this._stopping = false;

    // Step 1: Start 9Router
    onStatus?.('Starting AI Engine...');
    await this._start9Router();
    onStatus?.('AI Engine ready');

    // Step 2: Start Express backend
    onStatus?.('Starting Research Platform...');
    await this._startExpress();
    onStatus?.('Research Platform ready');

    onStatus?.('Ready!');
  }

  // ── Start 9Router ───────────────────────────────────────────────────────
  async _start9Router() {
    return new Promise((resolve, reject) => {
      const nineRouterPath = this.isDev
        ? null // In dev, assume 9Router is running externally
        : path.join(this.appPath, '..', 'runtime', '9router', '9router.exe');

      if (this.isDev) {
        // In development, 9Router should already be running
        console.log('[Runtime] Dev mode: assuming 9Router is running externally on port', this.nineRouterPort);
        resolve();
        return;
      }

      try {
        this.nineRouterProcess = spawn(nineRouterPath, [], {
          cwd: path.dirname(nineRouterPath),
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        this.nineRouterProcess.on('error', (err) => {
          console.error('[Runtime] 9Router error:', err.message);
        });

        this.nineRouterProcess.on('exit', (code) => {
          console.warn('[Runtime] 9Router exited with code', code);
          if (!this._stopping && this._nineRouterRetries < MAX_RETRIES) {
            this._nineRouterRetries++;
            console.log(`[Runtime] Restarting 9Router (attempt ${this._nineRouterRetries}/${MAX_RETRIES})...`);
            setTimeout(() => this._start9Router().catch(console.error), 2000);
          }
        });

        // Wait for health check
        this._waitForService(this.nineRouterPort, '/health', STARTUP_TIMEOUT_MS)
          .then(resolve)
          .catch(reject);
      } catch (err) {
        reject(new Error(`Failed to start 9Router: ${err.message}`));
      }
    });
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
        NINE_ROUTER_URL: `http://localhost:${this.nineRouterPort}/v1`,
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
      const healthy = expressOk; // 9Router health is checked indirectly through Express

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

    // Graceful shutdown: Express first, then 9Router
    if (this.expressProcess) {
      this.expressProcess.kill('SIGTERM');
      await this._waitForExit(this.expressProcess, 5000);
      this.expressProcess = null;
    }

    if (this.nineRouterProcess) {
      this.nineRouterProcess.kill('SIGTERM');
      await this._waitForExit(this.nineRouterProcess, 5000);
      this.nineRouterProcess = null;
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────
  getStatus() {
    return {
      express: this.expressProcess && !this.expressProcess.killed ? 'running' : 'stopped',
      nineRouter: this.isDev ? 'external' : (this.nineRouterProcess && !this.nineRouterProcess.killed ? 'running' : 'stopped'),
      expressPort: this.expressPort,
      nineRouterPort: this.nineRouterPort,
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
