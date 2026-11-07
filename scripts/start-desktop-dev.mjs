import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_PORT = Number(process.env.ULTIMATEAI_DEV_PORT || 5177);
const DEV_URL = `http://localhost:${DEV_PORT}`;
const BROKER_DEEP_LINK = 'ultimateai://broker/open?broker=xm&platform=xm-web';

function log(message) {
  process.stdout.write(`[desktop-dev] ${message}\n`);
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1200, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

let vite = null;
let electron = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electron && !electron.killed) electron.kill();
  if (vite && !vite.killed) vite.kill();
  setTimeout(() => process.exit(code), 150);
}

async function main() {
  const alreadyRunning = await canConnect(DEV_PORT);
  if (!alreadyRunning) {
    const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!existsSync(viteBin)) {
      log('Vite tidak ditemukan. Jalankan npm install terlebih dahulu.');
      process.exit(1);
    }
    log(`Menjalankan Vite di http://localhost:${DEV_PORT} ...`);
    vite = spawn(process.execPath, [viteBin, '--port', String(DEV_PORT), '--strictPort'], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: false,
    });
    vite.on('exit', (code) => {
      if (!shuttingDown) {
        log(`Vite berhenti (kode ${code}).`);
        shutdown(code ?? 1);
      }
    });
  } else {
    log(`Vite sudah berjalan di port ${DEV_PORT}.`);
  }

  const ready = await waitForPort(DEV_PORT, 60000);
  if (!ready) {
    log(`Vite tidak siap di port ${DEV_PORT}. Periksa terminal Vite.`);
    shutdown(1);
    return;
  }

  const electronBin = process.platform === 'win32'
    ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron');
  if (!existsSync(electronBin)) {
    log('Electron tidak ditemukan. Jalankan npm install terlebih dahulu.');
    shutdown(1);
    return;
  }

  log('Membuka UltimateAI sebagai aplikasi desktop (Electron)...');
  electron = spawn(electronBin, ['.', BROKER_DEEP_LINK], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: false,
    env: { ...process.env, ULTIMATEAI_DEV_URL: DEV_URL },
  });
  electron.on('exit', (code) => {
    if (!shuttingDown) {
      log(`Electron berhenti (kode ${code}).`);
      shutdown(code ?? 0);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((err) => {
  log(err?.stack || String(err));
  shutdown(1);
});
