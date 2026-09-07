/**
 * ProcessInspector.mjs
 * Reads running OS processes (LOCAL ONLY), classifies Node/browser/known
 * process families, and returns RAM/CPU sorts + Node command-lines for
 * duplicate / orphan analysis. NEVER kills or signals any process.
 */

import { runPowershell } from '../platform/PlatformProbe.mjs';

const PROCESS_LIST_SCRIPT = `
Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    [pscustomobject]@{
      Id = $_.Id
      Name = $_.ProcessName
      WS_MB = [math]::Round($_.WorkingSet64 / 1MB, 1)
      CPU_Sec = if ($_.CPU) { [math]::Round($_.CPU, 1) } else { 0 }
      Path = $_.Path
      StartTime = if ($_.StartTime) { $_.StartTime.ToString('o') } else { $null }
    }
  } catch { $null }
} | Where-Object { $_ -ne $null } | Sort-Object WS_MB -Descending | ConvertTo-Json -Compress -Depth 3
`;

const NODE_COMMAND_LINES_SCRIPT = `
Get-CimInstance Win32_Process -Filter "name='node.exe' or name='nodemon.exe' or name='electron.exe'" -ErrorAction SilentlyContinue |
ForEach-Object {
  try {
    [pscustomobject]@{
      Id = $_.ProcessId
      ParentId = $_.ParentProcessId
      Name = $_.Name
      CommandLine = $_.CommandLine
    }
  } catch { $null }
} | Where-Object { $_ -ne $null } | ConvertTo-Json -Compress -Depth 3
`;

const BROWSER_EXES = new Set(['chrome', 'msedge', 'firefox', 'opera', 'brave', 'chromium']);
const NODE_EXES = new Set(['node', 'nodemon', 'bun', 'deno', 'electron', 'nwjs']);

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function classify(name, path) {
  const n = (name || '').toLowerCase();
  const p = (path || '').toLowerCase();
  const isNode = NODE_EXES.has(n);
  const isBrowser = BROWSER_EXES.has(n);
  const isUltimateAI = isNode && (
    p.includes('ultimateai') ||
    p.includes('\\ultimateai\\') ||
    p.includes('/ultimateai/')
  );
  let kind = isNode ? 'node' : 'known';
  if (isBrowser) kind = 'browser';
  return {
    isNode,
    isBrowser,
    isUltimateAI,
    isKnown: isNode || isBrowser || n.includes('windows') || n.includes('svchost') || n.includes('explorer') || n === 'System'
  };
}

export class ProcessInspector {
  async getProcessList() {
    const rows = toArray(await runPowershell(PROCESS_LIST_SCRIPT));
    return rows.map(r => {
      const cls = classify(r.Name || '', r.Path || '');
      return {
        pid: Number(r.Id) || 0,
        name: String(r.Name || 'unknown'),
        wsMB: Number(r.WS_MB) || 0,
        cpuSec: Number(r.CPU_Sec) || 0,
        path: r.Path || null,
        startTime: r.StartTime || null,
        ...cls
      };
    }).filter(p => p.pid > 0);
  }

  getTopProcesses(list, by = 'wsMB', limit = 10) {
    const sorted = [...list].sort((a, b) => (b[by] || 0) - (a[by] || 0));
    return sorted.slice(0, limit).map(p => ({
      pid: p.pid,
      name: p.name,
      path: p.path,
      wsMB: p.wsMB,
      cpuSec: p.cpuSec
    }));
  }

  async getNodeCommandLines() {
    return toArray(await runPowershell(NODE_COMMAND_LINES_SCRIPT)).map(r => ({
      pid: Number(r.Id) || 0,
      parentPid: Number(r.ParentId) || 0,
      name: String(r.Name || 'node'),
      commandLine: String(r.CommandLine || '')
    }));
  }

  /**
   * Duplicate & orphan analysis for Node/Vite/UltimateAI runtime processes.
   * Orphan = parent PID no longer present in the live process table.
   */
  async detectRuntimeLeaks(nodeLines, livePids) {
    const liveSet = new Set((livePids || []).map(Number));
    const orphans = (nodeLines || []).filter(p => p.pid > 0 && p.parentPid > 0 && !liveSet.has(p.parentPid));

    // Normalize command line for dedupe: strip volatile args (cwd/PID-ish)
    const normalized = nodeLines.map(p => ({
      ...p,
      normalizedCmd: String(p.commandLine || '').replace(/\b\d{4,}\b/g, 'PID').trim()
    }));

    const groups = new Map();
    for (const p of normalized) {
      if (!p.normalizedCmd) continue;
      const key = p.normalizedCmd;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }

    const duplicates = [];
    for (const [cmd, group] of groups.entries()) {
      if (group.length > 1) {
        duplicates.push({
          commandLine: cmd,
          count: group.length,
          pids: group.map(g => g.pid),
          role: this._labelCommand(cmd)
        });
      }
    }

    return {
      duplicates,
      orphans: orphans.map(o => ({
        pid: o.pid,
        parentPid: o.parentPid,
        name: o.name,
        commandLine: o.commandLine,
        role: this._labelCommand(o.commandLine)
      }))
    };
  }

  _labelCommand(cmd = '') {
    if (/vite/.test(cmd)) return 'vite_dev_server';
    if (/LocalRouterServer/.test(cmd)) return 'local_router_20200';
    if (/server\.mjs/.test(cmd)) return 'ultimateai_backend_server';
    if (/electron/.test(cmd)) return 'electron_shell';
    if (/ollama/.test(cmd)) return 'ollama_runtime';
    return 'node_worker';
  }
}

export const processInspectorInstance = new ProcessInspector();
export default processInspectorInstance;