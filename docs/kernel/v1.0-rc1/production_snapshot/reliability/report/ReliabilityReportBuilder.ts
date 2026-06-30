import * as fs from "fs";
import * as path from "path";
import { CheckpointManager } from "../checkpoint/CheckpointManager";

export class ReliabilityReportBuilder {
  constructor(
    private checkpointManager: CheckpointManager,
    private outputDir: string = path.join(process.cwd(), "reports/reliability")
  ) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async buildReport(traceId: string, reliabilityEvents: any[]): Promise<void> {
    const checkpoints = this.checkpointManager.getHistory(traceId);
    
    // Calculate simple stats
    const retryEvents = reliabilityEvents.filter(e => e.eventType.startsWith("Retry"));
    const circuitEvents = reliabilityEvents.filter(e => e.eventType.startsWith("Circuit"));
    
    const reportData = {
      traceId,
      timestamp: Date.now(),
      checkpoints: checkpoints.map(c => ({
        id: c.checkpointId,
        runtime: c.runtimeId,
        phase: c.phase,
        sequence: c.sequenceNumber
      })),
      retryCount: retryEvents.filter(e => e.eventType === "RetryStarted").length,
      circuitBreakerTrips: circuitEvents.filter(e => e.eventType === "CircuitOpened").length,
      recoveryPath: retryEvents.map(e => e.eventType),
      events: reliabilityEvents
    };

    // 1. JSON
    const jsonPath = path.join(this.outputDir, `execution-${traceId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));

    // 2. Markdown
    const mdPath = path.join(this.outputDir, `execution-${traceId}.md`);
    const mdContent = `# Reliability Report: ${traceId}
Date: ${new Date().toISOString()}

## Recovery Stats
- **Total Retries**: ${reportData.retryCount}
- **Circuit Breaker Trips**: ${reportData.circuitBreakerTrips}
- **Total Checkpoints**: ${checkpoints.length}

## Checkpoints
${checkpoints.map(c => `- ${c.runtimeId} (${c.phase}) [Seq: ${c.sequenceNumber}]`).join("\n")}

## Reliability Events
${reliabilityEvents.map(e => `- ${e.eventType}: ${JSON.stringify(e.payload || {})}`).join("\n")}
`;
    fs.writeFileSync(mdPath, mdContent);

    // 3. HTML Viewer
    const htmlPath = path.join(this.outputDir, `execution-${traceId}.html`);
    const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Reliability Report - ${traceId}</title></head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h1>Reliability Report: ${traceId}</h1>
  <h3>Stats</h3>
  <ul>
    <li>Total Retries: ${reportData.retryCount}</li>
    <li>Circuit Trips: ${reportData.circuitBreakerTrips}</li>
  </ul>
  <h3>Checkpoints</h3>
  <pre>${JSON.stringify(reportData.checkpoints, null, 2)}</pre>
</body>
</html>`;
    fs.writeFileSync(htmlPath, htmlContent);

    console.log(`[Reliability] Generated static report for trace ${traceId} at ${this.outputDir}`);
  }
}
