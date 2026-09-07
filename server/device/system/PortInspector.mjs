/**
 * PortInspector.mjs
 * Checks which configured runtime ports are listening and maps them to the
 * owning process. LOCAL ONLY. Read-only, no connections are opened.
 */

import net from 'net';
import { runPowershell } from '../platform/PlatformProbe.mjs';

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Lightweight in-process fallback: does SOMETHING listen on the port? */
async function probePortInUse(port) {
  return new Promise(resolve => {
    const server = net.createServer(s => s.destroy());
    server.once('error', () => { server.close(); resolve(true); });
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(false));
    });
  });
}

export class PortInspector {
  /**
   * @param {Array<{port:number,label:string}>} ports
   * @param {Map<number,string>} [pidToName] optional pid → process name map
   */
  async checkPorts(ports, pidToName = null) {
    const wired = (ports || []).map(p => ({
      port: Number(p.port),
      label: p.label || `port-${p.port}`
    }));

    let rows = [];
    if (process.platform === 'win32') {
      const filter = wired.map(p => p.port).join(',');
      rows = toArray(await runPowershell(
        `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.LocalPort -in @(${filter}) } | ` +
        `ForEach-Object { [pscustomobject]@{ Port = $_.LocalPort; OwningProcess = $_.OwningProcess } } | ConvertTo-Json -Compress`
      ));
    }

    const map = new Map();
    for (const r of rows) {
      const port = Number(r.Port);
      const pid = Number(r.OwningProcess) || 0;
      const name = pidToName ? (pidToName.get(pid) || 'unknown') : 'unknown';
      map.set(port, { pid, processName: name });
    }

    const result = [];
    for (const p of wired) {
      const owner = map.get(p.port);
      if (owner) {
        result.push({ port: p.port, label: p.label, listening: true, ...owner });
      } else if (process.platform !== 'win32' || !rows.length) {
        const inUse = await probePortInUse(p.port);
        result.push({ port: p.port, label: p.label, listening: inUse, pid: null, processName: null });
      } else {
        result.push({ port: p.port, label: p.label, listening: false, pid: null, processName: null });
      }
    }
    return result;
  }
}

export const portInspectorInstance = new PortInspector();
export default portInspectorInstance;