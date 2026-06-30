import * as fs from "fs";
import * as path from "path";
import { RuntimeHealthProjector } from "../projectors/RuntimeHealthProjector";
import { RuntimeMetricsProjector } from "../projectors/RuntimeMetricsProjector";
import { ArtifactTimelineProjector } from "../projectors/ArtifactTimelineProjector";

export class ObservabilityReportBuilder {
  constructor(
    private healthProjector: RuntimeHealthProjector,
    private metricsProjector: RuntimeMetricsProjector,
    private timelineProjector: ArtifactTimelineProjector,
    private outputDir: string = path.join(process.cwd(), "reports/observability")
  ) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async buildReport(traceId: string): Promise<void> {
    const dag = this.timelineProjector.getDAG(traceId);
    if (!dag) return;

    const allHealth = this.healthProjector.getAllHealth();
    const allMetrics = this.metricsProjector.getAllMetrics();

    const reportData = {
      traceId,
      timestamp: Date.now(),
      health: allHealth,
      metrics: allMetrics,
      timeline: dag
    };

    // 1. JSON (Source of Truth)
    const jsonPath = path.join(this.outputDir, `execution-${traceId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));

    // 2. Markdown Summary
    const mdPath = path.join(this.outputDir, `execution-${traceId}.md`);
    const mdContent = `# Observability Report: ${traceId}
Date: ${new Date().toISOString()}

## Runtime Health
${allHealth.map(h => `- **${h.runtimeId}**: ${h.healthStatus} (Avg: ${h.averageDurationMs}ms, Fails: ${h.failureCount})`).join("\n")}

## Metrics
${allMetrics.map(m => `- **${m.runtimeId}**: ${m.executionCount} Executions, Max ${m.maxDurationMs}ms`).join("\n")}

## Timeline Events
${dag.nodes.map(n => `- ${n.timestamp}: [${n.type}] ${n.label}`).join("\n")}
`;
    fs.writeFileSync(mdPath, mdContent);

    // 3. HTML Viewer
    const htmlPath = path.join(this.outputDir, `execution-${traceId}.html`);
    const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Observability Report - ${traceId}</title></head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h1>Observability Report: ${traceId}</h1>
  <h3>Runtime Health</h3>
  <ul>
    ${allHealth.map(h => `<li><b>${h.runtimeId}</b>: ${h.healthStatus} (${h.averageDurationMs}ms avg)</li>`).join("")}
  </ul>
  <h3>Timeline DAG</h3>
  <pre>${JSON.stringify(dag, null, 2)}</pre>
</body>
</html>`;
    fs.writeFileSync(htmlPath, htmlContent);

    // 4. SVG Timeline (Simple Graphviz-like visualization logic skipped for brevity, emitting basic SVG)
    const svgPath = path.join(this.outputDir, `timeline-${traceId}.svg`);
    const svgContent = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="20" font-family="sans-serif" font-size="20">Timeline for ${traceId}</text>
  ${dag.nodes.map((n, i) => `<rect x="10" y="${50 + i * 40}" width="300" height="30" fill="#f0f0f0" stroke="#333"/>
  <text x="20" y="${70 + i * 40}" font-family="sans-serif" font-size="14">${n.label}</text>`).join("\n")}
</svg>`;
    fs.writeFileSync(svgPath, svgContent);

    console.log(`[Observability] Generated static report for trace ${traceId} at ${this.outputDir}`);
  }
}
