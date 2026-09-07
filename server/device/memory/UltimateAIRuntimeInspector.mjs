/**
 * UltimateAIRuntimeInspector.mjs
 * Recognizes the running UltimateAI runtime on this machine:
 * Vite dev server, Local Router, central backend, Ollama, DOM bridge.
 *
 * Ports come from existing config / env (not random guesses):
 *   config.port (20200)          → server.mjs / LocalRouter backend
 *   config.endpoints.ollama      → Ollama
 *   process.env.LOCAL_ROUTER_PORT(20200)
 *   vite.config server.port 5177 and jin-dom-bridge 9999 are read from
 *   DEVICE_MONITOR_PORTS env when present, else the known defaults.
 *
 * Never crashes when a service is not running — reports it as DOWN.
 * LOCAL ONLY.
 */

import { config } from '../../config/env.mjs';
import { portInspectorInstance } from '../system/PortInspector.mjs';
import { processInspectorInstance } from '../system/ProcessInspector.mjs';

const ROOT_DIR = process.env.DEVICE_ULTIMATEAI_ROOT || process.cwd();

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export class UltimateAIRuntimeInspector {
  constructor() {
    this.expectedPorts = this._derivePorts();
  }

  _derivePorts() {
    const vitePort = parseInt(process.env.VITE_PORT || '5177', 10);
    const routerPort = parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10);
    const backendPort = parseInt(process.env.PORT || String(config.port || '20200'), 10);
    const ollamaUrl = config.endpoints?.ollama || 'http://127.0.0.1:11434';
    const ollamaPort = parseInt(new URL(ollamaUrl).port || '11434', 10);
    const bridgePort = parseInt(process.env.JIN_DOM_BRIDGE_PORT || '9999', 10);

    const overrides = [];
    try {
      const raw = process.env.DEVICE_MONITOR_PORTS;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) for (const p of parsed) overrides.push({ port: Number(p.port), label: p.label });
      }
    } catch {}

    const base = [
      { port: vitePort, label: 'vite_dev_5177' },
      { port: routerPort, label: 'local_router_20200' },
      { port: backendPort, label: 'ultimateai_backend' },
      { port: ollamaPort, label: 'ollama_local_llm' },
      { port: bridgePort, label: 'jin_dom_bridge' }
    ];
    const all = [...overrides, ...base];
    const seen = new Set();
    return all.filter(p => {
      if (seen.has(p.port)) return false;
      seen.add(p.port);
      return true;
    });
  }

  _matchNodeLine(lines, pattern) {
    const found = (lines || []).find(l => pattern.test(l.commandLine || ''));
    return found ? { pid: found.pid, commandLine: (found.commandLine || '').slice(0, 240) } : null;
  }

  async detect() {
    const [procList, nodeLines, portRows] = await Promise.all([
      processInspectorInstance.getProcessList().catch(() => []),
      processInspectorInstance.getNodeCommandLines().catch(() => []),
      portInspectorInstance.checkPorts(this.expectedPorts).catch(() => []),
    ]);

    const livePids = procList.map(p => p.pid);
    const runtimeLeaks = await processInspectorInstance.detectRuntimeLeaks(nodeLines, livePids).catch(() => ({ duplicates: [], orphans: [] }));

    const portMap = new Map(portRows.map(r => [Number(r.port), r]));

    const byLabel = port => portMap.get(Number(port));
    const isListening = port => {
      const row = portMap.get(Number(port));
      return Boolean(row && row.listening);
    };

    const vitePort = this.expectedPorts.find(p => p.label === 'vite_dev_5177')?.port;
    const routerPort = this.expectedPorts.find(p => p.label === 'local_router_20200')?.port;
    const backendPort = this.expectedPorts.find(p => p.label === 'ultimateai_backend')?.port;
    const ollamaPort = this.expectedPorts.find(p => p.label === 'ollama_local_llm')?.port;
    const bridgePort = this.expectedPorts.find(p => p.label === 'jin_dom_bridge')?.port;

    const services = [
      {
        name: 'vite_dev_server',
        label: 'Vite Dev Server (frontend)',
        port: vitePort,
        listening: isListening(vitePort),
        process: this._matchNodeLine(nodeLines, /vite/),
        state: isListening(vitePort) ? 'RUNNING' : 'DOWN'
      },
      {
        name: 'local_router_20200',
        label: 'UltimateAI Local Router',
        port: routerPort,
        listening: isListening(routerPort),
        process: this._matchNodeLine(nodeLines, /LocalRouterServer/),
        state: isListening(routerPort) ? 'RUNNING' : 'DOWN'
      },
      {
        name: 'ultimateai_backend',
        label: 'UltimateAI Backend (server.mjs)',
        port: backendPort,
        listening: isListening(backendPort),
        process: this._matchNodeLine(nodeLines, /server\.mjs/),
        state: isListening(backendPort) ? 'RUNNING' : 'DOWN'
      },
      {
        name: 'ollama_local_llm',
        label: 'Ollama (Local LLM)',
        port: ollamaPort,
        listening: isListening(ollamaPort),
        process: this._matchNodeLine(nodeLines, /ollama/),
        state: isListening(ollamaPort) ? 'RUNNING' : 'DOWN'
      },
      {
        name: 'jin_dom_bridge',
        label: 'JIN DOM Bridge',
        port: bridgePort,
        listening: isListening(bridgePort),
        process: this._matchNodeLine(nodeLines, /bridge/),
        state: isListening(bridgePort) ? 'RUNNING' : 'DOWN'
      }
    ];

    const runningCount = services.filter(s => s.state === 'RUNNING').length;
    const critical = services.filter(s => ['vite_dev_server', 'local_router_20200', 'ultimateai_backend'].includes(s.name));
    const criticalUp = critical.filter(s => s.listening).length;
    const status = criticalUp === critical.length ? 'ACTIVE' : (criticalUp > 0 ? 'PARTIAL' : 'DOWN');

    const relevantNode = procList.filter(p => p.isNode).map(p => ({
      pid: p.pid,
      name: p.name,
      wsMB: p.wsMB,
      cpuSec: p.cpuSec
    }));

    const duplicates = (runtimeLeaks.duplicates || []).filter(d => /vite|LocalRouterServer|server\.mjs|electron/.test(d.role || 'uvue'));
    const orphans = (runtimeLeaks.orphans || []);

    return {
      status,
      runningCount,
      criticalUp,
      projectRoot: ROOT_DIR,
      services,
      nodeProcesses: relevantNode,
      nodeLines: nodeLines.slice(0, 40),
      risks: {
        duplicates,
        orphans
      },
      portRows
    };
  }
}

export const ultimateAIRuntimeInspectorInstance = new UltimateAIRuntimeInspector();
export default ultimateAIRuntimeInspectorInstance;