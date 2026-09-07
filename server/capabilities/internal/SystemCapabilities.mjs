import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function powershell(command) {
    const { stdout } = await execFileAsync(
        "powershell.exe",
        [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            command
        ],
        {
            windowsHide: true,
            timeout: 20000,
            maxBuffer: 10 * 1024 * 1024
        }
    );

    return stdout.trim();
}

export const SystemCapabilities = [
    {
        name: "system.info",
        description: "Return basic Windows host information.",

        async execute() {
            return {
                success: true,
                hostname: os.hostname(),
                platform: process.platform,
                architecture: process.arch,
                release: os.release(),
                uptimeSeconds: os.uptime(),
                cpuCount: os.cpus().length
            };
        }
    },

    {
        name: "system.cpu",
        description: "Return current CPU information.",

        async execute() {
            const cpu = os.cpus();

            return {
                success: true,
                cpuCount: cpu.length,
                model: cpu[0]?.model || null,
                speedMHz: cpu[0]?.speed || null,
                loadAverage: os.loadavg()
            };
        }
    },

    {
        name: "system.memory",
        description: "Return real Windows host memory usage.",

        async execute() {
            const total = os.totalmem();
            const free = os.freemem();
            const used = total - free;

            return {
                success: true,
                totalBytes: total,
                freeBytes: free,
                usedBytes: used,
                usedPercent:
                    Number(((used / total) * 100).toFixed(2))
            };
        }
    },

    {
        name: "system.storage",
        description: "Return Windows disk usage.",

        async execute() {
            const output = await powershell(
                `Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | ConvertTo-Json -Compress`
            );

            return {
                success: true,
                drives: JSON.parse(output || "[]")
            };
        }
    },

    {
        name: "system.processes",
        description: "Return running Windows processes.",

        async execute() {
            const output = await powershell(
                `Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64 | Sort-Object CPU -Descending | Select-Object -First 50 | ConvertTo-Json -Compress`
            );

            return {
                success: true,
                processes: JSON.parse(output || "[]")
            };
        }
    },

    {
        name: "system.ports",
        description: "Return listening TCP ports.",

        async execute() {
            const output = await powershell(
                `Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort | ConvertTo-Json -Compress`
            );

            return {
                success: true,
                ports: JSON.parse(output || "[]")
            };
        }
    },

    {
        name: "system.health",
        description: "Check JIN Router and Ollama health.",

        async execute() {
            const check = async url => {
                try {
                    const controller = new AbortController();

                    const timer = setTimeout(
                        () => controller.abort(),
                        5000
                    );

                    const response = await fetch(url, {
                        signal: controller.signal
                    });

                    clearTimeout(timer);

                    return {
                        online: response.ok,
                        status: response.status
                    };
                } catch (error) {
                    return {
                        online: false,
                        error: error.message
                    };
                }
            };

            return {
                success: true,
                router: await check(
                    "http://127.0.0.1:20200/health"
                ),
                ollama: await check(
                    "http://127.0.0.1:11434/api/tags"
                )
            };
        }
    }
];
